import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Calendar as CalendarIcon,
  Layers,
  Sliders,
  DollarSign,
  AlertTriangle,
  RotateCcw,
  Wallet,
  Receipt,
  BarChart3,
  AlertCircle,
  ExternalLink,
  Table,
  LineChart,
  X,
  ChevronRight
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip
} from 'recharts';
import { fetchCSV, Asset, NtnbRecord, getTipoBadgeClass } from '../utils/csv';
import {
  calcGrossUpRate,
  calcNominalRate
} from '../utils/calculatorMath';
import {
  calculateAnbimaPricing,
  addBusinessDays,
  PaymentEventItem,
  AnbimaPricingResult
} from '../utils/anbimaCalculatorMath';

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
  { nome: 'NTN-B 2040', ano: 2040, vencimento: '2040-08-15', taxa: 7.3974 },
  { nome: 'NTN-B 2050', ano: 2050, vencimento: '2050-08-15', taxa: 7.2900 }
];

/* ================= HELPERS DE FORMATAÇÃO BRASILEIRA ================= */
export function formatToBrDate(isoDate: string): string {
  if (!isoDate) return '';
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function parseBrDateToIso(brDate: string): string | null {
  if (!brDate) return null;
  const parts = brDate.split('/');
  if (parts.length !== 3) return null;
  const day = parts[0].padStart(2, '0');
  const month = parts[1].padStart(2, '0');
  const year = parts[2];
  if (day.length !== 2 || month.length !== 2 || year.length !== 4) return null;
  return `${year}-${month}-${day}`;
}

export function formatBrCurrency(value: number, decimals: number = 6): string {
  if (isNaN(value)) return 'R$ 0,00';
  return 'R$ ' + value.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

export function formatBrNumber(value: number, decimals: number = 2): string {
  if (isNaN(value)) return '0,00';
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

/* ================= COMPONENTE DE INPUT DE DATA BRASILEIRO (DD/MM/AAAA) ================= */
interface BrDateInputProps {
  label: string;
  valueIso: string;
  onChangeIso: (newIso: string) => void;
  tooltipTitle?: string;
  tooltipContent?: string;
}

const BrDateInput: React.FC<BrDateInputProps> = ({
  label,
  valueIso,
  onChangeIso,
  tooltipTitle,
  tooltipContent
}) => {
  const [textVal, setTextVal] = useState<string>(() => formatToBrDate(valueIso));
  const hiddenDateRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTextVal(formatToBrDate(valueIso));
  }, [valueIso]);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/\D/g, '').slice(0, 8);
    let formatted = raw;
    if (raw.length > 4) {
      formatted = `${raw.slice(0, 2)}/${raw.slice(2, 4)}/${raw.slice(4)}`;
    } else if (raw.length > 2) {
      formatted = `${raw.slice(0, 2)}/${raw.slice(2)}`;
    }
    setTextVal(formatted);

    if (raw.length === 8) {
      const iso = parseBrDateToIso(formatted);
      if (iso && !isNaN(Date.parse(iso))) {
        onChangeIso(iso);
      }
    }
  };

  const handleNativeDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newIso = e.target.value;
    if (newIso) {
      onChangeIso(newIso);
      setTextVal(formatToBrDate(newIso));
    }
  };

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
        <span className="flex items-center">
          {label}
          {tooltipTitle && tooltipContent && (
            <InfoTooltip title={tooltipTitle} content={tooltipContent} />
          )}
        </span>
        <span className="text-[10px] text-slate-400 font-medium">DD/MM/AAAA</span>
      </label>

      <div className="relative flex items-center">
        <input
          type="text"
          value={textVal}
          onChange={handleTextChange}
          placeholder="DD/MM/AAAA"
          maxLength={10}
          className="w-full pl-3.5 pr-10 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 placeholder-slate-400 shadow-xs focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition"
        />
        <button
          type="button"
          onClick={() => hiddenDateRef.current?.showPicker?.() || hiddenDateRef.current?.click()}
          className="absolute right-2.5 text-slate-400 hover:text-blue-600 p-1 rounded-lg hover:bg-slate-100 transition"
          title="Abrir calendário"
        >
          <CalendarIcon size={16} />
        </button>
        <input
          ref={hiddenDateRef}
          type="date"
          value={valueIso}
          onChange={handleNativeDateChange}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
        />
      </div>
    </div>
  );
};

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
        <HelpCircle size={13} />
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
              <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider mb-0.5">Fórmula Oficial:</span>
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

  // Abas Principais
  const [mainView, setMainView] = useState<'anbima' | 'cenarios'>('anbima');
  const [showConvexity, setShowConvexity] = useState(false);

  // Estados de dados
  const [allAssets, setAllAssets] = useState<Asset[]>([]);
  const [ntnbRecords, setNtnbRecords] = useState<typeof DEFAULT_NTNB_LIST>(DEFAULT_NTNB_LIST);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [assetPaymentEvents, setAssetPaymentEvents] = useState<PaymentEventItem[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);

  // Parâmetros de Apreçamento ANBIMA / B3
  const [dataOperacao, setDataOperacao] = useState<string>(new Date().toISOString().slice(0, 10));
  const [settlementMode, setSettlementMode] = useState<'D0' | 'D1' | 'D2' | 'custom'>('D0');
  const [customSettlementDate, setCustomSettlementDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [formaCalculo, setFormaCalculo] = useState<'Taxa' | 'PU'>('Taxa');
  const [inputRate, setInputRate] = useState<number>(8.2597);
  const [inputPU, setInputPU] = useState<number>(1000.0);
  const [quantity, setQuantity] = useState<number>(1);

  // Parâmetros do Simulador Didático / Carteira
  const [principalAmount, setPrincipalAmount] = useState<number>(50000);
  const [customIpca, setCustomIpca] = useState<number>(4.0);
  const [customCdi, setCustomCdi] = useState<number>(10.5);
  const [tenorYears, setTenorYears] = useState<number>(4.0);
  const [copied, setCopied] = useState(false);

  // Calcula a data de liquidação efetiva baseada no modo
  const dataLiquidacao = useMemo(() => {
    if (settlementMode === 'D0') return dataOperacao;
    if (settlementMode === 'D1') return addBusinessDays(dataOperacao, 1);
    if (settlementMode === 'D2') return addBusinessDays(dataOperacao, 2);
    return customSettlementDate || dataOperacao;
  }, [settlementMode, dataOperacao, customSettlementDate]);

  /* ================= 1. CARREGAMENTO INICIAL DOS ATIVOS ================= */
  useEffect(() => {
    const loadData = async () => {
      try {
        const [assetsData, ntnbData] = await Promise.all([
          fetchCSV<Asset>('/data/assets_master.csv').catch(() => []),
          fetchCSV<NtnbRecord>('/data/ntnb_history.csv').catch(() => [])
        ]);

        if (assetsData && assetsData.length > 0) {
          // Disponibiliza todos os 15.984 títulos cadastrados (não filtra status_ativo para não ocultar papéis como CERR18)
          setAllAssets(assetsData);

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

    loadData();
  }, [initialTicker]);

  /* ================= 2. CARREGAMENTO DOS EVENTOS DE FLUXO DO ATIVO ================= */
  useEffect(() => {
    if (!selectedAsset?.ticker) return;

    let active = true;
    setIsLoadingEvents(true);

    fetch(`/data/assets/${selectedAsset.ticker}.json`)
      .then(r => {
        if (!r.ok) return null;
        return r.text();
      })
      .then(text => {
        if (!text || !active) return;
        try {
          const cleanJson = JSON.parse(text.replace(/\bNaN\b/g, 'null'));
          if (cleanJson.paymentEvents && Array.isArray(cleanJson.paymentEvents)) {
            setAssetPaymentEvents(cleanJson.paymentEvents);
          } else {
            setAssetPaymentEvents([]);
          }
        } catch (e) {
          console.warn('Erro ao processar paymentEvents:', e);
          setAssetPaymentEvents([]);
        }
      })
      .catch(() => {
        if (active) setAssetPaymentEvents([]);
      })
      .finally(() => {
        if (active) setIsLoadingEvents(false);
      });

    return () => { active = false; };
  }, [selectedAsset?.ticker]);

  /* ================= 3. SELEÇÃO DO ATIVO ================= */
  const handleSelectAsset = (a: Asset) => {
    setSelectedAsset(a);
    setSearchQuery(a.ticker);
    setShowSearchResults(false);

    // Identifica taxa indicativa do ativo
    const rAnb = parseFloat(String(a.taxa_indicativa_anbima || a.taxa_mercado || '').replace(',', '.'));
    const rB3 = parseFloat(String(a.taxa_negocio_b3 || '').replace(',', '.'));
    const rEmiss = parseFloat(String(a.taxa_emissao || '').replace(',', '.'));
    const bestRate = !isNaN(rAnb) && rAnb > 0 ? rAnb : (!isNaN(rB3) && rB3 > 0 ? rB3 : (!isNaN(rEmiss) ? rEmiss : 8.2597));
    setInputRate(Number(bestRate.toFixed(4)));

    // Identifica PU inicial
    const rawPu = a.vna || a.pu || a.pu_par || '';
    const puVna = typeof rawPu === 'number' ? rawPu : parseFloat(String(rawPu).replace(',', '.'));
    setInputPU(!isNaN(puVna) && puVna > 0 ? Number(puVna.toFixed(4)) : 1000.0);

    // Prazo em anos
    if (a.vencimento) {
      const parts = a.vencimento.split('-');
      if (parts.length === 3) {
        const vDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        const diffDays = Math.max(30, Math.round((vDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
        setTenorYears(Number((diffDays / 365.25).toFixed(2)));
      }
    }
  };

  /* ================= 4. CÁLCULO OFICIAL ANBIMA / B3 ================= */
  const anbimaResult: AnbimaPricingResult | null = useMemo(() => {
    if (!selectedAsset) return null;

    return calculateAnbimaPricing({
      asset: selectedAsset,
      paymentEvents: assetPaymentEvents,
      dataOperacao,
      dataLiquidacao,
      formaCalculo,
      valor: formaCalculo === 'Taxa' ? inputRate : inputPU,
      quantidade: quantity
    });
  }, [selectedAsset, assetPaymentEvents, dataOperacao, dataLiquidacao, formaCalculo, inputRate, inputPU, quantity]);

  // Sincronização inteligente ao alternar entre Taxa e PU
  const handleToggleFormaCalculo = (novaForma: 'Taxa' | 'PU') => {
    if (novaForma === formaCalculo) return;
    if (anbimaResult && anbimaResult.elegivel) {
      if (novaForma === 'PU') {
        setInputPU(Number(anbimaResult.puOperacao.toFixed(6)));
      } else {
        setInputRate(Number(anbimaResult.taxaOperacao.toFixed(4)));
      }
    }
    setFormaCalculo(novaForma);
  };

  /* ================= 5. GRÁFICO DE CONVEXIDADE (CURVA PU x TAXA) ================= */
  const convexityData = useMemo(() => {
    if (!selectedAsset || !anbimaResult || !anbimaResult.elegivel) return [];

    const baseRate = anbimaResult.taxaOperacao;
    const points = [];
    const deltas = [-3.0, -2.5, -2.0, -1.5, -1.0, -0.5, 0.0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0];

    for (const d of deltas) {
      const rSim = Math.max(baseRate + d, 0.1);
      const resSim = calculateAnbimaPricing({
        asset: selectedAsset,
        paymentEvents: assetPaymentEvents,
        dataOperacao,
        dataLiquidacao,
        formaCalculo: 'Taxa',
        valor: rSim,
        quantidade: 1
      });

      if (resSim.elegivel) {
        points.push({
          taxa: Number(rSim.toFixed(2)),
          taxaLabel: `${rSim.toFixed(2)}%`,
          puOperacao: Number(resSim.puOperacao.toFixed(2)),
          isCurrent: Math.abs(d) < 0.01
        });
      }
    }
    return points;
  }, [selectedAsset, anbimaResult, assetPaymentEvents, dataOperacao, dataLiquidacao]);

  /* ================= 6. BUSCA DE ATIVOS (PRIORIDADE EXATA POR TICKER) ================= */
  const searchResults = useMemo(() => {
    if (!searchQuery || searchQuery.trim().length < 2) return [];
    const q = searchQuery.toLowerCase().trim();
    return allAssets
      .filter(a => 
        (a.ticker && a.ticker.toLowerCase().includes(q)) ||
        (a.issuer && a.issuer.toLowerCase().includes(q)) ||
        (a.isin && a.isin.toLowerCase().includes(q))
      )
      .sort((a, b) => {
        const aTick = (a.ticker || '').toLowerCase();
        const bTick = (b.ticker || '').toLowerCase();
        if (aTick === q) return -1;
        if (bTick === q) return 1;
        if (aTick.startsWith(q) && !bTick.startsWith(q)) return -1;
        if (!aTick.startsWith(q) && bTick.startsWith(q)) return 1;
        return 0;
      })
      .slice(0, 10);
  }, [searchQuery, allAssets]);

  // Benchmark NTN-B correspondente
  const matchedNtnb = useMemo(() => {
    if (!selectedAsset?.vencimento) return ntnbRecords[0];
    const vYear = parseInt(selectedAsset.vencimento.slice(0, 4), 10) || 2030;
    return ntnbRecords.reduce((prev, curr) => {
      return Math.abs(curr.ano - vYear) < Math.abs(prev.ano - vYear) ? curr : prev;
    }, ntnbRecords[0]);
  }, [selectedAsset, ntnbRecords]);

  const spreadVsNtnbBps = useMemo(() => {
    if (!anbimaResult || !matchedNtnb) return 0;
    return Math.round((anbimaResult.taxaOperacao - matchedNtnb.taxa) * 100);
  }, [anbimaResult, matchedNtnb]);

  const copyResults = () => {
    if (!anbimaResult) return;
    const txt = `[Calculadora de Renda Fixa ANBIMA / B3 - ${anbimaResult.ticker}]
PU Operação: ${formatBrCurrency(anbimaResult.puOperacao, 6)}
PU Par: ${formatBrCurrency(anbimaResult.pupar, 6)} (% PU Par: ${anbimaResult.porcentagemPupar.toFixed(4)}%)
PU Limpo: ${formatBrCurrency(anbimaResult.puLimpo, 6)}
Taxa Operação: ${anbimaResult.taxaOperacao.toFixed(4)}% a.a.
Duration: ${anbimaResult.durationDu.toFixed(2)} DU (${anbimaResult.durationAnos.toFixed(2)} anos)
Data da Operação: ${formatToBrDate(anbimaResult.dataOperacao)}
Data de Liquidação: ${formatToBrDate(anbimaResult.dataLiquidacao)}`;
    navigator.clipboard.writeText(txt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50/70 pb-20 font-sans text-slate-800">
      
      {/* HEADER INSTITUCIONAL CLEAN (ESTILO ANBIMA) */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="p-2 bg-blue-600 text-white rounded-xl shadow-xs">
                  <Calculator size={20} className="stroke-[2.2]" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                      Calculadora de Renda Fixa
                    </h1>
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-full">
                      Padrão ANBIMA & B3
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium">
                    Preços unitários, taxas de mercado, duration e fluxos de pagamentos descontados.
                  </p>
                </div>
              </div>
            </div>

            {/* SELETOR DE MODO / VISÃO */}
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 self-start md:self-auto text-xs">
              <button
                type="button"
                onClick={() => setMainView('anbima')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ${
                  mainView === 'anbima'
                    ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ShieldCheck size={14} className={mainView === 'anbima' ? 'text-blue-600' : 'text-slate-400'} />
                Calculadora Oficial
              </button>

              <button
                type="button"
                onClick={() => setMainView('cenarios')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ${
                  mainView === 'cenarios'
                    ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sliders size={14} className={mainView === 'cenarios' ? 'text-blue-600' : 'text-slate-400'} />
                Simulador de Carteira
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">

        {/* CARD 1: BUSCA DE ATIVO (AMPLA, ESPAÇOSA E SEM EXEMPLOS) */}
        <div className="bg-white rounded-2xl p-5 sm:p-7 border border-slate-200 shadow-xs space-y-4">
          <div className="relative w-full">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-2">
                <Search size={16} className="text-blue-600" />
                Buscar Título para Apreçamento (Debêntures, CRIs e CRAs)
              </label>
              {selectedAsset && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedAsset(null);
                    setSearchQuery('');
                  }}
                  className="text-xs text-slate-500 hover:text-blue-600 font-semibold flex items-center gap-1 transition"
                >
                  <X size={14} />
                  Limpar seleção
                </button>
              )}
            </div>

            <div className="relative">
              <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  setShowSearchResults(true);
                }}
                onFocus={() => setShowSearchResults(true)}
                placeholder="Digite o código do título, ISIN ou emissor (ex: ECER12, CERR18, ENAT14, CRA026002BE)..."
                className="w-full pl-12 pr-10 py-3.5 bg-slate-50 border border-slate-300 rounded-xl text-sm sm:text-base font-semibold text-slate-900 placeholder-slate-400 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setShowSearchResults(false);
                  }}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-200 transition"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Dropdown de Resultados da Busca */}
            {showSearchResults && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-slate-200 py-1.5 z-40 max-h-80 overflow-y-auto">
                {searchResults.map(a => (
                  <button
                    key={a.ticker}
                    type="button"
                    onClick={() => handleSelectAsset(a)}
                    className="w-full text-left px-4 py-3 hover:bg-blue-50/80 transition flex items-center justify-between gap-3 border-b border-slate-100 last:border-0"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm text-blue-700">{a.ticker}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${getTipoBadgeClass(a.tipo)}`}>
                          {a.tipo}
                        </span>
                        <span className="text-xs font-semibold text-slate-600">{a.indexador}</span>
                      </div>
                      <p className="text-xs text-slate-600 truncate max-w-md mt-0.5">{a.issuer || a.devedor}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-slate-900">
                        {a.taxa_indicativa_anbima ? `${a.taxa_indicativa_anbima}%` : (a.taxa_emissao ? `${a.taxa_emissao}%` : '')}
                      </span>
                      <span className="block text-[11px] text-slate-400">Venc. {formatToBrDate(a.vencimento || '')}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* FICHA TÉCNICA DO ATIVO SELECIONADO */}
          {selectedAsset && (
            <div className="bg-slate-50 rounded-xl p-4 sm:p-5 border border-slate-200">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3.5 text-xs">
                <div>
                  <span className="text-slate-400 font-bold uppercase text-[10px] block">Título / Código</span>
                  <span className="font-extrabold text-blue-700 text-sm">{selectedAsset.ticker}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold uppercase text-[10px] block">Código ISIN</span>
                  <span className="font-mono text-slate-700">{selectedAsset.isin || 'N/D'}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold uppercase text-[10px] block">Emissor / Devedor</span>
                  <span className="font-semibold text-slate-800 truncate block" title={selectedAsset.issuer}>
                    {selectedAsset.issuer || 'N/D'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold uppercase text-[10px] block">Indexador</span>
                  <span className="font-bold text-slate-800">{selectedAsset.indexador || 'IPCA'}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold uppercase text-[10px] block">Taxa de Emissão</span>
                  <span className="font-bold text-slate-800">
                    {selectedAsset.taxa_emissao ? `${Number(selectedAsset.taxa_emissao).toFixed(4)}% a.a.` : 'N/D'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold uppercase text-[10px] block">Vencimento</span>
                  <span className="font-bold text-slate-900">{formatToBrDate(selectedAsset.vencimento || '')}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ESTADO VAZIO: CONVITE PARA BUSCAR ATIVO */}
        {!selectedAsset && mainView === 'anbima' && (
          <div className="bg-white rounded-2xl p-10 sm:p-14 border border-slate-200 shadow-xs text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 mx-auto flex items-center justify-center">
              <Search size={26} />
            </div>
            <h3 className="font-bold text-slate-900 text-base sm:text-lg">Nenhum título selecionado</h3>
            <p className="text-xs sm:text-sm text-slate-500 max-w-lg mx-auto leading-relaxed">
              Pesquise qualquer debênture, CRI ou CRA na barra de busca acima para carregar as características, taxas indicativas e apurar o PU da operação no padrão oficial ANBIMA & B3.
            </p>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VISÃO 1: CALCULADORA OFICIAL ANBIMA & B3 (REPLICA INSTITUCIONAL) */}
        {/* ========================================================================= */}
        {mainView === 'anbima' && selectedAsset && (
          <div className="space-y-6">

            {/* CARD 2: DADOS DA OPERAÇÃO */}
            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Scale size={18} className="text-blue-600" />
                    Dados da Operação
                  </h2>
                  <p className="text-xs text-slate-500">
                    Informe os parâmetros da negociação no padrão da ANBIMA e B3.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={copyResults}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-xs font-bold transition shadow-xs"
                  >
                    {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                    {copied ? 'Copiado!' : 'Copiar Resultados'}
                  </button>
                </div>
              </div>

              {/* GRID DE PARÂMETROS */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-5">

                {/* 1. Data de Operação (Padrão DD/MM/AAAA) */}
                <BrDateInput
                  label="Data da Operação"
                  valueIso={dataOperacao}
                  onChangeIso={setDataOperacao}
                  tooltipTitle="Data da Operação"
                  tooltipContent="Data em que o negócio é pactuado entre as contrapartes no mercado secundário."
                />

                {/* 2. Data de Liquidação com D+0, D+1, D+2 */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span className="flex items-center">
                      Data de Liquidação
                      <InfoTooltip
                        title="Data de Liquidação Financeira"
                        content="Data útil em que os recursos financeiros e a custódia do título são liquidados via B3."
                      />
                    </span>
                    <span className="text-[10px] text-blue-700 font-bold">{formatToBrDate(dataLiquidacao)}</span>
                  </label>
                  <div className="flex items-center gap-1.5">
                    {(['D0', 'D1', 'D2'] as const).map(mode => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setSettlementMode(mode)}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold border transition ${
                          settlementMode === mode
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        {mode === 'D0' ? 'D+0' : (mode === 'D1' ? 'D+1' : 'D+2')}
                      </button>
                    ))}
                  </div>
                  <span className="text-[10px] text-slate-400 block">
                    Liquidação em: <strong className="text-slate-600">{formatToBrDate(dataLiquidacao)}</strong>
                  </span>
                </div>

                {/* 3. Forma de Cálculo (Por Taxa vs Por PU) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center">
                    Forma de Cálculo
                    <InfoTooltip
                      title="Cálculo Bidirecional (ANBIMA)"
                      content="Por Taxa: você informa a taxa (% a.a.) e a calculadora apura o PU. Por PU: você informa o PU financeiro e o algoritmo resolve a Taxa (YTM)."
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                    <button
                      type="button"
                      onClick={() => handleToggleFormaCalculo('Taxa')}
                      className={`py-2 rounded-lg text-xs font-bold transition ${
                        formaCalculo === 'Taxa'
                          ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Por Taxa
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleFormaCalculo('PU')}
                      className={`py-2 rounded-lg text-xs font-bold transition ${
                        formaCalculo === 'PU'
                          ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Por PU
                    </button>
                  </div>
                  <span className="text-[10px] text-slate-400 block">
                    {formaCalculo === 'Taxa' ? 'Entrada por Taxa Anual' : 'Entrada por Preço Unitário'}
                  </span>
                </div>

                {/* 4. Valor de Entrada (SEM SETAS FEIAS / [appearance:textfield]) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>{formaCalculo === 'Taxa' ? 'Taxa da Operação (% a.a.)' : 'PU da Operação (R$)'}</span>
                    {formaCalculo === 'Taxa' && selectedAsset?.taxa_indicativa_anbima && (
                      <button
                        type="button"
                        onClick={() => {
                          const r = parseFloat(String(selectedAsset.taxa_indicativa_anbima).replace(',', '.'));
                          if (!isNaN(r)) setInputRate(r);
                        }}
                        className="text-[10px] text-blue-600 hover:underline font-bold"
                      >
                        Usar ANBIMA ({selectedAsset.taxa_indicativa_anbima}%)
                      </button>
                    )}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step={formaCalculo === 'Taxa' ? '0.0001' : '0.01'}
                      value={formaCalculo === 'Taxa' ? inputRate : inputPU}
                      onChange={e => {
                        const val = parseFloat(e.target.value);
                        if (formaCalculo === 'Taxa') setInputRate(isNaN(val) ? 0 : val);
                        else setInputPU(isNaN(val) ? 0 : val);
                      }}
                      className="w-full pl-3.5 pr-12 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-extrabold text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 shadow-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none transition"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                      {formaCalculo === 'Taxa' ? '% a.a.' : 'R$'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span>Quantidade:</span>
                    <input
                      type="number"
                      min={1}
                      value={quantity}
                      onChange={e => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      className="w-20 px-2 py-0.5 text-right font-bold border border-slate-300 rounded-md bg-white text-slate-800 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                </div>

              </div>
            </div>

            {/* TRAVA DE ELEGIBILIDADE INSTITUCIONAL */}
            {anbimaResult && !anbimaResult.elegivel && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 text-amber-900">
                <AlertCircle size={20} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-sm text-amber-900">Indisponibilidade de Cálculo Metodológico</h4>
                  <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                    {anbimaResult.ineligibilityReason}
                  </p>
                </div>
              </div>
            )}

            {/* CARD 3: RESULTADOS DA OPERAÇÃO (DESIGN LIMPO ESTILO ANBIMA) */}
            {anbimaResult && anbimaResult.elegivel && (
              <div className="space-y-6">

                {/* PAINEL DE RESULTADOS COM DESTAQUE OFICIAL */}
                <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div>
                      <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                        <CheckCircle2 size={18} className="text-emerald-600" />
                        Resultados da Operação
                      </h3>
                      <p className="text-xs text-slate-500">
                        Valores calculados conforme convenção oficial ANBIMA (base 252 dias úteis).
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowConvexity(!showConvexity)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-xs font-bold transition"
                      >
                        <LineChart size={14} className="text-blue-600" />
                        {showConvexity ? 'Ocultar Curva Preço x Taxa' : 'Ver Curva Preço x Taxa'}
                      </button>
                    </div>
                  </div>

                  {/* CARDS DE DESTAQUE PRINCIPAL: PU OPERAÇÃO & TAXA */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* CARD PU OPERAÇÃO */}
                    <div className="p-5 bg-blue-50/60 rounded-xl border border-blue-100 space-y-1 relative">
                      <span className="text-xs font-bold text-blue-900 uppercase tracking-wider block">
                        PU Operação
                      </span>
                      <div className="text-2xl sm:text-3xl font-black text-blue-900 tracking-tight">
                        {formatBrCurrency(anbimaResult.puOperacao, 6)}
                      </div>
                      <div className="flex items-center gap-2 pt-1 text-xs text-slate-600">
                        <span className={`font-bold px-2 py-0.5 rounded ${
                          anbimaResult.agioDesagioPct < 0
                            ? 'bg-emerald-100 text-emerald-800'
                            : (anbimaResult.agioDesagioPct > 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-800')
                        }`}>
                          {anbimaResult.agioDesagioPct < 0 ? 'Deságio' : (anbimaResult.agioDesagioPct > 0 ? 'Ágio' : 'Ao Par')}: {anbimaResult.agioDesagioPct.toFixed(2)}%
                        </span>
                        <span>({formatBrCurrency(anbimaResult.agioDesagioReais, 2)})</span>
                      </div>
                    </div>

                    {/* CARD TAXA OPERAÇÃO */}
                    <div className="p-5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                      <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block">
                        Taxa da Operação (YTM)
                      </span>
                      <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                        {anbimaResult.taxaOperacao.toFixed(4)}% <span className="text-base font-normal text-slate-500">a.a.</span>
                      </div>
                      <div className="text-xs text-slate-600 pt-1 flex items-center gap-1.5">
                        <span>Spread vs {matchedNtnb.nome}:</span>
                        <strong className={spreadVsNtnbBps >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                          {spreadVsNtnbBps >= 0 ? `+${spreadVsNtnbBps}` : spreadVsNtnbBps} bps
                        </strong>
                        <span className="text-slate-400">({matchedNtnb.taxa.toFixed(2)}%)</span>
                      </div>
                    </div>

                  </div>

                  {/* GRID DE INDICADORES OFICIAIS */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3.5 pt-2">
                    <div className="p-3.5 bg-white rounded-xl border border-slate-200">
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">PU Par</span>
                      <span className="font-bold text-slate-900 text-xs sm:text-sm block truncate" title={String(anbimaResult.pupar)}>
                        {formatBrCurrency(anbimaResult.pupar, 6)}
                      </span>
                      <span className="text-[10px] text-blue-700 font-medium block mt-0.5">
                        {anbimaResult.porcentagemPupar.toFixed(4)}% do Par
                      </span>
                    </div>

                    <div className="p-3.5 bg-white rounded-xl border border-slate-200">
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">PU Limpo</span>
                      <span className="font-bold text-slate-900 text-xs sm:text-sm block truncate" title={String(anbimaResult.puLimpo)}>
                        {formatBrCurrency(anbimaResult.puLimpo, 6)}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium block mt-0.5">Sem juros decorridos</span>
                    </div>

                    <div className="p-3.5 bg-white rounded-xl border border-slate-200">
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">Juros Decorridos</span>
                      <span className="font-bold text-emerald-700 text-xs sm:text-sm block truncate">
                        {formatBrCurrency(anbimaResult.jurosDecorridos, 6)}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium block mt-0.5">Accrued interest</span>
                    </div>

                    <div className="p-3.5 bg-white rounded-xl border border-slate-200">
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">Duration Macaulay</span>
                      <span className="font-bold text-slate-900 text-xs sm:text-sm block">
                        {anbimaResult.durationDu.toFixed(2)} <span className="text-[10px] font-normal text-slate-400">DU</span>
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium block mt-0.5">
                        {anbimaResult.durationAnos.toFixed(2)} anos
                      </span>
                    </div>

                    <div className="p-3.5 bg-white rounded-xl border border-slate-200">
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">Duration Modificada</span>
                      <span className="font-bold text-slate-900 text-xs sm:text-sm block">
                        {anbimaResult.modifiedDuration.toFixed(2)}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium block mt-0.5">Sensibilidade / 100 bps</span>
                    </div>

                    <div className="p-3.5 bg-white rounded-xl border border-slate-200">
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">Financeiro Total</span>
                      <span className="font-bold text-slate-900 text-xs sm:text-sm block truncate">
                        {formatBrCurrency(anbimaResult.valorFinanceiro, 2)}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium block mt-0.5">{quantity} título(s)</span>
                    </div>
                  </div>

                  {/* GRÁFICO DE CONVEXIDADE COLAPSÁVEL */}
                  {showConvexity && (
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 animate-in fade-in duration-200">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800">
                          Curva de Convexidade (Preço Unitário x Taxa Operação)
                        </span>
                        <span className="text-[10px] text-slate-500">Choque de ±300 bps</span>
                      </div>
                      <div className="h-56 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={convexityData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis dataKey="taxaLabel" stroke="#94a3b8" fontSize={10} tickLine={false} />
                            <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} domain={['auto', 'auto']} tickFormatter={val => `R$${val}`} />
                            <RechartsTooltip
                              formatter={(val: any) => [`R$ ${Number(val).toFixed(2)}`, 'PU Operação']}
                              labelFormatter={label => `Taxa: ${label}`}
                            />
                            <Area type="monotone" dataKey="puOperacao" stroke="#2563eb" strokeWidth={2} fill="#3b82f6" fillOpacity={0.15} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                </div>

                {/* CARD 4: FLUXO DE PAGAMENTO (TABELA INSTITUCIONAL ANBIMA) */}
                <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div>
                      <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                        <Table size={18} className="text-blue-600" />
                        Fluxo de Pagamento
                      </h3>
                      <p className="text-xs text-slate-500">
                        Cronograma de liquidação com valores nominais projetados e fluxos descontados.
                      </p>
                    </div>
                    <span className="text-xs font-bold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg">
                      {anbimaResult.fluxoPagamento.length} evento(s)
                    </span>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100/80 text-[11px] font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200">
                        <tr>
                          <th className="py-3 px-3.5">Evento</th>
                          <th className="py-3 px-3.5">Data de Liquidação</th>
                          <th className="py-3 px-3.5 text-right">Prazo (DU)</th>
                          <th className="py-3 px-3.5 text-right">Período (DU)</th>
                          <th className="py-3 px-3.5 text-right">Juros Projetados</th>
                          <th className="py-3 px-3.5 text-right">Amortização</th>
                          <th className="py-3 px-3.5 text-right">Valor do Fluxo</th>
                          <th className="py-3 px-3.5 text-right font-black text-blue-800 bg-blue-50/50">Fluxo Descontado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {anbimaResult.fluxoPagamento.map((fl, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 transition">
                            <td className="py-2.5 px-3.5 font-bold text-slate-800">
                              <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-extrabold ${
                                fl.nome.includes('Amort')
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              }`}>
                                {fl.nome}
                              </span>
                            </td>
                            <td className="py-2.5 px-3.5 font-semibold text-slate-700">
                              {formatToBrDate(fl.dataLiquidacao)}
                            </td>
                            <td className="py-2.5 px-3.5 text-right font-mono text-slate-600">
                              {fl.prazoDu}
                            </td>
                            <td className="py-2.5 px-3.5 text-right font-mono text-slate-500">
                              {fl.diasEntrePagamentos}
                            </td>
                            <td className="py-2.5 px-3.5 text-right font-mono text-slate-700">
                              {fl.jurosProjetado.toLocaleString('pt-BR', { minimumFractionDigits: 6, maximumFractionDigits: 6 })}
                            </td>
                            <td className="py-2.5 px-3.5 text-right font-mono text-slate-700">
                              {fl.amortizacao > 0 ? fl.amortizacao.toLocaleString('pt-BR', { minimumFractionDigits: 6, maximumFractionDigits: 6 }) : '-'}
                            </td>
                            <td className="py-2.5 px-3.5 text-right font-mono font-semibold text-slate-800">
                              {fl.valorFluxo.toLocaleString('pt-BR', { minimumFractionDigits: 6, maximumFractionDigits: 6 })}
                            </td>
                            <td className="py-2.5 px-3.5 text-right font-mono font-bold text-blue-700 bg-blue-50/30">
                              {fl.fluxoDescontado.toLocaleString('pt-BR', { minimumFractionDigits: 6, maximumFractionDigits: 6 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-50 font-bold text-slate-900 border-t border-slate-200">
                        <tr>
                          <td colSpan={4} className="py-3 px-3.5 uppercase text-[11px] text-slate-500">
                            Total Geral da Operação
                          </td>
                          <td className="py-3 px-3.5 text-right font-mono text-slate-800">
                            R$ {anbimaResult.fluxoPagamento.reduce((s, f) => s + f.jurosProjetado, 0).toLocaleString('pt-BR', { minimumFractionDigits: 6, maximumFractionDigits: 6 })}
                          </td>
                          <td className="py-3 px-3.5 text-right font-mono text-slate-800">
                            R$ {anbimaResult.fluxoPagamento.reduce((s, f) => s + f.amortizacao, 0).toLocaleString('pt-BR', { minimumFractionDigits: 6, maximumFractionDigits: 6 })}
                          </td>
                          <td className="py-3 px-3.5 text-right font-mono text-slate-900">
                            R$ {anbimaResult.fluxoPagamento.reduce((s, f) => s + f.valorFluxo, 0).toLocaleString('pt-BR', { minimumFractionDigits: 6, maximumFractionDigits: 6 })}
                          </td>
                          <td className="py-3 px-3.5 text-right font-mono font-black text-blue-800 bg-blue-100/60">
                            R$ {anbimaResult.puOperacao.toLocaleString('pt-BR', { minimumFractionDigits: 6, maximumFractionDigits: 6 })}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

              </div>
            )}

          </div>
        )}

        {/* ========================================================================= */}
        {/* VISÃO 2: SIMULADOR DE CARTEIRA & CENÁRIOS MACRO (IPCA / CDI / GROSS-UP) */}
        {/* ========================================================================= */}
        {mainView === 'cenarios' && (
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-6">
            <div className="pb-3 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Sliders size={18} className="text-blue-600" />
                Simulador de Projeção Financeira & Gross-Up Tributário
              </h2>
              <p className="text-xs text-slate-500">
                Compare o papel com instrumentos tributados (como CDBs a 100% ou 110% do CDI) e projete o montante acumulado.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Valor Investido (R$)</label>
                <input
                  type="number"
                  step="1000"
                  value={principalAmount}
                  onChange={e => setPrincipalAmount(Math.max(100, parseFloat(e.target.value) || 0))}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 outline-none focus:border-blue-600 shadow-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Cenário de IPCA Médio (% a.a.)</label>
                <input
                  type="number"
                  step="0.1"
                  value={customIpca}
                  onChange={e => setCustomIpca(parseFloat(e.target.value) || 0)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 outline-none focus:border-blue-600 shadow-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Cenário de CDI Médio (% a.a.)</label>
                <input
                  type="number"
                  step="0.1"
                  value={customCdi}
                  onChange={e => setCustomCdi(parseFloat(e.target.value) || 0)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 outline-none focus:border-blue-600 shadow-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
            </div>

            {/* CARDS COMPARATIVOS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-100 space-y-1">
                <span className="text-[10px] font-bold uppercase text-blue-700 block">Retorno Nominal Esperado</span>
                <span className="text-2xl font-black text-blue-900">
                  {calcNominalRate(inputRate, customIpca).toFixed(2)}% <span className="text-xs font-normal">a.a.</span>
                </span>
                <span className="text-[11px] text-blue-700 block">IPCA ({customIpca.toFixed(1)}%) + Taxa ({inputRate.toFixed(2)}%)</span>
              </div>

              <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-100 space-y-1">
                <span className="text-[10px] font-bold uppercase text-emerald-700 block">Gross-Up Tributário Equivalente</span>
                <span className="text-2xl font-black text-emerald-900">
                  {calcGrossUpRate(inputRate, 0.15).toFixed(2)}% <span className="text-xs font-normal">a.a. Real</span>
                </span>
                <span className="text-[11px] text-emerald-700 block">Taxa que um CDB precisaria pagar (IR 15%)</span>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <span className="text-[10px] font-bold uppercase text-slate-500 block">Saldo Final Estimado</span>
                <span className="text-2xl font-black text-slate-900">
                  R$ {(principalAmount * Math.pow(1 + calcNominalRate(inputRate, customIpca) / 100, tenorYears)).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                </span>
                <span className="text-[11px] text-slate-500 block">Em {tenorYears} anos de carregamento</span>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default CalculatorPage;
