/**
 * Motor Matemático & Apreçamento Oficial ANBIMA / B3
 * Engenharia reversa e reprodução de alta fidelidade para:
 * - Debêntures (Incentivadas / Lei 12.431 e Ordinárias)
 * - CRIs e CRAs (Certificados de Recebíveis Imobiliários e do Agronegócio)
 * - Títulos Públicos e Renda Fixa Privada
 * 
 * Metodologia:
 * 1. Base de dias úteis com feriados nacionais do Brasil (Meeus/Butcher + Feriados Bancários B3/ANBIMA).
 * 2. Fluxo descontado por vértice: PV(CF_k) = CF_k / (1 + y)^(DU_k / 252).
 * 3. Preço Par (VNa atualizado com juros decorridos/accrued interest).
 * 4. PU Limpo (Clean Price) e PU Sujo (Gross Price).
 * 5. Duration de Macaulay (DU e Anos) e Duration Modificada (DV01 / sensibilidade).
 * 6. Resolução bidirecional: Taxa -> PU e PU -> Taxa (via Solver Numérico de Brent).
 */

import { Asset } from './csv';

export interface PaymentEventItem {
  ticker?: string;
  data_evento?: string;
  data_liquidacao?: string;
  tipo_evento?: string;
  taxa?: number | null;
  valor_real?: number | null;
  valor_projetado?: number | null;
  juros_expectativa?: number | null;
  percentual_amortizacao?: number | null;
  status?: string;
  fonte?: string;
}

export interface AnbimaCashFlowItem {
  nome: string;
  dataLiquidacao: string;
  prazoDu: number;
  diasEntrePagamentos: number;
  jurosExpectativa?: number;
  jurosProjetado: number;
  amortizacao: number;
  fluxoDescontado: number;
  valorFluxo: number;
}

/**
 * Curva oficial de expectativa CDI da ANBIMA por vértice de prazo em Dias Úteis
 */
export function getCdiExpectationRate(du: number): number {
  if (du <= 63) return 13.58;
  if (du <= 189) return 13.24;
  if (du <= 315) return 12.85;
  if (du <= 441) return 12.66;
  if (du <= 567) return 12.56;
  return 12.59;
}

export interface AnbimaPricingResult {
  elegivel: boolean;
  ineligibilityReason?: string;
  ticker: string;
  isin?: string;
  tipo?: string;
  devedor?: string;
  indexador?: string;
  dataOperacao: string;
  dataLiquidacao: string;
  quantidadeTitulos: number;
  tipoCalculo: 'Taxa' | 'PU';
  taxaOperacao: number;
  taxaEmissao: number;
  vna: number;
  pupar: number;
  puOperacao: number;
  puLimpo: number;
  jurosDecorridos: number;
  porcentagemPupar: number;
  agioDesagioPct: number;
  agioDesagioReais: number;
  durationDu: number;
  durationAnos: number;
  modifiedDuration: number;
  valorFinanceiro: number;
  vencimento?: string;
  fluxoPagamento: AnbimaCashFlowItem[];
}

export interface AnbimaPricingParams {
  asset: Asset | any;
  paymentEvents?: PaymentEventItem[];
  dataOperacao?: string;
  dataLiquidacao?: string;
  formaCalculo: 'Taxa' | 'PU';
  valor: number;
  quantidade?: number;
  /** Projeção mensal de IPCA (% a.m.) para atualizar o VNA da data ANBIMA até a liquidação */
  ipcaProjMensal?: number;
}

/* ================= 1. CALENDÁRIO NACIONAL & FERIADOS BANCÁRIOS (ANBIMA / B3) ================= */

function getEaster(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function formatDateISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addCalendarDays(d: Date, days: number): Date {
  const res = new Date(d.getTime());
  res.setUTCDate(res.getUTCDate() + days);
  return res;
}

function buildHolidaySet(startYear = 2015, endYear = 2101): Set<string> {
  const holidays = new Set<string>();
  for (let y = startYear; y <= endYear; y++) {
    // Feriados Fixos do Brasil
    holidays.add(`${y}-01-01`); // Confraternização Universal
    holidays.add(`${y}-04-21`); // Tiradentes
    holidays.add(`${y}-05-01`); // Dia do Trabalho
    holidays.add(`${y}-09-07`); // Independência
    holidays.add(`${y}-10-12`); // Nossa Senhora Aparecida
    holidays.add(`${y}-11-02`); // Finados
    holidays.add(`${y}-11-15`); // Proclamação da República
    holidays.add(`${y}-11-20`); // Dia da Consciência Negra (Lei Federal 14.759/2023)
    holidays.add(`${y}-12-25`); // Natal

    // Feriados Móveis baseados na Páscoa
    const easter = getEaster(y);
    holidays.add(formatDateISO(addCalendarDays(easter, -48))); // Carnaval Segunda
    holidays.add(formatDateISO(addCalendarDays(easter, -47))); // Carnaval Terça
    holidays.add(formatDateISO(addCalendarDays(easter, -2)));  // Sexta-feira Santa
    holidays.add(formatDateISO(addCalendarDays(easter, 60)));  // Corpus Christi
  }
  return holidays;
}

export const BR_HOLIDAYS_SET = buildHolidaySet(2015, 2101);

export function isHoliday(dateStr: string): boolean {
  return BR_HOLIDAYS_SET.has(dateStr);
}

// -------------------------------------------------------------
// Calendário Ultrarrápido O(1) Precomputado (2015 a 2101)
// -------------------------------------------------------------
const BASE_MS = Date.UTC(2015, 0, 1);
const MAX_CALENDAR_DAYS = 365 * 87; // 87 anos cobrindo até 2102 (~31.750 dias)
const BUS_DAYS_MAP = new Map<string, number>();
const ROLL_NEXT_MAP = new Map<string, string>();

(function initFastCalendar() {
  let curr = new Date(BASE_MS);
  let cumCount = 0;
  for (let d = 0; d < MAX_CALENDAR_DAYS; d++) {
    const iso = formatDateISO(curr);
    const dow = curr.getUTCDay();
    const isBus = (dow !== 0 && dow !== 6 && !BR_HOLIDAYS_SET.has(iso));
    if (isBus) cumCount++;
    BUS_DAYS_MAP.set(iso, cumCount);
    curr = addCalendarDays(curr, 1);
  }

  curr = new Date(BASE_MS);
  for (let d = 0; d < MAX_CALENDAR_DAYS - 30; d++) {
    const iso = formatDateISO(curr);
    let check = new Date(curr.getTime());
    let safety = 0;
    while (safety < 10) {
      const checkDow = check.getUTCDay();
      const checkIso = formatDateISO(check);
      if (checkDow !== 0 && checkDow !== 6 && !BR_HOLIDAYS_SET.has(checkIso)) {
        ROLL_NEXT_MAP.set(iso, checkIso);
        break;
      }
      check = addCalendarDays(check, 1);
      safety++;
    }
    curr = addCalendarDays(curr, 1);
  }
})();

export function isBusinessDay(dateStr: string): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr + 'T00:00:00Z');
  const dow = d.getUTCDay();
  return dow !== 0 && dow !== 6 && !BR_HOLIDAYS_SET.has(dateStr);
}

