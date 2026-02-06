import pandas as pd
from datetime import datetime

BASE_URL = "https://meucreditoprivado.netlify.app"

CSV_PATH = "public/data/assets_master.csv"   # ajuste se necessário
OUTPUT_FILE = "public/sitemap.xml"

# Lê CSV
df = pd.read_csv(CSV_PATH)

# Limpa tickers inválidos
tickers = (
    df["ticker"]
    .astype(str)
    .str.strip()
    .replace(["", "nan", "N/A"], None)
    .dropna()
    .unique()
)

urls = []

# Páginas fixas
static_pages = [
    "/",
    "/charts",
    "/primary"
]

for page in static_pages:
    urls.append(f"{BASE_URL}{page}")

# Páginas de ativos
for ticker in tickers:
    urls.append(f"{BASE_URL}/asset/{ticker}")

# Data atual no formato sitemap
lastmod = datetime.utcnow().strftime("%Y-%m-%d")

# Gera XML
xml = ['<?xml version="1.0" encoding="UTF-8"?>']
xml.append('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')

for url in urls:
    xml.append("  <url>")
    xml.append(f"    <loc>{url}</loc>")
    xml.append(f"    <lastmod>{lastmod}</lastmod>")
    xml.append("    <changefreq>daily</changefreq>")
    xml.append("    <priority>0.8</priority>")
    xml.append("  </url>")

xml.append("</urlset>")

# Salva arquivo
with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
    f.write("\n".join(xml))

print(f"Sitemap gerado com {len(urls)} URLs -> {OUTPUT_FILE}")