#!/usr/bin/env python3
"""
scripts/prerender_hubs.py
Gerador modular de:
1) Páginas estáticas ricas (para os 13 módulos React: públicos com dados reais; lead-gated com landing pública honesta).
2) Hubs puramente estáticos de alta intenção SEO/GEO (Categorias, Setores ANBIMA, Diretório de Emissores e Top 500 Emissores).
3) Manifesto `seo_hubs_manifest.json` consumido pelo `generate_sitemap.py` (stdlib pura).

Regra de Lead-Gen:
- NUNCA expor métricas privadas/gateadas do Raio-X (Altman Z'', ICR, EBITDA, Dívida Líquida/EBITDA, Merton/Ohlson)
  em páginas públicas (/emissor/* ou /raiox-devedor/). Em /emissor/* mostrar APENAS dados públicos de cadastro e
  títulos ativos + CTA forte para desbloquear o Raio-X gratuito com login Google em /raiox-devedor/?cnpj=...
"""

import csv
import html as html_lib
import json
import os
import re
import shutil
import unicodedata
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime

import pandas as pd

BASE_URL = "https://fixdatabrasil.com.br"

GOOGLE_NEWS_SWG_SNIPPET = """    <!-- Google News / Reader Revenue Manager (SwG Basic) -->
    <script async type="application/javascript"
            src="https://news.google.com/swg/js/v1/swg-basic.js"></script>
    <script>
      (self.SWG_BASIC = self.SWG_BASIC || []).push( basicSubscriptions => {
        basicSubscriptions.init({
          type: "NewsArticle",
          isPartOfType: ["Product"],
          isPartOfProductId: "CAow87jiCw:openaccess",
          clientOptions: { theme: "light", lang: "pt-BR" },
        });
      });
    </script>"""

RATING_SCORE_MAP = {
    "AAA": 21, "AA+": 20, "AA": 19, "AA-": 18,
    "A+": 17, "A": 16, "A-": 15,
    "BBB+": 14, "BBB": 13, "BBB-": 12,
    "BB+": 11, "BB": 10, "BB-": 9,
    "B+": 8, "B": 7, "B-": 6,
    "CCC+": 5, "CCC": 4, "CCC-": 3,
    "CC": 2, "C": 1, "D": 0,
}

EXCLUDED_SECTORS = {"outros serviços", "outros servicos", "crédito privado", "credito privado", "-", "nan", "none", ""}

EXTRA_SEC_TERMS = (
    "securitizadora", "securitizacao", "securitização", "securitzadora",
    "virgo", "opea", "true sec", "habitasec", "fortesec", "cibrasec",
    "bari sec", "octante", "brazilian securities", "b.sec", "ecoagro",
    "eco. sec", "eco sec", "riza sec", "canalsec", "planeta sec", "ceres sec",
    "cia provincia de securit", "canal companhia de securit", "vert companhia",
    "vortx", "vórtx", "oliveira trust", "pentagono", "pentágono", "dtvm",
)

GENERIC_ISSUER_NAMES = {
    "", "-", "nan", "none", "n/a", "null", "n/d", "emissor privado",
    "nao informado", "não informado", "diversificado", "pulverizado",
    "multiplos", "múltiplos", "varios", "vários", "carteiras diversas", "sem devedor",
}


def esc(val) -> str:
    return html_lib.escape(str(val or ""), quote=True)


def fmt_int(n: int) -> str:
    return f"{int(n):,}".replace(",", ".")


def slugify(text: str) -> str:
    s = unicodedata.normalize("NFKD", str(text or ""))
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    s = s.lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")


def safe_float(v, default=0.0) -> float:
    try:
        if v is None or pd.isna(v):
            return default
        s = str(v).replace(",", ".").strip()
        if not s or s.lower() in ("nan", "none", "-", "null"):
            return default
        return float(s)
    except Exception:
        return default


def is_excluded_public_issuer(name: str, emitter_info: dict = None) -> bool:
    s = str(name or "").strip().lower()
    if s in GENERIC_ISSUER_NAMES:
        return True
    if "pulverizad" in s or "não informado" in s or "nao informado" in s:
        return True
    if s in ("true", "vert", "virgo", "opea", "gaia", "riza"):
        return True
    if any(t in s for t in EXTRA_SEC_TERMS):
        return True
    if emitter_info:
        if str(emitter_info.get("tipo_emissor", "")).strip() == "Securitizadora":
            return True
        rs = str(emitter_info.get("razao_social", "")).strip().lower()
        if any(t in rs for t in EXTRA_SEC_TERMS):
            return True
    return False


def fmt_br_date(iso_str: str) -> str:
    s = str(iso_str or "").strip()[:10]
    if "-" in s and len(s.split("-")) == 3:
        y, m, d = s.split("-")
        return f"{d}/{m}/{y}"
    return s or "-"


def fmt_taxa_short(row_dict: dict) -> str:
    idx = str(row_dict.get("indexador") or "").strip()
    if idx.lower() in ("nan", "none", ""):
        idx = "-"
    val = (
        row_dict.get("taxa_mercado")
        or row_dict.get("taxa_negocio_b3")
        or row_dict.get("taxa_indicativa_anbima")
        or row_dict.get("taxa_ativo")
        or row_dict.get("taxa_emissao")
    )
    num = safe_float(val, default=float("nan"))
    if pd.isna(num):
        return idx
    idx_up = idx.upper()
    if "IPCA" in idx_up or "IGP" in idx_up:
        return f"{idx} + {num:.2f}%"
    if "DI%" in idx_up or "%CDI" in idx_up or idx_up == "%DI" or "% DI" in idx_up:
        return f"{num:.2f}% CDI"
    if "DI+" in idx_up or "CDI+" in idx_up:
        return f"CDI + {num:.2f}%"
    if "PRE" in idx_up or "PRÉ" in idx_up:
        return f"{num:.2f}% Pré"
    return f"{idx} + {num:.2f}%" if idx != "-" else f"{num:.2f}%"


def shared_navbar_html() -> str:
    return """      <nav class="bg-white border-b border-slate-200 sticky top-0 z-[100]">
        <div class="container mx-auto px-4">
          <div class="flex justify-between items-center h-16">
            <a href="/" class="flex items-center shrink-0" title="FIXDATA — Página Inicial">
              <div class="px-3 py-1 bg-blue-600 rounded-lg flex items-center justify-center text-white font-black tracking-wider text-sm sm:text-base shadow-xs hover:bg-blue-700 transition">
                FIX<span class="text-blue-200 font-extrabold">DATA</span>
              </div>
            </a>
            <div class="hidden md:flex items-center gap-2 lg:gap-4 text-xs font-bold text-slate-600">
              <a href="/" class="hover:text-blue-600 transition whitespace-nowrap">Início</a>
              <a href="/debentures/" class="hover:text-blue-600 transition whitespace-nowrap">Debêntures</a>
              <a href="/cri/" class="hover:text-blue-600 transition whitespace-nowrap">CRIs</a>
              <a href="/cra/" class="hover:text-blue-600 transition whitespace-nowrap">CRAs</a>
              <a href="/negocios/" class="hover:text-blue-600 transition whitespace-nowrap">Negócios B3</a>
              <a href="/emissores/" class="hover:text-blue-600 transition whitespace-nowrap">Emissores</a>
              <a href="/setores/" class="hover:text-blue-600 transition whitespace-nowrap">Setores</a>
              <a href="/raiox-devedor/" class="hover:text-blue-600 transition whitespace-nowrap">Raio-X Devedor</a>
              <a href="/calculadora/" class="hover:text-blue-600 transition whitespace-nowrap">Calculadora</a>
            </div>
          </div>
        </div>
      </nav>"""


def shared_footer_html() -> str:
    yr = datetime.now().year
    return f"""      <footer class="bg-white border-t border-slate-200 py-10 mt-16">
        <div class="container mx-auto px-4 text-center space-y-3">
          <div class="flex items-center justify-center gap-3 sm:gap-5 text-xs font-semibold text-slate-600 flex-wrap">
            <a href="/debentures/" class="hover:text-blue-600 transition">Debêntures</a>
            <span>•</span>
            <a href="/debentures-incentivadas/" class="hover:text-blue-600 transition">Debêntures Incentivadas</a>
            <span>•</span>
            <a href="/cri/" class="hover:text-blue-600 transition">CRIs</a>
            <span>•</span>
            <a href="/cra/" class="hover:text-blue-600 transition">CRAs</a>
            <span>•</span>
            <a href="/emissores/" class="hover:text-blue-600 transition">Emissores</a>
            <span>•</span>
            <a href="/setores/" class="hover:text-blue-600 transition">Setores ANBIMA</a>
          </div>
          <div class="flex items-center justify-center gap-4 sm:gap-6 text-xs font-semibold text-slate-500 flex-wrap">
            <a href="/metodologia/" class="hover:text-blue-600 transition">Metodologia</a>
            <span>•</span>
            <a href="/sobre/" class="hover:text-blue-600 transition">Sobre o FIXDATA</a>
            <span>•</span>
            <a href="/termos/" class="hover:text-blue-600 transition">Termos de Uso</a>
            <span>•</span>
            <a href="/privacidade/" class="hover:text-blue-600 transition">Privacidade (LGPD)</a>
            <span>•</span>
            <a href="/negocios/" class="hover:text-blue-600 transition">Negócios B3</a>
            <span>•</span>
            <a href="/ntnb/" class="hover:text-blue-600 transition">Curva NTN-B</a>
            <span>•</span>
            <a href="/contact/" class="hover:text-blue-600 transition">Contato &amp; Apoio</a>
          </div>
          <p class="text-slate-500 text-sm font-semibold">
            &copy; {yr} FIXDATA — Inteligência e Dados de Renda Fixa e Mercado Secundário.
          </p>
          <p class="text-slate-400 text-xs font-medium">
            Desenvolvido por <a href="https://www.linkedin.com/in/leonardo-contador-neves-096312119/" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:text-blue-600 transition-colors font-bold">Leonardo Contador Neves</a>
          </p>
          <p class="text-slate-300 text-[10px] uppercase tracking-widest">
            Base de dados CVM, ANBIMA e B3
          </p>
        </div>
      </footer>"""


def load_b3_summary_stats() -> dict:
    """Agrega volume acumulado B3 e última data negociada por ticker a partir de b3_trades_summary.csv."""
    path = "public/data/b3_trades_summary.csv"
    stats = {}
    if not os.path.exists(path):
        return stats
    try:
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            r = csv.DictReader(f)
            for row in r:
                tk = str(row.get("ticker") or "").strip().upper()
                if not tk:
                    continue
                dt = str(row.get("data_negocio") or "")[:10]
                vol = safe_float(row.get("volume_financeiro"), 0.0)
                qtd = int(safe_float(row.get("qtd_negocios"), 0.0))
                cur = stats.get(tk)
                if cur is None:
                    stats[tk] = {"vol": vol, "qtd": qtd, "last_dt": dt}
                else:
                    cur["vol"] += vol
                    cur["qtd"] += qtd
                    if dt > cur["last_dt"]:
                        cur["last_dt"] = dt
    except Exception as e:
        print(f"Aviso ao agregar b3_trades_summary.csv: {e}")
    return stats