export function rollToNextBusinessDay(dateStr: string): string {
  if (!dateStr) return dateStr;
  const pre = ROLL_NEXT_MAP.get(dateStr);
  if (pre) return pre;
  let d = new Date(dateStr + 'T00:00:00Z');
  let safety = 0;
  while (safety < 10) {
    const dow = d.getUTCDay();
    const iso = formatDateISO(d);
    if (dow !== 0 && dow !== 6 && !BR_HOLIDAYS_SET.has(iso)) {
      return iso;
    }
    d = addCalendarDays(d, 1);
    safety++;
  }
  return dateStr;
}

export function countBusinessDays(startStr: string, endStr: string): number {
  if (!startStr || !endStr || startStr >= endStr) return 0;
  const c1 = BUS_DAYS_MAP.get(startStr);
  const c2 = BUS_DAYS_MAP.get(endStr);
  if (c1 !== undefined && c2 !== undefined) {
    return c2 - c1;
  }
  // Fallback analítico ultra-rápido para datas além do horizonte 2101
  const d1 = new Date(startStr + 'T00:00:00Z').getTime();
  const d2 = new Date(endStr + 'T00:00:00Z').getTime();
  const diffDays = Math.max(0, Math.round((d2 - d1) / 86400000));
  return Math.round(diffDays * (252.0 / 365.25));
}

export function addBusinessDays(startStr: string, nDays: number): string {
  if (!startStr) return startStr;
  if (nDays <= 0) return startStr;
  let curr = new Date(startStr + 'T00:00:00Z');
  let added = 0;
  let safety = 0;
  while (added < nDays && safety < nDays * 3) {
    curr = addCalendarDays(curr, 1);
    const dow = curr.getUTCDay();
    const iso = formatDateISO(curr);
    if (dow !== 0 && dow !== 6 && !BR_HOLIDAYS_SET.has(iso)) {
      added++;
    }
    safety++;
  }
  return formatDateISO(curr);
}

export function safeParseFloat(val: any, fallback = 0.0): number {
  if (val == null) return fallback;
  if (typeof val === 'number') return isNaN(val) ? fallback : val;
  const s = String(val).trim().replace(',', '.');
  const num = parseFloat(s);
  return isNaN(num) ? fallback : num;
}

/**
 * Data de hoje no fuso de Brasília (YYYY-MM-DD). Evita que após 21h a data "vire" para o dia seguinte (UTC).
 */
export function todayLocalIso(): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date());
  } catch {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}

/** Projeção mensal de IPCA padrão (% a.m.) usada quando não há projeção ANBIMA carregada. */
export const DEFAULT_IPCA_PROJ_MENSAL = 0.27;

