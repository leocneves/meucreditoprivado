#!/usr/bin/env python3
"""
generate_rss_feed.py
Gera feed RSS 2.0 compatível com o Google News Publisher Center para o FIXDATA.
Inclui:
- Boletim diário editorial de fechamento do mercado secundário B3
- Destaques dos títulos ativos mais líquidos do pregão mais recente
- Agenda dos próximos pagamentos de cupons e amortizações (com pubDate <= agora e links únicos)
- Suporte a namespaces content:encoded, dc:creator, media:content e atom:link.
"""

import csv
import html
import json
import os
import re
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from xml.sax.saxutils import escape as xml_escape

BASE_URL = "https://fixdatabrasil.com.br"
ASSETS_CSV = "public/data/assets_master.csv"
TRADES_CSV = "public/data/b3_trades_recent.csv"
KPIS_JSON = "public/data/b3_market_kpis.json"
SCHEDULES_CSV = "public/data/payment_schedules.csv"
ICON_PATH = "public/icon-512x512.png"
ICON_URL = f"{BASE_URL}/icon-512x512.png"
OUTPUT_FILES = ["public/feed.xml", "docs/feed.xml"]

BRT = timezone(timedelta(hours=-3))
MAX_FEED_ITEMS = 50

GENERIC_ISSUERS = {
    "", "-", "nan", "none", "n/a", "null", "n/d",
    "pulverizado / não informado", "pulverizado / nao informado",
    "não informado", "nao informado", "diversificado", "pulverizado",
    "companhia emissora", "sem devedor",
}


def is_valid_ticker(ticker: str) -> bool:
    if not ticker:
        return False
    t = str(ticker).strip()
    if t.lower() in ("nan", "none", "n/a", "null", "", "-", "0"):
        return False
    if len(t) == 12 and re.match(r"^BR[A-Z0-9]{4}(DBS|DBC|DBN|CRI|CRA|NC0|CTF|LFI)[A-Z0-9]{2}\d$", t):
        return False
    if t.startswith(("CRI_", "CRA_", "DEB_")):
        return False
    if t.isdigit() or " " in t or "/" in t or "\\" in t:
        return False
    return True


def safe_float(val, default=None):
    try:
        if val is None:
            return default
        s = str(val).strip().replace(",", ".")
        if not s or s.lower() in ("nan", "none", "null", "-", ""):
            return default
        num = float(s)
        if num != num:  # NaN check
            return default
        return num
    except Exception:
        return default


def format_currency(val) -> str:
    num = safe_float(val, default=0.0)
    if num >= 1e9:
        return f"R$ {num / 1e9:.2f} Bi".replace(".", ",")
    if num >= 1e6:
        return f"R$ {num / 1e6:.2f} Mi".replace(".", ",")
    if num >= 1e3:
        return f"R$ {num / 1e3:.2f} Mil".replace(".", ",")
    return f"R$ {num:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def format_pu_or_val(val, decimals: int = 2) -> str:
    num = safe_float(val, default=None)
    if num is None:
        return ""
    return f"R$ {num:,.{decimals}f}".replace(",", "X").replace(".", ",").replace("X", ".")


def format_int_br(val) -> str:
    num = safe_float(val, default=0.0)
    return f"{int(round(num)):,}".replace(",", ".")


def fmt_br_date(iso_str: str) -> str:
    s = str(iso_str or "").strip()[:10]
    parts = s.split("-")
    if len(parts) == 3 and all(p.isdigit() for p in parts):
        return f"{parts[2]}/{parts[1]}/{parts[0]}"
    return s or "-"


def clean_issuer(val: str) -> str:
    s = str(val or "").strip()
    if s.lower() in GENERIC_ISSUERS or "pulverizad" in s.lower():
        return ""
    return s


def format_rate_for_indexador(rate_val, indexador: str) -> str:
    num = safe_float(rate_val, default=None)
    if num is None or num <= -99.0 or abs(num) > 1000.0:
        return ""
    num_str = f"{num:.2f}".replace(".", ",")
    idx = str(indexador or "").strip()
    if idx.lower() in ("nan", "none", "null", "-", ""):
        idx = ""
    idx_up = idx.upper()
    if "IPCA" in idx_up or "IGP" in idx_up:
        return f"{idx} + {num_str}%"
    if "DI%" in idx_up or "%CDI" in idx_up or "%DI" in idx_up or "% DI" in idx_up:
        return f"{num_str}% do CDI"
    if "DI+" in idx_up or "CDI" in idx_up:
        return f"CDI + {num_str}%"
    if "PRE" in idx_up or "PRÉ" in idx_up:
        return f"{num_str}% a.a. (Pré)"
    return f"{idx} + {num_str}%" if idx else f"{num_str}%"


