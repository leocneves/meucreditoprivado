/**
 * Motor Matemático & Financeiro Institucional para Renda Fixa e Crédito Privado
 * 
 * Implementa convenções oficiais da ANBIMA, CVM e Receita Federal para:
 * 1. Tabela Regressiva de IR e Gross-Up de Títulos Isentos (Lei 12.431, CRIs e CRAs);
 * 2. Spread de Crédito Real contra NTN-B / ETTJ Tesouro;
 * 3. Projeção de Cenários Macroeconômicos (IPCA e CDI);
 * 4. Ponto de Equilíbrio (Breakeven Inflation);
 * 5. Dispersão Temporal e Marcação a Mercado (MTM / Pull-to-Par via Duration Modificada).
 */

export interface TaxBracket {
  maxDays: number;
  rate: number;
  label: string;
}

export const REGRESSIVE_TAX_BRACKETS: TaxBracket[] = [
  { maxDays: 180, rate: 0.225, label: '22,5% (até 180 dias)' },
  { maxDays: 360, rate: 0.200, label: '20,0% (181 a 360 dias)' },
  { maxDays: 720, rate: 0.175, label: '17,5% (361 a 720 dias)' },
  { maxDays: Infinity, rate: 0.150, label: '15,0% (acima de 720 dias / 2 anos)' }
];

/**
 * Retorna a alíquota regressiva de IR aplicável ao prazo
 */
export function getIncomeTaxRate(daysToMaturity: number, isExempt: boolean): { rate: number; label: string } {
  if (isExempt) {
    return { rate: 0.0, label: '0,0% (Isento de IR - Pessoa Física)' };
  }
  const bracket = REGRESSIVE_TAX_BRACKETS.find(b => daysToMaturity <= b.maxDays) || REGRESSIVE_TAX_BRACKETS[3];
  return { rate: bracket.rate, label: bracket.label };
}

/**
 * Gross-Up de Taxa Real ou Spread:
 * Para um título isento (taxa r_isenta), a taxa bruta tributável equivalente que o investidor
 * precisaria obter em um ativo tributado (como NTN-B ou CDB) para receber o mesmo retorno líquido:
 * 
 * r_grossup = r_isento / (1 - IR)
 */
export function calcGrossUpRate(exemptRate: number, taxRate: number): number {
  if (taxRate >= 1 || taxRate < 0) return exemptRate;
  return exemptRate / (1 - taxRate);
}

/**
 * Conversão inversa: De taxa bruta tributada para taxa líquida equivalente
 */
export function calcNetRateFromGross(grossRate: number, taxRate: number): number {
  return grossRate * (1 - taxRate);
}

/**
 * Retorno Nominal Composto:
 * (1 + Taxa Nominal) = (1 + IPCA) * (1 + Taxa Real)
 */
export function calcNominalRate(realRate: number, inflationRate: number): number {
  return ((1 + realRate / 100) * (1 + inflationRate / 100) - 1) * 100;
}

/**
 * Cálculo de Saldo Futuro e Lucro Líquido no Vencimento
 */
export interface FutureValueResult {
  futureValueGross: number;
  futureValueNet: number;
  totalProfitGross: number;
  totalProfitNet: number;
  taxPaid: number;
  effectiveAnnualNetRate: number;
}

export function calcFutureValue(
  principal: number,
  annualNominalRate: number,
  years: number,
  taxRate: number,
  isExempt: boolean
): FutureValueResult {
  if (years <= 0 || principal <= 0) {
    return {
      futureValueGross: principal,
      futureValueNet: principal,
      totalProfitGross: 0,
      totalProfitNet: 0,
      taxPaid: 0,
      effectiveAnnualNetRate: 0
    };
  }

  const factor = Math.pow(1 + annualNominalRate / 100, years);
  const futureValueGross = principal * factor;
  const totalProfitGross = futureValueGross - principal;

  let taxPaid = 0;
  let totalProfitNet = totalProfitGross;

  if (!isExempt) {
    taxPaid = totalProfitGross * taxRate;
    totalProfitNet = totalProfitGross - taxPaid;
  }

  const futureValueNet = principal + totalProfitNet;
  const effectiveAnnualNetRate = (Math.pow(futureValueNet / principal, 1 / years) - 1) * 100;

  return {
    futureValueGross,
    futureValueNet,
    totalProfitGross,
    totalProfitNet,
    taxPaid,
    effectiveAnnualNetRate
  };
}

