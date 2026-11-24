"""
generate_sitemap.py
Gera 2 sitemaps enxutos e de alta qualidade + 1 sitemap index (100% Python stdlib, sem pandas/numpy):
- sitemap-hubs.xml : Home, páginas institucionais, hubs de categoria, setores ANBIMA e Top 500 emissores ativos.
- sitemap-hot.xml  : Apenas ativos VIGENTES (status_ativo == 'Ativo') com negociação B3 ou taxa indicativa ANBIMA,
                     com <lastmod> real (data do último negócio B3, ANBIMA ou emissão).
- sitemap.xml      : Sitemap index apontando exclusivamente para sitemap-hubs.xml e sitemap-hot.xml.

Remove os sitemaps legados (sitemap-all.xml, sitemap-year.xml) que causavam index bloat com papéis vencidos/resgatados.
"""

import csv
import json
import os
import re
from datetime import datetime, timedelta, timezone

BASE_URL = "https://fixdatabrasil.com.br"
ASSETS_CSV = "public/data/assets_master.csv"
TRADES_CSV = "public/data/b3_trades_summary.csv"
HUBS_MANIFEST = "public/data/seo_hubs_manifest.json"
METADATA_JSON = "public/data/_metadata.json"
OUTPUT_DIRS = ["public", "docs"]


def write_xml(path, content):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)


def build_urlset(urls):
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ]
    for u in urls:
        lines += [
            "  <url>",
            f"    <loc>{u['loc']}</loc>",
            f"    <lastmod>{u['lastmod']}</lastmod>",
            f"    <changefreq>{u['changefreq']}</changefreq>",
            f"    <priority>{u['priority']}</priority>",
            "  </url>",
        ]
    lines.append("</urlset>")
    return "\n".join(lines)


def build_sitemap_index(sitemaps):
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ]
    for s in sitemaps:
        lines += [
            "  <sitemap>",
            f"    <loc>{s['loc']}</loc>",
            f"    <lastmod>{s['lastmod']}</lastmod>",
            "  </sitemap>",
        ]
    lines.append("</sitemapindex>")
    return "\n".join(lines)


def is_valid_ticker(ticker: str) -> bool:
    if not ticker:
        return False
    t = ticker.strip()
    if t.lower() in ("nan", "none", "n/a", "null", "", "-", "0"):
        return False
    if len(t) == 12 and re.match(r"^BR[A-Z0-9]{4}(DBS|DBC|DBN|CRI|CRA|NC0|CTF|LFI)[A-Z0-9]{2}\d$", t):
        return False
    if t.startswith(("CRI_", "CRA_", "DEB_")):
        return False
    if t.isdigit() or " " in t or "/" in t or "\\" in t:
        return False
    return True


def parse_iso_date(val: str, max_date: str) -> str:
    s = str(val or "").strip()[:10]
    if re.match(r"^\d{4}-\d{2}-\d{2}$", s):
        return min(s, max_date)
    return ""


def parse_float(val: str) -> float:
    s = str(val or "").strip().replace(",", ".")
    if not s or s.lower() in ("nan", "none", "-", "null"):
        return 0.0
    try:
        return float(s)
    except ValueError:
        return 0.0


