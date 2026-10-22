import os
import re
import json
import math
import shutil
import sqlite3
import pandas as pd
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor

BASE_URL = "https://fixdatabrasil.com.br"
DB_PATH = "/home/home/airflow/src/data/credito_privado.db"
CSV_PATH = "public/data/assets_master.csv"
OUTPUT_DIR = "public/asset"
DOCS_OUTPUT_DIR = "docs/asset"

def is_valid_ticker(ticker: str) -> bool:
    if not ticker:
        return False
    t = str(ticker).strip()
    if t.lower() in ('nan', 'none', 'n/a', 'null', '', '-', '0'):
        return False
    # Rejeita ISINs estruturados (ISO 6166 de 12 caracteres: ex: BRBRAMDBS001, BRCEDBCRI002)
    # Preserva debêntures e ativos legítimos cujo código comece com 'BR' (ex: BRFS31, BRKP28, BRAM11)
    if len(t) == 12 and re.match(r'^BR[A-Z0-9]{4}(DBS|DBC|DBN|CRI|CRA|NC0|CTF|LFI)[A-Z0-9]{2}\d$', t):
        return False
    # Rejeita prefixos sintéticos gerados por crawlers
    if t.startswith(('CRI_', 'CRA_', 'DEB_')):
        return False
    # Rejeita puramente numérico ou caracteres inválidos para rota URL
    if t.isdigit() or ' ' in t or '/' in t or '\\' in t:
        return False
    return True


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

def get_bundle_script():
    # 1. Busca dinamicamente a tag exata gerada no index.html do Vite
    for html_file in ("docs/index.html", "dist/index.html", "index.html"):
        if os.path.exists(html_file):
            try:
                with open(html_file, "r", encoding="utf-8") as f:
                    content = f.read()
                    m = re.search(r'<script\s+type="module"\s+crossorigin\s+src="(/assets/index-[^"]+\.js)"></script>', content)
                    if m:
                        return f'<script type="module" crossorigin src="{m.group(1)}"></script>'
            except Exception:
                pass

    # 2. Fallback: seleciona o index-*.js mais recente pela data de modificação (mtime)
    for d in ("docs/assets", "dist/assets", "public/assets"):
        if os.path.exists(d):
            js_files = [
                f for f in os.listdir(d)
                if f.startswith("index-") and f.endswith(".js")
            ]
            if js_files:
                js_files.sort(key=lambda x: os.path.getmtime(os.path.join(d, x)), reverse=True)
                return f'<script type="module" crossorigin src="/assets/{js_files[0]}"></script>'

    return '<script type="module" crossorigin src="/assets/index-fDOqf6MB.js"></script>'

BUNDLE_SCRIPT_TAG = get_bundle_script()