/**
 * Inflação de Indiferença (Breakeven Inflation):
 * Calcula qual a inflação média anual necessária para que o título IPCA+
 * entregue exatamente o mesmo retorno líquido que uma alternativa em % CDI.
 * 
 * Fórmula:
 * Retorno Líquido Alternativa = (1 + CDI_médio_anual * pct_cdi) ^ anos (ajustado de IR)
 * IPCA_breakeven = ((1 + Retorno Líquido Alvo) / (1 + Taxa Real Líquida)) - 1
 */
export function calcBreakevenInflation(
  cpRealRate: number,
  isCpExempt: boolean,
  cpTaxRate: number,
  cdiAnnualRate: number,
  cdiSpreadOrPct: { mode: 'pct' | 'spread'; value: number },
  cdiTaxRate: number,
  years: number
): number {
  // Rentabilidade bruta anual do CDI
  let annualCdiGross = cdiAnnualRate;
  if (cdiSpreadOrPct.mode === 'pct') {
    annualCdiGross = (cdiAnnualRate * cdiSpreadOrPct.value) / 100;
  } else {
    annualCdiGross = cdiAnnualRate + cdiSpreadOrPct.value;
  }

  // Rentabilidade líquida anual do CDI após IR
  const annualCdiNet = annualCdiGross * (1 - cdiTaxRate);

  // Taxa real anual líquida do papel CP
  const cpRealNet = isCpExempt ? cpRealRate : cpRealRate * (1 - cpTaxRate);

  // Inflação de equilíbrio: (1 + IPCA*) * (1 + cpRealNet) = (1 + annualCdiNet)
  const breakeven = ((1 + annualCdiNet / 100) / (1 + cpRealNet / 100) - 1) * 100;
  return breakeven;
}

/**
 * Marcação a Mercado (MTM) e Dispersão por Choque de Curva de Juros:
 * Utiliza a Duration Modificada para calcular a variação de preço sob choques na taxa:
 * 
 * D_mod = Duration / (1 + y)
 * Delta_PU_pct = - D_mod * (Delta_y_bps / 10000) * 100
 */
export function calcMtmPriceShock(
  currentYield: number,
  duration: number,
  rateShockBps: number
): { modifiedDuration: number; puChangePct: number } {
  const y = currentYield / 100;
  const modDuration = duration / (1 + y);
  const deltaY = rateShockBps / 10000; // bps para fração decimal
  const puChangePct = -modDuration * deltaY * 100;

  return {
    modifiedDuration: modDuration,
    puChangePct
  };
}

/**
 * Trajetória Temporal de Rendimento e Dispersão de MTM (Pull-to-Par):
 * Mostra o que acontece ao longo dos anos até o vencimento:
 * 1. Cenário Base (Carregamento / Hold-to-Maturity): Rentabilidade constante contratada
 * 2. Cenário de Estresse (Abertura de Juros de +150 bps): Desvalorização inicial de MTM, convergindo para o valor par
 * 3. Cenário Otimista (Fechamento de Juros de -150 bps): Valorização antecipada de MTM
 */
export interface TrajectoryPoint {
  year: number;
  label: string;
  remainingDuration: number;
  baseNominalValue: number;
  stressedValue: number;
  bullishValue: number;
  stressedYieldAnnualized: number;
  bullishYieldAnnualized: number;
  baseYieldAnnualized: number;
}

export function generateMtmTrajectory(
  principal: number,
  nominalAnnualRate: number,
  years: number,
  initialDuration: number,
  shockBps: number = 150
): TrajectoryPoint[] {
  const points: TrajectoryPoint[] = [];
  const steps = Math.min(Math.max(Math.ceil(years * 2), 2), 12); // Pelo menos semestral ou anual

  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * years;
    const remainingTime = Math.max(0, years - t);
    // Duration decai linearmente conforme o papel se aproxima do vencimento
    const remainingDuration = Math.max(0, initialDuration * (remainingTime / years));

    // Valor base acumulado pelo carregamento contratado
    const baseValue = principal * Math.pow(1 + nominalAnnualRate / 100, t);

    if (t === 0) {
      points.push({
        year: 0,
        label: 'Hoje (Aporte)',
        remainingDuration: initialDuration,
        baseNominalValue: principal,
        stressedValue: principal,
        bullishValue: principal,
        stressedYieldAnnualized: 0,
        bullishYieldAnnualized: 0,
        baseYieldAnnualized: 0
      });
      continue;
    }

    // Impacto de MTM caso o choque persista no período t
    const y = nominalAnnualRate / 100;
    const modDur = remainingDuration / (1 + y);
    const deltaShock = (shockBps / 10000);

    // Efeito pull-to-par: o desvio percentual de preço é atenuado pela duration remanescente
    const stressedPct = -modDur * deltaShock;
    const bullishPct = modDur * deltaShock;

    const stressedValue = Math.max(principal * 0.5, baseValue * (1 + stressedPct));
    const bullishValue = baseValue * (1 + bullishPct);

    const baseYieldAnn = (Math.pow(baseValue / principal, 1 / t) - 1) * 100;
    const stressedYieldAnn = (Math.pow(stressedValue / principal, 1 / t) - 1) * 100;
    const bullishYieldAnn = (Math.pow(bullishValue / principal, 1 / t) - 1) * 100;

    points.push({
      year: Number(t.toFixed(1)),
      label: remainingTime === 0 ? `Vencimento (${t.toFixed(1)}a)` : `Ano ${t.toFixed(1)}`,
      remainingDuration: Number(remainingDuration.toFixed(2)),
      baseNominalValue: Math.round(baseValue),
      stressedValue: Math.round(stressedValue),
      bullishValue: Math.round(bullishValue),
      baseYieldAnnualized: Number(baseYieldAnn.toFixed(2)),
      stressedYieldAnnualized: Number(stressedYieldAnn.toFixed(2)),
      bullishYieldAnnualized: Number(bullishYieldAnn.toFixed(2))
    });
  }

  return points;
}

