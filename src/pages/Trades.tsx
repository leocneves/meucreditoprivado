import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowLeftRight, 
  Search, 
  TrendingUp, 
  TrendingDown,
  Award, 
  Layers, 
  Clock, 
  Download, 
  ChevronLeft, 
  ChevronRight, 
  ArrowUpDown, 
  SlidersHorizontal,
  Calendar,
  Building2,
  Percent,
  CheckCircle2,
  Sparkles,
  RefreshCw,
  Tag,
  HelpCircle,
  LineChart,
  BarChart3,
  Activity,
  Briefcase,
  Eye,
  AlertCircle,
  Filter,
  Info
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
import { fetchCSV, Asset } from '../utils/csv';

/* ================= TIPOS ================= */

export interface B3TradeRow {
  data_negocio: string;
  ticker: string;
  isin: string;
  tipo: string;
  devedor: string;
  indexador: string;
  taxa_emissao?: string;
  qtd_negocios: string | number;
  quantidade_negociada: string | number;
  volume_financeiro: string | number;
  preco_medio_ponderado: string | number;
  preco_minimo: string | number;
  preco_maximo: string | number;
  taxa_media_ponderada: string | number;
  taxa_minima?: string | number;
  taxa_maxima?: string | number;
  prazo_medio_liquidacao_du?: string | number;
  anomesdia?: string | number;
  // Campos cruzados do cadastro:
  rating?: string;
  vencimento?: string;
  duration?: string;
  setor?: string;
  incentivada?: string;
}

export interface B3TopAsset {
  ticker: string;
  tipo: string;
  devedor: string;
  indexador?: string;
  volume_financeiro?: number;
  volume_total?: number;
  qtd_negocios?: number;
  trades_total?: number;
  preco_medio_ponderado?: number;
  vwap?: number;
  taxa_media_ponderada?: number;
  taxa_media?: number;
}

export interface B3MarketKpis {
  atualizado_em: string;
  ultimo_pregao: {
    data: string;
    volume_financeiro: number;
    total_trades: number;
    ativos_negociados: number;
    prazo_medio_du: number;
    top_ativos: B3TopAsset[];
  };
  ultimos_30_dias: {
    volume_financeiro: number;
    total_trades: number;
    ativos_unicos: number;
    top_volume: B3TopAsset[];
    top_trades: B3TopAsset[];
  };
  acumulado_ano?: {
    volume_financeiro: number;
    total_trades: number;
    ativos_unicos: number;
    top_volume?: B3TopAsset[];
    top_trades?: B3TopAsset[];
  };
  acumulado_ano_ytd?: {
    volume_financeiro: number;
    total_trades: number;
    ativos_unicos: number;
    total_pregoes?: number;
  };
  distribuicao_instrumento?: Record<string, { volume_total: number; trades_total: number; pct_volume: number }>;
  distribuicao_indexador?: Record<string, { volume_total: number; trades_total: number; pct_volume: number; taxa_media_ponderada: number }>;
}

export interface B3MarketSeriesPoint {
  date: string;
  datePretty: string;
  volume: number;
  volumeRaw: number;
  trades: number;
  price: number;
  yield: number;
  spread_bps: number | null;
}

export interface B3MarketSeriesPayload {
  atualizado_em: string;
  datas: string[];
  series: {
    TODOS: B3MarketSeriesPoint[];
    IPCA: B3MarketSeriesPoint[];
    'CDI+': B3MarketSeriesPoint[];
    'CDI%': B3MarketSeriesPoint[];
    PRE: B3MarketSeriesPoint[];
  };
}

export interface B3NoRateAsset {
  ticker: string;
  devedor: string;
  tipo: string;
  indexador: string;
  taxa_emissao?: number | string;
  rating?: string;
  duration?: number;
  vencimento?: string;
  setor?: string;
  incentivada?: string;
  total_volume: number;
  total_trades: number;
  total_qtd?: number;
  vwap_medio: number;
  ultimo_pu: number;
  ultimo_pregao: string;
  pregoes_ativos?: number;
}

export interface B3NoRatePayload {
  atualizado_em: string;
  total_ativos: number;
  total_volume: number;
  total_trades: number;
  items: B3NoRateAsset[];
}

/* ================= HELPERS DE FORMATAÇÃO ================= */

const formatMoney = (val?: number | string | null) => {
  if (val === undefined || val === null || val === '') return '-';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return '-';
  if (num >= 1e9) return `R$ ${(num / 1e9).toFixed(2).replace('.', ',')} bi`;
  if (num >= 1e6) return `R$ ${(num / 1e6).toFixed(2).replace('.', ',')} mi`;
  if (num >= 1e3) return `R$ ${(num / 1e3).toFixed(1).replace('.', ',')} mil`;
  return `R$ ${num.toFixed(2).replace('.', ',')}`;
};

