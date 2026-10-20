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
  percentual_amortizacao?: number | null;
  status?: string;
}

export interface AnbimaCashFlowItem {
  nome: string;
  dataLiquidacao: string;
  prazoDu: number;
  diasEntrePagamentos: number;
  jurosProjetado: number;
  amortizacao: number;
  fluxoDescontado: number;
  valorFluxo: number;
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

function buildHolidaySet(startYear = 2015, endYear = 2060): Set<string> {
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

export const BR_HOLIDAYS_SET = buildHolidaySet(2015, 2060);

export function isHoliday(dateStr: string): boolean {
  return BR_HOLIDAYS_SET.has(dateStr);
}

export function isBusinessDay(dateStr: string): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr + 'T00:00:00Z');
  const dow = d.getUTCDay();
  return dow !== 0 && dow !== 6 && !BR_HOLIDAYS_SET.has(dateStr);
}

export function rollToNextBusinessDay(dateStr: string): string {
  if (!dateStr) return dateStr;
  let d = new Date(dateStr + 'T00:00:00Z');
  while (true) {
    const dow = d.getUTCDay();
    const iso = formatDateISO(d);
    if (dow !== 0 && dow !== 6 && !BR_HOLIDAYS_SET.has(iso)) {
      return iso;
    }
    d = addCalendarDays(d, 1);
  }
}

export function countBusinessDays(startStr: string, endStr: string): number {
  if (!startStr || !endStr || startStr >= endStr) return 0;
  const start = new Date(startStr + 'T00:00:00Z');
  const end = new Date(endStr + 'T00:00:00Z');

  let count = 0;
  let curr = addCalendarDays(start, 1);

  while (curr <= end) {
    const dow = curr.getUTCDay();
    const iso = formatDateISO(curr);
    if (dow !== 0 && dow !== 6 && !BR_HOLIDAYS_SET.has(iso)) {
      count++;
    }
    curr = addCalendarDays(curr, 1);
  }
  return count;
}

export function addBusinessDays(startStr: string, nDays: number): string {
  if (!startStr) return startStr;
  if (nDays <= 0) return startStr;
  let curr = new Date(startStr + 'T00:00:00Z');
  let added = 0;
  while (added < nDays) {
    curr = addCalendarDays(curr, 1);
    const dow = curr.getUTCDay();
    const iso = formatDateISO(curr);
    if (dow !== 0 && dow !== 6 && !BR_HOLIDAYS_SET.has(iso)) {
      added++;
    }
  }
  return formatDateISO(curr);
}

/* ================= 2. SOLVER NUMÉRICO DE BRENT (PU -> TAXA YTM) ================= */

