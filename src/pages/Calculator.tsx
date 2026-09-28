import React, { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Calculator,
  Search,
  Info,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  Scale,
  Sparkles,
  ArrowRight,
  HelpCircle,
  Copy,
  Check,
  Percent,
  Calendar,
  Building2,
  Layers,
  ArrowUpRight,
  Sliders,
  DollarSign,
  AlertTriangle,
  RotateCcw,
  Wallet,
  Receipt,
  Clock,
  BarChart3,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend
} from 'recharts';
import { fetchCSV, Asset, NtnbRecord, normalizeRating, getRatingBadgeClass, getTipoBadgeClass } from '../utils/csv';
import {
  getIncomeTaxRate,
  calcGrossUpRate,
  calcNominalRate,
  calcFutureValue,
  calcBreakevenInflation,
  calcMtmPriceShock,
  generateMtmTrajectory,
  generateCashFlowSchedule,
  CouponFrequency,
  AmortizationSchedule,
  ReinvestmentStrategy,
  PeriodicCashFlowItem,
  CashFlowScheduleResult,
  TrajectoryPoint
} from '../utils/calculatorMath';

/* ================= BENCHMARKS DE NTN-B DEFAULT (Fallback 25/09/2026) ================= */
const DEFAULT_NTNB_LIST = [
  { nome: 'NTN-B 2027', ano: 2027, vencimento: '2027-05-15', taxa: 5.4892 },
  { nome: 'NTN-B 2028', ano: 2028, vencimento: '2028-08-15', taxa: 7.3700 },
  { nome: 'NTN-B 2029', ano: 2029, vencimento: '2029-05-15', taxa: 7.4900 },
  { nome: 'NTN-B 2030', ano: 2030, vencimento: '2030-08-15', taxa: 7.6652 },
  { nome: 'NTN-B 2031', ano: 2031, vencimento: '2031-05-15', taxa: 7.6461 },
  { nome: 'NTN-B 2032', ano: 2032, vencimento: '2032-08-15', taxa: 7.6598 },
  { nome: 'NTN-B 2033', ano: 2033, vencimento: '2033-05-15', taxa: 7.6401 },
  { nome: 'NTN-B 2035', ano: 2035, vencimento: '2035-05-15', taxa: 7.6000 },
  { nome: 'NTN-B 2037', ano: 2037, vencimento: '2037-05-15', taxa: 7.5438 },
  { nome: 'NTN-B 2040', ano: 2040, vencimento: '2040-08-15', taxa: 7.3974 },
  { nome: 'NTN-B 2045', ano: 2045, vencimento: '2045-05-15', taxa: 7.3396 },
  { nome: 'NTN-B 2050', ano: 2050, vencimento: '2050-08-15', taxa: 7.2900 },
  { nome: 'NTN-B 2055', ano: 2055, vencimento: '2055-05-15', taxa: 7.2260 },
  { nome: 'NTN-B 2060', ano: 2060, vencimento: '2060-08-15', taxa: 7.2100 }
];

/* ================= COMPONENTE DE TOOLTIP DIDÁTICO ================= */
interface InfoTooltipProps {
  title: string;
  content: string;
  formula?: string;
  example?: string;
}

const InfoTooltip: React.FC<InfoTooltipProps> = ({ title, content, formula, example }) => {
  const [show, setShow] = useState(false);

  return (
    <div className="relative inline-flex items-center ml-1">
      <button
        type="button"
        className="text-slate-400 hover:text-blue-600 transition-colors p-0.5 rounded-full hover:bg-slate-100"
        onClick={() => setShow(!show)}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        title={title}
      >
        <HelpCircle size={14} />
      </button>

      {show && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 sm:w-80 p-3.5 bg-slate-900 text-white text-xs rounded-xl shadow-2xl border border-slate-700 pointer-events-none animate-in fade-in zoom-in-95 duration-150">
          <div className="font-bold text-blue-300 mb-1 flex items-center gap-1.5 text-xs sm:text-sm">
            <Info size={14} className="text-blue-400" />
            {title}
          </div>
          <p className="text-slate-300 leading-relaxed mb-2">{content}</p>
          {formula && (
            <div className="bg-slate-800/80 rounded-lg p-2 font-mono text-[11px] text-emerald-300 border border-slate-700 mb-2">
              <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider mb-0.5">Fórmula de Mercado:</span>
              {formula}
            </div>
          )}
          {example && (
            <div className="text-[11px] text-slate-300 border-t border-slate-800 pt-1.5 italic">
              💡 <span className="font-semibold text-slate-200">Exemplo Prático:</span> {example}
            </div>
          )}
          <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-900 border-b border-r border-slate-700 rotate-45" />
        </div>
      )}
    </div>
  );
};

