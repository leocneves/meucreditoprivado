import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowLeftRight, 
  Search, 
  TrendingUp, 
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
  HelpCircle
} from 'lucide-react';
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

/* ================= COMPONENTE PRINCIPAL ================= */

const Trades: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<B3MarketKpis | null>(null);
  const [trades, setTrades] = useState<B3TradeRow[]>([]);
  
  // Período do Box de Destaques
  const [kpiPeriod, setKpiPeriod] = useState<'pregao' | '30d' | 'ytd'>('pregao');

  // Filtros da Tabela
  const [periodFilter, setPeriodFilter] = useState<'ultimo' | '7d' | '30d'>('ultimo');
  const [instrumentFilter, setInstrumentFilter] = useState<string>('TODOS');
  const [indexerFilter, setIndexerFilter] = useState<string>('TODOS');
  const [ratingFilter, setRatingFilter] = useState<string>('TODOS');
  const [taxFreeFilter, setTaxFreeFilter] = useState<string>('TODOS');
  const [search, setSearch] = useState('');

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

        // Carrega simultaneamente o JSON de KPIs, o CSV de negócios recentes e a base cadastral
        const [kpiRes, rawTrades, assetsMaster] = await Promise.all([
          fetch('/data/b3_market_kpis.json').then(r => r.json()).catch(() => null),
          fetchCSV<B3TradeRow>('/data/b3_trades_recent.csv').catch(() => []),
          fetchCSV<Asset>('/data/assets_master.csv').catch(() => [])
        ]);

        if (kpiRes) setKpis(kpiRes);

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
            setor: cadastral?.setor || undefined,
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

  /* ================= FILTRAGEM REATIVA ================= */

  const filteredTrades = useMemo(() => {
    if (!trades.length) return [];

    // Limites de data para o filtro de período
    const cutoffDate = (() => {
      if (periodFilter === 'ultimo') return latestDate;
      if (periodFilter === '7d') {
        const last7 = availableDates.slice(0, 5); // 5 pregões = ~7 dias corridos
        return last7[last7.length - 1] || latestDate;
      }
      return availableDates[availableDates.length - 1] || latestDate;
    })();

    const cleanSearch = search.trim().toLowerCase();

    return trades.filter(t => {
      // 1. Filtro de Período
      if (periodFilter === 'ultimo') {
        if (t.data_negocio !== latestDate) return false;
      } else {
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

      // 4. Filtro de Rating
      if (ratingFilter !== 'TODOS') {
        const r = (t.rating || '').toUpperCase();
        if (ratingFilter === 'AAA' && !r.includes('AAA')) return false;
        if (ratingFilter === 'AA' && !r.includes('AA') && !r.includes('AAA')) return false;
        if (ratingFilter === 'OUTROS' && (r.includes('AAA') || r.includes('AA'))) return false;
      }

      // 5. Filtro de Incentivada
      if (taxFreeFilter === 'SIM' && t.incentivada !== 'Sim') return false;
      if (taxFreeFilter === 'NAO' && t.incentivada === 'Sim') return false;

      // 6. Busca textual
      if (cleanSearch) {
        const tk = (t.ticker || '').toLowerCase();
        const dev = (t.devedor || '').toLowerCase();
        const isin = (t.isin || '').toLowerCase();
        if (!tk.includes(cleanSearch) && !dev.includes(cleanSearch) && !isin.includes(cleanSearch)) {
          return false;
        }
      }

      return true;
    });
  }, [trades, periodFilter, latestDate, availableDates, instrumentFilter, indexerFilter, ratingFilter, taxFreeFilter, search]);

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
  }, [periodFilter, instrumentFilter, indexerFilter, ratingFilter, taxFreeFilter, search, pageSize]);

  /* ================= DADOS DO BOX DE DESTAQUES (KPIs) ================= */

  const activeKpiData = useMemo(() => {
    if (!kpis) return null;
    if (kpiPeriod === 'pregao') {
      return {
        titulo: `Último Pregão (${formatDateBR(kpis.ultimo_pregao.data)})`,
        volume: kpis.ultimo_pregao.volume_financeiro,
        trades: kpis.ultimo_pregao.total_trades,
        ativos: kpis.ultimo_pregao.ativos_negociados,
        prazo_du: kpis.ultimo_pregao.prazo_medio_du,
        top_volume: kpis.ultimo_pregao.top_ativos.slice(0, 5),
        top_trades: [...kpis.ultimo_pregao.top_ativos].sort((a, b) => (b.qtd_negocios || 0) - (a.qtd_negocios || 0)).slice(0, 5)
      };
    }
    if (kpiPeriod === '30d') {
      return {
        titulo: 'Últimos 30 Dias Úteis',
        volume: kpis.ultimos_30_dias.volume_financeiro,
        trades: kpis.ultimos_30_dias.total_trades,
        ativos: kpis.ultimos_30_dias.ativos_unicos,
        prazo_du: 0.4,
        top_volume: kpis.ultimos_30_dias.top_volume.slice(0, 5),
        top_trades: kpis.ultimos_30_dias.top_trades.slice(0, 5)
      };
    }
    const ytd = kpis.acumulado_ano || kpis.acumulado_ano_ytd;
    return {
      titulo: 'Acumulado do Ano (YTD 2026)',
      volume: ytd?.volume_financeiro || 0,
      trades: ytd?.total_trades || 0,
      ativos: ytd?.ativos_unicos || 0,
      prazo_du: 0.5,
      top_volume: (kpis.ultimos_30_dias?.top_volume || []).slice(0, 5),
      top_trades: (kpis.ultimos_30_dias?.top_trades || []).slice(0, 5)
    };
  }, [kpis, kpiPeriod]);

  // Líder em Volume e Líder em Giro
  const leaderVolume = activeKpiData?.top_volume[0];
  const leaderTrades = activeKpiData?.top_trades[0];

  /* ================= EXPORTAÇÃO CSV ================= */

  const exportFilteredCSV = () => {
    if (!sortedTrades.length) return;

    const headers = [
      'Data Negócio', 'Ticker', 'ISIN', 'Tipo', 'Emissor/Devedor', 'Indexador', 
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

        {/* 4 Cards de Métricas Principais */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
              {activeKpiData?.trades?.toLocaleString('pt-BR') || '-'}
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
              {activeKpiData?.ativos?.toLocaleString('pt-BR') || '-'}
            </p>
            <span className="text-[11px] text-slate-400 mt-0.5 block">
              Ativos únicos negociados
            </span>
          </div>

          <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700/60">
            <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider block mb-1">
              Prazo Médio Liquidação
            </span>
            <p className="text-xl sm:text-2xl font-black text-violet-400 font-mono">
              D+{activeKpiData?.prazo_du !== undefined ? Number(activeKpiData.prazo_du).toFixed(1) : '0'} d.u.
            </p>
            <span className="text-[11px] text-slate-400 mt-0.5 block">
              Predomínio de D+0 (À Vista)
            </span>
          </div>
        </div>

        {/* Líderes de Mercado: Top Volume vs Top Giro */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          
          {/* Card Líder em Volume */}
          <div className="bg-gradient-to-r from-blue-950/70 to-slate-800/90 p-5 rounded-2xl border border-blue-800/50 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <span className="inline-flex items-center gap-1 text-xs font-black uppercase text-blue-400 bg-blue-900/60 px-2.5 py-1 rounded-md border border-blue-700/50">
                <Award size={14} /> Líder em Volume Financeiro
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {leaderVolume ? `${(leaderVolume.qtd_negocios || leaderVolume.trades_total || 0)} trades` : ''}
              </span>
            </div>

            {leaderVolume ? (
              <div className="space-y-2">
                <div className="flex items-baseline justify-between gap-2">
                  <Link 
                    to={`/asset/${leaderVolume.ticker}`} 
                    className="text-lg sm:text-xl font-black text-white hover:text-blue-300 transition-colors flex items-center gap-2"
                  >
                    {leaderVolume.ticker}
                    <span className="text-xs font-normal text-slate-400">({leaderVolume.tipo})</span>
                  </Link>
                  <span className="text-base sm:text-lg font-black text-blue-400 font-mono">
                    {formatMoney(leaderVolume.volume_financeiro || leaderVolume.volume_total)}
                  </span>
                </div>
                <p className="text-xs text-slate-300 line-clamp-1">
                  {leaderVolume.devedor}
                </p>
                <div className="flex items-center gap-4 text-xs font-mono text-slate-300 pt-1 border-t border-slate-700/60">
                  <span>VWAP: <strong className="text-white">{formatPU(leaderVolume.preco_medio_ponderado || leaderVolume.vwap)}</strong></span>
                  <span>Taxa: <strong className="text-emerald-400">{formatTaxa(leaderVolume.taxa_media_ponderada || leaderVolume.taxa_media, leaderVolume.indexador)}</strong></span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400">Nenhum dado disponível para o período.</p>
            )}
          </div>

          {/* Card Líder em Giro / Quantidade de Negócios */}
          <div className="bg-gradient-to-r from-emerald-950/70 to-slate-800/90 p-5 rounded-2xl border border-emerald-800/50 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <span className="inline-flex items-center gap-1 text-xs font-black uppercase text-emerald-400 bg-emerald-900/60 px-2.5 py-1 rounded-md border border-emerald-700/50">
                <TrendingUp size={14} /> Líder em Giro (Mais Negociado)
              </span>
              <span className="text-xs text-emerald-400 font-mono font-bold">
                {leaderTrades ? `${(leaderTrades.qtd_negocios || leaderTrades.trades_total || 0).toLocaleString('pt-BR')} trades` : ''}
              </span>
            </div>

            {leaderTrades ? (
              <div className="space-y-2">
                <div className="flex items-baseline justify-between gap-2">
                  <Link 
                    to={`/asset/${leaderTrades.ticker}`} 
                    className="text-lg sm:text-xl font-black text-white hover:text-emerald-300 transition-colors flex items-center gap-2"
                  >
                    {leaderTrades.ticker}
                    <span className="text-xs font-normal text-slate-400">({leaderTrades.tipo})</span>
                  </Link>
                  <span className="text-base sm:text-lg font-black text-emerald-400 font-mono">
                    {formatMoney(leaderTrades.volume_financeiro || leaderTrades.volume_total)}
                  </span>
                </div>
                <p className="text-xs text-slate-300 line-clamp-1">
                  {leaderTrades.devedor}
                </p>
                <div className="flex items-center gap-4 text-xs font-mono text-slate-300 pt-1 border-t border-slate-700/60">
                  <span>VWAP: <strong className="text-white">{formatPU(leaderTrades.preco_medio_ponderado || leaderTrades.vwap)}</strong></span>
                  <span>Taxa: <strong className="text-emerald-400">{formatTaxa(leaderTrades.taxa_media_ponderada || leaderTrades.taxa_media, leaderTrades.indexador)}</strong></span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400">Nenhum dado disponível para o período.</p>
            )}
          </div>
        </div>
      </div>

      {/* ================= BARRA DE FILTROS REATIVOS ================= */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Busca textual */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-3 text-slate-400" size={18} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por Ticker (ex: RENTQ8), Emissor ou ISIN..."
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

          {/* Filtro de Período dos Dados da Tabela */}
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
            </div>
          </div>
        </div>

        {/* Linha de Sub-Filtros: Instrumento, Indexador, Rating, Incentivada */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100 text-xs">
          
          {/* Instrumento */}
          <div>
            <label className="block font-bold text-slate-500 uppercase tracking-wider mb-1">
              Instrumento
            </label>
            <select
              value={instrumentFilter}
              onChange={e => setInstrumentFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="TODOS">Todos (Debêntures, CRI, CRA)</option>
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
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="TODOS">Todos os Indexadores</option>
              <option value="DI+">CDI+ (Spread)</option>
              <option value="IPCA">IPCA+ (Inflação)</option>
              <option value="PRE">Pré-Fixado</option>
              <option value="DI%">% do CDI</option>
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
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              Isenção de IR (Lei 12.431)
            </label>
            <select
              value={taxFreeFilter}
              onChange={e => setTaxFreeFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="TODOS">Todas as Emissões</option>
              <option value="SIM">Apenas Incentivadas (Isentas)</option>
              <option value="NAO">Não Incentivadas</option>
            </select>
          </div>
        </div>

        {/* Resumo de Registros Filtrados */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
          <span>
            Mostrando <strong>{paginatedTrades.length}</strong> de <strong>{sortedTrades.length}</strong> registros encontrados
          </span>

          {(instrumentFilter !== 'TODOS' || indexerFilter !== 'TODOS' || ratingFilter !== 'TODOS' || taxFreeFilter !== 'TODOS' || search) && (
            <button
              onClick={() => {
                setInstrumentFilter('TODOS');
                setIndexerFilter('TODOS');
                setRatingFilter('TODOS');
                setTaxFreeFilter('TODOS');
                setSearch('');
              }}
              className="text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1"
            >
              <RefreshCw size={12} /> Limpar Todos os Filtros
            </button>
          )}
        </div>
      </div>

      {/* ================= TABELA DE NEGÓCIOS CRUZADA ================= */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        
        {loading ? (
          <div className="p-16 text-center space-y-3">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-slate-600 font-bold">Carregando dados de negócios e cadastro B3...</p>
          </div>
        ) : sortedTrades.length === 0 ? (
          <div className="p-16 text-center space-y-2">
            <p className="text-slate-700 font-extrabold text-base">Nenhum negócio encontrado com os filtros selecionados.</p>
            <p className="text-slate-400 text-sm">Tente ampliar o período ou limpar a busca textual.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-50/80 text-slate-500 border-b border-slate-200 font-extrabold uppercase text-[11px] tracking-wider select-none">
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
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
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
