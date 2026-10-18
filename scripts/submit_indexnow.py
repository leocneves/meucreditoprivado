"""
Script de Submissão Instantânea para IndexNow (Microsoft Bing, Yandex, Naver).
Envia automaticamente todas as URLs do sitemap-hot.xml para indexação instantânea no novo domínio.
"""

import sys
import requests
import xml.etree.ElementTree as ET

INDEXNOW_KEY = "7f61b8b4e8e1413181366735aa41e1ac"
HOST = "fixdatabrasil.com.br"
KEY_LOCATION = f"https://{HOST}/{INDEXNOW_KEY}.txt"
SITEMAP_PATH = "/home/home/Documents/fixdata/public/sitemap-hot.xml"

def submeter_indexnow():
    print(f"=== SUBMISSÃO INDEXNOW ({HOST}) ===", flush=True)
    
    # 1. Carregar URLs de todos os sub-sitemaps (hot, year, all)
    sitemaps = [
        "/home/home/Documents/fixdata/public/sitemap-hot.xml",
        "/home/home/Documents/fixdata/public/sitemap-year.xml",
        "/home/home/Documents/fixdata/public/sitemap-all.xml"
    ]
    
    all_urls = set()
    ns = {'sm': 'http://www.sitemaps.org/schemas/sitemap/0.9'}
    
    for sm in sitemaps:
        try:
            tree = ET.parse(sm)
            root = tree.getroot()
            for loc in root.findall('.//sm:loc', ns):
                if loc.text:
                    all_urls.add(loc.text.strip())
        except Exception as e:
            print(f"Aviso ao carregar {sm}: {e}", flush=True)

    urls = sorted(list(all_urls))
    print(f"Total de {len(urls)} URLs únicas carregadas de todos os sitemaps.", flush=True)

    if not urls:
        print("Nenhuma URL encontrada para envio.", flush=True)
        return False

    # IndexNow aceita até 10.000 URLs por lote
    chunk_size = 10000
    headers = {
        "Content-Type": "application/json; charset=utf-8",
        "User-Agent": "FixData-IndexNow/1.0"
    }
    endpoints = [
        "https://api.indexnow.org/indexnow",
        "https://www.bing.com/indexnow"
    ]

    for i in range(0, len(urls), chunk_size):
        chunk = urls[i:i + chunk_size]
        payload = {
            "host": HOST,
            "key": INDEXNOW_KEY,
            "keyLocation": KEY_LOCATION,
            "urlList": chunk
        }
        print(f"\n--- Enviando lote {i // chunk_size + 1} ({len(chunk)} URLs: {i+1} a {i+len(chunk)}) ---", flush=True)
        for ep in endpoints:
            try:
                res = requests.post(ep, json=payload, headers=headers, timeout=25)
                if res.status_code in (200, 202):
                    print(f" [OK] {ep} aceitou o lote! (HTTP {res.status_code})", flush=True)
                else:
                    print(f" [AVISO] {ep} retornou status {res.status_code}: {res.text}", flush=True)
            except Exception as e:
                print(f" [ERRO] Falha ao conectar com {ep}: {e}", flush=True)

    print("\n=== PROCESSO INDEXNOW CONCLUÍDO COM SUCESSO ===", flush=True)
    return True

if __name__ == "__main__":
    submeter_indexnow()
