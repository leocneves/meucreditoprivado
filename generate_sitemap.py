"""
generate_sitemap.py
Gera 3 sitemaps segmentados por volume de negócios B3 + 1 sitemap index.

- sitemap-hot.xml  : ativos negociados nos últimos 30 dias  (priority 1.0, daily)
- sitemap-year.xml : negociados no ano, exceto os do hot    (priority 0.8, weekly)
- sitemap-all.xml  : todos os demais ativos                 (priority 0.5, monthly)
- sitemap.xml      : sitemap index apontando para os 3 acima
"""

import pandas as pd
from datetime import datetime, timedelta, timezone, UTC
import os

BASE_URL = "https://fixdata.netlify.app"
ASSETS_CSV = "public/data/assets_master.csv"
TRADES_CSV = "public/data/b3_trades_summary.csv"
OUTPUT_DIRS = ["public", "docs"]

# ---------- helpers ----------

def write_xml(path, content):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)


def build_urlset(urls):
    """Recebe lista de dicts {loc, lastmod, changefreq, priority}."""
    lines = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
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
    """Recebe lista de dicts {loc, lastmod}."""
    lines = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for s in sitemaps:
        lines += [
            "  <sitemap>",
            f"    <loc>{s['loc']}</loc>",
            f"    <lastmod>{s['lastmod']}</lastmod>",
            "  </sitemap>",
        ]
    lines.append("</sitemapindex>")
    return "\n".join(lines)


# ---------- carrega dados ----------

print("📄 Lendo assets_master.csv...")
df_assets = pd.read_csv(ASSETS_CSV)
all_tickers = (
    df_assets["ticker"]
    .astype(str)
    .str.strip()
    .replace(["", "nan", "N/A"], None)
    .dropna()
    .unique()
    .tolist()
)
print(f"✅ {len(all_tickers)} ativos carregados")

print("📈 Lendo b3_trades_summary.csv...")
try:
    df_trades = pd.read_csv(TRADES_CSV)
    df_trades["data_negocio"] = pd.to_datetime(df_trades["data_negocio"], errors="coerce", utc=True)

    today = datetime.now(tz=UTC)
    cutoff_30   = today - timedelta(days=30)
    cutoff_year = datetime(today.year, 1, 1, tzinfo=UTC)

    # Agrega volume por ticker nos dois períodos
    hot_tickers = set(
        df_trades[df_trades["data_negocio"] >= cutoff_30]
        .groupby("ticker")["volume_financeiro"]
        .sum()
        .sort_values(ascending=False)
        .index.tolist()
    )
    year_tickers = set(
        df_trades[df_trades["data_negocio"] >= cutoff_year]
        .groupby("ticker")["volume_financeiro"]
        .sum()
        .sort_values(ascending=False)
        .index.tolist()
    ) - hot_tickers

    print(f"   Hot (30d): {len(hot_tickers)} tickers | Ano (excl. hot): {len(year_tickers)} tickers")
except Exception as e:
    print(f"⚠️  Não foi possível ler trades: {e}. Usando sitemap único.")
    hot_tickers = set()
    year_tickers = set()

# ---------- classifica tickers ----------

hot_list  = [t for t in all_tickers if t in hot_tickers]
year_list = [t for t in all_tickers if t in year_tickers]
rest_list = [t for t in all_tickers if t not in hot_tickers and t not in year_tickers]

now = datetime.now(UTC)
lastmod_today = now.strftime("%Y-%m-%d")
lastmod_week  = (now - timedelta(days=7)).strftime("%Y-%m-%d")
lastmod_old   = (now - timedelta(days=30)).strftime("%Y-%m-%d")

static_pages = ["/", "/negocios", "/charts", "/ntnb", "/primary", "/contact"]

# ---------- monta urlsets ----------

def make_urls(tickers, changefreq, priority, lm):
    return [
        {"loc": f"{BASE_URL}/asset/{t}", "lastmod": lm,
         "changefreq": changefreq, "priority": priority}
        for t in tickers
    ]

static_urls = [
    {"loc": f"{BASE_URL}{p}", "lastmod": lastmod_today,
     "changefreq": "daily", "priority": "0.9"}
    for p in static_pages
]

hot_urls  = static_urls + make_urls(hot_list,  "daily",   "1.0", lastmod_today)
year_urls =               make_urls(year_list, "weekly",  "0.8", lastmod_week)
rest_urls =               make_urls(rest_list, "monthly", "0.5", lastmod_old)

# ---------- escreve arquivos ----------

sitemaps_meta = [
    {"filename": "sitemap-hot.xml",  "urls": hot_urls,
     "label": f"hot ({len(hot_list)} ativos)"},
    {"filename": "sitemap-year.xml", "urls": year_urls,
     "label": f"ano ({len(year_list)} ativos)"},
    {"filename": "sitemap-all.xml",  "urls": rest_urls,
     "label": f"demais ({len(rest_list)} ativos)"},
]

index_entries = []

for sm in sitemaps_meta:
    content = build_urlset(sm["urls"])
    for d in OUTPUT_DIRS:
        write_xml(f"{d}/{sm['filename']}", content)
    index_entries.append({"loc": f"{BASE_URL}/{sm['filename']}", "lastmod": lastmod_today})
    print(f"   ✅ {sm['filename']} — {sm['label']}")

# Sitemap index (substitui o antigo sitemap.xml)
index_content = build_sitemap_index(index_entries)
for d in OUTPUT_DIRS:
    write_xml(f"{d}/sitemap.xml", index_content)

total = len(hot_urls) + len(year_urls) + len(rest_urls)
print(f"\n🗺️  Sitemap index gerado com 3 sitemaps ({total} URLs totais)")
print(f"   sitemap.xml      → sitemap index")
print(f"   sitemap-hot.xml  → {len(hot_urls)} URLs (hot, últimos 30 dias)")
print(f"   sitemap-year.xml → {len(year_urls)} URLs (negociados no ano)")
print(f"   sitemap-all.xml  → {len(rest_urls)} URLs (demais ativos)")