def main():
    now = datetime.now(timezone.utc)
    today_iso = now.strftime("%Y-%m-%d")
    cutoff_180 = (now - timedelta(days=180)).strftime("%Y-%m-%d")

    market_date = today_iso
    if os.path.exists(METADATA_JSON):
        try:
            with open(METADATA_JSON, "r", encoding="utf-8") as f:
                md = json.load(f)
                cand = parse_iso_date(md.get("last_update", ""), today_iso)
                if cand:
                    market_date = cand
        except Exception:
            pass

    print("📈 Lendo histórico B3 (b3_trades_summary.csv)...", flush=True)
    b3_last_date = {}
    recent_180_tickers = set()
    if os.path.exists(TRADES_CSV):
        try:
            with open(TRADES_CSV, "r", encoding="utf-8", errors="ignore") as f:
                r = csv.reader(f)
                header = next(r, None)
                if header and "data_negocio" in header and "ticker" in header:
                    idx_dt = header.index("data_negocio")
                    idx_tk = header.index("ticker")
                    max_idx = max(idx_dt, idx_tk)
                    for row in r:
                        if len(row) <= max_idx:
                            continue
                        dt = parse_iso_date(row[idx_dt], today_iso)
                        tk = row[idx_tk].strip().upper()
                        if tk and dt:
                            prev = b3_last_date.get(tk, "")
                            if dt > prev:
                                b3_last_date[tk] = dt
                            if dt >= cutoff_180:
                                recent_180_tickers.add(tk)
        except Exception as e:
            print(f"⚠️ Aviso ao ler {TRADES_CSV}: {e}")

    print("📄 Filtrando ativos VIGENTES e líquidos em assets_master.csv...", flush=True)
    hot_urls = []
    seen_hot = set()

    if os.path.exists(ASSETS_CSV):
        with open(ASSETS_CSV, "r", encoding="utf-8", errors="ignore") as f:
            reader = csv.DictReader(f)
            for row in reader:
                if str(row.get("status_ativo") or "").strip() != "Ativo":
                    continue
                ticker = str(row.get("ticker") or "").strip()
                if not is_valid_ticker(ticker):
                    continue
                tk_up = ticker.upper()
                tk_low = ticker.lower()
                if tk_low in seen_hot:
                    continue

                vol_b3 = parse_float(row.get("volume_negociado_b3"))
                taxa_anb = str(row.get("taxa_indicativa_anbima") or "").strip()
                has_anb = bool(taxa_anb and taxa_anb.lower() not in ("nan", "none", "-", "null"))
                dt_ult = parse_iso_date(row.get("data_ultimo_negocio"), today_iso)
                dt_anb = parse_iso_date(row.get("data_anbima"), today_iso)
                dt_em = parse_iso_date(row.get("data_emissao"), today_iso)
                dt_b3_sum = b3_last_date.get(tk_up, "")

                is_liquid = (tk_up in recent_180_tickers) or (vol_b3 > 0) or bool(dt_ult) or has_anb
                if not is_liquid:
                    continue

                seen_hot.add(tk_low)
                candidates = [d for d in (dt_b3_sum, dt_ult, dt_anb, dt_em) if d]
                real_lastmod = max(candidates) if candidates else market_date
                recent_trade = (dt_b3_sum >= (now - timedelta(days=30)).strftime("%Y-%m-%d")) or (dt_ult >= (now - timedelta(days=30)).strftime("%Y-%m-%d"))

                hot_urls.append({
                    "loc": f"{BASE_URL}/asset/{tk_low}/",
                    "lastmod": real_lastmod,
                    "changefreq": "daily" if recent_trade else "weekly",
                    "priority": "0.9" if recent_trade else "0.75",
                })

    print("🏛️ Montando sitemap-hubs.xml (páginas principais + categorias + setores + Top 500 emissores)...", flush=True)
    static_pages = [
        ("/", market_date, "daily", "1.0"),
        ("/negocios/", market_date, "daily", "0.95"),
        ("/charts/", market_date, "daily", "0.85"),
        ("/ntnb/", market_date, "daily", "0.85"),
        ("/primary/", market_date, "daily", "0.9"),
        ("/agenda/", market_date, "daily", "0.9"),
        ("/raiox-devedor/", market_date, "daily", "0.9"),
        ("/calculadora/", "2026-11-19", "weekly", "0.9"),
        ("/comparar/", "2026-11-19", "weekly", "0.8"),
        ("/metodologia/", "2026-11-19", "monthly", "0.75"),
        ("/sobre/", "2026-11-19", "monthly", "0.75"),
        ("/contact/", "2026-11-19", "monthly", "0.6"),
        ("/termos/", "2026-11-06", "yearly", "0.4"),
        ("/privacidade/", "2026-11-06", "yearly", "0.4"),
    ]

    hub_urls = []
    seen_hubs = set()
    for path, lm, cf, pr in static_pages:
        loc = f"{BASE_URL}{path}"
        seen_hubs.add(loc)
        hub_urls.append({"loc": loc, "lastmod": lm, "changefreq": cf, "priority": pr})

    if os.path.exists(HUBS_MANIFEST):
        try:
            with open(HUBS_MANIFEST, "r", encoding="utf-8") as f:
                manifest = json.load(f)
            for item in manifest.get("hub_urls", []):
                loc = str(item.get("loc") or "").strip()
                if not loc or loc in seen_hubs:
                    continue
                seen_hubs.add(loc)
                lm = parse_iso_date(item.get("lastmod"), today_iso) or market_date
                hub_urls.append({
                    "loc": loc,
                    "lastmod": lm,
                    "changefreq": item.get("changefreq") or "daily",
                    "priority": item.get("priority") or "0.85",
                })
        except Exception as e:
            print(f"⚠️ Aviso ao ler {HUBS_MANIFEST}: {e}")

    noticias_manifest = os.path.join("public", "data", "noticias_index.json")
    if os.path.exists(noticias_manifest):
        try:
            with open(noticias_manifest, "r", encoding="utf-8") as f:
                n_data = json.load(f)
            n_items = n_data.get("items") or []
            if n_items:
                n_idx_loc = f"{BASE_URL}/noticias/"
                if n_idx_loc not in seen_hubs:
                    seen_hubs.add(n_idx_loc)
                    hub_urls.append({
                        "loc": n_idx_loc,
                        "lastmod": parse_iso_date(n_items[0].get("data_ref") or n_items[0].get("publicado_em"), today_iso) or market_date,
                        "changefreq": "daily",
                        "priority": "0.95",
                    })
                for n_it in n_items:
                    n_loc = str(n_it.get("url") or "").strip()
                    if not n_loc or n_loc in seen_hubs:
                        continue
                    seen_hubs.add(n_loc)
                    n_lm = parse_iso_date(n_it.get("data_ref") or n_it.get("publicado_em"), today_iso) or market_date
                    hub_urls.append({
                        "loc": n_loc,
                        "lastmod": n_lm,
                        "changefreq": "weekly",
                        "priority": "0.9",
                    })
        except Exception as e:
            print(f"⚠️ Aviso ao ler {noticias_manifest}: {e}")

    sitemaps_meta = [
        {"filename": "sitemap-hubs.xml", "urls": hub_urls, "lastmod": market_date},
        {"filename": "sitemap-hot.xml", "urls": hot_urls, "lastmod": market_date},
    ]

    index_entries = []
    for sm in sitemaps_meta:
        content = build_urlset(sm["urls"])
        for d in OUTPUT_DIRS:
            write_xml(f"{d}/{sm['filename']}", content)
        index_entries.append({"loc": f"{BASE_URL}/{sm['filename']}", "lastmod": sm["lastmod"]})
        print(f"   ✅ {sm['filename']} — {len(sm['urls'])} URLs", flush=True)

    news_sitemap_path = os.path.join("public", "sitemap-news.xml")
    if os.path.exists(news_sitemap_path):
        try:
            with open(news_sitemap_path, "r", encoding="utf-8") as f:
                news_xml = f.read()
            if "<url>" in news_xml:
                index_entries.append({"loc": f"{BASE_URL}/sitemap-news.xml", "lastmod": today_iso})
                print("   ✅ sitemap-news.xml referenciado no sitemap index", flush=True)
        except Exception:
            pass

    index_content = build_sitemap_index(index_entries)
    for d in OUTPUT_DIRS:
        write_xml(f"{d}/sitemap.xml", index_content)
        for stale in ("sitemap-all.xml", "sitemap-year.xml"):
            stale_path = os.path.join(d, stale)
            if os.path.exists(stale_path):
                os.remove(stale_path)
                print(f"   🗑️ Removido sitemap legado: {stale_path}", flush=True)

    total = len(hub_urls) + len(hot_urls)
    print(f"\n🗺️  Sitemap index enxuto gerado ({total} URLs totais em 2 sitemaps)", flush=True)


if __name__ == "__main__":
    main()