def rfc822_date(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=BRT)
    else:
        dt = dt.astimezone(BRT)
    weekday = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][dt.weekday()]
    month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][dt.month - 1]
    return f"{weekday}, {dt.day:02d} {month} {dt.year} {dt.hour:02d}:{dt.minute:02d}:{dt.second:02d} -0300"


def safe_cdata(raw_html: str) -> str:
    return raw_html.replace("]]>", "]]]]><![CDATA[>")


def get_icon_size() -> int:
    try:
        if os.path.exists(ICON_PATH):
            return os.path.getsize(ICON_PATH)
    except Exception:
        pass
    return 11196


def load_active_assets() -> tuple[dict, dict]:
    active = {}
    all_indexadores = {}
    if not os.path.exists(ASSETS_CSV):
        return active, all_indexadores
    try:
        with open(ASSETS_CSV, "r", encoding="utf-8", errors="ignore") as f:
            for r in csv.DictReader(f):
                tk = str(r.get("ticker") or "").strip().upper()
                idx = str(r.get("indexador") or "").strip()
                if tk and idx and idx.lower() not in ("nan", "none", "null", "-"):
                    all_indexadores[tk] = idx
                if str(r.get("status_ativo") or "").strip() == "Ativo":
                    if is_valid_ticker(tk):
                        active[tk] = {
                            "ticker": str(r.get("ticker") or tk).strip(),
                            "tipo": str(r.get("tipo") or "").strip(),
                            "issuer": str(r.get("issuer") or "").strip(),
                            "indexador": idx,
                            "taxa_emissao": str(r.get("taxa_emissao") or "").strip(),
                            "vencimento": str(r.get("vencimento") or "").strip(),
                            "rating": str(r.get("rating_normalizado") or r.get("rating") or "").strip(),
                            "setor": str(r.get("setor") or "").strip(),
                            "incentivada": str(r.get("incentivada") or "").strip(),
                        }
    except Exception as e:
        print(f"Aviso ao carregar ativos vigentes: {e}")
    return active, all_indexadores


def load_kpis_summary() -> dict:
    if not os.path.exists(KPIS_JSON):
        return {}
    try:
        with open(KPIS_JSON, "r", encoding="utf-8", errors="ignore") as f:
            return json.load(f)
    except Exception as e:
        print(f"Aviso ao carregar KPIs B3: {e}")
        return {}


def load_top_trades(active_assets: dict, limit: int = 35) -> list:
    if not os.path.exists(TRADES_CSV):
        print(f"⚠️ {TRADES_CSV} não encontrado.")
        return []

    by_ticker = {}
    try:
        with open(TRADES_CSV, "r", encoding="utf-8", errors="ignore") as f:
            for r in csv.DictReader(f):
                ticker = str(r.get("ticker") or "").strip()
                dt_neg = str(r.get("data_negocio") or "").strip()[:10]
                if not re.match(r"^\d{4}-\d{2}-\d{2}$", dt_neg):
                    continue
                if not is_valid_ticker(ticker):
                    continue
                tk_up = ticker.upper()
                if active_assets and tk_up not in active_assets:
                    continue
                vol = safe_float(r.get("volume_financeiro"), default=0.0)
                if vol <= 0:
                    continue
                r["_vol"] = vol
                r["_dt"] = dt_neg
                prev = by_ticker.get(tk_up)
                if prev is None or (dt_neg, vol) > (prev["_dt"], prev["_vol"]):
                    by_ticker[tk_up] = r

        rows = sorted(by_ticker.values(), key=lambda x: (x["_dt"], x["_vol"]), reverse=True)
        return rows[:limit]
    except Exception as e:
        print(f"Erro ao carregar trades: {e}")
    return []


