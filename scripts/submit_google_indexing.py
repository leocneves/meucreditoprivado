#!/usr/bin/env python3
"""
submit_google_indexing.py
Submissão de URLs para a Google Indexing API (URL_UPDATED).
Permite forçar o Googlebot a priorizar o rastreamento diário das páginas mais quentes (Hot Silo).

Como configurar a conta no Google Cloud:
1. Acesse o Google Cloud Console (https://console.cloud.google.com/)
2. Crie ou selecione um projeto e ative a "Indexing API".
3. Em "IAM & Admin" > "Service Accounts", crie uma conta de serviço (ex: fixdata-indexer@...).
4. Gere e baixe a chave privada em formato JSON e salve como:
   /home/home/Documents/fixdata/scripts/gsc_service_account.json
5. No Google Search Console (https://search.google.com/search-console), vá em "Configurações" > "Usuários e permissões",
   adicione o e-mail da service account como "Proprietário" (Owner).
6. Execute este script:
   python3 scripts/submit_google_indexing.py
"""

import os
import sys
import json
import argparse
import xml.etree.ElementTree as ET

SCOPES = ["https://www.googleapis.com/auth/indexing"]
ENDPOINT = "https://indexing.googleapis.com/v1/urlNotifications:publish"
DEFAULT_KEY_FILE = os.path.join(os.path.dirname(__file__), "gsc_service_account.json")
SITEMAP_HOT = os.path.join(os.path.dirname(__file__), "..", "public", "sitemap-hot.xml")

def load_hot_urls(limit=200):
    if not os.path.exists(SITEMAP_HOT):
        print(f"⚠️ Sitemap {SITEMAP_HOT} não encontrado.")
        return []
    
    urls = []
    ns = {'sm': 'http://www.sitemaps.org/schemas/sitemap/0.9'}
    try:
        tree = ET.parse(SITEMAP_HOT)
        root = tree.getroot()
        for loc in root.findall('.//sm:loc', ns):
            if loc.text:
                urls.append(loc.text.strip())
    except Exception as e:
        print(f"Erro ao ler sitemap: {e}")
        
    return urls[:limit]

def main():
    parser = argparse.ArgumentParser(description="Submissão Google Indexing API")
    parser.add_argument("--key", default=DEFAULT_KEY_FILE, help="Caminho do arquivo de credenciais JSON do Google Cloud")
    parser.add_argument("--limit", type=int, default=200, help="Limite diário de URLs (cota padrão do Google é 200/dia)")
    parser.add_argument("--dry-run", action="store_true", help="Apenas simula a seleção das URLs sem submeter")
    args = parser.parse_args()

    print("=== GOOGLE INDEXING API — FIXDATA ===")
    urls = load_hot_urls(limit=args.limit)
    print(f"📦 Total de {len(urls)} URLs prioritárias selecionadas do sitemap-hot.xml")

    if args.dry_run:
        print("\n[DRY RUN ATIVADO] Amostra das primeiras 10 URLs:")
        for u in urls[:10]:
            print(f"   -> {u}")
        print("\nNenhuma requisição foi enviada ao Google (modo dry-run).")
        return

    if not os.path.exists(args.key):
        print(f"\n⚠️ Arquivo de credenciais não encontrado em: {args.key}")
        print("\nPassos para ativar a submissão direta via Google Indexing API:")
        print("1. Baixe o JSON da Service Account no Google Cloud Console com a 'Indexing API' ativada.")
        print(f"2. Salve o arquivo em: {args.key}")
        print("3. Adicione o e-mail da Service Account como Proprietário no Google Search Console.")
        print("4. Execute novamente: python3 scripts/submit_google_indexing.py")
        print("\n[INFO] As URLs continuam sendo rastreadas via sitemap.xml, feed.xml e links internos.")
        return

    try:
        from google.oauth2 import service_account
        from google.auth.transport.requests import Request
        import requests
    except ImportError:
        print("⚠️ Bibliotecas 'google-auth' ou 'requests' não encontradas no ambiente Python atual.")
        print("   Dica: execute com o Python do ambiente Airflow: /home/home/airflow/.venv/bin/python scripts/submit_google_indexing.py")
        return

    try:
        credentials = service_account.Credentials.from_service_account_file(args.key, scopes=SCOPES)
        credentials.refresh(Request())
        auth_token = credentials.token
    except Exception as e:
        print(f"❌ Erro ao autenticar conta de serviço Google: {e}")
        return

    headers = {
        "Content-Type": "application/json; charset=utf-8",
        "Authorization": f"Bearer {auth_token}"
    }

    success_count = 0
    error_count = 0

    print(f"\n🚀 Iniciando submissão de {len(urls)} URLs para a Google Indexing API...")
    for i, url in enumerate(urls, 1):
        payload = {
            "url": url,
            "type": "URL_UPDATED"
        }
        try:
            res = requests.post(ENDPOINT, json=payload, headers=headers, timeout=15)
            if res.status_code == 200:
                success_count += 1
                if i % 25 == 0 or i == len(urls):
                    print(f"   [{i}/{len(urls)}] ✅ Submetido com sucesso: {url}")
            elif res.status_code == 429:
                print(f"   [QUOTA EXCEDIDA] Limite diário de 200 URLs atingido no Google.")
                break
            else:
                error_count += 1
                print(f"   [{i}/{len(urls)}] ⚠️ Erro {res.status_code}: {res.text}")
        except Exception as e:
            error_count += 1
            print(f"   [{i}/{len(urls)}] ❌ Falha de rede para {url}: {e}")

    print(f"\n=== FINALIZADO: {success_count} URLs submetidas com sucesso | {error_count} falhas ===")

if __name__ == "__main__":
    main()