/* ================= PÁGINA PRINCIPAL DA CALCULADORA ================= */
const CalculatorPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialTicker = (searchParams.get('ticker') || '').trim().toUpperCase();

  // Estados de dados externos
  const [allAssets, setAllAssets] = useState<Asset[]>([]);
  const [ntnbRecords, setNtnbRecords] = useState<typeof DEFAULT_NTNB_LIST>(DEFAULT_NTNB_LIST);
  const [loadingData, setLoadingData] = useState(true);

  // Estados do formulário
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Parâmetros de Simulação
  const [assetName, setAssetName] = useState('Debênture / CRI Exemplo');
  const [assetType, setAssetType] = useState<'CRI' | 'CRA' | 'Debênture' | 'Outro'>('CRI');
  const [isExempt, setIsExempt] = useState(true);
  const [indexador, setIndexador] = useState<'IPCA' | 'CDI' | 'PRE'>('IPCA');
  const [inputRate, setInputRate] = useState<number>(7.50); // % a.a. real para IPCA, ou spread / % do CDI
  const [cdiMode, setCdiMode] = useState<'pct' | 'spread'>('pct'); // % do CDI (ex 110%) ou CDI + spread (ex CDI+2.5%)
  const [tenorYears, setTenorYears] = useState<number>(4.0);
  const [durationYears, setDurationYears] = useState<number>(3.5);
  const [principalAmount, setPrincipalAmount] = useState<number>(50000); // R$ 50 mil

  // Parâmetros de Título Público Benchmark
  const [selectedNtnb, setSelectedNtnb] = useState<typeof DEFAULT_NTNB_LIST[0]>(DEFAULT_NTNB_LIST[3]); // NTN-B 2030 padrão
  const [manualBenchmarkRate, setManualBenchmarkRate] = useState<number>(7.66);
  const [useManualBenchmark, setUseManualBenchmark] = useState(false);

  // Choque de Curva MTM (em bps)
  const [curveShockBps, setCurveShockBps] = useState<number>(150);

  // Cenário Customizado de IPCA & CDI
  const [customIpca, setCustomIpca] = useState<number>(4.5);
  const [customCdi, setCustomCdi] = useState<number>(10.5);

  // Parâmetros de Fluxo de Caixa: Cupons & Amortização
  const [couponFreq, setCouponFreq] = useState<CouponFrequency>('semiannual');
  const [amortSchedule, setAmortSchedule] = useState<AmortizationSchedule>('bullet');
  const [reinvestStrategy, setReinvestStrategy] = useState<ReinvestmentStrategy>('contracted_yield');
  const [reinvestRate, setReinvestRate] = useState<number>(10.5);
  const [showCashFlowDetail, setShowCashFlowDetail] = useState(true);
  const [showAdvancedCashflowConfig, setShowAdvancedCashflowConfig] = useState(false);

  // Notificação de cópia
  const [copied, setCopied] = useState(false);

  /* ================= 1. CARREGAMENTO DE DADOS ================= */
  useEffect(() => {
    const loadAll = async () => {
      try {
        const [assetsData, ntnbData] = await Promise.all([
          fetchCSV<Asset>('/data/assets_master.csv').catch(() => []),
          fetchCSV<NtnbRecord>('/data/ntnb_history.csv').catch(() => [])
        ]);

        if (assetsData && assetsData.length > 0) {
          const actives = assetsData.filter(a => a.status_ativo === 'Ativo');
          setAllAssets(actives.length > 0 ? actives : assetsData);

          // Se tiver ticker na URL, carregar diretamente
          if (initialTicker) {
            const found = assetsData.find(a => (a.ticker || '').toUpperCase() === initialTicker);
            if (found) {
              handleSelectAsset(found);
            }
          }
        }

        if (ntnbData && ntnbData.length > 0) {
          // Extrair as taxas da data mais recente
          const latestDate = ntnbData[ntnbData.length - 1]?.date;
          const latestRows = ntnbData.filter(r => r.date === latestDate);

          if (latestRows.length > 0) {
            const parsedList = latestRows.map(r => ({
              nome: r.titulo_nome || `NTN-B ${r.vertice_ano}`,
              ano: parseInt(r.vertice_ano || '2030', 10),
              vencimento: r.vencimento_iso || `${r.vertice_ano}-08-15`,
              taxa: parseFloat(r.taxa_indicativa || '7.5')
            })).sort((a, b) => a.ano - b.ano);

            setNtnbRecords(parsedList);
          }
        }
      } catch (err) {
        console.error('Erro ao carregar dados para a calculadora:', err);
      } finally {
        setLoadingData(false);
      }
    };

    loadAll();
  }, [initialTicker]);

  /* ================= 2. SELEÇÃO E MATCH INTELIGENTE DO ATIVO ================= */
  const handleSelectAsset = (a: Asset) => {
    setSelectedAsset(a);
    setSearchQuery(a.ticker);
    setShowSearchResults(false);

    const t = (a.tipo || '').toUpperCase();
    if (t.includes('CRI')) setAssetType('CRI');
    else if (t.includes('CRA')) setAssetType('CRA');
    else if (t.includes('DEB')) setAssetType('Debênture');
    else setAssetType('Outro');

    // Isenção de IR: Lei 12.431 ou CRI/CRA é isento para PF
    const isEx = (a.incentivada || '').toLowerCase() === 'sim' || 
                 (a.lei || '').includes('12.431') || 
                 t.includes('CRI') || 
                 t.includes('CRA');
    setIsExempt(isEx);

    setAssetName(`${a.issuer || 'Emissor'} (${a.ticker})`);

    // Indexador
    const idx = (a.indexador || '').toUpperCase();
    if (idx.includes('IPCA')) {
      setIndexador('IPCA');
    } else if (idx.includes('DI') || idx.includes('CDI')) {
      setIndexador('CDI');
      if (idx.includes('%')) {
        setCdiMode('pct');
      } else {
        setCdiMode('spread');
      }
    } else {
      setIndexador('PRE');
    }

    // Taxa preferencial: B3 primeiro, depois Anbima, depois emissão
    const rB3 = parseFloat(a.taxa_negocio_b3 || '');
    const rAnb = parseFloat(a.taxa_indicativa_anbima || a.taxa_mercado || '');
    const rEmiss = parseFloat(a.taxa_emissao || '');

    const bestRate = !isNaN(rB3) && rB3 > 0 ? rB3 : (!isNaN(rAnb) && rAnb > 0 ? rAnb : (!isNaN(rEmiss) ? rEmiss : 7.50));
    setInputRate(Number(bestRate.toFixed(4)));

    // Prazo / Vencimento / Duration
    let dur = parseFloat(a.duration || '');
    if (isNaN(dur) || dur <= 0) dur = 3.5;
    setDurationYears(Number(dur.toFixed(2)));

    if (a.vencimento) {
      const parts = a.vencimento.split('-');
      if (parts.length === 3) {
        const vDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        const diffDays = Math.max(30, Math.round((vDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
        const y = diffDays / 365.25;
        setTenorYears(Number(y.toFixed(2)));

        // Match inteligente da NTN-B mais próxima
        const vYear = vDate.getFullYear();
        const bestNtnb = ntnbRecords.reduce((prev, curr) => {
          return Math.abs(curr.ano - vYear) < Math.abs(prev.ano - vYear) ? curr : prev;
        }, ntnbRecords[0]);

        if (bestNtnb) {
          setSelectedNtnb(bestNtnb);
          setManualBenchmarkRate(bestNtnb.taxa);
          setUseManualBenchmark(false);
        }
      }
    } else {
      setTenorYears(Math.max(1, Number((dur * 1.15).toFixed(2))));
    }
  };

  /* ================= 3. BUSCA RÁPIDA DE ATIVOS ================= */
  const searchResults = useMemo(() => {
    if (!searchQuery || searchQuery.trim().length < 2) return [];
    const q = searchQuery.toLowerCase().trim();
    return allAssets
      .filter(a => 
        (a.ticker && a.ticker.toLowerCase().includes(q)) ||
        (a.issuer && a.issuer.toLowerCase().includes(q)) ||
        (a.isin && a.isin.toLowerCase().includes(q))
      )
      .slice(0, 10);
  }, [searchQuery, allAssets]);

  /* ================= 4. CÁLCULOS MATEMÁTICOS DE MERCADO ================= */
  const daysToMaturity = Math.round(tenorYears * 365.25);
  const taxInfo = useMemo(() => getIncomeTaxRate(daysToMaturity, isExempt), [daysToMaturity, isExempt]);
  const irRateGov = useMemo(() => getIncomeTaxRate(daysToMaturity, false).rate, [daysToMaturity]);

  // Taxa do Benchmark (Governo Federal / Título Público)
  const govBenchmarkRate = useManualBenchmark ? manualBenchmarkRate : selectedNtnb.taxa;

  // Gross-Up Tributário:
  // Se isento, qual a taxa bruta de uma NTN-B tributada necessária para empatar?
  const grossUpRate = useMemo(() => {
    if (isExempt) {
      return calcGrossUpRate(inputRate, irRateGov);
    } else {
      return inputRate;
    }
  }, [isExempt, inputRate, irRateGov]);

  // Prêmio de Risco Real (Spread de Crédito sobre o Governo):
  // Se o papel for isento: comparamos o Gross-up com a NTN-B bruta
  // Se o papel for tributado: comparamos a taxa bruta com a NTN-B bruta
  const creditSpreadBps = useMemo(() => {
    const spreadPct = grossUpRate - govBenchmarkRate;
    return Math.round(spreadPct * 100);
  }, [grossUpRate, govBenchmarkRate]);

  // Breakeven Inflation (Inflação de Indiferença):
  // Qual inflação anual faz o papel IPCA+ empatar com um CDB 100% CDI a Selic de 10.5%?
  const breakevenInflation = useMemo(() => {
    if (indexador === 'IPCA') {
      return calcBreakevenInflation(
        inputRate,
        isExempt,
        taxInfo.rate,
        customCdi,
        { mode: 'pct', value: 100 },
        irRateGov,
        tenorYears
      );
    }
    return 0;
  }, [indexador, inputRate, isExempt, taxInfo.rate, customCdi, irRateGov, tenorYears]);

  /* ================= 5. MATRIZ DE CENÁRIOS MACROECONÔMICOS ================= */
  const scenarios = useMemo(() => {
    const list = [
      {
        id: 'deflacao',
        name: 'Inflação Fraca',
        ipca: 3.0,
        cdi: 8.5,
        desc: 'Economia desaquecida e cortes de juros pelo Copom'
      },
      {
        id: 'neutro',
        name: 'Meta / Neutro',
        ipca: 4.0,
        cdi: 10.5,
        desc: 'Cenário central Focus com inflação ancorada'
      },
      {
        id: 'alerta',
        name: 'Inflação Elevada',
        ipca: 5.5,
        cdi: 12.0,
        desc: 'Pressão fiscal e juros mais altos por mais tempo'
      },
      {
        id: 'estresse',
        name: 'Estresse Severo',
        ipca: 7.5,
        cdi: 14.5,
        desc: 'Choque cambial/commodities e desancoragem forte'
      },
      {
        id: 'custom',
        name: 'Personalizado',
        ipca: customIpca,
        cdi: customCdi,
        desc: 'Seus parâmetros customizados de IPCA e CDI'
      }
    ];

    return list.map(sc => {
      // 1. Crédito Privado
      let cpNominal = 0;
      if (indexador === 'IPCA') {
        cpNominal = calcNominalRate(inputRate, sc.ipca);
      } else if (indexador === 'CDI') {
        if (cdiMode === 'pct') {
          cpNominal = (sc.cdi * inputRate) / 100;
        } else {
          cpNominal = sc.cdi + inputRate;
        }
      } else {
        cpNominal = inputRate;
      }

      const cpResult = calcFutureValue(principalAmount, cpNominal, tenorYears, taxInfo.rate, isExempt);

      // 2. Título Público Benchmark (NTN-B tributada)
      const govNominal = calcNominalRate(govBenchmarkRate, sc.ipca);
      const govResult = calcFutureValue(principalAmount, govNominal, tenorYears, irRateGov, false);

      // 3. CDB 100% CDI (tributado)
      const cdiResult = calcFutureValue(principalAmount, sc.cdi, tenorYears, irRateGov, false);

      // 4. Poupança (TR + 6.17% a.a. ou 70% Selic se < 8.5%)
      const poupRate = sc.cdi < 8.5 ? sc.cdi * 0.70 : 6.17;
      const poupResult = calcFutureValue(principalAmount, poupRate, tenorYears, 0, true);

      // Ganho adicional líquido em relação ao Tesouro Direto
      const netExcessVsGov = cpResult.futureValueNet - govResult.futureValueNet;

      return {
        ...sc,
        cpNominal: Number(cpNominal.toFixed(2)),
        cpEffectiveNet: Number(cpResult.effectiveAnnualNetRate.toFixed(2)),
        cpFutureNet: Math.round(cpResult.futureValueNet),
        cpNetProfit: Math.round(cpResult.totalProfitNet),
        govFutureNet: Math.round(govResult.futureValueNet),
        cdiFutureNet: Math.round(cdiResult.futureValueNet),
        poupFutureNet: Math.round(poupResult.futureValueNet),
        netExcessVsGov: Math.round(netExcessVsGov)
      };
    });
  }, [
    indexador,
    inputRate,
    cdiMode,
    tenorYears,
    taxInfo.rate,
    isExempt,
    principalAmount,
    govBenchmarkRate,
    irRateGov,
    customIpca,
    customCdi
  ]);

  /* ================= 6. CRONOGRAMA DE CUPONS E AMORTIZAÇÃO ================= */
  const baseNominalRate = useMemo(() => {
    return indexador === 'IPCA' ? calcNominalRate(inputRate, customIpca) : inputRate;
  }, [indexador, inputRate, customIpca]);

  const cashFlowResult = useMemo<CashFlowScheduleResult>(() => {
    return generateCashFlowSchedule(
      principalAmount,
      baseNominalRate,
      tenorYears,
      taxInfo.rate,
      isExempt,
      couponFreq,
      amortSchedule,
      reinvestStrategy,
      reinvestRate
    );
  }, [
    principalAmount,
    baseNominalRate,
    tenorYears,
    taxInfo.rate,
    isExempt,
    couponFreq,
    amortSchedule,
    reinvestStrategy,
    reinvestRate
  ]);

  /* ================= 7. TRAJETÓRIA E DISPERSÃO DE MTM (PULL-TO-PAR) ================= */
  const mtmImpact = useMemo(() => {
    return calcMtmPriceShock(baseNominalRate, durationYears, curveShockBps);
  }, [baseNominalRate, durationYears, curveShockBps]);

  const trajectoryData = useMemo<TrajectoryPoint[]>(() => {
    return generateMtmTrajectory(principalAmount, baseNominalRate, tenorYears, durationYears, curveShockBps);
  }, [principalAmount, baseNominalRate, tenorYears, durationYears, curveShockBps]);

  /* ================= 8. COPIAR ANÁLISE EXECUTIVA ================= */
  const handleCopyAnalysis = () => {
    const text = `📊 *FIXDATA — ANÁLISE DE EQUIVALÊNCIA & RISCO*
──────────────────────────────
🔹 *Ativo Analisado:* ${assetName}
🔹 *Tipo & Isenção:* ${assetType} (${isExempt ? 'Isento de IR' : 'Tributado - IR ' + (taxInfo.rate * 100).toFixed(1) + '%'})
🔹 *Taxa Contratada:* ${indexador === 'IPCA' ? `IPCA + ${inputRate.toFixed(2)}% a.a.` : `${inputRate.toFixed(2)}%`}
🔹 *Vencimento & Duration:* ${tenorYears.toFixed(1)} anos (Duration ${durationYears.toFixed(1)} anos)

🏛️ *COMPARATIVO COM TÍTULO PÚBLICO:*
• *Título Benchmark:* ${selectedNtnb.nome} (${govBenchmarkRate.toFixed(2)}% a.a.)
• *Gross-up Bruto Equivalente:* ${grossUpRate.toFixed(2)}% a.a.
• *Prêmio de Risco Real (Spread):* ${creditSpreadBps > 0 ? `+${creditSpreadBps} bps (+${(creditSpreadBps / 100).toFixed(2)}% a.a.)` : `${creditSpreadBps} bps`}

📈 *PROJEÇÃO NO CENÁRIO CENTRAL (IPCA ${customIpca}% | Aporte R$ ${principalAmount.toLocaleString('pt-BR')}):*
• *Saldo Líquido no Vencimento:* R$ ${scenarios[1].cpFutureNet.toLocaleString('pt-BR')}
• *Ganho Líquido a mais que o Tesouro:* +R$ ${scenarios[1].netExcessVsGov.toLocaleString('pt-BR')}
• *Inflação de Indiferença (Breakeven vs CDI):* ${breakevenInflation.toFixed(2)}% a.a.

🔍 Fonte: FixData (https://meucreditoprivado.netlify.app/calculadora)`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="min-h-screen bg-slate-50/50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* HEADER DA PÁGINA */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-xs border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <div className="flex items-center gap-2.5 text-blue-600 font-bold text-xs uppercase tracking-wider mb-1.5">
              <span className="p-1.5 bg-blue-50 rounded-lg"><Scale size={16} /></span>
              Inteligência de Mercado & Gross-Up
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Calculadora de Equivalência & Simulador de Curva
            </h1>
            <p className="text-slate-500 text-sm mt-1 max-w-3xl">
              Equalize títulos isentos com tributados via Gross-Up, meça o prêmio de risco real contra a NTN-B do governo e teste o comportamento da sua rentabilidade sob choques macroeconômicos e marcação a mercado.
            </p>
          </div>

          <button
            onClick={handleCopyAnalysis}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition duration-150 shrink-0"
            title="Copiar resumo textual para colar no WhatsApp, e-mail ou relatório"
          >
            {copied ? <Check size={16} className="text-emerald-300" /> : <Copy size={16} />}
            <span>{copied ? 'Análise Copiada!' : 'Copiar Análise Executiva'}</span>
          </button>
        </div>

        {/* GRID DE ENTRADA: BUSCA DE ATIVO & PARÂMETROS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* COLUNA 1 & 2: DADOS DO PAPEL */}
          <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-xs border border-slate-200 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <Calculator size={20} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">1. Ativo de Crédito Privado</h2>
                  <p className="text-xs text-slate-500">Selecione um ativo da base ou personalize os dados livremente</p>
                </div>
              </div>

              {/* Botão Reset / Limpar */}
              {selectedAsset && (
                <button
                  onClick={() => {
                    setSelectedAsset(null);
                    setSearchQuery('');
                    setAssetName('Simulação Genérica');
                  }}
                  className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-rose-600 font-semibold transition"
                >
                  <RotateCcw size={13} />
                  <span>Limpar Seleção</span>
                </button>
              )}
            </div>

            {/* BARRA DE AUTOCOMPLETE COM OS 10.500 ATIVOS */}
            <div className="relative">
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                <span>Buscar por Código (Ticker), Emissor ou Devedor:</span>
                <span className="text-[11px] text-blue-600 font-medium">10.500+ títulos vivos</span>
              </label>
              <div className="relative">
                <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Ex: VALE35, 20B0980166, CRA JBS, REDE D'OR..."
                  value={searchQuery}
                  onChange={e => {
                    setSearchQuery(e.target.value);
                    setShowSearchResults(true);
                  }}
                  onFocus={() => setShowSearchResults(true)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition outline-none"
                />
              </div>

              {/* Dropdown de Resultados da Busca */}
              {showSearchResults && searchResults.length > 0 && (
                <div className="absolute z-40 top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden max-h-72 overflow-y-auto">
                  {searchResults.map(a => (
                    <div
                      key={a.ticker}
                      onClick={() => handleSelectAsset(a)}
                      className="p-3 hover:bg-blue-50/70 cursor-pointer transition flex items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-900 text-sm">{a.ticker}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getTipoBadgeClass(a.tipo)}`}>
                            {a.tipo || 'Título'}
                          </span>
                          {a.rating_normalizado && a.rating_normalizado !== 'Sem Rating' && (
                            <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${getRatingBadgeClass(a.rating_normalizado)}`}>
                              {a.rating_normalizado}
                            </span>
                          )}
                        </div>
                        <div className="text-slate-600 font-medium truncate max-w-sm sm:max-w-md mt-0.5">
                          {a.issuer || 'Emissor'}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="font-bold text-blue-600">
                          {a.indexador || 'IPCA'} {a.taxa_mercado ? `+ ${parseFloat(a.taxa_mercado).toFixed(2)}%` : ''}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Venc: {a.vencimento ? a.vencimento.split('-')[0] : '-'} | Dur: {a.duration ? `${parseFloat(a.duration).toFixed(1)}a` : '-'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* SELETORES DE TIPO E ISENÇÃO */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Tipo do Ativo
                </label>
                <select
                  value={assetType}
                  onChange={e => {
                    const val = e.target.value as any;
                    setAssetType(val);
                    if (val === 'CRI' || val === 'CRA') setIsExempt(true);
                  }}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:bg-white focus:border-blue-500 outline-none"
                >
                  <option value="CRI">CRI (Certificado de Recebíveis Imob.)</option>
                  <option value="CRA">CRA (Certificado de Recebíveis do Agro)</option>
                  <option value="Debênture">Debênture Corporativa</option>
                  <option value="Outro">Outro Título / CDB</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center">
                  <span>Tributação IR (Pessoa Física)</span>
                  <InfoTooltip
                    title="Isenção Fiscal de Crédito Privado"
                    content="CRIs, CRAs e Debêntures Incentivadas (Lei 12.431/2011) são 100% isentos de Imposto de Renda para investidores pessoas físicas. Debêntures comuns e CDBs seguem a tabela regressiva de 22,5% a 15%."
                    example="Um título isento de 7,5% líquido supera com folga um título tributado de 8,5% cujo retorno líquido após IR de 15% fica em apenas 7,22%."
                  />
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsExempt(true)}
                    className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs transition ${
                      isExempt 
                      ? 'bg-emerald-600 text-white shadow-xs' 
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    🌱 100% Isento
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsExempt(false)}
                    className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs transition ${
                      !isExempt 
                      ? 'bg-amber-600 text-white shadow-xs' 
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    🏛️ Tributado ({taxInfo.rate * 100}%)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Indexador do Papel
                </label>
                <div className="grid grid-cols-3 gap-1">
                  {(['IPCA', 'CDI', 'PRE'] as const).map(idx => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setIndexador(idx)}
                      className={`py-2 text-xs font-bold rounded-xl transition ${
                        indexador === idx 
                        ? 'bg-blue-600 text-white shadow-xs' 
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {idx === 'PRE' ? 'Pré-fixado' : idx}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* TAXA DE COMPRA E BOTÕES RÁPIDOS */}
            <div className="pt-2 bg-slate-50/70 p-4 rounded-xl border border-slate-200/80 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-xs font-bold text-slate-800 flex items-center">
                  <span>Taxa Contratada / Ofertada pela Corretora:</span>
                  <InfoTooltip
                    title="Taxa de Compra (Yield to Maturity)"
                    content="Esta é a taxa anual prometida no momento da compra. Se o papel for IPCA+, é a taxa real acima da inflação. Se for CDI, pode ser % do CDI (ex: 110%) ou CDI + spread (ex: CDI + 2,0%)."
                  />
                </label>

                {/* BOTÕES RÁPIDOS SELECIONADOS DO ATIVO */}
                {selectedAsset && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {selectedAsset.taxa_negocio_b3 && (
                      <button
                        type="button"
                        onClick={() => setInputRate(parseFloat(selectedAsset.taxa_negocio_b3 || ''))}
                        className="px-2 py-1 bg-white hover:bg-blue-50 border border-slate-200 text-blue-600 rounded-lg text-[11px] font-bold transition"
                        title="Usar taxa média ponderada dos negócios fechados no balcão da B3"
                      >
                        ⚡ B3: {parseFloat(selectedAsset.taxa_negocio_b3).toFixed(2)}%
                      </button>
                    )}
                    {(selectedAsset.taxa_indicativa_anbima || selectedAsset.taxa_mercado) && (
                      <button
                        type="button"
                        onClick={() => setInputRate(parseFloat(selectedAsset.taxa_indicativa_anbima || selectedAsset.taxa_mercado || ''))}
                        className="px-2 py-1 bg-white hover:bg-blue-50 border border-slate-200 text-slate-700 rounded-lg text-[11px] font-bold transition"
                        title="Usar taxa indicativa diária oficial divulgada pela ANBIMA"
                      >
                        🏛️ ANBIMA: {parseFloat(selectedAsset.taxa_indicativa_anbima || selectedAsset.taxa_mercado || '').toFixed(2)}%
                      </button>
                    )}
                    {selectedAsset.taxa_emissao && (
                      <button
                        type="button"
                        onClick={() => setInputRate(parseFloat(selectedAsset.taxa_emissao || ''))}
                        className="px-2 py-1 bg-white hover:bg-blue-50 border border-slate-200 text-slate-600 rounded-lg text-[11px] font-bold transition"
                        title="Usar taxa original de lançamento na emissão primária"
                      >
                        📜 Emissão: {parseFloat(selectedAsset.taxa_emissao).toFixed(2)}%
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <input
                    type="number"
                    step="0.01"
                    value={inputRate}
                    onChange={e => setInputRate(parseFloat(e.target.value) || 0)}
                    className="w-full pl-4 pr-12 py-2.5 bg-white border border-slate-300 rounded-xl font-black text-lg text-blue-600 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 font-bold text-xs text-slate-400">
                    {indexador === 'IPCA' ? '% a.a. + IPCA' : (indexador === 'CDI' && cdiMode === 'pct' ? '% do CDI' : '% a.a.')}
                  </span>
                </div>

                {indexador === 'CDI' && (
                  <div className="flex gap-1 bg-slate-200 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setCdiMode('pct')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                        cdiMode === 'pct' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600'
                      }`}
                    >
                      % do CDI
                    </button>
                    <button
                      type="button"
                      onClick={() => setCdiMode('spread')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                        cdiMode === 'spread' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600'
                      }`}
                    >
                      CDI + Spread
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* PRAZO, DURATION E APORTE */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center">
                  <span>Prazo Vencimento (anos)</span>
                  <InfoTooltip
                    title="Prazo Contratual Residual"
                    content="Tempo restante até a data final de vencimento do título. Define qual a alíquota de IR aplicável de acordo com a tabela regressiva."
                  />
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="0.2"
                    max="35"
                    value={tenorYears}
                    onChange={e => setTenorYears(parseFloat(e.target.value) || 1)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:bg-white outline-none"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium">
                    ~{daysToMaturity}d
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center">
                  <span>Duration de Macaulay (anos)</span>
                  <InfoTooltip
                    title="Duration e Sensibilidade"
                    content="A duration é o prazo médio ponderado de recebimento dos fluxos de caixa (amortizações e juros). É ela que dita a intensidade da marcação a mercado se as taxas de juros subirem ou caírem."
                    formula="D_mod = Duration / (1 + y)"
                    example="Um papel com duration de 4 anos desvaloriza cerca de 4% se a taxa de juros do mercado subir 1 ponto percentual (+100 bps)."
                  />
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="30"
                  value={durationYears}
                  onChange={e => setDurationYears(parseFloat(e.target.value) || 1)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:bg-white outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Valor do Aporte Inicial (R$)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">R$</span>
                  <input
                    type="number"
                    step="5000"
                    value={principalAmount}
                    onChange={e => setPrincipalAmount(parseFloat(e.target.value) || 0)}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:bg-white outline-none"
                  />
                </div>
              </div>
            </div>

            {/* CONFIGURAÇÃO AVANÇADA: CUPONS E AMORTIZAÇÃO */}
            <div className="pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAdvancedCashflowConfig(!showAdvancedCashflowConfig)}
                className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-xl text-xs font-bold text-slate-700 transition"
              >
                <div className="flex items-center gap-2">
                  <Receipt size={16} className="text-blue-600" />
                  <span>Estrutura de Pagamento & Amortização (Avançado)</span>
                  <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                    {couponFreq === 'bullet' ? 'Bullet' : `Cupons ${couponFreq === 'semiannual' ? 'Semestrais' : couponFreq === 'annual' ? 'Anuais' : 'Mensais'}`}
                    {amortSchedule !== 'bullet' ? ` + Amortização` : ''}
                  </span>
                </div>
                {showAdvancedCashflowConfig ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {showAdvancedCashflowConfig && (
                <div className="mt-3 p-4 bg-slate-50/70 border border-slate-200 rounded-xl space-y-4 animate-in fade-in duration-150">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1 flex items-center">
                        <span>Frequência dos Cupons (Juros)</span>
                        <InfoTooltip
                          title="Frequência de Pagamento de Juros"
                          content="Define se o título distribui juros periodicamente (semestral, anual ou mensal) ou se capitaliza tudo para o vencimento (Bullet). Cupons periódicos geram fluxo de renda, mas trazem risco de reinvestimento."
                        />
                      </label>
                      <select
                        value={couponFreq}
                        onChange={e => setCouponFreq(e.target.value as any)}
                        className="w-full p-2 bg-white border border-slate-200 rounded-lg font-semibold text-slate-800 outline-none"
                      >
                        <option value="semiannual">Semestral (Padrão NTN-B e Mercado)</option>
                        <option value="annual">Anual</option>
                        <option value="monthly">Mensal (Comum em CRIs)</option>
                        <option value="bullet">No Vencimento (Bullet - Sem cupom)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1 flex items-center">
                        <span>Amortização do Principal</span>
                        <InfoTooltip
                          title="Cronograma de Amortização"
                          content="Indica quando a empresa devedora começa a devolver o valor investido. Papéis que amortizam aos poucos reduzem drasticamente o risco de crédito e diminuem a duration do papel."
                        />
                      </label>
                      <select
                        value={amortSchedule}
                        onChange={e => setAmortSchedule(e.target.value as any)}
                        className="w-full p-2 bg-white border border-slate-200 rounded-lg font-semibold text-slate-800 outline-none"
                      >
                        <option value="bullet">Bullet (100% no Vencimento)</option>
                        <option value="constant">Constante (Amortização Periódica)</option>
                        <option value="grace_half">Carência 50% + Amortização Final</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1 flex items-center">
                        <span>Destino dos Cupons Recebidos</span>
                        <InfoTooltip
                          title="Estratégia de Reinvestimento"
                          content="O retorno total da renda fixa depende do que você faz com o dinheiro recebido. Reinvestir na mesma taxa simula a TIR contratada; reinvestir no CDI simula a liquidez do dia a dia; ou não reinvestir simula consumo/renda passiva."
                        />
                      </label>
                      <select
                        value={reinvestStrategy}
                        onChange={e => setReinvestStrategy(e.target.value as any)}
                        className="w-full p-2 bg-white border border-slate-200 rounded-lg font-semibold text-slate-800 outline-none"
                      >
                        <option value="contracted_yield">Reinvestir à Taxa Contratada (TIR)</option>
                        <option value="cdi">Reinvestir no CDI Atual ({customCdi}%)</option>
                        <option value="none">Não Reinvestir (Renda Passiva no Bolso)</option>
                      </select>
                    </div>
                  </div>

                  {/* Sincronizar duration estimada pelo fluxo */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-200/60 text-xs">
                    <span className="text-slate-600 font-medium">
                      Duration calculada pelo cronograma de fluxos: <strong className="text-blue-700 font-mono">{cashFlowResult.macaulayDurationEstimated} anos</strong>
                      {cashFlowResult.macaulayDurationEstimated !== durationYears && (
                        <span className="text-slate-400 block sm:inline sm:ml-1">
                          (Diferente dos {durationYears}a manuais)
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => setDurationYears(cashFlowResult.macaulayDurationEstimated)}
                      className="px-3 py-1 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-600 rounded-lg font-bold text-[11px] transition shrink-0"
                    >
                      ⚡ Aplicar Duration Calculada ({cashFlowResult.macaulayDurationEstimated}a)
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* COLUNA 3: MATCH COM TÍTULO PÚBLICO (GOVERNO BENCHMARK) */}
          <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200 space-y-5 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">2. Título Público Benchmark</h2>
                  <p className="text-xs text-slate-500">Ativo livre de risco federal para comparação</p>
                </div>
              </div>

              {/* SELEÇÃO DO TÍTULO PÚBLICO */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>NTN-B / Tesouro de Referência:</span>
                  <span className="text-[11px] text-emerald-600 font-semibold">Base ANBIMA Oficial</span>
                </label>
                <select
                  value={selectedNtnb.nome}
                  onChange={e => {
                    const found = ntnbRecords.find(n => n.nome === e.target.value);
                    if (found) {
                      setSelectedNtnb(found);
                      setManualBenchmarkRate(found.taxa);
                      setUseManualBenchmark(false);
                    }
                  }}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:bg-white focus:border-emerald-500 outline-none"
                >
                  {ntnbRecords.map(n => (
                    <option key={n.nome} value={n.nome}>
                      {n.nome} — Taxa: {n.taxa.toFixed(2)}% a.a. (Venc: {n.vencimento})
                    </option>
                  ))}
                </select>
              </div>

              {/* TAXA DO GOVERNO EXIBIDA COM OVERRIDE MANUAL */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-600">Taxa Atual da {selectedNtnb.nome}:</span>
                  <button
                    type="button"
                    onClick={() => setUseManualBenchmark(!useManualBenchmark)}
                    className="text-[11px] font-bold text-blue-600 hover:underline"
                  >
                    {useManualBenchmark ? 'Voltar para Taxa Oficial' : 'Editar Taxa Manualmente'}
                  </button>
                </div>

                {useManualBenchmark ? (
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      value={manualBenchmarkRate}
                      onChange={e => setManualBenchmarkRate(parseFloat(e.target.value) || 0)}
                      className="w-full p-2 bg-white border border-emerald-400 rounded-lg text-sm font-black text-emerald-700 outline-none"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">% a.a.</span>
                  </div>
                ) : (
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-black text-emerald-700 tracking-tight">
                      IPCA + {govBenchmarkRate.toFixed(2)}%
                    </span>
                    <span className="text-[11px] text-slate-400 font-medium">Tributado (15% IR)</span>
                  </div>
                )}
              </div>

              {/* BOX DIDÁTICO DO PORQUÊ DA COMPARAÇÃO */}
              <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-100 text-xs text-blue-900 leading-relaxed space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-blue-700">
                  <Sparkles size={14} />
                  <span>Por que comparamos com a NTN-B?</span>
                </div>
                <p className="text-[11px] text-blue-800">
                  O Tesouro IPCA+ é o ativo com <strong>menor risco de crédito da economia brasileira</strong>. Qualquer crédito privado (CRI, CRA ou Debênture) DEVE pagar um prêmio extra (spread) para compensar o risco da empresa devedora.
                </p>
              </div>
            </div>

            {/* STATUS DO MATCH */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Alíquota IR do Governo:</span>
              <span className="font-bold text-slate-700">15,0% (Longo Prazo)</span>
            </div>
          </div>
        </div>

        {/* 3. PLACAR EXECUTIVO DE VEREDITO (CARDS DE RESUMO) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">

          {/* CARD 1: TAXA CONTRATADA VS BENCHMARK */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-2">
                <span>Taxa Contratada</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isExempt ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  {isExempt ? 'Isento' : 'Tributado'}
                </span>
              </div>
              <div className="text-2xl font-black text-slate-900 tracking-tight">
                {indexador === 'IPCA' ? `IPCA + ${inputRate.toFixed(2)}%` : `${inputRate.toFixed(2)}%`}
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500 flex justify-between items-center">
              <span>Benchmark Governo:</span>
              <span className="font-bold text-slate-700">IPCA + {govBenchmarkRate.toFixed(2)}%</span>
            </div>
          </div>

          {/* CARD 2: GROSS-UP TRIBUTÁRIO */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between relative overflow-hidden">
            <div className="absolute -right-4 -bottom-4 opacity-5 text-blue-900 pointer-events-none">
              <Scale size={90} />
            </div>
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-2">
                <span className="flex items-center">
                  Gross-Up Equivalente
                  <InfoTooltip
                    title="Conceito de Gross-Up de Renda Fixa"
                    content="É a taxa bruta que um investimento tributado (como CDB ou NTN-B com 15% de IR) precisaria pagar para entregar exatamente a mesma rentabilidade líquida deste papel isento no seu bolso."
                    formula="Taxa_GrossUp = Taxa_Isenta / (1 - Alíquota_IR)"
                    example={`Seu papel isento de IPCA + ${inputRate.toFixed(2)}% equivale a uma NTN-B tributada de IPCA + ${grossUpRate.toFixed(2)}%.`}
                  />
                </span>
                <span className="text-blue-600 font-bold text-[11px]">IR 15%</span>
              </div>
              <div className="text-2xl font-black text-blue-600 tracking-tight">
                {indexador === 'IPCA' ? `IPCA + ${grossUpRate.toFixed(2)}%` : `${grossUpRate.toFixed(2)}%`}
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500 flex justify-between items-center">
              <span>Ganho Tributário Bruto:</span>
              <span className="font-bold text-emerald-600">+{((grossUpRate - inputRate)).toFixed(2)}% a.a.</span>
            </div>
          </div>

          {/* CARD 3: SPREAD DE CRÉDITO REAL */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-2">
                <span className="flex items-center">
                  Prêmio de Risco (Spread)
                  <InfoTooltip
                    title="Prêmio de Risco de Crédito (Spread)"
                    content="A diferença entre a taxa equivalente do crédito privado e o título público federal (livre de risco). Mede quantos pontos-base a mais você recebe para emprestar para esta empresa em vez de emprestar para o Governo Federal."
                    formula="Spread (bps) = (Taxa_GrossUp - Taxa_NTNB) * 100"
                    example="100 bps equivalem a 1,00% ao ano de rentabilidade extra acima do governo."
                  />
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  creditSpreadBps >= 150 ? 'bg-emerald-100 text-emerald-700' :
                  creditSpreadBps >= 50 ? 'bg-blue-100 text-blue-700' :
                  'bg-rose-100 text-rose-700'
                }`}>
                  {creditSpreadBps >= 150 ? 'Excelente Prêmio' : creditSpreadBps >= 50 ? 'Prêmio Saudável' : 'Prêmio Baixo'}
                </span>
              </div>
              <div className={`text-2xl font-black tracking-tight ${creditSpreadBps >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {creditSpreadBps >= 0 ? `+${creditSpreadBps} bps` : `${creditSpreadBps} bps`}
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500 flex justify-between items-center">
              <span>Em % ao ano sobre NTN-B:</span>
              <span className="font-bold text-slate-800">
                {creditSpreadBps >= 0 ? `+${(creditSpreadBps / 100).toFixed(2)}%` : `${(creditSpreadBps / 100).toFixed(2)}%`} a.a.
              </span>
            </div>
          </div>

          {/* CARD 4: BREAKEVEN INFLATION */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-2">
                <span className="flex items-center">
                  Ponto de Equilíbrio (vs CDI)
                  <InfoTooltip
                    title="Inflação de Indiferença (Breakeven)"
                    content="É a taxa de inflação média anual que faria este investimento render exatamente o mesmo que uma aplicação padrão de 100% do CDI."
                    example={`Se a inflação média anual ficar acima de ${breakevenInflation.toFixed(2)}%, este papel IPCA+ vencerá um CDB 100% CDI.`}
                  />
                </span>
                <span className="text-[11px] text-slate-400">Selic {customCdi}%</span>
              </div>
              <div className="text-2xl font-black text-slate-900 tracking-tight">
                {indexador === 'IPCA' ? `${breakevenInflation.toFixed(2)}% a.a.` : 'N/A'}
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500 flex justify-between items-center">
              <span>Se IPCA &gt; {breakevenInflation.toFixed(2)}%:</span>
              <span className="font-bold text-emerald-600">IPCA+ Vence o CDI</span>
            </div>
          </div>

        </div>

        {/* 4. MATRIZ DINÂMICA DE CENÁRIOS MACROECONÔMICOS */}
        <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg"><TrendingUp size={18} /></span>
                <h2 className="text-lg font-bold text-slate-900">3. Matriz de Cenários Macroeconômicos & Sensibilidade</h2>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Simulação de saldo líquido final e rentabilidade comparando o Crédito Privado com alternativas líquidas no vencimento de {tenorYears} anos (Aporte de R$ {principalAmount.toLocaleString('pt-BR')})
              </p>
            </div>

            {/* SLIDERS DO CENÁRIO CUSTOMIZADO */}
            <div className="flex items-center gap-4 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs">
              <div className="space-y-1">
                <div className="flex justify-between font-bold text-slate-700">
                  <span>IPCA Custom:</span>
                  <span className="text-blue-600">{customIpca.toFixed(1)}%</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="12"
                  step="0.5"
                  value={customIpca}
                  onChange={e => setCustomIpca(parseFloat(e.target.value))}
                  className="w-24 sm:w-28 accent-blue-600 cursor-pointer"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between font-bold text-slate-700">
                  <span>CDI Custom:</span>
                  <span className="text-blue-600">{customCdi.toFixed(1)}%</span>
                </div>
                <input
                  type="range"
                  min="6"
                  max="18"
                  step="0.5"
                  value={customCdi}
                  onChange={e => setCustomCdi(parseFloat(e.target.value))}
                  className="w-24 sm:w-28 accent-blue-600 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* TABELA DE CENÁRIOS RESPONSIVA */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-bold text-slate-500 bg-slate-50/50">
                  <th className="py-3 px-4">Cenário Macroeconômico</th>
                  <th className="py-3 px-4">Premissas (IPCA / CDI)</th>
                  <th className="py-3 px-4 text-blue-700 bg-blue-50/60 font-extrabold">
                    {assetName} (Líquido)
                  </th>
                  <th className="py-3 px-4">Tesouro IPCA+ (Líq)</th>
                  <th className="py-3 px-4">CDB 100% CDI (Líq)</th>
                  <th className="py-3 px-4 text-right font-black text-slate-900">
                    Vantagem R$ vs Tesouro
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                {scenarios.map(sc => (
                  <tr key={sc.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      <div>{sc.name}</div>
                      <div className="text-[11px] font-normal text-slate-400">{sc.desc}</div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 font-semibold">
                      <span className="text-blue-600">IPCA {sc.ipca.toFixed(1)}%</span> | <span className="text-slate-700">CDI {sc.cdi.toFixed(1)}%</span>
                    </td>
                    <td className="py-3.5 px-4 bg-blue-50/40">
                      <div className="font-black text-blue-600 text-sm sm:text-base">
                        R$ {sc.cpFutureNet.toLocaleString('pt-BR')}
                      </div>
                      <div className="text-[11px] font-bold text-blue-500">
                        {sc.cpEffectiveNet.toFixed(2)}% a.a. líquido (+{((sc.cpNetProfit / principalAmount) * 100).toFixed(1)}%)
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-700">
                        R$ {sc.govFutureNet.toLocaleString('pt-BR')}
                      </div>
                      <div className="text-[11px] text-slate-400">NTN-B 15% IR</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-700">
                        R$ {sc.cdiFutureNet.toLocaleString('pt-BR')}
                      </div>
                      <div className="text-[11px] text-slate-400">100% CDI Líquido</div>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <span className={`inline-flex items-center gap-1 font-black px-2.5 py-1 rounded-lg text-xs ${
                        sc.netExcessVsGov >= 0 
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        {sc.netExcessVsGov >= 0 ? `+ R$ ${sc.netExcessVsGov.toLocaleString('pt-BR')}` : `- R$ ${Math.abs(sc.netExcessVsGov).toLocaleString('pt-BR')}`}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 5. GRÁFICO DE DISPERSÃO E MARCAÇÃO A MERCADO (MTM / PULL-TO-PAR) */}
        <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg"><Sliders size={18} /></span>
                <h2 className="text-lg font-bold text-slate-900">4. Dispersão de Rentabilidade e Risco de Marcação a Mercado (MTM)</h2>
                <InfoTooltip
                  title="Marcação a Mercado (MTM) e Pull-to-Par"
                  content="Se você mantiver o papel até o vencimento contratual, você recebe exatamente a taxa combinada (carregamento puro). Porém, se precisar resgatar antes, o preço oscila conforme as curvas de juros. Esse gráfico demonstra o 'cone de dispersão' e como ele se afunila até zero no vencimento."
                  formula="Delta_PU = - Duration_Modificada * Delta_Taxa"
                  example="Abertura de +150 bps causa uma queda momentânea no saldo nos primeiros anos, mas que é 100% recuperada na data final."
                />
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Simulação do valor patrimonial (R$) ao longo do tempo sob choques de curva na saída antecipada vs carregamento até o vencimento.
              </p>
            </div>

            {/* SELETOR DE INTENSIDADE DO CHOQUE (BPS) */}
            <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
              <span className="text-xs font-bold text-slate-500 px-2">Estresse de Curva:</span>
              {[100, 150, 200, 300].map(bps => (
                <button
                  key={bps}
                  type="button"
                  onClick={() => setCurveShockBps(bps)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                    curveShockBps === bps 
                    ? 'bg-blue-600 text-white shadow-xs' 
                    : 'text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  ±{bps} bps
                </button>
              ))}
            </div>
          </div>

          {/* PAINEL DE IMPACTO DE PREÇO IMEDIATO */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50/70 p-4 rounded-xl border border-slate-200 text-xs">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-rose-100 text-rose-700 rounded-xl">
                <TrendingDown size={18} />
              </div>
              <div>
                <div className="text-slate-500 font-medium">Abertura de Curva (+{curveShockBps} bps):</div>
                <div className="text-rose-600 font-extrabold text-sm">
                  {mtmImpact.puChangePct.toFixed(2)}% no PU inicial
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
                <Calendar size={18} />
              </div>
              <div>
                <div className="text-slate-500 font-medium">Duration Modificada Inicial:</div>
                <div className="text-slate-900 font-extrabold text-sm">
                  {mtmImpact.modifiedDuration.toFixed(2)} anos
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                <TrendingUp size={18} />
              </div>
              <div>
                <div className="text-slate-500 font-medium">Fechamento de Curva (-{curveShockBps} bps):</div>
                <div className="text-emerald-600 font-extrabold text-sm">
                  +{Math.abs(mtmImpact.puChangePct).toFixed(2)}% no PU inicial
                </div>
              </div>
            </div>
          </div>

          {/* GRÁFICO DE CONE / ÁREA NO RECHARTS */}
          <div className="h-80 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trajectoryData} margin={{ top: 10, right: 30, left: 20, bottom: 10 }}>
                <defs>
                  <linearGradient id="colorBullish" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorStressed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  domain={['auto', 'auto']}
                  tickFormatter={val => `R$ ${(val / 1000).toFixed(0)}k`}
                />
                <RechartsTooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload as TrajectoryPoint;
                      return (
                        <div className="bg-slate-900 text-white p-3.5 rounded-xl shadow-xl border border-slate-700 text-xs space-y-1.5 min-w-[220px]">
                          <div className="font-bold text-blue-400 border-b border-slate-800 pb-1 flex justify-between">
                            <span>{label}</span>
                            <span className="text-slate-400 font-normal">Dur: {data.remainingDuration}a</span>
                          </div>
                          <div className="flex justify-between items-center text-emerald-400 font-semibold">
                            <span>Ganho de Capital (-{curveShockBps}bps):</span>
                            <span>R$ {data.bullishValue.toLocaleString('pt-BR')}</span>
                          </div>
                          <div className="flex justify-between items-center text-blue-300 font-bold">
                            <span>Carregamento Contratado:</span>
                            <span>R$ {data.baseNominalValue.toLocaleString('pt-BR')}</span>
                          </div>
                          <div className="flex justify-between items-center text-rose-400 font-semibold">
                            <span>Deságio de MTM (+{curveShockBps}bps):</span>
                            <span>R$ {data.stressedValue.toLocaleString('pt-BR')}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-800 italic">
                            *No vencimento, todas as trajetórias convergem para o valor contratado.
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend
                  wrapperStyle={{ paddingTop: '10px', fontSize: '12px' }}
                  formatter={(value) => {
                    if (value === 'bullishValue') return `Cenário Otimista: Fechamento de Juros (-${curveShockBps} bps)`;
                    if (value === 'baseNominalValue') return 'Carregamento Contratado (Hold-to-Maturity)';
                    if (value === 'stressedValue') return `Cenário de Estresse: Abertura de Juros (+${curveShockBps} bps)`;
                    return value;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="bullishValue"
                  stroke="#10b981"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorBullish)"
                />
                <Area
                  type="monotone"
                  dataKey="baseNominalValue"
                  stroke="#2563eb"
                  strokeWidth={3}
                  fillOpacity={0}
                />
                <Area
                  type="monotone"
                  dataKey="stressedValue"
                  stroke="#ef4444"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  fillOpacity={1}
                  fill="url(#colorStressed)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 5. CRONOGRAMA PERIÓDICO DE CUPONS & AMORTIZAÇÃO (CASH FLOW) */}
        <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg"><Receipt size={18} /></span>
                <h2 className="text-lg font-bold text-slate-900">5. Cronograma de Cupons, Amortização & Fluxo de Caixa</h2>
                <InfoTooltip
                  title="Impacto de Cupons Periódicos e Amortização"
                  content="Títulos com cupons semestrais ou amortização periódica devolvem parte dos recursos antes do vencimento final. Isso reduz substancialmente a duration do papel e o risco de crédito, mas exige atenção ao reinvestimento desses fluxos."
                  example="Uma debênture de 6 anos com amortizações semestrais tem duration real de apenas ~3,1 anos, reduzindo pela metade a volatilidade de marcação a mercado!"
                />
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Projeção do dinheiro que pinga na sua conta período a período ({couponFreq === 'bullet' ? 'Bullet no Vencimento' : `Cupons ${couponFreq === 'semiannual' ? 'Semestrais' : couponFreq === 'annual' ? 'Anuais' : 'Mensais'}`}, {amortSchedule === 'bullet' ? 'Amortização Única no Fim' : amortSchedule === 'constant' ? 'Amortização Constante' : 'Carência 50% + Amortização'}).
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowCashFlowDetail(!showCashFlowDetail)}
                className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
              >
                {showCashFlowDetail ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                <span>{showCashFlowDetail ? 'Ocultar Tabela de Fluxo' : 'Ver Tabela Detalhada'}</span>
              </button>
            </div>
          </div>

          {/* BARRA DE ESCOLHA EXPLÍCITA DA TAXA DE REINVESTIMENTO DOS CUPONS */}
          <div className="p-4 bg-slate-50/90 rounded-2xl border border-slate-200/90 space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Wallet size={15} className="text-blue-600" />
                  <span>Taxa de Reinvestimento dos Cupons e Amortizações:</span>
                  <InfoTooltip
                    title="Onde Reinvestir os Proventos Recebidos?"
                    content="A taxa de retorno efetiva no final do investimento depende da taxa em que você reaplica os cupons. Você pode escolher reinvestir na própria taxa contratada do título (TIR clássica), na taxa do DI/CDI projetada ou não reinvestir (usando os cupons como renda passiva)."
                  />
                </label>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Alterne entre a rentabilidade teórica do contrato e o DI de liquidez diária
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setReinvestStrategy('contracted_yield')}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                    reinvestStrategy === 'contracted_yield'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span>⚡ Taxa Contratada ({baseNominalRate.toFixed(2)}% a.a.)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setReinvestStrategy('cdi')}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                    reinvestStrategy === 'cdi'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span>📊 Taxa do DI / CDI ({reinvestRate.toFixed(2)}% a.a.)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setReinvestStrategy('none')}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                    reinvestStrategy === 'none'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span>💰 Renda Passiva (No Bolso)</span>
                </button>
              </div>
            </div>

            {/* SE ESTIVER NO MODO CDI: CAMPO EDITÁVEL E ATALHOS */}
            {reinvestStrategy === 'cdi' && (
              <div className="pt-3 border-t border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs bg-white p-3 rounded-xl border border-blue-100">
                <div className="flex items-center gap-2.5">
                  <span className="font-bold text-slate-800">Projeção da Taxa DI de Reinvestimento:</span>
                  <div className="relative w-32">
                    <input
                      type="number"
                      step="0.25"
                      min="1"
                      max="30"
                      value={reinvestRate}
                      onChange={e => setReinvestRate(parseFloat(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-blue-400 rounded-lg text-xs font-black text-blue-700 outline-none text-right pr-7"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">% a.a.</span>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-[11px]">
                  <span className="text-slate-500 font-semibold mr-1">Atalhos DI:</span>
                  {[9.0, 10.5, 11.25, 12.0, 13.5].map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setReinvestRate(r)}
                      className={`px-2 py-1 rounded font-bold border transition ${
                        reinvestRate === r
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                      }`}
                    >
                      {r}%
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* CARDS RESUMO DO FLUXO DE CAIXA */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-emerald-50/70 border border-emerald-100 rounded-xl">
              <div className="text-xs font-semibold text-emerald-800 flex items-center justify-between">
                <span>Total em Cupons Líquidos</span>
                <span className="text-[10px] bg-emerald-200 text-emerald-900 px-1.5 py-0.2 rounded font-bold">Juros</span>
              </div>
              <div className="text-xl font-black text-emerald-700 mt-1">
                R$ {cashFlowResult.totalCouponsNet.toLocaleString('pt-BR')}
              </div>
              <div className="text-[11px] text-emerald-600 mt-0.5">
                {((cashFlowResult.totalCouponsNet / principalAmount) * 100).toFixed(1)}% do valor investido
              </div>
            </div>

            <div className="p-4 bg-blue-50/70 border border-blue-100 rounded-xl">
              <div className="text-xs font-semibold text-blue-800 flex items-center justify-between">
                <span>Principal Devolvido</span>
                <span className="text-[10px] bg-blue-200 text-blue-900 px-1.5 py-0.2 rounded font-bold">Amortização</span>
              </div>
              <div className="text-xl font-black text-blue-700 mt-1">
                R$ {cashFlowResult.totalAmortization.toLocaleString('pt-BR')}
              </div>
              <div className="text-[11px] text-blue-600 mt-0.5">
                100% do capital inicial amortizado
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="text-xs font-semibold text-slate-600 flex items-center justify-between">
                <span>Duration Real do Fluxo</span>
                <span className="text-[10px] bg-slate-200 text-slate-800 px-1.5 py-0.2 rounded font-bold">Macaulay</span>
              </div>
              <div className="text-xl font-black text-slate-900 mt-1">
                {cashFlowResult.macaulayDurationEstimated} anos
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {couponFreq === 'bullet' ? 'Sem antecipação de fluxo' : `Reduz o risco em ${((1 - cashFlowResult.macaulayDurationEstimated / tenorYears) * 100).toFixed(0)}% vs Bullet`}
              </div>
            </div>

            <div className="p-4 bg-indigo-50/70 border border-indigo-100 rounded-xl">
              <div className="text-xs font-semibold text-indigo-800 flex items-center justify-between">
                <span>Saldo Total com Reinvestimento</span>
                <span className="text-[10px] bg-indigo-200 text-indigo-900 px-1.5 py-0.2 rounded font-bold">
                  {reinvestStrategy === 'none' ? 'Renda Passiva' : reinvestStrategy === 'cdi' ? 'CDI' : 'TIR'}
                </span>
              </div>
              <div className="text-xl font-black text-indigo-700 mt-1">
                R$ {cashFlowResult.reinvestedFinalBalance.toLocaleString('pt-BR')}
              </div>
              <div className="text-[11px] text-indigo-600 mt-0.5">
                {reinvestStrategy === 'none' ? 'Dinheiro embolsado livre no bolso' : `Acúmulo com juros sobre juros`}
              </div>
            </div>
          </div>

          {/* GRÁFICO DE BARRAS EMPILHADAS: AMORTIZAÇÃO + CUPOM */}
          {cashFlowResult.items.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                <BarChart3 size={15} className="text-blue-600" />
                <span>Distribuição Periódica de Amortização do Principal e Cupons Líquidos (R$)</span>
              </h4>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cashFlowResult.items} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="periodLabel" stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <YAxis
                      stroke="#94a3b8"
                      fontSize={11}
                      tickLine={false}
                      tickFormatter={val => `R$ ${(val / 1000).toFixed(0)}k`}
                    />
                    <RechartsTooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const row = payload[0].payload as PeriodicCashFlowItem;
                          return (
                            <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl border border-slate-700 text-xs space-y-1 min-w-[200px]">
                              <div className="font-bold text-blue-400 border-b border-slate-800 pb-1">
                                {label} (Prazo: {row.year} anos)
                              </div>
                              <div className="flex justify-between text-emerald-400">
                                <span>Cupom Líquido:</span>
                                <span>R$ {row.couponAmountNet.toLocaleString('pt-BR')}</span>
                              </div>
                              <div className="flex justify-between text-blue-400">
                                <span>Amortização:</span>
                                <span>R$ {row.amortizationAmount.toLocaleString('pt-BR')}</span>
                              </div>
                              <div className="flex justify-between font-bold text-white pt-1 border-t border-slate-800">
                                <span>Total no Bolso:</span>
                                <span>R$ {row.totalCashFlowNet.toLocaleString('pt-BR')}</span>
                              </div>
                              <div className="flex justify-between text-slate-400 text-[10px]">
                                <span>Saldo Devedor Restante:</span>
                                <span>R$ {row.endingPrincipal.toLocaleString('pt-BR')}</span>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                      formatter={value => {
                        if (value === 'amortizationAmount') return 'Amortização do Principal (R$)';
                        if (value === 'couponAmountNet') return 'Cupom de Juros Líquido (R$)';
                        return value;
                      }}
                    />
                    <Bar dataKey="amortizationAmount" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="couponAmountNet" stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* TABELA DETALHADA PERÍODO A PERÍODO */}
          {showCashFlowDetail && (
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600">
                    <th className="py-2.5 px-3">Período</th>
                    <th className="py-2.5 px-3">Saldo Inicial</th>
                    <th className="py-2.5 px-3 text-emerald-700">Cupom Líquido</th>
                    <th className="py-2.5 px-3 text-blue-700">Amortização</th>
                    <th className="py-2.5 px-3 font-extrabold text-slate-900 bg-slate-100/60">Total no Bolso</th>
                    <th className="py-2.5 px-3">Saldo Remanescente</th>
                    <th className="py-2.5 px-3 text-right">Saldo Acumulado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cashFlowResult.items.map(it => (
                    <tr key={it.period} className="hover:bg-slate-50/70 transition">
                      <td className="py-2 px-3 font-bold text-slate-800">{it.periodLabel}</td>
                      <td className="py-2 px-3 text-slate-600">R$ {it.startingPrincipal.toLocaleString('pt-BR')}</td>
                      <td className="py-2 px-3 font-bold text-emerald-600">+ R$ {it.couponAmountNet.toLocaleString('pt-BR')}</td>
                      <td className="py-2 px-3 font-bold text-blue-600">+ R$ {it.amortizationAmount.toLocaleString('pt-BR')}</td>
                      <td className="py-2 px-3 font-black text-slate-900 bg-slate-50/60">R$ {it.totalCashFlowNet.toLocaleString('pt-BR')}</td>
                      <td className="py-2 px-3 text-slate-600">R$ {it.endingPrincipal.toLocaleString('pt-BR')}</td>
                      <td className="py-2 px-3 text-right font-semibold text-slate-700">R$ {it.reinvestedAccumulatedBalance.toLocaleString('pt-BR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 6. GUIA RÁPIDO PARA ANALISTAS E INVESTIDORES (FAQ) */}
        <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200 space-y-4">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Info size={18} className="text-blue-600" />
            Guia Operacional: Como o Mercado Analisa o Spread de Crédito
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-slate-600">
            <div className="space-y-1.5 p-4 bg-slate-50 rounded-xl border border-slate-200/80">
              <h4 className="font-bold text-slate-900 text-sm">1. O Efeito do Imposto de Renda</h4>
              <p className="leading-relaxed">
                A isenção fiscal de CRIs, CRAs e Debêntures de Infraestrutura (12.431) não é apenas um benefício no resgate: ela <strong>amplifica exponencialmente</strong> a rentabilidade composta. Uma taxa isenta de IPCA + 7,5% supera uma NTN-B de IPCA + 6,4% em mais de R$ 5.000 a cada R$ 50 mil aportados em 4 anos.
              </p>
            </div>

            <div className="space-y-1.5 p-4 bg-slate-50 rounded-xl border border-slate-200/80">
              <h4 className="font-bold text-slate-900 text-sm">2. O Risco de Carregamento vs Venda</h4>
              <p className="leading-relaxed">
                Muitos investidores se assustam ao ver o extrato oscilar negativamente após o Copom subir juros. A marcação a mercado (MTM) reflete apenas o valor de liquidação imediata. Se a empresa devedora mantiver a saúde financeira (Z-score &gt; 2.0 e DL/EBITDA saudável), o título <strong>convergirá rigorosamente para 100% do contratado no vencimento</strong>.
              </p>
            </div>

            <div className="space-y-1.5 p-4 bg-slate-50 rounded-xl border border-slate-200/80">
              <h4 className="font-bold text-slate-900 text-sm">3. Regra de Bolso para o Spread</h4>
              <p className="leading-relaxed">
                No mercado institucional brasileiro, para papéis com rating <strong>AAA</strong>, um spread líquido sobre a NTN-B entre <strong>+50 e +100 bps</strong> é considerado padrão. Para ratings <strong>A ou BBB</strong>, o spread justo costuma exigir entre <strong>+180 e +350 bps</strong> para compensar o risco de crédito adicional.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default CalculatorPage;
