import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  HelpCircle,
  Copy,
  Check,
  Calendar,
  Layers,
  Sliders,
  DollarSign,
  AlertTriangle,
  RotateCcw,
  Wallet,
  Receipt,
  BarChart3,
  Award,
  Zap,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  ThumbsUp,
  AlertCircle,
  Clock,
  PiggyBank,
  Flame,
  Settings2
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
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

/* ================= BENCHMARKS DE NTN-B DEFAULT (Fallback) ================= */
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

/* ================= ATIVOS FAMOSOS PARA PREENCHIMENTO RÁPIDO ================= */
const POPULAR_SHORTCUTS = [
  { label: 'CRI Direcional', query: '21D0737500' },
  { label: 'CRI Mateus', query: '20B0980166' },
  { label: 'Debênture Vale', query: 'VALE35' },
  { label: 'CRI Votorantim', query: '21C0483517' }
];

/* ================= TOOLTIP DIDÁTICO ================= */
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

  // Modo da Interface: Descomplicado (Leigo) vs Analista (Institucional)
  const [expertMode, setExpertMode] = useState<boolean>(false);

  // Navegação por Abas Amigáveis
  const [activeTab, setActiveTab] = useState<'veredicto' | 'cenarios' | 'fluxo' | 'risco'>('veredicto');

  // Estados de dados externos
  const [allAssets, setAllAssets] = useState<Asset[]>([]);
  const [ntnbRecords, setNtnbRecords] = useState<typeof DEFAULT_NTNB_LIST>(DEFAULT_NTNB_LIST);

  // Estados do formulário
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Parâmetros de Simulação
  const [assetName, setAssetName] = useState('Papel de Crédito Privado');
  const [assetType, setAssetType] = useState<'CRI' | 'CRA' | 'Debênture' | 'Outro'>('CRI');
  const [isExempt, setIsExempt] = useState(true);
  const [indexador, setIndexador] = useState<'IPCA' | 'CDI' | 'PRE'>('IPCA');
  const [inputRate, setInputRate] = useState<number>(7.50); // % a.a. real para IPCA
  const [cdiMode, setCdiMode] = useState<'pct' | 'spread'>('pct');
  const [tenorYears, setTenorYears] = useState<number>(4.0);
  const [durationYears, setDurationYears] = useState<number>(3.5);
  const [principalAmount, setPrincipalAmount] = useState<number>(50000); // R$ 50 mil

  // Parâmetros de Título Público Benchmark
  const [selectedNtnb, setSelectedNtnb] = useState<typeof DEFAULT_NTNB_LIST[0]>(DEFAULT_NTNB_LIST[3]); // NTN-B 2030 padrão
  const [manualBenchmarkRate, setManualBenchmarkRate] = useState<number>(7.66);
  const [useManualBenchmark, setUseManualBenchmark] = useState(false);

  // Cenário de Inflação & Juros
  const [customIpca, setCustomIpca] = useState<number>(4.0);
  const [customCdi, setCustomCdi] = useState<number>(10.5);

  // Parâmetros de Fluxo de Caixa: Cupons & Amortização
  const [hasPeriodicCashflow, setHasPeriodicCashflow] = useState<boolean>(false);
  const [couponFreq, setCouponFreq] = useState<CouponFrequency>('semiannual');
  const [amortSchedule, setAmortSchedule] = useState<AmortizationSchedule>('bullet');
  const [reinvestStrategy, setReinvestStrategy] = useState<ReinvestmentStrategy>('contracted_yield');
  const [reinvestRate, setReinvestRate] = useState<number>(10.5);

  // Choque de Curva MTM (em bps)
  const [curveShockBps, setCurveShockBps] = useState<number>(150);

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

          if (initialTicker) {
            const found = assetsData.find(a => (a.ticker || '').toUpperCase() === initialTicker);
            if (found) {
              handleSelectAsset(found);
            }
          }
        }

        if (ntnbData && ntnbData.length > 0) {
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
        console.error('Erro ao carregar dados:', err);
      }
    };

    loadAll();
  }, [initialTicker]);

  /* ================= 2. SELEÇÃO DO ATIVO ================= */
  const handleSelectAsset = (a: Asset) => {
    setSelectedAsset(a);
    setSearchQuery(a.ticker);
    setShowSearchResults(false);

    const t = (a.tipo || '').toUpperCase();
    if (t.includes('CRI')) setAssetType('CRI');
    else if (t.includes('CRA')) setAssetType('CRA');
    else if (t.includes('DEB')) setAssetType('Debênture');
    else setAssetType('Outro');

    const isEx = (a.incentivada || '').toLowerCase() === 'sim' || 
                 (a.lei || '').includes('12.431') || 
                 t.includes('CRI') || 
                 t.includes('CRA');
    setIsExempt(isEx);

    setAssetName(`${a.issuer || 'Emissor'} (${a.ticker})`);

    const idx = (a.indexador || '').toUpperCase();
    if (idx.includes('IPCA')) {
      setIndexador('IPCA');
    } else if (idx.includes('DI') || idx.includes('CDI')) {
      setIndexador('CDI');
      setCdiMode(idx.includes('%') ? 'pct' : 'spread');
    } else {
      setIndexador('PRE');
    }

    const rB3 = parseFloat(a.taxa_negocio_b3 || '');
    const rAnb = parseFloat(a.taxa_indicativa_anbima || a.taxa_mercado || '');
    const rEmiss = parseFloat(a.taxa_emissao || '');
    const bestRate = !isNaN(rB3) && rB3 > 0 ? rB3 : (!isNaN(rAnb) && rAnb > 0 ? rAnb : (!isNaN(rEmiss) ? rEmiss : 7.50));
    setInputRate(Number(bestRate.toFixed(4)));

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

  /* ================= 3. BUSCA RÁPIDA ================= */
  const searchResults = useMemo(() => {
    if (!searchQuery || searchQuery.trim().length < 2) return [];
    const q = searchQuery.toLowerCase().trim();
    return allAssets
      .filter(a => 
        (a.ticker && a.ticker.toLowerCase().includes(q)) ||
        (a.issuer && a.issuer.toLowerCase().includes(q))
      )
      .slice(0, 8);
  }, [searchQuery, allAssets]);

  /* ================= 4. CÁLCULOS MATEMÁTICOS DE MERCADO ================= */
  const daysToMaturity = Math.round(tenorYears * 365.25);
  const taxInfo = useMemo(() => getIncomeTaxRate(daysToMaturity, isExempt), [daysToMaturity, isExempt]);
  const irRateGov = useMemo(() => getIncomeTaxRate(daysToMaturity, false).rate, [daysToMaturity]);

  const govBenchmarkRate = useManualBenchmark ? manualBenchmarkRate : selectedNtnb.taxa;

  // Gross-Up da taxa isenta para equivalente tributável
  const grossUpRate = useMemo(() => {
    return isExempt ? calcGrossUpRate(inputRate, irRateGov) : inputRate;
  }, [isExempt, inputRate, irRateGov]);

  // Spread sobre o Tesouro (em pontos-base)
  const creditSpreadBps = useMemo(() => {
    return Math.round((grossUpRate - govBenchmarkRate) * 100);
  }, [grossUpRate, govBenchmarkRate]);

  // Inflação de Indiferença (Breakeven) vs 100% CDI
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

  // Taxa nominal central do papel
  const baseNominalRate = useMemo(() => {
    return indexador === 'IPCA' ? calcNominalRate(inputRate, customIpca) : inputRate;
  }, [indexador, inputRate, customIpca]);

  // Retornos no Cenário Central (Para exibição no Hero Placar)
  const heroCpResult = useMemo(() => {
    return calcFutureValue(principalAmount, baseNominalRate, tenorYears, taxInfo.rate, isExempt);
  }, [principalAmount, baseNominalRate, tenorYears, taxInfo.rate, isExempt]);

  const heroGovResult = useMemo(() => {
    const govNominal = calcNominalRate(govBenchmarkRate, customIpca);
    return calcFutureValue(principalAmount, govNominal, tenorYears, irRateGov, false);
  }, [principalAmount, govBenchmarkRate, customIpca, tenorYears, irRateGov]);

  const heroCdiResult = useMemo(() => {
    return calcFutureValue(principalAmount, customCdi, tenorYears, irRateGov, false);
  }, [principalAmount, customCdi, tenorYears, irRateGov]);

  const heroExcessNetR$ = heroCpResult.futureValueNet - heroGovResult.futureValueNet;
  const spreadAnnualPct = (creditSpreadBps / 100);

  // Diagnóstico do Semáforo do Investidor
  const decisionVerdict = useMemo(() => {
    if (creditSpreadBps >= 100) {
      return {
        level: 'good',
        badge: '🟢 VALE A PENA',
        badgeBg: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400',
        title: 'Excelente Prêmio de Risco!',
        description: `Paga +${spreadAnnualPct.toFixed(2)}% ao ano acima do Governo Federal livre de risco. A rentabilidade compensa o risco de crédito corporativo.`
      };
    } else if (creditSpreadBps >= 20) {
      return {
        level: 'warning',
        badge: '🟡 PRÊMIO APERTADO',
        badgeBg: 'bg-amber-500/15 border-amber-500/30 text-amber-400',
        title: 'Ganho Modesto sobre o Tesouro',
        description: `Paga apenas +${spreadAnnualPct.toFixed(2)}% ao ano a mais que o Governo. Avalie se vale a pena abrir mão da garantia máxima do Tesouro Nacional por essa diferença.`
      };
    } else {
      return {
        level: 'danger',
        badge: '🔴 NÃO VALE A PENA',
        badgeBg: 'bg-rose-500/15 border-rose-500/30 text-rose-400',
        title: 'Desvantagem contra o Tesouro Direto',
        description: `Este título rende MENOS ou praticamente o mesmo que um título público do Governo com risco zero. O Tesouro IPCA+ é mais vantajoso.`
      };
    }
  }, [creditSpreadBps, spreadAnnualPct]);

  /* ================= 5. CRONOGRAMA DE CUPONS E AMORTIZAÇÃO ================= */
  const cashFlowResult = useMemo<CashFlowScheduleResult>(() => {
    return generateCashFlowSchedule(
      principalAmount,
      baseNominalRate,
      tenorYears,
      taxInfo.rate,
      isExempt,
      hasPeriodicCashflow ? couponFreq : 'bullet',
      hasPeriodicCashflow ? amortSchedule : 'bullet',
      reinvestStrategy,
      reinvestRate
    );
  }, [
    principalAmount,
    baseNominalRate,
    tenorYears,
    taxInfo.rate,
    isExempt,
    hasPeriodicCashflow,
    couponFreq,
    amortSchedule,
    reinvestStrategy,
    reinvestRate
  ]);

  /* ================= 6. CENÁRIOS MACROECONÔMICOS ================= */
  const scenarios = useMemo(() => {
    const list = [
      { name: 'Inflação Controlada (3,0%)', ipca: 3.0, cdi: 8.5, desc: 'Cenário otimista com cortes de juros pelo Banco Central' },
      { name: 'Cenário Neutro / Meta (4,0%)', ipca: 4.0, cdi: 10.5, desc: 'Consenso de mercado atual (Boletim Focus)' },
      { name: 'Inflação Pressionada (5,5%)', ipca: 5.5, cdi: 12.0, desc: 'Preços subindo e juros mais altos por mais tempo' },
      { name: 'Crise / Estresse (7,5%)', ipca: 7.5, cdi: 14.5, desc: 'Descontrole fiscal e inflação elevada' }
    ];

    return list.map(sc => {
      let cpNom = indexador === 'IPCA' ? calcNominalRate(inputRate, sc.ipca) : inputRate;
      const cpRes = calcFutureValue(principalAmount, cpNom, tenorYears, taxInfo.rate, isExempt);
      const govRes = calcFutureValue(principalAmount, calcNominalRate(govBenchmarkRate, sc.ipca), tenorYears, irRateGov, false);
      const cdiRes = calcFutureValue(principalAmount, sc.cdi, tenorYears, irRateGov, false);

      return {
        ...sc,
        cpFutureNet: Math.round(cpRes.futureValueNet),
        cpEffectiveNet: Number(cpRes.effectiveAnnualNetRate.toFixed(2)),
        govFutureNet: Math.round(govRes.futureValueNet),
        cdiFutureNet: Math.round(cdiRes.futureValueNet),
        netExcess: Math.round(cpRes.futureValueNet - govRes.futureValueNet)
      };
    });
  }, [indexador, inputRate, tenorYears, taxInfo.rate, isExempt, principalAmount, govBenchmarkRate, irRateGov]);

  /* ================= 7. TRAJETÓRIA MTM ================= */
  const trajectoryData = useMemo<TrajectoryPoint[]>(() => {
    return generateMtmTrajectory(principalAmount, baseNominalRate, tenorYears, durationYears, curveShockBps);
  }, [principalAmount, baseNominalRate, tenorYears, durationYears, curveShockBps]);

  /* ================= 8. COMPARTILHAR ANÁLISE ================= */
  const handleCopyAnalysis = () => {
    const text = `📊 *ANÁLISE DE RENDA FIXA — FIXDATA*
──────────────────────────────
🔹 *Investimento:* ${assetName}
🔹 *Taxa:* ${indexador === 'IPCA' ? `IPCA + ${inputRate.toFixed(2)}% a.a.` : `${inputRate.toFixed(2)}%`} (${isExempt ? '100% Isento de IR' : 'Tributado'})
🔹 *Prazo:* ${tenorYears.toFixed(1)} anos (Aporte de R$ ${principalAmount.toLocaleString('pt-BR')})

🏛️ *VEREDITO VS TESOURO DIRETO (${selectedNtnb.nome}):*
• *Taxa Equivalente Bruta (Gross-Up):* ${grossUpRate.toFixed(2)}% a.a.
• *Prêmio Real:* ${spreadAnnualPct >= 0 ? `+${spreadAnnualPct.toFixed(2)}% ao ano (+${creditSpreadBps} bps)` : `${spreadAnnualPct.toFixed(2)}% ao ano`}
• *Resultado no Bolso:* R$ ${Math.round(heroCpResult.futureValueNet).toLocaleString('pt-BR')} líquidos
• *Diferença contra o Governo:* ${heroExcessNetR$ >= 0 ? `+R$ ${Math.round(heroExcessNetR$).toLocaleString('pt-BR')}` : `-R$ ${Math.round(Math.abs(heroExcessNetR$)).toLocaleString('pt-BR')}`}

🔍 Simule grátis em: https://meucreditoprivado.netlify.app/calculadora`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="min-h-screen bg-slate-50/70 py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* ================= CABEÇALHO COM TOGGLE DESCOMPLICADO / ANALISTA ================= */}
        <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-xs border border-slate-200/90 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg"><Scale size={16} /></span>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-600">Simulador de Decisão</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Vale a Pena Comprar Esse Papel?
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 max-w-xl">
              Compare em segundos qualquer CRI, CRA ou Debênture contra o <strong>Tesouro Direto</strong> e a <strong>Caixinha/CDB</strong>, sem enrolação.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap w-full md:w-auto">
            {/* TOGGLE LEIGO / ANALISTA */}
            <div className="bg-slate-100 p-1 rounded-2xl flex items-center text-xs font-bold w-full sm:w-auto justify-center">
              <button
                type="button"
                onClick={() => setExpertMode(false)}
                className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-xl transition ${
                  !expertMode ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                🌱 Modo Simples
              </button>
              <button
                type="button"
                onClick={() => setExpertMode(true)}
                className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-xl transition ${
                  expertMode ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                ⚙️ Modo Analista
              </button>
            </div>

            <button
              onClick={handleCopyAnalysis}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition shrink-0"
              title="Copiar resumo para WhatsApp"
            >
              {copied ? <Check size={14} className="text-emerald-300" /> : <Copy size={14} />}
              <span>{copied ? 'Copiado!' : 'Compartilhar'}</span>
            </button>
          </div>
        </div>

        {/* ================= FORMULÁRIO AMIGÁVEL EM 3 PASSOS DIRETOS ================= */}
        <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-xs border border-slate-200/90 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Zap size={18} className="text-blue-600" />
              <span>Dados do Investimento</span>
            </h2>

            {selectedAsset && (
              <button
                onClick={() => {
                  setSelectedAsset(null);
                  setSearchQuery('');
                  setAssetName('Simulação Livre');
                }}
                className="text-xs font-semibold text-slate-400 hover:text-rose-600 flex items-center gap-1 transition"
              >
                <RotateCcw size={12} />
                <span>Limpar ativo</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-5">

            {/* PASSO 1: BUSCA OU DIGITAÇÃO (MD: 6 COLS) */}
            <div className="md:col-span-6 space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                1. Qual papel te ofereceram? (opcional)
              </label>

              <div className="relative">
                <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Busque por código ou empresa: ex. Vale, Taesa, CRI Mateus..."
                  value={searchQuery}
                  onChange={e => {
                    setSearchQuery(e.target.value);
                    setShowSearchResults(true);
                  }}
                  onFocus={() => setShowSearchResults(true)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition"
                />

                {showSearchResults && searchResults.length > 0 && (
                  <div className="absolute z-40 top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden max-h-64 overflow-y-auto">
                    {searchResults.map(a => (
                      <div
                        key={a.ticker}
                        onClick={() => handleSelectAsset(a)}
                        className="p-3 hover:bg-blue-50/80 cursor-pointer transition flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-slate-900">{a.ticker}</span>
                            <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${getTipoBadgeClass(a.tipo)}`}>
                              {a.tipo}
                            </span>
                            {a.rating_normalizado && (
                              <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${getRatingBadgeClass(a.rating_normalizado)}`}>
                                {a.rating_normalizado}
                              </span>
                            )}
                          </div>
                          <div className="text-slate-500 font-medium truncate max-w-xs mt-0.5">
                            {a.issuer || 'Emissor'}
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="font-bold text-blue-600">
                            {a.indexador || 'IPCA'} {a.taxa_mercado ? `+ ${parseFloat(a.taxa_mercado).toFixed(2)}%` : ''}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ATALHOS RÁPIDOS SE NENHUM ATIVO ESTIVER SELECIONADO */}
              {!selectedAsset && (
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  <span className="text-[11px] text-slate-400 font-medium">Sugestões:</span>
                  {POPULAR_SHORTCUTS.map(sc => (
                    <button
                      key={sc.query}
                      type="button"
                      onClick={() => {
                        const found = allAssets.find(a => (a.ticker || '').toUpperCase() === sc.query);
                        if (found) handleSelectAsset(found);
                      }}
                      className="px-2 py-0.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-600 rounded-md text-[11px] font-semibold transition"
                    >
                      {sc.label}
                    </button>
                  ))}
                </div>
              )}

              {/* TIPO DE TRIBUTAÇÃO */}
              <div className="flex items-center gap-2 pt-1">
                <span className="text-[11px] text-slate-500 font-medium">Tributação:</span>
                <button
                  type="button"
                  onClick={() => setIsExempt(true)}
                  className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition ${
                    isExempt ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  ✨ 100% Isento de IR (CRI/CRA/Incentivada)
                </button>
                <button
                  type="button"
                  onClick={() => setIsExempt(false)}
                  className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition ${
                    !isExempt ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  🏛️ Tributado (Com IR)
                </button>
              </div>
            </div>

            {/* PASSO 2: TAXA OFERTADA (MD: 3 COLS) */}
            <div className="md:col-span-3 space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                2. Qual a taxa oferecida?
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.10"
                  value={inputRate}
                  onChange={e => setInputRate(parseFloat(e.target.value) || 0)}
                  className="w-full pl-3 pr-12 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-lg font-black text-blue-600 focus:bg-white focus:border-blue-500 outline-none"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
                  {indexador === 'IPCA' ? '+ IPCA' : '% a.a.'}
                </span>
              </div>

              {/* Ativação rápida da taxa de mercado se disponível */}
              {selectedAsset && (
                <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                  {selectedAsset.taxa_negocio_b3 && (
                    <button
                      type="button"
                      onClick={() => setInputRate(parseFloat(selectedAsset.taxa_negocio_b3 || ''))}
                      className="text-blue-600 underline font-semibold"
                    >
                      B3: {parseFloat(selectedAsset.taxa_negocio_b3).toFixed(2)}%
                    </button>
                  )}
                  {selectedAsset.taxa_indicativa_anbima && (
                    <button
                      type="button"
                      onClick={() => setInputRate(parseFloat(selectedAsset.taxa_indicativa_anbima || ''))}
                      className="text-slate-600 underline font-semibold"
                    >
                      Anbima: {parseFloat(selectedAsset.taxa_indicativa_anbima).toFixed(2)}%
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* PASSO 3: QUANTO INVESTIR & PRAZO (MD: 3 COLS) */}
            <div className="md:col-span-3 space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                3. Quanto vai investir?
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">R$</span>
                <input
                  type="number"
                  step="5000"
                  value={principalAmount}
                  onChange={e => setPrincipalAmount(parseFloat(e.target.value) || 0)}
                  className="w-full pl-8 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
                />
              </div>

              {/* Pílulas de Valor Rápido */}
              <div className="flex gap-1 text-[10px]">
                {[10000, 50000, 100000].map(amt => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setPrincipalAmount(amt)}
                    className="flex-1 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg font-bold text-slate-600 text-[10px] transition"
                  >
                    R$ {amt / 1000}k
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* BARRA DE PRAZO & BENCHMARK DO GOVERNO */}
          <div className="p-3.5 bg-blue-50/70 border border-blue-100 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-blue-950">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-blue-600 shrink-0" />
              <span>
                Prazo até o vencimento: <strong>{tenorYears} anos</strong> ({daysToMaturity} dias)
              </span>
              <div className="flex items-center gap-1 ml-2">
                {[2, 3, 5, 7].map(y => (
                  <button
                    key={y}
                    type="button"
                    onClick={() => setTenorYears(y)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      tenorYears === y ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border border-slate-200'
                    }`}
                  >
                    {y}a
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-slate-600 text-xs">
              <ShieldCheck size={15} className="text-emerald-600 shrink-0" />
              <span>
                Comparado com: <strong>{selectedNtnb.nome}</strong> (Governo pagando <strong>IPCA + {govBenchmarkRate.toFixed(2)}%</strong>)
              </span>
            </div>
          </div>
        </div>

        {/* ================= O GRANDE PLACAR DE VEREDITO (O QUE O LEIGO QUER VER) ================= */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950 text-white rounded-3xl p-6 sm:p-8 shadow-md relative overflow-hidden space-y-6">

          {/* DIAGNÓSTICO DO INVESTIDOR (SEMÁFORO) */}
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-slate-800 pb-5">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold border ${decisionVerdict.badgeBg}`}>
                  {decisionVerdict.badge}
                </span>
                <span className="text-xs text-slate-400 font-semibold">• Veredito Inteligente FixData</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                {heroExcessNetR$ >= 0 
                  ? `Você ganha +R$ ${Math.round(heroExcessNetR$).toLocaleString('pt-BR')} a mais no bolso!`
                  : `Atenção: Você perde R$ ${Math.round(Math.abs(heroExcessNetR$)).toLocaleString('pt-BR')} contra o Tesouro`
                }
              </h3>
              <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
                {decisionVerdict.description}
              </p>
            </div>

            <div className="bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700 text-right shrink-0">
              <span className="text-[11px] text-slate-400 font-medium block">Diferença Anual vs Governo:</span>
              <span className={`text-2xl font-black ${creditSpreadBps >= 50 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {spreadAnnualPct >= 0 ? `+${spreadAnnualPct.toFixed(2)}%` : `${spreadAnnualPct.toFixed(2)}%`}
                <span className="text-xs text-slate-400 font-normal ml-1">ao ano</span>
              </span>
              {expertMode && (
                <span className="block text-[10px] text-slate-400 font-mono">
                  Spread: {creditSpreadBps} bps
                </span>
              )}
            </div>
          </div>

          {/* DUELO VISUAL: 3 CARDS LADO A LADO */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            {/* CARD 1: SEU CRÉDITO PRIVADO (DESTAQUE) */}
            <div className="bg-blue-600/20 backdrop-blur-md rounded-2xl p-5 border-2 border-blue-500/50 space-y-3 relative overflow-hidden">
              <div className="flex justify-between items-center text-xs">
                <span className="font-extrabold text-blue-300 uppercase tracking-wider">{assetType}: {assetName}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-400 text-slate-900">
                  {isExempt ? 'Livre de IR' : 'Com IR'}
                </span>
              </div>

              <div>
                <span className="text-[11px] text-slate-400 font-medium">Seu Dinheiro no Final:</span>
                <div className="text-3xl font-black text-white tracking-tight">
                  R$ {Math.round(heroCpResult.futureValueNet).toLocaleString('pt-BR')}
                </div>
                <div className="text-xs text-emerald-400 mt-1 font-bold">
                  Lucro Líquido: +R$ {Math.round(heroCpResult.totalProfitNet).toLocaleString('pt-BR')}
                </div>
              </div>

              <div className="pt-2 border-t border-white/10 text-[11px] text-slate-300 flex justify-between">
                <span>Rendimento Líquido:</span>
                <strong className="text-white">{heroCpResult.effectiveAnnualNetRate.toFixed(2)}% ao ano</strong>
              </div>
            </div>

            {/* CARD 2: TESOURO DIRETO (BENCHMARK) */}
            <div className="bg-white/5 rounded-2xl p-5 border border-white/10 space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-300">{selectedNtnb.nome}</span>
                <span className="text-[10px] text-slate-400 font-semibold">15% IR</span>
              </div>

              <div>
                <span className="text-[11px] text-slate-400 font-medium">No Tesouro Direto:</span>
                <div className="text-3xl font-black text-slate-200 tracking-tight">
                  R$ {Math.round(heroGovResult.futureValueNet).toLocaleString('pt-BR')}
                </div>
                <div className="text-xs text-slate-400 mt-1 font-medium">
                  Lucro Líquido: +R$ {Math.round(heroGovResult.totalProfitNet).toLocaleString('pt-BR')}
                </div>
              </div>

              <div className="pt-2 border-t border-white/10 text-[11px] text-slate-400 flex justify-between">
                <span>Risco:</span>
                <span className="text-emerald-400 font-semibold">Zero (Governo)</span>
              </div>
            </div>

            {/* CARD 3: BANCO 100% DO CDI */}
            <div className="bg-white/5 rounded-2xl p-5 border border-white/10 space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-300">CDB / Nubank (100% CDI)</span>
                <span className="text-[10px] text-slate-400 font-semibold">15% IR</span>
              </div>

              <div>
                <span className="text-[11px] text-slate-400 font-medium">No Banco Tradicional:</span>
                <div className="text-3xl font-black text-slate-200 tracking-tight">
                  R$ {Math.round(heroCdiResult.futureValueNet).toLocaleString('pt-BR')}
                </div>
                <div className="text-xs text-slate-400 mt-1 font-medium">
                  Lucro Líquido: +R$ {Math.round(heroCdiResult.totalProfitNet).toLocaleString('pt-BR')}
                </div>
              </div>

              <div className="pt-2 border-t border-white/10 text-[11px] text-slate-400 flex justify-between">
                <span>Premissa CDI:</span>
                <span className="text-slate-300 font-semibold">{customCdi.toFixed(1)}% ao ano</span>
              </div>
            </div>

          </div>

          {/* O SUPERPODER DA ISENÇÃO (GROSS-UP EM LINGUAGEM HUMANA) */}
          <div className="bg-blue-900/40 border border-blue-500/30 rounded-2xl p-4 text-xs text-blue-100 flex items-start gap-3">
            <Sparkles size={20} className="text-blue-300 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong className="text-white block font-bold text-sm mb-0.5">O Superpoder da Isenção de Imposto:</strong>
              {isExempt ? (
                <span>
                  Como você não paga nada de Imposto de Renda, a sua taxa de <strong>IPCA + {inputRate.toFixed(2)}%</strong> rende na prática igual a um título de banco que pagasse <strong>IPCA + {grossUpRate.toFixed(2)}%</strong>! Você embolsa 100% do lucro sem divisão com o governo.
                </span>
              ) : (
                <span>
                  Este título é tributado pela tabela regressiva da Receita Federal (alíquota estimada em <strong>{taxInfo.rate * 100}%</strong> sobre o ganho). O valor exibido já está com o imposto devidamente descontado.
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ================= ABAS INTELIGENTES: VEJA MAIS SEM CONFUSÃO ================= */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto text-xs sm:text-sm font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('veredicto')}
            className={`px-4 py-2.5 rounded-xl transition flex items-center gap-2 shrink-0 ${
              activeTab === 'veredicto'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Award size={16} />
            <span>Veredito Rápido</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('cenarios')}
            className={`px-4 py-2.5 rounded-xl transition flex items-center gap-2 shrink-0 ${
              activeTab === 'cenarios'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <TrendingUp size={16} />
            <span>E se a Inflação Mudar?</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('fluxo')}
            className={`px-4 py-2.5 rounded-xl transition flex items-center gap-2 shrink-0 ${
              activeTab === 'fluxo'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Wallet size={16} />
            <span>Dinheiro Pingando (Cupons)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('risco')}
            className={`px-4 py-2.5 rounded-xl transition flex items-center gap-2 shrink-0 ${
              activeTab === 'risco'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ShieldCheck size={16} />
            <span>Posso Perder Dinheiro?</span>
          </button>
        </div>

        {/* ================= CONTEÚDO DAS ABAS ================= */}

        {/* ABA 1: RESUMO EXECUTIVO (CARDS CLÁSSICOS REORGANIZADOS) */}
        {activeTab === 'veredicto' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-1">
                <span className="text-xs text-slate-500 font-semibold">Taxa Real Contratada</span>
                <div className="text-2xl font-black text-slate-900">
                  {indexador === 'IPCA' ? `IPCA + ${inputRate.toFixed(2)}%` : `${inputRate.toFixed(2)}%`}
                </div>
                <div className="text-[11px] text-emerald-600 font-bold">Líquido no seu bolso</div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-1">
                <span className="text-xs text-slate-500 font-semibold">Equivalente em Banco (CDB)</span>
                <div className="text-2xl font-black text-blue-600">
                  {indexador === 'IPCA' ? `IPCA + ${grossUpRate.toFixed(2)}%` : `${grossUpRate.toFixed(2)}%`}
                </div>
                <div className="text-[11px] text-slate-400 font-medium">Se pagasse 15% de imposto</div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-1">
                <span className="text-xs text-slate-500 font-semibold">Ganho Acima do Tesouro</span>
                <div className={`text-2xl font-black ${creditSpreadBps >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {spreadAnnualPct >= 0 ? `+${spreadAnnualPct.toFixed(2)}%` : `${spreadAnnualPct.toFixed(2)}%`}
                </div>
                <div className="text-[11px] text-slate-500 font-medium">ao ano acima de {selectedNtnb.nome}</div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-1">
                <span className="text-xs text-slate-500 font-semibold">Para Vencer o CDI</span>
                <div className="text-2xl font-black text-slate-900">
                  {indexador === 'IPCA' ? `IPCA > ${breakevenInflation.toFixed(2)}%` : 'N/A'}
                </div>
                <div className="text-[11px] text-blue-600 font-bold">Inflação necessária para bater 100% CDI</div>
              </div>
            </div>

            {/* SEÇÃO COMPLEMENTAR DO MODO ANALISTA */}
            {expertMode && (
              <div className="bg-slate-900 text-white rounded-3xl p-6 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h4 className="text-sm font-extrabold text-blue-400 flex items-center gap-2">
                    <Settings2 size={16} />
                    <span>Métricas Institucionais (Mesa de Renda Fixa)</span>
                  </h4>
                  <span className="text-[11px] font-mono text-slate-400">ETTJ Anbima / B3</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700">
                    <span className="text-slate-400 block mb-1">Spread de Crédito Exato:</span>
                    <span className="text-xl font-mono font-bold text-emerald-400">{creditSpreadBps} bps</span>
                    <p className="text-[11px] text-slate-400 mt-1">Diferencial vs vértice {selectedNtnb.ano} da curva soberana</p>
                  </div>

                  <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700">
                    <span className="text-slate-400 block mb-1">Duration Modificada:</span>
                    <span className="text-xl font-mono font-bold text-blue-400">{durationYears.toFixed(2)} anos</span>
                    <p className="text-[11px] text-slate-400 mt-1">Sensibilidade MTM estimada</p>
                  </div>

                  <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700">
                    <span className="text-slate-400 block mb-1">Benchmark Soberano ETTJ:</span>
                    <div className="flex items-center gap-2 mt-1">
                      <select
                        value={selectedNtnb.ano}
                        onChange={e => {
                          const y = parseInt(e.target.value, 10);
                          const f = ntnbRecords.find(n => n.ano === y);
                          if (f) {
                            setSelectedNtnb(f);
                            setManualBenchmarkRate(f.taxa);
                          }
                        }}
                        className="bg-slate-900 text-white border border-slate-700 rounded-lg p-1 text-xs font-mono outline-none"
                      >
                        {ntnbRecords.map(n => (
                          <option key={n.ano} value={n.ano}>{n.nome} ({n.taxa.toFixed(2)}%)</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ABA 2: CENÁRIOS DE INFLAÇÃO DESCOMPLICADOS */}
        {activeTab === 'cenarios' && (
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/90 shadow-xs space-y-6 animate-in fade-in duration-150">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">E se o Brasil mudar? (Simulador de Cenários)</h3>
                <p className="text-xs text-slate-500">Veja exatamente quanto você tira no bolso se a inflação ou os juros subirem ou caírem.</p>
              </div>

              {/* SLIDER SIMPLES */}
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 flex items-center gap-4 text-xs">
                <div>
                  <span className="text-slate-500 font-medium block text-[10px]">Testar Inflação:</span>
                  <span className="font-black text-blue-600 text-sm">{customIpca.toFixed(1)}% ao ano</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="10"
                  step="0.5"
                  value={customIpca}
                  onChange={e => setCustomIpca(parseFloat(e.target.value))}
                  className="w-32 accent-blue-600 cursor-pointer"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 font-bold text-slate-500 bg-slate-50/50">
                    <th className="py-3 px-4">Cenário</th>
                    <th className="py-3 px-4 text-blue-700 font-extrabold bg-blue-50/40">Seu Crédito Privado</th>
                    <th className="py-3 px-4">Tesouro IPCA+</th>
                    <th className="py-3 px-4">CDB 100% CDI</th>
                    <th className="py-3 px-4 text-right font-black">Sua Vantagem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {scenarios.map(sc => (
                    <tr key={sc.name} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {sc.name}
                        <span className="text-[11px] block font-normal text-slate-400">{sc.desc}</span>
                      </td>
                      <td className="py-3 px-4 font-black text-blue-600 bg-blue-50/30">
                        R$ {sc.cpFutureNet.toLocaleString('pt-BR')}
                        <span className="block text-[11px] font-bold text-blue-500">
                          {sc.cpEffectiveNet}% a.a. no bolso
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-700 font-bold">
                        R$ {sc.govFutureNet.toLocaleString('pt-BR')}
                      </td>
                      <td className="py-3 px-4 text-slate-700 font-bold">
                        R$ {sc.cdiFutureNet.toLocaleString('pt-BR')}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-emerald-600">
                        + R$ {sc.netExcess.toLocaleString('pt-BR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ABA 3: CUPONS & RENDA PASSIVA (PINGA-PINGA) */}
        {activeTab === 'fluxo' && (
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/90 shadow-xs space-y-6 animate-in fade-in duration-150">
            <div className="border-b border-slate-100 pb-4 space-y-1">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Receipt size={18} className="text-blue-600" />
                <span>Como Você Quer Receber o Dinheiro?</span>
              </h3>
              <p className="text-xs text-slate-500">Escolha se você prefere acumular patrimônio até o fim ou receber renda periódica na sua conta corrente.</p>
            </div>

            {/* SELETOR SIMPLIFICADO: GUARDAR TUDO vs PINGA-PINGA */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div
                onClick={() => setHasPeriodicCashflow(false)}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition flex items-start gap-3 ${
                  !hasPeriodicCashflow ? 'border-blue-600 bg-blue-50/40' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="p-2 bg-blue-100 text-blue-600 rounded-xl mt-0.5"><PiggyBank size={20} /></div>
                <div>
                  <h4 className="font-extrabold text-slate-900 text-sm">Resgatar Tudo no Final (Acumulação)</h4>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Você não recebe nada pelo caminho. Os juros compostos trabalham no máximo potencial e você saca o montante integral no vencimento.
                  </p>
                </div>
              </div>

              <div
                onClick={() => setHasPeriodicCashflow(true)}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition flex items-start gap-3 ${
                  hasPeriodicCashflow ? 'border-blue-600 bg-blue-50/40' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl mt-0.5"><Wallet size={20} /></div>
                <div>
                  <h4 className="font-extrabold text-slate-900 text-sm">Receber Pinga-Pinga (Renda Periódica)</h4>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    O título deposita cupons semestrais ou anuais direto na sua conta. Ideal para pagar contas ou complementar a renda do mês.
                  </p>
                </div>
              </div>
            </div>

            {/* SE TEM FLUXO PERIÓDICO ATIVO */}
            {hasPeriodicCashflow && (
              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <span className="font-bold text-slate-800">
                    O que você faz com o dinheiro quando ele cai na conta?
                  </span>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setReinvestStrategy('contracted_yield')}
                      className={`px-3 py-1.5 rounded-xl font-bold transition text-xs ${
                        reinvestStrategy === 'contracted_yield' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-white text-slate-600 border border-slate-200'
                      }`}
                    >
                      ⚡ Reinvestir na Mesma Taxa
                    </button>

                    <button
                      type="button"
                      onClick={() => setReinvestStrategy('cdi')}
                      className={`px-3 py-1.5 rounded-xl font-bold transition text-xs ${
                        reinvestStrategy === 'cdi' ? 'bg-blue-600 text-white shadow-xs' : 'bg-white text-slate-600 border border-slate-200'
                      }`}
                    >
                      📊 Reinvestir no CDI
                    </button>

                    <button
                      type="button"
                      onClick={() => setReinvestStrategy('none')}
                      className={`px-3 py-1.5 rounded-xl font-bold transition text-xs ${
                        reinvestStrategy === 'none' ? 'bg-amber-600 text-white shadow-xs' : 'bg-white text-slate-600 border border-slate-200'
                      }`}
                    >
                      💰 Gastar (Renda Passiva)
                    </button>
                  </div>
                </div>

                {/* GRÁFICO DE BARRAS DOS PAGAMENTOS */}
                <div className="h-64 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={cashFlowResult.items} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="periodLabel" stroke="#94a3b8" fontSize={11} tickLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} tickFormatter={val => `R$ ${(val / 1000).toFixed(0)}k`} />
                      <RechartsTooltip
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                            const row = payload[0].payload as PeriodicCashFlowItem;
                            return (
                              <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl border border-slate-700 text-xs space-y-1">
                                <div className="font-bold text-blue-400 border-b border-slate-800 pb-1">{label}</div>
                                <div className="text-emerald-400">Cupom Líquido: R$ {row.couponAmountNet.toLocaleString('pt-BR')}</div>
                                <div className="text-blue-400">Amortização de Principal: R$ {row.amortizationAmount.toLocaleString('pt-BR')}</div>
                                <div className="font-bold text-white pt-1 border-t border-slate-800">Caiu na Conta: R$ {row.totalCashFlowNet.toLocaleString('pt-BR')}</div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} formatter={val => val === 'amortizationAmount' ? 'Amortização de Principal' : 'Cupom Líquido'} />
                      <Bar dataKey="amortizationAmount" stackId="a" fill="#3b82f6" />
                      <Bar dataKey="couponAmountNet" stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ABA 4: RISCO & MARCAÇÃO A MERCADO (EXPLICADA PARA LEIGOS) */}
        {activeTab === 'risco' && (
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/90 shadow-xs space-y-6 animate-in fade-in duration-150">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Posso Perder Dinheiro se Precisar Vender Antes?</h3>
                <p className="text-xs text-slate-500">
                  Entenda a Regra de Ouro da Renda Fixa e não passe sustos ao olhar o extrato da sua corretora.
                </p>
              </div>

              <div className="flex items-center gap-1.5 bg-slate-50 p-1.5 rounded-xl border border-slate-200 text-xs">
                <span className="font-bold text-slate-500 px-2">Oscilação dos Juros:</span>
                {[100, 150, 200].map(bps => (
                  <button
                    key={bps}
                    type="button"
                    onClick={() => setCurveShockBps(bps)}
                    className={`px-2.5 py-1 rounded-lg font-bold transition ${
                      curveShockBps === bps ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    ±{(bps / 100).toFixed(1)}% a.a.
                  </button>
                ))}
              </div>
            </div>

            {/* A REGRA DE OURO EM DESTAQUE */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-2">
                <div className="flex items-center gap-2 text-emerald-800 font-extrabold text-sm">
                  <CheckCircle2 size={18} className="text-emerald-600" />
                  <span>Se Você Segurar Até o Vencimento:</span>
                </div>
                <p className="text-xs text-emerald-700 leading-relaxed">
                  <strong>Risco ZERO de perder taxa contratada.</strong> Você recebe rigorosamente cada centavo dos <strong>IPCA + {inputRate.toFixed(2)}%</strong> combinados. A oscilação diária do mercado não afeta seu bolso final.
                </p>
              </div>

              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-2">
                <div className="flex items-center gap-2 text-amber-800 font-extrabold text-sm">
                  <AlertTriangle size={18} className="text-amber-600" />
                  <span>Se Você Resgatar Antes da Hora:</span>
                </div>
                <p className="text-xs text-amber-700 leading-relaxed">
                  O valor do título oscila todo dia como uma gangorra: se os juros do país caírem, você ganha um <strong>lucro adiantado</strong>; se os juros subirem, ele fica com <strong>deságio temporário</strong> no extrato.
                </p>
              </div>
            </div>

            {/* GRÁFICO DA GANGORRA */}
            <div className="h-72 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trajectoryData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} tickFormatter={val => `R$ ${(val / 1000).toFixed(0)}k`} />
                  <RechartsTooltip />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  <Area type="monotone" dataKey="bullishValue" stroke="#10b981" fill="#10b981" fillOpacity={0.1} name={`Lucro Antecipado se os Juros Caírem (-${(curveShockBps / 100).toFixed(1)}%)`} />
                  <Area type="monotone" dataKey="baseNominalValue" stroke="#2563eb" strokeWidth={3} fillOpacity={0} name="Carregamento até o Vencimento (100% Garantido)" />
                  <Area type="monotone" dataKey="stressedValue" stroke="#ef4444" strokeDasharray="4 4" fill="#ef4444" fillOpacity={0.08} name={`Deságio Temporário se os Juros Subirem (+${(curveShockBps / 100).toFixed(1)}%)`} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default CalculatorPage;
