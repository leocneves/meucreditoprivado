#!/usr/bin/env python3
"""
generate_rss_feed.py
Gera feed RSS 2.0 / Atom com as atualizações mais recentes do mercado secundário de crédito privado.
Inclui:
- Top negócios B3 do último pregão (volume, taxa média ponderada, emissores)
- Próximos eventos da agenda de proventos (cupons e amortizações dos próximos 14 dias)
- Links canônicos para aceleração de rastreamento e indexação pelo Googlebot e Bingbot.
"""

import os
import re
import csv
from datetime import datetime, timezone, timedelta
import xml.etree.ElementTree as ET

BASE_URL = "https://fixdatabrasil.com.br"
TRADES_CSV = "public/data/b3_trades_recent.csv"
SCHEDULES_CSV = "public/data/payment_schedules.csv"
OUTPUT_FILES = ["public/feed.xml", "docs/feed.xml"]

def is_valid_ticker(ticker: str) -> bool:
    if not ticker:
        return False
    t = str(ticker).strip()
    if t.lower() in ('nan', 'none', 'n/a', 'null', '', '-', '0'):
        return False
    if len(t) == 12 and re.match(r'^BR[A-Z0-9]{4}(DBS|DBC|DBN|CRI|CRA|NC0|CTF|LFI)[A-Z0-9]{2}\d$', t):
        return False
    if t.startswith(('CRI_', 'CRA_', 'DEB_')):
        return False
    if t.isdigit() or ' ' in t or '/' in t or '\\' in t:
        return False
    return True

def format_currency(val) -> str:
    try:
        num = float(val)
        if num >= 1e9:
            return f"R$ {num / 1e9:.2f} Bi"
        if num >= 1e6:
            return f"R$ {num / 1e6:.2f} Mi"
        if num >= 1e3:
            return f"R$ {num / 1e3:.2f} Mil"
        return f"R$ {num:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.')
    except:
        return "R$ 0,00"

def rfc822_date(dt: datetime) -> str:
    # Retorna data formatada conforme RFC 822 (ex: "Thu, 05 Nov 2026 18:00:00 -0300")
    weekday = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][dt.weekday()]
    month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][dt.month - 1]
    tz_str = dt.strftime("%z")
    if not tz_str:
        tz_str = "-0300"
    return f"{weekday}, {dt.day:02d} {month} {dt.year} {dt.hour:02d}:{dt.minute:02d}:{dt.second:02d} {tz_str}"

def load_top_trades(limit=40):
    if not os.path.exists(TRADES_CSV):
        print(f"⚠️ {TRADES_CSV} não encontrado.")
        return []
    
    trades = []
    try:
        with open(TRADES_CSV, "r", encoding="utf-8", errors="ignore") as f:
            reader = csv.DictReader(f)
            rows = []
            for r in reader:
                ticker = r.get("ticker", "").strip()
                if is_valid_ticker(ticker):
                    try:
                        vol = float(r.get("volume_financeiro") or 0)
                        r["_vol"] = vol
                        rows.append(r)
                    except:
                        pass
            
            # Ordena pelos maiores volumes
            rows.sort(key=lambda x: x["_vol"], reverse=True)
            trades = rows[:limit]
    except Exception as e:
        print(f"Erro ao carregar trades: {e}")
    return trades

def load_upcoming_payments(days_ahead=14, limit=20):
    if not os.path.exists(SCHEDULES_CSV):
        return []
    
    events = []
    now = datetime.now()
    today_str = now.strftime("%Y-%m-%d")
    max_date_str = (now + timedelta(days=days_ahead)).strftime("%Y-%m-%d")
    
    try:
        with open(SCHEDULES_CSV, "r", encoding="utf-8", errors="ignore") as f:
            reader = csv.DictReader(f)
            for r in reader:
                dt_ev = r.get("data_evento", "")
                ticker = r.get("ticker", "").strip()
                if is_valid_ticker(ticker) and today_str <= dt_ev <= max_date_str:
                    events.append(r)
                    if len(events) >= limit * 3:
                        break
        # Ordena cronologicamente
        events.sort(key=lambda x: x.get("data_evento", ""))
        return events[:limit]
    except Exception as e:
        print(f"Erro ao carregar pagamentos: {e}")
    return []