def _clean_date_iso(val) -> str:
    s = str(val or "").strip()[:10]
    if re.match(r"^\d{4}-\d{2}-\d{2}$", s):
        return s
    return ""


def build_seo_hubs_registry(
    df: pd.DataFrame,
    emitters_map: dict,
    raiox_map: dict,
    resolve_raiox_fn,
    norm_company_key_fn,
    clean_cnpj14_fn,
    is_securitizadora_fn,
    normalize_rating_fn,
    is_valid_ticker_fn,
    b3_stats: dict,
    max_issuers: int = 500,
) -> tuple[dict, dict]:
    """Constrói mapas de setores (>=5 ativos) e Top 500 emissores ativos para interlinking e hubs estáticos."""
    active_df = df[df["status_ativo"].astype(str).str.strip() == "Ativo"].copy()

    # 1. Setores ANBIMA válidos com >= 5 ativos vigentes
    sector_groups = {}
    for _, row in active_df.iterrows():
        tk = str(row.get("ticker") or "").strip()
        if not is_valid_ticker_fn(tk):
            continue
        sec = str(row.get("setor") or "").strip()
        if sec.lower() in EXCLUDED_SECTORS:
            continue
        sector_groups.setdefault(sec, []).append(row.to_dict())

    sector_slugs = {}
    sectors_meta = []
    used_sec_slugs = set()
    for sec, rows in sorted(sector_groups.items(), key=lambda kv: len(kv[1]), reverse=True):
        if len(rows) < 5:
            continue
        sl = slugify(sec)
        if not sl or sl in used_sec_slugs:
            continue
        used_sec_slugs.add(sl)
        sector_slugs[sec] = sl
        dates = [
            _clean_date_iso(r.get("data_ultimo_negocio"))
            or _clean_date_iso(r.get("data_anbima"))
            or _clean_date_iso(r.get("data_emissao"))
            for r in rows
        ]
        lastmod = max([d for d in dates if d] or [datetime.now().strftime("%Y-%m-%d")])
        sectors_meta.append({"name": sec, "slug": sl, "rows": rows, "lastmod": lastmod})

    # 2. Top 500 emissores corporativos ativos
    issuer_buckets = {}
    for _, row in active_df.iterrows():
        tk = str(row.get("ticker") or "").strip()
        if not is_valid_ticker_fn(tk):
            continue
        rdict = row.to_dict()
        issuer_raw = str(rdict.get("issuer") or "").strip()
        tipo = str(rdict.get("tipo") or "").strip()
        cnpj_raw = str(rdict.get("cnpj_emissor") or "").strip()
        cnpj14 = clean_cnpj14_fn(cnpj_raw)
        is_cricra = tipo.upper() in ("CRI", "CRA")

        # Resolve emitter_info com mesma precedência canônica sem fuzzy frouxo
        iss_low = issuer_raw.lower()
        iss_is_sec = is_securitizadora_fn(issuer_raw)
        em_info = None
        if is_cricra and not iss_is_sec:
            em_info = emitters_map.get(iss_low) or emitters_map.get(f"norm:{norm_company_key_fn(issuer_raw)}")
            if em_info and is_securitizadora_fn(em_info.get("razao_social", ""), em_info.get("setor", "")):
                em_info = None
        if not em_info and cnpj14:
            cand = emitters_map.get(f"cnpj:{cnpj14}")
            if cand and not (is_cricra and is_securitizadora_fn(cand.get("razao_social", ""), cand.get("setor", "")) and not iss_is_sec):
                em_info = cand
        if not em_info and iss_low not in ("nan", "none", "-", "emissor privado", "") and "pulverizad" not in iss_low:
            em_info = emitters_map.get(iss_low) or emitters_map.get(f"norm:{norm_company_key_fn(issuer_raw)}")
        if not em_info and cnpj14:
            cand8 = emitters_map.get(f"cnpj8:{cnpj14[:8]}")
            if cand8 and not (is_cricra and not iss_is_sec and is_securitizadora_fn(cand8.get("razao_social", ""))):
                em_info = cand8

        if is_excluded_public_issuer(issuer_raw, em_info):
            continue

        display_name = (em_info.get("razao_social") if em_info and em_info.get("razao_social") else issuer_raw).strip()
        if is_excluded_public_issuer(display_name, em_info):
            continue

        canon_key = norm_company_key_fn(display_name) or display_name.lower()
        if not canon_key:
            continue

        b = issuer_buckets.get(canon_key)
        if b is None:
            b = {
                "canon_key": canon_key,
                "name": display_name,
                "emitter_info": em_info,
                "raiox_cnpj": resolve_raiox_fn(display_name, cnpj_raw, tipo, em_info),
                "raw_names": set(),
                "cnpjs": set(),
                "rows": [],
                "liq_count": 0,
                "b3_vol": 0.0,
                "emissao_vol": 0.0,
            }
            issuer_buckets[canon_key] = b

        b["raw_names"].add(iss_low)
        if not b["emitter_info"] and em_info:
            b["emitter_info"] = em_info
        if not b["raiox_cnpj"]:
            rc = resolve_raiox_fn(issuer_raw, cnpj_raw, tipo, em_info)
            if rc:
                b["raiox_cnpj"] = rc
        if em_info and em_info.get("cnpj") and not is_securitizadora_fn(em_info.get("razao_social", ""), em_info.get("setor", "")):
            c14_em = clean_cnpj14_fn(em_info.get("cnpj"))
            if c14_em:
                b["cnpjs"].add(c14_em)
        if cnpj14 and not is_cricra:
            b["cnpjs"].add(cnpj14)

        b["rows"].append(rdict)
        tk_up = tk.upper()
        b3_info = b3_stats.get(tk_up, {})
        vol_b3 = max(safe_float(rdict.get("volume_negociado_b3"), 0.0), b3_info.get("vol", 0.0))
        has_anb = pd.notna(rdict.get("taxa_indicativa_anbima")) and str(rdict.get("taxa_indicativa_anbima")).strip() not in ("", "nan", "None")
        if vol_b3 > 0 or has_anb:
            b["liq_count"] += 1
        b["b3_vol"] += vol_b3
        b["emissao_vol"] += safe_float(rdict.get("volume") or rdict.get("volume_emissao"), 0.0)

    qualifying = [
        b for b in issuer_buckets.values()
        if (b["liq_count"] >= 1 or len(b["rows"]) >= 2) and slugify(b["name"])
    ]
    qualifying.sort(
        key=lambda b: (b["liq_count"], b["b3_vol"], len(b["rows"]), b["emissao_vol"]),
        reverse=True,
    )
    top_issuers = qualifying[:max_issuers]

    issuer_slug_by_canon = {}
    issuer_slug_by_raw = {}
    issuer_slug_by_cnpj = {}
    issuers_meta = []
    used_iss_slugs = set()

    for b in top_issuers:
        base_sl = slugify(b["name"])
        if not base_sl:
            continue
        sl = base_sl
        if sl in used_iss_slugs:
            suffix = (next(iter(b["cnpjs"]), "")[:8]) or str(len(used_iss_slugs))
            sl = f"{base_sl}-{suffix}"
        used_iss_slugs.add(sl)

        dates = []
        for r in b["rows"]:
            tk_up = str(r.get("ticker") or "").strip().upper()
            d = (
                _clean_date_iso(b3_stats.get(tk_up, {}).get("last_dt"))
                or _clean_date_iso(r.get("data_ultimo_negocio"))
                or _clean_date_iso(r.get("data_anbima"))
                or _clean_date_iso(r.get("data_emissao"))
            )
            if d:
                dates.append(d)
        lastmod = max(dates) if dates else datetime.now().strftime("%Y-%m-%d")

        b["slug"] = sl
        b["lastmod"] = lastmod
        issuers_meta.append(b)
        issuer_slug_by_canon[b["canon_key"]] = sl
        for rn in b["raw_names"]:
            issuer_slug_by_raw[rn] = sl
        for c14 in b["cnpjs"]:
            issuer_slug_by_cnpj[c14] = sl

    today_str = datetime.now().strftime("%Y-%m-%d")
    hub_urls = [
        {"loc": f"{BASE_URL}/debentures/", "lastmod": today_str, "changefreq": "daily", "priority": "0.9"},
        {"loc": f"{BASE_URL}/debentures-incentivadas/", "lastmod": today_str, "changefreq": "daily", "priority": "0.9"},
        {"loc": f"{BASE_URL}/cri/", "lastmod": today_str, "changefreq": "daily", "priority": "0.9"},
        {"loc": f"{BASE_URL}/cra/", "lastmod": today_str, "changefreq": "daily", "priority": "0.9"},
        {"loc": f"{BASE_URL}/setores/", "lastmod": today_str, "changefreq": "weekly", "priority": "0.8"},
        {"loc": f"{BASE_URL}/emissores/", "lastmod": today_str, "changefreq": "daily", "priority": "0.85"},
    ]
    for sm in sectors_meta:
        hub_urls.append({
            "loc": f"{BASE_URL}/setores/{sm['slug']}/",
            "lastmod": sm["lastmod"],
            "changefreq": "daily",
            "priority": "0.85",
        })
    for im in issuers_meta:
        hub_urls.append({
            "loc": f"{BASE_URL}/emissor/{im['slug']}/",
            "lastmod": im["lastmod"],
            "changefreq": "daily",
            "priority": "0.85",
        })

    manifest = {
        "generated_at": today_str,
        "hub_urls": hub_urls,
        "sector_slugs": sector_slugs,
        "issuer_slugs": {im["slug"]: {"name": im["name"], "lastmod": im["lastmod"]} for im in issuers_meta},
    }

    registry = {
        "active_df": active_df,
        "sector_slugs": sector_slugs,
        "sectors_meta": sectors_meta,
        "issuers_meta": issuers_meta,
        "issuer_slug_by_canon": issuer_slug_by_canon,
        "issuer_slug_by_raw": issuer_slug_by_raw,
        "issuer_slug_by_cnpj": issuer_slug_by_cnpj,
    }
    return registry, manifest


def write_hub_manifest(manifest: dict):
    txt = json.dumps(manifest, ensure_ascii=False, indent=2)
    for dest in ("public/data/seo_hubs_manifest.json", "docs/data/seo_hubs_manifest.json"):
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        with open(dest, "w", encoding="utf-8") as f:
            f.write(txt)


