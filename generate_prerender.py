import os
import re
import json
import sqlite3
import pandas as pd
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor

BASE_URL = "https://fixdata.netlify.app"
DB_PATH = "/home/home/airflow/src/data/credito_privado.db"
CSV_PATH = "public/data/assets_master.csv"
OUTPUT_DIR = "public/asset"
DOCS_OUTPUT_DIR = "docs/asset"

def normalize_rating(val):
    if not val or not isinstance(val, str):
        return None
    r = val.strip()
    if r.lower() in ('nan', 'none', 'n/a', '', '-'):
        return None

    r = r.replace('–', '-').replace('—', '-').replace('−', '-')
    
    if '/' in r:
        parts = r.split('/')
        for p in reversed(parts):
            p_norm = normalize_rating(p)
            if p_norm:
                return p_norm

    if '(' in r and ')' not in r:
        r = re.sub(r'\(.*', '', r)

    r = re.sub(r'\s*\([^)]*\)', '', r, flags=re.IGNORECASE)
    r = re.sub(r'^(br\.|br|br\s+)', '', r, flags=re.IGNORECASE)
    r = re.sub(r'(AAA|AA\+|AA-|AA|A\+|A-|A|BBB\+|BBB-|BBB|BB\+|BB-|BB|B\+|B-|B|CCC\+|CCC-|CCC|CC|C|D)\s*sf\b', r'\1', r, flags=re.IGNORECASE)
    r = re.sub(r'\b(sf|exp|oe|sr)\b', '', r, flags=re.IGNORECASE)
    r = re.sub(r'SR$', '', r, flags=re.IGNORECASE)
    r = re.sub(r'(\.br|-br|\s+br)$', '', r, flags=re.IGNORECASE)
    r = r.strip(' .-_')
    r_up = r.upper()

    moodys_map = {
        'AAA': 'AAA', 'AA1': 'AA+', 'AA2': 'AA', 'AA3': 'AA-',
        'A1': 'A+', 'A2': 'A', 'A3': 'A-', 'BAA1': 'BBB+', 'BAA2': 'BBB',
        'BAA3': 'BBB-', 'BA1': 'BB+', 'BA2': 'BB', 'BA3': 'BB-',
        'B1': 'B+', 'B2': 'B', 'B3': 'B-', 'CAA1': 'CCC+', 'CAA2': 'CCC',
        'CAA3': 'CCC-', 'CA': 'CC', 'C': 'C', 'D': 'D'
    }
    if r_up in moodys_map:
        return moodys_map[r_up]

    m = re.match(r'^(AAA|AA\+|AA-|AA|A\+|A-|A|BBB\+|BBB-|BBB|BB\+|BB-|BB|B\+|B-|B|CCC\+|CCC-|CCC|CC|C|D)\b', r_up)
    if m:
        return m.group(1)

    return r_up if r_up else None

def get_emitters_map():
    emitters_file = "public/data/emitters_master.csv"
    if not os.path.exists(emitters_file):
        emitters_file = "/home/home/airflow/src/cp_site/data/emitters_master.csv"
    
    if not os.path.exists(emitters_file):
        return {}
    
    try:
        df_e = pd.read_csv(emitters_file)
        e_dict = {}
        for _, row in df_e.iterrows():
            rs = str(row.get('razao_social', '')).strip().lower()
            nf = str(row.get('nome_fantasia', '')).strip().lower()
            item = {
                'cnpj': str(row.get('cnpj', '')).strip(),
                'cnpj_formatado': str(row.get('cnpj_formatado', '')).strip(),
                'razao_social': str(row.get('razao_social', '')).strip(),
                'nome_fantasia': str(row.get('nome_fantasia', '')).strip(),
                'setor': str(row.get('setor', '')).strip(),
                'categoria_cvm': str(row.get('categoria_cvm', '')).strip(),
                'situacao_cvm': str(row.get('situacao_cvm', '')).strip(),
                'site_ri': str(row.get('site_ri', '')).strip() if pd.notna(row.get('site_ri')) else None,
                'municipio': str(row.get('municipio', '')).strip() if pd.notna(row.get('municipio')) else None,
                'uf': str(row.get('uf', '')).strip() if pd.notna(row.get('uf')) else None,
                'descricao': str(row.get('descricao', '')).strip() if pd.notna(row.get('descricao')) else None
            }
            if rs and rs not in ('nan', 'none', ''):
                e_dict[rs] = item
            if nf and nf not in ('nan', 'none', ''):
                e_dict[nf] = item
        return e_dict
    except Exception as err:
        print(f"Erro ao carregar mapa de emissores: {err}")
        return {}

