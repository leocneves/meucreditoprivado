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
    
    # 1. Carregar URLs do sitemap-hot.xml
    try:
        tree = ET.parse(SITEMAP_PATH)
        root = tree.getroot()
        ns = {'sm': 'http://www.sitemaps.org/schemas/sitemap/0.9'}
        urls = [loc.text for loc in root.findall('.//sm:loc', ns) if loc.text]
        print(f"Carregadas {len(urls)} URLs prioritárias do sitemap-hot.", flush=True)
    except Exception as e:
        print(f"Erro ao carregar sitemap: {e}", flush=True)
        return False

    if not urls:
        print("Nenhuma URL encontrada para envio.", flush=True)
        return False

    # IndexNow aceita até 10.000 URLs por lote
    payload = {
        "host": HOST,
        "key": INDEXNOW_KEY,
        "keyLocation": KEY_LOCATION,
        "urlList": urls[:10000]
    }

    headers = {
        "Content-Type": "application/json; charset=utf-8",
        "User-Agent": "FixData-IndexNow/1.0"
    }

    endpoints = [
        "https://api.indexnow.org/indexnow",
        "https://www.bing.com/indexnow"
    ]

    for ep in endpoints:
        try:
            print(f"Enviando lote de {len(payload['urlList'])} URLs para {ep}...", flush=True)
            res = requests.post(ep, json=payload, headers=headers, timeout=15)
            if res.status_code in (200, 202):
                print(f" [OK] {ep} aceitou a submissão! (HTTP {res.status_code})", flush=True)
            else:
                print(f" [AVISO] {ep} retornou status {res.status_code}: {res.text}", flush=True)
        except Exception as e:
            print(f" [ERRO] Falha ao conectar com {ep}: {e}", flush=True)

    print("=== PROCESSO INDEXNOW CONCLUÍDO COM SUCESSO ===", flush=True)
    return True

if __name__ == "__main__":
    submeter_indexnow()
