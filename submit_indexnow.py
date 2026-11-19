#!/usr/bin/env python3
"""
submit_indexnow.py
Submissão cirúrgica (delta-only, máx 250 URLs/dia) para a API IndexNow (Bing / Copilot / Yandex).

Boas práticas anti-spam / reputação de domínio:
1. Usa chave única canônica (129a651889904b9ab04b2df8015f64f7).
2. Envia APENAS hubs dinâmicos principais + ativos VIGENTES que tiveram negociação B3 no último pregão.
3. Deduplicação 1x/dia em `.indexnow_last_run.json` (evita reenvios repetidos quando a DAG roda 2x no mesmo dia).
4. Aguarda o deploy do Netlify refletir o `_metadata.json` ao vivo antes de notificar o Bingbot.
"""

import argparse
import csv
import hashlib
import json
import os
import re
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
HOST = "fixdatabrasil.com.br"
KEY = "129a651889904b9ab04b2df8015f64f7"
KEY_LOCATION = f"https://{HOST}/{KEY}.txt"
INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow"
LIVE_METADATA_URL = f"https://{HOST}/data/_metadata.json"
LOCAL_METADATA_PATH = os.path.join(BASE_DIR, "public", "data", "_metadata.json")
ASSETS_CSV = os.path.join(BASE_DIR, "public", "data", "assets_master.csv")
TRADES_RECENT_CSV = os.path.join(BASE_DIR, "public", "data", "b3_trades_recent.csv")
STATE_FILE = os.path.join(BASE_DIR, ".indexnow_last_run.json")
MAX_URLS_PER_DAY = 250


def is_valid_ticker(ticker: str) -> bool:
    t = str(ticker or "").strip()
    if t.lower() in ("nan", "none", "n/a", "null", "", "-", "0"):
        return False
    if len(t) == 12 and re.match(r"^BR[A-Z0-9]{4}(DBS|DBC|DBN|CRI|CRA|NC0|CTF|LFI)[A-Z0-9]{2}\d$", t):
        return False
    if t.startswith(("CRI_", "CRA_", "DEB_")):
        return False
    if t.isdigit() or " " in t or "/" in t or "\\" in t:
        return False
    return True


def read_local_metadata() -> str:
    if not os.path.exists(LOCAL_METADATA_PATH):
        return ""
    try:
        with open(LOCAL_METADATA_PATH, "r", encoding="utf-8") as f:
            return str(json.load(f).get("last_update") or "").strip()
    except Exception:
        return ""


def get_delta_urls(limit: int = MAX_URLS_PER_DAY) -> tuple[list[str], str]:
    core_paths = [
        "",
        "negocios/",
        "debentures/",
        "debentures-incentivadas/",
        "cri/",
        "cra/",
        "agenda/",
        "primary/",
        "emissores/",
        "setores/",
    ]
    urls = [f"https://{HOST}/{p}" for p in core_paths]
    seen = set(urls)

    active_tickers = set()
    if os.path.exists(ASSETS_CSV):
        try:
            with open(ASSETS_CSV, "r", encoding="utf-8", errors="ignore") as f:
                for r in csv.DictReader(f):
                    if str(r.get("status_ativo") or "").strip() == "Ativo":
                        tk = str(r.get("ticker") or "").strip().upper()
                        if is_valid_ticker(tk):
                            active_tickers.add(tk)
        except Exception as e:
            print(f"⚠️ Aviso ao ler {ASSETS_CSV}: {e}")

    latest_trade_date = ""
    if os.path.exists(TRADES_RECENT_CSV):
        try:
            rows = []
            with open(TRADES_RECENT_CSV, "r", encoding="utf-8", errors="ignore") as f:
                for r in csv.DictReader(f):
                    dt = str(r.get("data_negocio") or "")[:10]
                    tk = str(r.get("ticker") or "").strip().upper()
                    if not dt or not is_valid_ticker(tk):
                        continue
                    if active_tickers and tk not in active_tickers:
                        continue
                    try:
                        vol = float(r.get("volume_financeiro") or 0)
                    except ValueError:
                        vol = 0.0
                    if dt > latest_trade_date:
                        latest_trade_date = dt
                    rows.append((dt, vol, tk))

            latest_rows = [r for r in rows if r[0] == latest_trade_date]
            latest_rows.sort(key=lambda x: x[1], reverse=True)
            for _, _, tk in latest_rows:
                u = f"https://{HOST}/asset/{tk.lower()}/"
                if u not in seen:
                    seen.add(u)
                    urls.append(u)
                if len(urls) >= limit:
                    break
        except Exception as e:
            print(f"⚠️ Aviso ao ler {TRADES_RECENT_CSV}: {e}")

    return urls[:limit], latest_trade_date