def _render_pure_static_shell(
    title: str,
    description: str,
    keywords: str,
    canonical_url: str,
    schema_obj: dict,
    body_main_html: str,
    extra_script: str = "",
) -> str:
    schema_json = json.dumps(schema_obj, ensure_ascii=False)
    return f"""<!DOCTYPE html>
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

    <title>{esc(title)}</title>
    <meta name="title" content="{esc(title)}" />
    <meta name="description" content="{esc(description)}" />
    <meta name="keywords" content="{esc(keywords)}" />
    <meta name="robots" content="index, follow" />
    <meta name="msvalidate.01" content="129a651889904b9ab04b2df8015f64f7" />
    <link rel="canonical" href="{esc(canonical_url)}" />
    <link rel="alternate" type="application/rss+xml" title="FIXDATA — Feed RSS de Mercado Secundário" href="{BASE_URL}/feed.xml" />

    <meta property="og:type" content="website" />
    <meta property="og:url" content="{esc(canonical_url)}" />
    <meta property="og:title" content="{esc(title)}" />
    <meta property="og:description" content="{esc(description)}" />
    <meta property="og:site_name" content="FIXDATA" />
    <meta property="og:image" content="{BASE_URL}/icon-512x512.png" />

    <meta property="twitter:card" content="summary_large_image" />
    <meta property="twitter:url" content="{esc(canonical_url)}" />
    <meta property="twitter:title" content="{esc(title)}" />
    <meta property="twitter:description" content="{esc(description)}" />
    <meta property="twitter:image" content="{BASE_URL}/icon-512x512.png" />

    <script type="application/ld+json">
{schema_json}
    </script>
{GOOGLE_NEWS_SWG_SNIPPET}
    <link rel="stylesheet" href="/index.css" />
  </head>
  <body class="bg-slate-50 text-slate-800 antialiased min-h-screen font-sans">
    <div id="root">
{shared_navbar_html()}
{body_main_html}
{shared_footer_html()}
    </div>
{extra_script}
  </body>
</html>"""


TABLE_FILTER_SCRIPT = """    <script>
      (function () {
        var inp = document.getElementById('hub-search');
        var tbody = document.getElementById('hub-table-body');
        if (!inp || !tbody) return;
        inp.addEventListener('input', function () {
          var q = (inp.value || '').trim().toLowerCase();
          var rows = tbody.querySelectorAll('tr[data-search]');
          for (var i = 0; i < rows.length; i++) {
            var hay = rows[i].getAttribute('data-search') || '';
            rows[i].style.display = !q || hay.indexOf(q) !== -1 ? '' : 'none';
          }
        });
      })();
    </script>"""


def _write_dual_html(rel_path_dir: str, html_str: str):
    for base_dir in ("public", "docs"):
        target = os.path.join(base_dir, rel_path_dir) if rel_path_dir else base_dir
        os.makedirs(target, exist_ok=True)
        with open(os.path.join(target, "index.html"), "w", encoding="utf-8") as f:
            f.write(html_str)


def _asset_sort_tuple(r: dict, b3_stats: dict) -> tuple:
    tk = str(r.get("ticker") or "").strip().upper()
    b3_info = b3_stats.get(tk, {})
    vol_b3 = max(safe_float(r.get("volume_negociado_b3"), 0.0), b3_info.get("vol", 0.0))
    has_anb = 1 if (pd.notna(r.get("taxa_indicativa_anbima")) and str(r.get("taxa_indicativa_anbima")).strip() not in ("", "nan", "None")) else 0
    vol_em = safe_float(r.get("volume") or r.get("volume_emissao"), 0.0)
    return (1 if vol_b3 > 0 else 0, vol_b3, has_anb, vol_em)


def _build_asset_table_rows(rows: list, b3_stats: dict, format_currency_fn, normalize_rating_fn, limit: int = 150) -> str:
    sorted_rows = sorted(rows, key=lambda r: _asset_sort_tuple(r, b3_stats), reverse=True)[:limit]
    html_rows = []
    for r in sorted_rows:
        tk = str(r.get("ticker") or "").strip()
        tipo = str(r.get("tipo") or "Título").strip()
        iss = str(r.get("issuer") or "Emissor Privado").strip()
        taxa_str = fmt_taxa_short(r)
        vcto = fmt_br_date(str(r.get("vencimento") or ""))
        rating = normalize_rating_fn(str(r.get("rating_normalizado") or r.get("rating") or "")) or "S/R"
        vol_em = safe_float(r.get("volume") or r.get("volume_emissao"), 0.0)
        vol_fmt = format_currency_fn(vol_em) if vol_em > 0 else "-"
        tk_up = tk.upper()
        b3_vol = max(safe_float(r.get("volume_negociado_b3"), 0.0), b3_stats.get(tk_up, {}).get("vol", 0.0))
        b3_fmt = format_currency_fn(b3_vol) if b3_vol > 0 else "-"
        search_key = esc(f"{tk} {iss} {tipo} {r.get('indexador') or ''} {rating} {r.get('setor') or ''}".lower())
        badge_cls = "bg-blue-100 text-blue-800" if "deb" in tipo.lower() else ("bg-violet-100 text-violet-800" if tipo.upper() == "CRI" else "bg-emerald-100 text-emerald-800")
        html_rows.append(
            f'<tr data-search="{search_key}" class="border-b border-slate-100 hover:bg-slate-50/80 transition-colors">'
            f'<td class="py-2.5 px-3 font-mono font-black text-xs sm:text-sm whitespace-nowrap">'
            f'<a href="/asset/{esc(tk.lower())}/" class="text-blue-600 hover:text-blue-800 hover:underline">{esc(tk)}</a></td>'
            f'<td class="py-2.5 px-3 whitespace-nowrap"><span class="px-2 py-0.5 rounded-full text-[11px] font-bold {badge_cls}">{esc(tipo)}</span></td>'
            f'<td class="py-2.5 px-3 text-xs font-medium text-slate-700 max-w-[220px] truncate" title="{esc(iss)}">{esc(iss)}</td>'
            f'<td class="py-2.5 px-3 font-mono text-xs font-bold text-slate-900 whitespace-nowrap">{esc(taxa_str)}</td>'
            f'<td class="py-2.5 px-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{esc(rating)}</td>'
            f'<td class="py-2.5 px-3 text-xs text-slate-600 whitespace-nowrap">{esc(vcto)}</td>'
            f'<td class="py-2.5 px-3 text-right font-mono text-xs text-slate-700 whitespace-nowrap">{esc(vol_fmt)}</td>'
            f'<td class="py-2.5 px-3 text-right font-mono text-xs font-semibold text-blue-700 whitespace-nowrap">{esc(b3_fmt)}</td>'
            f'</tr>'
        )
    return "\n".join(html_rows)