/* ==========================================================================
   MODELAGEM DE CUPONS PERIÓDICOS E AMORTIZAÇÃO DE PRINCIPAL
   ========================================================================== */

export type CouponFrequency = 'bullet' | 'annual' | 'semiannual' | 'monthly';
export type AmortizationSchedule = 'bullet' | 'constant' | 'grace_half';
export type ReinvestmentStrategy = 'contracted_yield' | 'cdi' | 'none';

export interface PeriodicCashFlowItem {
  period: number;
  periodLabel: string;
  year: number;
  startingPrincipal: number;
  couponAmountGross: number;
  couponAmountNet: number;
  amortizationAmount: number;
  totalCashFlowNet: number;
  endingPrincipal: number;
  cumulativeNetReceived: number;
  reinvestedAccumulatedBalance: number;
}

export interface CashFlowScheduleResult {
  items: PeriodicCashFlowItem[];
  totalCouponsNet: number;
  totalAmortization: number;
  totalCashReceivedNet: number;
  reinvestedFinalBalance: number;
  macaulayDurationEstimated: number;
}

/**
 * Constrói o cronograma periódico de fluxo de caixa considerando:
 * - Frequência de cupons (semestral, anual, mensal ou bullet no vencimento)
 * - Modelo de amortização do principal (bullet 100% no fim, constante, ou carência de 50% do prazo)
 * - Estratégia de reinvestimento (à taxa contratada, ao CDI ou sem reinvestimento / renda passiva líquida)
 * - Cálculo rigoroso da Duration de Macaulay resultante dos fluxos
 */
