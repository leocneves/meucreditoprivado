import os
import json
import sqlite3
import pandas as pd
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor

BASE_URL = "https://meucreditoprivado.netlify.app"
DB_PATH = "/home/home/airflow/src/data/credito_privado.db"
CSV_PATH = "public/data/assets_master.csv"
OUTPUT_DIR = "public/asset"
DOCS_OUTPUT_DIR = "docs/asset"

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

    page_url = f"{BASE_URL}/asset/{ticker}"
    title = f"{tipo} {ticker} ({issuer}) — Taxas, Rating, Spread e Vencimento | FIXDATA"
    description = (
        f"Análise completa e dados de mercado de {tipo} {ticker} emitida por {issuer}. "
        f"Indexador: {indexador} (Taxa: {taxa}), Vencimento: {vencimento}, Rating: {rating} ({agencia}), "
        f"Duration: {duration}, Spread: {spread}. Acompanhe cotações e gráficos no FIXDATA."
    )

    schema_json = json.dumps({
        "@context": "https://schema.org",
        "@type": "FinancialProduct",
        "name": f"{tipo} {ticker}",
        "identifier": ticker,
        "isin": isin,
        "description": description,
        "url": page_url,
        "category": tipo,
        "provider": {
            "@type": "Organization",
            "name": issuer
        }
    }, ensure_ascii=False)

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
        "fuse.js": "https://esm.sh/fuse.js@^7.1.0",
        "react-router-dom": "https://esm.sh/react-router-dom@^7.13.0",
        "lucide-react": "https://esm.sh/lucide-react@^0.563.0",
        "react/": "https://esm.sh/react@^19.2.4/",
        "chart.js": "https://esm.sh/chart.js@^4.5.1",
        "react-chartjs-2": "https://esm.sh/react-chartjs-2@^5.3.1",
        "react-dom/": "https://esm.sh/react-dom@^19.2.4/"
      }}
    }}
    </script>
    <link rel="stylesheet" href="/index.css">
  </head>
  <body class="bg-slate-50 text-slate-900">
    <div id="root">
      <!-- Semantic Static Fallback for Search Crawlers -->
      <header class="bg-white border-b border-slate-200 py-4 px-6">
        <div class="max-w-6xl mx-auto flex justify-between items-center">
          <a href="/" class="text-xl font-extrabold tracking-tight text-slate-800">
            FIX<span class="text-blue-600">DATA</span>
          </a>
          <nav class="space-x-4 text-sm font-semibold text-slate-600">
            <a href="/" class="hover:text-blue-600">Home</a>
            <a href="/charts" class="hover:text-blue-600">Dashboard</a>
            <a href="/primary" class="hover:text-blue-600">Mercado Primário</a>
          </nav>
        </div>
      </header>

      <main class="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div class="flex items-center gap-2 text-sm text-slate-500">
          <a href="/" class="hover:underline">Início</a> &gt;
          <a href="/" class="hover:underline">{tipo}s</a> &gt;
          <span class="text-slate-800 font-bold">{ticker}</span>
        </div>

        <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-4">
            <div>
              <span class="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-bold rounded-full uppercase tracking-wider">{tipo}</span>
              <h1 class="text-3xl font-extrabold text-slate-900 mt-2">{ticker}</h1>
              <p class="text-lg text-slate-600 font-medium">{issuer}</p>
            </div>
            <div class="flex gap-2">
              <span class="px-3 py-1.5 bg-slate-100 border border-slate-200 text-slate-700 text-sm font-semibold rounded-lg">Rating: <strong>{rating}</strong></span>
              <span class="px-3 py-1.5 bg-slate-100 border border-slate-200 text-slate-700 text-sm font-semibold rounded-lg">Indexador: <strong>{indexador}</strong></span>
            </div>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 pt-4 border-t border-slate-100">
            <div class="p-3 bg-slate-50 rounded-xl">
              <span class="text-xs text-slate-500 font-medium block">ISIN</span>
              <strong class="text-sm text-slate-800">{isin}</strong>
            </div>
            <div class="p-3 bg-slate-50 rounded-xl">
              <span class="text-xs text-slate-500 font-medium block">Taxa de Emissão</span>
              <strong class="text-sm text-slate-800">{taxa}</strong>
            </div>
            <div class="p-3 bg-slate-50 rounded-xl">
              <span class="text-xs text-slate-500 font-medium block">Data de Vencimento</span>
              <strong class="text-sm text-slate-800">{vencimento}</strong>
            </div>
            <div class="p-3 bg-slate-50 rounded-xl">
              <span class="text-xs text-slate-500 font-medium block">Duration</span>
              <strong class="text-sm text-slate-800">{duration}</strong>
            </div>
            <div class="p-3 bg-slate-50 rounded-xl">
              <span class="text-xs text-slate-500 font-medium block">Spread NTN-B</span>
              <strong class="text-sm text-slate-800">{spread}</strong>
            </div>
            <div class="p-3 bg-slate-50 rounded-xl">
              <span class="text-xs text-slate-500 font-medium block">Emissão / Série</span>
              <strong class="text-sm text-slate-800">{emissao}ª / {serie}ª</strong>
            </div>
            <div class="p-3 bg-slate-50 rounded-xl">
              <span class="text-xs text-slate-500 font-medium block">PU Par</span>
              <strong class="text-sm text-slate-800">{pu}</strong>
            </div>
            <div class="p-3 bg-slate-50 rounded-xl">
              <span class="text-xs text-slate-500 font-medium block">Agência de Rating</span>
              <strong class="text-sm text-slate-800">{agencia}</strong>
            </div>
          </div>
        </div>

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
