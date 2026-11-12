export interface RaioXEntry {
  cnpj: string;
  razao_social: string;
  nome_fantasia?: string;
  isSec: boolean;
}

export interface RaioXIndex {
  byCnpj14: Map<string, RaioXEntry>;
  byCnpj8: Map<string, RaioXEntry>;
  byName: Map<string, RaioXEntry>;
  byNorm: Map<string, RaioXEntry>;
}

const SECURITIZADORA_TERMS = [
  'securitizadora', 'securitizacao', 'securitização', 'securitzadora',
  'virgo', 'opea', 'true sec', 'habitasec', 'fortesec', 'cibrasec',
  'bari sec', 'octante', 'brazilian securities', 'b.sec', 'ecoagro',
  'eco. sec', 'eco sec', 'riza sec', 'canalsec', 'planeta sec', 'ceres sec'
];

export const isSecuritizadoraName = (name?: string | null, setor?: string | null): boolean => {
  const s = `${name || ''} ${setor || ''}`.toLowerCase();
  return SECURITIZADORA_TERMS.some((t) => s.includes(t));
};

export const normCompanyKey = (val?: string | null): string => {
  if (!val) return '';
  let s = String(val).toUpperCase().trim();
  s = s.replace(/\s*-\s*EM\s+(RECUPERA[CÇ][AÃ]O\s+JUDICIAL|LIQUIDA[CÇ][AÃ]O.*)$/i, '');
  s = s.replace(/\bEM\s+RECUPERA[CÇ][AÃ]O\s+JUDICIAL\b/gi, '');
  s = s.replace(/[.,\-/()]/g, ' ');
  s = s.replace(/\b(S\s+A|S\/A|SA|LTDA|CIA|COMPANHIA)\b/g, ' ');
  return s.replace(/\s+/g, ' ').trim().toLowerCase();
};

export const cleanCnpj14 = (val?: string | null): string => {
  if (!val) return '';
  const digits = String(val).replace(/\D/g, '');
  if (!digits) return '';
  const padded = digits.length >= 11 && digits.length < 14 ? digits.padStart(14, '0') : digits;
  return padded.length === 14 ? padded : '';
};

let cachedIndex: RaioXIndex | null = null;
let inflightPromise: Promise<RaioXIndex> | null = null;

export const getCachedRaioXIndex = (): RaioXIndex | null => cachedIndex;

export const loadRaioXIndex = async (): Promise<RaioXIndex> => {
  if (cachedIndex) return cachedIndex;
  if (inflightPromise) return inflightPromise;

  inflightPromise = (async () => {
    const empty: RaioXIndex = {
      byCnpj14: new Map(),
      byCnpj8: new Map(),
      byName: new Map(),
      byNorm: new Map()
    };
    try {
      const resp = await fetch('/data/devedores_resumo.json');
      if (!resp.ok) return empty;
      const rawText = await resp.text();
      const safeText = rawText.replace(/:\s*NaN\b/g, ': null').replace(/:\s*Infinity\b/g, ': null');
      const data = JSON.parse(safeText);
      const devs: any[] = data?.devedores || [];

      for (const d of devs) {
        const c14 = cleanCnpj14(d.cnpj);
        if (!c14) continue;
        const rs = String(d.razao_social || '').trim();
        const nf = String(d.nome_fantasia || '').trim();
        const setor = String(d.setor || '').trim();
        const isSec = isSecuritizadoraName(rs, setor);

        const entry: RaioXEntry = {
          cnpj: c14,
          razao_social: rs,
          nome_fantasia: nf,
          isSec
        };

        empty.byCnpj14.set(c14, entry);
        if (!isSec && !empty.byCnpj8.has(c14.slice(0, 8))) {
          empty.byCnpj8.set(c14.slice(0, 8), entry);
        }
        if (rs) {
          empty.byName.set(rs.toLowerCase(), entry);
          const nk = normCompanyKey(rs);
          if (nk) empty.byNorm.set(nk, entry);
        }
        if (nf && !['nan', 'none', ''].includes(nf.toLowerCase())) {
          empty.byName.set(nf.toLowerCase(), entry);
          const nkNf = normCompanyKey(nf);
          if (nkNf && !empty.byNorm.has(nkNf)) {
            empty.byNorm.set(nkNf, entry);
          }
        }
      }
      cachedIndex = empty;
      return empty;
    } catch {
      return empty;
    } finally {
      inflightPromise = null;
    }
  })();

  return inflightPromise;
};

export const resolveRaioXCnpj = (
  index: RaioXIndex | null,
  params: {
    issuer?: string | null;
    cnpj?: string | null;
    emitterCnpj?: string | null;
    tipo?: string | null;
  }
): string | null => {
  if (!index) return null;
  const issClean = (params.issuer || '').trim();
  const issLow = issClean.toLowerCase();
  if (
    !issClean ||
    issLow.includes('pulverizad') ||
    ['nan', 'none', '-', 'emissor privado', 'não informado'].includes(issLow)
  ) {
    return null;
  }

  const isCriCra = ['CRI', 'CRA'].includes(String(params.tipo || '').trim().toUpperCase());
  const issIsSec = isSecuritizadoraName(issClean);

  // 1. Tenta pelo nome exato ou normalizado do emissor/devedor
  const byExact = index.byName.get(issLow);
  if (byExact && (!byExact.isSec || issIsSec)) {
    return byExact.cnpj;
  }
  const nk = normCompanyKey(issClean);
  if (nk) {
    const byNorm = index.byNorm.get(nk);
    if (byNorm && (!byNorm.isSec || issIsSec)) {
      return byNorm.cnpj;
    }
  }

  // 2. Tenta pelo CNPJ (14 dígitos ou raiz de 8 dígitos)
  for (const rawC of [params.cnpj, params.emitterCnpj]) {
    const c14 = cleanCnpj14(rawC);
    if (!c14) continue;
    const m14 = index.byCnpj14.get(c14);
    if (m14) {
      if (isCriCra && m14.isSec && !issIsSec) continue;
      return m14.cnpj;
    }
    const m8 = index.byCnpj8.get(c14.slice(0, 8));
    if (m8) {
      if (isCriCra && m8.isSec && !issIsSec) continue;
      return m8.cnpj;
    }
  }

  return null;
};