def get_assets():
    if os.path.exists(CSV_PATH):
        df = pd.read_csv(CSV_PATH)
    elif os.path.exists(DB_PATH):
        conn = sqlite3.connect(DB_PATH)
        df = pd.read_sql_query("SELECT * FROM tb_cadastro_ativos", conn)
        conn.close()
    else:
        raise FileNotFoundError("Base de dados de ativos não encontrada.")
    return df

def get_prices_map():
    prices_file = "public/data/prices.csv"
    if not os.path.exists(prices_file):
        prices_file = "/home/home/airflow/src/cp_site/data/prices.csv"
    if not os.path.exists(prices_file):
        return {}
    try:
        df_p = pd.read_csv(prices_file)
        p_map = {}
        for ticker, group in df_p.groupby('ticker'):
            t_upper = str(ticker).strip().upper()
            recent = group.tail(5).to_dict(orient='records')
            p_map[t_upper] = {
                'total_trades': len(group),
                'recent': recent
            }
        return p_map
    except Exception as err:
        print(f"Erro ao carregar mapa de preços: {err}")
        return {}

def get_payments_map():
    payments_file = "public/data/payment_schedules.csv"
    if not os.path.exists(payments_file):
        payments_file = "/home/home/airflow/src/cp_site/data/payment_schedules.csv"
    if not os.path.exists(payments_file):
        return {}
    try:
        df_pay = pd.read_csv(payments_file)
        pay_map = {}
        for ticker, group in df_pay.groupby('ticker'):
            t_upper = str(ticker).strip().upper()
            pay_map[t_upper] = {
                'total_events': len(group),
                'events': group.to_dict(orient='records')
            }
        return pay_map
    except Exception as err:
        print(f"Erro ao carregar mapa de pagamentos: {err}")
        return {}

EMITTERS_MAP = get_emitters_map()
PRICES_MAP = get_prices_map()
PAYMENTS_MAP = get_payments_map()