function anniversaryIso(year: number, month0: number, day: number): string {
  const y = year + Math.floor(month0 / 12);
  const m0 = ((month0 % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();
  const dd = Math.min(day, lastDay);
  return `${y}-${String(m0 + 1).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

/**
 * Projeta o VNA de um título IPCA de dataBase até dataAlvo pela metodologia ANBIMA:
 *   VNA_alvo = VNA_base × Π (1 + IPCA_proj)^(dup / dut)
 * onde dut = dias úteis entre aniversários consecutivos e dup = dias úteis decorridos no segmento.
 * Calibração: VALEC1 20/10→21/10/2026 com 0,27% a.m. reproduz o VNA oficial (1055,7827 → 1055,9182).
 */
export function projectVnaIpca(
  vnaBase: number,
  dataBase: string,
  dataAlvo: string,
  ipcaProjMensalPct: number,
  diaAniversario: number
): number {
  if (!vnaBase || !dataBase || !dataAlvo || dataAlvo <= dataBase) return vnaBase;
  const p = ipcaProjMensalPct / 100.0;
  const dia = diaAniversario >= 1 && diaAniversario <= 31 ? diaAniversario : 15;
  let cur = dataBase;
  let fator = 1.0;
  let safety = 0;
  while (cur < dataAlvo && safety < 600) {
    safety++;
    const [cy, cm] = cur.split('-').map(Number);
    let a0 = rollToNextBusinessDay(anniversaryIso(cy, cm - 1, dia));
    let monthOffset = cm - 1;
    if (cur < a0) {
      monthOffset -= 1;
      a0 = rollToNextBusinessDay(anniversaryIso(cy, monthOffset, dia));
    }
    const a1 = rollToNextBusinessDay(anniversaryIso(cy, monthOffset + 1, dia));
    const dut = countBusinessDays(a0, a1) || 21;
    const segEnd = dataAlvo < a1 ? dataAlvo : a1;
    const dup = countBusinessDays(cur, segEnd);
    fator *= Math.pow(1.0 + p, dup / dut);
    if (segEnd <= cur) break;
    cur = segEnd;
  }
  return vnaBase * fator;
}

/* ================= 2. SOLVER NUMÉRICO DE BRENT (PU -> TAXA YTM) ================= */

export function solveTaxaPorPU(
  fluxos: { valorFluxo: number; prazoDu: number; jurosExpectativa?: number }[],
  puAlvo: number,
  tol = 1e-7,
  maxIter = 100,
  isDiSpread = false,
  isDiPercent = false
): number | null {
  if (puAlvo <= 0 || !fluxos || fluxos.length === 0) return null;

  // Se todos os fluxos tiverem prazoDu === 0 (liquidação no próprio vencimento), o PU é invariante à taxa (dPU/dy = 0)
  const maxDu = Math.max(...fluxos.map(f => f.prazoDu));
  if (maxDu <= 0) return null;

  const calcPU = (y: number): number => {
    if (y <= -0.99) return 1e12;
    let soma = 0.0;
    for (let k = 0; k < fluxos.length; k++) {
      const fl = fluxos[k];
      if (isDiSpread) {
        const rCdi = (fl.jurosExpectativa != null && fl.jurosExpectativa > 0)
          ? fl.jurosExpectativa / 100.0
          : getCdiExpectationRate(fl.prazoDu) / 100.0;
        const desc = Math.pow(1.0 + rCdi, fl.prazoDu / 252.0) * Math.pow(1.0 + y, fl.prazoDu / 252.0);
        soma += fl.valorFluxo / desc;
      } else if (isDiPercent) {
        const rCdi = (fl.jurosExpectativa != null && fl.jurosExpectativa > 0)
          ? fl.jurosExpectativa / 100.0
          : getCdiExpectationRate(fl.prazoDu) / 100.0;
        // y pode vir como 1.065 (decimal) ou 106.5 (percentual)
        const pctFactor = y > 10.0 ? y / 100.0 : y;
        const rEq = rCdi * pctFactor;
        const desc = Math.pow(1.0 + rEq, fl.prazoDu / 252.0);
        soma += fl.valorFluxo / desc;
      } else {
        soma += fl.valorFluxo / Math.pow(1.0 + y, fl.prazoDu / 252.0);
      }
    }
    return soma;
  };

  let a = -0.50;
  let b = 5.0;
  let fa = calcPU(a) - puAlvo;
  let fb = calcPU(b) - puAlvo;

  if (fa * fb > 0) {
    a = -0.80;
    b = 20.0;
    fa = calcPU(a) - puAlvo;
    fb = calcPU(b) - puAlvo;
    if (fa * fb > 0) return null;
  }

  if (Math.abs(fa) < Math.abs(fb)) {
    let tmp = a; a = b; b = tmp;
    tmp = fa; fa = fb; fb = tmp;
  }

  let c = a;
  let fc = fa;
  let mflag = true;
  let d = 0.0;

  for (let i = 0; i < maxIter; i++) {
    if (Math.abs(fb) < tol) {
      return b * 100.0;
    }

    let s: number;
    if (fa !== fc && fb !== fc) {
      s = (a * fb * fc) / ((fa - fb) * (fa - fc)) +
          (b * fa * fc) / ((fb - fa) * (fb - fc)) +
          (c * fa * fb) / ((fc - fa) * (fc - fb));
    } else {
      s = b - fb * (b - a) / (fb - fa);
    }

    const cond1 = !((3 * a + b) / 4 <= s && s <= b || b <= s && s <= (3 * a + b) / 4);
    const cond2 = mflag && Math.abs(s - b) >= Math.abs(b - c) / 2;
    const cond3 = !mflag && Math.abs(s - b) >= Math.abs(c - d) / 2;
    const cond4 = mflag && Math.abs(b - c) < tol;
    const cond5 = !mflag && Math.abs(c - d) < tol;

    if (cond1 || cond2 || cond3 || cond4 || cond5) {
      s = (a + b) / 2;
      mflag = true;
    } else {
      mflag = false;
    }

    const fs = calcPU(s) - puAlvo;
    d = c;
    c = b;
    fc = fb;

    if (fa * fs < 0) {
      b = s;
      fb = fs;
    } else {
      a = s;
      fa = fs;
    }

    if (Math.abs(fa) < Math.abs(fb)) {
      let tmp = a; a = b; b = tmp;
      tmp = fa; fa = fb; fb = tmp;
    }
  }

  return b * 100.0;
}

/* ================= 3. MOTOR CENTRAL DE APREÇAMENTO OFICIAL ================= */

export function calculateAnbimaPricing(params: AnbimaPricingParams): AnbimaPricingResult {
  const {
    asset,
    paymentEvents = [],
    dataOperacao = todayLocalIso(),
    dataLiquidacao = dataOperacao,
    formaCalculo = 'Taxa',
    valor,
    quantidade = 1,
    ipcaProjMensal = DEFAULT_IPCA_PROJ_MENSAL
  } = params;

  const ticker = (asset?.ticker || asset?.codigo_b3 || 'ATIVO').trim().toUpperCase();
  const dtVenc = asset?.vencimento || asset?.dt_vencimento || asset?.data_vencimento;

  // Trava de integridade metodológica: Vencimento ausente
  if (!dtVenc) {
    return {
      elegivel: false,
      ineligibilityReason: `Ativo '${ticker}' sem data de vencimento contratual informada. O cálculo de PU e Duration exige cronograma de liquidação definido.`,
      ticker,
      dataOperacao,
      dataLiquidacao,
      quantidadeTitulos: quantidade,
      tipoCalculo: formaCalculo,
      taxaOperacao: 0,
      taxaEmissao: 0,
      vna: 0,
      pupar: 0,
      puOperacao: 0,
      puLimpo: 0,
      jurosDecorridos: 0,
      porcentagemPupar: 0,
      agioDesagioPct: 0,
      agioDesagioReais: 0,
      durationDu: 0,
      durationAnos: 0,
      modifiedDuration: 0,
      valorFinanceiro: 0,
      fluxoPagamento: []
    };
  }

  // Trava de integridade metodológica ANBIMA/B3: Operação futura não permitida no mercado à vista
  const todayIso = todayLocalIso();
  if (dataOperacao > todayIso) {
    return {
      elegivel: false,
      ineligibilityReason: `A Data da Operação (${dataOperacao}) não pode ser futura. Por metodologia oficial da ANBIMA e B3, o apreçamento à vista é restrito até a data de hoje (${todayIso}). Para prazos futuros de liquidação física/financeira, utilize os modos D+1 ou D+2.`,
      ticker,
      vencimento: dtVenc,
      dataOperacao,
      dataLiquidacao,
      quantidadeTitulos: quantidade,
      tipoCalculo: formaCalculo,
      taxaOperacao: 0,
      taxaEmissao: 0,
      vna: 0,
      pupar: 0,
      puOperacao: 0,
      puLimpo: 0,
      jurosDecorridos: 0,
      porcentagemPupar: 0,
      agioDesagioPct: 0,
      agioDesagioReais: 0,
      durationDu: 0,
      durationAnos: 0,
      modifiedDuration: 0,
      valorFinanceiro: 0,
      fluxoPagamento: []
    };
  }

  if (dtVenc < dataLiquidacao) {
    return {
      elegivel: false,
      ineligibilityReason: `Ativo '${ticker}' já se encontra vencido em ${dtVenc} (data de liquidação solicitada: ${dataLiquidacao}). Não há fluxos futuros a serem precificados.`,
      ticker,
      vencimento: dtVenc,
      dataOperacao,
      dataLiquidacao,
      quantidadeTitulos: quantidade,
      tipoCalculo: formaCalculo,
      taxaOperacao: 0,
      taxaEmissao: 0,
      vna: 0,
      pupar: 0,
      puOperacao: 0,
      puLimpo: 0,
      jurosDecorridos: 0,
      porcentagemPupar: 0,
      agioDesagioPct: 0,
      agioDesagioReais: 0,
      durationDu: 0,
      durationAnos: 0,
      modifiedDuration: 0,
      valorFinanceiro: 0,
      fluxoPagamento: []
    };
  }

  let rawVna = safeParseFloat(asset?.vna, 0.0);
  if (rawVna <= 0) {
    rawVna = safeParseFloat(asset?.vne ?? asset?.pu_emissao ?? asset?.pu, 0.0);
  }
  if (rawVna <= 0) {
    rawVna = safeParseFloat(asset?.pu_par, 0.0);
  }
  if (rawVna <= 0) {
    rawVna = safeParseFloat(asset?.pu_mercado ?? asset?.pu_indicativo, 1000.0);
  }
  const vnaBase = rawVna > 0 ? rawVna : 1000.0;

  // VNA IPCA: o VNA publicado refere-se à data ANBIMA (normalmente D-1). Projeta até a liquidação.
  const indexadorUp = String(asset?.indexador || 'IPCA').toUpperCase();
  const dataBaseVna = String(asset?.data_anbima || '').slice(0, 10);
  let vna = vnaBase;
  if (indexadorUp.includes('IPCA') && /^\d{4}-\d{2}-\d{2}$/.test(dataBaseVna) && dataLiquidacao > dataBaseVna) {
    const diaAniv = parseInt(String(dtVenc).slice(8, 10), 10) || 15;
    vna = projectVnaIpca(vnaBase, dataBaseVna, dataLiquidacao, ipcaProjMensal, diaAniv);
  }

  let rawTaxaEmissao = safeParseFloat(asset?.taxa_emissao, 0.0);
  if (rawTaxaEmissao <= 0) {
    rawTaxaEmissao = safeParseFloat(asset?.taxa_indicativa_anbima ?? asset?.taxa_mercado, 6.0);
  }
  const taxaEmissaoAnual = (rawTaxaEmissao > 0 ? rawTaxaEmissao : 6.0) / 100.0;
  const indexador = String(asset?.indexador || 'IPCA').toUpperCase();
  const dtVencRolled = rollToNextBusinessDay(dtVenc);

  // 1. Identifica se o papel é BULLET / JUROS CAPITALIZADOS NO VENCIMENTO (ex: ECER12)
  const proximoCupom = asset?.data_proximo_cupom || asset?.data_proximo_evento;
  const periodicidade = String(asset?.periodicidade_cupom || '').toLowerCase();
  const isBullet = Boolean(
    (proximoCupom && dtVenc && proximoCupom >= dtVenc) ||
    periodicidade.includes('vencimento') ||
    periodicidade.includes('resgate') ||
    periodicidade.includes('bullet') ||
    periodicidade.includes('não há') ||
    periodicidade.includes('sem cupom') ||
    periodicidade.includes('zero')
  );

  let fluxosCalculo: {
    nome: string;
    dataLiquidacao: string;
    prazoDu: number;
    diasEntrePagamentos: number;
    jurosExpectativa?: number;
    jurosProjetado: number;
    amortizacao: number;
    valorFluxo: number;
  }[] = [];
  let duDecorrido = 0;
  let pupar = 0;
  let fatorAccrued = 1.0;

  if (isBullet) {
    // -------------------------------------------------------------
    // ATIVO BULLET: JUROS CAPITALIZADOS ATÉ O VENCIMENTO (Ex: ECER12)
    // -------------------------------------------------------------
    const duAteLiq = countBusinessDays(dataLiquidacao, dtVencRolled);
    const puParOficial = safeParseFloat(asset?.pu_par, 0.0);

    if (puParOficial > vna) {
      pupar = puParOficial;
      fatorAccrued = pupar / vna;
      duDecorrido = Math.round((Math.log(fatorAccrued) / Math.log(1.0 + taxaEmissaoAnual)) * 252);
    } else {
      const dtEmissao = asset?.data_inicio_rentabilidade || asset?.data_emissao || asset?.dt_emissao || '2023-09-06';
      duDecorrido = countBusinessDays(dtEmissao, dataLiquidacao);
      fatorAccrued = Math.pow(1.0 + taxaEmissaoAnual, duDecorrido / 252.0);
      pupar = vna * fatorAccrued;
    }

    // Capitalização contínua a partir do PU Par até o vencimento
    const valorFluxoFinal = pupar * Math.pow(1.0 + taxaEmissaoAnual, duAteLiq / 252.0);
    const valAmortizacao = vna;
    const valJurosProjetado = Math.max(valorFluxoFinal - valAmortizacao, 0.0);
    const duTotalPeriodo = duDecorrido + duAteLiq;

    fluxosCalculo.push({
      nome: 'Juros|Amortização',
      dataLiquidacao: dtVencRolled,
      prazoDu: duAteLiq,
      diasEntrePagamentos: duTotalPeriodo,
      jurosProjetado: valJurosProjetado,
      amortizacao: valAmortizacao,
      valorFluxo: valorFluxoFinal
    });
  } else {
    // -------------------------------------------------------------
    // ATIVO COM CUPONS PERIÓDICOS (Ex: ENAT14, CRA026002BE, CERR18)
    // -------------------------------------------------------------
    const mapFuturos = new Map<string, {
      dataLiquidacao: string;
      hasAmortization: boolean;
      percentualAmortizacao: number;
      tipos: string[];
      valorProjetado?: number;
      jurosExpectativa?: number;
    }>();

    // ---------------------------------------------------------------------------------
    // DATA QUALITY GATE DE EVENTOS DE FLUXO:
    // Se existirem eventos de fontes oficiais (ANBIMA Oficial, Agente Cadastral, Securitizadora),
    // filtramos eventos puramente sintéticos ('Cronograma Contratual') que colidam ou criem
    // datas fantasmas conflitantes com a esteira primária.
    // ---------------------------------------------------------------------------------
    const hasOfficialEvents = paymentEvents.some(e => {
      const f = String(e.fonte || '').toLowerCase();
      return f.includes('anbima') || f.includes('escritura') || f.includes('cadastral') || f.includes('securitizadora') || f.includes('trustee');
    });

    const sanitizedEvents = hasOfficialEvents
      ? paymentEvents.filter(e => {
          const f = String(e.fonte || '').toLowerCase();
          if (f.includes('cronograma contratual')) {
            // Descarta evento sintético se já existe evento oficial na mesma janela de 30 dias
            const dStr = e.data_liquidacao || e.data_evento;
            if (!dStr) return false;
            return !paymentEvents.some(oe => {
              const of = String(oe.fonte || '').toLowerCase();
              if (of.includes('cronograma contratual')) return false;
              const od = oe.data_liquidacao || oe.data_evento;
              if (!od) return false;
              const diff = Math.abs(new Date(dStr + 'T00:00:00Z').getTime() - new Date(od + 'T00:00:00Z').getTime());
              return diff <= 30 * 86400000;
            });
          }
          return true;
        })
      : paymentEvents;

    for (let k = 0; k < sanitizedEvents.length; k++) {
      const ev = sanitizedEvents[k];
      const rawDt = ev.data_liquidacao || ev.data_evento;
      if (!rawDt) continue;
      const dtRolled = rollToNextBusinessDay(rawDt);
      if (dtRolled <= dataLiquidacao) continue;

      if (!mapFuturos.has(dtRolled)) {
        mapFuturos.set(dtRolled, {
          dataLiquidacao: dtRolled,
          hasAmortization: false,
          percentualAmortizacao: 0,
          tipos: []
        });
      }
      const item = mapFuturos.get(dtRolled)!;
      const tipo = String(ev.tipo_evento || '');
      item.tipos.push(tipo);
      const isAmort = /amort/i.test(tipo) || /venc/i.test(tipo);
      if (isAmort) {
        item.hasAmortization = true;
      }
      // O percentual pode vir em 'percentual_amortizacao' ou em 'taxa' quando o evento é de Amortização
      let rawPct = ev.percentual_amortizacao != null ? Number(ev.percentual_amortizacao) : NaN;
      if (isNaN(rawPct) && isAmort && ev.taxa != null) {
        rawPct = Number(ev.taxa);
      }
      if (!isNaN(rawPct) && rawPct > 0) {
        item.percentualAmortizacao += rawPct;
      }
      if (ev.valor_projetado != null && Number(ev.valor_projetado) > 0 && !isAmort) {
        item.valorProjetado = Number(ev.valor_projetado);
      }
      if (ev.juros_expectativa != null && Number(ev.juros_expectativa) > 0) {
        item.jurosExpectativa = Number(ev.juros_expectativa);
      }
    }

    let eventosFuturos = Array.from(mapFuturos.values()).sort((a, b) => a.dataLiquidacao.localeCompare(b.dataLiquidacao));

    // Se não há eventos pré-cadastrados, constrói cronograma semestral contratual até o vencimento
    if (eventosFuturos.length === 0) {
      let curr = new Date(dtVencRolled + 'T00:00:00Z');
      const startLiq = new Date(dataLiquidacao + 'T00:00:00Z');
      const datasGeradas: string[] = [];

      while (curr > startLiq && datasGeradas.length < 120) {
        datasGeradas.push(rollToNextBusinessDay(formatDateISO(curr)));
        curr = addCalendarDays(curr, -182); // ~6 meses
      }

      const unicas = Array.from(new Set(datasGeradas)).sort();
      eventosFuturos = unicas.map((d, idx) => ({
        dataLiquidacao: d,
        hasAmortization: idx === unicas.length - 1,
        percentualAmortizacao: idx === unicas.length - 1 ? 100.0 : 0,
        tipos: [idx === unicas.length - 1 ? 'Juros|Amortização' : 'Juros']
      }));
    }

    // ---------------------------------------------------------------------------------
    // Calibração Inteligente de Amortização Contratual Baseada na Duration Oficial ANBIMA
    // Se o papel não possui amortizações intermediárias explícitas em paymentEvents (apenas bullet
    // residual no vencimento), mas a Duration divulgada pela ANBIMA aponta prazo médio inferior
    // (comum em Debêntures Lei 12.431 e CRI/CRA que amortizam nos últimos anos), calibramos
    // o número K de parcelas anuais finais que melhor reconcilia a Duration oficial da ANBIMA.
    // ---------------------------------------------------------------------------------
    const hasExplicitIntermediateAmort = eventosFuturos.some(
      (e, idx) => idx < eventosFuturos.length - 1 && (e.percentualAmortizacao > 0 || e.hasAmortization)
    );
    const hasContractualFinalAmort = eventosFuturos.some(
      (e, idx) => idx === eventosFuturos.length - 1 && (e.percentualAmortizacao > 0 || e.hasAmortization)
    );

    const rawDur = asset?.duration ?? asset?.duracao;
    const targetDurationDu = rawDur != null ? parseFloat(String(rawDur).replace(',', '.')) * 252.0 : null;

    if (!hasExplicitIntermediateAmort && !hasContractualFinalAmort && targetDurationDu && targetDurationDu > 0 && eventosFuturos.length > 1) {
      const rawTaxaOp = asset?.taxa_indicativa_anbima || asset?.taxa_mercado || (taxaEmissaoAnual * 100.0);
      let parsedTaxa = parseFloat(String(rawTaxaOp).replace(',', '.'));
      if (indexador.includes('DI') && (isNaN(parsedTaxa) || parsedTaxa > 40.0)) {
        parsedTaxa = taxaEmissaoAnual * 100.0;
      }
      const taxaOpAnualRef = (parsedTaxa > 0 ? parsedTaxa : 6.0) / 100.0;

      // Precalcula os prazos em DU de cada evento futuro uma única vez
      let dtPrev = addBusinessDays(dataLiquidacao, -126);
      const eventMeta = eventosFuturos.map((ev) => {
        const dt = ev.dataLiquidacao;
        const duLiq = countBusinessDays(dataLiquidacao, dt);
        const duP = countBusinessDays(dtPrev, dt) || 126;
        dtPrev = dt;
        return { dt, duLiq, duP };
      });

      // Função auxiliar vetorizada rápida para simular a duration resultante de um mapa de amortizações
      const simulaDuration = (amortMap: Record<string, number>): number => {
        let s = vna;
        let pSum = 0;
        let tSum = 0;
        for (let i = 0; i < eventMeta.length; i++) {
          const { dt, duLiq, duP } = eventMeta[i];
          const isL = i === eventMeta.length - 1;

          let vAm = 0;
          if (amortMap[dt] != null) {
            vAm = (amortMap[dt] / 100.0) * vna;
          } else if (isL) {
            vAm = s;
          }
          const vJu = s * (Math.pow(1.0 + taxaEmissaoAnual, duP / 252.0) - 1.0);
          const fl = vJu + vAm;
          const pv = fl / Math.pow(1.0 + taxaOpAnualRef, duLiq / 252.0);
          pSum += pv;
          tSum += duLiq * pv;
          s = Math.max(s - vAm, 0.0);
        }
        return pSum > 0 ? tSum / pSum : 0;
      };

      const bulletDur = simulaDuration({});
      // Se a duration bullet for significativamente superior à da ANBIMA (> 35 DU / ~0.14 anos)
      if (bulletDur - targetDurationDu > 35.0) {
        // Encontra eventos candidatos correspondentes a aniversários anuais até o vencimento
        const annualCandidates: typeof eventosFuturos = [];
        let curDuTarget = countBusinessDays(dataLiquidacao, dtVencRolled);
        for (let i = eventosFuturos.length - 1; i >= 0; i--) {
          const ev = eventosFuturos[i];
          const du = countBusinessDays(dataLiquidacao, ev.dataLiquidacao);
          if (i === eventosFuturos.length - 1 || Math.abs(curDuTarget - du - 252) < 45) {
            annualCandidates.unshift(ev);
            curDuTarget = du;
          }
        }

        const candList = annualCandidates.length >= 2 ? annualCandidates : eventosFuturos;
        let bestK = 1;
        let minDiff = Math.abs(bulletDur - targetDurationDu);
        let bestAmortMap: Record<string, number> | null = null;

        for (let k = 2; k <= Math.min(candList.length, 10); k++) {
          const slice = candList.slice(candList.length - k);
          const testMap: Record<string, number> = {};
          const pct = 100.0 / k;
          for (let i = 0; i < slice.length; i++) {
            testMap[slice[i].dataLiquidacao] = (i === slice.length - 1) ? (100.0 - pct * (k - 1)) : pct;
          }
          const durK = simulaDuration(testMap);
          const diff = Math.abs(durK - targetDurationDu);
          if (diff < minDiff) {
            minDiff = diff;
            bestK = k;
            bestAmortMap = testMap;
          }
        }

        // Aplica o melhor cronograma calibrado aos eventos futuros
        if (bestAmortMap) {
          for (const ev of eventosFuturos) {
            if (bestAmortMap[ev.dataLiquidacao] != null) {
              ev.percentualAmortizacao = bestAmortMap[ev.dataLiquidacao];
              ev.hasAmortization = true;
            }
          }
        }
      }
    }

    // Localiza a data base para apuração dos Juros Decorridos (Accrued Interest)
    const passados = paymentEvents.filter(e => {
      const d = e.data_liquidacao || e.data_evento;
      return d && d <= dataLiquidacao;
    });

    let dtUltimoCupom: string;
    if (passados.length > 0) {
      dtUltimoCupom = passados.reduce((max, e) => {
        const d = e.data_liquidacao || e.data_evento;
        return (d && d > max) ? d : max;
      }, passados[0].data_liquidacao || passados[0].data_evento || dataLiquidacao);
    } else {
      dtUltimoCupom = asset?.data_emissao || asset?.dt_emissao || addBusinessDays(dataLiquidacao, -126);
    }

    // PU Par oficial ou derivado de juros decorridos
    const puParOficial = safeParseFloat(asset?.pu_par, 0.0);
    const dataAnbima = asset?.data_anbima || asset?.data_ultimo_negocio;

    // Em títulos IPCA e Pré-fixados, o PU Par decorre dia a dia a partir da data do último cupom sobre o VNA:
    if (!indexador.includes('DI')) {
      duDecorrido = countBusinessDays(dtUltimoCupom, dataLiquidacao);
      fatorAccrued = Math.pow(1.0 + taxaEmissaoAnual, duDecorrido / 252.0);
      pupar = vna * fatorAccrued;
    } else if (puParOficial > 0 && (!dataAnbima || dataAnbima === dataLiquidacao)) {
      pupar = puParOficial;
      fatorAccrued = vna > 0 ? pupar / vna : 1.0;
      duDecorrido = countBusinessDays(dtUltimoCupom, dataLiquidacao);
    } else if (puParOficial > 0) {
      pupar = puParOficial;
      fatorAccrued = vna > 0 ? pupar / vna : 1.0;
      duDecorrido = countBusinessDays(dtUltimoCupom, dataLiquidacao);
    } else {
      duDecorrido = countBusinessDays(dtUltimoCupom, dataLiquidacao);
      fatorAccrued = Math.pow(1.0 + taxaEmissaoAnual, duDecorrido / 252.0);
      pupar = vna * fatorAccrued;
    }

    // Identifica se a convenção de amortização é sobre o Saldo Remanescente
    const amortsComPct = eventosFuturos.filter(e => e.percentualAmortizacao > 0);
    const somaPcts = amortsComPct.reduce((acc, e) => acc + e.percentualAmortizacao, 0);
    const isAmortizacaoSaldo = (somaPcts > 105.0) || amortsComPct.some(e => Math.abs(e.percentualAmortizacao - 33.3334) < 0.1 || Math.abs(e.percentualAmortizacao - 50.0) < 0.1);

    let saldoDevedor = vna;
    let dtAnt = dtUltimoCupom;

    for (let i = 0; i < eventosFuturos.length; i++) {
      const ev = eventosFuturos[i];
      const dtEv = ev.dataLiquidacao;
      const duAteLiq = countBusinessDays(dataLiquidacao, dtEv);
      let duPeriodo = countBusinessDays(dtAnt, dtEv);
      if (duPeriodo <= 0) duPeriodo = 126;

      const isLast = (i === eventosFuturos.length - 1);
      let valAmort = 0.0;
      if (ev.percentualAmortizacao > 0) {
        if (isAmortizacaoSaldo) {
          valAmort = saldoDevedor * (ev.percentualAmortizacao / 100.0);
        } else {
          valAmort = (ev.percentualAmortizacao / 100.0) * vna;
        }
        valAmort = Math.min(valAmort, saldoDevedor);
      } else if (ev.hasAmortization && isLast) {
        valAmort = saldoDevedor;
      } else if (isLast && saldoDevedor > 0) {
        valAmort = saldoDevedor;
      }

      // Identifica o indexador para projeção e desconto
      const isDiAssetLocal = indexador.includes('DI');
      const isDiPercentLocal = isDiAssetLocal && (indexador.includes('%') || (taxaEmissaoAnual * 100.0 > 40.0));
      const isDiSpreadLocal = isDiAssetLocal && !isDiPercentLocal;

      // Fórmula oficial ANBIMA de cupom projetado:
      let valJuros = 0.0;
      let jurosExp: number | undefined = undefined;

      if (isDiSpreadLocal) {
        jurosExp = (ev.jurosExpectativa != null && ev.jurosExpectativa > 0)
          ? ev.jurosExpectativa
          : getCdiExpectationRate(duAteLiq);

        const rCdiDec = jurosExp / 100.0;
        const fCumAtual = Math.pow(1.0 + rCdiDec, duAteLiq / 252.0);

        if (i === 0) {
          const fatorRestante = fCumAtual * Math.pow(1.0 + taxaEmissaoAnual, duAteLiq / 252.0);
          valJuros = saldoDevedor * ((pupar / vna) * fatorRestante - 1.0);
        } else {
          const prevEv = eventosFuturos[i - 1];
          const prevDuAteLiq = countBusinessDays(dataLiquidacao, prevEv.dataLiquidacao);
          const prevJurosExp = (prevEv.jurosExpectativa != null && prevEv.jurosExpectativa > 0)
            ? prevEv.jurosExpectativa
            : getCdiExpectationRate(prevDuAteLiq);
          const prevRCdiDec = prevJurosExp / 100.0;
          const fCumPrev = Math.pow(1.0 + prevRCdiDec, prevDuAteLiq / 252.0);
          const fFwd = fCumAtual / fCumPrev;
          const dDelta = Math.max(duAteLiq - prevDuAteLiq, 1);
          const fSpr = Math.pow(1.0 + taxaEmissaoAnual, dDelta / 252.0);
          valJuros = saldoDevedor * (fFwd * fSpr - 1.0);
        }
      } else if (isDiPercentLocal) {
        jurosExp = getCdiExpectationRate(duAteLiq);
        const rCdiDec = jurosExp / 100.0;
        // taxaEmissaoAnual já foi dividida por 100 (ex: 106.5% -> 1.065)
        const pctMult = taxaEmissaoAnual > 10.0 ? taxaEmissaoAnual / 100.0 : taxaEmissaoAnual;
        const rEq = rCdiDec * pctMult;
        const fCumAtual = Math.pow(1.0 + rEq, duAteLiq / 252.0);

        if (i === 0) {
          valJuros = (pupar > 0 && vna > 0)
            ? saldoDevedor * ((pupar / vna) * fCumAtual - 1.0)
            : saldoDevedor * (fCumAtual - 1.0);
        } else {
          const prevEv = eventosFuturos[i - 1];
          const prevDuAteLiq = countBusinessDays(dataLiquidacao, prevEv.dataLiquidacao);
          const prevJurosExp = getCdiExpectationRate(prevDuAteLiq);
          const prevRCdiDec = prevJurosExp / 100.0;
          const prevREq = prevRCdiDec * pctMult;
          const fCumPrev = Math.pow(1.0 + prevREq, prevDuAteLiq / 252.0);
          valJuros = saldoDevedor * (fCumAtual / fCumPrev - 1.0);
        }
      } else {
        const fatorJuros = Math.pow(1.0 + taxaEmissaoAnual, duPeriodo / 252.0) - 1.0;
        valJuros = saldoDevedor * fatorJuros;
      }

      fluxosCalculo.push({
        nome: valAmort > 0 && valJuros > 0 ? 'Juros|Amortização' : (valAmort > 0 ? 'Amortização' : 'Juros'),
        dataLiquidacao: dtEv,
        prazoDu: duAteLiq,
        diasEntrePagamentos: duPeriodo,
        jurosExpectativa: jurosExp,
        jurosProjetado: valJuros,
        amortizacao: valAmort,
        valorFluxo: valJuros + valAmort
      });

      saldoDevedor = Math.max(saldoDevedor - valAmort, 0.0);
      dtAnt = dtEv;
    }
  }

  const jurosDecorridos = pupar - vna;

  // 5. Resolução da Taxa ou do PU
  let puOperacao = 0.0;
  let taxaOpAnual = 0.0;
  let taxaExibida = 0.0;
  const isDiAsset = indexador.includes('DI');
  const isDiPercent = isDiAsset && (indexador.includes('%') || (taxaEmissaoAnual * 100.0 > 40.0));
  const isDiSpread = isDiAsset && !isDiPercent;

  if (formaCalculo.toUpperCase() === 'PU') {
    puOperacao = Number(valor);
    const taxaResolvida = solveTaxaPorPU(fluxosCalculo, puOperacao, 1e-7, 100, isDiSpread, isDiPercent);
    taxaExibida = taxaResolvida != null ? taxaResolvida : (taxaEmissaoAnual * 100.0);
    taxaOpAnual = taxaExibida / 100.0;
  } else {
    taxaExibida = valor != null ? Number(valor) : (taxaEmissaoAnual * 100.0);
    taxaOpAnual = taxaExibida / 100.0;

    let somaPv = 0.0;
    for (let k = 0; k < fluxosCalculo.length; k++) {
      const fl = fluxosCalculo[k];
      let pvCf = 0.0;
      if (isDiSpread) {
        const rCdi = (fl.jurosExpectativa != null && fl.jurosExpectativa > 0)
          ? fl.jurosExpectativa / 100.0
          : getCdiExpectationRate(fl.prazoDu) / 100.0;
        const desc = Math.pow(1.0 + rCdi, fl.prazoDu / 252.0) * Math.pow(1.0 + taxaOpAnual, fl.prazoDu / 252.0);
        pvCf = fl.valorFluxo / desc;
      } else if (isDiPercent) {
        const rCdi = (fl.jurosExpectativa != null && fl.jurosExpectativa > 0)
          ? fl.jurosExpectativa / 100.0
          : getCdiExpectationRate(fl.prazoDu) / 100.0;
        const pctOpMult = taxaOpAnual > 10.0 ? taxaOpAnual / 100.0 : taxaOpAnual;
        const rEqOp = rCdi * pctOpMult;
        const desc = Math.pow(1.0 + rEqOp, fl.prazoDu / 252.0);
        pvCf = fl.valorFluxo / desc;
      } else {
        pvCf = fl.valorFluxo / Math.pow(1.0 + taxaOpAnual, fl.prazoDu / 252.0);
      }
      somaPv += pvCf;
    }
    puOperacao = somaPv;
  }

  // 6. Macaulay Duration e Tabela de Fluxos Descontados
  let timePvSum = 0.0;
  const tabelaFluxos: AnbimaCashFlowItem[] = [];

  for (let k = 0; k < fluxosCalculo.length; k++) {
    const fl = fluxosCalculo[k];
    let pvCf = 0.0;
    if (isDiSpread) {
      const rCdi = (fl.jurosExpectativa != null && fl.jurosExpectativa > 0)
        ? fl.jurosExpectativa / 100.0
        : getCdiExpectationRate(fl.prazoDu) / 100.0;
      const desc = Math.pow(1.0 + rCdi, fl.prazoDu / 252.0) * Math.pow(1.0 + taxaOpAnual, fl.prazoDu / 252.0);
      pvCf = fl.valorFluxo / desc;
    } else if (isDiPercent) {
      const rCdi = (fl.jurosExpectativa != null && fl.jurosExpectativa > 0)
        ? fl.jurosExpectativa / 100.0
        : getCdiExpectationRate(fl.prazoDu) / 100.0;
      const pctOpMult = taxaOpAnual > 10.0 ? taxaOpAnual / 100.0 : taxaOpAnual;
      const rEqOp = rCdi * pctOpMult;
      const desc = Math.pow(1.0 + rEqOp, fl.prazoDu / 252.0);
      pvCf = fl.valorFluxo / desc;
    } else {
      pvCf = fl.valorFluxo / Math.pow(1.0 + taxaOpAnual, fl.prazoDu / 252.0);
    }

    timePvSum += fl.prazoDu * pvCf;
    tabelaFluxos.push({
      nome: fl.nome,
      dataLiquidacao: fl.dataLiquidacao,
      prazoDu: fl.prazoDu,
      diasEntrePagamentos: fl.diasEntrePagamentos,
      jurosExpectativa: fl.jurosExpectativa,
      jurosProjetado: fl.jurosProjetado,
      amortizacao: fl.amortizacao,
      fluxoDescontado: pvCf,
      valorFluxo: fl.valorFluxo
    });
  }

  const durationDu = puOperacao > 0 ? timePvSum / puOperacao : 0.0;
  const durationAnos = durationDu / 252.0;
  const modifiedDuration = durationAnos / (1.0 + taxaOpAnual);

  // PU Limpo e Indicadores de Ágio/Deságio
  const puLimpo = fatorAccrued > 0 ? puOperacao / fatorAccrued : puOperacao;
  const pctPupar = pupar > 0 ? (puOperacao / pupar) * 100.0 : 100.0;
  const agioDesagioPct = pctPupar - 100.0;
  const agioDesagioReais = puOperacao - pupar;
  const qtd = Math.max(parseInt(String(quantidade), 10) || 1, 1);
  const valorFinanceiro = puOperacao * qtd;

  return {
    elegivel: true,
    ticker,
    isin: asset?.isin,
    tipo: asset?.tipo,
    devedor: asset?.devedor || asset?.issuer,
    indexador,
    dataOperacao,
    dataLiquidacao,
    quantidadeTitulos: qtd,
    tipoCalculo: formaCalculo,
    taxaOperacao: taxaExibida,
    taxaEmissao: taxaEmissaoAnual * 100.0,
    vna,
    pupar,
    puOperacao,
    puLimpo,
    jurosDecorridos,
    porcentagemPupar: pctPupar,
    agioDesagioPct,
    agioDesagioReais,
    durationDu,
    durationAnos,
    modifiedDuration,
    valorFinanceiro,
    vencimento: dtVenc,
    fluxoPagamento: tabelaFluxos
  };
}