def get_assets():
    if os.path.exists(CSV_PATH):
        df = pd.read_csv(CSV_PATH, low_memory=False)
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
            all_records = group.to_dict(orient='records')
            recent = all_records[-5:] if len(all_records) > 5 else all_records
            p_map[t_upper] = {
                'total_trades': len(group),
                'recent': recent,
                'all': all_records
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

def get_docs_map():
    docs_file = "public/data/cricra_documents.csv"
    if not os.path.exists(docs_file):
        docs_file = "/home/home/airflow/src/cp_site/data/cricra_documents.csv"
    if not os.path.exists(docs_file):
        return {}
    try:
        df_docs = pd.read_csv(docs_file)
        docs_map = {}
        for ticker, group in df_docs.groupby('ticker'):
            t_upper = str(ticker).strip().upper()
            docs_map[t_upper] = group.to_dict(orient='records')
        if 'isin' in df_docs.columns:
            for isin, group in df_docs.groupby('isin'):
                i_upper = str(isin).strip().upper()
                if i_upper and i_upper not in ('NAN', 'NONE', '', '-') and i_upper not in docs_map:
                    docs_map[i_upper] = group.to_dict(orient='records')
        return docs_map
    except Exception as err:
        print(f"Erro ao carregar mapa de documentos: {err}")
        return {}

EMITTERS_MAP = None
PRICES_MAP = None
PAYMENTS_MAP = None
DOCS_MAP = None

def init_maps():
    global EMITTERS_MAP, PRICES_MAP, PAYMENTS_MAP, DOCS_MAP
    if EMITTERS_MAP is None:
        print("📊 Carregando bases analíticas em memória...")
        EMITTERS_MAP = get_emitters_map()
        PRICES_MAP = get_prices_map()
        PAYMENTS_MAP = get_payments_map()
        DOCS_MAP = get_docs_map()
        print("✅ Bases analíticas carregadas!")

def generate_asset_html(row):
    if EMITTERS_MAP is None:
        init_maps()
    ticker = str(row.get('ticker', '')).strip()
    if not is_valid_ticker(ticker):
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

    def format_taxa_py(val, idx):
        if val is None or pd.isna(val):
            return None
        s = str(val).strip()
        if s.lower() in ('nan', 'none', '', '-'):
            return None
        try:
            num = float(s.replace('%', '').replace(',', '.').strip())
        except:
            return s
        idx_up = str(idx or '').upper().strip()
        if 'IPCA' in idx_up or 'IGP' in idx_up:
            return f"{idx} + {num:.2f}% a.a."
        if 'DI%' in idx_up or '%CDI' in idx_up or idx_up == '%DI' or '% DI' in idx_up:
            return f"{num:.2f}% do CDI"
        if 'DI+' in idx_up or 'CDI+' in idx_up:
            return f"CDI + {num:.2f}% a.a."
        if 'PRE' in idx_up or 'PRÉ' in idx_up:
            return f"{num:.2f}% a.a. Pré"
        if idx and idx != '-':
            if num > 25 and ('DI' in idx_up or 'CDI' in idx_up):
                return f"{num:.2f}% do CDI"
            return f"{idx} + {num:.2f}%".strip()
        return f"{num:.2f}% a.a."

    def format_pu_py(val, is_par=False):
        if val is None or pd.isna(val):
            return "R$ 1.000,00" if is_par else "-"
        s = str(val).strip()
        if s.lower() in ('nan', 'none', '', '-'):
            return "R$ 1.000,00" if is_par else "-"
        try:
            p = float(s.replace(',', '.').strip())
            if p <= 0:
                return "R$ 1.000,00" if is_par else "-"
            return f"R$ {p:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.')
        except:
            return s

    t_mercado_raw = row.get('taxa_mercado') or row.get('taxa_negocio_b3') or row.get('taxa_indicativa_anbima')
    if not t_mercado_raw and row.get('taxa_ativo') and row.get('taxa_ativo') != row.get('taxa_emissao'):
        t_mercado_raw = row.get('taxa_ativo')
    taxa_mercado = format_taxa_py(t_mercado_raw, indexador) or "Sem cotação"

    t_emissao_raw = row.get('taxa_emissao') or (row.get('taxa_ativo') if not t_mercado_raw else None)
    taxa_emissao = format_taxa_py(t_emissao_raw, indexador) or (indexador if indexador != '-' else "-")

    pu_mercado = format_pu_py(row.get('pu_mercado'), is_par=False)
    pu_emissao = format_pu_py(row.get('pu_emissao') or row.get('pu'), is_par=True)

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
    elif emissao.endswith('.0'):
        emissao = emissao[:-2]

    serie = str(row.get('serie', '')).strip()
    if serie.lower() in ('nan', 'none', ''):
        serie = '-'
    elif serie.endswith('.0'):
        serie = serie[:-2]

    prazo_anos_display = "-"
    if vencimento != '-' and '-' in vencimento:
        try:
            v_dt = datetime.strptime(vencimento[:10], '%Y-%m-%d')
            diff_days = (v_dt - datetime.now()).days
            if diff_days <= 0:
                prazo_anos_display = "Vencido"
            else:
                prazo_anos_display = f"{diff_days / 365.25:.1f} anos ({diff_days} dias corridos)".replace('.', ',')
        except:
            pass

    vol_val = row.get('volume') or row.get('volume_emissao')
    volume_display = "-"
    if vol_val is not None and not pd.isna(vol_val):
        try:
            v_num = float(str(vol_val).replace(',', '.').strip())
            if v_num >= 1e9:
                volume_display = f"R$ {v_num/1e9:.2f} Bi".replace('.', ',')
            elif v_num > 0:
                volume_display = f"R$ {v_num/1e6:.2f} MM".replace('.', ',')
        except:
            volume_display = str(vol_val)

    dt_emissao = str(row.get('data_emissao', '')).strip()
    data_emissao_br = "-"
    if dt_emissao and dt_emissao.lower() not in ('nan', 'none', ''):
        if '-' in dt_emissao and len(dt_emissao.split('-')) == 3:
            p = dt_emissao.split('-')
            data_emissao_br = f"{p[2]}/{p[1]}/{p[0]}"
        else:
            data_emissao_br = dt_emissao

    ntnb_ref = str(row.get('ntnb_referencia', '')).strip()
    taxa_ntnb_val = row.get('taxa_ntnb')
    if ntnb_ref.lower() in ('nan', 'none', ''):
        ntnb_ref_display = "-"
    else:
        if '-' in ntnb_ref and len(ntnb_ref.split('-')) == 3:
            p = ntnb_ref.split('-')
            ntnb_ref_display = f"{p[2]}/{p[1]}/{p[0]}"
        else:
            ntnb_ref_display = ntnb_ref
        if taxa_ntnb_val is not None and not pd.isna(taxa_ntnb_val):
            try:
                ntnb_ref_display += f" ({float(taxa_ntnb_val):.2f}%)"
            except:
                pass

    setor = str(row.get('setor', '')).strip()
    if not setor or setor.lower() in ('nan', 'none', ''):
        setor = 'Crédito Privado'

    agente_fiduciario = str(row.get('agente_fiduciario', '')).strip()
    if not agente_fiduciario or agente_fiduciario.lower() in ('nan', 'none', ''):
        agente_fiduciario = '-'

    coordenador_lider = str(row.get('coordenador_lider', '')).strip()
    if not coordenador_lider or coordenador_lider.lower() in ('nan', 'none', ''):
        coordenador_lider = '-'

    tipo_up = tipo.upper()
    incentivada_val = str(row.get('incentivada', '')).strip().lower()
    if tipo_up in ('CRI', 'CRA'):
        regime_fiduciario = 'Patrimônio Separado (Sim)'
    elif incentivada_val in ('sim', 'true', '1'):
        regime_fiduciario = 'Incentivada (Lei 12.431)'
    else:
        regime_fiduciario = 'Padrão'

    spread_badge = f"+{spread} vs NTN-B" if (spread and spread != '-') else "Preço Fechamento"

    publico_alvo_val = str(row.get('publico_alvo') or '').strip()
    publico_alvo = publico_alvo_val if publico_alvo_val and publico_alvo_val.lower() not in ('nan', 'none', '') else 'Não Informado'

    periodicidade_cupom_val = str(row.get('periodicidade_cupom') or '').strip()
    periodicidade_cupom = periodicidade_cupom_val if periodicidade_cupom_val and periodicidade_cupom_val.lower() not in ('nan', 'none', '') else 'Não Informado'

    dt_prox_cupom = str(row.get('data_proximo_cupom') or '').strip()[:10]
    periodicidade_lower = str(periodicidade_cupom or '').lower()
    if dt_prox_cupom and '-' in dt_prox_cupom and len(dt_prox_cupom.split('-')) == 3:
        p = dt_prox_cupom.split('-')
        dt_prox_cupom_display = f"{p[2]}/{p[1]}/{p[0]}"
    elif 'bullet' in periodicidade_lower or 'vencimento' in periodicidade_lower:
        v_br = vencimento
        if '-' in vencimento and len(vencimento.split('-')) == 3:
            vp = vencimento.split('-')
            v_br = f"{vp[2]}/{vp[1]}/{vp[0]}"
        dt_prox_cupom_display = f"No Vencimento ({v_br})" if v_br != '-' else 'No Vencimento'
    else:
        dt_prox_cupom_display = '-'

    def safe_fmt_pu(v):
        if pd.isna(v) or v is None: return "-"
        s = str(v).replace(',', '.').strip()
        try:
            flt = float(s)
            return f"R$ {flt:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.') if flt > 0 else "-"
        except:
            return "-"

    vna_display = safe_fmt_pu(row.get('vna'))
    pu_par_display = safe_fmt_pu(row.get('pu_par'))

    # Procurar emissor cadastrado
    issuer_key = issuer.strip().lower()
    emitter_info = EMITTERS_MAP.get(issuer_key)
    if not emitter_info:
        for k, v in EMITTERS_MAP.items():
            if len(k) > 3 and (k in issuer_key or issuer_key in k):
                emitter_info = v
                break

    page_url = f"{BASE_URL}/asset/{ticker.lower()}/"
    
    # Prefix para evitar repetição como "CRA CRA02300JG5"
    tipo_prefix = "" if ticker.upper().startswith(tipo.upper()) else f"{tipo} "
    
    # Nome limpo do emissor
    issuer_display = emitter_info.get('nome_fantasia') if emitter_info and emitter_info.get('nome_fantasia') else issuer
    if len(issuer_display) > 28:
        issuer_display = issuer_display[:26].strip() + "…"

    # Ano ou data de vencimento
    vcto_display = ""
    if vencimento and vencimento != '-':
        if len(vencimento) >= 4 and vencimento[:4].isdigit():
            vcto_display = f"Vcto {vencimento[:4]}"
        else:
            vcto_display = f"Vcto {vencimento}"

    # Destaque de métricas estruturais (em vez de taxa diária volátil)
    features = []
    if indexador and indexador != '-':
        features.append(indexador)
    if vcto_display:
        features.append(vcto_display)
    
    if rating_norm and rating_norm != 'Sem Rating':
        features.append(f"Rating {rating_norm}")
    elif spread and spread != '-':
        features.append("Spread NTN-B")
    else:
        features.append("Histórico B3")

    features_str = ", ".join(features)
    title = f"{tipo_prefix}{ticker} ({issuer_display}) — {features_str} | FIXDATA"
    
    cnpj_desc = f" (CNPJ: {emitter_info['cnpj_formatado']})" if emitter_info and emitter_info.get('cnpj_formatado') else ""
    
    vcto_br = vencimento
    if '-' in vencimento and len(vencimento.split('-')) == 3:
        p = vencimento.split('-')
        vcto_br = f"{p[2]}/{p[1]}/{p[0]}"

    rating_phrase = f", rating {rating_norm}" if (rating_norm and rating_norm != 'Sem Rating') else ""
    spread_phrase = f", spread de {spread}" if (spread and spread != '-') else ""
    duration_phrase = f", duration de {duration}" if (duration and duration != '-') else ""

    if ticker.upper().startswith(tipo.upper()):
        asset_label = f"{ticker} ({tipo} emitido por {issuer}{cnpj_desc})"
    elif tipo.lower().startswith('deb'):
        asset_label = f"da debênture {ticker} emitida por {issuer}{cnpj_desc}"
    else:
        asset_label = f"do {tipo} {ticker} emitido por {issuer}{cnpj_desc}"

    lead_article = "" if asset_label.startswith("da ") else "do "
    description = (
        f"Consulte dados de mercado {lead_article}{asset_label}. "
        f"Indexador {indexador}, vencimento em {vcto_br}{rating_phrase}{spread_phrase}{duration_phrase}. "
        f"Acompanhe histórico de negociações ANBIMA, gráficos e fluxo de pagamentos no FIXDATA."
    )

    # ─── RESUMO EXECUTIVO PARA IA & ANALISTAS (GEO / LLMs) ─────────
    taxa_emissao_str = f"com taxa de emissão de {taxa_emissao}" if taxa_emissao and taxa_emissao != '-' else f"indexado ao {indexador}"
    status_raw = str(row.get('status_ativo', '') or row.get('status', '')).strip()
    status_str = f"encontra-se {status_raw.lower()}" if status_raw and status_raw.lower() not in ('nan', 'none', '') else "está ativo"
    incentivada_str = "incentivado (isenção fiscal Lei 12.431/11)" if str(row.get('incentivada', '')).strip().lower() in ('sim', 'true', '1') else "comum"
    volume_emissao_val = safe_fmt_pu(row.get('volume_emissao') or row.get('volume'))
    vol_str = f", com volume emitido de {volume_emissao_val}" if volume_emissao_val != '-' else ""
    spread_str = f" e spread indicativo de {spread} sobre a NTN-B soberana" if spread and spread != '-' else ""
    duration_str = f" (duration modificada de {duration} anos)" if duration and duration != '-' else ""
    rating_str = f", avaliado com rating {rating_norm} em escala nacional" if rating_norm and rating_norm != 'Sem Rating' else ""

    ai_executive_summary = (
        f"O ativo {ticker} é um título de crédito privado do tipo {tipo} ({incentivada_str}) emitido por {issuer}{cnpj_desc}, "
        f"{taxa_emissao_str} e data de vencimento em {vcto_br}. O título {status_str}{rating_str}{duration_str}{spread_str}{vol_str}. "
        f"Dados analíticos consolidados, fluxo de pagamentos e negociações de mercado secundário via FIXDATA (fixdatabrasil.com.br)."
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
        "@graph": [
            {
                "@type": "WebSite",
                "name": "FIXDATA",
                "alternateName": ["FixData", "Meu Crédito Privado"],
                "url": f"{BASE_URL}/"
            },
            {
                "@type": "BreadcrumbList",
                "itemListElement": [
                    {
                        "@type": "ListItem",
                        "position": 1,
                        "name": "FIXDATA",
                        "item": f"{BASE_URL}/"
                    },
                    {
                        "@type": "ListItem",
                        "position": 2,
                        "name": f"{tipo}s",
                        "item": f"{BASE_URL}/"
                    },
                    {
                        "@type": "ListItem",
                        "position": 3,
                        "name": ticker,
                        "item": page_url
                    }
                ]
            },
            {
                "@type": "FinancialProduct",
                "name": f"{tipo_prefix}{ticker} ({issuer_display})",
                "identifier": ticker,
                "isin": isin,
                "description": description,
                "abstract": ai_executive_summary,
                "url": page_url,
                "category": tipo,
                "provider": provider_data
            }
        ]
    }, ensure_ascii=False)

    # ─── PAYLOAD ESTRUTURADO PARA HYDRATION INSTANTÂNEO & ROTA SPA ────
    asset_dict = {}
    for k, v in row.items():
        if pd.isna(v) or v is None:
            asset_dict[k] = None
        elif isinstance(v, (int, float, str, bool)):
            asset_dict[k] = v
        else:
            asset_dict[k] = str(v)

    price_info = PRICES_MAP.get(ticker.upper()) or {}
    asset_prices = price_info.get('all', [])
    if not asset_prices and isin and isin != '-':
        asset_prices = (PRICES_MAP.get(isin.upper()) or {}).get('all', [])

    payment_info = PAYMENTS_MAP.get(ticker.upper()) or {}
    asset_payments = payment_info.get('events', [])
    if not asset_payments and isin and isin != '-':
        asset_payments = (PAYMENTS_MAP.get(isin.upper()) or {}).get('events', [])

    asset_docs = DOCS_MAP.get(ticker.upper(), [])
    if not asset_docs and isin and isin != '-':
        asset_docs = DOCS_MAP.get(isin.upper(), [])

    payload = {
        "asset": asset_dict,
        "prices": asset_prices,
        "emitter": emitter_info,
        "paymentEvents": asset_payments,
        "documents": asset_docs
    }

    payload = sanitize_json_nan(payload)
    payload_json = json.dumps(payload, ensure_ascii=False, default=str, allow_nan=False)
    payload_json_safe = payload_json.replace("</script>", "<\\/script>")

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
    else:
        prices_section_html = f"""
        <div class="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm text-center space-y-3">
          <div class="p-3 bg-slate-50 text-slate-400 rounded-full w-12 h-12 mx-auto flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-slate-400"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
          </div>
          <h4 class="text-base font-bold text-slate-800">Histórico de Mercado Secundário</h4>
          <p class="text-sm text-slate-500 max-w-md mx-auto">
            Este ativo não registrou negociações no mercado secundário da ANBIMA/B3 nos últimos 180 dias. As métricas apresentadas baseiam-se nas condições contratuais de emissão.
          </p>
        </div>
        """

    html_content = f"""<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="icon" type="image/png" sizes="48x48" href="/favicon-48x48.png" />
    <link rel="icon" type="image/png" sizes="96x96" href="/favicon-96x96.png" />
    <link rel="icon" type="image/png" sizes="192x192" href="/favicon-192x192.png" />
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
    <link rel="shortcut icon" href="/favicon.ico" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    
    <!-- Primary Meta Tags -->
    <title>{title}</title>
    <meta name="title" content="{title}" />
    <meta name="description" content="{description}" />
    <meta name="keywords" content="{ticker}, {issuer}, {tipo}, {isin}, debênture, CRI, CRA, renda fixa, taxa {indexador}, rating {rating}, spread de crédito, FIXDATA" />
    <meta name="robots" content="index, follow" />
    <meta name="msvalidate.01" content="129a651889904b9ab04b2df8015f64f7" />
    <link rel="canonical" href="{page_url}" />

    <!-- Open Graph / Facebook / WhatsApp -->
    <meta property="og:type" content="website" />
    <meta property="og:url" content="{page_url}" />
    <meta property="og:title" content="{title}" />
    <meta property="og:description" content="{description}" />
    <meta property="og:site_name" content="FIXDATA" />
    <meta property="og:image" content="{BASE_URL}/icon-512x512.png" />

    <!-- Twitter -->
    <meta property="twitter:card" content="summary_large_image" />
    <meta property="twitter:url" content="{page_url}" />
    <meta property="twitter:title" content="{title}" />
    <meta property="twitter:description" content="{description}" />
    <meta property="twitter:image" content="{BASE_URL}/icon-512x512.png" />

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
      <nav class="bg-white border-b border-slate-200 sticky top-0 z-[100]">
        <div class="container mx-auto px-4">
          <div class="flex justify-between items-center h-16">
            <a href="/" class="flex items-center shrink-0" title="FIXDATA — Página Inicial">
              <div class="px-3 py-1 bg-blue-600 rounded-lg flex items-center justify-center text-white font-black tracking-wider text-sm sm:text-base shadow-xs hover:bg-blue-700 transition">
                FIX<span class="text-blue-200 font-extrabold">DATA</span>
              </div>
            </a>
            <div class="hidden md:flex items-center gap-0.5 lg:gap-1">
              <a href="/" class="flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 rounded-lg font-bold text-xs lg:text-sm text-slate-500 hover:bg-slate-50">Home</a>
              <a href="/raiox-devedor" class="flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 rounded-lg font-bold text-xs lg:text-sm text-slate-500 hover:bg-slate-50">Raio-X Devedor</a>
              <a href="/calculadora" class="flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 rounded-lg font-bold text-xs lg:text-sm text-slate-500 hover:bg-slate-50">Calculadora</a>
              <a href="/negocios" class="flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 rounded-lg font-bold text-xs lg:text-sm text-slate-500 hover:bg-slate-50">Negócios B3</a>
              <a href="/charts" class="flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 rounded-lg font-bold text-xs lg:text-sm text-slate-500 hover:bg-slate-50">Crédito Privado</a>
              <a href="/ntnb" class="flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 rounded-lg font-bold text-xs lg:text-sm text-slate-500 hover:bg-slate-50">Curva NTN-B</a>
              <a href="/primary" class="flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 rounded-lg font-bold text-xs lg:text-sm text-slate-500 hover:bg-slate-50">Mercado Primário</a>
              <a href="/contact" class="flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 rounded-lg font-bold text-xs lg:text-sm text-slate-500 hover:bg-slate-50">Contato & Apoio</a>
              <div class="ml-2 pl-2 border-l border-slate-200 flex items-center">
                <a href="/raiox-devedor" class="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition shadow-xs">
                  <svg class="w-3.5 h-3.5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
                  <span>Entrar</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main class="container mx-auto px-4 py-8 space-y-6 max-w-5xl">
        <div class="text-sm text-slate-500 flex items-center gap-1.5">
          <a href="/" class="hover:underline">Início</a> &gt;
          <a href="/" class="hover:underline">{tipo}s</a> &gt;
          <span class="text-slate-800 font-bold">{ticker}</span>
        </div>

        <!-- Bloco de Síntese Analítica / Resumo Executivo para IAs e Analistas -->
        <section class="bg-gradient-to-r from-blue-50/70 via-slate-50 to-indigo-50/50 border border-blue-100 rounded-2xl p-4 sm:p-5 text-slate-800 text-xs sm:text-sm leading-relaxed shadow-xs">
          <div class="flex items-center gap-2 mb-1.5">
            <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-blue-600 text-white">Síntese Analítica FIXDATA</span>
            <span class="text-[11px] font-semibold text-slate-500">Resumo Executivo Oficial para Mercado e IAs</span>
          </div>
          <p class="font-normal text-slate-700">
            {ai_executive_summary}
          </p>
        </section>

        <div class="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div class="space-y-1">
              <span class="text-xs font-mono font-bold text-slate-400 uppercase tracking-widest block">{isin}</span>
              <h1 class="text-4xl font-black text-slate-900 tracking-tight">{ticker}</h1>
              <p class="text-lg text-slate-600 font-semibold">{issuer}</p>
            </div>
            <div class="w-full sm:w-auto min-w-[320px] sm:min-w-[480px]">
              <div class="bg-slate-50/80 border border-slate-200 rounded-2xl p-4 sm:p-5">
                <div class="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 gap-4 sm:gap-6">
                  <div class="flex flex-col justify-between space-y-2 sm:pr-2">
                    <div>
                      <div class="flex items-center justify-between mb-1">
                        <span class="text-xs font-bold text-slate-600 uppercase tracking-wider">Mercado Secundário</span>
                        <span class="px-2 py-0.5 bg-white border border-slate-200 text-slate-600 text-[10px] font-semibold rounded-md">ANBIMA / B3</span>
                      </div>
                      <p class="text-2xl sm:text-3xl font-black text-slate-900 font-mono tracking-tight my-1">{taxa_mercado}</p>
                    </div>
                    <div class="pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                      <span class="text-slate-500 font-medium">PU Mercado: <strong class="font-mono text-slate-900">{pu_mercado}</strong></span>
                      <span class="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">{spread_badge}</span>
                    </div>
                  </div>

                  <div class="flex flex-col justify-between space-y-2 pt-3 sm:pt-0 sm:pl-6">
                    <div>
                      <div class="flex items-center justify-between mb-1">
                        <span class="text-xs font-bold text-slate-600 uppercase tracking-wider">Taxa de Emissão</span>
                        <span class="px-2 py-0.5 bg-white border border-slate-200 text-slate-600 text-[10px] font-semibold rounded-md">Escritura</span>
                      </div>
                      <p class="text-2xl sm:text-3xl font-black text-slate-900 font-mono tracking-tight my-1">{taxa_emissao}</p>
                    </div>
                    <div class="pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                      <span class="text-slate-500 font-medium">PU Emissão: <strong class="font-mono text-slate-900">{pu_emissao}</strong></span>
                      <span class="text-[11px] text-slate-400 font-medium">Originação</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3.5 pt-4 border-t border-slate-100">
            <div class="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
              <span class="text-[11px] font-bold text-slate-400 uppercase block mb-1">Indexador</span>
              <p class="text-base font-extrabold text-slate-900">{indexador}</p>
              <span class="text-[11px] text-slate-400 font-medium">Contratual</span>
            </div>
            <div class="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
              <span class="text-[11px] font-bold text-slate-400 uppercase block mb-1">Duration</span>
              <p class="text-base font-extrabold text-slate-900">{duration}</p>
              <span class="text-[11px] text-indigo-600 font-semibold">DU / 252</span>
            </div>
            <div class="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
              <span class="text-[11px] font-bold text-slate-400 uppercase block mb-1">Vencimento</span>
              <p class="text-base font-extrabold text-slate-900">{vcto_br}</p>
              <span class="text-[11px] text-emerald-700 font-bold">Prazo: {prazo_anos_display}</span>
            </div>
            <div class="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
              <span class="text-[11px] font-bold text-slate-400 uppercase block mb-1">Volume Total</span>
              <p class="text-base font-extrabold text-slate-900">{volume_display}</p>
              <span class="text-[11px] text-slate-400 font-medium">Série Emitida</span>
            </div>
          </div>
        </div>

        <div class="bg-slate-900 text-white p-6 sm:p-8 rounded-3xl shadow-xl space-y-6 border border-slate-800">
          <div class="border-b border-slate-800 pb-4">
            <h3 class="text-lg sm:text-xl font-black text-white">Especificações Técnicas da Emissão</h3>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs sm:text-sm">
            <div class="p-3.5 bg-slate-800/80 rounded-xl border border-slate-700/70"><span class="text-slate-400 text-xs font-bold uppercase block mb-1">Instrumento</span><p class="font-bold text-blue-400 text-sm">{tipo}</p></div>
            <div class="p-3.5 bg-slate-800/80 rounded-xl border border-slate-700/70"><span class="text-slate-400 text-xs font-bold uppercase block mb-1">Rating de Crédito</span><div class="flex items-center gap-1.5"><span class="px-2 py-0.5 rounded text-xs font-black bg-emerald-600 text-white">{rating_norm}</span><span class="text-slate-300 text-xs">({agencia})</span></div><span class="text-[10px] text-slate-400 block mt-0.5">Normalizado nacional</span></div>
            <div class="p-3.5 bg-slate-800/80 rounded-xl border border-slate-700/70"><span class="text-slate-400 text-xs font-bold uppercase block mb-1">Código ISIN</span><p class="font-mono text-sm font-bold text-blue-300">{isin}</p></div>
            <div class="p-3.5 bg-slate-800/80 rounded-xl border border-slate-700/70"><span class="text-slate-400 text-xs font-bold uppercase block mb-1">Emissão / Série</span><p class="font-semibold text-slate-100">{emissao}ª Emissão / {serie}ª Série</p></div>
            <div class="p-3.5 bg-slate-800/80 rounded-xl border border-slate-700/70"><span class="text-slate-400 text-xs font-bold uppercase block mb-1">Data de Emissão</span><p class="font-semibold text-slate-100">{data_emissao_br}</p></div>
            <div class="p-3.5 bg-slate-800/80 rounded-xl border border-slate-700/70"><span class="text-slate-400 text-xs font-bold uppercase block mb-1">Ref. NTN-B (Benchmark)</span><p class="font-semibold text-slate-100">{ntnb_ref_display}</p></div>
            <div class="p-3.5 bg-slate-800/80 rounded-xl border border-slate-700/70"><span class="text-slate-400 text-xs font-bold uppercase block mb-1">Público-Alvo (CVM)</span><p class="font-semibold text-blue-200 text-sm">{publico_alvo}</p></div>
            <div class="p-3.5 bg-slate-800/80 rounded-xl border border-slate-700/70"><span class="text-slate-400 text-xs font-bold uppercase block mb-1">Periodicidade de Cupons</span><p class="font-semibold text-slate-100">{periodicidade_cupom}</p></div>
            <div class="p-3.5 bg-slate-800/80 rounded-xl border border-slate-700/70"><span class="text-slate-400 text-xs font-bold uppercase block mb-1">Próximo Cupom</span><p class="font-semibold text-emerald-400">{dt_prox_cupom_display}</p></div>
            <div class="p-3.5 bg-slate-800/80 rounded-xl border border-slate-700/70"><span class="text-slate-400 text-xs font-bold uppercase block mb-1">VNA / PU Par</span><p class="font-mono text-xs font-bold text-slate-100">VNA: {vna_display}<br /><span class="text-indigo-300">Par: {pu_par_display}</span></p></div>
            <div class="p-3.5 bg-slate-800/80 rounded-xl border border-slate-700/70"><span class="text-slate-400 text-xs font-bold uppercase block mb-1">Setor Econômico (ANBIMA)</span><p class="font-semibold text-slate-100">{setor}</p></div>
            <div class="p-3.5 bg-slate-800/80 rounded-xl border border-slate-700/70"><span class="text-slate-400 text-xs font-bold uppercase block mb-1">Agente Fiduciário</span><p class="font-semibold text-slate-100 truncate">{agente_fiduciario}</p></div>
            <div class="p-3.5 bg-slate-800/80 rounded-xl border border-slate-700/70"><span class="text-slate-400 text-xs font-bold uppercase block mb-1">Coordenador Líder</span><p class="font-semibold text-slate-100 truncate">{coordenador_lider}</p></div>
            <div class="p-3.5 bg-slate-800/80 rounded-xl border border-slate-700/70"><span class="text-slate-400 text-xs font-bold uppercase block mb-1">Prazo até Vencimento</span><p class="font-semibold text-emerald-400">{prazo_anos_display}</p></div>
          </div>
        </div>

        {emitter_section_html}

        {prices_section_html}

        {payments_section_html}

        <p class="text-xs text-slate-400 text-center">
          Dados fornecidos por ANBIMA, CVM e B3 através do FIXDATA. Cotações e preços históricos sujeitos à liquidez do mercado secundário.
        </p>
      </main>
    </div>
    
    <script id="__PRELOADED_ASSET__" type="application/json">
{payload_json_safe}
    </script>
    {BUNDLE_SCRIPT_TAG}
  </body>
</html>"""
    return ticker, html_content, payload