def render_category_hubs(active_df: pd.DataFrame, b3_stats: dict, format_currency_fn, normalize_rating_fn, is_valid_ticker_fn):
    print("🏛️ Gerando hubs de categoria (/debentures/, /debentures-incentivadas/, /cri/, /cra/)...", flush=True)
    all_rows = [r.to_dict() for _, r in active_df.iterrows() if is_valid_ticker_fn(str(r.get("ticker") or ""))]

    categories = [
        {
            "slug": "debentures",
            "name": "Debêntures Ativas",
            "title": "Debêntures Ativas — Taxas Indicativas ANBIMA, Spreads e Negócios B3 | FIXDATA",
            "desc": "Catálogo completo de debêntures corporativas vigentes no Brasil com taxas ANBIMA, spread sobre NTN-B, rating, duration e liquidez no mercado secundário B3.",
            "kw": "debêntures ativas, taxas debêntures, mercado secundário debêntures, spread ntn-b, b3 debêntures, anbima",
            "badge": "Renda Fixa Corporativa",
            "rows": [r for r in all_rows if "deb" in str(r.get("tipo") or "").lower()],
            "extra_cta": '<a href="/debentures-incentivadas/" class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition">Ver Apenas Incentivadas (Lei 12.431) →</a>',
        },
        {
            "slug": "debentures-incentivadas",
            "name": "Debêntures Incentivadas (Lei 12.431/11)",
            "title": "Debêntures Incentivadas (Lei 12.431) — Isentas de IR com Taxas e Spreads | FIXDATA",
            "desc": "Lista atualizada de debêntures incentivadas isentas de Imposto de Renda para pessoa física (Lei 12.431/11), com taxas IPCA+, spreads sobre NTN-B e equivalente CDB.",
            "kw": "debêntures incentivadas, lei 12431, debêntures isentas ir, ipca mais, infraestrutura renda fixa",
            "badge": "Isenção Fiscal • Lei 12.431/11",
            "rows": [
                r for r in all_rows
                if "deb" in str(r.get("tipo") or "").lower()
                and str(r.get("incentivada") or "").strip().lower() in ("sim", "true", "1")
            ],
            "extra_cta": '<a href="/calculadora/" class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition">Simular Equivalência CDB (Gross-up) →</a>',
        },
        {
            "slug": "cri",
            "name": "CRIs Ativos (Certificados de Recebíveis Imobiliários)",
            "title": "CRIs Ativos — Taxas, Devedores Imobiliários e Negócios B3 | FIXDATA",
            "desc": "Consulte CRIs vigentes no mercado brasileiro com taxas de emissão e secundário, devedores lastro, securitizadoras, ratings e vencimentos no FIXDATA.",
            "kw": "cri renda fixa, certificados de recebíveis imobiliários, taxas cri, cri isento ir, mercado secundário cri",
            "badge": "Lastro Imobiliário • Isento de IR PF",
            "rows": [r for r in all_rows if str(r.get("tipo") or "").strip().upper() == "CRI"],
            "extra_cta": '<a href="/calculadora/" class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition">Calcular Gross-up Isento →</a>',
        },
        {
            "slug": "cra",
            "name": "CRAs Ativos (Certificados de Recebíveis do Agronegócio)",
            "title": "CRAs Ativos — Taxas, Devedores do Agro e Mercado Secundário B3 | FIXDATA",
            "desc": "Explore CRAs ativos emitidos no Brasil com taxas indicativas ANBIMA, indexadores IPCA/CDI, spreads, ratings e agenda de pagamentos no FIXDATA.",
            "kw": "cra renda fixa, certificados de recebíveis do agronegócio, taxas cra, cra isento ir, agronegócio crédito privado",
            "badge": "Agronegócio • Isento de IR PF",
            "rows": [r for r in all_rows if str(r.get("tipo") or "").strip().upper() == "CRA"],
            "extra_cta": '<a href="/calculadora/" class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition">Calcular Gross-up Isento →</a>',
        },
    ]

    today_br = datetime.now().strftime("%d/%m/%Y")
    for cat in categories:
        rows = cat["rows"]
        total_cnt = len(rows)
        total_vol = sum(safe_float(r.get("volume") or r.get("volume_emissao"), 0.0) for r in rows)
        liq_cnt = sum(
            1 for r in rows
            if max(safe_float(r.get("volume_negociado_b3"), 0.0), b3_stats.get(str(r.get("ticker") or "").strip().upper(), {}).get("vol", 0.0)) > 0
            or (pd.notna(r.get("taxa_indicativa_anbima")) and str(r.get("taxa_indicativa_anbima")).strip() not in ("", "nan", "None"))
        )
        ipca_cnt = sum(1 for r in rows if "IPCA" in str(r.get("indexador") or "").upper())
        sorted_top = sorted(rows, key=lambda r: _asset_sort_tuple(r, b3_stats), reverse=True)
        top_tks = [str(r.get("ticker") or "").strip() for r in sorted_top[:3] if r.get("ticker")]

        table_rows_html = _build_asset_table_rows(rows, b3_stats, format_currency_fn, normalize_rating_fn, limit=150)
        summary_p = (
            f"Em {today_br}, o FIXDATA monitora {fmt_int(total_cnt)} títulos vigentes na categoria {cat['name']}, "
            f"somando volume emitido de {format_currency_fn(total_vol)}. Desse total, {fmt_int(liq_cnt)} papéis possuem "
            f"negociação registrada no mercado secundário B3 ou precificação indicativa ANBIMA, e {fmt_int(ipca_cnt)} são "
            f"indexados ao IPCA."
        )
        if top_tks:
            summary_p += f" Entre os ativos de maior destaque em liquidez estão {', '.join(top_tks)}."

        body_html = f"""
      <main class="container mx-auto px-4 py-8 space-y-8 max-w-6xl">
        <div class="text-xs sm:text-sm text-slate-500 flex items-center gap-1.5">
          <a href="/" class="hover:underline">Início</a> &gt;
          <span class="text-slate-800 font-bold">{esc(cat['name'])}</span>
        </div>

        <section class="relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 rounded-3xl p-7 md:p-10 text-white shadow-xl border border-slate-800 space-y-4">
          <div class="inline-flex items-center px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 text-xs font-semibold uppercase tracking-wider">
            {esc(cat['badge'])}
          </div>
          <h1 class="text-2xl sm:text-4xl font-black tracking-tight">{esc(cat['name'])}</h1>
          <p class="text-slate-300 text-sm sm:text-base max-w-3xl leading-relaxed">{esc(summary_p)}</p>
          <div class="flex flex-wrap items-center gap-3 pt-1">
            {cat['extra_cta']}
            <a href="/emissores/" class="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/15 transition">Explorar Top 500 Emissores →</a>
            <a href="/setores/" class="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/15 transition">Explorar por Setor ANBIMA →</a>
          </div>
        </section>

        <section class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <span class="text-[11px] font-bold text-slate-400 uppercase">Ativos Vigentes</span>
            <p class="text-2xl font-black text-slate-900 mt-0.5">{fmt_int(total_cnt)}</p>
          </div>
          <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <span class="text-[11px] font-bold text-slate-400 uppercase">Com Liquidez B3/ANBIMA</span>
            <p class="text-2xl font-black text-blue-600 mt-0.5">{fmt_int(liq_cnt)}</p>
          </div>
          <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <span class="text-[11px] font-bold text-slate-400 uppercase">Volume Emitido</span>
            <p class="text-2xl font-black text-emerald-600 mt-0.5">{esc(format_currency_fn(total_vol))}</p>
          </div>
          <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <span class="text-[11px] font-bold text-slate-400 uppercase">Indexados ao IPCA</span>
            <p class="text-2xl font-black text-indigo-600 mt-0.5">{fmt_int(ipca_cnt)}</p>
          </div>
        </section>

        <section class="bg-white rounded-3xl border border-slate-200 p-5 sm:p-8 shadow-sm space-y-4">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 class="text-lg sm:text-xl font-black text-slate-900">Principais Títulos por Liquidez &amp; Volume (Top 150)</h2>
              <p class="text-xs text-slate-500">Ordenado por atividade no mercado secundário B3, precificação ANBIMA e volume emitido.</p>
            </div>
            <input id="hub-search" type="search" placeholder="Filtrar ticker, emissor ou rating..." class="w-full sm:w-72 px-3.5 py-2 text-xs rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="border-b border-slate-200 text-[11px] font-bold text-slate-400 uppercase">
                  <th class="py-2.5 px-3">Ticker</th>
                  <th class="py-2.5 px-3">Tipo</th>
                  <th class="py-2.5 px-3">Devedor / Emissor</th>
                  <th class="py-2.5 px-3">Taxa</th>
                  <th class="py-2.5 px-3">Rating</th>
                  <th class="py-2.5 px-3">Vencimento</th>
                  <th class="py-2.5 px-3 text-right">Estoque Emitido</th>
                  <th class="py-2.5 px-3 text-right">Vol. B3</th>
                </tr>
              </thead>
              <tbody id="hub-table-body" class="divide-y divide-slate-100">
                {table_rows_html}
              </tbody>
            </table>
          </div>
        </section>
      </main>"""

        schema = {
            "@context": "https://schema.org",
            "@graph": [
                {
                    "@type": "BreadcrumbList",
                    "itemListElement": [
                        {"@type": "ListItem", "position": 1, "name": "FIXDATA", "item": f"{BASE_URL}/"},
                        {"@type": "ListItem", "position": 2, "name": cat["name"], "item": f"{BASE_URL}/{cat['slug']}/"},
                    ],
                },
                {
                    "@type": "CollectionPage",
                    "name": cat["name"],
                    "description": cat["desc"],
                    "url": f"{BASE_URL}/{cat['slug']}/",
                    "numberOfItems": total_cnt,
                },
            ],
        }
        html_out = _render_pure_static_shell(
            cat["title"], cat["desc"], cat["kw"], f"{BASE_URL}/{cat['slug']}/", schema, body_html, TABLE_FILTER_SCRIPT
        )
        _write_dual_html(cat["slug"], html_out)
    print(f"   ✅ 4 hubs de categoria gerados.", flush=True)


def render_sector_hubs(registry: dict, b3_stats: dict, format_currency_fn, normalize_rating_fn):
    sectors_meta = registry["sectors_meta"]
    iss_by_raw = registry["issuer_slug_by_raw"]
    print(f"🏭 Gerando diretório /setores/ e {len(sectors_meta)} páginas setoriais...", flush=True)

    # Prune stale sectors
    valid_sec_slugs = {sm["slug"] for sm in sectors_meta}
    for base in ("public/setores", "docs/setores"):
        if os.path.exists(base):
            for entry in os.listdir(base):
                fp = os.path.join(base, entry)
                if os.path.isdir(fp) and entry not in valid_sec_slugs:
                    shutil.rmtree(fp, ignore_errors=True)

    dir_cards = []
    for sm in sectors_meta:
        sec_name = sm["name"]
        sec_slug = sm["slug"]
        rows = sm["rows"]
        total_cnt = len(rows)
        total_vol = sum(safe_float(r.get("volume") or r.get("volume_emissao"), 0.0) for r in rows)

        # Top emissores deste setor que possuem página pública
        sec_iss_map = {}
        for r in rows:
            iss_raw = str(r.get("issuer") or "").strip()
            iss_sl = iss_by_raw.get(iss_raw.lower())
            if iss_sl:
                sec_iss_map.setdefault(iss_sl, {"name": iss_raw, "slug": iss_sl, "count": 0})
                sec_iss_map[iss_sl]["count"] += 1
        top_sec_iss = sorted(sec_iss_map.values(), key=lambda x: x["count"], reverse=True)[:12]
        iss_pills = "".join(
            f'<a href="/emissor/{esc(it["slug"])}/" class="px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-xs font-bold text-slate-700 hover:text-blue-700 transition">{esc(it["name"])} <span class="text-slate-400 font-normal">({it["count"]})</span></a>'
            for it in top_sec_iss
        )
        iss_block = f"""
        <section class="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-3">
          <h2 class="text-base sm:text-lg font-black text-slate-900">Principais Companhias Emissoras no Setor</h2>
          <div class="flex flex-wrap gap-2">{iss_pills}</div>
        </section>""" if top_sec_iss else ""

        table_rows_html = _build_asset_table_rows(rows, b3_stats, format_currency_fn, normalize_rating_fn, limit=120)
        sec_title = f"Crédito Privado: {sec_name} — Debêntures, CRIs e CRAs | FIXDATA"
        sec_desc = f"Consulte {total_cnt} títulos vigentes do setor {sec_name} (Debêntures, CRIs e CRAs) com taxas, ratings, vencimentos e negociações B3 no FIXDATA."

        body_html = f"""
      <main class="container mx-auto px-4 py-8 space-y-8 max-w-6xl">
        <div class="text-xs sm:text-sm text-slate-500 flex items-center gap-1.5 flex-wrap">
          <a href="/" class="hover:underline">Início</a> &gt;
          <a href="/setores/" class="hover:underline">Setores ANBIMA</a> &gt;
          <span class="text-slate-800 font-bold">{esc(sec_name)}</span>
        </div>

        <section class="bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 rounded-3xl p-7 md:p-10 text-white shadow-xl border border-slate-800 space-y-4">
          <span class="inline-flex items-center px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 text-xs font-semibold uppercase tracking-wider">Setor Econômico ANBIMA</span>
          <h1 class="text-2xl sm:text-4xl font-black tracking-tight">{esc(sec_name)}</h1>
          <p class="text-slate-300 text-sm sm:text-base max-w-3xl leading-relaxed">
            O setor <strong>{esc(sec_name)}</strong> conta com <strong>{fmt_int(total_cnt)} títulos ativos</strong> monitorados pelo FIXDATA, somando volume emitido de <strong>{esc(format_currency_fn(total_vol))}</strong> em Debêntures, CRIs e CRAs.
          </p>
        </section>

        {iss_block}

        <section class="bg-white rounded-3xl border border-slate-200 p-5 sm:p-8 shadow-sm space-y-4">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <h2 class="text-lg sm:text-xl font-black text-slate-900">Títulos Ativos em {esc(sec_name)}</h2>
            <input id="hub-search" type="search" placeholder="Filtrar ticker ou emissor..." class="w-full sm:w-72 px-3.5 py-2 text-xs rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="border-b border-slate-200 text-[11px] font-bold text-slate-400 uppercase">
                  <th class="py-2.5 px-3">Ticker</th>
                  <th class="py-2.5 px-3">Tipo</th>
                  <th class="py-2.5 px-3">Devedor / Emissor</th>
                  <th class="py-2.5 px-3">Taxa</th>
                  <th class="py-2.5 px-3">Rating</th>
                  <th class="py-2.5 px-3">Vencimento</th>
                  <th class="py-2.5 px-3 text-right">Estoque Emitido</th>
                  <th class="py-2.5 px-3 text-right">Vol. B3</th>
                </tr>
              </thead>
              <tbody id="hub-table-body" class="divide-y divide-slate-100">
                {table_rows_html}
              </tbody>
            </table>
          </div>
        </section>
      </main>"""

        schema = {
            "@context": "https://schema.org",
            "@graph": [
                {
                    "@type": "BreadcrumbList",
                    "itemListElement": [
                        {"@type": "ListItem", "position": 1, "name": "FIXDATA", "item": f"{BASE_URL}/"},
                        {"@type": "ListItem", "position": 2, "name": "Setores ANBIMA", "item": f"{BASE_URL}/setores/"},
                        {"@type": "ListItem", "position": 3, "name": sec_name, "item": f"{BASE_URL}/setores/{sec_slug}/"},
                    ],
                },
                {
                    "@type": "CollectionPage",
                    "name": f"Setor {sec_name} — Crédito Privado",
                    "description": sec_desc,
                    "url": f"{BASE_URL}/setores/{sec_slug}/",
                    "numberOfItems": total_cnt,
                },
            ],
        }
        sec_html = _render_pure_static_shell(
            sec_title,
            sec_desc,
            f"{sec_name}, debêntures {sec_name}, crédito privado, renda fixa, FIXDATA",
            f"{BASE_URL}/setores/{sec_slug}/",
            schema,
            body_html,
            TABLE_FILTER_SCRIPT,
        )
        _write_dual_html(os.path.join("setores", sec_slug), sec_html)

        dir_cards.append(
            f'<a href="/setores/{esc(sec_slug)}/" class="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-blue-400 hover:shadow-md transition flex flex-col justify-between gap-2 group">'
            f'<div><span class="text-[10px] font-bold text-indigo-600 uppercase">Setor ANBIMA</span>'
            f'<h2 class="text-base font-black text-slate-900 group-hover:text-blue-600 mt-0.5">{esc(sec_name)}</h2></div>'
            f'<div class="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">'
            f'<span><strong class="text-slate-900">{fmt_int(total_cnt)}</strong> títulos ativos</span>'
            f'<span class="font-mono font-bold text-emerald-700">{esc(format_currency_fn(total_vol))}</span>'
            f'</div></a>'
        )

    dir_body = f"""
      <main class="container mx-auto px-4 py-8 space-y-8 max-w-6xl">
        <div class="text-xs sm:text-sm text-slate-500 flex items-center gap-1.5">
          <a href="/" class="hover:underline">Início</a> &gt;
          <span class="text-slate-800 font-bold">Setores ANBIMA</span>
        </div>
        <section class="bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 rounded-3xl p-7 md:p-10 text-white shadow-xl border border-slate-800 space-y-3">
          <span class="inline-flex items-center px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 text-xs font-semibold uppercase tracking-wider">Taxonomia Oficial ANBIMA</span>
          <h1 class="text-2xl sm:text-4xl font-black tracking-tight">Setores Econômicos de Crédito Privado</h1>
          <p class="text-slate-300 text-sm sm:text-base max-w-3xl">Explore Debêntures, CRIs e CRAs vigentes agrupados pelos setores econômicos oficiais da ANBIMA.</p>
        </section>
        <section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {"".join(dir_cards)}
        </section>
      </main>"""
    dir_schema = {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "name": "Setores Econômicos de Crédito Privado — FIXDATA",
        "url": f"{BASE_URL}/setores/",
    }
    dir_html = _render_pure_static_shell(
        "Setores Econômicos de Crédito Privado (ANBIMA) | FIXDATA",
        "Explore debêntures, CRIs e CRAs ativos divididos pelos principais setores econômicos da ANBIMA no Brasil.",
        "setores credito privado, debentures energia eletrica, saneamento, agropecuaria, transporte, anbima",
        f"{BASE_URL}/setores/",
        dir_schema,
        dir_body,
    )
    _write_dual_html("setores", dir_html)
    print(f"   ✅ /setores/ e {len(sectors_meta)} hubs setoriais gerados.", flush=True)