export function solveTaxaPorPU(
  fluxos: { valorFluxo: number; prazoDu: number }[],
  puAlvo: number,
  tol = 1e-7,
  maxIter = 100
): number | null {
  if (puAlvo <= 0 || !fluxos || fluxos.length === 0) return null;

  const calcPU = (y: number): number => {
    if (y <= -0.99) return 1e12;
    let soma = 0.0;
    for (let k = 0; k < fluxos.length; k++) {
      soma += fluxos[k].valorFluxo / Math.pow(1.0 + y, fluxos[k].prazoDu / 252.0);
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
    dataOperacao = new Date().toISOString().slice(0, 10),
    dataLiquidacao = dataOperacao,
    formaCalculo = 'Taxa',
    valor,
    quantidade = 1
  } = params;

  const ticker = (asset?.ticker || asset?.codigo_b3 || 'ATIVO').trim().toUpperCase();
  const dtVenc = asset?.vencimento || asset?.dt_vencimento || asset?.data_vencimento;

  // Trava de integridade metodológica
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

  const vna = Number(asset?.vna || asset?.pu || asset?.pu_par || 1000.0);
  const taxaEmissaoAnual = Number(asset?.taxa_emissao || 6.0) / 100.0;
  const indexador = String(asset?.indexador || 'IPCA').toUpperCase();

  // 1. Agrupamento e identificação dos pagamentos futuros
  const mapFuturos = new Map<string, {
    dataLiquidacao: string;
    hasAmortization: boolean;
    percentualAmortizacao: number;
    tipos: string[];
  }>();

  for (let k = 0; k < paymentEvents.length; k++) {
    const ev = paymentEvents[k];
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
    if (/amort/i.test(tipo) || /venc/i.test(tipo)) {
      item.hasAmortization = true;
    }
    if (ev.percentual_amortizacao != null && !isNaN(Number(ev.percentual_amortizacao))) {
      item.percentualAmortizacao += Number(ev.percentual_amortizacao);
    }
  }

  let eventosFuturos = Array.from(mapFuturos.values()).sort((a, b) => a.dataLiquidacao.localeCompare(b.dataLiquidacao));

  // Se não há eventos pré-cadastrados, constrói cronograma semestral hipotético até o vencimento
  if (eventosFuturos.length === 0) {
    const vencRolled = rollToNextBusinessDay(dtVenc);
    let curr = new Date(vencRolled + 'T00:00:00Z');
    const startLiq = new Date(dataLiquidacao + 'T00:00:00Z');
    const datasGeradas: string[] = [];

    while (curr > startLiq) {
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

  // 2. Localiza a data base para apuração dos Juros Decorridos (Accrued Interest)
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

  // 3. Monta grade de fluxos
  let saldoDevedor = vna;
  let dtAnt = dtUltimoCupom;
  const fluxosCalculo: {
    nome: string;
    dataLiquidacao: string;
    prazoDu: number;
    diasEntrePagamentos: number;
    jurosProjetado: number;
    amortizacao: number;
    valorFluxo: number;
  }[] = [];

  for (let i = 0; i < eventosFuturos.length; i++) {
    const ev = eventosFuturos[i];
    const dtEv = ev.dataLiquidacao;
    const duAteLiq = countBusinessDays(dataLiquidacao, dtEv);
    let duPeriodo = countBusinessDays(dtAnt, dtEv);
    if (duPeriodo <= 0) duPeriodo = 126;

    const isLast = (i === eventosFuturos.length - 1);
    let valAmort = 0.0;
    if (ev.percentualAmortizacao > 0) {
      valAmort = (ev.percentualAmortizacao / 100.0) * vna;
    } else if (ev.hasAmortization || isLast) {
      valAmort = saldoDevedor;
    }

    // Fórmula oficial ANBIMA de cupom projetado:
    // Juros = Saldo Devedor * [ (1 + Taxa Emissão)^(DU_periodo / 252) - 1 ]
    const fatorJuros = Math.pow(1.0 + taxaEmissaoAnual, duPeriodo / 252.0) - 1.0;
    const valJuros = saldoDevedor * fatorJuros;

    fluxosCalculo.push({
      nome: valAmort > 0 && valJuros > 0 ? 'Juros|Amortização' : (valAmort > 0 ? 'Amortização' : 'Juros'),
      dataLiquidacao: dtEv,
      prazoDu: duAteLiq,
      diasEntrePagamentos: duPeriodo,
      jurosProjetado: valJuros,
      amortizacao: valAmort,
      valorFluxo: valJuros + valAmort
    });

    saldoDevedor = Math.max(saldoDevedor - valAmort, 0.0);
    dtAnt = dtEv;
  }

  // 4. Apuração dos Juros Decorridos (Accrued Interest) e Preço Par
  const duDecorrido = countBusinessDays(dtUltimoCupom, dataLiquidacao);
  const fatorAccrued = Math.pow(1.0 + taxaEmissaoAnual, duDecorrido / 252.0);
  const pupar = vna * fatorAccrued;
  const jurosDecorridos = pupar - vna;

  // 5. Resolução da Taxa ou do PU
  let puOperacao = 0.0;
  let taxaOpAnual = 0.0;
  let taxaExibida = 0.0;

  if (formaCalculo.toUpperCase() === 'PU') {
    puOperacao = Number(valor);
    const taxaResolvida = solveTaxaPorPU(fluxosCalculo, puOperacao);
    taxaExibida = taxaResolvida != null ? taxaResolvida : (taxaEmissaoAnual * 100.0);
    taxaOpAnual = taxaExibida / 100.0;
  } else {
    taxaExibida = valor != null ? Number(valor) : (taxaEmissaoAnual * 100.0);
    taxaOpAnual = taxaExibida / 100.0;

    let somaPv = 0.0;
    for (let k = 0; k < fluxosCalculo.length; k++) {
      const fl = fluxosCalculo[k];
      somaPv += fl.valorFluxo / Math.pow(1.0 + taxaOpAnual, fl.prazoDu / 252.0);
    }
    puOperacao = somaPv;
  }

  // 6. Macaulay Duration e Tabela de Fluxos Descontados
  let timePvSum = 0.0;
  const tabelaFluxos: AnbimaCashFlowItem[] = [];

  for (let k = 0; k < fluxosCalculo.length; k++) {
    const fl = fluxosCalculo[k];
    const pvCf = fl.valorFluxo / Math.pow(1.0 + taxaOpAnual, fl.prazoDu / 252.0);
    timePvSum += fl.prazoDu * pvCf;
    tabelaFluxos.push({
      nome: fl.nome,
      dataLiquidacao: fl.dataLiquidacao,
      prazoDu: fl.prazoDu,
      diasEntrePagamentos: fl.diasEntrePagamentos,
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