def wait_for_live_deploy(expected_last_update: str, timeout_sec: int = 360, interval_sec: int = 20) -> bool:
    if not expected_last_update:
        return True
    print(f"⏳ Aguardando Netlify publicar _metadata.json ({expected_last_update})...", flush=True)
    deadline = time.time() + timeout_sec
    while time.time() < deadline:
        try:
            req = urllib.request.Request(
                f"{LIVE_METADATA_URL}?ts={int(time.time())}",
                headers={"User-Agent": "FixData-DeployProbe/1.0", "Cache-Control": "no-cache"},
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                if resp.status == 200:
                    data = json.loads(resp.read().decode("utf-8"))
                    live_lu = str(data.get("last_update") or "").strip()
                    if live_lu == expected_last_update:
                        print(f"✅ Netlify sincronizado ao vivo ({live_lu}).", flush=True)
                        return True
        except Exception:
            pass
        remaining = deadline - time.time()
        if remaining <= 0:
            break
        time.sleep(min(interval_sec, remaining))
    print("⚠️ Timeout aguardando _metadata.json ao vivo; prosseguindo com cautela.", flush=True)
    return False


def submit_batch(urls: list[str]) -> bool:
    if not urls:
        print("Nenhuma URL para submeter ao IndexNow.")
        return False

    payload = {
        "host": HOST,
        "key": KEY,
        "keyLocation": KEY_LOCATION,
        "urlList": urls,
    }
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        INDEXNOW_ENDPOINT,
        data=data,
        headers={"Content-Type": "application/json; charset=utf-8"},
        method="POST",
    )

    print(f"🚀 Enviando lote cirúrgico de {len(urls)} URLs para IndexNow ({INDEXNOW_ENDPOINT})...", flush=True)
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            status = resp.status
            body = resp.read().decode("utf-8", errors="ignore")
            if status in (200, 202):
                print(f"✅ Sucesso! Status HTTP {status} recebido do IndexNow.", flush=True)
                return True
            print(f"⚠️ Resposta inesperada do IndexNow: HTTP {status} — {body}", flush=True)
            return False
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="ignore")
        if e.code in (200, 202):
            print(f"✅ Sucesso! Status HTTP {e.code} recebido do IndexNow.", flush=True)
            return True
        print(f"❌ Erro HTTP {e.code} do IndexNow: {body}", flush=True)
        return False
    except Exception as e:
        print(f"❌ Erro de conexão ao enviar para IndexNow: {e}", flush=True)
        return False


def main():
    parser = argparse.ArgumentParser(description="Submissão IndexNow delta-only do FIXDATA")
    parser.add_argument("--dry-run", action="store_true", help="Mostra URLs selecionadas sem enviar")
    parser.add_argument("--force", action="store_true", help="Ignora deduplicação diária")
    parser.add_argument("--no-wait", action="store_true", help="Não aguarda deploy do Netlify antes do envio")
    args = parser.parse_args()

    print("=== Submissão Delta-Only IndexNow (Bing / Copilot) ===", flush=True)
    local_last_update = read_local_metadata()
    urls, latest_trade_date = get_delta_urls(MAX_URLS_PER_DAY)
    url_hash = hashlib.sha256("\n".join(urls).encode("utf-8")).hexdigest()[:16]
    today_iso = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    print(f"📋 {len(urls)} URLs selecionadas | Pregão: {latest_trade_date or '-'} | Key: {KEY}", flush=True)
    print(f"   Amostra: {urls[:5]}", flush=True)

    if args.dry_run:
        print("🔍 [DRY RUN] Nenhuma requisição enviada ao IndexNow.", flush=True)
        return

    if not args.force and os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE, "r", encoding="utf-8") as f:
                prev = json.load(f)
            if prev.get("submitted_date") == today_iso and (
                prev.get("url_hash") == url_hash
                or (latest_trade_date and prev.get("last_trade_date") == latest_trade_date)
            ):
                print(
                    f"⏭️ Submissão ignorada (deduplicação 1x/dia): lote de {today_iso} "
                    f"(pregão {latest_trade_date}) já foi submetido anteriormente. Use --force para reenviar.",
                    flush=True,
                )
                return
        except Exception:
            pass

    if not args.no_wait:
        wait_for_live_deploy(local_last_update)

    ok = submit_batch(urls)
    if ok:
        try:
            with open(STATE_FILE, "w", encoding="utf-8") as f:
                json.dump(
                    {
                        "submitted_date": today_iso,
                        "submitted_at": datetime.now(timezone.utc).isoformat(),
                        "last_trade_date": latest_trade_date,
                        "last_update": local_last_update,
                        "url_count": len(urls),
                        "url_hash": url_hash,
                    },
                    f,
                    indent=2,
                )
        except Exception as e:
            print(f"⚠️ Aviso ao salvar estado IndexNow: {e}", flush=True)
        print(f"🎉 IndexNow concluído! {len(urls)} URLs prioritárias enviadas.", flush=True)
    else:
        print("⚠️ Submissão ao IndexNow não pôde ser completada.", flush=True)


if __name__ == "__main__":
    main()