def _conservative_rating(rows: list, normalize_rating_fn) -> str:
    worst_score = None
    worst_label = "Sem Rating"
    for r in rows:
        rn = normalize_rating_fn(str(r.get("rating_normalizado") or r.get("rating") or ""))
        if rn and rn in RATING_SCORE_MAP:
            sc = RATING_SCORE_MAP[rn]
            if worst_score is None or sc < worst_score:
                worst_score = sc
                worst_label = rn
    return worst_label


def render_issuer_hubs(registry: dict, b3_stats: dict, format_currency_fn, normalize_rating_fn):
    issuers_meta = registry["issuers_meta"]
    sector_slugs = registry["sector_slugs"]
    print(f"🏢 Gerando diretório /emissores/ e {len(issuers_meta)} páginas públicas de emissores...", flush=True)

    valid_iss_slugs = {im["slug"] for im in issuers_meta}
    for base in ("public/emissor", "docs/emissor"):
        if os.path.exists(base):
            for entry in os.listdir(base):
                fp = os.path.join(base, entry)
                if os.path.isdir(fp) and entry not in valid_iss_slugs:
                    shutil.rmtree(fp, ignore_errors=True)

    def _build_one_issuer(im: dict):
        name = im["name"]
        sl = im["slug"]
        rows = im["rows"]
        em_info = im.get("emitter_info") or {}
        raiox_cnpj = im.get("raiox_cnpj")

        cnpj_fmt = (em_info.get("cnpj_formatado") or "").strip()
        if not cnpj_fmt and im.get("cnpjs"):
            c14 = next(iter(im["cnpjs"]))
            cnpj_fmt = f"{c14[:2]}.{c14[2:5]}.{c14[5:8]}/{c14[8:12]}-{c14[12:]}"
        if not cnpj_fmt:
            cnpj_fmt = "-"

        setor_name = (em_info.get("setor") or "").strip()
        if not setor_name or setor_name.lower() in ("nan", "none", "-"):
            sec_counts = {}
            for r in rows:
                s = str(r.get("setor") or "").strip()
                if s and s.lower() not in EXCLUDED_SECTORS:
                    sec_counts[s] = sec_counts.get(s, 0) + 1
            setor_name = max(sec_counts, key=sec_counts.get) if sec_counts else "Crédito Privado"

        sec_sl = sector_slugs.get(setor_name)
        setor_html = f'<a href="/setores/{esc(sec_sl)}/" class="text-blue-600 hover:underline font-semibold">{esc(setor_name)}</a>' if sec_sl else f'<strong class="text-slate-800">{esc(setor_name)}</strong>'

        cvm_sit = (em_info.get("situacao_cvm") or "Registrado / Ativo").strip()
        sede = f"{em_info.get('municipio') or ''} / {em_info.get('uf') or ''}".strip(" /") or "Brasil"
        site_ri = (em_info.get("site_ri") or "").strip()
        if site_ri.lower() in ("nan", "none", "-"):
            site_ri = ""

        deb_cnt = sum(1 for r in rows if "deb" in str(r.get("tipo") or "").lower())
        cri_cnt = sum(1 for r in rows if str(r.get("tipo") or "").strip().upper() == "CRI")
        cra_cnt = sum(1 for r in rows if str(r.get("tipo") or "").strip().upper() == "CRA")
        cons_rating = _conservative_rating(rows, normalize_rating_fn)
        total_em_vol = im["emissao_vol"]
        total_b3_vol = im["b3_vol"]

        indexers = {}
        for r in rows:
            idx = str(r.get("indexador") or "Outros").strip()
            if idx.lower() in ("nan", "none", ""):
                idx = "Outros"
            indexers[idx] = indexers.get(idx, 0) + 1
        idx_summary = ", ".join(f"{k} ({v})" for k, v in sorted(indexers.items(), key=lambda x: x[1], reverse=True)[:4])

        # CTA Lead-Gen para o Raio-X (SEM expor balanços, EBITDA, Altman Z'', ICR ou Dívida Líquida)
        raiox_href = f"/raiox-devedor/?cnpj={esc(raiox_cnpj)}" if raiox_cnpj else "/raiox-devedor/"
        ri_btn = f'<a href="{esc(site_ri)}" target="_blank" rel="noopener noreferrer" class="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/15 transition">Portal de RI Oficial ↗</a>' if site_ri else ""

        table_rows_html = _build_asset_table_rows(rows, b3_stats, format_currency_fn, normalize_rating_fn, limit=150)

        parts_cnt = []
        if deb_cnt:
            parts_cnt.append(f"{deb_cnt} Debênture(s)")
        if cri_cnt:
            parts_cnt.append(f"{cri_cnt} CRI(s)")
        if cra_cnt:
            parts_cnt.append(f"{cra_cnt} CRA(s)")
        instr_str = ", ".join(parts_cnt) or f"{len(rows)} título(s)"

        title = f"{name} — Debêntures, CRIs, CRAs, Taxas e Rating | FIXDATA"
        desc = (
            f"Consulte os {len(rows)} títulos de crédito privado ativos de {name}"
            f"{f' (CNPJ {cnpj_fmt})' if cnpj_fmt != '-' else ''}: {instr_str}, volume emitido de "
            f"{format_currency_fn(total_em_vol)}, rating conservador {cons_rating} e cotações B3/ANBIMA no FIXDATA."
        )
        kw = f"{name}, debêntures {name}, cri {name}, cra {name}, renda fixa, taxas, rating {cons_rating}, FIXDATA"

        body_html = f"""
      <main class="container mx-auto px-4 py-8 space-y-8 max-w-6xl">
        <div class="text-xs sm:text-sm text-slate-500 flex items-center gap-1.5 flex-wrap">
          <a href="/" class="hover:underline">Início</a> &gt;
          <a href="/emissores/" class="hover:underline">Emissores</a> &gt;
          <span class="text-slate-800 font-bold">{esc(name)}</span>
        </div>

        <section class="bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 rounded-3xl p-7 md:p-10 text-white shadow-xl border border-slate-800 space-y-4">
          <div class="flex flex-wrap items-center gap-2">
            <span class="inline-flex items-center px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 text-xs font-semibold uppercase tracking-wider">Emissor / Devedor Corporativo</span>
            <span class="inline-flex items-center px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-xs font-bold">Rating Vigente: {esc(cons_rating)}</span>
          </div>
          <h1 class="text-2xl sm:text-4xl font-black tracking-tight">{esc(name)}</h1>
          <p class="text-slate-300 text-sm sm:text-base max-w-3xl leading-relaxed">
            <strong>{esc(name)}</strong>{f' (CNPJ {esc(cnpj_fmt)})' if cnpj_fmt != '-' else ''} possui <strong>{len(rows)} título(s) de dívida ativa</strong> mapeado(s) no FIXDATA ({esc(instr_str)}), totalizando <strong>{esc(format_currency_fn(total_em_vol))}</strong> em estoque emitido. Indexadores predominantes: {esc(idx_summary)}.
          </p>
          <div class="flex flex-wrap items-center gap-3 pt-1">
            <a href="{raiox_href}" class="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-extrabold shadow-md transition">
              Abrir Raio-X de Solvência CVM (Gratuito) →
            </a>
            {ri_btn}
          </div>
        </section>

        <section class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <span class="text-[11px] font-bold text-slate-400 uppercase block">CNPJ</span>
            <p class="text-sm sm:text-base font-mono font-bold text-slate-900 mt-1">{esc(cnpj_fmt)}</p>
          </div>
          <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <span class="text-[11px] font-bold text-slate-400 uppercase block">Setor Econômico</span>
            <p class="text-sm sm:text-base mt-1">{setor_html}</p>
          </div>
          <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <span class="text-[11px] font-bold text-slate-400 uppercase block">Títulos Ativos / Rating</span>
            <p class="text-sm sm:text-base font-black text-slate-900 mt-1">{len(rows)} papéis • <span class="text-emerald-700">{esc(cons_rating)}</span></p>
          </div>
          <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <span class="text-[11px] font-bold text-slate-400 uppercase block">Volume Emitido / CVM</span>
            <p class="text-sm sm:text-base font-black text-blue-700 mt-1">{esc(format_currency_fn(total_em_vol))}</p>
            <span class="text-[11px] text-slate-500">{esc(cvm_sit)} • {esc(sede)}</span>
          </div>
        </section>

        <section class="bg-white rounded-3xl border border-slate-200 p-5 sm:p-8 shadow-sm space-y-4">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 class="text-lg sm:text-xl font-black text-slate-900">Títulos Ativos de {esc(name)}</h2>
              <p class="text-xs text-slate-500">Clique em qualquer ticker para ver taxas indicativas ANBIMA, spread NTN-B, histórico B3 e cronograma de pagamentos.</p>
            </div>
            <input id="hub-search" type="search" placeholder="Filtrar ticker ou indexador..." class="w-full sm:w-64 px-3.5 py-2 text-xs rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="border-b border-slate-200 text-[11px] font-bold text-slate-400 uppercase">
                  <th class="py-2.5 px-3">Ticker</th>
                  <th class="py-2.5 px-3">Tipo</th>
                  <th class="py-2.5 px-3">Devedor / Emissor</th>
                  <th class="py-2.5 px-3">Taxa</th>
                  <th class="py-2.5 px-3">Rating</th>
                  <th class="py-2.5 px-3">Vencimento</th>
                  <th class="py-2.5 px-3 text-right">Estoque Emitido</th>
                  <th class="py-2.5 px-3 text-right">Vol. B3</th>
                </tr>
              </thead>
              <tbody id="hub-table-body" class="divide-y divide-slate-100">
                {table_rows_html}
              </tbody>
            </table>
          </div>
        </section>

        <!-- Lead-Gen CTA para o Raio-X (sem expor indicadores contábeis gateados) -->
        <section class="bg-gradient-to-r from-blue-50 via-indigo-50 to-slate-50 border border-blue-200 rounded-3xl p-6 sm:p-8 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div class="space-y-2 max-w-2xl">
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase bg-blue-600 text-white">Análise Fundamentalista CVM • 100% Gratuita</span>
            <h2 class="text-xl sm:text-2xl font-black text-slate-900">Quer analisar a solvência e o balanço de {esc(name)}?</h2>
            <p class="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Acesse o <strong>Raio-X do Devedor</strong> para consultar demonstrativos DFP/ITR da CVM, Dívida Líquida/EBITDA, Índice de Cobertura de Juros (ICR), modelo Altman Z'' e evolução histórica de ratings. Desbloqueio imediato e gratuito com sua conta Google.
            </p>
          </div>
          <a href="{raiox_href}" class="shrink-0 inline-flex items-center gap-2 px-5 py-3.5 rounded-2xl bg-slate-900 hover:bg-blue-700 text-white text-xs sm:text-sm font-black shadow-md transition">
            <span>Desbloquear Raio-X do Devedor →</span>
          </a>
        </section>
      </main>"""

        schema = {
            "@context": "https://schema.org",
            "@graph": [
                {
                    "@type": "BreadcrumbList",
                    "itemListElement": [
                        {"@type": "ListItem", "position": 1, "name": "FIXDATA", "item": f"{BASE_URL}/"},
                        {"@type": "ListItem", "position": 2, "name": "Emissores", "item": f"{BASE_URL}/emissores/"},
                        {"@type": "ListItem", "position": 3, "name": name, "item": f"{BASE_URL}/emissor/{sl}/"},
                    ],
                },
                {
                    "@type": "Organization",
                    "name": name,
                    "url": f"{BASE_URL}/emissor/{sl}/",
                    **({"taxID": cnpj_fmt} if cnpj_fmt != "-" else {}),
                },
            ],
        }
        iss_html = _render_pure_static_shell(
            title, desc, kw, f"{BASE_URL}/emissor/{sl}/", schema, body_html, TABLE_FILTER_SCRIPT
        )
        _write_dual_html(os.path.join("emissor", sl), iss_html)

        return (
            f'<tr data-search="{esc(name.lower())} {esc(setor_name.lower())} {esc(cons_rating.lower())}" class="border-b border-slate-100 hover:bg-slate-50/80 transition">'
            f'<td class="py-2.5 px-3 font-bold text-xs sm:text-sm"><a href="/emissor/{esc(sl)}/" class="text-blue-600 hover:underline">{esc(name)}</a></td>'
            f'<td class="py-2.5 px-3 text-xs text-slate-600">{esc(setor_name)}</td>'
            f'<td class="py-2.5 px-3 text-xs font-bold text-slate-800 text-center">{len(rows)}</td>'
            f'<td class="py-2.5 px-3 text-xs font-bold text-emerald-700 text-center">{esc(cons_rating)}</td>'
            f'<td class="py-2.5 px-3 text-xs font-mono font-semibold text-slate-800 text-right">{esc(format_currency_fn(total_em_vol))}</td>'
            f'<td class="py-2.5 px-3 text-xs font-mono font-bold text-blue-700 text-right">{esc(format_currency_fn(total_b3_vol)) if total_b3_vol > 0 else "-"}</td>'
            f'</tr>'
        )

    with ThreadPoolExecutor(max_workers=12) as ex:
        dir_rows = list(ex.map(_build_one_issuer, issuers_meta))

    dir_body = f"""
      <main class="container mx-auto px-4 py-8 space-y-8 max-w-6xl">
        <div class="text-xs sm:text-sm text-slate-500 flex items-center gap-1.5">
          <a href="/" class="hover:underline">Início</a> &gt;
          <span class="text-slate-800 font-bold">Emissores</span>
        </div>
        <section class="bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 rounded-3xl p-7 md:p-10 text-white shadow-xl border border-slate-800 space-y-3">
          <span class="inline-flex items-center px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 text-xs font-semibold uppercase tracking-wider">Diretório Corporativo</span>
          <h1 class="text-2xl sm:text-4xl font-black tracking-tight">Top {len(issuers_meta)} Emissores de Crédito Privado</h1>
          <p class="text-slate-300 text-sm sm:text-base max-w-3xl">Companhias emissoras e devedoras com títulos ativos (Debêntures, CRIs e CRAs) no mercado brasileiro, ordenadas por liquidez secundária e emissões.</p>
        </section>
        <section class="bg-white rounded-3xl border border-slate-200 p-5 sm:p-8 shadow-sm space-y-4">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <h2 class="text-lg sm:text-xl font-black text-slate-900">Catálogo de Emissores Ativos</h2>
            <input id="hub-search" type="search" placeholder="Buscar empresa, setor ou rating..." class="w-full sm:w-72 px-3.5 py-2 text-xs rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="border-b border-slate-200 text-[11px] font-bold text-slate-400 uppercase">
                  <th class="py-2.5 px-3">Emissor / Devedor</th>
                  <th class="py-2.5 px-3">Setor ANBIMA</th>
                  <th class="py-2.5 px-3 text-center">Ativos</th>
                  <th class="py-2.5 px-3 text-center">Rating</th>
                  <th class="py-2.5 px-3 text-right">Estoque Emitido</th>
                  <th class="py-2.5 px-3 text-right">Vol. B3</th>
                </tr>
              </thead>
              <tbody id="hub-table-body" class="divide-y divide-slate-100">
                {"".join(dir_rows)}
              </tbody>
            </table>
          </div>
        </section>
      </main>"""

    dir_schema = {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "name": f"Diretório de Emissores de Crédito Privado — FIXDATA",
        "url": f"{BASE_URL}/emissores/",
        "numberOfItems": len(issuers_meta),
    }
    dir_html = _render_pure_static_shell(
        "Emissores de Debêntures, CRIs e CRAs no Brasil | FIXDATA",
        f"Diretório público dos {len(issuers_meta)} principais emissores corporativos de crédito privado ativos no Brasil com títulos, taxas e ratings.",
        "emissores debentures, devedores cri cra, empresas renda fixa brasil, rating emissores",
        f"{BASE_URL}/emissores/",
        dir_schema,
        dir_body,
        TABLE_FILTER_SCRIPT,
    )
    _write_dual_html("emissores", dir_html)
    print(f"   ✅ /emissores/ e {len(issuers_meta)} páginas de emissores geradas.", flush=True)


