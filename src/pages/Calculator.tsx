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
  Settings2,
  ExternalLink,
  Table,
  LineChart
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
  Legend,
  ReferenceDot
} from 'recharts';
import { fetchCSV, Asset, NtnbRecord, normalizeRating, getRatingBadgeClass, getTipoBadgeClass } from '../utils/csv';
import {
  getIncomeTaxRate,
  calcGrossUpRate,
  calcNominalRate,
  calcFutureValue,
  calcBreakevenInflation,
  CouponFrequency,
  AmortizationSchedule,
  ReinvestmentStrategy
} from '../utils/calculatorMath';
import {
  calculateAnbimaPricing,
  addBusinessDays,
  countBusinessDays,
  PaymentEventItem,
  AnbimaPricingResult
} from '../utils/anbimaCalculatorMath';

/* ================= ATIVOS EM DESTAQUE PARA PREENCHIMENTO RÁPIDO ================= */
const POPULAR_SHORTCUTS = [
  { label: 'Deb. Brava (ENAT14)', ticker: 'ENAT14' },
  { label: 'CRA Pré-Fixado (CRA026002BE)', ticker: 'CRA026002BE' },
  { label: 'Deb. Vale (VALED1)', ticker: 'VALED1' },
  { label: 'Deb. Sabesp (SBSPE2)', ticker: 'SBSPE2' },
  { label: 'Deb. Cerradinho (CERR18)', ticker: 'CERR18' }
];

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
          const actives = assetsData.filter(a => a.status_ativo === 'Ativo');
          const list = actives.length > 0 ? actives : assetsData;
          setAllAssets(list);

          if (initialTicker) {
            const found = list.find(a => (a.ticker || '').toUpperCase() === initialTicker);
            if (found) {
              handleSelectAsset(found);
            }
          } else {
            // Seleciona ENAT14 como exemplo benchmark por default
            const defAsset = list.find(a => a.ticker === 'ENAT14') || list[0];
            if (defAsset) {
              handleSelectAsset(defAsset);
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
    const rAnb = parseFloat(a.taxa_indicativa_anbima || a.taxa_mercado || '');
    const rB3 = parseFloat(a.taxa_negocio_b3 || '');
    const rEmiss = parseFloat(a.taxa_emissao || '');
    const bestRate = !isNaN(rAnb) && rAnb > 0 ? rAnb : (!isNaN(rB3) && rB3 > 0 ? rB3 : (!isNaN(rEmiss) ? rEmiss : 8.2597));
    setInputRate(Number(bestRate.toFixed(4)));

    // Identifica PU inicial
    const rawPu = a.vna || a.pu || a.pu_par || '';
    const puVna = typeof rawPu === 'number' ? rawPu : parseFloat(String(rawPu));
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

  /* ================= 6. BUSCA DE ATIVOS ================= */
  const searchResults = useMemo(() => {
    if (!searchQuery || searchQuery.trim().length < 2) return [];
    const q = searchQuery.toLowerCase().trim();
    return allAssets
      .filter(a => 
        (a.ticker && a.ticker.toLowerCase().includes(q)) ||
        (a.issuer && a.issuer.toLowerCase().includes(q)) ||
        (a.isin && a.isin.toLowerCase().includes(q))
      )
      .slice(0, 8);
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
    const txt = `[Calculadora FixData / ANBIMA - ${anbimaResult.ticker}]
PU Operação: R$ ${anbimaResult.puOperacao.toFixed(6)}
PU Par: R$ ${anbimaResult.pupar.toFixed(6)} (% PU Par: ${anbimaResult.porcentagemPupar.toFixed(4)}%)
Taxa Operação: ${anbimaResult.taxaOperacao.toFixed(4)}% a.a.
Duration: ${anbimaResult.durationDu.toFixed(2)} DU (${anbimaResult.durationAnos.toFixed(2)} anos)
Liquidação: ${anbimaResult.dataLiquidacao}`;
    navigator.clipboard.writeText(txt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50/60 pb-16 font-sans text-slate-800">
      {/* HEADER DA PÁGINA */}
      <div className="bg-white border-b border-slate-200/80 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-2 bg-blue-50 text-blue-700 rounded-xl border border-blue-100/80 shadow-xs">
                  <Calculator size={20} className="stroke-[2.2]" />
                </span>
                <div>
                  <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                    Calculadora de Renda Fixa & Crédito Privado
                    <span className="text-[11px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded-full">
                      Padrão ANBIMA & B3
                    </span>
                  </h1>
                  <p className="text-xs text-slate-500 font-medium">
                    Apreçamento bidirecional (Taxa ↔ PU), PU Par, PU Limpo, Duration e Grade de Pagamentos Descontados.
                  </p>
                </div>
              </div>
            </div>

            {/* SELETOR DE MODO / VISÃO */}
            <div className="flex items-center gap-2 bg-slate-100/90 p-1 rounded-2xl border border-slate-200/80 self-start md:self-auto">
              <button
                type="button"
                onClick={() => setMainView('anbima')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                  mainView === 'anbima'
                    ? 'bg-white text-blue-700 shadow-xs border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ShieldCheck size={14} className={mainView === 'anbima' ? 'text-blue-600' : 'text-slate-400'} />
                Calculadora Oficial (ANBIMA / B3)
              </button>

              <button
                type="button"
                onClick={() => setMainView('cenarios')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                  mainView === 'cenarios'
                    ? 'bg-white text-blue-700 shadow-xs border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sliders size={14} className={mainView === 'cenarios' ? 'text-blue-600' : 'text-slate-400'} />
                Simulador de Carteira & Cenários
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">

        {/* CARD DE BUSCA & ATIVO SELECIONADO */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-xs space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Campo de Busca */}
            <div className="relative flex-1 max-w-xl">
              <div className="relative">
                <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => {
                    setSearchQuery(e.target.value);
                    setShowSearchResults(true);
                  }}
                  onFocus={() => setShowSearchResults(true)}
                  placeholder="Buscar ativo por Ticker, ISIN ou Devedor (ex: ENAT14, CRA026002BE)..."
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition"
                />
              </div>

              {/* Dropdown de Resultados da Busca */}
              {showSearchResults && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-slate-200 py-1.5 z-40 max-h-72 overflow-y-auto">
                  {searchResults.map(a => (
                    <button
                      key={a.ticker}
                      type="button"
                      onClick={() => handleSelectAsset(a)}
                      className="w-full text-left px-4 py-2.5 hover:bg-blue-50/80 transition flex items-center justify-between gap-3 border-b border-slate-100 last:border-0"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-xs text-slate-900">{a.ticker}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${getTipoBadgeClass(a.tipo)}`}>
                            {a.tipo}
                          </span>
                          <span className="text-[11px] font-medium text-slate-500">{a.indexador}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 truncate max-w-sm">{a.issuer}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-slate-800">
                          {a.taxa_indicativa_anbima ? `${a.taxa_indicativa_anbima}%` : (a.taxa_emissao ? `${a.taxa_emissao}%` : '')}
                        </span>
                        <span className="block text-[10px] text-slate-400">Venc. {a.vencimento || 'N/D'}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Chips de Atalho Rápido */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-400 mr-1 flex items-center gap-1">
                <Sparkles size={13} className="text-amber-500" />
                Exemplos:
              </span>
              {POPULAR_SHORTCUTS.map(sc => (
                <button
                  key={sc.ticker}
                  type="button"
                  onClick={() => {
                    const found = allAssets.find(a => a.ticker === sc.ticker);
                    if (found) handleSelectAsset(found);
                  }}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition ${
                    selectedAsset?.ticker === sc.ticker
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {sc.label}
                </button>
              ))}
            </div>
          </div>

          {/* FICHA TÉCNICA DO ATIVO SELECIONADO */}
          {selectedAsset && (
            <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 text-xs">
              <div>
                <span className="text-slate-400 font-bold uppercase text-[10px] block">Contrato / Ticker</span>
                <span className="font-extrabold text-slate-900 text-sm">{selectedAsset.ticker}</span>
              </div>
              <div>
                <span className="text-slate-400 font-bold uppercase text-[10px] block">Código ISIN</span>
                <span className="font-mono text-slate-700">{selectedAsset.isin || 'N/D'}</span>
              </div>
              <div>
                <span className="text-slate-400 font-bold uppercase text-[10px] block">Devedor / Emissor</span>
                <span className="font-semibold text-slate-800 truncate block" title={selectedAsset.issuer}>
                  {selectedAsset.issuer || 'N/D'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 font-bold uppercase text-[10px] block">Indexador</span>
                <span className="font-bold text-blue-700">{selectedAsset.indexador || 'IPCA'}</span>
              </div>
              <div>
                <span className="text-slate-400 font-bold uppercase text-[10px] block">Taxa de Emissão</span>
                <span className="font-bold text-slate-800">
                  {selectedAsset.taxa_emissao ? `${Number(selectedAsset.taxa_emissao).toFixed(4)}% a.a.` : 'N/D'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 font-bold uppercase text-[10px] block">Vencimento</span>
                <span className="font-bold text-slate-900">{selectedAsset.vencimento || 'N/D'}</span>
              </div>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* VISÃO 1: CALCULADORA OFICIAL ANBIMA & B3 (REPLICA INSTITUCIONAL) */}
        {/* ========================================================================= */}
        {mainView === 'anbima' && (
          <div className="space-y-6">

            {/* SEÇÃO DE ENTRADA DE PARÂMETROS */}
            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/90 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <Scale size={18} className="text-blue-600" />
                    Parâmetros de Negociação da Operação
                  </h2>
                  <p className="text-xs text-slate-500">
                    Defina as datas da operação, liquidação e alterne entre cálculo por Taxa ou por PU.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={copyResults}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition shadow-xs"
                  >
                    {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                    {copied ? 'Copiado!' : 'Copiar Resultados'}
                  </button>
                </div>
              </div>

              {/* GRID DE PARÂMETROS */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-5">

                {/* 1. Data de Operação */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center">
                    Data da Operação
                    <InfoTooltip
                      title="Data da Operação"
                      content="Data em que a negociação é acordada entre as contrapartes no mercado secundário."
                    />
                  </label>
                  <input
                    type="date"
                    value={dataOperacao}
                    onChange={e => setDataOperacao(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                  <span className="text-[10px] text-slate-400 block">Padrão: Data de hoje</span>
                </div>

                {/* 2. Data de Liquidação com D+0, D+1, D+2 */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center">
                    Data de Liquidação
                    <InfoTooltip
                      title="Data de Liquidação Financeira"
                      content="Data útil em que os recursos financeiros e a custódia do título são efetivamente transferidos via B3."
                    />
                  </label>
                  <div className="flex items-center gap-1">
                    {(['D0', 'D1', 'D2'] as const).map(mode => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setSettlementMode(mode)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition ${
                          settlementMode === mode
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {mode === 'D0' ? 'D+0' : (mode === 'D1' ? 'D+1' : 'D+2')}
                      </button>
                    ))}
                  </div>
                  <div className="text-[11px] font-bold text-blue-700 bg-blue-50/80 px-2.5 py-1 rounded-lg border border-blue-100">
                    Liquidando em: {dataLiquidacao}
                  </div>
                </div>

                {/* 3. Alternância Modo: Por Taxa vs Por PU */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center">
                    Forma de Cálculo
                    <InfoTooltip
                      title="Cálculo Bidirecional (ANBIMA)"
                      content="Por Taxa: você informa a taxa (% a.a.) e o motor calcula o PU. Por PU: você informa o PU financeiro e o algoritmo numérico de Brent resolve a Taxa Interna de Retorno (YTM)."
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                    <button
                      type="button"
                      onClick={() => handleToggleFormaCalculo('Taxa')}
                      className={`py-1.5 rounded-lg text-xs font-extrabold transition ${
                        formaCalculo === 'Taxa'
                          ? 'bg-white text-blue-700 shadow-xs border border-slate-200/80'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Por Taxa
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleFormaCalculo('PU')}
                      className={`py-1.5 rounded-lg text-xs font-extrabold transition ${
                        formaCalculo === 'PU'
                          ? 'bg-white text-blue-700 shadow-xs border border-slate-200/80'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Por PU
                    </button>
                  </div>
                  <span className="text-[10px] text-slate-400 block">
                    {formaCalculo === 'Taxa' ? 'Entrada de taxa anual' : 'Entrada de preço unitário'}
                  </span>
                </div>

                {/* 4. Valor de Entrada (Taxa ou PU) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>{formaCalculo === 'Taxa' ? 'Taxa da Operação (% a.a.)' : 'PU da Operação (R$)'}</span>
                    {formaCalculo === 'Taxa' && selectedAsset?.taxa_indicativa_anbima && (
                      <button
                        type="button"
                        onClick={() => setInputRate(parseFloat(selectedAsset.taxa_indicativa_anbima!))}
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
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-extrabold text-slate-900 outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
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
                      className="w-16 px-1.5 py-0.5 text-right font-bold border border-slate-200 rounded-md bg-white text-slate-800"
                    />
                  </div>
                </div>

              </div>
            </div>

            {/* TRAVA DE ELEGIBILIDADE INSTITUCIONAL */}
            {anbimaResult && !anbimaResult.elegivel && (
              <div className="p-5 bg-amber-50 border border-amber-200/90 rounded-3xl flex items-start gap-3.5 text-amber-900">
                <AlertCircle size={22} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-extrabold text-sm text-amber-900">Indisponibilidade de Cálculo Conforme Metodologia</h4>
                  <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                    {anbimaResult.ineligibilityReason}
                  </p>
                  <p className="text-[11px] text-amber-700 mt-2 font-medium">
                    Conforme o padrão institucional da ANBIMA e B3, não geramos estimativas artificiais quando o título carece de dados contratuais mínimos de liquidação ou está vencido.
                  </p>
                </div>
              </div>
            )}

            {/* RESULTADOS OFICIAIS (KPIS GRID) */}
            {anbimaResult && anbimaResult.elegivel && (
              <div className="space-y-6">

                {/* GRID DE CARDS PRINCIPAIS */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

                  {/* 1. PU OPERAÇÃO */}
                  <div className="p-4 sm:p-5 bg-white rounded-3xl border border-slate-200/90 shadow-xs space-y-1 relative overflow-hidden">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      <span>PU Operação (Sujo)</span>
                      <InfoTooltip
                        title="Preço Unitário da Operação"
                        content="Valor presente total de todos os pagamentos futuros descontados até a data de liquidação, incorporando juros decorridos."
                        formula="PU = Sum [ CF_k / (1 + y)^(DU_k / 252) ]"
                      />
                    </div>
                    <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                      R$ {anbimaResult.puOperacao.toLocaleString('pt-BR', { minimumFractionDigits: 6, maximumFractionDigits: 6 })}
                    </div>
                    <div className="flex items-center gap-1.5 pt-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        anbimaResult.agioDesagioPct < 0
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : (anbimaResult.agioDesagioPct > 0 ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-slate-50 text-slate-700')
                      }`}>
                        {anbimaResult.agioDesagioPct < 0 ? 'Deságio' : (anbimaResult.agioDesagioPct > 0 ? 'Ágio' : 'Ao Par')}: {anbimaResult.agioDesagioPct.toFixed(2)}%
                      </span>
                    </div>
                  </div>

                  {/* 2. PU PAR */}
                  <div className="p-4 sm:p-5 bg-white rounded-3xl border border-slate-200/90 shadow-xs space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      <span>PU Par (VNa + Accrued)</span>
                      <InfoTooltip
                        title="Preço Par (PU Par)"
                        content="Valor de face do título corrigido até a liquidação pelos juros contratuais decorridos desde o último cupom."
                        formula="PU Par = VNa * (1 + Taxa Emissao)^(DU_decorrido / 252)"
                      />
                    </div>
                    <div className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
                      R$ {anbimaResult.pupar.toLocaleString('pt-BR', { minimumFractionDigits: 6, maximumFractionDigits: 6 })}
                    </div>
                    <div className="text-[11px] font-bold text-blue-700 pt-1">
                      % do PU Par: {anbimaResult.porcentagemPupar.toFixed(4)}%
                    </div>
                  </div>

                  {/* 3. DURATION DE MACAULAY */}
                  <div className="p-4 sm:p-5 bg-white rounded-3xl border border-slate-200/90 shadow-xs space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      <span>Duration (Macaulay)</span>
                      <InfoTooltip
                        title="Duration de Macaulay"
                        content="Prazo médio ponderado de recebimento de todos os fluxos de caixa a valor presente."
                        formula="Duration = Sum(DU_k * PV_k) / PU_operacao"
                      />
                    </div>
                    <div className="text-xl sm:text-2xl font-black text-indigo-700 tracking-tight">
                      {anbimaResult.durationDu.toFixed(2)} <span className="text-sm font-bold text-slate-400">DU</span>
                    </div>
                    <div className="text-[11px] font-semibold text-slate-500 pt-1">
                      Equivalente a <strong>{anbimaResult.durationAnos.toFixed(2)} anos</strong>
                    </div>
                  </div>

                  {/* 4. TAXA OPERAÇÃO & SPREAD */}
                  <div className="p-4 sm:p-5 bg-white rounded-3xl border border-slate-200/90 shadow-xs space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      <span>Taxa Operação (YTM)</span>
                      <InfoTooltip
                        title="Taxa Interna de Retorno (YTM)"
                        content="Taxa anualizada em base 252 dias úteis equivalente à compra no PU informado."
                      />
                    </div>
                    <div className="text-xl sm:text-2xl font-black text-blue-700 tracking-tight">
                      {anbimaResult.taxaOperacao.toFixed(4)}% <span className="text-xs font-semibold text-slate-400">a.a.</span>
                    </div>
                    <div className="text-[11px] font-bold text-slate-600 pt-1 flex items-center gap-1">
                      <span>Spread Over NTN-B:</span>
                      <span className={spreadVsNtnbBps >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                        {spreadVsNtnbBps >= 0 ? `+${spreadVsNtnbBps}` : spreadVsNtnbBps} bps
                      </span>
                    </div>
                  </div>

                </div>

                {/* LINHA SECUNDÁRIA DE MÉTRICAS */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">PU Limpo (Clean Price)</span>
                    <span className="font-extrabold text-slate-800 text-sm">
                      R$ {anbimaResult.puLimpo.toLocaleString('pt-BR', { minimumFractionDigits: 6, maximumFractionDigits: 6 })}
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Sem juros decorridos</span>
                  </div>

                  <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Juros Decorridos (Accrued)</span>
                    <span className="font-extrabold text-emerald-700 text-sm">
                      R$ {anbimaResult.jurosDecorridos.toLocaleString('pt-BR', { minimumFractionDigits: 6, maximumFractionDigits: 6 })}
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Acumulado até a liquidação</span>
                  </div>

                  <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Duration Modificada (DV01)</span>
                    <span className="font-extrabold text-slate-800 text-sm">
                      {anbimaResult.modifiedDuration.toFixed(2)}
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Sensibilidade / 100 bps</span>
                  </div>

                  <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Valor Financeiro Total</span>
                    <span className="font-extrabold text-slate-900 text-sm">
                      R$ {anbimaResult.valorFinanceiro.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">{quantity} título(s)</span>
                  </div>
                </div>

                {/* GRÁFICO DE CONVEXIDADE & TABELA DE FLUXOS LADO A LADO */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                  {/* GRÁFICO DE CONVEXIDADE (1 COLUNA) */}
                  <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-xs space-y-4">
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                        <TrendingUp size={16} className="text-blue-600" />
                        Curva de Convexidade (Preço x Taxa)
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Sensibilidade do PU a choques de taxa em torno da operação atual.
                      </p>
                    </div>

                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={convexityData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="taxaLabel" stroke="#94a3b8" fontSize={10} tickLine={false} />
                          <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} domain={['auto', 'auto']} tickFormatter={val => `R$${val}`} />
                          <RechartsTooltip
                            formatter={(val: any) => [`R$ ${Number(val).toFixed(2)}`, 'PU Operação']}
                            labelFormatter={label => `Taxa: ${label}`}
                          />
                          <Area type="monotone" dataKey="puOperacao" stroke="#2563eb" strokeWidth={2.5} fill="#3b82f6" fillOpacity={0.12} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="p-3 bg-blue-50/80 rounded-xl border border-blue-100 text-[11px] text-blue-900 space-y-1">
                      <span className="font-bold block">Ponto da Operação Atual:</span>
                      <div className="flex justify-between">
                        <span>Taxa: <strong>{anbimaResult.taxaOperacao.toFixed(4)}% a.a.</strong></span>
                        <span>PU: <strong>R$ {anbimaResult.puOperacao.toFixed(2)}</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* TABELA DE CRONOGRAMA DE PAGAMENTOS DESCONTADOS (2 COLUNAS) */}
                  <div className="lg:col-span-2 bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-xs space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                          <Table size={16} className="text-blue-600" />
                          Cronograma de Pagamentos & Fluxo Descontado
                        </h3>
                        <p className="text-[11px] text-slate-500">
                          Cada vértice futuro descontado a valor presente conforme convenção ANBIMA (DU/252).
                        </p>
                      </div>
                      <span className="text-[11px] font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-lg">
                        {anbimaResult.fluxoPagamento.length} eventos futuros
                      </span>
                    </div>

                    <div className="overflow-x-auto max-h-80 overflow-y-auto rounded-2xl border border-slate-200">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider sticky top-0 border-b border-slate-200">
                          <tr>
                            <th className="py-2.5 px-3">Evento</th>
                            <th className="py-2.5 px-3">Liquidação</th>
                            <th className="py-2.5 px-3 text-right">Prazo (DU)</th>
                            <th className="py-2.5 px-3 text-right">Período</th>
                            <th className="py-2.5 px-3 text-right">Juros (R$)</th>
                            <th className="py-2.5 px-3 text-right">Amortização</th>
                            <th className="py-2.5 px-3 text-right font-black text-blue-700">Fluxo Desc. (PV)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {anbimaResult.fluxoPagamento.map((fl, idx) => (
                            <tr key={idx} className="hover:bg-blue-50/50 transition">
                              <td className="py-2 px-3 font-bold text-slate-800">
                                <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-extrabold ${
                                  fl.nome.includes('Amort')
                                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                }`}>
                                  {fl.nome}
                                </span>
                              </td>
                              <td className="py-2 px-3 font-medium text-slate-700">{fl.dataLiquidacao}</td>
                              <td className="py-2 px-3 text-right font-mono text-slate-600">{fl.prazoDu}</td>
                              <td className="py-2 px-3 text-right font-mono text-slate-500">{fl.diasEntrePagamentos} DU</td>
                              <td className="py-2 px-3 text-right font-mono text-slate-700">
                                {fl.jurosProjetado.toFixed(2)}
                              </td>
                              <td className="py-2 px-3 text-right font-mono text-slate-700">
                                {fl.amortizacao > 0 ? fl.amortizacao.toFixed(2) : '-'}
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-blue-700 bg-blue-50/30">
                                R$ {fl.fluxoDescontado.toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-slate-50 font-bold text-slate-900 border-t border-slate-200 sticky bottom-0">
                          <tr>
                            <td colSpan={4} className="py-2.5 px-3 uppercase text-[10px] text-slate-500">
                              Totalização da Operação
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-slate-800">
                              R$ {anbimaResult.fluxoPagamento.reduce((s, f) => s + f.jurosProjetado, 0).toFixed(2)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-slate-800">
                              R$ {anbimaResult.fluxoPagamento.reduce((s, f) => s + f.amortizacao, 0).toFixed(2)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-black text-blue-700 bg-blue-50">
                              R$ {anbimaResult.puOperacao.toFixed(2)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
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
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/90 shadow-xs space-y-6">
            <div className="pb-4 border-b border-slate-100">
              <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
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
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 outline-none focus:bg-white focus:border-blue-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Cenário de IPCA Médio (% a.a.)</label>
                <input
                  type="number"
                  step="0.1"
                  value={customIpca}
                  onChange={e => setCustomIpca(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 outline-none focus:bg-white focus:border-blue-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Cenário de CDI Médio (% a.a.)</label>
                <input
                  type="number"
                  step="0.1"
                  value={customCdi}
                  onChange={e => setCustomCdi(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 outline-none focus:bg-white focus:border-blue-500"
                />
              </div>
            </div>

            {/* CARDS COMPARATIVOS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
              <div className="p-4 bg-blue-50/80 rounded-2xl border border-blue-100 space-y-1">
                <span className="text-[10px] font-bold uppercase text-blue-600 block">Retorno Nominal Esperado</span>
                <span className="text-2xl font-black text-blue-900">
                  {calcNominalRate(inputRate, customIpca).toFixed(2)}% <span className="text-xs font-normal">a.a.</span>
                </span>
                <span className="text-[11px] text-blue-700 block">IPCA ({customIpca.toFixed(1)}%) + Taxa ({inputRate.toFixed(2)}%)</span>
              </div>

              <div className="p-4 bg-emerald-50/80 rounded-2xl border border-emerald-100 space-y-1">
                <span className="text-[10px] font-bold uppercase text-emerald-600 block">Gross-Up Tributário Equivalente</span>
                <span className="text-2xl font-black text-emerald-900">
                  {calcGrossUpRate(inputRate, 0.15).toFixed(2)}% <span className="text-xs font-normal">a.a. Real</span>
                </span>
                <span className="text-[11px] text-emerald-700 block">Taxa que um CDB precisaria pagar (IR 15%)</span>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
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