def generate_asset_html(row):
    ticker = str(row.get('ticker', '')).strip()
    if not ticker or ticker.lower() in ('nan', 'none', 'n/a', ''):
        return None

    tipo = str(row.get('tipo', 'Título')).strip()
    if tipo.lower() in ('nan', 'none', ''):
        tipo = 'Título de Renda Fixa'

    issuer = str(row.get('issuer', '')).strip()
    if issuer.lower() in ('nan', 'none', ''):
        issuer = 'Emissor Privado'

    isin = str(row.get('isin', '')).strip()
    if isin.lower() in ('nan', 'none', ''):
        isin = '-'

    indexador = str(row.get('indexador', '')).strip()
    if indexador.lower() in ('nan', 'none', ''):
        indexador = '-'

    taxa = str(row.get('taxa_emissao', '')).strip()
    if taxa.lower() in ('nan', 'none', ''):
        taxa = '-'
    else:
        try:
            taxa = f"{float(taxa):.2f}%"
        except:
            pass

    rating = str(row.get('rating', '')).strip()
    if rating.lower() in ('nan', 'none', ''):
        rating = '-'

    rating_norm = normalize_rating(rating) or rating
    if rating_norm == '-':
        rating_norm = 'Sem Rating'

    agencia = str(row.get('agencia', '')).strip()
    if agencia.lower() in ('nan', 'none', ''):
        agencia = '-'

    vencimento = str(row.get('vencimento', '')).strip()
    if vencimento.lower() in ('nan', 'none', ''):
        vencimento = '-'

    duration = str(row.get('duration', '')).strip()
    if duration.lower() in ('nan', 'none', ''):
        duration = '-'
    else:
        try:
            duration = f"{float(duration):.2f} anos"
        except:
            pass

    spread = str(row.get('spread', '')).strip()
    if spread.lower() in ('nan', 'none', ''):
        spread = '-'
    else:
        try:
            spread = f"{float(spread)*100:.2f}%"
        except:
            pass

    emissao = str(row.get('emissao', '')).strip()
    if emissao.lower() in ('nan', 'none', ''):
        emissao = '-'

    serie = str(row.get('serie', '')).strip()
    if serie.lower() in ('nan', 'none', ''):
        serie = '-'

    pu = str(row.get('pu', '')).strip()
    if pu.lower() in ('nan', 'none', ''):
        pu = '-'
    else:
        try:
            pu = f"R$ {float(pu):,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.')
        except:
            pass

    # Procurar emissor cadastrado
    issuer_key = issuer.strip().lower()
    emitter_info = EMITTERS_MAP.get(issuer_key)
    if not emitter_info:
        for k, v in EMITTERS_MAP.items():
            if len(k) > 3 and (k in issuer_key or issuer_key in k):
                emitter_info = v
                break

    page_url = f"{BASE_URL}/asset/{ticker}"
    title = f"{tipo} {ticker} ({issuer}) — Taxas, Rating {rating_norm}, Spread e Vencimento | FIXDATA"
    
    cnpj_desc = f" (CNPJ: {emitter_info['cnpj_formatado']})" if emitter_info and emitter_info.get('cnpj_formatado') else ""
    description = (
        f"Análise completa e dados de mercado de {tipo} {ticker} emitida por {issuer}{cnpj_desc}. "
        f"Indexador: {indexador} (Taxa: {taxa}), Vencimento: {vencimento}, Rating Normalizado: {rating_norm} (Original: {rating} - {agencia}), "
        f"Duration: {duration}, Spread: {spread}. Acompanhe cotações e gráficos no FIXDATA."
    )

    provider_data = {
        "@type": "Organization",
        "name": issuer
    }
    if emitter_info:
        if emitter_info.get('cnpj_formatado'):
            provider_data["taxID"] = emitter_info['cnpj_formatado']
        if emitter_info.get('site_ri'):
            provider_data["url"] = emitter_info['site_ri']

    schema_json = json.dumps({
        "@context": "https://schema.org",
        "@type": "FinancialProduct",
        "name": f"{tipo} {ticker}",
        "identifier": ticker,
        "isin": isin,
        "description": description,
        "url": page_url,
        "category": tipo,
        "provider": provider_data
    }, ensure_ascii=False)

    emitter_section_html = ""
    if emitter_info:
        ri_button = f'<a href="{emitter_info["site_ri"]}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-lg border border-blue-200">Portal de RI &rarr;</a>' if emitter_info.get("site_ri") else ""
        razao_sub = f'<p class="text-xs text-slate-500 font-medium">{emitter_info["razao_social"]}</p>' if emitter_info.get("razao_social") and emitter_info.get("razao_social") != emitter_info.get("nome_fantasia") else ""
        desc_box = f'<p class="text-xs text-slate-600 bg-slate-50 p-3.5 rounded-xl border border-slate-100 mt-3">{emitter_info["descricao"]}</p>' if emitter_info.get("descricao") else ""
        sede = f'{emitter_info.get("municipio") or ""} / {emitter_info.get("uf") or ""}'.strip(' /') or 'Brasil'
        emitter_section_html = f"""
        <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <span class="text-xs font-bold text-blue-600 uppercase tracking-wider">Perfil do Emissor / Devedor CVM</span>
              <h2 class="text-xl font-extrabold text-slate-900 mt-0.5">{emitter_info.get('nome_fantasia') or emitter_info.get('razao_social')}</h2>
              {razao_sub}
            </div>
            {ri_button}
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div class="p-2.5 bg-slate-50 rounded-lg"><span class="text-slate-400 font-bold block mb-0.5">CNPJ</span><strong class="text-slate-800 font-mono text-sm">{emitter_info.get('cnpj_formatado') or '-'}</strong></div>
            <div class="p-2.5 bg-slate-50 rounded-lg"><span class="text-slate-400 font-bold block mb-0.5">Setor</span><strong class="text-slate-800">{emitter_info.get('setor') or '-'}</strong></div>
            <div class="p-2.5 bg-slate-50 rounded-lg"><span class="text-slate-400 font-bold block mb-0.5">Registro CVM</span><strong class="text-emerald-700">{emitter_info.get('situacao_cvm') or 'Ativo'}</strong></div>
            <div class="p-2.5 bg-slate-50 rounded-lg"><span class="text-slate-400 font-bold block mb-0.5">Sede</span><strong class="text-slate-800">{sede}</strong></div>
          </div>
          {desc_box}
        </div>
        """

    pay_info = PAYMENTS_MAP.get(ticker.upper())
    payments_section_html = ""
    if pay_info and pay_info.get('events'):
        pay_rows = ""
        for ev in pay_info['events'][:8]:
            dt = str(ev.get('data_evento', ''))
            dt_fmt = f"{dt.split('-')[2]}/{dt.split('-')[1]}/{dt.split('-')[0]}" if '-' in dt else dt
            tipo_ev = str(ev.get('tipo_evento', 'Pagamento'))
            val_real = ev.get('valor_real')
            val_str = f"R$ {float(val_real):,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.') if pd.notna(val_real) and str(val_real).lower() != 'nan' else "-"
            st = str(ev.get('status', 'Previsto'))
            fonte_ev = str(ev.get('fonte', 'Cronograma Contratual'))
            pay_rows += f"""
            <tr class="border-b border-slate-100 text-xs">
              <td class="px-3 py-2 font-semibold text-slate-800">{dt_fmt}</td>
              <td class="px-3 py-2"><span class="px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-medium">{tipo_ev}</span></td>
              <td class="px-3 py-2 text-right font-bold text-slate-900">{val_str}</td>
              <td class="px-3 py-2 text-center"><span class="px-2 py-0.5 bg-slate-100 text-slate-700 rounded font-semibold">{st}</span></td>
              <td class="px-3 py-2 text-slate-400">{fonte_ev}</td>
            </tr>
            """
        payments_section_html = f"""
        <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <span class="text-xs font-bold text-blue-600 uppercase tracking-wider">Cronograma & Fluxo de Pagamentos</span>
              <h2 class="text-xl font-extrabold text-slate-900 mt-0.5">Agenda de Cupons e Amortizações ({ticker})</h2>
            </div>
            <span class="text-xs text-slate-500 font-medium">{pay_info['total_events']} eventos registrados</span>
          </div>
          <div class="overflow-x-auto max-h-72 overflow-y-auto rounded-xl border border-slate-200">
            <table class="w-full text-left text-xs text-slate-600">
              <thead class="bg-slate-100 text-slate-700 font-bold sticky top-0">
                <tr>
                  <th class="px-3 py-2">Data</th>
                  <th class="px-3 py-2">Evento</th>
                  <th class="px-3 py-2 text-right">Valor Pago (R$)</th>
                  <th class="px-3 py-2 text-center">Status</th>
                  <th class="px-3 py-2">Fonte</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 bg-white">
                {pay_rows}
              </tbody>
            </table>
          </div>
        </div>
        """

    prices_info = PRICES_MAP.get(ticker.upper())
    prices_section_html = ""
    if prices_info and prices_info.get('recent'):
        recent_items = prices_info['recent']
        grid_items = ""
        for item in reversed(recent_items):
            dt = str(item.get('date', ''))
            dt_fmt = f"{dt.split('-')[2]}/{dt.split('-')[1]}/{dt.split('-')[0]}" if '-' in dt else dt
            yield_val = item.get('yield')
            price_val = item.get('price')
            yield_str = f"{float(yield_val):.4f}% a.a." if pd.notna(yield_val) and str(yield_val).lower() != 'nan' else "-"
            price_str = f"R$ {float(price_val):,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.') if pd.notna(price_val) and str(price_val).lower() != 'nan' else "-"
            grid_items += f"""
            <div class="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
              <span class="text-[11px] text-slate-400 font-semibold block">{dt_fmt}</span>
              <p class="font-bold text-blue-700 mt-0.5">{yield_str}</p>
              <p class="text-[11px] text-slate-600 font-medium">{price_str}</p>
            </div>
            """
        prices_section_html = f"""
        <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <span class="text-xs font-bold text-blue-600 uppercase tracking-wider">Histórico de Mercado Secundário</span>
              <h2 class="text-xl font-extrabold text-slate-900 mt-0.5">Cotações e Taxas Indicativas ({ticker})</h2>
            </div>
            <span class="text-xs text-slate-500 font-medium">{prices_info['total_trades']} sessões registradas</span>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {grid_items}
          </div>
        </div>
        """

    html_content = f"""<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/x-icon" href="/favicon.ico" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    
    <!-- Primary Meta Tags -->
    <title>{title}</title>
    <meta name="title" content="{title}" />
    <meta name="description" content="{description}" />
    <meta name="keywords" content="{ticker}, {issuer}, {tipo}, {isin}, debênture, CRI, CRA, renda fixa, taxa {indexador}, rating {rating}, spread de crédito, FIXDATA" />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="{page_url}" />

    <!-- Open Graph / Facebook / WhatsApp -->
    <meta property="og:type" content="website" />
    <meta property="og:url" content="{page_url}" />
    <meta property="og:title" content="{title}" />
    <meta property="og:description" content="{description}" />
    <meta property="og:site_name" content="FIXDATA" />

    <!-- Twitter -->
    <meta property="twitter:card" content="summary_large_image" />
    <meta property="twitter:url" content="{page_url}" />
    <meta property="twitter:title" content="{title}" />
    <meta property="twitter:description" content="{description}" />

    <!-- Structured Data (JSON-LD) for Google Rich Snippets -->
    <script type="application/ld+json">
{schema_json}
    </script>

    <!-- GitHub Pages Single Page Apps Routing Handler -->
    <script type="text/javascript">
      (function(l) {{
        if (l.search[1] === '/' ) {{
          var decoded = l.search.slice(1).split('&').map(function(s) {{ 
            return s.replace(/~and~/g, '&')
          }}).join('?');
          window.history.replaceState(null, null,
              l.pathname.slice(0, -1) + decoded + l.hash
          );
        }}
      }}(window.location))
    </script>

    <script src="https://cdn.tailwindcss.com"></script>
    <script type="importmap">
    {{
      "imports": {{
        "vite": "https://esm.sh/vite@^7.3.1",
        "@vitejs/plugin-react": "https://esm.sh/@vitejs/plugin-react@^5.1.2",
        "papaparse": "https://esm.sh/papaparse@^5.5.3",
        "react": "https://esm.sh/react@^19.2.4",
        "react-dom": "https://esm.sh/react-dom@^19.2.4",
        "react-dom/client": "https://esm.sh/react-dom@^19.2.4/client",
        "fuse.js": "https://esm.sh/fuse.js@^7.1.0",
        "react-router-dom": "https://esm.sh/react-router-dom@^7.13.0",
        "lucide-react": "https://esm.sh/lucide-react@^0.563.0",
        "react/": "https://esm.sh/react@^19.2.4/",
        "react-dom/": "https://esm.sh/react-dom@^19.2.4/",
        "recharts": "https://esm.sh/recharts@^2.15.1",
        "chart.js": "https://esm.sh/chart.js@^4.5.1",
        "react-chartjs-2": "https://esm.sh/react-chartjs-2@^5.3.1"
      }}
    }}
    </script>
    <link rel="stylesheet" href="/index.css">
  </head>
  <body class="bg-slate-50 text-slate-800 antialiased min-h-screen font-sans">
    <div id="root">
      <header class="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div class="container mx-auto px-4 h-16 flex items-center justify-between">
          <a href="/" class="flex items-center gap-2 font-bold text-xl tracking-tight text-slate-900">
            <span class="text-blue-600">FIX</span>DATA
          </a>
          <nav class="flex items-center gap-4 text-sm font-medium text-slate-600">
            <a href="/" class="hover:text-blue-600 transition">Início</a>
            <a href="/charts" class="hover:text-blue-600 transition">Dashboard & Filtros</a>
          </nav>
        </div>
      </header>

      <main class="container mx-auto px-4 py-8 space-y-6 max-w-5xl">
        <div class="text-sm text-slate-500 flex items-center gap-1.5">
          <a href="/" class="hover:underline">Início</a> &gt;
          <a href="/" class="hover:underline">{tipo}s</a> &gt;
          <span class="text-slate-800 font-bold">{ticker}</span>
        </div>

        <div class="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div class="space-y-2">
              <div class="flex flex-wrap items-center gap-2">
                <span class="px-3 py-1 bg-blue-600 text-white text-xs font-black rounded-lg uppercase tracking-wider">{tipo}</span>
                <div class="inline-flex items-center gap-1.5 bg-slate-900 text-white px-3 py-1 rounded-lg text-xs font-bold">
                  <span class="text-slate-400 text-[11px] uppercase">Rating:</span>
                  <span class="px-2 py-0.5 rounded text-xs font-black bg-emerald-600 text-white">{rating_norm}</span>
                  <span class="text-slate-300 text-[11px]">({agencia})</span>
                </div>
              </div>
              <h1 class="text-4xl font-black text-slate-900 tracking-tight">{ticker}</h1>
              <p class="text-lg text-slate-600 font-semibold">{issuer}</p>
            </div>
            <div class="bg-blue-50/80 p-4 rounded-2xl border border-blue-100 text-right">
              <span class="text-xs font-bold text-slate-400 uppercase block">Taxa Contratada / Mercado</span>
              <p class="text-2xl font-black text-blue-700 font-mono">{indexador} + {taxa}</p>
            </div>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 pt-4 border-t border-slate-100 text-xs">
            <div class="p-3 bg-slate-50 rounded-xl"><span class="text-slate-400 font-bold block mb-0.5">ISIN</span><strong class="text-slate-800 font-mono">{isin}</strong></div>
            <div class="p-3 bg-slate-50 rounded-xl"><span class="text-slate-400 font-bold block mb-0.5">Vencimento</span><strong class="text-slate-800">{vencimento}</strong></div>
            <div class="p-3 bg-slate-50 rounded-xl"><span class="text-slate-400 font-bold block mb-0.5">Duration</span><strong class="text-indigo-700 font-bold">{duration}</strong></div>
            <div class="p-3 bg-slate-50 rounded-xl"><span class="text-slate-400 font-bold block mb-0.5">Spread NTN-B</span><strong class="text-emerald-700 font-bold">{spread}</strong></div>
            <div class="p-3 bg-slate-50 rounded-xl"><span class="text-slate-400 font-bold block mb-0.5">Emissão / Série</span><strong class="text-slate-800">{emissao}ª / {serie}ª</strong></div>
            <div class="p-3 bg-slate-50 rounded-xl"><span class="text-slate-400 font-bold block mb-0.5">PU Par</span><strong class="text-slate-800">{pu}</strong></div>
          </div>
        </div>

        {emitter_section_html}

        {payments_section_html}

        {prices_section_html}

        <p class="text-xs text-slate-400 text-center">
          Dados fornecidos por ANBIMA, CVM e B3 através do FIXDATA. Cotações e preços históricos sujeitos à liquidez do mercado secundário.
        </p>
      </main>
    </div>
    
    <script type="module" src="/src/main.tsx"></script>
    <script type="module" src="/index.tsx"></script>
  </body>
</html>"""
    return ticker, html_content

def write_asset(args):
    ticker, html_content = args
    if not ticker or not html_content:
        return
    for out_dir in (OUTPUT_DIR, DOCS_OUTPUT_DIR):
        target_dir = os.path.join(out_dir, ticker)
        os.makedirs(target_dir, exist_ok=True)
        file_path = os.path.join(target_dir, "index.html")
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(html_content)

def main():
    print("Iniciando pré-renderização estática de HTMLs para SEO...")
    df = get_assets()
    rows = [row for _, row in df.iterrows()]
    print(f"Processando {len(rows)} ativos...")

    tasks = []
    for r in rows:
        res = generate_asset_html(r)
        if res:
            tasks.append(res)

    print(f"Gravando {len(tasks)} páginas HTML estáticas...")
    with ThreadPoolExecutor(max_workers=16) as executor:
        list(executor.map(write_asset, tasks))

    print(f"Pré-renderização concluída com sucesso para {len(tasks)} ativos!")

if __name__ == "__main__":
    main()