ASSETS_JSON_DIR = "public/data/assets"
DOCS_ASSETS_JSON_DIR = "docs/data/assets"


def sanitize_json_nan(obj):
    """Substitui recursivamente NaN/Inf (float, numpy, pandas NA) por None para gerar JSON estritamente válido."""
    if isinstance(obj, dict):
        return {k: sanitize_json_nan(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [sanitize_json_nan(v) for v in obj]
    if isinstance(obj, float):
        return None if (math.isnan(obj) or math.isinf(obj)) else obj
    if obj is None or isinstance(obj, (str, bool, int)):
        return obj
    try:
        if pd.isna(obj):
            return None
    except (TypeError, ValueError):
        pass
    if hasattr(obj, 'item'):
        try:
            return sanitize_json_nan(obj.item())
        except Exception:
            pass
    return obj

def write_asset(args):
    ticker, html_content, payload = args
    if not is_valid_ticker(ticker):
        return

    # 1. Grava páginas HTML pré-renderizadas
    if html_content:
        for out_dir in (OUTPUT_DIR, DOCS_OUTPUT_DIR):
            target_dir = os.path.join(out_dir, ticker.lower())
            os.makedirs(target_dir, exist_ok=True)
            file_path = os.path.join(target_dir, "index.html")
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(html_content)

    # 2. Grava JSON individual do ativo para rotas SPA instantâneas
    if payload:
        clean_ticker = ticker.replace(' ', '').replace('-', '').upper()
        isin = str(payload.get('asset', {}).get('isin', '')).strip().upper()
        payload_str = json.dumps(sanitize_json_nan(payload), ensure_ascii=False, default=str, allow_nan=False)

        def safe_write_json(base_dir, name):
            if not name or name in ('-', 'NONE', 'NAN'):
                return
            full_path = os.path.join(base_dir, f"{name}.json")
            os.makedirs(os.path.dirname(full_path), exist_ok=True)
            with open(full_path, "w", encoding="utf-8") as f:
                f.write(payload_str)
            if '/' in name:
                safe_name = name.replace('/', '_')
                safe_path = os.path.join(base_dir, f"{safe_name}.json")
                with open(safe_path, "w", encoding="utf-8") as f:
                    f.write(payload_str)

        for d_dir in (ASSETS_JSON_DIR, DOCS_ASSETS_JSON_DIR):
            safe_write_json(d_dir, ticker)
            if clean_ticker and clean_ticker != ticker:
                safe_write_json(d_dir, clean_ticker)
            if isin and isin != '-' and len(isin) == 12:
                safe_write_json(d_dir, isin)

STATIC_PAGES_META = [
    {
        "slug": "negocios",
        "title": "Negócios B3 em Tempo Real — Mercado Secundário de Crédito Privado | FIXDATA",
        "description": "Acompanhe trades em tempo real de Debêntures, CRIs e CRAs na B3 com volume financeiro, taxa média ponderada (VWAP), PU e quantidade negociada.",
        "keywords": "negócios B3, debêntures secundário, mercado secundário, trades crédito privado, volume b3, vwap debentures",
        "h1": "Negócios B3 em Tempo Real",
        "lead": "Monitoramento contínuo de negociações no mercado secundário de renda fixa corporativa brasileira.",
    },
    {
        "slug": "charts",
        "title": "Painel Analítico de Spreads e Mercado Secundário ANBIMA | FIXDATA",
        "description": "Gráficos interativos de spreads sobre a curva NTN-B, dispersão de PU, duration e prêmios de risco de crédito privado no Brasil.",
        "keywords": "spreads anbima, dispersão de taxas, ntn-b spread, duration crédito privado, gráficos de renda fixa",
        "h1": "Dashboard Analítico de Mercado Secundário",
        "lead": "Análise quantitativa de taxas indicativas ANBIMA, dispersão de preços unitários e prêmios de risco.",
    },
    {
        "slug": "ntnb",
        "title": "Curva de Juros Real NTN-B e Estrutura a Termo | FIXDATA",
        "description": "Estrutura a termo da curva soberana NTN-B (IPCA+), parâmetros Svensson e benchmarks para cálculo de spread de crédito privado.",
        "keywords": "curva ntn-b, juros real brasil, taxa ipca+, curva soberana, parâmetros ntnb",
        "h1": "Estrutura a Termo da Curva NTN-B",
        "lead": "Curva soberana de juros reais e prêmios de inflação para marcação a mercado e benchmark de spreads.",
    },
    {
        "slug": "primary",
        "title": "Emissões Primárias de Debêntures, CRIs e CRAs | FIXDATA",
        "description": "Radar de ofertas públicas e emissões primárias de crédito privado registradas na CVM e ANBIMA com prazos, taxas e garantias.",
        "keywords": "emissões primárias, ofertas públicas cvm, ipo de debêntures, novas emissões cri cra",
        "h1": "Emissões Primárias de Renda Fixa",
        "lead": "Acompanhamento de novas ofertas públicas de dívida corporativa registradas na CVM.",
    },
    {
        "slug": "raiox-devedor",
        "title": "Raio-X do Devedor e Solvência de Emissores CVM | FIXDATA",
        "description": "Dossiê executivo e solvência de mais de 800 companhias emissoras com modelo Altman Z'', índice de cobertura de juros (ICR), ratings e dívidas.",
        "keywords": "raio-x devedor, solvência empresas cvm, altman z score, icr cobertura de juros, dívida líquida ebitda, rating devedor",
        "h1": "Raio-X e Solvência do Devedor",
        "lead": "Análise fundamentalista de solvência contábil, alavancagem financeira e histórico de notas de crédito.",
    },
    {
        "slug": "calculadora",
        "title": "Calculadora de Equivalência e Gross-up de Renda Fixa | FIXDATA",
        "description": "Calcule a equivalência de taxas isentas de IR (CRIs, CRAs, Debêntures Incentivadas Lei 12.431) contra títulos tributados e CDI.",
        "keywords": "calculadora renda fixa, gross up debentures incentivadas, equivalencia cri cra cdi, isenção ir renda fixa",
        "h1": "Calculadora de Gross-up e Equivalência",
        "lead": "Ferramenta analítica para comparar a rentabilidade real de papéis incentivados isentos contra ativos tributados.",
    },
    {
        "slug": "contact",
        "title": "Contato, Parcerias e Apoio ao Projeto | FIXDATA",
        "description": "Entre em contato com a equipe de desenvolvimento do FIXDATA para sugestões, dados adicionais ou parcerias institucionais.",
        "keywords": "contato fixdata, feedback, apoio projeto, dados renda fixa brasil",
        "h1": "Contato e Apoio ao Projeto",
        "lead": "Canal oficial para dúvidas, sugestões analíticas e parcerias.",
    },
    {
        "slug": "agenda",
        "title": "Agenda de Pagamentos e Proventos de Crédito Privado | FIXDATA",
        "description": "Cronograma de liquidação de juros, amortizações e prêmios de Debêntures, CRIs e CRAs no Brasil para os próximos 90 dias e 12 meses.",
        "keywords": "agenda de pagamentos debêntures, proventos crédito privado, cronograma amortização cri cra, juros debêntures, fluxo de caixa renda fixa",
        "h1": "Agenda de Pagamentos Futuros de Crédito Privado",
        "lead": "Cronograma contratual consolidado de eventos de amortização e juros de debêntures, CRIs e CRAs mapeados no mercado brasileiro.",
    },
    {
        "slug": "comparar",
        "title": "Comparador de Debêntures, CRIs e CRAs | FIXDATA",
        "description": "Compare dois títulos de crédito privado lado a lado em taxas indicativas, spreads sobre NTN-B, ratings, duration, isenção fiscal (Lei 12.431) e liquidez B3.",
        "keywords": "comparador de debêntures, comparar renda fixa, debênture vs cri, spread ntn-b comparador, simulador crédito privado",
        "h1": "Comparador de Ativos de Crédito Privado",
        "lead": "Análise quantitativa direta entre dois papéis de renda fixa corporativa para tomada de decisão técnica fundamentada.",
    },
]

def render_static_pages():
    print("📄 Gerando páginas estáticas institucionais para SEO...")
    for p in STATIC_PAGES_META:
        slug = p["slug"]
        page_url = f"{BASE_URL}/{slug}/"
        html = f"""<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="icon" type="image/png" sizes="48x48" href="/favicon-48x48.png" />
    <link rel="icon" type="image/png" sizes="96x96" href="/favicon-96x96.png" />
    <link rel="icon" type="image/png" sizes="192x192" href="/favicon-192x192.png" />
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
    <link rel="shortcut icon" href="/favicon.ico" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    
    <!-- Primary Meta Tags -->
    <title>{p['title']}</title>
    <meta name="title" content="{p['title']}" />
    <meta name="description" content="{p['description']}" />
    <meta name="keywords" content="{p['keywords']}" />
    <meta name="robots" content="index, follow" />
    <meta name="msvalidate.01" content="129a651889904b9ab04b2df8015f64f7" />
    <link rel="canonical" href="{page_url}" />

    <!-- Open Graph / Facebook / WhatsApp -->
    <meta property="og:type" content="website" />
    <meta property="og:url" content="{page_url}" />
    <meta property="og:title" content="{p['title']}" />
    <meta property="og:description" content="{p['description']}" />
    <meta property="og:site_name" content="FIXDATA" />
    <meta property="og:image" content="{BASE_URL}/icon-512x512.png" />

    <!-- Twitter -->
    <meta property="twitter:card" content="summary_large_image" />
    <meta property="twitter:url" content="{page_url}" />
    <meta property="twitter:title" content="{p['title']}" />
    <meta property="twitter:description" content="{p['description']}" />
    <meta property="twitter:image" content="{BASE_URL}/icon-512x512.png" />

    <link rel="stylesheet" href="/index.css">
    <script src="https://cdn.tailwindcss.com"></script>
    {BUNDLE_SCRIPT_TAG}
  </head>
  <body class="bg-slate-50 text-slate-800 antialiased min-h-screen font-sans">
    <div id="root">
      <nav class="bg-white border-b border-slate-200 sticky top-0 z-[100]">
        <div class="container mx-auto px-4">
          <div class="flex justify-between items-center h-16">
            <a href="/" class="flex items-center shrink-0" title="FIXDATA — Página Inicial">
              <div class="px-3 py-1 bg-blue-600 rounded-lg flex items-center justify-center text-white font-black tracking-wider text-sm sm:text-base shadow-xs hover:bg-blue-700 transition">
                FIX<span class="text-blue-200 font-extrabold">DATA</span>
              </div>
            </a>
            <div class="text-xs text-slate-500 font-medium">Plataforma de Renda Fixa e Crédito Privado</div>
          </div>
        </div>
      </nav>

      <main class="container mx-auto px-4 py-8">
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-10 max-w-4xl mx-auto space-y-4">
          <h1 class="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">{p['h1']}</h1>
          <p class="text-base sm:text-lg text-slate-600 leading-relaxed">{p['lead']}</p>
          <div class="pt-4 border-t border-slate-100 flex items-center gap-2 text-sm text-slate-500">
            <span class="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Carregando dados interativos em tempo real...</span>
          </div>
        </div>
      </main>
    </div>
  </body>
</html>"""
        for base_dir in ("public", "docs"):
            target_dir = os.path.join(base_dir, slug)
            os.makedirs(target_dir, exist_ok=True)
            with open(os.path.join(target_dir, "index.html"), "w", encoding="utf-8") as f:
                f.write(html)
        print(f"   ✅ /{slug}/ gerada em public/ e docs/", flush=True)

def prune_orphaned_assets(valid_tickers: set):
    print("🧹 Verificando e podando diretórios órfãos e inválidos...")
    for out_dir in (OUTPUT_DIR, DOCS_OUTPUT_DIR):
        if not os.path.exists(out_dir):
            continue
        try:
            subdirs = os.listdir(out_dir)
        except Exception as e:
            print(f"Erro ao listar {out_dir}: {e}")
            continue

        removed_count = 0
        for name in subdirs:
            full_path = os.path.join(out_dir, name)
            if not os.path.isdir(full_path):
                continue
            # Remove se for maiúsculo (órfão legado de 14/10), se for inválido ou não fizer parte dos tickers válidos
            if name != name.lower() or not is_valid_ticker(name) or name.lower() not in valid_tickers:
                try:
                    shutil.rmtree(full_path)
                    removed_count += 1
                except Exception as e:
                    print(f"Erro ao remover {full_path}: {e}")
        if removed_count > 0:
            print(f"🗑️ Removidos {removed_count} diretórios órfãos/inválidos de {out_dir}")

    # Limpeza de JSONs órfãos sintéticos em public/data/assets e docs/data/assets
    for j_dir in (ASSETS_JSON_DIR, DOCS_ASSETS_JSON_DIR):
        if not os.path.exists(j_dir):
            continue
        try:
            for f in os.listdir(j_dir):
                if f.startswith(('CRI_', 'CRA_', 'DEB_')) and f.endswith('.json'):
                    try:
                        os.remove(os.path.join(j_dir, f))
                    except Exception:
                        pass
        except Exception:
            pass

def main():
    print("Iniciando pré-renderização estática de HTMLs para SEO...")

    # Gera imediatamente páginas institucionais com canonical e SEO próprio
    render_static_pages()

    df = get_assets()
    rows = [row for _, row in df.iterrows()]
    print(f"Processando {len(rows)} ativos...")

    tasks = []
    valid_tickers = set()
    for r in rows:
        res = generate_asset_html(r)
        if res:
            tasks.append(res)
            valid_tickers.add(res[0].lower())

    print(f"Gravando {len(tasks)} páginas HTML estáticas...")
    with ThreadPoolExecutor(max_workers=16) as executor:
        list(executor.map(write_asset, tasks))

    print(f"Pré-renderização concluída com sucesso para {len(tasks)} ativos!")

    # Pruna páginas órfãs antigas
    prune_orphaned_assets(valid_tickers)


if __name__ == "__main__":
    main()


