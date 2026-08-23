
import Papa from 'papaparse';

export interface Asset {
  ticker: string;
  tipo?: string;
  issuer?: string;
  pu?: string;
  volume?: string;
  indexador?: string;
  taxa_emissao?: string;
  rating?: string;
  rating_normalizado?: string;
  agencia?: string;
  divulgacao?: string;
  duration?: string;
  spread?: string;
  vencimento?: string;
  data_emissao?: string;
  emissao?: string;
  serie?: string;
  isin?: string;
  ntnb_referencia?: string;
  taxa_ntnb?: string;
  taxa_ativo?: string;
  fonte_precificacao?: string;
  asset_type?: string;
  series?: string;
  seniority?: string;
  guarantee?: string;
  issue_date?: string;
  dt_emissao?: string;
  issuer_cnpj?: string;
  sector?: string;
}

export interface SpreadHistoryRecord {
  date: string;
  indexador: string;
  spread_mediano_bps: string;
  spread_medio_bps: string;
  taxa_media: string;
  count: string;
}

export const RATING_SCALE_ORDER = [
  'AAA',
  'AA+',
  'AA',
  'AA-',
  'A+',
  'A',
  'A-',
  'BBB+',
  'BBB',
  'BBB-',
  'BB+',
  'BB',
  'BB-',
  'B+',
  'B',
  'B-',
  'CCC+',
  'CCC',
  'CCC-',
  'CC',
  'C',
  'D',
  'Sem Rating'
];

export const normalizeRating = (val?: string | null): string => {
  if (!val || typeof val !== 'string') return 'Sem Rating';
  let r = val.trim();
  if (['nan', 'none', 'n/a', '', '-'].includes(r.toLowerCase())) {
    return 'Sem Rating';
  }

  // Substituir hífens especiais
  r = r.replace(/[–—−]/g, '-');

  // Tratar ratings compostos como Ba2/Aa2.br -> pegar a escala nacional se existir
  if (r.includes('/')) {
    const parts = r.split('/');
    for (let i = parts.length - 1; i >= 0; i--) {
      const pNorm = normalizeRating(parts[i]);
      if (pNorm !== 'Sem Rating') return pNorm;
    }
  }

  // Tratar parênteses não fechados como AA+(bra
  if (r.includes('(') && !r.includes(')')) {
    r = r.replace(/\(.*/, '');
  }

  // Remover anotações entre parênteses: (P), (sf), (exp), (o.e.), (bra), (Bra), (br), etc.
  r = r.replace(/\s*\([^)]*\)/gi, '');

  // Remover prefixos nacionais: 'br.', 'Br.', 'br', 'Br'
  r = r.replace(/^(br\.|br|br\s+)/gi, '');

  // Tratar sufixos estruturados sf, exp, oe, sr
  r = r.replace(/(AAA|AA\+|AA-|AA|A\+|A-|A|BBB\+|BBB-|BBB|BB\+|BB-|BB|B\+|B-|B|CCC\+|CCC-|CCC|CC|C|D)\s*sf\b/gi, '$1');
  r = r.replace(/\b(sf|exp|oe|sr)\b/gi, '');
  r = r.replace(/SR$/gi, '');

  // Remover sufixos nacionais: '.br', '-br', '.BR', 'br'
  r = r.replace(/(\.br|-br|\s+br)$/gi, '');

  // Limpeza de pontuação e espaços
  r = r.replace(/^[.\s\-_]+|[.\s\-_]+$/g, '');

  const rUp = r.toUpperCase();

  // Mapeamento escala Moody's global / alfanumérica
  const moodysMap: Record<string, string> = {
    'AAA': 'AAA',
    'AA1': 'AA+',
    'AA2': 'AA',
    'AA3': 'AA-',
    'A1': 'A+',
    'A2': 'A',
    'A3': 'A-',
    'BAA1': 'BBB+',
    'BAA2': 'BBB',
    'BAA3': 'BBB-',
    'BA1': 'BB+',
    'BA2': 'BB',
    'BA3': 'BB-',
    'B1': 'B+',
    'B2': 'B',
    'B3': 'B-',
    'CAA1': 'CCC+',
    'CAA2': 'CCC',
    'CAA3': 'CCC-',
    'CA': 'CC',
    'C': 'C',
    'D': 'D'
  };

  if (moodysMap[rUp]) return moodysMap[rUp];

  // Regex padrão da escala Fitch / S&P
  const match = rUp.match(/^(AAA|AA\+|AA-|AA|A\+|A-|A|BBB\+|BBB-|BBB|BB\+|BB-|BB|B\+|B-|B|CCC\+|CCC-|CCC|CC|C|D)\b/);
  if (match) {
    return match[1];
  }

  return rUp || 'Sem Rating';
};

export const getRatingBadgeClass = (normRating: string): string => {
  if (['AAA', 'AA+', 'AA', 'AA-', 'A+', 'A', 'A-'].includes(normRating)) {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  }
  if (['BBB+', 'BBB', 'BBB-'].includes(normRating)) {
    return 'bg-blue-50 text-blue-700 border-blue-200';
  }
  if (['BB+', 'BB', 'BB-', 'B+', 'B', 'B-'].includes(normRating)) {
    return 'bg-amber-50 text-amber-700 border-amber-200';
  }
  if (['CCC+', 'CCC', 'CCC-', 'CC', 'C', 'D'].includes(normRating)) {
    return 'bg-rose-50 text-rose-700 border-rose-200';
  }
  return 'bg-slate-100 text-slate-600 border-slate-200';
};

export interface DocsOverview {
  tipo: string;
  qtd_documentos: string;
}

export interface PriceRecord {
  date: string;
  ticker: string;
  isin: string;
  price: string;
  clean_price: string;
  yield: string;
  ytm: string;
  spread_over_ref: string;
  volume_traded: string;
}

export interface NtnbRecord {
  date: string;
  data_vencimento: string;
  taxa_indicativa: string;
  taxa_compra?: string;
  taxa_venda?: string;
  pu: string;
  vencimento_iso: string;
  vertice_ano: string;
  titulo_nome: string;
}

export interface Emitter {
  cnpj: string;
  cnpj_formatado?: string;
  razao_social: string;
  nome_fantasia?: string;
  setor?: string;
  categoria_cvm?: string;
  situacao_cvm?: string;
  site_ri?: string;
  email?: string;
  municipio?: string;
  uf?: string;
  tipo_emissor?: string;
  descricao?: string;
}

export interface Metadata {
  last_update: string;
}

export const fetchCSV = <T,>(url: string): Promise<T[]> => {
  let normalizedUrl = url;
  if (normalizedUrl.startsWith('./data/')) {
    normalizedUrl = '/data/' + normalizedUrl.slice(7);
  } else if (normalizedUrl.startsWith('data/')) {
    normalizedUrl = '/data/' + normalizedUrl.slice(5);
  }

  return new Promise((resolve, reject) => {
    Papa.parse(normalizedUrl, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        resolve(results.data as T[]);
      },
      error: (error) => {
        reject(error);
      }
    });
  });
};

export const fetchMetadata = async (): Promise<Metadata | null> => {
  try {
    const response = await fetch('./data/_metadata.json');
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
};
