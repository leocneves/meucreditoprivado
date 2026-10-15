"""
submit_indexnow.py
Submete URLs atualizadas do FIXDATA diretamente para a API do IndexNow (Bing / Copilot / Yandex / Seznam).
Garante indexação ultra-rápida (em minutos/horas) sem depender da velocidade passiva de rastreamento do sitemap.
"""

import json
import os
import re
import sys
import urllib.request
import urllib.error

HOST = "fixdata.netlify.app"
KEY = "129a651889904b9ab04b2df8015f64f7"
KEY_LOCATION = f"https://{HOST}/{KEY}.txt"
INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow"

def get_hot_urls(limit=10000):
    """Extrai URLs do sitemap-hot.xml ou dos arquivos locais."""
    urls = []
    
    # 1. Páginas institucionais prioritárias
    static_paths = [
        "",
        "negocios/",
        "charts/",
        "ntnb/",
        "primary/",
        "contact/",
        "raiox-devedor/",
        "calculadora/",
    ]
    for p in static_paths:
        urls.append(f"https://{HOST}/{p}")

    # 2. Busca URLs do sitemap-hot.xml (se existir)
    for sitemap_file in ("public/sitemap-hot.xml", "docs/sitemap-hot.xml"):
        if os.path.exists(sitemap_file):
            try:
                with open(sitemap_file, "r", encoding="utf-8") as f:
                    content = f.read()
                    matches = re.findall(r'<loc>(https://[^<]+)</loc>', content)
                    for u in matches:
                        if u not in urls:
                            urls.append(u)
                break
            except Exception as e:
                print(f"⚠️ Erro ao ler {sitemap_file}: {e}")

    # Garante limite máximo do IndexNow (10.000 por lote)
    return urls[:limit]

def submit_batch(urls):
    if not urls:
        print("Nenhuma URL para submeter ao IndexNow.")
        return False

    payload = {
        "host": HOST,
        "key": KEY,
        "keyLocation": KEY_LOCATION,
        "urlList": urls
    }

    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        INDEXNOW_ENDPOINT,
        data=data,
        headers={"Content-Type": "application/json; charset=utf-8"},
        method="POST"
    )

    print(f"🚀 Enviando lote de {len(urls)} URLs para o IndexNow ({INDEXNOW_ENDPOINT})...")
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            status = resp.status
            body = resp.read().decode("utf-8")
            if status in (200, 202):
                print(f"✅ Sucesso! Status {status} recebido do IndexNow.")
                return True
            else:
                print(f"⚠️ Resposta inesperada do IndexNow: Status {status} — {body}")
                return False
    except urllib.error.HTTPError as e:
        status = e.code
        body = e.read().decode("utf-8", errors="ignore")
        if status in (200, 202):
            print(f"✅ Sucesso! Status {status} recebido do IndexNow.")
            return True
        print(f"❌ Erro HTTP {status} do IndexNow: {body}")
        return False
    except Exception as e:
        print(f"❌ Erro de conexão ao enviar para IndexNow: {e}")
        return False

def main():
    print("=== Submissão de URLs via IndexNow (Bing / Copilot) ===")
    urls = get_hot_urls()
    print(f"📋 {len(urls)} URLs prioritárias coletadas.")
    if urls:
        print(f"Exemplo: {urls[:3]}")
    
    success = submit_batch(urls)
    if success:
        print(f"🎉 IndexNow concluído! {len(urls)} URLs colocadas na fila prioritária do Bing.")
    else:
        print("⚠️ Submissão ao IndexNow não pôde ser completada.")

if __name__ == "__main__":
    main()