def generate_feed():
    print("📡 Gerando Feed RSS 2.0 / Atom de Mercado Secundário...")
    now_utc = datetime.now(timezone.utc)
    now_br = datetime.now()
    
    trades = load_top_trades(limit=45)
    payments = load_upcoming_payments(days_ahead=21, limit=25)
    
    feed_items = []
    
    # 1. Itens de Negócios B3
    for t in trades:
        ticker = t.get("ticker", "").strip()
        tipo = t.get("tipo", "Título")
        devedor = t.get("devedor", "Companhia Emissora")
        vol_fmt = format_currency(t.get("_vol", 0))
        taxa = t.get("taxa_media_ponderada", "")
        dt_negocio = t.get("data_negocio", "")
        qtd_neg = t.get("qtd_negocios", "1")
        
        try:
            item_date = datetime.strptime(dt_negocio, "%Y-%m-%d")
            # Adiciona horário de fechamento B3 (18:00)
            item_date = item_date.replace(hour=18, minute=0, second=0)
        except:
            item_date = now_br
            
        taxa_str = f" a {float(taxa):.2f}%" if taxa and taxa not in ('nan', 'none', '') else ""
        title = f"[B3] {ticker} ({tipo}) — Negociação de {vol_fmt}{taxa_str}"
        link = f"{BASE_URL}/asset/{ticker.lower()}/"
        guid = f"fixdata-trade-{ticker.lower()}-{dt_negocio}"
        
        desc = (
            f"O título {ticker} ({tipo}), emitido por {devedor}, movimentou {vol_fmt} no mercado secundário da B3 "
            f"em {dt_negocio}, com {qtd_neg} negócios registrados. "
            f"Consulte o histórico de taxas, spread sobre a curva NTN-B e ratings de crédito no FIXDATA."
        )
        
        feed_items.append({
            "title": title,
            "link": link,
            "guid": guid,
            "pubDate": rfc822_date(item_date),
            "description": desc,
            "category": f"Mercado Secundário / {tipo}"
        })
        
    # 2. Itens da Agenda de Proventos
    for p in payments:
        ticker = p.get("ticker", "").strip()
        dt_ev = p.get("data_evento", "")
        tipo_ev = p.get("tipo_evento", "Pagamento de Proventos")
        val_proj = p.get("valor_projetado") or p.get("valor_real") or ""
        
        try:
            item_date = datetime.strptime(dt_ev, "%Y-%m-%d").replace(hour=9, minute=0, second=0)
        except:
            item_date = now_br
            
        val_str = f" no valor estimado de R$ {float(val_proj):.4f}" if val_proj and val_proj != 'nan' else ""
        title = f"[Agenda] {ticker} — {tipo_ev} programado para {dt_ev}"
        link = f"{BASE_URL}/asset/{ticker.lower()}/"
        guid = f"fixdata-agenda-{ticker.lower()}-{dt_ev}-{tipo_ev.replace(' ', '_')}"
        
        desc = (
            f"O ativo {ticker} possui evento agendado de {tipo_ev}{val_str} na data contratual {dt_ev}. "
            f"Acompanhe o cronograma completo de fluxos de caixa e vencimento no FIXDATA."
        )
        
        feed_items.append({
            "title": title,
            "link": link,
            "guid": guid,
            "pubDate": rfc822_date(item_date),
            "description": desc,
            "category": "Agenda de Pagamentos"
        })
        
    last_build = rfc822_date(now_br)
    
    # Montagem do XML
    xml_lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
        '  <channel>',
        '    <title>FIXDATA — Radar de Renda Fixa e Mercado Secundário B3</title>',
        f'    <link>{BASE_URL}/</link>',
        '    <description>Atualizações diárias de negócios secundários de Debêntures, CRIs e CRAs na B3, emissões e agenda de proventos.</description>',
        '    <language>pt-br</language>',
        f'    <lastBuildDate>{last_build}</lastBuildDate>',
        f'    <atom:link href="{BASE_URL}/feed.xml" rel="self" type="application/rss+xml" />',
        '    <image>',
        f'      <url>{BASE_URL}/icon-512x512.png</url>',
        '      <title>FIXDATA</title>',
        f'      <link>{BASE_URL}/</link>',
        '    </image>',
    ]
    
    for item in feed_items:
        # Sanitização simples para XML
        title_clean = item['title'].replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
        desc_clean = item['description'].replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
        
        xml_lines.append('    <item>')
        xml_lines.append(f'      <title>{title_clean}</title>')
        xml_lines.append(f'      <link>{item["link"]}</link>')
        xml_lines.append(f'      <guid isPermaLink="false">{item["guid"]}</guid>')
        xml_lines.append(f'      <pubDate>{item["pubDate"]}</pubDate>')
        xml_lines.append(f'      <category>{item["category"]}</category>')
        xml_lines.append(f'      <description>{desc_clean}</description>')
        xml_lines.append('    </item>')
        
    xml_lines.append('  </channel>')
    xml_lines.append('</rss>')
    
    xml_content = "\n".join(xml_lines)
    
    for out_path in OUTPUT_FILES:
        os.makedirs(os.path.dirname(out_path), exist_ok=True)
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(xml_content)
        print(f"   ✅ Feed RSS salvo em {out_path} ({len(feed_items)} itens)")

if __name__ == "__main__":
    generate_feed()