def load_upcoming_payments(active_assets: dict, now_br: datetime, days_ahead: int = 14, limit: int = 30) -> list:
    if not os.path.exists(SCHEDULES_CSV):
        return []

    today_str = now_br.strftime("%Y-%m-%d")
    max_date_str = (now_br + timedelta(days=days_ahead)).strftime("%Y-%m-%d")
    grouped = {}

    try:
        with open(SCHEDULES_CSV, "r", encoding="utf-8", errors="ignore") as f:
            for r in csv.DictReader(f):
                dt_ev = str(r.get("data_evento") or "").strip()[:10]
                if not re.match(r"^\d{4}-\d{2}-\d{2}$", dt_ev):
                    continue
                if not (today_str <= dt_ev <= max_date_str):
                    continue
                ticker = str(r.get("ticker") or "").strip()
                if not is_valid_ticker(ticker):
                    continue
                tk_up = ticker.upper()
                if active_assets and tk_up not in active_assets:
                    continue

                key = (tk_up, dt_ev)
                if key not in grouped:
                    grouped[key] = {
                        "ticker": ticker,
                        "data_evento": dt_ev,
                        "tipos": [],
                        "valor_total": 0.0,
                        "has_valor": False,
                    }

                tipo_ev = str(r.get("tipo_evento") or "Pagamento de Proventos").strip()
                if tipo_ev and tipo_ev not in grouped[key]["tipos"]:
                    grouped[key]["tipos"].append(tipo_ev)

                val = safe_float(r.get("valor_projetado")) or safe_float(r.get("valor_real"))
                if val is not None and val > 0:
                    grouped[key]["valor_total"] += val
                    grouped[key]["has_valor"] = True

        events = sorted(grouped.values(), key=lambda x: (x["data_evento"], x["ticker"]))
        return events[:limit]
    except Exception as e:
        print(f"Erro ao carregar pagamentos: {e}")
    return []


def _format_event_types(tipos: list) -> str:
    clean = [t for t in tipos if t]
    if not clean:
        return "Pagamento de Proventos"
    if len(clean) == 1:
        return clean[0]
    if len(clean) == 2:
        return f"{clean[0]} e {clean[1]}"
    return ", ".join(clean[:-1]) + f" e {clean[-1]}"