def render_all_hub_pages(registry: dict, b3_stats: dict, format_currency_fn, normalize_rating_fn, is_valid_ticker_fn):
    render_category_hubs(registry["active_df"], b3_stats, format_currency_fn, normalize_rating_fn, is_valid_ticker_fn)
    render_sector_hubs(registry, b3_stats, format_currency_fn, normalize_rating_fn)
    render_issuer_hubs(registry, b3_stats, format_currency_fn, normalize_rating_fn)


def build_rich_static_page_body(slug: str, df_active_count: int, format_currency_fn) -> tuple[str, str]:
    """
    Gera corpo HTML rico dentro de #root e script JSON-LD opcional para cada uma das 13 rotas React.
    Rotas gateadas (raiox-devedor, charts, ntnb) mantêm landing pública honesta + CTA de login Google gratuito.
    """
    extra_ld = ""

    if slug == "negocios":
        kpis = {}
        try:
            with open("public/data/b3_market_kpis.json", "r", encoding="utf-8") as f:
                kpis = json.load(f)
        except Exception:
            pass
        ult = kpis.get("ultimo_pregao", {})
        dt_dia = ult.get("data", "-")
        vol_dia = format_currency_fn(ult.get("volume_financeiro", 0))
        trades_dia = f"{int(ult.get('total_trades', 0)):,}".replace(",", ".")
        ativos_dia = f"{int(ult.get('ativos_negociados', 0)):,}".replace(",", ".")

        rows_html = []
        if os.path.exists("public/data/b3_trades_recent.csv"):
            try:
                df_rec = pd.read_csv("public/data/b3_trades_recent.csv")
                top_df = df_rec.sort_values(by="volume_financeiro", ascending=False).head(40)
                for _, r in top_df.iterrows():
                    tk = str(r.get("ticker") or "").strip()
                    if not tk:
                        continue
                    tp = str(r.get("tipo") or "Título").strip()
                    dev = str(r.get("devedor") or "-").strip()
                    tx = safe_float(r.get("taxa_media_ponderada"), float("nan"))
                    tx_str = f"{tx:.2f}%" if not pd.isna(tx) else "-"
                    pu = safe_float(r.get("preco_medio_ponderado"), 0.0)
                    pu_str = f"R$ {pu:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".") if pu > 0 else "-"
                    vol = format_currency_fn(r.get("volume_financeiro", 0))
                    dt = str(r.get("data_negocio") or "")[:10]
                    rows_html.append(
                        f'<tr class="border-b border-slate-100 text-xs">'
                        f'<td class="py-2.5 px-3 font-mono font-bold"><a href="/asset/{esc(tk.lower())}/" class="text-blue-600 hover:underline">{esc(tk)}</a></td>'
                        f'<td class="py-2.5 px-3">{esc(tp)}</td>'
                        f'<td class="py-2.5 px-3 truncate max-w-[200px]">{esc(dev)}</td>'
                        f'<td class="py-2.5 px-3 text-right font-mono font-bold">{esc(tx_str)}</td>'
                        f'<td class="py-2.5 px-3 text-right font-mono">{esc(pu_str)}</td>'
                        f'<td class="py-2.5 px-3 text-right font-mono font-bold text-slate-900">{esc(vol)}</td>'
                        f'<td class="py-2.5 px-3 text-right text-slate-500">{esc(fmt_br_date(dt))}</td>'
                        f'</tr>'
                    )
            except Exception:
                pass

        body = f"""
      <main class="container mx-auto px-4 py-8 space-y-8 max-w-6xl">
        <div class="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-4">
          <h1 class="text-2xl sm:text-3xl font-black text-slate-900">Negócios B3 — Mercado Secundário de Crédito Privado</h1>
          <p class="text-sm sm:text-base text-slate-600 leading-relaxed">
            No último pregão consolidado ({esc(fmt_br_date(dt_dia))}), o mercado secundário da B3 registrou <strong>{esc(vol_dia)}</strong> em volume financeiro através de <strong>{esc(trades_dia)} negócios</strong> distribuídos em <strong>{esc(ativos_dia)} títulos</strong> de Debêntures, CRIs e CRAs.
          </p>
          <div class="overflow-x-auto pt-2">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="border-b border-slate-200 text-[11px] font-bold text-slate-400 uppercase">
                  <th class="py-2 px-3">Ticker</th><th class="py-2 px-3">Tipo</th><th class="py-2 px-3">Devedor</th>
                  <th class="py-2 px-3 text-right">Taxa VWAP</th><th class="py-2 px-3 text-right">PU Médio</th>
                  <th class="py-2 px-3 text-right">Volume</th><th class="py-2 px-3 text-right">Data</th>
                </tr>
              </thead>
              <tbody>{"".join(rows_html)}</tbody>
            </table>
          </div>
        </div>
      </main>"""
        return body, extra_ld

    if slug == "agenda":
        today_iso = datetime.now().strftime("%Y-%m-%d")
        ev_rows = []
        if os.path.exists("public/data/payment_schedules.csv"):
            try:
                upcoming = []
                with open("public/data/payment_schedules.csv", "r", encoding="utf-8", errors="ignore") as f:
                    for r in csv.DictReader(f):
                        dt = str(r.get("data_evento") or "")[:10]
                        if dt >= today_iso and str(r.get("status") or "").strip() == "Previsto":
                            upcoming.append(r)
                upcoming.sort(key=lambda x: x.get("data_evento", ""))
                for r in upcoming[:40]:
                    tk = str(r.get("ticker") or "").strip()
                    if not tk:
                        continue
                    ev_rows.append(
                        f'<tr class="border-b border-slate-100 text-xs">'
                        f'<td class="py-2 px-3 font-semibold">{esc(fmt_br_date(r.get("data_evento", "")))}</td>'
                        f'<td class="py-2 px-3 font-mono font-bold"><a href="/asset/{esc(tk.lower())}/" class="text-blue-600 hover:underline">{esc(tk)}</a></td>'
                        f'<td class="py-2 px-3">{esc(r.get("tipo_evento") or "Pagamento")}</td>'
                        f'<td class="py-2 px-3 text-slate-500">{esc(r.get("fonte") or "Cronograma")}</td>'
                        f'</tr>'
                    )
            except Exception:
                pass
        body = f"""
      <main class="container mx-auto px-4 py-8 space-y-6 max-w-5xl">
        <div class="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-4">
          <h1 class="text-2xl sm:text-3xl font-black text-slate-900">Agenda de Pagamentos Futuros de Crédito Privado</h1>
          <p class="text-sm sm:text-base text-slate-600">Cronograma contratual dos próximos pagamentos de juros, amortizações e vencimentos de Debêntures, CRIs e CRAs mapeados pelo FIXDATA.</p>
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
              <thead><tr class="border-b border-slate-200 text-[11px] font-bold text-slate-400 uppercase"><th class="py-2 px-3">Data</th><th class="py-2 px-3">Ticker</th><th class="py-2 px-3">Evento</th><th class="py-2 px-3">Fonte</th></tr></thead>
              <tbody>{"".join(ev_rows)}</tbody>
            </table>
          </div>
        </div>
      </main>"""
        return body, extra_ld

    if slug == "primary":
        mp = {}
        try:
            with open("public/data/mercado_primario.json", "r", encoding="utf-8") as f:
                mp = json.load(f)
        except Exception:
            pass
        res = mp.get("resumo", {})
        ofertas = (mp.get("ofertas_em_andamento") or [])[:15] + (mp.get("ofertas_recentes") or [])[:15]
        of_rows = []
        for of in ofertas[:25]:
            em = str(of.get("nome_devedor_real") or of.get("nome_emissor") or "-").strip()
            tp = str(of.get("tipo_ativo") or "-").strip()
            st = str(of.get("status_oferta") or "-").strip()
            val = format_currency_fn(of.get("valor_total_reais") or 0)
            dt = fmt_br_date(str(of.get("data_processo") or ""))
            of_rows.append(
                f'<tr class="border-b border-slate-100 text-xs">'
                f'<td class="py-2 px-3 font-bold text-slate-900">{esc(em)}</td>'
                f'<td class="py-2 px-3">{esc(tp)}</td>'
                f'<td class="py-2 px-3">{esc(st)}</td>'
                f'<td class="py-2 px-3 text-right font-mono font-bold">{esc(val)}</td>'
                f'<td class="py-2 px-3 text-right text-slate-500">{esc(dt)}</td>'
                f'</tr>'
            )
        body = f"""
      <main class="container mx-auto px-4 py-8 space-y-6 max-w-6xl">
        <div class="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-4">
          <h1 class="text-2xl sm:text-3xl font-black text-slate-900">Mercado Primário — Ofertas Públicas CVM 160</h1>
          <p class="text-sm sm:text-base text-slate-600">
            Pipeline consolidado com <strong>{esc(res.get('total_ofertas_ano', 0))} ofertas</strong> no ano ({esc(res.get('volume_total_ano_bi', 0))} Bi) e <strong>{esc(res.get('total_em_andamento', 0))} emissões em andamento</strong> ({esc(res.get('volume_em_andamento_bi', 0))} Bi) de Debêntures, CRIs e CRAs na CVM.
          </p>
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
              <thead><tr class="border-b border-slate-200 text-[11px] font-bold text-slate-400 uppercase"><th class="py-2 px-3">Emissor / Devedor</th><th class="py-2 px-3">Tipo</th><th class="py-2 px-3">Status</th><th class="py-2 px-3 text-right">Volume</th><th class="py-2 px-3 text-right">Data</th></tr></thead>
              <tbody>{"".join(of_rows)}</tbody>
            </table>
          </div>
        </div>
      </main>"""
        return body, extra_ld

    if slug == "calculadora":
        sample_rates = [5.5, 6.0, 6.5, 7.0, 7.5, 8.0]
        eq_rows = []
        for r_isento in sample_rates:
            r_dec = r_isento / 100.0
            cells = "".join(
                f'<td class="py-2 px-3 text-right font-mono font-bold text-blue-700">{((r_dec / (1.0 - ir)) * 100):.2f}%</td>'
                for ir in (0.225, 0.20, 0.175, 0.15)
            )
            eq_rows.append(
                f'<tr class="border-b border-slate-100 text-xs">'
                f'<td class="py-2 px-3 font-mono font-black text-emerald-700">IPCA + {r_isento:.2f}% (Isento)</td>{cells}</tr>'
            )
        faq_schema = {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": [
                {
                    "@type": "Question",
                    "name": "Como calcular a taxa equivalente (gross-up) de uma debênture incentivada, CRI ou CRA isento de IR?",
                    "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "Divide-se a taxa líquida do título isento (Lei 12.431/11) por (1 - alíquota de IR do título tributado comparável: 22,5% até 180 dias, 20% de 181 a 360 dias, 17,5% de 361 a 720 dias e 15% acima de 720 dias)."
                    },
                },
                {
                    "@type": "Question",
                    "name": "Qual a diferença entre taxa de emissão e taxa indicativa ANBIMA no mercado secundário?",
                    "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "A taxa de emissão é a remuneração contratada na escritura original; já a taxa indicativa ANBIMA reflete o juro anual implícito ao Preço Unitário (PU) negociado atualmente no mercado secundário."
                    },
                },
            ],
        }
        extra_ld = f'<script type="application/ld+json">\n{json.dumps(faq_schema, ensure_ascii=False)}\n    </script>'
        body = f"""
      <main class="container mx-auto px-4 py-8 space-y-6 max-w-5xl">
        <div class="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-5">
          <h1 class="text-2xl sm:text-3xl font-black text-slate-900">Calculadora de Gross-up e Equivalência de Renda Fixa</h1>
          <p class="text-sm sm:text-base text-slate-600 leading-relaxed">
            Compare taxas de títulos isentos de Imposto de Renda para Pessoa Física (<a href="/debentures-incentivadas/" class="text-blue-600 hover:underline font-semibold">Debêntures Incentivadas Lei 12.431</a>, <a href="/cri/" class="text-blue-600 hover:underline font-semibold">CRIs</a> e <a href="/cra/" class="text-blue-600 hover:underline font-semibold">CRAs</a>) contra CDBs, LCAs/tributados e debêntures comuns utilizando a fórmula <code>Taxa Tributada Equivalente = Taxa Isenta / (1 - Alíquota IR)</code> e marcação a mercado DU/252.
          </p>
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="border-b border-slate-200 text-[11px] font-bold text-slate-400 uppercase">
                  <th class="py-2 px-3">Taxa Isenta (CRI / CRA / Lei 12.431)</th>
                  <th class="py-2 px-3 text-right">Equiv. IR 22,5%</th>
                  <th class="py-2 px-3 text-right">Equiv. IR 20,0%</th>
                  <th class="py-2 px-3 text-right">Equiv. IR 17,5%</th>
                  <th class="py-2 px-3 text-right">Equiv. IR 15,0%</th>
                </tr>
              </thead>
              <tbody>{"".join(eq_rows)}</tbody>
            </table>
          </div>
        </div>
      </main>"""
        return body, extra_ld

    if slug == "sobre":
        about_ld = {
            "@context": "https://schema.org",
            "@graph": [
                {
                    "@type": "AboutPage",
                    "name": "Sobre o FIXDATA",
                    "url": f"{BASE_URL}/sobre/",
                },
                {
                    "@type": "Person",
                    "name": "Leonardo Contador Neves",
                    "url": "https://www.linkedin.com/in/leonardo-contador-neves-096312119/",
                    "jobTitle": "Engenharia de Dados & Modelagem Financeira",
                    "worksFor": {"@type": "Organization", "name": "FIXDATA", "url": f"{BASE_URL}/"},
                },
            ],
        }
        extra_ld = f'<script type="application/ld+json">\n{json.dumps(about_ld, ensure_ascii=False)}\n    </script>'
        body = f"""
      <main class="container mx-auto px-4 py-8 space-y-6 max-w-4xl">
        <article class="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-10 space-y-5">
          <h1 class="text-2xl sm:text-4xl font-black text-slate-900">Sobre o FIXDATA</h1>
          <p class="text-sm sm:text-base text-slate-600 leading-relaxed">
            O <strong>FIXDATA</strong> (fixdatabrasil.com.br) é uma infraestrutura analítica independente criada por <strong>Leonardo Contador Neves</strong> para democratizar dados de mercado secundário de <strong>Debêntures, CRIs e CRAs</strong> no Brasil ({fmt_int(df_active_count)} títulos vigentes monitorados).
          </p>
          <p class="text-sm sm:text-base text-slate-600 leading-relaxed">
            Todos os dias úteis após o fechamento do mercado, pipelines automatizados consolidam e higienizam bases oficiais da <strong>ANBIMA</strong>, <strong>B3</strong> e <strong>CVM</strong>, permitindo consulta gratuita a taxas indicativas, spreads sobre a curva NTN-B, agendas de pagamento e análise de solvência corporativa.
          </p>
          <div class="flex flex-wrap gap-3 pt-2">
            <a href="/metodologia/" class="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold">Ler Metodologia Completa →</a>
            <a href="/emissores/" class="px-4 py-2 rounded-xl bg-slate-100 text-slate-800 text-xs font-bold">Diretório de Emissores →</a>
          </div>
        </article>
      </main>"""
        return body, extra_ld

    if slug == "metodologia":
        body = """
      <main class="container mx-auto px-4 py-8 space-y-6 max-w-4xl">
        <article class="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-10 space-y-5">
          <h1 class="text-2xl sm:text-4xl font-black text-slate-900">Metodologia &amp; Governança Quantitativa</h1>
          <p class="text-sm sm:text-base text-slate-600 leading-relaxed">
            O FIXDATA consolida dados primários da <strong>ANBIMA</strong> (taxas indicativas, PU e curvas soberanas), <strong>B3</strong> (negócios secundários trade-by-trade higienizados de passagens 1&lt;-&gt;1 e 1&lt;-&gt;N) e <strong>CVM</strong> (demonstrativos DFP/ITR e ofertas CVM 160).
          </p>
          <h2 class="text-lg font-black text-slate-900">1. Convenção DU/252 e Duration Modificada</h2>
          <p class="text-sm text-slate-600 leading-relaxed">
            Todos os fluxos de juros e amortizações são descontados segundo o calendário oficial de Dias Úteis ANBIMA (base 252 dias úteis ao ano) para apuração da Duration Modificada e do PU Par patrimonial.
          </p>
          <h2 class="text-lg font-black text-slate-900">2. Spread sobre a Curva NTN-B (Mesma Partição)</h2>
          <p class="text-sm text-slate-600 leading-relaxed">
            O spread de crédito em títulos IPCA+ é apurado na mesma partição diária contra a NTN-B soberana de duration equivalente pela fórmula composta: <code>Spread = ((1 + Taxa_Ativo) / (1 + Taxa_NTNB)) - 1</code>.
          </p>
          <h2 class="text-lg font-black text-slate-900">3. Escala Unificada de Ratings &amp; Solvência</h2>
          <p class="text-sm text-slate-600 leading-relaxed">
            Notas da S&amp;P, Fitch e Moody's Local são normalizadas em escala nacional brasileira (AAA a D) com critério conservador pro-investidor. No Raio-X do Devedor são calculados Altman Z'', Índice de Cobertura de Juros (ICR) e alavancagem Dívida Líquida/EBITDA.
          </p>
        </article>
      </main>"""
        return body, extra_ld

    if slug in ("raiox-devedor", "charts", "ntnb"):
        # Páginas com LeadGate: manter landing pública honesta + CTA gratuito Google Login (sem clonar/vazar conteúdo restrito)
        cta_titles = {
            "raiox-devedor": (
                "Raio-X e Solvência do Devedor CVM",
                "Análise fundamentalista gratuita de mais de 800 companhias emissoras de crédito privado: demonstrativos DFP/ITR da CVM, alavancagem Dívida Líquida/EBITDA, Índice de Cobertura de Juros (ICR), modelo Altman Z'', evolução de rating e perfil de vencimentos.",
                "Desbloqueie gratuitamente com sua conta Google para consultar qualquer CNPJ ou companhia emissora.",
            ),
            "charts": (
                "Dashboard Analítico de Spreads e Mercado Secundário ANBIMA",
                "Visualizações quantitativas de dispersão de taxas e spreads sobre NTN-B por rating (AAA a High Yield), indexador (IPCA+, CDI+, %CDI) e setor econômico ANBIMA sobre milhares de papéis vigentes.",
                "Entre gratuitamente com sua conta Google para acessar todos os gráficos e filtros interativos.",
            ),
            "ntnb": (
                "Estrutura a Termo da Curva NTN-B e Prêmios de Crédito",
                "Acompanhe a evolução histórica da curva soberana de juros reais (Tesouro IPCA+ / NTN-B de 2027 a 2060), inclinação da curva e histórico de spreads de crédito corporativo.",
                "Faça login gratuito com o Google para desbloquear as séries históricas e vértices da NTN-B.",
            ),
        }
        h1_txt, desc_txt, cta_txt = cta_titles[slug]
        body = f"""
      <main class="container mx-auto px-4 py-8 space-y-6 max-w-4xl">
        <div class="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-10 space-y-5">
          <span class="inline-flex items-center px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-extrabold uppercase">100% Gratuito • Acesso Instantâneo com Google</span>
          <h1 class="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">{esc(h1_txt)}</h1>
          <p class="text-sm sm:text-base text-slate-600 leading-relaxed">{esc(desc_txt)}</p>
          <div class="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-700">
            <strong>Como acessar:</strong> {esc(cta_txt)}
          </div>
          <div class="flex flex-wrap gap-3 pt-2 text-xs font-bold">
            <a href="/emissores/" class="px-4 py-2 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100">Explorar Diretório Público de Emissores →</a>
            <a href="/debentures/" class="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200">Catálogo de Debêntures →</a>
            <a href="/negocios/" class="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200">Negócios B3 →</a>
          </div>
        </div>
      </main>"""
        return body, extra_ld

    if slug == "comparar":
        body = """
      <main class="container mx-auto px-4 py-8 space-y-6 max-w-4xl">
        <div class="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-10 space-y-4">
          <h1 class="text-2xl sm:text-3xl font-black text-slate-900">Comparador de Debêntures, CRIs e CRAs</h1>
          <p class="text-sm sm:text-base text-slate-600 leading-relaxed">
            Compare dois títulos de crédito privado lado a lado em taxa indicativa ANBIMA, spread sobre NTN-B, rating normalizado, duration modificada, isenção fiscal (Lei 12.431/11) e volume negociado na B3.
          </p>
          <div class="flex flex-wrap gap-3 text-xs font-bold pt-2">
            <a href="/debentures/" class="px-4 py-2 rounded-xl bg-blue-600 text-white">Escolher Debêntures para Comparar →</a>
            <a href="/cri/" class="px-4 py-2 rounded-xl bg-slate-100 text-slate-800">Explorar CRIs →</a>
            <a href="/cra/" class="px-4 py-2 rounded-xl bg-slate-100 text-slate-800">Explorar CRAs →</a>
          </div>
        </div>
      </main>"""
        return body, extra_ld

    # Fallback para termos, privacidade, contact
    titles_map = {
        "termos": ("Termos de Serviço &amp; Uso", "Condições gerais de utilização do FIXDATA, origem oficial dos dados (ANBIMA, B3, CVM) e aviso legal de que a plataforma possui caráter exclusivamente informativo e educacional, não constituindo recomendação de investimento."),
        "privacidade": ("Política de Privacidade &amp; LGPD", "Informações sobre conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018), telemetria anônima de navegação e autenticação voluntária via Google OAuth 2.0."),
        "contact": ("Contato, Parcerias &amp; Apoio ao Projeto", "Canal oficial para dúvidas técnicas, sugestões de melhoria, parcerias institucionais e apoio ao projeto independente FIXDATA, desenvolvido por Leonardo Contador Neves."),
    }
    h1_t, desc_t = titles_map.get(slug, ("FIXDATA", "Plataforma aberta de renda fixa e crédito privado brasileiro."))
    body = f"""
      <main class="container mx-auto px-4 py-8 space-y-6 max-w-4xl">
        <div class="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-10 space-y-4">
          <h1 class="text-2xl sm:text-3xl font-black text-slate-900">{h1_t}</h1>
          <p class="text-sm sm:text-base text-slate-600 leading-relaxed">{desc_t}</p>
          <div class="flex flex-wrap gap-3 text-xs font-bold pt-2">
            <a href="/sobre/" class="text-blue-600 hover:underline">Sobre o FIXDATA</a>
            <span>•</span>
            <a href="/metodologia/" class="text-blue-600 hover:underline">Metodologia</a>
            <span>•</span>
            <a href="/debentures/" class="text-blue-600 hover:underline">Debêntures Ativas</a>
          </div>
        </div>
      </main>"""
    return body, extra_ld