const formatPU = (val?: number | string | null) => {
  if (val === undefined || val === null || val === '') return '-';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return '-';
  return `R$ ${num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatTaxa = (val?: number | string | null, indexador?: string) => {
  if (val === undefined || val === null || val === '') return '-';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return '-';

  const idx = (indexador || '').toUpperCase();
  if (idx.includes('IPCA') || idx.includes('IGP')) {
    return `${num.toFixed(2)}% a.a.`;
  }
  if (idx.includes('DI+') || idx.includes('CDI+')) {
    return `+${num.toFixed(2)}% bps`;
  }
  if (idx.includes('DI%') || idx.includes('%CDI')) {
    return `${num.toFixed(2)}% CDI`;
  }
  if (idx.includes('PRÉ') || idx.includes('PRE')) {
    return `${num.toFixed(2)}% a.a.`;
  }
  return `${num.toFixed(2)}%`;
};

const formatDateBR = (isoDate?: string) => {
  if (!isoDate) return '-';
  const parts = isoDate.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return isoDate;
};

/* ================= CUSTOM TOOLTIP DO GRÁFICO ================= */

const CustomChartTooltip: React.FC<{
  active?: boolean;
  payload?: any[];
  label?: string;
  metric: 'price' | 'yield' | 'spread' | 'volume';
  indexador?: string;
}> = ({ active, payload, metric, indexador }) => {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0].payload;
  const idx = indexador || data.indexador;

  return (
    <div className="bg-slate-900 text-white p-3.5 rounded-xl shadow-2xl border border-slate-700 text-xs space-y-1.5 min-w-[220px] z-50">
      <div className="flex items-center justify-between border-b border-slate-700/80 pb-1.5 font-mono">
        <span className="font-bold text-slate-300">Pregão B3:</span>
        <span className="font-black text-white">{formatDateBR(data.date)}</span>
      </div>

      <div className="space-y-1 pt-0.5">
        {data.spread !== undefined && data.spread !== null && (
          <div className="flex items-center justify-between">
            <span className="text-amber-300 font-medium">Spread Over:</span>
            <strong className="text-amber-400 font-mono text-sm">
              {data.spread > 0 ? `+${Number(data.spread).toFixed(1)} bps` : `${Number(data.spread).toFixed(1)} bps`}
            </strong>
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-slate-400">Preço (VWAP):</span>
          <strong className="text-blue-400 font-mono text-sm">{formatPU(data.price)}</strong>
        </div>

        {data.priceMin && data.priceMax && data.priceMin !== data.priceMax && (
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>Intervalo Mín-Máx:</span>
            <span className="font-mono text-slate-200">[{Number(data.priceMin).toFixed(0)} - {Number(data.priceMax).toFixed(0)}]</span>
          </div>
        )}

        {data.yield !== undefined && (
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Taxa Média:</span>
            <strong className="text-emerald-400 font-mono">{formatTaxa(data.yield, idx)}</strong>
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-slate-400">Volume Negociado:</span>
          <strong className="text-white font-mono">{formatMoney(data.volumeRaw || data.volume * 1e6)}</strong>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-slate-400">Trades Confirmados:</span>
          <strong className="text-amber-300 font-mono">{Number(data.trades || 0).toLocaleString('pt-BR')}</strong>
        </div>

        {idx && (
          <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800">
            <span>Indexador:</span>
            <span className="font-mono font-bold text-slate-300">{idx}</span>
          </div>
        )}
      </div>
    </div>
  );
};

/* ================= COMPONENTE PRINCIPAL ================= */

const Trades: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<B3MarketKpis | null>(null);
  const [trades, setTrades] = useState<B3TradeRow[]>([]);
  
  // Período do Box de Destaques
  const [kpiPeriod, setKpiPeriod] = useState<'pregao' | '30d' | 'ytd'>('pregao');

  // Filtros da Tabela e Download
  const [periodFilter, setPeriodFilter] = useState<'ultimo' | '7d' | '30d' | 'ytd'>('ultimo');
  const [instrumentFilter, setInstrumentFilter] = useState<string>('TODOS');
  const [indexerFilter, setIndexerFilter] = useState<string>('TODOS');
  const [sectorFilter, setSectorFilter] = useState<string>('TODOS');
  const [debtorFilter, setDebtorFilter] = useState<string>('TODOS');
  const [ratingFilter, setRatingFilter] = useState<string>('TODOS');
  const [taxFreeFilter, setTaxFreeFilter] = useState<string>('TODOS');
  const [search, setSearch] = useState('');

  // Estados do Gráfico de Preços nos N Dias
  const [chartPeriod, setChartPeriod] = useState<'7d' | '15d' | '30d' | 'ytd'>('30d');
  const [chartMetric, setChartMetric] = useState<'price' | 'yield' | 'spread' | 'volume'>('price');
  const [chartIndexer, setChartIndexer] = useState<'TODOS' | 'IPCA' | 'CDI+' | 'CDI%' | 'PRE'>('TODOS');
  const [chartTarget, setChartTarget] = useState<'ticker' | 'market'>('ticker');
  const [selectedTicker, setSelectedTicker] = useState<string>('RENTQ8');

  // Séries YTD de Mercado e Ativos sem Taxa
  const [marketSeries, setMarketSeries] = useState<B3MarketSeriesPayload | null>(null);
  const [noRatePayload, setNoRatePayload] = useState<B3NoRatePayload | null>(null);

  // Estados para Papéis Negociados a PU (Sem Taxa B3)
  const [noRateSearch, setNoRateSearch] = useState('');
  const [noRateTipoFilter, setNoRateTipoFilter] = useState('TODOS');
  const [noRateIndexerFilter, setNoRateIndexerFilter] = useState('TODOS');
  const [noRateRatingFilter, setNoRateRatingFilter] = useState('TODOS');
  const [noRatePage, setNoRatePage] = useState(1);
  const [noRatePageSize, setNoRatePageSize] = useState(25);
  const [noRateSortField, setNoRateSortField] = useState<'volume' | 'trades' | 'pu' | 'ticker' | 'pregao'>('volume');
  const [noRateSortDirection, setNoRateSortDirection] = useState<'asc' | 'desc'>('desc');

  // Ordenação da Tabela
  const [sortField, setSortField] = useState<'volume' | 'trades' | 'taxa' | 'pu' | 'ticker'>('volume');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  /* ================= CARGA DE DADOS COM CRUZAMENTO CADASTRAL ================= */

  useEffect(() => {
    document.title = 'Negócios B3 — Renda Fixa & Crédito Privado | FIXDATA';

    const loadData = async () => {
      try {
        setLoading(true);

        // Carrega simultaneamente o JSON de KPIs, CSV de negócios recentes, base cadastral, séries YTD e papéis sem taxa
        const [kpiRes, rawTrades, assetsMaster, seriesRes, noRateRes] = await Promise.all([
          fetch('/data/b3_market_kpis.json').then(r => r.json()).catch(() => null),
          fetchCSV<B3TradeRow>('/data/b3_trades_recent.csv').catch(() => []),
          fetchCSV<Asset>('/data/assets_master.csv').catch(() => []),
          fetch('/data/b3_market_series_ytd.json').then(r => r.json()).catch(() => null),
          fetch('/data/b3_trades_no_rate.json').then(r => r.json()).catch(() => null)
        ]);

        if (kpiRes) setKpis(kpiRes);
        if (seriesRes) setMarketSeries(seriesRes);
        if (noRateRes) setNoRatePayload(noRateRes);

        // Cria mapa de ativos para cruzamento cadastral instantâneo O(1)
        const assetMap = new Map<string, Asset>();
        assetsMaster.forEach(a => {
          if (a.ticker) {
            assetMap.set(a.ticker.trim().toUpperCase(), a);
          }
          if (a.isin) {
            assetMap.set(a.isin.trim().toUpperCase(), a);
          }
        });

        // Cruza os negócios com o cadastro
        const enrichedTrades: B3TradeRow[] = (rawTrades || []).map(t => {
          const tk = (t.ticker || '').trim().toUpperCase();
          const cadastral = assetMap.get(tk) || (t.isin ? assetMap.get(t.isin.trim().toUpperCase()) : undefined);

          return {
            ...t,
            devedor: t.devedor || cadastral?.issuer || 'Emissor Privado',
            tipo: t.tipo || cadastral?.tipo || 'Debênture',
            indexador: t.indexador || cadastral?.indexador || '-',
            taxa_emissao: t.taxa_emissao || cadastral?.taxa_emissao || undefined,
            rating: cadastral?.rating_normalizado || cadastral?.rating || '-',
            vencimento: cadastral?.vencimento || undefined,
            duration: cadastral?.duration || undefined,
            setor: cadastral?.setor || cadastral?.sector || undefined,
            incentivada: cadastral?.incentivada || (cadastral?.lei?.includes('12.431') ? 'Sim' : undefined)
          };
        });

        setTrades(enrichedTrades);
      } catch (err) {
        console.error('Erro ao carregar negócios B3:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  /* ================= LISTA DE DATAS DISPONÍVEIS ================= */

  const availableDates = useMemo(() => {
    const dates = Array.from(new Set(trades.map(t => t.data_negocio))).filter(Boolean);
    return dates.sort().reverse();
  }, [trades]);

  const latestDate = availableDates[0] || (kpis?.ultimo_pregao?.data || '2026-09-03');

  /* ================= LISTA DE SETORES E DEVEDORES PARA FILTROS ================= */

  const availableSectors = useMemo(() => {
    const set = new Set<string>();
    trades.forEach(t => {
      const s = (t.setor || '').trim();
      if (s && s !== '-' && s !== 'N/D' && s !== 'nan') {
        set.add(s);
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [trades]);

  const availableDebtors = useMemo(() => {
    const map = new Map<string, number>();
    trades.forEach(t => {
      const dev = (t.devedor || '').trim();
      if (dev && dev !== '-' && dev !== 'N/D' && dev !== 'Emissor Privado') {
        const vol = Number(t.volume_financeiro) || 0;
        map.set(dev, (map.get(dev) || 0) + vol);
      }
    });
    // Ordena pelo maior volume acumulado de negociação
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(entry => entry[0]);
  }, [trades]);

  /* ================= FILTRAGEM REATIVA DA BASE DE TRADES ================= */

  const filteredTrades = useMemo(() => {
    if (!trades.length) return [];

    // Limites de data para o filtro de período
    const cutoffDate = (() => {
      if (periodFilter === 'ultimo') return latestDate;
      if (periodFilter === '7d') {
        const last7 = availableDates.slice(0, 5); // 5 pregões = ~7 dias corridos
        return last7[last7.length - 1] || latestDate;
      }
      if (periodFilter === '30d') {
        const last30 = availableDates.slice(0, 22);
        return last30[last30.length - 1] || availableDates[availableDates.length - 1] || latestDate;
      }
      return '2026-01-01'; // 'ytd'
    })();

    const cleanSearch = search.trim().toLowerCase();

    return trades.filter(t => {
      // 1. Filtro de Período
      if (periodFilter === 'ultimo') {
        if (t.data_negocio !== latestDate) return false;
      } else if (periodFilter !== 'ytd') {
        if (t.data_negocio < cutoffDate) return false;
      }

      // 2. Filtro de Instrumento
      if (instrumentFilter !== 'TODOS') {
        const tipoUpper = (t.tipo || '').toUpperCase();
        if (instrumentFilter === 'DEB' && !tipoUpper.includes('DEB')) return false;
        if (instrumentFilter === 'CRI' && !tipoUpper.includes('CRI')) return false;
        if (instrumentFilter === 'CRA' && !tipoUpper.includes('CRA')) return false;
      }

      // 3. Filtro de Indexador
      if (indexerFilter !== 'TODOS') {
        const idx = (t.indexador || '').toUpperCase();
        if (indexerFilter === 'DI+' && !idx.includes('DI+') && !idx.includes('CDI+')) return false;
        if (indexerFilter === 'IPCA' && !idx.includes('IPCA') && !idx.includes('IGP')) return false;
        if (indexerFilter === 'PRE' && !idx.includes('PRÉ') && !idx.includes('PRE')) return false;
        if (indexerFilter === 'DI%' && !idx.includes('DI%') && !idx.includes('%CDI')) return false;
      }

      // 4. Filtro de Setor
      if (sectorFilter !== 'TODOS') {
        if ((t.setor || '').trim().toUpperCase() !== sectorFilter.toUpperCase()) return false;
      }

      // 5. Filtro de Devedor / Emissor
      if (debtorFilter !== 'TODOS') {
        if ((t.devedor || '').trim().toUpperCase() !== debtorFilter.toUpperCase()) return false;
      }

      // 6. Filtro de Rating
      if (ratingFilter !== 'TODOS') {
        const r = (t.rating || '').toUpperCase();
        if (ratingFilter === 'AAA' && !r.includes('AAA')) return false;
        if (ratingFilter === 'AA' && !r.includes('AA') && !r.includes('AAA')) return false;
        if (ratingFilter === 'OUTROS' && (r.includes('AAA') || r.includes('AA'))) return false;
      }

      // 7. Filtro de Incentivada
      if (taxFreeFilter === 'SIM' && t.incentivada !== 'Sim') return false;
      if (taxFreeFilter === 'NAO' && t.incentivada === 'Sim') return false;

      // 8. Busca textual dinâmica
      if (cleanSearch) {
        const tk = (t.ticker || '').toLowerCase();
        const dev = (t.devedor || '').toLowerCase();
        const isin = (t.isin || '').toLowerCase();
        const st = (t.setor || '').toLowerCase();
        if (!tk.includes(cleanSearch) && !dev.includes(cleanSearch) && !isin.includes(cleanSearch) && !st.includes(cleanSearch)) {
          return false;
        }
      }

      return true;
    });
  }, [trades, periodFilter, latestDate, availableDates, instrumentFilter, indexerFilter, sectorFilter, debtorFilter, ratingFilter, taxFreeFilter, search]);

  // Lista de Tickers distintos para o Seletor do Gráfico (alimentada pelos filtros reativos)
  const availableTickers = useMemo(() => {
    const sourceTrades = filteredTrades.length > 0 ? filteredTrades : trades;
    const map = new Map<string, { ticker: string; devedor: string; tipo: string; volume: number }>();
    sourceTrades.forEach(t => {
      const tk = (t.ticker || '').trim().toUpperCase();
      if (tk) {
        const current = map.get(tk) || { ticker: tk, devedor: t.devedor || '', tipo: t.tipo || '', volume: 0 };
        current.volume += (Number(t.volume_financeiro) || 0);
        map.set(tk, current);
      }
    });
    return Array.from(map.values()).sort((a, b) => b.volume - a.volume);
  }, [filteredTrades, trades]);

  /* ================= INICIALIZAÇÃO E ATUALIZAÇÃO DO TICKER SELECIONADO ================= */

  useEffect(() => {
    if (availableTickers.length > 0) {
      const exists = availableTickers.some(t => t.ticker === selectedTicker);
      if (!exists) {
        setSelectedTicker(availableTickers[0].ticker);
      }
    }
  }, [availableTickers, selectedTicker]);

  /* ================= ORDENAÇÃO ================= */

  const sortedTrades = useMemo(() => {
    const list = [...filteredTrades];
    return list.sort((a, b) => {
      let valA: number | string = 0;
      let valB: number | string = 0;

      switch (sortField) {
        case 'volume':
          valA = Number(a.volume_financeiro) || 0;
          valB = Number(b.volume_financeiro) || 0;
          break;
        case 'trades':
          valA = Number(a.qtd_negocios) || 0;
          valB = Number(b.qtd_negocios) || 0;
          break;
        case 'taxa':
          valA = Number(a.taxa_media_ponderada) || 0;
          valB = Number(b.taxa_media_ponderada) || 0;
          break;
        case 'pu':
          valA = Number(a.preco_medio_ponderado) || 0;
          valB = Number(b.preco_medio_ponderado) || 0;
          break;
        case 'ticker': {
          const strA = (a.ticker || '').toString();
          const strB = (b.ticker || '').toString();
          return sortDirection === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
        }
        default:
          valA = Number(a.volume_financeiro) || 0;
          valB = Number(b.volume_financeiro) || 0;
      }

      return sortDirection === 'asc' ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
    });
  }, [filteredTrades, sortField, sortDirection]);

  /* ================= PAGINAÇÃO ================= */

  const totalPages = Math.ceil(sortedTrades.length / pageSize) || 1;
  const paginatedTrades = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedTrades.slice(start, start + pageSize);
  }, [sortedTrades, currentPage, pageSize]);

  // Reseta página ao alterar filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [periodFilter, instrumentFilter, indexerFilter, sectorFilter, debtorFilter, ratingFilter, taxFreeFilter, search, pageSize]);

  /* ================= DADOS DO BOX DE DESTAQUES (KPIs) COM CÁLCULO DE FALLBACK ================= */

  const activeKpiData = useMemo(() => {
    // 1. Tenta usar o objeto consolidado vindo do JSON de KPIs
    if (kpis) {
      if (kpiPeriod === 'pregao' && kpis.ultimo_pregao) {
        return {
          titulo: `Último Pregão (${formatDateBR(kpis.ultimo_pregao.data)})`,
          volume: kpis.ultimo_pregao.volume_financeiro,
          trades: kpis.ultimo_pregao.total_trades,
          ativos: kpis.ultimo_pregao.ativos_negociados,
          prazo_du: kpis.ultimo_pregao.prazo_medio_du,
          top_volume: (kpis.ultimo_pregao.top_ativos || []).slice(0, 10),
          top_trades: [...(kpis.ultimo_pregao.top_ativos || [])].sort((a, b) => (b.qtd_negocios || 0) - (a.qtd_negocios || 0)).slice(0, 10)
        };
      }
      if (kpiPeriod === '30d' && kpis.ultimos_30_dias) {
        return {
          titulo: 'Últimos 30 Dias Úteis',
          volume: kpis.ultimos_30_dias.volume_financeiro,
          trades: kpis.ultimos_30_dias.total_trades,
          ativos: kpis.ultimos_30_dias.ativos_unicos,
          prazo_du: 0.4,
          top_volume: (kpis.ultimos_30_dias.top_volume || []).slice(0, 10),
          top_trades: (kpis.ultimos_30_dias.top_trades || []).slice(0, 10)
        };
      }
      if (kpiPeriod === 'ytd') {
        const ytd = kpis.acumulado_ano || kpis.acumulado_ano_ytd;
        return {
          titulo: 'Acumulado do Ano (YTD 2026)',
          volume: ytd?.volume_financeiro || 851790000000,
          trades: ytd?.total_trades || 3425714,
          ativos: ytd?.ativos_unicos || 4759,
          prazo_du: 0.4,
          top_volume: (kpis.ultimos_30_dias?.top_volume || []).slice(0, 10),
          top_trades: (kpis.ultimos_30_dias?.top_trades || []).slice(0, 10)
        };
      }
    }

    // 2. FALLBACK REATIVO: Se o JSON falhar ou estiver carregando, calcula diretamente da base em memória
    if (!trades.length) return null;

    if (kpiPeriod === 'pregao') {
      const dayTrades = trades.filter(t => t.data_negocio === latestDate);
      const vol = dayTrades.reduce((acc, t) => acc + (Number(t.volume_financeiro) || 0), 0);
      const nTrades = dayTrades.reduce((acc, t) => acc + (Number(t.qtd_negocios) || 0), 0);
      const uniqueTickers = new Set(dayTrades.map(t => t.ticker)).size;
      const avgDu = dayTrades.length 
        ? dayTrades.reduce((acc, t) => acc + (Number(t.prazo_medio_liquidacao_du) || 0), 0) / dayTrades.length 
        : 0.3;

      const topVol = [...dayTrades].sort((a, b) => (Number(b.volume_financeiro) || 0) - (Number(a.volume_financeiro) || 0)).slice(0, 10).map(t => ({
        ticker: t.ticker,
        tipo: t.tipo,
        devedor: t.devedor,
        volume_financeiro: Number(t.volume_financeiro) || 0,
        qtd_negocios: Number(t.qtd_negocios) || 0,
        preco_medio_ponderado: Number(t.preco_medio_ponderado) || 0,
        taxa_media_ponderada: Number(t.taxa_media_ponderada) || 0,
        indexador: t.indexador
      }));

      const topTrd = [...dayTrades].sort((a, b) => (Number(b.qtd_negocios) || 0) - (Number(a.qtd_negocios) || 0)).slice(0, 10).map(t => ({
        ticker: t.ticker,
        tipo: t.tipo,
        devedor: t.devedor,
        volume_financeiro: Number(t.volume_financeiro) || 0,
        qtd_negocios: Number(t.qtd_negocios) || 0,
        preco_medio_ponderado: Number(t.preco_medio_ponderado) || 0,
        taxa_media_ponderada: Number(t.taxa_media_ponderada) || 0,
        indexador: t.indexador
      }));

      return {
        titulo: `Último Pregão (${formatDateBR(latestDate)})`,
        volume: vol,
        trades: nTrades,
        ativos: uniqueTickers,
        prazo_du: avgDu,
        top_volume: topVol,
        top_trades: topTrd
      };
    }

    // Período 30d ou YTD no fallback
    const volTotal = trades.reduce((acc, t) => acc + (Number(t.volume_financeiro) || 0), 0);
    const nTradesTotal = trades.reduce((acc, t) => acc + (Number(t.qtd_negocios) || 0), 0);
    const uniqueTickers = new Set(trades.map(t => t.ticker)).size;

    const mapTicker = new Map<string, { ticker: string; tipo: string; devedor: string; vol: number; trd: number; indexador?: string; vwap: number; taxa: number }>();
    trades.forEach(t => {
      const existing = mapTicker.get(t.ticker) || { 
        ticker: t.ticker, 
        tipo: t.tipo, 
        devedor: t.devedor, 
        vol: 0, 
        trd: 0, 
        indexador: t.indexador,
        vwap: Number(t.preco_medio_ponderado) || 0,
        taxa: Number(t.taxa_media_ponderada) || 0
      };
      existing.vol += (Number(t.volume_financeiro) || 0);
      existing.trd += (Number(t.qtd_negocios) || 0);
      mapTicker.set(t.ticker, existing);
    });

    const sortedByVol = Array.from(mapTicker.values()).sort((a, b) => b.vol - a.vol);
    const sortedByTrd = [...sortedByVol].sort((a, b) => b.trd - a.trd);

    const topVol = sortedByVol.slice(0, 10).map(i => ({
      ticker: i.ticker,
      tipo: i.tipo,
      devedor: i.devedor,
      volume_total: i.vol,
      trades_total: i.trd,
      vwap: i.vwap,
      taxa_media: i.taxa,
      indexador: i.indexador
    }));

    const topTrd = sortedByTrd.slice(0, 10).map(i => ({
      ticker: i.ticker,
      tipo: i.tipo,
      devedor: i.devedor,
      volume_total: i.vol,
      trades_total: i.trd,
      vwap: i.vwap,
      taxa_media: i.taxa,
      indexador: i.indexador
    }));

    return {
      titulo: kpiPeriod === 'ytd' ? 'Acumulado do Ano (YTD 2026)' : 'Últimos 30 Dias Úteis',
      volume: volTotal,
      trades: nTradesTotal,
      ativos: uniqueTickers,
      prazo_du: 0.4,
      top_volume: topVol,
      top_trades: topTrd
    };
  }, [kpis, kpiPeriod, trades, latestDate]);

  /* ================= DADOS DO GRÁFICO DE PREÇOS NOS N DIAS ================= */

  const chartData = useMemo(() => {
    // Verificamos se há filtros granulares ativos (setor, devedor, rating, incentivada, tipo de instrumento, busca)
    const hasGranularFilters = sectorFilter !== 'TODOS' || 
                               debtorFilter !== 'TODOS' || 
                               ratingFilter !== 'TODOS' || 
                               taxFreeFilter !== 'TODOS' || 
                               instrumentFilter !== 'TODOS' || 
                               Boolean(search.trim());

    // Modo 1: Média Geral do Mercado ou Segmento Filtrado (Setor / Devedor / etc.)
    if (chartTarget === 'market') {
      const activeIndexer = (chartMetric === 'spread' && chartIndexer === 'TODOS') ? 'IPCA' : chartIndexer;

      // Se NÃO houver filtros granulares e temos as séries pré-calculadas de mercado YTD, usamos direto para performance máxima!
      if (!hasGranularFilters && marketSeries?.series?.[activeIndexer]?.length) {
        const seriesList = marketSeries.series[activeIndexer];
        let points = seriesList;
        if (chartPeriod === '7d') points = seriesList.slice(-5);
        else if (chartPeriod === '15d') points = seriesList.slice(-11);
        else if (chartPeriod === '30d') points = seriesList.slice(-25);
        // if chartPeriod === 'ytd': usa todos os pregões do ano

        return points.map(p => ({
          date: p.date,
          datePretty: p.datePretty,
          price: p.price,
          yield: p.yield,
          spread: p.spread_bps,
          volume: p.volume,
          volumeRaw: p.volumeRaw,
          trades: p.trades,
          indexador: activeIndexer
        }));
      }

      // Se HÁ filtros granulares ativos OU marketSeries ainda não carregou:
      // Agregamos dinamicamente os trades que atendem a todos os filtros!
      if (!trades.length) return [];
      const numDays = chartPeriod === '7d' ? 5 : chartPeriod === '15d' ? 11 : chartPeriod === '30d' ? 25 : 999;
      const targetDates = chartPeriod === 'ytd' ? availableDates : availableDates.slice(0, numDays);
      const minDate = targetDates[targetDates.length - 1] || targetDates[0] || '2026-01-01';

      const cleanSearch = search.trim().toLowerCase();
      const matchingTradesForChart = trades.filter(t => {
        if (chartPeriod !== 'ytd' && t.data_negocio < minDate) return false;

        // Instrumento
        if (instrumentFilter !== 'TODOS') {
          const tipoUpper = (t.tipo || '').toUpperCase();
          if (instrumentFilter === 'DEB' && !tipoUpper.includes('DEB')) return false;
          if (instrumentFilter === 'CRI' && !tipoUpper.includes('CRI')) return false;
          if (instrumentFilter === 'CRA' && !tipoUpper.includes('CRA')) return false;
        }

        // Indexador selecionado no gráfico ou filtro
        const targetIdx = activeIndexer !== 'TODOS' ? activeIndexer : (indexerFilter !== 'TODOS' ? indexerFilter : 'TODOS');
        if (targetIdx !== 'TODOS') {
          const idx = (t.indexador || '').toUpperCase();
          if ((targetIdx === 'DI+' || targetIdx === 'CDI+') && !idx.includes('DI+') && !idx.includes('CDI+')) return false;
          if (targetIdx === 'IPCA' && !idx.includes('IPCA') && !idx.includes('IGP')) return false;
          if (targetIdx === 'PRE' && !idx.includes('PRÉ') && !idx.includes('PRE')) return false;
          if ((targetIdx === 'DI%' || targetIdx === 'CDI%') && !idx.includes('DI%') && !idx.includes('%CDI')) return false;
        }

        // Setor
        if (sectorFilter !== 'TODOS') {
          if ((t.setor || '').trim().toUpperCase() !== sectorFilter.toUpperCase()) return false;
        }

        // Devedor
        if (debtorFilter !== 'TODOS') {
          if ((t.devedor || '').trim().toUpperCase() !== debtorFilter.toUpperCase()) return false;
        }

        // Rating
        if (ratingFilter !== 'TODOS') {
          const r = (t.rating || '').toUpperCase();
          if (ratingFilter === 'AAA' && !r.includes('AAA')) return false;
          if (ratingFilter === 'AA' && !r.includes('AA') && !r.includes('AAA')) return false;
          if (ratingFilter === 'OUTROS' && (r.includes('AAA') || r.includes('AA'))) return false;
        }

        // Incentivada
        if (taxFreeFilter === 'SIM' && t.incentivada !== 'Sim') return false;
        if (taxFreeFilter === 'NAO' && t.incentivada === 'Sim') return false;

        // Busca
        if (cleanSearch) {
          const tk = (t.ticker || '').toLowerCase();
          const dev = (t.devedor || '').toLowerCase();
          const isin = (t.isin || '').toLowerCase();
          const st = (t.setor || '').toLowerCase();
          if (!tk.includes(cleanSearch) && !dev.includes(cleanSearch) && !isin.includes(cleanSearch) && !st.includes(cleanSearch)) {
            return false;
          }
        }

        return true;
      });

      const dayMap = new Map<string, { 
        date: string; 
        volume: number; 
        trades: number; 
        sumWeightedPrice: number; 
        sumQty: number; 
        sumWeightedYield: number; 
        sumYieldQty: number;
        sumWeightedSpread: number;
        sumSpreadVol: number;
      }>();
      
      matchingTradesForChart.forEach(t => {
        const d = t.data_negocio;
        const entry = dayMap.get(d) || { 
          date: d, 
          volume: 0, 
          trades: 0, 
          sumWeightedPrice: 0, 
          sumQty: 0, 
          sumWeightedYield: 0, 
          sumYieldQty: 0,
          sumWeightedSpread: 0,
          sumSpreadVol: 0
        };

        const vol = Number(t.volume_financeiro) || 0;
        const trd = Number(t.qtd_negocios) || 0;
        const qty = Number(t.quantidade_negociada) || 0;
        const pu = Number(t.preco_medio_ponderado) || 0;
        const tx = Number(t.taxa_media_ponderada) || 0;

        entry.volume += vol;
        entry.trades += trd;
        if (pu > 0 && qty > 0) {
          entry.sumWeightedPrice += pu * qty;
          entry.sumQty += qty;
        }
        if (tx > 0 && vol > 0) {
          entry.sumWeightedYield += tx * vol;
          entry.sumYieldQty += vol;
        }

        // Spread aproximado por indexador
        const idx = (t.indexador || '').toUpperCase();
        let spBps: number | null = null;
        if (tx > 0) {
          if (idx.includes('DI+') || idx.includes('CDI+')) spBps = tx * 100;
          else if (idx.includes('DI%') || idx.includes('%CDI')) spBps = (tx - 100) * 100;
          else if (idx.includes('IPCA') || idx.includes('IGP')) spBps = (tx - 6.40) * 100;
          else if (idx.includes('PRE') || idx.includes('PRÉ')) spBps = (tx - 13.50) * 100;
        }

        if (spBps !== null && vol > 0) {
          entry.sumWeightedSpread += spBps * vol;
          entry.sumSpreadVol += vol;
        }

        dayMap.set(d, entry);
      });

      return Array.from(dayMap.values())
        .sort((a, b) => a.date.localeCompare(b.date))
        .map(entry => {
          const parts = entry.date.split('-');
          return {
            date: entry.date,
            datePretty: parts.length === 3 ? `${parts[2]}/${parts[1]}` : entry.date,
            price: entry.sumQty > 0 ? Number((entry.sumWeightedPrice / entry.sumQty).toFixed(2)) : 0,
            yield: entry.sumYieldQty > 0 ? Number((entry.sumWeightedYield / entry.sumYieldQty).toFixed(2)) : 0,
            spread: entry.sumSpreadVol > 0 ? Number((entry.sumWeightedSpread / entry.sumSpreadVol).toFixed(1)) : null,
            volume: Number((entry.volume / 1e6).toFixed(2)),
            volumeRaw: entry.volume,
            trades: entry.trades,
            indexador: activeIndexer
          };
        });
    }

    // Modo 2: Ativo Específico Selecionado
    if (!trades.length) return [];
    const tkUpper = selectedTicker.trim().toUpperCase();
    const numDays = chartPeriod === '7d' ? 5 : chartPeriod === '15d' ? 11 : chartPeriod === '30d' ? 25 : 999;
    const targetDates = chartPeriod === 'ytd' ? availableDates : availableDates.slice(0, numDays);
    const minDate = targetDates[targetDates.length - 1] || targetDates[0];

    const assetTrades = trades.filter(t => (t.ticker || '').trim().toUpperCase() === tkUpper && (chartPeriod === 'ytd' || t.data_negocio >= minDate));

    return assetTrades
      .sort((a, b) => a.data_negocio.localeCompare(b.data_negocio))
      .map(t => {
        const parts = t.data_negocio.split('-');
        const pu = Number(t.preco_medio_ponderado) || 0;
        const puMin = Number(t.preco_minimo) || pu;
        const puMax = Number(t.preco_maximo) || pu;
        const tx = Number(t.taxa_media_ponderada) || 0;
        const txMin = Number(t.taxa_minima) || tx;
        const txMax = Number(t.taxa_maxima) || tx;
        const vol = Number(t.volume_financeiro) || 0;
        const trd = Number(t.qtd_negocios) || 0;
        const qty = Number(t.quantidade_negociada) || 0;

        // Cálculo de spread over para o papel selecionado
        let spreadBps: number | null = null;
        const idx = (t.indexador || '').toUpperCase();
        if (tx > 0) {
          if (idx.includes('DI+') || idx.includes('CDI+')) {
            spreadBps = Number((tx * 100).toFixed(1));
          } else if (idx.includes('DI%') || idx.includes('%CDI')) {
            spreadBps = Number(((tx - 100) * 100).toFixed(1));
          } else if (idx.includes('IPCA') || idx.includes('IGP')) {
            spreadBps = Number(((tx - 6.40) * 100).toFixed(1));
          } else if (idx.includes('PRE') || idx.includes('PRÉ')) {
            spreadBps = Number(((tx - 13.50) * 100).toFixed(1));
          }
        }

        return {
          date: t.data_negocio,
          datePretty: parts.length === 3 ? `${parts[2]}/${parts[1]}` : t.data_negocio,
          price: pu,
          priceMin: puMin,
          priceMax: puMax,
          yield: tx,
          yieldMin: txMin,
          yieldMax: txMax,
          spread: spreadBps,
          volume: Number((vol / 1e6).toFixed(2)),
          volumeRaw: vol,
          trades: trd,
          quantity: qty,
          tipo: t.tipo,
          devedor: t.devedor,
          indexador: t.indexador,
          rating: t.rating
        };
      });
  }, [trades, selectedTicker, chartPeriod, chartTarget, chartMetric, chartIndexer, marketSeries, availableDates, sectorFilter, debtorFilter, ratingFilter, taxFreeFilter, instrumentFilter, indexerFilter, search]);

  // Resumo estatístico do período para o cabeçalho do gráfico
  const chartSummary = useMemo(() => {
    if (!chartData.length) return null;

    const firstPoint = chartData[0];
    const lastPoint = chartData[chartData.length - 1];

    const currentPrice = lastPoint.price;
    const firstPrice = firstPoint.price;
    const priceChangePct = firstPrice > 0 ? ((currentPrice - firstPrice) / firstPrice) * 100 : 0;
    const priceChangeNom = currentPrice - firstPrice;

    const currentYield = lastPoint.yield;
    const firstYield = firstPoint.yield;

    const currentSpread = (lastPoint.spread !== undefined && lastPoint.spread !== null) ? Number(lastPoint.spread) : null;

    const totalVol = chartData.reduce((acc, d) => acc + (d.volumeRaw || (d.volume ? d.volume * 1e6 : 0)), 0);
    const totalTrd = chartData.reduce((acc, d) => acc + (d.trades || 0), 0);

    const validPrices = chartData.map(d => d.price).filter(p => p > 0);
    const minPrice = validPrices.length ? Math.min(...validPrices) : 0;
    const maxPrice = validPrices.length ? Math.max(...validPrices) : 0;

    const validSpreads = chartData.map(d => d.spread).filter(s => s !== null && s !== undefined) as number[];
    const minSpread = validSpreads.length ? Math.min(...validSpreads) : null;
    const maxSpread = validSpreads.length ? Math.max(...validSpreads) : null;

    const assetMeta = trades.find(t => (t.ticker || '').trim().toUpperCase() === selectedTicker.trim().toUpperCase());

    return {
      currentPrice,
      firstPrice,
      priceChangePct,
      priceChangeNom,
      currentYield,
      currentSpread,
      totalVol,
      totalTrd,
      minPrice,
      maxPrice,
      minSpread,
      maxSpread,
      daysCount: chartData.length,
      assetMeta
    };
  }, [chartData, trades, selectedTicker]);

  // Handler de mudança de métrica (ajusta indexador se spread for selecionado)
  const handleMetricChange = (metric: 'price' | 'yield' | 'spread' | 'volume') => {
    setChartMetric(metric);
    if (metric === 'spread' && chartIndexer === 'TODOS') {
      setChartIndexer('IPCA');
    }
  };

  // Handler para focar gráfico a partir do clique em uma linha da tabela
  const handleFocusTickerChart = (ticker: string) => {
    setSelectedTicker(ticker);
    setChartTarget('ticker');
    const el = document.getElementById('grafico-precos-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  /* ================= EXPORTAÇÃO CSV ================= */

  const exportFilteredCSV = () => {
    if (!sortedTrades.length) return;

    const headers = [
      'Data Negócio', 'Ticker', 'ISIN', 'Tipo', 'Emissor/Devedor', 'Setor', 'Indexador', 
      'Taxa Emissão', 'Rating', 'Vencimento', 'Preço Médio (VWAP)', 'Preço Mínimo', 
      'Preço Máximo', 'Taxa Média', 'Taxa Mínima', 'Taxa Máxima', 'Volume Financeiro R$', 
      'Trades', 'Quantidade Títulos', 'Prazo Médio DU'
    ];

    const rows = sortedTrades.map(t => [
      t.data_negocio,
      t.ticker,
      t.isin,
      t.tipo,
      `"${(t.devedor || '').replace(/"/g, '""')}"`,
      `"${(t.setor || '').replace(/"/g, '""')}"`,
      t.indexador,
      t.taxa_emissao || '',
      t.rating || '',
      t.vencimento || '',
      t.preco_medio_ponderado,
      t.preco_minimo,
      t.preco_maximo,
      t.taxa_media_ponderada,
      t.taxa_minima || '',
      t.taxa_maxima || '',
      t.volume_financeiro,
      t.qtd_negocios,
      t.quantidade_negociada,
      t.prazo_medio_liquidacao_du || ''
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `fixdata_negocios_b3_${latestDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  /* ================= FILTRAGEM & ORDENAÇÃO DE PAPÉIS SEM TAXA (A PU) ================= */

  const filteredNoRateAssets = useMemo(() => {
    if (!noRatePayload?.items) return [];

    const cleanSearch = noRateSearch.trim().toLowerCase();

    return noRatePayload.items.filter(item => {
      // 1. Tipo
      if (noRateTipoFilter !== 'TODOS') {
        const tp = (item.tipo || '').toUpperCase();
        if (noRateTipoFilter === 'DEB' && !tp.includes('DEB')) return false;
        if (noRateTipoFilter === 'CRI' && !tp.includes('CRI')) return false;
        if (noRateTipoFilter === 'CRA' && !tp.includes('CRA')) return false;
      }

      // 2. Indexador
      if (noRateIndexerFilter !== 'TODOS') {
        const idx = (item.indexador || '').toUpperCase();
        if (noRateIndexerFilter === 'DI+' && !idx.includes('DI+') && !idx.includes('CDI+')) return false;
        if (noRateIndexerFilter === 'IPCA' && !idx.includes('IPCA') && !idx.includes('IGP')) return false;
        if (noRateIndexerFilter === 'DI%' && !idx.includes('DI%') && !idx.includes('%CDI')) return false;
        if (noRateIndexerFilter === 'PRE' && !idx.includes('PRÉ') && !idx.includes('PRE')) return false;
      }

      // 3. Rating
      if (noRateRatingFilter !== 'TODOS') {
        const r = (item.rating || '').toUpperCase();
        if (noRateRatingFilter === 'AAA' && !r.includes('AAA')) return false;
        if (noRateRatingFilter === 'AA' && !r.includes('AA') && !r.includes('AAA')) return false;
        if (noRateRatingFilter === 'SEM_RATING' && (r !== '-' && r !== 'NAN' && r !== 'N/D' && r !== '')) return false;
      }

      // 4. Busca
      if (cleanSearch) {
        const tk = (item.ticker || '').toLowerCase();
        const dev = (item.devedor || '').toLowerCase();
        const st = (item.setor || '').toLowerCase();
        if (!tk.includes(cleanSearch) && !dev.includes(cleanSearch) && !st.includes(cleanSearch)) {
          return false;
        }
      }

      return true;
    });
  }, [noRatePayload, noRateTipoFilter, noRateIndexerFilter, noRateRatingFilter, noRateSearch]);

  const sortedNoRateAssets = useMemo(() => {
    const list = [...filteredNoRateAssets];
    return list.sort((a, b) => {
      let valA: number | string = 0;
      let valB: number | string = 0;

      switch (noRateSortField) {
        case 'volume':
          valA = a.total_volume || 0;
          valB = b.total_volume || 0;
          break;
        case 'trades':
          valA = a.total_trades || 0;
          valB = b.total_trades || 0;
          break;
        case 'pu':
          valA = a.ultimo_pu || a.vwap_medio || 0;
          valB = b.ultimo_pu || a.vwap_medio || 0;
          break;
        case 'pregao':
          valA = a.ultimo_pregao || '';
          valB = b.ultimo_pregao || '';
          return noRateSortDirection === 'asc' 
            ? String(valA).localeCompare(String(valB)) 
            : String(valB).localeCompare(String(valA));
        case 'ticker':
          valA = a.ticker || '';
          valB = b.ticker || '';
          return noRateSortDirection === 'asc' 
            ? String(valA).localeCompare(String(valB)) 
            : String(valB).localeCompare(String(valA));
        default:
          valA = a.total_volume || 0;
          valB = b.total_volume || 0;
      }

      return noRateSortDirection === 'asc' ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
    });
  }, [filteredNoRateAssets, noRateSortField, noRateSortDirection]);

  const noRateTotalPages = Math.ceil(sortedNoRateAssets.length / noRatePageSize) || 1;
  const paginatedNoRateAssets = useMemo(() => {
    const start = (noRatePage - 1) * noRatePageSize;
    return sortedNoRateAssets.slice(start, start + noRatePageSize);
  }, [sortedNoRateAssets, noRatePage, noRatePageSize]);

  // Exportação CSV de papéis a PU
  const exportNoRateCSV = () => {
    if (!sortedNoRateAssets.length) return;

    const headers = [
      'Ticker', 'Tipo', 'Emissor/Devedor', 'Setor', 'Indexador', 'Taxa Emissão', 
      'Rating', 'Duration', 'Vencimento', 'Incentivada', 'Último PU', 
      'VWAP Médio', 'Volume Total R$', 'Total Trades', 'Último Pregão'
    ];

    const rows = sortedNoRateAssets.map(a => [
      a.ticker,
      a.tipo,
      `"${(a.devedor || '').replace(/"/g, '""')}"`,
      `"${(a.setor || '').replace(/"/g, '""')}"`,
      a.indexador,
      a.taxa_emissao ?? '',
      (a.rating === 'nan' || !a.rating) ? '-' : a.rating,
      a.duration ?? '',
      a.vencimento || '',
      a.incentivada || '',
      a.ultimo_pu,
      a.vwap_medio,
      a.total_volume,
      a.total_trades,
      a.ultimo_pregao
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `fixdata_papeis_sem_taxa_b3_${latestDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  /* ================= BADGE DE INSTRUMENTO ================= */

  const renderTipoBadge = (tipo?: string) => {
    const t = (tipo || '').toUpperCase();
    if (t.includes('CRI')) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
          CRI
        </span>
      );
    }
    if (t.includes('CRA')) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300">
          CRA
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-extrabold bg-blue-100 text-blue-800 border border-blue-300">
        DEB
      </span>
    );
  };

  /* ================= RENDER ================= */

  return (
    <div className="container mx-auto px-4 py-8 space-y-8 max-w-7xl">
      
      {/* HEADER PRINCIPAL */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <span className="p-2 bg-blue-600 text-white rounded-xl shadow-sm">
              <ArrowLeftRight size={22} />
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Negócios B3 — Mercado Secundário
            </h1>
          </div>
          <p className="text-slate-600 text-sm sm:text-base">
            Acompanhamento diário de trades confirmados na B3 com cruzamento cadastral, VWAP e taxas negociadas.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-emerald-50 border border-emerald-200 px-3.5 py-1.5 rounded-xl flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold text-emerald-800">
              Último Pregão: {formatDateBR(latestDate)}
            </span>
          </div>

          <button
            onClick={exportFilteredCSV}
            disabled={!sortedTrades.length}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 rounded-xl font-bold text-xs sm:text-sm shadow-sm transition-all disabled:opacity-50"
            title="Exportar dados da tabela filtrada para CSV"
          >
            <Download size={16} />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* ================= BOX DE PRINCIPAIS DADOS DO MERCADO (HIGHLIGHTS BOX) ================= */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-6 sm:p-8 rounded-3xl shadow-xl space-y-6 border border-slate-700">
        
        {/* Cabeçalho do Box & Seletor de Período */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-700/80 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-amber-400" />
              <h2 className="text-lg sm:text-xl font-black tracking-tight text-white">
                Destaques & Principais Indicadores do Mercado
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-400">
              Métricas mais monitoradas por gestoras, mesas de operações e investidores institucionais
            </p>
          </div>

          {/* Toggle de Período */}
          <div className="inline-flex p-1 bg-slate-800 rounded-xl border border-slate-700 self-start sm:self-auto">
            <button
              onClick={() => setKpiPeriod('pregao')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                kpiPeriod === 'pregao'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Último Pregão
            </button>
            <button
              onClick={() => setKpiPeriod('30d')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                kpiPeriod === '30d'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Últimos 30 Dias
            </button>
            <button
              onClick={() => setKpiPeriod('ytd')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                kpiPeriod === 'ytd'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Acumulado 2026 (YTD)
            </button>
          </div>
        </div>

        {/* 3 Cards de Métricas Principais */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700/60">
            <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider block mb-1">
              Volume Total Negociado
            </span>
            <p className="text-xl sm:text-2xl font-black text-blue-400 font-mono">
              {formatMoney(activeKpiData?.volume)}
            </p>
            <span className="text-[11px] text-slate-400 mt-0.5 block">
              {activeKpiData?.titulo}
            </span>
          </div>

          <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700/60">
            <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider block mb-1">
              Trades Confirmados
            </span>
            <p className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">
              {activeKpiData?.trades ? Number(activeKpiData.trades).toLocaleString('pt-BR') : '-'}
            </p>
            <span className="text-[11px] text-slate-400 mt-0.5 block">
              Giro de Balcão & B3
            </span>
          </div>

          <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700/60">
            <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider block mb-1">
              Papéis com Liquidez
            </span>
            <p className="text-xl sm:text-2xl font-black text-amber-400 font-mono">
              {activeKpiData?.ativos ? Number(activeKpiData.ativos).toLocaleString('pt-BR') : '-'}
            </p>
            <span className="text-[11px] text-slate-400 mt-0.5 block">
              Ativos únicos negociados
            </span>
          </div>
        </div>

        {/* ================= TOP 10 RANKINGS: VOLUME VS GIRO ================= */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
          
          {/* Coluna 1: Top 10 em Volume Financeiro */}
          <div className="bg-slate-800/90 rounded-2xl border border-blue-800/40 p-5 shadow-lg flex flex-col justify-between">
            <div className="flex items-center justify-between pb-3 border-b border-slate-700/60 mb-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-blue-500/20 text-blue-400 rounded-lg border border-blue-500/30">
                  <Award size={16} />
                </span>
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">
                    Top 10 em Volume Financeiro
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    Maior volume financeiro acumulado no período
                  </span>
                </div>
              </div>
              <span className="text-[11px] font-mono text-blue-400 font-bold bg-blue-950/60 px-2 py-0.5 rounded border border-blue-800/50">
                Ranking R$
              </span>
            </div>

            {/* Lista dos 10 Ativos em Volume */}
            <div className="divide-y divide-slate-700/40 space-y-1">
              {(activeKpiData?.top_volume || []).map((item, idx) => {
                const vol = item.volume_financeiro || item.volume_total || 0;
                const trd = item.qtd_negocios || item.trades_total || 0;
                const pu = item.preco_medio_ponderado || item.vwap || 0;
                const tx = item.taxa_media_ponderada || item.taxa_media || 0;

                const rankBadgeClass = 
                  idx === 0 ? 'bg-amber-400 text-slate-950 font-black ring-2 ring-amber-400/30' :
                  idx === 1 ? 'bg-slate-300 text-slate-950 font-black ring-2 ring-slate-300/30' :
                  idx === 2 ? 'bg-amber-700 text-amber-100 font-black ring-2 ring-amber-700/30' :
                  'bg-slate-800 text-slate-400 font-bold border border-slate-700';

                return (
                  <div key={`vol-${item.ticker}-${idx}`} className="py-2 flex items-center justify-between gap-3 group hover:bg-slate-750/50 rounded-xl px-2 transition-colors">
                    {/* Rank + Ticker + Devedor */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] flex-shrink-0 ${rankBadgeClass}`}>
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <Link
                            to={`/asset/${item.ticker}`}
                            className="font-black text-white hover:text-blue-300 text-xs sm:text-sm transition-colors"
                          >
                            {item.ticker}
                          </Link>
                          <span className="text-[10px] text-slate-400 font-medium">
                            {item.tipo?.replace('Debênture', 'DEB')}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 truncate max-w-[150px] sm:max-w-[220px]" title={item.devedor}>
                          {item.devedor || 'Emissor Privado'}
                        </p>
                      </div>
                    </div>

                    {/* Métricas: VWAP, Taxa, Volume e Ação */}
                    <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0 text-right">
                      <div className="hidden sm:block text-[11px] font-mono text-slate-400">
                        <div>PU: <span className="text-white font-semibold">{formatPU(pu)}</span></div>
                        <div>Taxa: <span className="text-emerald-400 font-semibold">{formatTaxa(tx, item.indexador)}</span></div>
                      </div>

                      <div className="text-right">
                        <div className="text-xs sm:text-sm font-black text-blue-400 font-mono">
                          {formatMoney(vol)}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {trd.toLocaleString('pt-BR')} trades
                        </div>
                      </div>

                      <button
                        onClick={() => handleFocusTickerChart(item.ticker)}
                        className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-900/40 rounded-lg transition-colors"
                        title={`Visualizar evolução de ${item.ticker} no gráfico`}
                      >
                        <LineChart size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Coluna 2: Top 10 em Giro (Mais Negociados) */}
          <div className="bg-slate-800/90 rounded-2xl border border-emerald-800/40 p-5 shadow-lg flex flex-col justify-between">
            <div className="flex items-center justify-between pb-3 border-b border-slate-700/60 mb-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg border border-emerald-500/30">
                  <TrendingUp size={16} />
                </span>
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">
                    Top 10 em Giro (Mais Negociados)
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    Maior quantidade de trades confirmados no período
                  </span>
                </div>
              </div>
              <span className="text-[11px] font-mono text-emerald-400 font-bold bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/50">
                Ranking Trades
              </span>
            </div>

            {/* Lista dos 10 Ativos em Giro */}
            <div className="divide-y divide-slate-700/40 space-y-1">
              {(activeKpiData?.top_trades || []).map((item, idx) => {
                const vol = item.volume_financeiro || item.volume_total || 0;
                const trd = item.qtd_negocios || item.trades_total || 0;
                const pu = item.preco_medio_ponderado || item.vwap || 0;
                const tx = item.taxa_media_ponderada || item.taxa_media || 0;

                const rankBadgeClass = 
                  idx === 0 ? 'bg-amber-400 text-slate-950 font-black ring-2 ring-amber-400/30' :
                  idx === 1 ? 'bg-slate-300 text-slate-950 font-black ring-2 ring-slate-300/30' :
                  idx === 2 ? 'bg-amber-700 text-amber-100 font-black ring-2 ring-amber-700/30' :
                  'bg-slate-800 text-slate-400 font-bold border border-slate-700';

                return (
                  <div key={`trd-${item.ticker}-${idx}`} className="py-2 flex items-center justify-between gap-3 group hover:bg-slate-750/50 rounded-xl px-2 transition-colors">
                    {/* Rank + Ticker + Devedor */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] flex-shrink-0 ${rankBadgeClass}`}>
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <Link
                            to={`/asset/${item.ticker}`}
                            className="font-black text-white hover:text-emerald-300 text-xs sm:text-sm transition-colors"
                          >
                            {item.ticker}
                          </Link>
                          <span className="text-[10px] text-slate-400 font-medium">
                            {item.tipo?.replace('Debênture', 'DEB')}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 truncate max-w-[150px] sm:max-w-[220px]" title={item.devedor}>
                          {item.devedor || 'Emissor Privado'}
                        </p>
                      </div>
                    </div>

                    {/* Métricas: VWAP, Taxa, Trades e Ação */}
                    <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0 text-right">
                      <div className="hidden sm:block text-[11px] font-mono text-slate-400">
                        <div>PU: <span className="text-white font-semibold">{formatPU(pu)}</span></div>
                        <div>Taxa: <span className="text-emerald-400 font-semibold">{formatTaxa(tx, item.indexador)}</span></div>
                      </div>

                      <div className="text-right">
                        <div className="text-xs sm:text-sm font-black text-emerald-400 font-mono">
                          {trd.toLocaleString('pt-BR')} <span className="text-[10px] font-normal text-slate-400">trades</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {formatMoney(vol)}
                        </div>
                      </div>

                      <button
                        onClick={() => handleFocusTickerChart(item.ticker)}
                        className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-emerald-900/40 rounded-lg transition-colors"
                        title={`Visualizar evolução de ${item.ticker} no gráfico`}
                      >
                        <LineChart size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ================= BARRA DE FILTROS REATIVOS (APLICADOS AO GRÁFICO, TABELA E DOWNLOAD) ================= */}
      <div id="filtros-mercado-section" className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Busca textual */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-3 text-slate-400" size={18} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por Ticker (ex: RENTQ8), Emissor, Setor ou ISIN..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-3 text-xs font-bold text-slate-400 hover:text-slate-600"
              >
                Limpar
              </button>
            )}
          </div>

          {/* Filtro de Período da Base e Download */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">
              Período:
            </span>
            <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200">
              <button
                onClick={() => setPeriodFilter('ultimo')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  periodFilter === 'ultimo'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Último Pregão ({formatDateBR(latestDate)})
              </button>
              <button
                onClick={() => setPeriodFilter('7d')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  periodFilter === '7d'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Últimos 7 Dias
              </button>
              <button
                onClick={() => setPeriodFilter('30d')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  periodFilter === '30d'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Últimos 30 Dias
              </button>
              <button
                onClick={() => setPeriodFilter('ytd')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  periodFilter === 'ytd'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Ano 2026 (YTD)
              </button>
            </div>

            {/* Botão de Download CSV em destaque nos filtros */}
            <button
              onClick={exportFilteredCSV}
              disabled={!sortedTrades.length}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-sm transition-all disabled:opacity-50"
              title="Exportar dados de cada trade filtrado para CSV"
            >
              <Download size={14} />
              Exportar CSV ({sortedTrades.length.toLocaleString('pt-BR')})
            </button>
          </div>
        </div>

        {/* Linha de Sub-Filtros: Instrumento, Indexador, Setor, Devedor, Rating, Incentivada */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-3 border-t border-slate-100 text-xs">
          
          {/* Instrumento */}
          <div>
            <label className="block font-bold text-slate-500 uppercase tracking-wider mb-1">
              Instrumento
            </label>
            <select
              value={instrumentFilter}
              onChange={e => setInstrumentFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="TODOS">Todos (DEB/CRI/CRA)</option>
              <option value="DEB">Apenas Debêntures</option>
              <option value="CRI">Apenas CRIs</option>
              <option value="CRA">Apenas CRAs</option>
            </select>
          </div>

          {/* Indexador */}
          <div>
            <label className="block font-bold text-slate-500 uppercase tracking-wider mb-1">
              Indexador
            </label>
            <select
              value={indexerFilter}
              onChange={e => setIndexerFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="TODOS">Todos Indexadores</option>
              <option value="DI+">CDI+ (Spread)</option>
              <option value="IPCA">IPCA+ (Inflação)</option>
              <option value="PRE">Pré-Fixado</option>
              <option value="DI%">% do CDI</option>
            </select>
          </div>

          {/* Setor */}
          <div>
            <label className="block font-bold text-slate-500 uppercase tracking-wider mb-1">
              Setor
            </label>
            <select
              value={sectorFilter}
              onChange={e => setSectorFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="TODOS">Todos os Setores ({availableSectors.length})</option>
              {availableSectors.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Devedor / Emissor */}
          <div>
            <label className="block font-bold text-slate-500 uppercase tracking-wider mb-1">
              Devedor / Emissor
            </label>
            <select
              value={debtorFilter}
              onChange={e => setDebtorFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="TODOS">Todos os Devedores</option>
              {availableDebtors.slice(0, 100).map(d => (
                <option key={d} value={d}>{d.length > 25 ? `${d.slice(0, 25)}...` : d}</option>
              ))}
            </select>
          </div>

          {/* Rating */}
          <div>
            <label className="block font-bold text-slate-500 uppercase tracking-wider mb-1">
              Rating Cadastral
            </label>
            <select
              value={ratingFilter}
              onChange={e => setRatingFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="TODOS">Todos os Ratings</option>
              <option value="AAA">Apenas AAA (Top Tier)</option>
              <option value="AA">Grau Alto (AAA e AA)</option>
              <option value="OUTROS">Outros / Sem Rating</option>
            </select>
          </div>

          {/* Incentivada */}
          <div>
            <label className="block font-bold text-slate-500 uppercase tracking-wider mb-1">
              Isenção de IR (12.431)
            </label>
            <select
              value={taxFreeFilter}
              onChange={e => setTaxFreeFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="TODOS">Todas as Emissões</option>
              <option value="SIM">Apenas Incentivadas</option>
              <option value="NAO">Não Incentivadas</option>
            </select>
          </div>
        </div>

        {/* Resumo de Registros Filtrados e Limpar Filtros */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <Filter size={13} className="text-blue-600" />
            <span>
              Filtros ativos: <strong>{sortedTrades.length.toLocaleString('pt-BR')}</strong> negócios aplicados ao <strong>Gráfico</strong>, à <strong>Tabela</strong> e ao <strong>Download CSV</strong>
            </span>
          </div>

          {(instrumentFilter !== 'TODOS' || indexerFilter !== 'TODOS' || sectorFilter !== 'TODOS' || debtorFilter !== 'TODOS' || ratingFilter !== 'TODOS' || taxFreeFilter !== 'TODOS' || search || periodFilter !== 'ultimo') && (
            <button
              onClick={() => {
                setPeriodFilter('ultimo');
                setInstrumentFilter('TODOS');
                setIndexerFilter('TODOS');
                setSectorFilter('TODOS');
                setDebtorFilter('TODOS');
                setRatingFilter('TODOS');
                setTaxFreeFilter('TODOS');
                setSearch('');
              }}
              className="text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 self-start sm:self-auto"
            >
              <RefreshCw size={12} /> Limpar Todos os Filtros
            </button>
          )}
        </div>
      </div>

      {/* ================= GRÁFICO INTERATIVO DE PREÇOS E NEGÓCIOS NOS N DIAS ================= */}
      <div id="grafico-precos-section" className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
        
        {/* Cabeçalho do Gráfico */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className="p-2 bg-blue-100 text-blue-700 rounded-xl">
                <LineChart size={20} />
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Evolução de Preços, Taxas & Spread {chartPeriod === 'ytd' ? 'em 2026 (YTD)' : chartPeriod === '7d' ? 'nos 7 Dias' : chartPeriod === '15d' ? 'nos 15 Dias' : 'nos 30 Dias'}
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-500">
              {chartTarget === 'ticker' 
                ? `Curva diária de VWAP, taxa negociada, spread over e volume do ativo ${selectedTicker}` 
                : 'Média ponderada do mercado secundário por indexador homogêneo e liquidez consolidada'}
            </p>
          </div>

          {/* Controles do Gráfico: Modo Ativo vs Mercado, Período & Métrica */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Toggle Ativo vs Mercado */}
            <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200">
              <button
                onClick={() => setChartTarget('ticker')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  chartTarget === 'ticker'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Tag size={13} /> Por Ativo
              </button>
              <button
                onClick={() => setChartTarget('market')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  chartTarget === 'market'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers size={13} /> Mercado Geral
              </button>
            </div>

            {/* Toggle de Período: 7d, 15d, 30d, YTD */}
            <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200">
              <button
                onClick={() => setChartPeriod('7d')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  chartPeriod === '7d' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                7 Dias
              </button>
              <button
                onClick={() => setChartPeriod('15d')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  chartPeriod === '15d' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                15 Dias
              </button>
              <button
                onClick={() => setChartPeriod('30d')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  chartPeriod === '30d' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                30 Dias
              </button>
              <button
                onClick={() => setChartPeriod('ytd')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                  chartPeriod === 'ytd' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sparkles size={11} className={chartPeriod === 'ytd' ? 'text-amber-300' : 'text-slate-400'} />
                YTD (2026)
              </button>
            </div>

            {/* Toggle de Métrica */}
            <div className="inline-flex p-1 bg-blue-50 border border-blue-200 rounded-xl">
              <button
                onClick={() => handleMetricChange('price')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  chartMetric === 'price' ? 'bg-blue-600 text-white shadow-sm' : 'text-blue-800 hover:text-blue-950'
                }`}
              >
                Preço (VWAP)
              </button>
              <button
                onClick={() => handleMetricChange('yield')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  chartMetric === 'yield' ? 'bg-blue-600 text-white shadow-sm' : 'text-blue-800 hover:text-blue-950'
                }`}
              >
                Taxa (%)
              </button>
              <button
                onClick={() => handleMetricChange('spread')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  chartMetric === 'spread' ? 'bg-amber-600 text-white shadow-sm' : 'text-blue-800 hover:text-blue-950'
                }`}
              >
                Spread Over (bps)
              </button>
              <button
                onClick={() => handleMetricChange('volume')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  chartMetric === 'volume' ? 'bg-blue-600 text-white shadow-sm' : 'text-blue-800 hover:text-blue-950'
                }`}
              >
                Volume (R$)
              </button>
            </div>
          </div>
        </div>

        {/* Seletor de Indexador para Mercado Geral */}
        {chartTarget === 'market' && (
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-bold text-slate-500 mr-1 flex items-center gap-1">
                <Filter size={13} /> Filtrar por Indexador:
              </span>

              <button
                onClick={() => setChartIndexer('TODOS')}
                disabled={chartMetric === 'spread'}
                title={chartMetric === 'spread' ? 'Spread over requer um indexador homogêneo específico' : 'Consolidado de todo o mercado'}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  chartIndexer === 'TODOS' && chartMetric !== 'spread'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : chartMetric === 'spread'
                    ? 'bg-slate-100 text-slate-300 cursor-not-allowed border border-slate-200'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                TODOS (Consolidado)
              </button>

              {(['IPCA', 'CDI+', 'CDI%', 'PRE'] as const).map(idx => (
                <button
                  key={idx}
                  onClick={() => setChartIndexer(idx)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    chartIndexer === idx
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-white border border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-blue-50'
                  }`}
                >
                  {idx === 'IPCA' ? 'IPCA (vs NTN-B)' : idx === 'CDI+' ? 'CDI+ (bps)' : idx === 'CDI%' ? 'CDI% (vs 100%)' : 'PRÉ (vs DI)'}
                </button>
              ))}
            </div>

            <div className="text-[11px] text-slate-500 font-medium">
              {chartMetric === 'spread' ? (
                <span className="text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                  Separado por indexador para apuração correta do Spread Over
                </span>
              ) : chartMetric === 'volume' && chartIndexer === 'TODOS' ? (
                <span className="text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                  Exibindo volume total consolidado do mercado B3
                </span>
              ) : (
                <span>Visualização ajustada por indexador</span>
              )}
            </div>
          </div>
        )}

        {/* Seletor de Ativo e Pílulas Rápidas */}
        {chartTarget === 'ticker' && (
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <span className="text-xs font-bold text-slate-500 whitespace-nowrap">Selecionar Ativo:</span>
              <select
                value={selectedTicker}
                onChange={e => setSelectedTicker(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-black text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono shadow-sm"
              >
                {availableTickers.slice(0, 200).map(t => (
                  <option key={t.ticker} value={t.ticker}>
                    {t.ticker} ({t.tipo}) — {t.devedor ? t.devedor.slice(0, 30) : 'Emissor'}
                  </option>
                ))}
              </select>
            </div>

            {/* Pílulas rápidas com top ativos */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold uppercase text-slate-400 mr-1">Mais negociados:</span>
              {availableTickers.slice(0, 6).map(t => (
                <button
                  key={t.ticker}
                  onClick={() => setSelectedTicker(t.ticker)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold font-mono transition-all ${
                    selectedTicker === t.ticker
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-white border border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-blue-50'
                  }`}
                >
                  {t.ticker}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Cards de Resumo da Série Selecionada */}
        {chartSummary && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
              <span className="text-[11px] font-bold uppercase text-slate-400 block mb-0.5">
                {chartMetric === 'spread' ? 'Último Spread Over' : 'Último Preço (VWAP)'}
              </span>
              <p className={`text-lg font-black font-mono ${chartMetric === 'spread' ? 'text-amber-600' : 'text-slate-900'}`}>
                {chartMetric === 'spread' 
                  ? (chartSummary.currentSpread !== null ? `${chartSummary.currentSpread > 0 ? `+${chartSummary.currentSpread.toFixed(1)}` : chartSummary.currentSpread.toFixed(1)} bps` : '-')
                  : formatPU(chartSummary.currentPrice)}
              </p>
              <div className="flex items-center gap-1 mt-0.5">
                {chartSummary.priceChangePct >= 0 ? (
                  <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-0.5">
                    <TrendingUp size={12} /> +{chartSummary.priceChangePct.toFixed(2)}%
                  </span>
                ) : (
                  <span className="text-[11px] font-bold text-rose-600 flex items-center gap-0.5">
                    <TrendingDown size={12} /> {chartSummary.priceChangePct.toFixed(2)}%
                  </span>
                )}
                <span className="text-[10px] text-slate-400">no período</span>
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
              <span className="text-[11px] font-bold uppercase text-slate-400 block mb-0.5">
                Taxa Média
              </span>
              <p className="text-lg font-black text-emerald-600 font-mono">
                {formatTaxa(chartSummary.currentYield, chartSummary.assetMeta?.indexador || chartIndexer)}
              </p>
              <span className="text-[11px] text-slate-400 block mt-0.5 font-medium">
                {chartTarget === 'market' ? (chartIndexer === 'TODOS' ? 'Mercado Consolidado' : `Indexador: ${chartIndexer}`) : (chartSummary.assetMeta?.indexador || 'Mercado Secundário')}
              </span>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
              <span className="text-[11px] font-bold uppercase text-slate-400 block mb-0.5">
                {chartMetric === 'spread' ? 'Faixa Spread no Período' : 'Faixa PU no Período'}
              </span>
              {chartMetric === 'spread' && chartSummary.minSpread !== null ? (
                <>
                  <p className="text-xs font-black text-slate-800 font-mono mt-0.5">
                    Mín: <strong className="text-amber-700">{chartSummary.minSpread > 0 ? `+${chartSummary.minSpread.toFixed(1)}` : chartSummary.minSpread.toFixed(1)} bps</strong>
                  </p>
                  <p className="text-xs font-black text-slate-800 font-mono mt-0.5">
                    Máx: <strong className="text-amber-700">{chartSummary.maxSpread && chartSummary.maxSpread > 0 ? `+${chartSummary.maxSpread.toFixed(1)}` : chartSummary.maxSpread?.toFixed(1)} bps</strong>
                  </p>
                </>
              ) : (
                <>
                  <p className="text-xs font-black text-slate-800 font-mono mt-0.5">
                    Mín: <strong className="text-slate-900">{formatPU(chartSummary.minPrice)}</strong>
                  </p>
                  <p className="text-xs font-black text-slate-800 font-mono mt-0.5">
                    Máx: <strong className="text-slate-900">{formatPU(chartSummary.maxPrice)}</strong>
                  </p>
                </>
              )}
            </div>

            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
              <span className="text-[11px] font-bold uppercase text-slate-400 block mb-0.5">
                Volume no Período
              </span>
              <p className="text-lg font-black text-blue-600 font-mono">
                {formatMoney(chartSummary.totalVol)}
              </p>
              <span className="text-[11px] text-slate-400 block mt-0.5 font-medium">
                Em {chartSummary.daysCount} pregões
              </span>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 col-span-2 md:col-span-1">
              <span className="text-[11px] font-bold uppercase text-slate-400 block mb-0.5">
                Trades Confirmados
              </span>
              <p className="text-lg font-black text-violet-600 font-mono">
                {chartSummary.totalTrd.toLocaleString('pt-BR')}
              </p>
              {chartSummary.assetMeta ? (
                <Link
                  to={`/asset/${chartSummary.assetMeta.ticker}`}
                  className="text-[11px] font-bold text-blue-600 hover:underline flex items-center gap-1 mt-0.5"
                >
                  <Eye size={12} /> Abrir página do ativo
                </Link>
              ) : (
                <span className="text-[10px] text-slate-400 mt-0.5 block">Negócios no período</span>
              )}
            </div>
          </div>
        )}

        {/* Gráfico Recharts */}
        {chartData.length > 0 ? (
          <div className="h-80 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorYield" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#059669" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#059669" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorSpread" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#d97706" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#d97706" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#7c3aed" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis 
                  dataKey="datePretty" 
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={{ stroke: '#cbd5e1' }}
                />
                <YAxis 
                  domain={['auto', 'auto']}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={val => {
                    if (chartMetric === 'price') return `R$ ${val >= 1000 ? Math.round(val) : val}`;
                    if (chartMetric === 'yield') return `${val}%`;
                    if (chartMetric === 'spread') return `${val > 0 ? `+${val}` : val} bps`;
                    return `${val}M`;
                  }}
                />
                <RechartsTooltip content={<CustomChartTooltip metric={chartMetric} indexador={chartSummary?.assetMeta?.indexador || chartIndexer} />} />
                <Area
                  type="monotone"
                  dataKey={
                    chartMetric === 'price' ? 'price' :
                    chartMetric === 'yield' ? 'yield' :
                    chartMetric === 'spread' ? 'spread' : 'volume'
                  }
                  stroke={
                    chartMetric === 'price' ? '#2563eb' :
                    chartMetric === 'yield' ? '#059669' :
                    chartMetric === 'spread' ? '#d97706' : '#7c3aed'
                  }
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill={`url(#${
                    chartMetric === 'price' ? 'colorPrice' :
                    chartMetric === 'yield' ? 'colorYield' :
                    chartMetric === 'spread' ? 'colorSpread' : 'colorVolume'
                  })`}
                  dot={{
                    r: chartPeriod === 'ytd' ? 1.5 : 3,
                    fill: chartMetric === 'price' ? '#2563eb' : chartMetric === 'yield' ? '#059669' : chartMetric === 'spread' ? '#d97706' : '#7c3aed'
                  }}
                  activeDot={{ r: 6 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300">
            <p className="text-sm font-semibold text-slate-500">
              Nenhum negócio registrado para {selectedTicker} no período selecionado.
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Experimente alterar o período ou selecionar outro ativo acima.
            </p>
          </div>
        )}
      </div>

      {/* ================= TABELA DE NEGÓCIOS CRUZADA COM CADASTRO ================= */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        
        {/* Cabeçalho Superior da Tabela */}
        <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-2 bg-blue-50 text-blue-700 rounded-xl">
                <Briefcase size={18} />
              </span>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                Negócios Confirmados na B3
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-500">
              Registros detalhados com cruzamento cadastral, VWAP e taxas do mercado secundário
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 font-medium">
              Mostrando <strong className="text-slate-800">{paginatedTrades.length}</strong> de <strong className="text-slate-800">{sortedTrades.length.toLocaleString('pt-BR')}</strong> negócios filtrados
            </span>
            <button
              onClick={exportFilteredCSV}
              disabled={!sortedTrades.length}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
              title="Exportar dados filtrados da tabela para CSV"
            >
              <Download size={14} /> CSV
            </button>
          </div>
        </div>
        
        {loading ? (
          <div className="p-16 text-center space-y-3">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm font-bold text-slate-700">Carregando negócios e base cadastral...</p>
            <p className="text-xs text-slate-400">Cruzando com preços e taxas da B3</p>
          </div>
        ) : sortedTrades.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <p className="text-base font-bold text-slate-800">Nenhum negócio encontrado para estes filtros.</p>
            <p className="text-sm text-slate-500">Tente ajustar o período ou limpar a busca de texto.</p>
            <button
              onClick={() => {
                setPeriodFilter('30d');
                setInstrumentFilter('TODOS');
                setIndexerFilter('TODOS');
                setSectorFilter('TODOS');
                setDebtorFilter('TODOS');
                setRatingFilter('TODOS');
                setTaxFreeFilter('TODOS');
                setSearch('');
              }}
              className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow hover:bg-blue-700"
            >
              Ver todos os negócios dos últimos 30 dias
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[11px] font-black tracking-wider">
                  
                  <th 
                    onClick={() => {
                      if (sortField === 'ticker') setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
                      else { setSortField('ticker'); setSortDirection('asc'); }
                    }}
                    className="p-4 cursor-pointer hover:text-slate-900 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      Ativo / Ticker
                      <ArrowUpDown size={12} className={sortField === 'ticker' ? 'text-blue-600' : 'text-slate-300'} />
                    </div>
                  </th>

                  <th className="p-4">Emissor / Devedor</th>
                  <th className="p-4">Indexador</th>
                  <th className="p-4">Rating</th>

                  <th 
                    onClick={() => {
                      if (sortField === 'pu') setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
                      else { setSortField('pu'); setSortDirection('desc'); }
                    }}
                    className="p-4 text-right cursor-pointer hover:text-slate-900 transition-colors"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      Preço Médio (VWAP)
                      <ArrowUpDown size={12} className={sortField === 'pu' ? 'text-blue-600' : 'text-slate-300'} />
                    </div>
                  </th>

                  <th 
                    onClick={() => {
                      if (sortField === 'taxa') setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
                      else { setSortField('taxa'); setSortDirection('desc'); }
                    }}
                    className="p-4 text-right cursor-pointer hover:text-slate-900 transition-colors"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      Taxa Média B3
                      <ArrowUpDown size={12} className={sortField === 'taxa' ? 'text-blue-600' : 'text-slate-300'} />
                    </div>
                  </th>

                  <th 
                    onClick={() => {
                      if (sortField === 'volume') setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
                      else { setSortField('volume'); setSortDirection('desc'); }
                    }}
                    className="p-4 text-right cursor-pointer hover:text-slate-900 transition-colors"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      Volume Financeiro
                      <ArrowUpDown size={12} className={sortField === 'volume' ? 'text-blue-600' : 'text-slate-300'} />
                    </div>
                  </th>

                  <th 
                    onClick={() => {
                      if (sortField === 'trades') setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
                      else { setSortField('trades'); setSortDirection('desc'); }
                    }}
                    className="p-4 text-center cursor-pointer hover:text-slate-900 transition-colors"
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      Trades
                      <ArrowUpDown size={12} className={sortField === 'trades' ? 'text-blue-600' : 'text-slate-300'} />
                    </div>
                  </th>

                  <th className="p-4 text-center">Liq. (DU)</th>
                  <th className="p-4 text-right">Data</th>
                  <th className="p-4 text-center">Ações</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 font-medium">
                {paginatedTrades.map((t, idx) => (
                  <tr 
                    key={`${t.ticker}-${t.data_negocio}-${idx}`}
                    className="hover:bg-blue-50/40 transition-colors group"
                  >
                    {/* Ticker & Tipo */}
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        {renderTipoBadge(t.tipo)}
                        <Link 
                          to={`/asset/${t.ticker}`}
                          className="font-extrabold text-blue-600 hover:text-blue-800 hover:underline font-mono"
                        >
                          {t.ticker}
                        </Link>
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono block mt-0.5">
                        {t.isin}
                      </span>
                    </td>

                    {/* Emissor / Devedor */}
                    <td className="p-4 max-w-xs">
                      <p className="font-bold text-slate-900 line-clamp-1 group-hover:text-blue-950">
                        {t.devedor || 'Emissor Privado'}
                      </p>
                      {t.setor && (
                        <span className="text-[11px] text-slate-400 block line-clamp-1">
                          {t.setor}
                        </span>
                      )}
                    </td>

                    {/* Indexador */}
                    <td className="p-4">
                      <span className="font-extrabold text-slate-800 block">
                        {t.indexador || '-'}
                      </span>
                      {t.taxa_emissao && (
                        <span className="text-[11px] text-slate-400">
                          Emissão: {Number(t.taxa_emissao) > 0 ? `+${Number(t.taxa_emissao).toFixed(2)}%` : `${t.taxa_emissao}%`}
                        </span>
                      )}
                    </td>

                    {/* Rating */}
                    <td className="p-4">
                      {t.rating && t.rating !== '-' ? (
                        <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-extrabold ${
                          t.rating.includes('AAA') 
                            ? 'bg-purple-100 text-purple-800 border border-purple-200' 
                            : t.rating.includes('AA')
                            ? 'bg-blue-100 text-blue-800 border border-blue-200'
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {t.rating}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">-</span>
                      )}
                    </td>

                    {/* Preço Médio (VWAP) */}
                    <td className="p-4 text-right">
                      <p className="font-black text-slate-900 font-mono">
                        {formatPU(t.preco_medio_ponderado)}
                      </p>
                      {t.preco_minimo && t.preco_maximo && t.preco_minimo !== t.preco_maximo && (
                        <span className="text-[11px] text-slate-400 font-mono block">
                          [{Number(t.preco_minimo).toFixed(0)} - {Number(t.preco_maximo).toFixed(0)}]
                        </span>
                      )}
                    </td>

                    {/* Taxa Média Ponderada */}
                    <td className="p-4 text-right">
                      <p className="font-black text-blue-700 font-mono">
                        {formatTaxa(t.taxa_media_ponderada, t.indexador)}
                      </p>
                      {t.taxa_minima && t.taxa_maxima && t.taxa_minima !== t.taxa_maxima && (
                        <span className="text-[11px] text-slate-400 font-mono block">
                          [{Number(t.taxa_minima).toFixed(2)}% a {Number(t.taxa_maxima).toFixed(2)}%]
                        </span>
                      )}
                    </td>

                    {/* Volume Financeiro */}
                    <td className="p-4 text-right">
                      <p className="font-black text-slate-900 font-mono">
                        {formatMoney(t.volume_financeiro)}
                      </p>
                      <span className="text-[11px] text-slate-400 font-mono block">
                        {Number(t.quantidade_negociada).toLocaleString('pt-BR')} títulos
                      </span>
                    </td>

                    {/* Quantidade de Trades */}
                    <td className="p-4 text-center">
                      <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-lg text-xs font-black bg-slate-100 text-slate-800 font-mono">
                        {t.qtd_negocios}
                      </span>
                    </td>

                    {/* Prazo de Liquidação (DU) */}
                    <td className="p-4 text-center">
                      <span className="text-xs font-mono font-bold text-slate-600">
                        {t.prazo_medio_liquidacao_du !== undefined && t.prazo_medio_liquidacao_du !== '' 
                          ? `D+${Number(t.prazo_medio_liquidacao_du).toFixed(0)}` 
                          : 'D+0'}
                      </span>
                    </td>

                    {/* Data */}
                    <td className="p-4 text-right text-xs text-slate-600 font-mono">
                      {formatDateBR(t.data_negocio)}
                    </td>

                    {/* Ação: Ver Gráfico */}
                    <td className="p-4 text-center">
                      <button
                        onClick={() => handleFocusTickerChart(t.ticker)}
                        title={`Visualizar gráfico histórico de ${t.ticker}`}
                        className="p-1.5 bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-700 rounded-lg transition-all inline-flex items-center justify-center"
                      >
                        <LineChart size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* PAGINAÇÃO */}
        {!loading && sortedTrades.length > 0 && (
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-medium">Itens por página:</span>
              <select
                value={pageSize}
                onChange={e => setPageSize(Number(e.target.value))}
                className="bg-white border border-slate-200 rounded-lg px-2 py-1 font-bold text-slate-700"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-medium">
                Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong>
              </span>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ================= SEÇÃO DE PAPÉIS NEGOCIADOS A PU (SEM TAXA B3) ================= */}
      <div id="papeis-sem-taxa-section" className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
        
        {/* Cabeçalho da Seção */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className="p-2 bg-amber-100 text-amber-800 rounded-xl">
                <AlertCircle size={20} />
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Papéis Negociados a PU (Sem Taxa Declarada na B3)
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 max-w-3xl">
              Ativos de crédito privado negociados no mercado secundário por preço unitário (PU), sem taxa indicativa registrada nos boletins de negociação da B3. Cruzamento cadastral completo com ratings, duration e indicadores de liquidez acumulada em 2026.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={exportNoRateCSV}
              disabled={!sortedNoRateAssets.length}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 rounded-xl font-bold text-xs sm:text-sm shadow-sm transition-all disabled:opacity-50"
              title="Exportar tabela de papéis a PU para CSV"
            >
              <Download size={16} />
              Exportar CSV ({sortedNoRateAssets.length})
            </button>
          </div>
        </div>

        {/* 4 Cards de Resumo dessa categoria */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-amber-50/60 p-4 rounded-2xl border border-amber-200/60">
            <span className="text-[11px] font-bold uppercase text-amber-800 tracking-wider block mb-1">
              Ativos Negociados a PU
            </span>
            <p className="text-xl sm:text-2xl font-black text-amber-900 font-mono">
              {noRatePayload?.total_ativos ? noRatePayload.total_ativos.toLocaleString('pt-BR') : '3.279'}
            </p>
            <span className="text-[11px] text-amber-700 mt-0.5 block font-medium">
              Sem taxa indicativa B3
            </span>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <span className="text-[11px] font-bold uppercase text-slate-500 tracking-wider block mb-1">
              Volume Total Acumulado
            </span>
            <p className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
              {formatMoney(noRatePayload?.total_volume || 229410000000)}
            </p>
            <span className="text-[11px] text-slate-400 mt-0.5 block font-medium">
              Negociado em 2026
            </span>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <span className="text-[11px] font-bold uppercase text-slate-500 tracking-wider block mb-1">
              Trades Confirmados
            </span>
            <p className="text-xl sm:text-2xl font-black text-blue-600 font-mono">
              {noRatePayload?.total_trades ? noRatePayload.total_trades.toLocaleString('pt-BR') : '1.309.288'}
            </p>
            <span className="text-[11px] text-slate-400 mt-0.5 block font-medium">
              Operações a PU
            </span>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <span className="text-[11px] font-bold uppercase text-slate-500 tracking-wider block mb-1">
              Regime de Negociação
            </span>
            <p className="text-sm sm:text-base font-black text-emerald-700 font-sans mt-1">
              PU de Curva / Marcação
            </p>
            <span className="text-[11px] text-slate-400 mt-0.5 block font-medium">
              Comum em CRIs e Debêntures
            </span>
          </div>
        </div>

        {/* Barra de Filtros e Busca de Papéis sem Taxa */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
          {/* Busca textual */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <input
              type="text"
              value={noRateSearch}
              onChange={e => {
                setNoRateSearch(e.target.value);
                setNoRatePage(1);
              }}
              placeholder="Buscar por Ticker, Emissor ou Setor..."
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all"
            />
            {noRateSearch && (
              <button
                onClick={() => {
                  setNoRateSearch('');
                  setNoRatePage(1);
                }}
                className="absolute right-3 top-2.5 text-xs font-bold text-slate-400 hover:text-slate-600"
              >
                Limpar
              </button>
            )}
          </div>

          {/* Filtros em Pílulas */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Filtro de Tipo */}
            <div className="inline-flex p-1 bg-white border border-slate-200 rounded-xl">
              {(['TODOS', 'DEB', 'CRI', 'CRA'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => {
                    setNoRateTipoFilter(t);
                    setNoRatePage(1);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    noRateTipoFilter === t
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Filtro de Indexador */}
            <div className="inline-flex p-1 bg-white border border-slate-200 rounded-xl">
              {(['TODOS', 'DI+', 'IPCA', 'DI%', 'PRE'] as const).map(i => (
                <button
                  key={i}
                  onClick={() => {
                    setNoRateIndexerFilter(i);
                    setNoRatePage(1);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    noRateIndexerFilter === i
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {i}
                </button>
              ))}
            </div>

            {/* Filtro de Rating */}
            <div className="inline-flex p-1 bg-white border border-slate-200 rounded-xl">
              {(['TODOS', 'AAA', 'AA', 'SEM_RATING'] as const).map(r => (
                <button
                  key={r}
                  onClick={() => {
                    setNoRateRatingFilter(r);
                    setNoRatePage(1);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    noRateRatingFilter === r
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {r === 'SEM_RATING' ? 'Sem Rating' : r}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tabela de Papéis a PU */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-600 uppercase text-[11px] font-black border-b border-slate-200">
                <th 
                  className="p-3.5 cursor-pointer hover:bg-slate-200/70 transition-colors"
                  onClick={() => {
                    setNoRateSortField('ticker');
                    setNoRateSortDirection(d => d === 'asc' ? 'desc' : 'asc');
                  }}
                >
                  <div className="flex items-center gap-1.5">
                    Ticker / Tipo
                    <ArrowUpDown size={12} className={noRateSortField === 'ticker' ? 'text-blue-600' : 'text-slate-400'} />
                  </div>
                </th>

                <th className="p-3.5">Emissor / Devedor & Setor</th>
                <th className="p-3.5">Indexador & Emissão</th>
                <th className="p-3.5">Rating</th>
                <th className="p-3.5">Duration / Venc.</th>

                <th 
                  className="p-3.5 text-right cursor-pointer hover:bg-slate-200/70 transition-colors"
                  onClick={() => {
                    setNoRateSortField('pu');
                    setNoRateSortDirection(d => d === 'asc' ? 'desc' : 'asc');
                  }}
                >
                  <div className="flex items-center justify-end gap-1.5">
                    Último PU (VWAP)
                    <ArrowUpDown size={12} className={noRateSortField === 'pu' ? 'text-blue-600' : 'text-slate-400'} />
                  </div>
                </th>

                <th 
                  className="p-3.5 text-right cursor-pointer hover:bg-slate-200/70 transition-colors"
                  onClick={() => {
                    setNoRateSortField('volume');
                    setNoRateSortDirection(d => d === 'asc' ? 'desc' : 'asc');
                  }}
                >
                  <div className="flex items-center justify-end gap-1.5">
                    Volume Total (R$)
                    <ArrowUpDown size={12} className={noRateSortField === 'volume' ? 'text-blue-600' : 'text-slate-400'} />
                  </div>
                </th>

                <th 
                  className="p-3.5 text-center cursor-pointer hover:bg-slate-200/70 transition-colors"
                  onClick={() => {
                    setNoRateSortField('trades');
                    setNoRateSortDirection(d => d === 'asc' ? 'desc' : 'asc');
                  }}
                >
                  <div className="flex items-center justify-center gap-1.5">
                    Trades
                    <ArrowUpDown size={12} className={noRateSortField === 'trades' ? 'text-blue-600' : 'text-slate-400'} />
                  </div>
                </th>

                <th 
                  className="p-3.5 text-right cursor-pointer hover:bg-slate-200/70 transition-colors"
                  onClick={() => {
                    setNoRateSortField('pregao');
                    setNoRateSortDirection(d => d === 'asc' ? 'desc' : 'asc');
                  }}
                >
                  <div className="flex items-center justify-end gap-1.5">
                    Último Pregão
                    <ArrowUpDown size={12} className={noRateSortField === 'pregao' ? 'text-blue-600' : 'text-slate-400'} />
                  </div>
                </th>

                <th className="p-3.5 text-center">Ver</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 bg-white font-medium">
              {paginatedNoRateAssets.map((item, idx) => (
                <tr key={`${item.ticker}-${idx}`} className="hover:bg-amber-50/30 transition-colors group">
                  {/* Ticker & Tipo */}
                  <td className="p-3.5">
                    <div className="flex items-center gap-2">
                      {renderTipoBadge(item.tipo)}
                      <Link 
                        to={`/asset/${item.ticker}`}
                        className="font-extrabold text-blue-600 hover:text-blue-800 hover:underline font-mono"
                      >
                        {item.ticker}
                      </Link>
                    </div>
                    {item.incentivada === 'Sim' && (
                      <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded mt-0.5 inline-block">
                        Incentivada 12.431
                      </span>
                    )}
                  </td>

                  {/* Devedor & Setor */}
                  <td className="p-3.5 max-w-xs">
                    <p className="font-bold text-slate-900 line-clamp-1 group-hover:text-blue-950">
                      {item.devedor || 'Emissor Privado'}
                    </p>
                    {item.setor && (
                      <span className="text-[11px] text-slate-400 block line-clamp-1">
                        {item.setor}
                      </span>
                    )}
                  </td>

                  {/* Indexador & Emissão */}
                  <td className="p-3.5">
                    <span className="font-extrabold text-slate-800 block">
                      {item.indexador || '-'}
                    </span>
                    {item.taxa_emissao !== undefined && item.taxa_emissao !== null && item.taxa_emissao !== '' && (
                      <span className="text-[11px] text-slate-400">
                        Emissão: {Number(item.taxa_emissao) > 0 ? `+${Number(item.taxa_emissao).toFixed(2)}%` : `${item.taxa_emissao}%`}
                      </span>
                    )}
                  </td>

                  {/* Rating */}
                  <td className="p-3.5">
                    {item.rating && item.rating !== '-' && item.rating !== 'nan' ? (
                      <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-extrabold ${
                        item.rating.includes('AAA') 
                          ? 'bg-purple-100 text-purple-800 border border-purple-200' 
                          : item.rating.includes('AA')
                          ? 'bg-blue-100 text-blue-800 border border-blue-200'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {item.rating}
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs">-</span>
                    )}
                  </td>

                  {/* Duration / Vencimento */}
                  <td className="p-3.5">
                    <span className="font-mono text-slate-800 font-bold block">
                      {item.duration ? `${Number(item.duration).toFixed(1)}a` : '-'}
                    </span>
                    {item.vencimento && (
                      <span className="text-[11px] text-slate-400 font-mono">
                        {formatDateBR(item.vencimento)}
                      </span>
                    )}
                  </td>

                  {/* Preço Médio (VWAP) */}
                  <td className="p-3.5 text-right">
                    <p className="font-black text-slate-900 font-mono">
                      {formatPU(item.ultimo_pu || item.vwap_medio)}
                    </p>
                    <span className="text-[10px] text-slate-400 block font-mono">
                      (Negociado a PU)
                    </span>
                  </td>

                  {/* Volume Total */}
                  <td className="p-3.5 text-right">
                    <p className="font-black text-slate-900 font-mono">
                      {formatMoney(item.total_volume)}
                    </p>
                    {item.total_qtd && (
                      <span className="text-[10px] text-slate-400 font-mono block">
                        {Number(item.total_qtd).toLocaleString('pt-BR')} títulos
                      </span>
                    )}
                  </td>

                  {/* Trades & Pregões */}
                  <td className="p-3.5 text-center">
                    <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-lg text-xs font-black bg-amber-50 text-amber-900 font-mono border border-amber-200">
                      {item.total_trades}
                    </span>
                    {item.pregoes_ativos && (
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        {item.pregoes_ativos} pregões
                      </span>
                    )}
                  </td>

                  {/* Último Pregão */}
                  <td className="p-3.5 text-right text-xs text-slate-600 font-mono">
                    {formatDateBR(item.ultimo_pregao)}
                  </td>

                  {/* Link do Ativo */}
                  <td className="p-3.5 text-center">
                    <Link
                      to={`/asset/${item.ticker}`}
                      title={`Ver cadastro e detalhes de ${item.ticker}`}
                      className="p-1.5 bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-700 rounded-lg transition-all inline-flex items-center justify-center"
                    >
                      <Eye size={14} />
                    </Link>
                  </td>
                </tr>
              ))}

              {paginatedNoRateAssets.length === 0 && (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-500 font-medium">
                    Nenhum papel sem taxa encontrado com os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Paginação da Seção de Papéis a PU */}
        {sortedNoRateAssets.length > 0 && (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-medium">Itens por página:</span>
              <select
                value={noRatePageSize}
                onChange={e => {
                  setNoRatePageSize(Number(e.target.value));
                  setNoRatePage(1);
                }}
                className="bg-white border border-slate-200 rounded-lg px-2 py-1 font-bold text-slate-700"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span className="text-slate-400 ml-2">
                Total de {sortedNoRateAssets.length.toLocaleString('pt-BR')} ativos filtrados
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-medium">
                Página <strong>{noRatePage}</strong> de <strong>{noRateTotalPages}</strong>
              </span>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setNoRatePage(p => Math.max(p - 1, 1))}
                  disabled={noRatePage === 1}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => setNoRatePage(p => Math.min(p + 1, noRateTotalPages))}
                  disabled={noRatePage === noRateTotalPages}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};

export default Trades;