def build_market_wrap_item(kpis: dict, active_assets: dict, all_indexadores: dict, now_br: datetime) -> dict | None:
    up = kpis.get("ultimo_pregao") or {}
    dt_iso = str(up.get("data") or "").strip()[:10]
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", dt_iso):
        return None

    try:
        wrap_dt = datetime.strptime(dt_iso, "%Y-%m-%d").replace(hour=18, minute=30, second=0, tzinfo=BRT)
    except Exception:
        wrap_dt = now_br
    pub_dt = min(wrap_dt, now_br)

    dt_br = fmt_br_date(dt_iso)
    vol_fmt = format_currency(up.get("volume_financeiro", 0))
    trades_fmt = format_int_br(up.get("total_trades", 0))
    ativos_fmt = format_int_br(up.get("ativos_negociados", 0))
    total_vigentes = len(active_assets)

    title = f"Fechamento do Mercado Secundário B3 ({dt_br}): {vol_fmt} em {trades_fmt} negócios de Crédito Privado"
    link = f"{BASE_URL}/negocios/"
    guid = f"fixdata-fechamento-b3-{dt_iso}"

    desc = (
        f"O mercado secundário de crédito privado da B3 movimentou {vol_fmt} em {trades_fmt} operações no pregão de {dt_br}, "
        f"com liquidez registrada em {ativos_fmt} debêntures, CRIs e CRAs. Veja os papéis mais negociados e as taxas médias ponderadas no FIXDATA."
    )

    top_items_html = []
    for top in (up.get("top_ativos") or [])[:5]:
        tk = str(top.get("ticker") or "").strip()
        if not tk:
            continue
        tipo = str(top.get("tipo") or "Título").strip()
        meta = active_assets.get(tk.upper(), {})
        dev = clean_issuer(top.get("devedor") or "") or clean_issuer(meta.get("issuer"))
        vol_top = format_currency(top.get("volume_financeiro", 0))
        qtd_num = int(round(safe_float(top.get("qtd_negocios"), default=0.0)))
        qtd_top = format_int_br(qtd_num)
        neg_word = "negócio" if qtd_num == 1 else "negócios"
        idx_str = meta.get("indexador") or all_indexadores.get(tk.upper(), "")
        taxa_str = format_rate_for_indexador(top.get("taxa_media_ponderada"), idx_str)
        taxa_txt = f" | Taxa média: {html.escape(taxa_str)}" if taxa_str else ""
        dev_txt = f" ({html.escape(dev)})" if dev else ""

        if is_valid_ticker(tk):
            tk_label = f'<a href="{BASE_URL}/asset/{tk.lower()}/"><strong>{html.escape(tk)}</strong></a>'
        else:
            tk_label = f"<strong>{html.escape(tk)}</strong>"

        top_items_html.append(
            f"<li>{tk_label} — {html.escape(tipo)}{dev_txt}: <strong>{html.escape(vol_top)}</strong> em {html.escape(qtd_top)} {neg_word}{taxa_txt}</li>"
        )

    universe_txt = (
        f" dentro de um universo de {format_int_br(total_vigentes)} títulos vigentes monitorados"
        if total_vigentes > 0
        else ""
    )
    list_block = f"<ul>{''.join(top_items_html)}</ul>" if top_items_html else ""

    content_html = (
        f"<p>No pregão de <strong>{html.escape(dt_br)}</strong>, o mercado secundário brasileiro de renda fixa privada na B3 "
        f"registrou volume financeiro total de <strong>{html.escape(vol_fmt)}</strong> ao longo de <strong>{html.escape(trades_fmt)} negócios</strong>.</p>"
        f"<p>Ao todo, <strong>{html.escape(ativos_fmt)} ativos</strong> entre Debêntures, Certificados de Recebíveis Imobiliários (CRIs) "
        f"e Certificados de Recebíveis do Agronegócio (CRAs) apresentaram liquidez na sessão{html.escape(universe_txt)} pela plataforma FIXDATA.</p>"
        f"{'<p><strong>Destaques de volume no pregão:</strong></p>' + list_block if list_block else ''}"
        f'<p>Acompanhe a tabela completa de negociações diárias, spreads sobre a curva NTN-B e preços unitários no '
        f'<a href="{link}">Painel de Negócios Secundários B3 do FIXDATA</a>.</p>'
    )

    return {
        "title": title,
        "link": link,
        "guid": guid,
        "_pub_dt": pub_dt,
        "pubDate": rfc822_date(pub_dt),
        "category": "Mercado Secundário",
        "description": desc,
        "content_html": content_html,
    }


