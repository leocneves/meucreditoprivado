"""
generate_sitemap.py
Gera 3 sitemaps segmentados por volume de negócios B3 + 1 sitemap index.
Implementação pura em Python com biblioteca padrão (sem dependência de pandas ou numpy),
garantindo execução rápida e 100% confiável no Netlify, Docker e ambientes CI/CD.

- sitemap-hot.xml  : ativos negociados nos últimos 30 dias  (priority 1.0, daily)
- sitemap-year.xml : negociados no ano, exceto os do hot    (priority 0.8, weekly)
- sitemap-all.xml  : todos os demais ativos                 (priority 0.5, monthly)
- sitemap.xml      : sitemap index apontando para os 3 acima
"""

import csv
import os
from datetime import datetime, timedelta, timezone

BASE_URL = "https://fixdata.netlify.app"
ASSETS_CSV = "public/data/assets_master.csv"
TRADES_CSV = "public/data/b3_trades_summary.csv"
OUTPUT_DIRS = ["public", "docs"]


def write_xml(path, content):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)


def build_urlset(urls):
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
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
        '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
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


def main():
    print("📄 Lendo assets_master.csv...")
    all_tickers = []
    seen = set()
    if os.path.exists(ASSETS_CSV):
        with open(ASSETS_CSV, "r", encoding="utf-8", errors="ignore") as f:
            reader = csv.DictReader(f)
            for row in reader:
                ticker = (row.get("ticker") or "").strip()
                if ticker and ticker.lower() not in ("nan", "none", "n/a", "null", ""):
                    if ticker not in seen:
                        seen.add(ticker)
                        all_tickers.append(ticker)
    print(f"✅ {len(all_tickers)} ativos únicos carregados")

    print("📈 Lendo b3_trades_summary.csv...")
    hot_tickers = set()
    year_tickers = set()

    try:
        if os.path.exists(TRADES_CSV):
            now = datetime.now(timezone.utc)
            cutoff_30 = (now - timedelta(days=30)).strftime("%Y-%m-%d")
            cutoff_year = f"{now.year}-01-01"

            with open(TRADES_CSV, "r", encoding="utf-8", errors="ignore") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    dt = (row.get("data_negocio") or "")[:10]
                    tk = (row.get("ticker") or "").strip()
                    if not tk or not dt:
                        continue
                    if dt >= cutoff_30:
                        hot_tickers.add(tk)
                    elif dt >= cutoff_year:
                        year_tickers.add(tk)

            # Garante exclusividade de hot vs year
            year_tickers = year_tickers - hot_tickers
            print(f"   Hot (30d): {len(hot_tickers)} tickers | Ano (excl. hot): {len(year_tickers)} tickers")
        else:
            print(f"⚠️  Arquivo {TRADES_CSV} não encontrado.")
    except Exception as e:
        print(f"⚠️  Erro ao ler trades ({e}). Continuando com sitemap padrão.")

    hot_list = [t for t in all_tickers if t in hot_tickers]
    year_list = [t for t in all_tickers if t in year_tickers]
    rest_list = [t for t in all_tickers if t not in hot_tickers and t not in year_tickers]

    now = datetime.now(timezone.utc)
    lastmod_today = now.strftime("%Y-%m-%d")
    lastmod_week = (now - timedelta(days=7)).strftime("%Y-%m-%d")
    lastmod_old = (now - timedelta(days=30)).strftime("%Y-%m-%d")

    static_pages = ["/", "/negocios", "/charts", "/ntnb", "/primary", "/contact"]

    def make_urls(tickers, changefreq, priority, lm):
        return [
            {
                "loc": f"{BASE_URL}/asset/{t}",
                "lastmod": lm,
                "changefreq": changefreq,
                "priority": priority,
            }
            for t in tickers
        ]

    static_urls = [
        {
            "loc": f"{BASE_URL}{p}",
            "lastmod": lastmod_today,
            "changefreq": "daily",
            "priority": "0.9",
        }
        for p in static_pages
    ]

    hot_urls = static_urls + make_urls(hot_list, "daily", "1.0", lastmod_today)
    year_urls = make_urls(year_list, "weekly", "0.8", lastmod_week)
    rest_urls = make_urls(rest_list, "monthly", "0.5", lastmod_old)

    sitemaps_meta = [
        {
            "filename": "sitemap-hot.xml",
            "urls": hot_urls,
            "label": f"hot ({len(hot_list)} ativos)",
        },
        {
            "filename": "sitemap-year.xml",
            "urls": year_urls,
            "label": f"ano ({len(year_list)} ativos)",
        },
        {
            "filename": "sitemap-all.xml",
            "urls": rest_urls,
            "label": f"demais ({len(rest_list)} ativos)",
        },
    ]

    index_entries = []
    for sm in sitemaps_meta:
        content = build_urlset(sm["urls"])
        for d in OUTPUT_DIRS:
            write_xml(f"{d}/{sm['filename']}", content)
        index_entries.append({"loc": f"{BASE_URL}/{sm['filename']}", "lastmod": lastmod_today})
        print(f"   ✅ {sm['filename']} — {sm['label']}")

    index_content = build_sitemap_index(index_entries)
    for d in OUTPUT_DIRS:
        write_xml(f"{d}/sitemap.xml", index_content)

    total = len(hot_urls) + len(year_urls) + len(rest_urls)
    print(f"\n🗺️  Sitemap index gerado com 3 sitemaps ({total} URLs totais)")


if __name__ == "__main__":
    main()