export function generateCashFlowSchedule(
  principal: number,
  annualNominalRate: number,
  years: number,
  taxRate: number,
  isExempt: boolean,
  couponFreq: CouponFrequency = 'semiannual',
  amortSchedule: AmortizationSchedule = 'bullet',
  reinvestStrategy: ReinvestmentStrategy = 'contracted_yield',
  reinvestAnnualRate: number = 10.5
): CashFlowScheduleResult {
  if (years <= 0 || principal <= 0) {
    return {
      items: [],
      totalCouponsNet: 0,
      totalAmortization: 0,
      totalCashReceivedNet: 0,
      reinvestedFinalBalance: 0,
      macaulayDurationEstimated: 0
    };
  }

  // Frequência de períodos por ano (m)
  let periodsPerYear = 1;
  if (couponFreq === 'semiannual') periodsPerYear = 2;
  else if (couponFreq === 'monthly') periodsPerYear = 12;
  else if (couponFreq === 'annual') periodsPerYear = 1;
  else periodsPerYear = 1 / years; // Bullet

  const totalPeriods = Math.max(1, Math.round(years * periodsPerYear));
  const effectiveAnnualY = annualNominalRate / 100;
  // Taxa periódica composta oficial: (1 + y)^(1/m) - 1
  const periodRate = Math.pow(1 + effectiveAnnualY, 1 / periodsPerYear) - 1;

  // Taxa periódica de reinvestimento composta
  const effectiveReinvestY = (reinvestStrategy === 'cdi' ? reinvestAnnualRate : annualNominalRate) / 100;
  const periodReinvestRate = Math.pow(1 + effectiveReinvestY, 1 / periodsPerYear) - 1;

  let currentPrincipal = principal;
  let cumulativeReceived = 0;
  let accumulatedReinvestmentPool = 0;
  const items: PeriodicCashFlowItem[] = [];

  // Variáveis para Duration de Macaulay: Sum( t * PV(CF_t) ) / Sum( PV(CF_t) )
  let weightedTimePvSum = 0;
  let pvSum = 0;

  // Determinar parcelas de amortização
  const amortPeriodsCount: number[] = [];
  if (amortSchedule === 'bullet' || couponFreq === 'bullet') {
    // 100% amortizado no último período
    for (let p = 1; p <= totalPeriods; p++) {
      amortPeriodsCount.push(p === totalPeriods ? principal : 0);
    }
  } else if (amortSchedule === 'constant') {
    // Amortização constante em todos os períodos
    const constAmort = principal / totalPeriods;
    for (let p = 1; p <= totalPeriods; p++) {
      amortPeriodsCount.push(p === totalPeriods ? currentPrincipal : constAmort);
    }
  } else if (amortSchedule === 'grace_half') {
    // Carência nos primeiros 50% dos períodos, amortização nos 50% finais
    const gracePeriods = Math.floor(totalPeriods / 2);
    const activeAmortPeriods = totalPeriods - gracePeriods;
    const amortPart = activeAmortPeriods > 0 ? principal / activeAmortPeriods : principal;

    for (let p = 1; p <= totalPeriods; p++) {
      if (p <= gracePeriods) {
        amortPeriodsCount.push(0);
      } else {
        amortPeriodsCount.push(p === totalPeriods ? currentPrincipal : amortPart);
      }
    }
  }

  let totalCouponsNet = 0;
  let totalAmortization = 0;

  for (let p = 1; p <= totalPeriods; p++) {
    const tYears = p / periodsPerYear;
    const startingP = currentPrincipal;

    // Juros do período incidem estritamente sobre o saldo devedor remanescente
    const couponGross = startingP * periodRate;
    const couponTax = isExempt ? 0 : couponGross * taxRate;
    const couponNet = couponGross - couponTax;

    const amortAmount = Math.min(startingP, amortPeriodsCount[p - 1] || 0);
    const endingP = Math.max(0, startingP - amortAmount);
    currentPrincipal = endingP;

    const totalCashNet = couponNet + amortAmount;
    cumulativeReceived += totalCashNet;
    totalCouponsNet += couponNet;
    totalAmortization += amortAmount;

    // Cálculo de valor presente para Duration de Macaulay
    const discountFactor = Math.pow(1 + effectiveAnnualY, tYears);
    const pvOfCashFlow = totalCashNet / discountFactor;
    pvSum += pvOfCashFlow;
    weightedTimePvSum += tYears * pvOfCashFlow;

    // Simulação do saldo reinvestido
    if (reinvestStrategy !== 'none') {
      accumulatedReinvestmentPool = (accumulatedReinvestmentPool * (1 + periodReinvestRate)) + totalCashNet;
    } else {
      accumulatedReinvestmentPool = cumulativeReceived;
    }

    let label = `Período ${p}`;
    if (couponFreq === 'semiannual') {
      const yearNum = Math.ceil(p / 2);
      const semNum = p % 2 === 1 ? '1º Sem' : '2º Sem';
      label = `${semNum} (Ano ${yearNum})`;
    } else if (couponFreq === 'annual') {
      label = `Ano ${p}`;
    } else if (couponFreq === 'monthly') {
      label = `Mês ${p}`;
    } else {
      label = `Vencimento (${years}a)`;
    }

    items.push({
      period: p,
      periodLabel: label,
      year: Number(tYears.toFixed(2)),
      startingPrincipal: Math.round(startingP),
      couponAmountGross: Math.round(couponGross),
      couponAmountNet: Math.round(couponNet),
      amortizationAmount: Math.round(amortAmount),
      totalCashFlowNet: Math.round(totalCashNet),
      endingPrincipal: Math.round(endingP),
      cumulativeNetReceived: Math.round(cumulativeReceived),
      reinvestedAccumulatedBalance: Math.round(accumulatedReinvestmentPool + endingP)
    });
  }

  const macaulayDuration = pvSum > 0 ? weightedTimePvSum / pvSum : years;

  return {
    items,
    totalCouponsNet: Math.round(totalCouponsNet),
    totalAmortization: Math.round(totalAmortization),
    totalCashReceivedNet: Math.round(cumulativeReceived),
    reinvestedFinalBalance: Math.round(accumulatedReinvestmentPool),
    macaulayDurationEstimated: Number(macaulayDuration.toFixed(2))
  };
}