def generate_feed():
    print("📡 Gerando Feed RSS 2.0 otimizado para Google News Publisher Center...")
    now_br = datetime.now(BRT)
    active_assets, all_indexadores = load_active_assets()
    kpis = load_kpis_summary()

    trades = load_top_trades(active_assets, limit=35)
    payments = load_upcoming_payments(active_assets, now_br, days_ahead=14, limit=35)

    feed_items = []
    seen_links = set()

    # 1. Boletim diário editorial de fechamento B3
    wrap_item = build_market_wrap_item(kpis, active_assets, all_indexadores, now_br)
    if wrap_item:
        feed_items.append(wrap_item)
        seen_links.add(wrap_item["link"])

    # 2. Destaques de negócios B3 do pregão mais recente
    latest_trade_dt_str = ""
    for idx, t in enumerate(trades):
        ticker = str(t.get("ticker") or "").strip()
        link = f"{BASE_URL}/asset/{ticker.lower()}/"
        if link in seen_links:
            continue

        meta = active_assets.get(ticker.upper(), {})
        tipo = str(t.get("tipo") or meta.get("tipo") or "Título").strip()
        issuer_raw = clean_issuer(t.get("devedor")) or clean_issuer(meta.get("issuer"))
        indexador = str(t.get("indexador") or meta.get("indexador") or "").strip()
        dt_negocio = str(t.get("_dt") or t.get("data_negocio") or "").strip()[:10]
        if not latest_trade_dt_str and dt_negocio:
            latest_trade_dt_str = dt_negocio
        dt_br = fmt_br_date(dt_negocio)

        vol_fmt = format_currency(t.get("_vol", 0))
        qtd_num = int(round(safe_float(t.get("qtd_negocios"), default=1.0)))
        qtd_neg = format_int_br(qtd_num)
        neg_word = "operação" if qtd_num == 1 else "operações"
        neg_word_pl = "negócio" if qtd_num == 1 else "negócios"
        pu_fmt = format_pu_or_val(t.get("preco_medio_ponderado"), decimals=2)
        taxa_fmt = format_rate_for_indexador(t.get("taxa_media_ponderada"), indexador)
        taxa_emissao_fmt = format_rate_for_indexador(t.get("taxa_emissao") or meta.get("taxa_emissao"), indexador)
        venc_br = fmt_br_date(meta.get("vencimento", "")) if meta.get("vencimento") else ""
        rating = meta.get("rating", "")
        setor = meta.get("setor", "")
        is_isento = str(meta.get("incentivada") or "").strip().lower() in ("sim", "true", "1")

        try:
            base_dt = datetime.strptime(dt_negocio, "%Y-%m-%d").replace(hour=18, minute=0, second=0, tzinfo=BRT)
        except Exception:
            base_dt = now_br
        item_dt = min(base_dt, now_br) - timedelta(seconds=idx * 10)

        taxa_suffix = f" a {taxa_fmt}" if taxa_fmt else ""
        if issuer_raw:
            title = f"{tipo} {ticker} ({issuer_raw}) movimenta {vol_fmt} na B3{taxa_suffix}"
        else:
            title = f"{tipo} {ticker} movimenta {vol_fmt} no mercado secundário B3{taxa_suffix}"

        issuer_desc = f", emitido por {issuer_raw}," if issuer_raw else ""
        taxa_desc = f" com taxa média ponderada de {taxa_fmt}" if taxa_fmt else ""
        pu_desc = f" e preço unitário médio de {pu_fmt}" if pu_fmt else ""

        desc = (
            f"O título {ticker} ({tipo}){issuer_desc} registrou {vol_fmt} em volume negociado na B3 em {dt_br}, "
            f"ao longo de {qtd_neg} {neg_word}{taxa_desc}{pu_desc}. Consulte curva de taxas, spread NTN-B e fluxo de pagamentos no FIXDATA."
        )

        bullet_rows = [
            f"<li><strong>Ativo:</strong> {html.escape(ticker)} ({html.escape(tipo)})</li>",
        ]
        if issuer_raw:
            bullet_rows.append(f"<li><strong>Devedor / Emissor:</strong> {html.escape(issuer_raw)}</li>")
        bullet_rows.append(f"<li><strong>Pregão de referência:</strong> {html.escape(dt_br)}</li>")
        bullet_rows.append(f"<li><strong>Volume financeiro:</strong> {html.escape(vol_fmt)} ({html.escape(qtd_neg)} {neg_word_pl})</li>")
        if taxa_fmt:
            bullet_rows.append(f"<li><strong>Taxa média ponderada:</strong> {html.escape(taxa_fmt)}</li>")
        elif taxa_emissao_fmt:
            bullet_rows.append(f"<li><strong>Remuneração na emissão:</strong> {html.escape(taxa_emissao_fmt)}</li>")
        if pu_fmt:
            bullet_rows.append(f"<li><strong>Preço médio ponderado (PU):</strong> {html.escape(pu_fmt)}</li>")
        if rating and rating not in ("-", "N/A", "Sem Rating"):
            bullet_rows.append(f"<li><strong>Rating de crédito:</strong> {html.escape(rating)}</li>")
        if venc_br and venc_br != "-":
            bullet_rows.append(f"<li><strong>Vencimento:</strong> {html.escape(venc_br)}</li>")
        if setor and setor not in ("-", "Outros Serviços"):
            bullet_rows.append(f"<li><strong>Setor:</strong> {html.escape(setor)}</li>")
        if is_isento:
            bullet_rows.append("<li><strong>Tributação:</strong> Isento de IR para Pessoa Física</li>")

        issuer_html = f", lastreado em <strong>{html.escape(issuer_raw)}</strong>," if issuer_raw else ""
        content_html = (
            f"<p>No pregão da B3 de <strong>{html.escape(dt_br)}</strong>, o papel <strong>{html.escape(ticker)}</strong> "
            f"({html.escape(tipo)}){issuer_html} concentrou volume financeiro de <strong>{html.escape(vol_fmt)}</strong> em "
            f"<strong>{html.escape(qtd_neg)} {neg_word_pl}</strong> no mercado secundário{html.escape(taxa_desc)}.</p>"
            f"<ul>{''.join(bullet_rows)}</ul>"
            f'<p>Acesse a ficha completa com histórico de preços unitários, comparativo de spread sobre a curva NTN-B e agenda de fluxos em '
            f'<a href="{link}">{html.escape(ticker)} no FIXDATA</a>.</p>'
        )

        feed_items.append({
            "title": title,
            "link": link,
            "guid": f"fixdata-trade-{ticker.lower()}-{dt_negocio}",
            "_pub_dt": item_dt,
            "pubDate": rfc822_date(item_dt),
            "category": f"Mercado Secundário / {tipo}",
            "description": desc,
            "content_html": content_html,
        })
        seen_links.add(link)

    # 3. Itens da Agenda de Proventos (pubDate sempre <= now_br e links únicos)
    if latest_trade_dt_str:
        try:
            agenda_anchor = datetime.strptime(latest_trade_dt_str, "%Y-%m-%d").replace(hour=17, minute=0, second=0, tzinfo=BRT)
        except Exception:
            agenda_anchor = now_br - timedelta(minutes=30)
    else:
        agenda_anchor = now_br - timedelta(minutes=30)
    agenda_anchor = min(agenda_anchor, now_br - timedelta(minutes=5))

    agenda_count = 0
    for p in payments:
        if len(feed_items) >= MAX_FEED_ITEMS or agenda_count >= 14:
            break

        ticker = str(p.get("ticker") or "").strip()
        link = f"{BASE_URL}/asset/{ticker.lower()}/"
        if link in seen_links:
            continue

        dt_ev = str(p.get("data_evento") or "").strip()[:10]
        dt_ev_br = fmt_br_date(dt_ev)
        tipos_str = _format_event_types(p.get("tipos") or [])
        meta = active_assets.get(ticker.upper(), {})
        tipo_ativo = meta.get("tipo") or "Título de Renda Fixa"
        issuer_raw = clean_issuer(meta.get("issuer"))
        indexador = meta.get("indexador", "")
        taxa_emissao_fmt = format_rate_for_indexador(meta.get("taxa_emissao"), indexador)
        venc_br = fmt_br_date(meta.get("vencimento", "")) if meta.get("vencimento") else ""

        val_fmt = format_pu_or_val(p.get("valor_total"), decimals=4) if p.get("has_valor") else ""
        val_txt = f", com valor unitário estimado em {val_fmt}" if val_fmt else ""

        item_dt = agenda_anchor - timedelta(seconds=agenda_count * 10)
        title = f"Agenda de Proventos: {ticker} paga {tipos_str} em {dt_ev_br}"

        issuer_desc = f" (emissor {issuer_raw})" if issuer_raw else ""
        desc = (
            f"O ativo {ticker} ({tipo_ativo}){issuer_desc} tem pagamento programado de {tipos_str} para {dt_ev_br}{val_txt}. "
            f"Consulte o cronograma completo de cupons e amortizações no FIXDATA."
        )

        bullet_rows = [
            f"<li><strong>Ativo:</strong> {html.escape(ticker)} ({html.escape(tipo_ativo)})</li>",
            f"<li><strong>Evento programado:</strong> {html.escape(tipos_str)}</li>",
            f"<li><strong>Data contratual prevista:</strong> {html.escape(dt_ev_br)}</li>",
        ]
        if issuer_raw:
            bullet_rows.append(f"<li><strong>Emissor:</strong> {html.escape(issuer_raw)}</li>")
        if val_fmt:
            bullet_rows.append(f"<li><strong>Valor unitário projetado:</strong> {html.escape(val_fmt)}</li>")
        if taxa_emissao_fmt:
            bullet_rows.append(f"<li><strong>Remuneração contratual:</strong> {html.escape(taxa_emissao_fmt)}</li>")
        if venc_br and venc_br != "-":
            bullet_rows.append(f"<li><strong>Vencimento final:</strong> {html.escape(venc_br)}</li>")

        content_html = (
            f"<p>Conforme cronograma contratual monitorado pelo FIXDATA, o papel <strong>{html.escape(ticker)}</strong> "
            f"({html.escape(tipo_ativo)}){' de ' + html.escape(issuer_raw) if issuer_raw else ''} possui pagamento programado "
            f"de <strong>{html.escape(tipos_str)}</strong> para o dia <strong>{html.escape(dt_ev_br)}</strong>{html.escape(val_txt)}.</p>"
            f"<ul>{''.join(bullet_rows)}</ul>"
            f'<p>Confira todas as parcelas futuras de juros e amortizações em '
            f'<a href="{link}">{html.escape(ticker)} no FIXDATA</a> ou explore a '
            f'<a href="{BASE_URL}/agenda/">Agenda Completa de Proventos</a>.</p>'
        )

        feed_items.append({
            "title": title,
            "link": link,
            "guid": f"fixdata-agenda-{ticker.lower()}-{dt_ev}",
            "_pub_dt": item_dt,
            "pubDate": rfc822_date(item_dt),
            "category": "Agenda de Pagamentos",
            "description": desc,
            "content_html": content_html,
        })
        seen_links.add(link)
        agenda_count += 1

    # Ordenação cronológica decrescente (mais recentes no topo)
    feed_items.sort(key=lambda x: x["_pub_dt"], reverse=True)
    feed_items = feed_items[:MAX_FEED_ITEMS]

    last_build = rfc822_date(now_br)
    icon_size = get_icon_size()

    xml_lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<rss version="2.0" '
        'xmlns:atom="http://www.w3.org/2005/Atom" '
        'xmlns:content="http://purl.org/rss/1.0/modules/content/" '
        'xmlns:dc="http://purl.org/dc/elements/1.1/" '
        'xmlns:media="http://search.yahoo.com/mrss/">',
        '  <channel>',
        '    <title>FIXDATA — Radar de Renda Fixa e Mercado Secundário B3</title>',
        f'    <link>{BASE_URL}/</link>',
        '    <description>Boletins diários de fechamento B3, destaques de liquidez de Debêntures, CRIs e CRAs e agenda de pagamentos do mercado de crédito privado brasileiro.</description>',
        '    <language>pt-BR</language>',
        f'    <lastBuildDate>{last_build}</lastBuildDate>',
        f'    <pubDate>{feed_items[0]["pubDate"] if feed_items else last_build}</pubDate>',
        f'    <atom:link href="{BASE_URL}/feed.xml" rel="self" type="application/rss+xml" />',
        '    <image>',
        f'      <url>{ICON_URL}</url>',
        '      <title>FIXDATA</title>',
        f'      <link>{BASE_URL}/</link>',
        '    </image>',
    ]

    for item in feed_items:
        title_clean = xml_escape(item["title"])
        cat_clean = xml_escape(item["category"])
        desc_clean = xml_escape(item["description"])
        cdata_body = safe_cdata(item["content_html"])

        xml_lines.append('    <item>')
        xml_lines.append(f'      <title>{title_clean}</title>')
        xml_lines.append(f'      <link>{xml_escape(item["link"])}</link>')
        xml_lines.append(f'      <guid isPermaLink="false">{xml_escape(item["guid"])}</guid>')
        xml_lines.append(f'      <pubDate>{item["pubDate"]}</pubDate>')
        xml_lines.append('      <dc:creator>Redação FIXDATA</dc:creator>')
        xml_lines.append(f'      <category>{cat_clean}</category>')
        xml_lines.append(f'      <description>{desc_clean}</description>')
        xml_lines.append(f'      <content:encoded><![CDATA[{cdata_body}]]></content:encoded>')
        xml_lines.append(
            f'      <media:content url="{ICON_URL}" medium="image" type="image/png" width="512" height="512" />'
        )
        xml_lines.append(f'      <enclosure url="{ICON_URL}" length="{icon_size}" type="image/png" />')
        xml_lines.append('    </item>')

    xml_lines.append('  </channel>')
    xml_lines.append('</rss>')

    xml_content = "\n".join(xml_lines) + "\n"

    # Validação estrita do XML antes de salvar
    ET.fromstring(xml_content)

    for out_path in OUTPUT_FILES:
        os.makedirs(os.path.dirname(out_path), exist_ok=True)
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(xml_content)
        print(f"   ✅ Feed RSS salvo e validado em {out_path} ({len(feed_items)} itens)")


if __name__ == "__main__":
    generate_feed()
