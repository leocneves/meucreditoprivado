import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
  Legend
} from 'recharts';
import {
  Tag,
  Building2,
  Calendar,
  FileText,
  Download,
  ExternalLink,
  Search,
  Filter,
  ArrowUpRight,
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronRight,
  Layers,
  Users,
  BarChart3,
  Info,
  Sparkles,
  AlertCircle,
  Percent,
  Coins,
  Landmark,
  Globe
} from 'lucide-react';

/* ================= TIPOS DE DADOS CVM SRE ================= */

interface SRESerie {
  id_serie: string;
  id_requerimento: string;
  codigo_cvm?: string;
  descricao_serie: string;
  volume_serie_reais?: number;
  quantidade_ativos?: number;
  pu_nominal?: number;
  book_taxa?: string;
  taxa_remuneracao_maxima?: string;
  taxa_remuneracao_final?: string;
  data_emissao?: string;
  data_vencimento?: string;
  forma_amortizacao?: string;
  subordinacao?: string;
  avaliacao_risco?: string;
  resgate_antecipado?: string;
  isin?: string;
  matched_ticker?: string;
}

interface SREDocumento {
  id_documento?: string;
  nome_documento: string;
  data_publicacao?: string;
  url_download?: string;
}

interface SREParticipante {
  tipo_participante: string;
  razao_social: string;
  cnpj?: string;
}

interface SREOffer {
  id_requerimento: string;
  numero_processo?: string;
  numero_registro?: string;
  tipo_ativo: 'DEB' | 'CRI' | 'CRA';
  nome_valor_mobiliario?: string;
  status_oferta: string;
  nome_emissor: string;
  cnpj_emissor?: string;
  nome_devedor_real?: string;
  cnpj_devedor_real?: string;
  nome_coordenador_lider?: string;
  cnpj_coordenador_lider?: string;
  valor_total_reais?: number;
  data_processo?: string;
  data_liquidacao_doc?: string;
  possui_book?: number;
  resumo_oferta?: string;
  series?: SRESerie[];
  documentos?: SREDocumento[];
  participantes?: SREParticipante[];
  sindicato_distribuicao?: {
    banco_id: string;
    banco_nome: string;
    portal_url: string;
    badge_bg: string;
    dot_color: string;
    papel: string;
    is_lead: boolean;
    razao_social: string;
  }[];
  ativo_secundario?: {
    ticker: string;
    isin: string;
  } | null;
}

interface DistribuicaoItem {
  id_requerimento?: string;
  banco_id: string;
  banco_nome: string;
  papel_banco: string;
  portal_url: string;
  badge_bg: string;
  dot_color: string;
  devedor: string;
  tipo_ativo: string;
  valor_total_reais?: number | null;
  data_vencimento?: string | null;
  data_liquidacao?: string | null;
  taxas_indicativas?: string | null;
  origem: string;
  documentos?: { nome_documento?: string; titulo?: string; url?: string; url_download?: string }[];
}

interface EsteiraRankingItem {
  banco_id: string;
  banco_nome: string;
  volume_bi: number;
  total_ofertas: number;
  share_pct: number;
  cor: string;
  badge_bg: string;
  dot_color: string;
}

interface MarketShareSerieItem {
  periodo: string;
  label: string;
  total_bi: number;
  [key: string]: any;
}

interface BancoMetaItem {
  nome: string;
  cor: string;
  dot: string;
}

interface DistribuicaoAnalytics {
  esteira_ranking: EsteiraRankingItem[];
  volume_total_esteira_bi: number;
  series_anuais: MarketShareSerieItem[];
  series_trimestrais: MarketShareSerieItem[];
  bancos_meta: BancoMetaItem[];
}

interface DistribuicaoBancos {
  bancos_disponiveis: {
    id: string;
    nome: string;
    portal_url: string;
    badge_bg: string;
    dot_color: string;
    total_ofertas: number;
    volume_total_reais: number;
  }[];
  todas_ofertas_distribuicao: DistribuicaoItem[];
  analytics?: DistribuicaoAnalytics;
}

interface LeagueTableItem {
  coordenador: string;
  total_ofertas: number;
  volume_bi: number;
}

interface EvolucaoAnualItem {
  ano: string;
  volume_bi: number;
  total_ofertas: number;
  ticket_medio_mi: number;
  yoy_volume_pct: number | null;
  yoy_qtd_pct: number | null;
  mix_instrumentos: {
    deb_pct: number;
    cri_pct: number;
    cra_pct: number;
  };
}

interface SerieMensalItem {
  mes: string;
  volume_bi: number;
  vol_deb_bi: number;
  vol_cri_bi: number;
  vol_cra_bi: number;
  total_ofertas: number;
}

interface PrimaryData {
  resumo: {
    total_ofertas_ano: number;
    volume_total_ano_bi: number;
    total_em_andamento: number;
    volume_em_andamento_bi: number;
    total_encerradas: number;
    volume_encerradas_bi: number;
    total_historico_base?: number;
    volume_historico_base_bi?: number;
    por_tipo: Record<string, { total: number; volume_bi: number }>;
    por_ano?: Record<string, { total: number; volume_bi: number }>;
    data_atualizacao: string;
  };
  evolucao_anual?: EvolucaoAnualItem[];
  serie_mensal?: SerieMensalItem[];
  league_table?: LeagueTableItem[];
  distribuicao_bancos?: DistribuicaoBancos;
  ofertas_em_andamento: SREOffer[];
  ofertas_recentes: SREOffer[];
}

const Primary: React.FC = () => {
  const [data, setData] = useState<PrimaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ANDAMENTO' | 'DISTRIBUICAO' | 'ENCERRADAS' | 'LEAGUE'>('ANDAMENTO');
  const [selectedBank, setSelectedBank] = useState<string>('TODOS');
  const [bankSearch, setBankSearch] = useState<string>('');
  const [bankFilterTipo, setBankFilterTipo] = useState<string>('TODOS');
  const [filterTipo, setFilterTipo] = useState<string>('TODOS');
  const [filterAno, setFilterAno] = useState<string>('TODOS');
  const [filterIndexador, setFilterIndexador] = useState<string>('TODOS');
  const [chartPeriod, setChartPeriod] = useState<'ALL' | '24M' | '12M'>('24M');
  const [msGranularity, setMsGranularity] = useState<'TRIMESTRAL' | 'ANUAL'>('TRIMESTRAL');
  const [msMetric, setMsMetric] = useState<'SHARE' | 'VOLUME'>('SHARE');
  const [msChartType, setMsChartType] = useState<'BAR' | 'AREA'>('BAR');
  const [msHistoryRange, setMsHistoryRange] = useState<'8T' | 'ALL'>('8T');
  const [search, setSearch] = useState<string>('');
  const [expandedOffer, setExpandedOffer] = useState<string | null>(null);
  const [page, setPage] = useState<number>(1);
  const pageSize = 20;

  /* ================= CARREGAMENTO DOS DADOS ================= */

  useEffect(() => {
    const loadPrimaryData = async () => {
      try {
        const res = await fetch('./data/mercado_primario.json');
        if (!res.ok) throw new Error('Falha ao carregar mercado_primario.json');
        const json: PrimaryData = await res.json();
        setData(json);
      } catch (err) {
        console.error('Erro ao carregar dados do mercado primário:', err);
      } finally {
        setLoading(false);
      }
    };
    loadPrimaryData();
  }, []);

  /* ================= HELPERS DE FORMATAÇÃO E INDEXADOR ================= */

  const formatBRL = (val?: number) => {
    if (!val || isNaN(val)) return '-';
    if (val >= 1e9) {
      return `R$ ${(val / 1e9).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bi`;
    }
    return `R$ ${(val / 1e6).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Mi`;
  };

  const formatDate = (dtStr?: string, dtEmissao?: string) => {
    if (!dtStr) return '-';
    const s = dtStr.trim();
    // Se vencimento for menor ou igual à data de emissão, trata-se de inconsistência cadastral
    if (dtEmissao && s <= dtEmissao.trim()) {
      return 'A definir';
    }
    if (s.includes('-')) {
      const p = s.split('-');
      if (p.length === 3) return `${p[2]}/${p[1]}/${p[0]}`;
    }
    return s;
  };

  const formatMesLabel = (mesStr: string) => {
    if (!mesStr) return '';
    const [ano, m] = mesStr.split('-');
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const idx = parseInt(m, 10) - 1;
    return `${meses[idx] || m}/${ano.slice(2)}`;
  };

  const getTipoBadgeClass = (tipo: string) => {
    switch (tipo) {
      case 'DEB':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'CRI':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'CRA':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const getOfferIndexer = (oferta: SREOffer): string => {
    if (!oferta.series || oferta.series.length === 0) return 'OUTROS';
    const allTexts = oferta.series
      .map(
        s =>
          `${s.taxa_remuneracao_maxima || ''} ${s.taxa_remuneracao_final || ''} ${s.book_taxa || ''} ${s.descricao_serie || ''}`
      )
      .join(' ')
      .toUpperCase();

    if (allTexts.includes('IPCA') || allTexts.includes('NTN-B')) return 'IPCA+';
    if (allTexts.includes('% CDI') || allTexts.includes('% DO CDI') || allTexts.includes('%CDI')) return '% CDI';
    if (allTexts.includes('CDI +') || allTexts.includes('CDI+') || allTexts.includes('DI +')) return 'CDI+';
    if (allTexts.includes('PRÉ') || allTexts.includes('PRE') || allTexts.includes('% A.A.')) return 'PRÉ';
    return 'OUTROS';
  };

  /* ================= FILTRAGEM REATIVA ================= */

  const ofertasFiltradas = useMemo(() => {
    if (!data) return [];
    const sourceList = activeTab === 'ANDAMENTO' ? data.ofertas_em_andamento : data.ofertas_recentes;

    return sourceList.filter(o => {
      const matchesTipo = filterTipo === 'TODOS' || o.tipo_ativo === filterTipo;
      const matchesAno = filterAno === 'TODOS' || (o.data_processo && o.data_processo.startsWith(filterAno));
      const idx = getOfferIndexer(o);
      const matchesIndexador = filterIndexador === 'TODOS' || idx === filterIndexador;

      const q = search.toLowerCase().trim();
      if (!q) return matchesTipo && matchesAno && matchesIndexador;

      const inEmissor = (o.nome_emissor || '').toLowerCase().includes(q);
      const inDevedor = (o.nome_devedor_real || '').toLowerCase().includes(q);
      const inLider = (o.nome_coordenador_lider || '').toLowerCase().includes(q);
      const inProcesso = (o.numero_processo || '').toLowerCase().includes(q);
      const inSeries = (o.series || []).some(
        s =>
          (s.descricao_serie || '').toLowerCase().includes(q) ||
          (s.taxa_remuneracao_maxima || '').toLowerCase().includes(q) ||
          (s.isin || '').toLowerCase().includes(q)
      );
      const inTicker = o.ativo_secundario ? o.ativo_secundario.ticker.toLowerCase().includes(q) : false;

      return (
        matchesTipo &&
        matchesAno &&
        matchesIndexador &&
        (inEmissor || inDevedor || inLider || inProcesso || inSeries || inTicker)
      );
    });
  }, [data, activeTab, filterTipo, filterAno, filterIndexador, search]);

  const totalPages = Math.ceil(ofertasFiltradas.length / pageSize) || 1;
  const paginatedOfertas = useMemo(() => {
    if (activeTab === 'ANDAMENTO') return ofertasFiltradas;
    return ofertasFiltradas.slice((page - 1) * pageSize, page * pageSize);
  }, [ofertasFiltradas, activeTab, page]);

  /* ================= FILTRAGEM DA ESTEIRA DE DISTRIBUIÇÃO BANCÁRIA ================= */

  const ofertasBancoFiltradas = useMemo(() => {
    if (!data?.distribuicao_bancos?.todas_ofertas_distribuicao) return [];
    let list = data.distribuicao_bancos.todas_ofertas_distribuicao;

    if (selectedBank !== 'TODOS') {
      list = list.filter(item => item.banco_id === selectedBank);
    }

    if (bankFilterTipo !== 'TODOS') {
      list = list.filter(item => {
        if (bankFilterTipo === 'DEB') return item.tipo_ativo === 'DEB' || item.tipo_ativo === 'DEBÊNTURE' || item.tipo_ativo === 'DEBENTURE';
        if (bankFilterTipo === 'CRI') return item.tipo_ativo === 'CRI';
        if (bankFilterTipo === 'CRA') return item.tipo_ativo === 'CRA';
        return true;
      });
    }

    const q = bankSearch.toLowerCase().trim();
    if (!q) return list;

    return list.filter(item =>
      (item.devedor || '').toLowerCase().includes(q) ||
      (item.banco_nome || '').toLowerCase().includes(q) ||
      (item.papel_banco || '').toLowerCase().includes(q) ||
      (item.tipo_ativo || '').toLowerCase().includes(q) ||
      (item.taxas_indicativas || '').toLowerCase().includes(q)
    );
  }, [data, selectedBank, bankFilterTipo, bankSearch]);

  /* ================= DADOS DO GRÁFICO MENSAL ================= */

  const dadosGraficoMensal = useMemo(() => {
    if (!data?.serie_mensal) return [];
    let slice = [...data.serie_mensal];
    if (chartPeriod === '12M') {
      slice = slice.slice(-12);
    } else if (chartPeriod === '24M') {
      slice = slice.slice(-24);
    }
    return slice.map(item => ({
      ...item,
      labelMes: formatMesLabel(item.mes)
    }));
  }, [data, chartPeriod]);

  /* ================= DADOS DO GRÁFICO DE MARKET SHARE ================= */

  const dadosGraficoMarketShare = useMemo(() => {
    if (!data?.distribuicao_bancos?.analytics) return [];
    const an = data.distribuicao_bancos.analytics;
    if (msGranularity === 'ANUAL') {
      return an.series_anuais || [];
    }
    const series = an.series_trimestrais || [];
    if (msHistoryRange === '8T') {
      return series.slice(-8);
    }
    return series;
  }, [data, msGranularity, msHistoryRange]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl space-y-8">
      {/* ================= CABEÇALHO INSTITUCIONAL ================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-purple-50 text-purple-700 border border-purple-200">
              <Tag size={24} />
            </span>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
                Mercado Primário
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Monitoramento de ofertas públicas sob a Resolução CVM 160 • Coleta de intenções (Bookbuilding) e emissões
              </p>
            </div>
          </div>
        </div>

        {data?.resumo && (
          <div className="flex items-center gap-3 text-xs text-slate-500 self-start md:self-auto">
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 font-medium">
              <Clock size={13} className="text-slate-500" />
              SRE CVM Atualizado:{' '}
              <strong className="text-slate-800">{formatDate(data.resumo.data_atualizacao.split(' ')[0])}</strong>
            </span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 space-y-4">
          <div className="w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium text-slate-500">Consultando registros do sistema SRE CVM...</p>
        </div>
      ) : (
        <>
          {/* ================= CARDS EXECUTIVOS DE KPI ================= */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Card 1: Pipeline em Bookbuilding */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group hover:border-purple-300 transition">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-1">
                <span className="flex items-center gap-1.5 text-purple-700">
                  <span className="w-2 h-2 rounded-full bg-purple-600 animate-ping" />
                  Em Bookbuilding
                </span>
                <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 text-[11px] font-bold">
                  {data?.resumo?.total_em_andamento || 0} ativas
                </span>
              </div>
              <p className="text-2xl font-black text-slate-900">
                R$ {(data?.resumo?.volume_em_andamento_bi || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} Bi
              </p>
              <p className="text-xs text-slate-400 mt-1">Ofertas em período de reserva e alocação</p>
            </div>

            {/* Card 2: Volume 2026 YTD */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-blue-300 transition">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-1">
                <span>Volume 2026 (YTD)</span>
                <span className="text-blue-600 font-bold">{data?.resumo?.total_ofertas_ano || 0} ofertas</span>
              </div>
              <p className="text-2xl font-black text-slate-900">
                R$ {(data?.resumo?.volume_total_ano_bi || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} Bi
              </p>
              <p className="text-xs text-slate-400 mt-1">Total registrado em 2026 (todos os ritos)</p>
            </div>

            {/* Card 3: Encerradas / Liquidadas */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-emerald-300 transition">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-1">
                <span>Ofertas Concluídas</span>
                <span className="text-emerald-600 font-bold">{data?.resumo?.total_encerradas || 0} emissões</span>
              </div>
              <p className="text-2xl font-black text-slate-900">
                R$ {(data?.resumo?.volume_encerradas_bi || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} Bi
              </p>
              <p className="text-xs text-slate-400 mt-1">Taxas cortadas e distribuição encerrada</p>
            </div>

            {/* Card 4: Base Histórica Monitorada CVM 160 */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-amber-300 transition">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-1">
                <span>Base Histórica CVM 160</span>
                <span className="text-amber-600 font-bold">2023 - 2026</span>
              </div>
              <p className="text-2xl font-black text-slate-900">
                {data?.resumo?.total_historico_base?.toLocaleString('pt-BR') || '4.485'}{' '}
                <span className="text-xs font-normal text-slate-500">ofertas</span>
              </p>
              <p className="text-xs text-slate-400 mt-1">
                R${' '}
                {(data?.resumo?.volume_historico_base_bi || 1750).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}{' '}
                Bi acumulados
              </p>
            </div>
          </div>

          {/* ================= SEÇÃO ANALÍTICA DCM: HISTÓRICO ANUAL & GRÁFICO MENSAL ================= */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            {/* Coluna 1: Tabela Analítica Anual com YoY e Ticket Médio */}
            <div className="lg:col-span-5 space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <TrendingUp size={18} className="text-purple-600" />
                  Evolução Histórica das Emissões (Ano a Ano)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Volume distribuído, variação percentual anual (YoY) e ticket médio por operação.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 uppercase text-[10px] font-semibold border-b border-slate-200">
                      <th className="py-2.5 px-3">Ano</th>
                      <th className="py-2.5 px-3 text-right">Volume</th>
                      <th className="py-2.5 px-3 text-center">Ofertas</th>
                      <th className="py-2.5 px-3 text-right">YoY Vol.</th>
                      <th className="py-2.5 px-3 text-right">Ticket Médio</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {data?.evolucao_anual?.map(row => {
                      const isPositive = (row.yoy_volume_pct || 0) >= 0;
                      return (
                        <tr key={row.ano} className="hover:bg-slate-50/70 transition">
                          <td className="py-2.5 px-3 font-bold text-slate-900">
                            {row.ano}
                            {row.ano === '2026' && <span className="text-[10px] text-purple-600 font-normal"> (YTD)</span>}
                          </td>
                          <td className="py-2.5 px-3 text-right font-black text-slate-900">
                            R$ {row.volume_bi.toLocaleString('pt-BR', { minimumFractionDigits: 1 })} Bi
                          </td>
                          <td className="py-2.5 px-3 text-center text-slate-700 font-semibold">{row.total_ofertas}</td>
                          <td className="py-2.5 px-3 text-right font-bold">
                            {row.yoy_volume_pct !== null ? (
                              <span className={isPositive ? 'text-emerald-600' : 'text-slate-500'}>
                                {isPositive ? `+${row.yoy_volume_pct}%` : `${row.yoy_volume_pct}%`}
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-600 font-mono text-[11px]">
                            R$ {row.ticket_medio_mi.toLocaleString('pt-BR', { minimumFractionDigits: 0 })} Mi
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mix de Instrumentos do Ano Vigente */}
              {data?.resumo?.por_tipo && (
                <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-100 space-y-2 text-xs">
                  <span className="text-[11px] font-bold text-slate-600 block uppercase">
                    Composição do Mercado 2026 por Instrumento
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                      <span className="text-[10px] text-blue-700 font-bold block">Debêntures</span>
                      <strong className="text-slate-900 text-sm">
                        R$ {data.resumo.por_tipo['DEB']?.volume_bi.toFixed(1) || '0'} Bi
                      </strong>
                      <span className="text-[10px] text-slate-400 block">
                        {data.resumo.por_tipo['DEB']?.total || 0} emissões
                      </span>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                      <span className="text-[10px] text-emerald-700 font-bold block">CRIs</span>
                      <strong className="text-slate-900 text-sm">
                        R$ {data.resumo.por_tipo['CRI']?.volume_bi.toFixed(1) || '0'} Bi
                      </strong>
                      <span className="text-[10px] text-slate-400 block">
                        {data.resumo.por_tipo['CRI']?.total || 0} emissões
                      </span>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                      <span className="text-[10px] text-amber-700 font-bold block">CRAs</span>
                      <strong className="text-slate-900 text-sm">
                        R$ {data.resumo.por_tipo['CRA']?.volume_bi.toFixed(1) || '0'} Bi
                      </strong>
                      <span className="text-[10px] text-slate-400 block">
                        {data.resumo.por_tipo['CRA']?.total || 0} emissões
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Coluna 2: Gráfico Mensal de Volume de Emissões */}
            <div className="lg:col-span-7 space-y-4 flex flex-col justify-between">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <BarChart3 size={18} className="text-blue-600" />
                    Volume Mensal de Distribuição CVM (R$ Bi)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Histórico mês a mês com janelas de liquidez e fechamento de balanços.
                  </p>
                </div>

                <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-[11px] font-semibold text-slate-600 self-start sm:self-auto">
                  <button
                    onClick={() => setChartPeriod('12M')}
                    className={`px-2 py-1 rounded-md transition cursor-pointer ${
                      chartPeriod === '12M' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'hover:text-slate-900'
                    }`}
                  >
                    12 meses
                  </button>
                  <button
                    onClick={() => setChartPeriod('24M')}
                    className={`px-2 py-1 rounded-md transition cursor-pointer ${
                      chartPeriod === '24M' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'hover:text-slate-900'
                    }`}
                  >
                    24 meses
                  </button>
                  <button
                    onClick={() => setChartPeriod('ALL')}
                    className={`px-2 py-1 rounded-md transition cursor-pointer ${
                      chartPeriod === 'ALL' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'hover:text-slate-900'
                    }`}
                  >
                    Tudo (46m)
                  </button>
                </div>
              </div>

              <div className="h-64 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dadosGraficoMensal} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="labelMes"
                      tick={{ fill: '#64748b', fontSize: 10 }}
                      axisLine={{ stroke: '#cbd5e1' }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: '#64748b', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={val => `${val}B`}
                    />
                    <RechartsTooltip
                      formatter={(value: any, name: any) => [
                        `R$ ${Number(value).toFixed(2)} Bi`,
                        name === 'vol_deb_bi'
                          ? 'Debêntures'
                          : name === 'vol_cri_bi'
                          ? 'CRIs'
                          : name === 'vol_cra_bi'
                          ? 'CRAs'
                          : 'Volume Total'
                      ]}
                      labelFormatter={(label: any) => `Mês: ${label}`}
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '0.75rem',
                        fontSize: '11px',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                      }}
                    />
                    <Legend
                      verticalAlign="top"
                      height={30}
                      formatter={value => (
                        <span className="text-[11px] font-medium text-slate-600">
                          {value === 'vol_deb_bi' ? 'Debêntures' : value === 'vol_cri_bi' ? 'CRIs' : 'CRAs'}
                        </span>
                      )}
                    />
                    <Bar dataKey="vol_deb_bi" name="vol_deb_bi" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="vol_cri_bi" name="vol_cri_bi" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="vol_cra_bi" name="vol_cra_bi" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          {/* ================= SELETOR DE ABAS E FILTROS ================= */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            {/* Abas */}
            <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
              <button
                onClick={() => {
                  setActiveTab('ANDAMENTO');
                  setPage(1);
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                  activeTab === 'ANDAMENTO' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-purple-600" />
                Em Andamento (Bookbuilding)
                <span className="px-1.5 py-0.2 rounded-full bg-purple-100 text-purple-800 text-[10px]">
                  {data?.ofertas_em_andamento?.length || 0}
                </span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('DISTRIBUICAO');
                  setPage(1);
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                  activeTab === 'DISTRIBUICAO'
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Landmark size={14} className="text-indigo-600" />
                Distribuição Bancária
                <span className="px-1.5 py-0.2 rounded-full bg-indigo-100 text-indigo-800 text-[10px]">
                  {data?.distribuicao_bancos?.todas_ofertas_distribuicao?.length || 0}
                </span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('ENCERRADAS');
                  setPage(1);
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                  activeTab === 'ENCERRADAS' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CheckCircle2 size={14} className="text-blue-600" />
                Ofertas Encerradas
                <span className="px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-800 text-[10px]">
                  {data?.ofertas_recentes?.length || 0}
                </span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('LEAGUE');
                  setPage(1);
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                  activeTab === 'LEAGUE'
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <BarChart3 size={14} className="text-emerald-600" />
                Ranking de Coordenadores Líderes
              </button>
            </div>

            {/* Controles de Busca e Filtros */}
            {activeTab !== 'LEAGUE' && activeTab !== 'DISTRIBUICAO' && (
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Filtro por Instrumento */}
                <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-600">
                  {['TODOS', 'DEB', 'CRI', 'CRA'].map(t => (
                    <button
                      key={t}
                      onClick={() => {
                        setFilterTipo(t);
                        setPage(1);
                      }}
                      className={`px-2.5 py-1.5 rounded-lg transition cursor-pointer ${
                        filterTipo === t ? 'bg-white text-slate-900 shadow-sm font-bold' : 'hover:text-slate-900'
                      }`}
                    >
                      {t === 'TODOS' ? 'Todos Ativos' : t === 'DEB' ? 'Debêntures' : t}
                    </button>
                  ))}
                </div>

                {/* Filtro por Indexador */}
                <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-600">
                  {['TODOS', 'CDI+', 'IPCA+', '% CDI', 'PRÉ'].map(idx => (
                    <button
                      key={idx}
                      onClick={() => {
                        setFilterIndexador(idx);
                        setPage(1);
                      }}
                      className={`px-2.5 py-1.5 rounded-lg transition cursor-pointer ${
                        filterIndexador === idx
                          ? 'bg-white text-purple-700 shadow-sm font-bold'
                          : 'hover:text-slate-900'
                      }`}
                    >
                      {idx === 'TODOS' ? 'Todos Indexadores' : idx}
                    </button>
                  ))}
                </div>

                {/* Filtro por Ano (quando na aba de encerradas) */}
                {activeTab === 'ENCERRADAS' && (
                  <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-600">
                    {['TODOS', '2026', '2025', '2024', '2023'].map(ano => (
                      <button
                        key={ano}
                        onClick={() => {
                          setFilterAno(ano);
                          setPage(1);
                        }}
                        className={`px-2.5 py-1.5 rounded-lg transition cursor-pointer ${
                          filterAno === ano ? 'bg-white text-slate-900 shadow-sm font-bold' : 'hover:text-slate-900'
                        }`}
                      >
                        {ano === 'TODOS' ? 'Histórico' : ano}
                      </button>
                    ))}
                  </div>
                )}

                {/* Barra de Pesquisa */}
                <div className="relative min-w-[200px]">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={e => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Buscar emissor, devedor, ISIN..."
                    className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-purple-500 bg-slate-50 focus:bg-white transition"
                  />
                </div>
              </div>
            )}
          </div>

          {/* ================= CONTEÚDO DA ABA SELECIONADA ================= */}

          {activeTab === 'LEAGUE' ? (
            /* ================= VIEW 3: LEAGUE TABLE DE COORDENADORES ================= */
            <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <BarChart3 size={20} className="text-emerald-600" />
                  League Table — Coordenadores Líderes de Crédito Privado (2026)
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Ranking dos principais originadores e estruturadores do mercado primário por volume financeiro total
                  distribuído sob a CVM 160.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[11px]">
                      <th className="py-3 px-4 w-12 text-center">Posição</th>
                      <th className="py-3 px-4">Coordenador Líder</th>
                      <th className="py-3 px-4 text-center">Emissões Lideradas</th>
                      <th className="py-3 px-4 text-right">Volume Total (R$)</th>
                      <th className="py-3 px-4 text-right">Market Share Aprox.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data?.league_table && data.league_table.length > 0 ? (
                      data.league_table.map((item, idx) => {
                        const totalVol = data.resumo.volume_total_ano_bi || 1;
                        const share = ((item.volume_bi / totalVol) * 100).toFixed(1);
                        return (
                          <tr key={item.coordenador} className="hover:bg-slate-50/80 transition">
                            <td className="py-3.5 px-4 text-center font-bold text-slate-400">
                              {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}º`}
                            </td>
                            <td className="py-3.5 px-4 font-bold text-slate-900 flex items-center gap-2">
                              <Building2 size={16} className="text-slate-400" />
                              {item.coordenador}
                            </td>
                            <td className="py-3.5 px-4 text-center font-semibold text-slate-700">
                              {item.total_ofertas}
                            </td>
                            <td className="py-3.5 px-4 text-right font-black text-slate-900">
                              R$ {item.volume_bi.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} Bi
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <div className="inline-flex items-center gap-2">
                                <div className="w-20 bg-slate-100 rounded-full h-2 overflow-hidden">
                                  <div
                                    className="bg-emerald-500 h-2 rounded-full"
                                    style={{ width: `${Math.min(100, Number(share) * 2)}%` }}
                                  />
                                </div>
                                <span className="font-semibold text-slate-600 text-[11px]">{share}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400">
                          Nenhum coordenador registrado para o período.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          ) : activeTab === 'DISTRIBUICAO' ? (
            /* ================= VIEW: ESTEIRA DE DISTRIBUIÇÃO BANCÁRIA ================= */
            <section className="space-y-6">
              {/* Painel Quantitativo: Market Share da Esteira & Dinâmica Temporal */}
              {data?.distribuicao_bancos?.analytics && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Card 1: Market Share da Esteira Ativa (5 colunas) */}
                  <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
                              <Landmark size={18} className="text-indigo-600" />
                              Market Share da Esteira Ativa
                            </h4>
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Live Pipeline
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            Distribuição das ofertas públicas ativas nos sites dos bancos (R$ {data.distribuicao_bancos.analytics.volume_total_esteira_bi.toFixed(2)} Bi em carteira).
                          </p>
                        </div>
                      </div>

                      {/* Barra de Distribuição Empilhada Horizontal */}
                      <div className="pt-4 pb-1">
                        <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 mb-1.5">
                          <span>Composição do Volume Ativo</span>
                          <span>100% da Esteira</span>
                        </div>
                        <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
                          {data.distribuicao_bancos.analytics.esteira_ranking.map(b => (
                            <div
                              key={b.banco_id}
                              style={{ width: `${b.share_pct}%`, backgroundColor: b.cor }}
                              title={`${b.banco_nome}: ${b.share_pct}% (R$ ${b.volume_bi} Bi)`}
                              className="h-full transition-all hover:opacity-80 cursor-pointer"
                              onClick={() => setSelectedBank(b.banco_id)}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Ranking Detalhado da Esteira com Clique para Filtrar */}
                      <div className="space-y-2.5 pt-4">
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 block">
                          Ranking por Volume & Share Ativo (Clique para filtrar):
                        </span>

                        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                          {data.distribuicao_bancos.analytics.esteira_ranking.map((b, idx) => {
                            const isSelected = selectedBank === b.banco_id;
                            return (
                              <div
                                key={b.banco_id}
                                onClick={() => setSelectedBank(isSelected ? 'TODOS' : b.banco_id)}
                                className={`p-2.5 rounded-xl border transition cursor-pointer flex flex-col gap-1.5 ${
                                  isSelected
                                    ? 'bg-indigo-50/70 border-indigo-300 ring-2 ring-indigo-500/20 shadow-xs'
                                    : 'bg-slate-50/70 hover:bg-slate-100/80 border-slate-200/80'
                                }`}
                              >
                                <div className="flex items-center justify-between text-xs">
                                  <div className="flex items-center gap-2">
                                    <span className="w-5 h-5 rounded-md bg-white border border-slate-200 text-slate-700 font-black text-[10px] flex items-center justify-center shrink-0">
                                      {idx + 1}º
                                    </span>
                                    <span className={`w-2 h-2 rounded-full shrink-0 ${b.dot_color}`} />
                                    <span className="font-bold text-slate-900 truncate">{b.banco_nome}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-slate-500 text-[11px]">
                                      R$ {b.volume_bi.toFixed(2)} Bi
                                    </span>
                                    <span className="text-[10px] font-medium text-slate-400">
                                      ({b.total_ofertas} {b.total_ofertas === 1 ? 'oferta' : 'ofertas'})
                                    </span>
                                    <span className="font-extrabold text-slate-900 font-mono text-xs w-12 text-right">
                                      {b.share_pct.toFixed(1)}%
                                    </span>
                                  </div>
                                </div>

                                {/* Barra de progresso do share */}
                                <div className="h-1.5 w-full bg-slate-200/70 rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full transition-all duration-500"
                                    style={{
                                      width: `${Math.min(100, b.share_pct)}%`,
                                      backgroundColor: b.cor
                                    }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Rodapé do Card da Esteira */}
                    <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium">
                        Total:{' '}
                        <strong className="text-slate-900">
                          R$ {data.distribuicao_bancos.analytics.volume_total_esteira_bi.toFixed(2)} Bi
                        </strong>{' '}
                        em {data.distribuicao_bancos.todas_ofertas_distribuicao.length} ofertas ativas
                      </span>
                      {selectedBank !== 'TODOS' && (
                        <button
                          onClick={() => setSelectedBank('TODOS')}
                          className="text-xs text-indigo-600 hover:text-indigo-800 font-bold transition cursor-pointer"
                        >
                          Limpar filtro
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Card 2: Dinâmica Temporal & Evolução no Primário (7 colunas) */}
                  <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                    <div>
                      {/* Header com Título e Controles */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                        <div>
                          <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
                            <TrendingUp size={18} className="text-indigo-600" />
                            Evolução Temporal no Mercado Primário
                          </h4>
                          <p className="text-xs text-slate-500 mt-1">
                            Dinâmica de aceleração e desaceleração dos 7 maiores bancos como Coordenador Líder (4.485 ofertas).
                          </p>
                        </div>

                        {/* Controles: Granularidade, Métrica e Formato */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          {/* Granularidade */}
                          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs">
                            <button
                              onClick={() => setMsGranularity('TRIMESTRAL')}
                              className={`px-2 py-1 rounded-md transition cursor-pointer font-bold ${
                                msGranularity === 'TRIMESTRAL'
                                  ? 'bg-white text-indigo-700 shadow-xs'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              Trimestral
                            </button>
                            <button
                              onClick={() => setMsGranularity('ANUAL')}
                              className={`px-2 py-1 rounded-md transition cursor-pointer font-bold ${
                                msGranularity === 'ANUAL'
                                  ? 'bg-white text-indigo-700 shadow-xs'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              Anual
                            </button>
                          </div>

                          {/* Métrica: Share vs Volume */}
                          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs">
                            <button
                              onClick={() => setMsMetric('SHARE')}
                              className={`px-2 py-1 rounded-md transition cursor-pointer font-bold ${
                                msMetric === 'SHARE'
                                  ? 'bg-white text-slate-900 shadow-xs'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              Share (%)
                            </button>
                            <button
                              onClick={() => setMsMetric('VOLUME')}
                              className={`px-2 py-1 rounded-md transition cursor-pointer font-bold ${
                                msMetric === 'VOLUME'
                                  ? 'bg-white text-slate-900 shadow-xs'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              R$ Bi
                            </button>
                          </div>

                          {/* Formato: Barra vs Área */}
                          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs">
                            <button
                              onClick={() => setMsChartType('BAR')}
                              title="Barras Empilhadas"
                              className={`px-2 py-1 rounded-md transition cursor-pointer font-bold ${
                                msChartType === 'BAR'
                                  ? 'bg-white text-slate-900 shadow-xs'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              Barras
                            </button>
                            <button
                              onClick={() => setMsChartType('AREA')}
                              title="Área Contínua Empilhada"
                              className={`px-2 py-1 rounded-md transition cursor-pointer font-bold ${
                                msChartType === 'AREA'
                                  ? 'bg-white text-slate-900 shadow-xs'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              Área
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Sub-filtro para Trimestral: 8T vs Completo */}
                      {msGranularity === 'TRIMESTRAL' && (
                        <div className="flex items-center justify-between pt-3 pb-1 text-xs">
                          <span className="text-[11px] text-slate-400 font-medium">
                            {msHistoryRange === '8T' ? 'Exibindo últimos 8 trimestres (2 anos)' : 'Exibindo série histórica completa (16 trimestres)'}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setMsHistoryRange('8T')}
                              className={`px-2 py-0.5 rounded text-[11px] font-semibold transition cursor-pointer ${
                                msHistoryRange === '8T'
                                  ? 'bg-slate-200 text-slate-800'
                                  : 'text-slate-400 hover:text-slate-600'
                              }`}
                            >
                              Últimos 8T
                            </button>
                            <button
                              onClick={() => setMsHistoryRange('ALL')}
                              className={`px-2 py-0.5 rounded text-[11px] font-semibold transition cursor-pointer ${
                                msHistoryRange === 'ALL'
                                  ? 'bg-slate-200 text-slate-800'
                                  : 'text-slate-400 hover:text-slate-600'
                              }`}
                            >
                              Todos (16T)
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Área do Gráfico Recharts */}
                      <div className="h-64 w-full pt-3">
                        <ResponsiveContainer width="100%" height="100%">
                          {msChartType === 'BAR' ? (
                            <BarChart
                              data={dadosGraficoMarketShare}
                              margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                              <XAxis
                                dataKey="label"
                                tick={{ fill: '#64748b', fontSize: 10 }}
                                axisLine={{ stroke: '#cbd5e1' }}
                                tickLine={false}
                              />
                              <YAxis
                                domain={msMetric === 'SHARE' ? [0, 100] : ['auto', 'auto']}
                                tick={{ fill: '#64748b', fontSize: 10 }}
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={val => (msMetric === 'SHARE' ? `${val}%` : `${val}B`)}
                              />
                              <RechartsTooltip
                                content={({ active, payload, label }) => {
                                  if (!active || !payload || !payload.length) return null;
                                  const totalBi = payload[0]?.payload?.total_bi || 0;
                                  return (
                                    <div className="bg-white/95 backdrop-blur-md p-3 rounded-xl border border-slate-200 shadow-xl text-xs space-y-1.5 min-w-[230px]">
                                      <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                                        <span className="font-bold text-slate-900">{label}</span>
                                        <span className="text-[10px] text-slate-500 font-semibold">
                                          Total: R$ {totalBi.toFixed(2)} Bi
                                        </span>
                                      </div>
                                      <div className="space-y-1 pt-1">
                                        {payload.map((entry: any, idx: number) => {
                                          const rawBancoName = entry.dataKey.replace('_share', '');
                                          const isShare = msMetric === 'SHARE';
                                          const valNum = Number(entry.value || 0);
                                          const valBi = entry.payload[rawBancoName] || 0;
                                          const sharePct = entry.payload[`${rawBancoName}_share`] || 0;

                                          return (
                                            <div key={idx} className="flex items-center justify-between gap-3 text-[11px]">
                                              <div className="flex items-center gap-1.5 truncate">
                                                <span
                                                  className="w-2 h-2 rounded-full shrink-0"
                                                  style={{ backgroundColor: entry.color }}
                                                />
                                                <span className="text-slate-700 truncate">{rawBancoName}</span>
                                              </div>
                                              <div className="flex items-center gap-2 font-mono font-medium">
                                                {isShare ? (
                                                  <>
                                                    <span className="text-slate-900 font-bold">
                                                      {valNum.toFixed(1)}%
                                                    </span>
                                                    <span className="text-slate-400 text-[10px]">
                                                      ({valBi.toFixed(1)}B)
                                                    </span>
                                                  </>
                                                ) : (
                                                  <>
                                                    <span className="text-slate-900 font-bold">
                                                      R$ {valNum.toFixed(2)} Bi
                                                    </span>
                                                    <span className="text-slate-400 text-[10px]">
                                                      ({sharePct.toFixed(1)}%)
                                                    </span>
                                                  </>
                                                )}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  );
                                }}
                              />
                              {data.distribuicao_bancos.analytics.bancos_meta.map(banco => (
                                <Bar
                                  key={banco.nome}
                                  dataKey={msMetric === 'SHARE' ? `${banco.nome}_share` : banco.nome}
                                  name={banco.nome}
                                  stackId="a"
                                  fill={banco.cor}
                                />
                              ))}
                            </BarChart>
                          ) : (
                            <AreaChart
                              data={dadosGraficoMarketShare}
                              margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                              <XAxis
                                dataKey="label"
                                tick={{ fill: '#64748b', fontSize: 10 }}
                                axisLine={{ stroke: '#cbd5e1' }}
                                tickLine={false}
                              />
                              <YAxis
                                domain={msMetric === 'SHARE' ? [0, 100] : ['auto', 'auto']}
                                tick={{ fill: '#64748b', fontSize: 10 }}
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={val => (msMetric === 'SHARE' ? `${val}%` : `${val}B`)}
                              />
                              <RechartsTooltip
                                content={({ active, payload, label }) => {
                                  if (!active || !payload || !payload.length) return null;
                                  const totalBi = payload[0]?.payload?.total_bi || 0;
                                  return (
                                    <div className="bg-white/95 backdrop-blur-md p-3 rounded-xl border border-slate-200 shadow-xl text-xs space-y-1.5 min-w-[230px]">
                                      <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                                        <span className="font-bold text-slate-900">{label}</span>
                                        <span className="text-[10px] text-slate-500 font-semibold">
                                          Total: R$ {totalBi.toFixed(2)} Bi
                                        </span>
                                      </div>
                                      <div className="space-y-1 pt-1">
                                        {payload.map((entry: any, idx: number) => {
                                          const rawBancoName = entry.dataKey.replace('_share', '');
                                          const isShare = msMetric === 'SHARE';
                                          const valNum = Number(entry.value || 0);
                                          const valBi = entry.payload[rawBancoName] || 0;
                                          const sharePct = entry.payload[`${rawBancoName}_share`] || 0;

                                          return (
                                            <div key={idx} className="flex items-center justify-between gap-3 text-[11px]">
                                              <div className="flex items-center gap-1.5 truncate">
                                                <span
                                                  className="w-2 h-2 rounded-full shrink-0"
                                                  style={{ backgroundColor: entry.color }}
                                                />
                                                <span className="text-slate-700 truncate">{rawBancoName}</span>
                                              </div>
                                              <div className="flex items-center gap-2 font-mono font-medium">
                                                {isShare ? (
                                                  <>
                                                    <span className="text-slate-900 font-bold">
                                                      {valNum.toFixed(1)}%
                                                    </span>
                                                    <span className="text-slate-400 text-[10px]">
                                                      ({valBi.toFixed(1)}B)
                                                    </span>
                                                  </>
                                                ) : (
                                                  <>
                                                    <span className="text-slate-900 font-bold">
                                                      R$ {valNum.toFixed(2)} Bi
                                                    </span>
                                                    <span className="text-slate-400 text-[10px]">
                                                      ({sharePct.toFixed(1)}%)
                                                    </span>
                                                  </>
                                                )}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  );
                                }}
                              />
                              {data.distribuicao_bancos.analytics.bancos_meta.map(banco => (
                                <Area
                                  key={banco.nome}
                                  type="monotone"
                                  dataKey={msMetric === 'SHARE' ? `${banco.nome}_share` : banco.nome}
                                  name={banco.nome}
                                  stackId="1"
                                  stroke={banco.cor}
                                  fill={banco.cor}
                                  fillOpacity={0.8}
                                />
                              ))}
                            </AreaChart>
                          )}
                        </ResponsiveContainer>
                      </div>

                      {/* Legenda Customizada com Cores dos Bancos */}
                      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 pt-3 border-t border-slate-100 mt-2 text-[11px] font-semibold text-slate-600">
                        {data.distribuicao_bancos.analytics.bancos_meta.map(b => (
                          <div key={b.nome} className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: b.cor }} />
                            <span>{b.nome}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Destaques de Dinâmica / DCM Insights */}
                    <div className="pt-3 mt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                      <div className="p-2 rounded-lg bg-rose-50/70 border border-rose-100 text-rose-900 flex flex-col justify-between">
                        <span className="font-extrabold text-[10px] uppercase tracking-wider text-rose-600">
                          Aceleração Bradesco BBI
                        </span>
                        <p className="mt-0.5 leading-tight">
                          Evolução contínua de <strong>9,3%</strong> (2023) para <strong>14,1%</strong> (2025) e <strong>15,8%</strong> em 2026.
                        </p>
                      </div>

                      <div className="p-2 rounded-lg bg-orange-50/70 border border-orange-100 text-orange-900 flex flex-col justify-between">
                        <span className="font-extrabold text-[10px] uppercase tracking-wider text-orange-600">
                          Liderança Histórica Itaú
                        </span>
                        <p className="mt-0.5 leading-tight">
                          Maior coordenador do primário, sustentando entre <strong>24,6% e 32,9%</strong> de share em volume.
                        </p>
                      </div>

                      <div className="p-2 rounded-lg bg-amber-50/70 border border-amber-100 text-amber-900 flex flex-col justify-between">
                        <span className="font-extrabold text-[10px] uppercase tracking-wider text-amber-600">
                          Disputa Top 3 (XP & BTG)
                        </span>
                        <p className="mt-0.5 leading-tight">
                          Forte equilíbrio no primário com <strong>11,1%</strong> (XP) vs <strong>11,9%</strong> (BTG) em 2026.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {/* Header da Esteira */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <Landmark size={20} className="text-indigo-600" />
                      Esteira de Distribuição por Instituição Financeira
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-3xl">
                      Consórcios de distribuição, instituições coordenadoras (Resolução CVM 160) e ofertas
                      públicas ativas disponibilizadas nos portais das principais instituições financeiras.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/80">
                    <Globe size={14} className="text-indigo-500" />
                    <span>{data?.distribuicao_bancos?.bancos_disponiveis?.length || 0} Bancos Mapeados</span>
                  </div>
                </div>

                {/* Seletor de Bancos */}
                <div className="pt-5 space-y-3">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 block">
                    Selecione a Instituição Financeira:
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setSelectedBank('TODOS')}
                      className={`px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-2 border ${
                        selectedBank === 'TODOS'
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                          : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      <span>Todos os Bancos</span>
                      <span
                        className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                          selectedBank === 'TODOS' ? 'bg-indigo-700 text-white' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {data?.distribuicao_bancos?.todas_ofertas_distribuicao?.length || 0}
                      </span>
                    </button>

                    {data?.distribuicao_bancos?.bancos_disponiveis?.map(b => (
                      <button
                        key={b.id}
                        onClick={() => setSelectedBank(b.id)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-2 border ${
                          selectedBank === b.id
                            ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                            : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${b.dot_color}`} />
                        <span>{b.nome}</span>
                        <span
                          className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                            selectedBank === b.id ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {b.total_ofertas}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Filtros Internos da Esteira */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-5 mt-5 border-t border-slate-100">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {['TODOS', 'DEB', 'CRI', 'CRA'].map(t => (
                      <button
                        key={t}
                        onClick={() => setBankFilterTipo(t)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                          bankFilterTipo === t
                            ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-200'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                        }`}
                      >
                        {t === 'TODOS'
                          ? 'Todos os Ativos'
                          : t === 'DEB'
                          ? 'Debêntures'
                          : t}
                      </button>
                    ))}
                  </div>

                  <div className="relative min-w-[240px]">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={bankSearch}
                      onChange={e => setBankSearch(e.target.value)}
                      placeholder="Buscar por devedor, taxa ou papel..."
                      className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500 bg-slate-50 focus:bg-white transition"
                    />
                  </div>
                </div>
              </div>

              {/* Box de Scroll de Ofertas Distribuídas */}
              <div className="bg-slate-50/70 p-3 sm:p-4 rounded-3xl border border-slate-200/80 shadow-xs">
                <div className="flex items-center justify-between text-xs text-slate-500 font-semibold px-2 pb-2.5">
                  <span>
                    Exibindo <strong>{ofertasBancoFiltradas.length}</strong> ofertas distribuídas
                    {selectedBank !== 'TODOS' &&
                      ` por ${
                        data?.distribuicao_bancos?.bancos_disponiveis?.find(b => b.id === selectedBank)?.nome ||
                        selectedBank
                      }`}
                  </span>
                  <span className="text-[11px] text-slate-400">Painel com rolagem independente</span>
                </div>

                {ofertasBancoFiltradas.length === 0 ? (
                  <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3">
                    <AlertCircle size={32} className="mx-auto text-slate-400" />
                    <p className="text-slate-700 font-semibold">Nenhuma oferta encontrada para os filtros selecionados.</p>
                    <p className="text-xs text-slate-400">
                      Tente alternar o banco selecionado ou limpar a busca.
                    </p>
                  </div>
                ) : (
                  <div className="max-h-[620px] overflow-y-auto pr-1 sm:pr-2 grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {ofertasBancoFiltradas.map((item, bIdx) => (
                      <div
                        key={bIdx}
                        className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 hover:border-slate-300 shadow-xs transition flex flex-col justify-between space-y-3"
                      >
                        <div className="space-y-2.5">
                          {/* Badges Topo */}
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-extrabold border ${item.badge_bg}`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${item.dot_color}`} />
                                {item.banco_nome}
                              </span>

                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                                  item.papel_banco === 'Coordenador Líder'
                                    ? 'bg-amber-50 text-amber-900 border-amber-300'
                                    : 'bg-slate-100 text-slate-700 border-slate-200'
                                }`}
                              >
                                {item.papel_banco === 'Coordenador Líder' ? '👑 ' : ''}
                                {item.papel_banco}
                              </span>
                            </div>

                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase border ${getTipoBadgeClass(
                                item.tipo_ativo
                              )}`}
                            >
                              {item.tipo_ativo === 'DEB' ? 'Debênture' : item.tipo_ativo}
                            </span>
                          </div>

                          {/* Nome do Devedor */}
                          <div>
                            <h4 className="text-base font-extrabold text-slate-900 tracking-tight leading-snug">
                              {item.devedor}
                            </h4>
                          </div>

                          {/* Metadados Financeiros */}
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-slate-50/80 p-2.5 rounded-xl border border-slate-100 text-xs">
                            <div>
                              <span className="text-[10px] text-slate-400 block font-semibold">Volume Total</span>
                              <span className="font-bold text-slate-800">
                                {item.valor_total_reais ? formatBRL(item.valor_total_reais) : 'A definir'}
                              </span>
                            </div>

                            <div>
                              <span className="text-[10px] text-slate-400 block font-semibold">Vencimento</span>
                              <span className="font-bold text-slate-800">
                                {item.data_vencimento
                                  ? formatDate(item.data_vencimento)
                                  : item.data_liquidacao
                                  ? `Liq. ${formatDate(item.data_liquidacao)}`
                                  : '-'}
                              </span>
                            </div>

                            <div className="col-span-2 sm:col-span-1">
                              <span className="text-[10px] text-slate-400 block font-semibold">Taxa Indicativa</span>
                              <span
                                className="font-bold text-purple-700 block text-xs leading-tight"
                                title={item.taxas_indicativas || 'Sob consulta'}
                              >
                                {item.taxas_indicativas || 'Ver prospecto'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Ações / Links */}
                        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                          <a
                            href={item.portal_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition"
                          >
                            <span>Acessar Portal do Banco</span>
                            <ExternalLink size={12} />
                          </a>

                          <div className="flex items-center gap-1.5">
                            {item.documentos && item.documentos.length > 0 && item.documentos[0].url && (
                              <a
                                href={item.documentos[0].url || item.documentos[0].url_download}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition"
                                title="Download de Lâmina / Prospecto"
                              >
                                <FileText size={12} className="text-slate-500" />
                                <span>Prospecto CVM</span>
                              </a>
                            )}

                            {item.id_requerimento && (
                              <button
                                onClick={() => {
                                  setActiveTab('ANDAMENTO');
                                  setSearch(item.devedor);
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 transition cursor-pointer"
                                title="Ver no Bookbuilding"
                              >
                                <span>Ver Bookbuilding</span>
                                <ArrowUpRight size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          ) : (
            /* ================= VIEW 1 & 2: LISTA DE OFERTAS EM BOX SCROLLÁVEL ================= */
            <div className="space-y-4">
              {ofertasFiltradas.length === 0 ? (
                <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3">
                  <AlertCircle size={32} className="mx-auto text-slate-400" />
                  <p className="text-slate-700 font-semibold">Nenhuma oferta encontrada com os filtros selecionados.</p>
                  <p className="text-xs text-slate-400">
                    Tente buscar por outro termo ou alterar o filtro de instrumento, indexador ou ano.
                  </p>
                </div>
              ) : (
                /* Box com Scroll de tamanho fixo para não poluir a tela */
                <div className="bg-slate-50/70 p-3 sm:p-4 rounded-3xl border border-slate-200/80 shadow-xs">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-semibold px-2 pb-2.5">
                    <span>
                      Exibindo <strong>{paginatedOfertas.length}</strong> de{' '}
                      <strong>{ofertasFiltradas.length}</strong> ofertas filtradas
                    </span>
                    <span className="text-[11px] text-slate-400">Painel com rolagem independente</span>
                  </div>

                  {/* Banner de Bancos Coordenadores no Bookbuilding */}
                  {activeTab === 'ANDAMENTO' &&
                    data?.distribuicao_bancos?.bancos_disponiveis &&
                    data.distribuicao_bancos.bancos_disponiveis.length > 0 && (
                      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-2 mb-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
                          <div className="flex items-center gap-1.5">
                            <Landmark size={15} className="text-indigo-600" />
                            <span className="text-xs font-bold text-slate-800">
                              Instituições Financeiras com Distribuição Ativa
                            </span>
                          </div>
                          <button
                            onClick={() => setActiveTab('DISTRIBUICAO')}
                            className="text-xs font-bold text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1 self-start sm:self-auto cursor-pointer"
                          >
                            <span>Ver esteira completa por banco</span>
                            <ChevronRight size={13} />
                          </button>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                          {data.distribuicao_bancos.bancos_disponiveis.map(b => (
                            <button
                              key={b.id}
                              onClick={() => {
                                setSelectedBank(b.id);
                                setActiveTab('DISTRIBUICAO');
                              }}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border transition cursor-pointer hover:shadow-xs ${b.badge_bg}`}
                              title={`Ver ofertas coordenadas ou distribuídas por ${b.nome}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${b.dot_color}`} />
                              <span>{b.nome}</span>
                              <span className="px-1 py-0.2 rounded-full bg-white/80 text-slate-700 text-[10px]">
                                {b.total_ofertas}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                  <div className="max-h-[660px] overflow-y-auto pr-1 sm:pr-2 space-y-3.5">
                    {paginatedOfertas.map(oferta => {
                      const isExpanded = expandedOffer === oferta.id_requerimento;
                      const temSeries = oferta.series && oferta.series.length > 0;
                      const temDocs = oferta.documentos && oferta.documentos.length > 0;

                      return (
                        <div
                          key={oferta.id_requerimento}
                          className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition overflow-hidden"
                        >
                          {/* Top Bar da Oferta */}
                          <div className="p-4 sm:p-5 space-y-3.5">
                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  {/* Badge de Ativo */}
                                  <span
                                    className={`px-2.5 py-0.5 rounded-md text-[11px] font-extrabold uppercase border ${getTipoBadgeClass(
                                      oferta.tipo_ativo
                                    )}`}
                                  >
                                    {oferta.tipo_ativo === 'DEB' ? 'Debênture' : oferta.tipo_ativo}
                                  </span>

                                  {/* Status */}
                                  <span
                                    className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold border ${
                                      oferta.status_oferta === 'Aguardando Bookbuilding'
                                        ? 'bg-purple-50 text-purple-800 border-purple-200 animate-pulse'
                                        : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                    }`}
                                  >
                                    {oferta.status_oferta}
                                  </span>

                                  {/* Badge de Indexador identificado */}
                                  <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold">
                                    {getOfferIndexer(oferta)}
                                  </span>

                                  {/* Vínculo com Ativo Secundário (apenas em ofertas já encerradas e com ticker oficial de mercado) */}
                                  {activeTab === 'ENCERRADAS' && oferta.ativo_secundario && (
                                    <Link
                                      to={`/asset/${oferta.ativo_secundario.ticker}`}
                                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[11px] font-bold transition shadow-xs"
                                      title={`Ver ativo ${oferta.ativo_secundario.ticker} no mercado secundário`}
                                    >
                                      <span>Secundário: {oferta.ativo_secundario.ticker}</span>
                                      <ArrowUpRight size={11} />
                                    </Link>
                                  )}

                                  {oferta.numero_processo && (
                                    <span className="text-[11px] text-slate-400 font-mono">
                                      Proc. {oferta.numero_processo}
                                    </span>
                                  )}
                                </div>

                                {/* Devedor Real vs Securitizadora */}
                                {oferta.nome_devedor_real && oferta.nome_devedor_real !== oferta.nome_emissor ? (
                                  <div>
                                    <h3 className="text-lg md:text-xl font-black text-slate-900 tracking-tight">
                                      {oferta.nome_devedor_real}
                                    </h3>
                                    <p className="text-xs text-slate-500 font-medium mt-0.5 flex items-center gap-1">
                                      <span>Securitizadora Emissora:</span>
                                      <span className="text-slate-700 font-semibold">{oferta.nome_emissor}</span>
                                    </p>
                                  </div>
                                ) : (
                                  <h3 className="text-lg md:text-xl font-black text-slate-900 tracking-tight">
                                    {oferta.nome_emissor}
                                  </h3>
                                )}

                                <div className="text-xs text-slate-500 flex flex-wrap items-center gap-3 pt-0.5">
                                  {oferta.nome_coordenador_lider && (
                                    <span>
                                      Coord. Líder:{' '}
                                      <strong className="text-slate-700">{oferta.nome_coordenador_lider}</strong>
                                    </span>
                                  )}
                                  {oferta.data_processo && (
                                    <span>
                                      Data do Processo:{' '}
                                      <strong className="text-slate-700">{formatDate(oferta.data_processo)}</strong>
                                    </span>
                                  )}
                                  {oferta.data_liquidacao_doc && (
                                    <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-800 font-semibold border border-purple-200">
                                      Liquidação: <strong>{formatDate(oferta.data_liquidacao_doc)}</strong>
                                    </span>
                                  )}
                                </div>

                                {/* Tags do Sindicato de Distribuição */}
                                {oferta.sindicato_distribuicao && oferta.sindicato_distribuicao.length > 0 && (
                                  <div className="flex flex-wrap items-center gap-1.5 pt-1.5">
                                    <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1 mr-0.5">
                                      <Landmark size={12} className="text-indigo-500" />
                                      Distribuição:
                                    </span>
                                    {oferta.sindicato_distribuicao.map(b => (
                                      <button
                                        key={b.banco_id}
                                        onClick={() => {
                                          setSelectedBank(b.banco_id);
                                          setActiveTab('DISTRIBUICAO');
                                        }}
                                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border transition cursor-pointer hover:shadow-2xs ${
                                          b.is_lead
                                            ? 'bg-amber-50 text-amber-900 border-amber-300 font-extrabold'
                                            : `${b.badge_bg} hover:brightness-95`
                                        }`}
                                        title={`Filtrar esteira de ofertas distribuídas por ${b.banco_nome}`}
                                      >
                                        <span className={`w-1.5 h-1.5 rounded-full ${b.dot_color}`} />
                                        <span>{b.banco_nome}</span>
                                        <span className="text-[9px] opacity-75 font-normal">({b.papel})</span>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Volume Total e Ações */}
                              <div className="flex flex-row lg:flex-col items-end justify-between lg:justify-center border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-100 gap-2">
                                <div className="text-left lg:text-right">
                                  <span className="text-[10px] text-slate-400 block uppercase font-bold">
                                    Volume da Oferta
                                  </span>
                                  <span className="text-xl md:text-2xl font-black text-slate-900">
                                    {formatBRL(oferta.valor_total_reais)}
                                  </span>
                                </div>

                                <button
                                  onClick={() => setExpandedOffer(isExpanded ? null : oferta.id_requerimento)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 transition cursor-pointer"
                                >
                                  <span>{isExpanded ? 'Ocultar Detalhes' : 'Ver Séries e Documentos'}</span>
                                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                </button>
                              </div>
                            </div>

                            {/* Prévia das Séries e Taxas Limite (se não expandido) */}
                            {!isExpanded && temSeries && (
                              <div className="pt-2.5 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                {oferta.series!.slice(0, 3).map((serie, sIdx) => (
                                  <div
                                    key={sIdx}
                                    className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs space-y-1"
                                  >
                                    <div className="flex items-center justify-between font-bold text-slate-700">
                                      <span className="truncate pr-1">{serie.descricao_serie}</span>
                                      {serie.data_vencimento && (
                                        <span className="text-[10px] text-slate-400 whitespace-nowrap">
                                          Venc. {formatDate(serie.data_vencimento, serie.data_emissao)}
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[11px] text-slate-600">
                                      {activeTab === 'ANDAMENTO' ? (
                                        <span>
                                          Teto Book:{' '}
                                          <strong className="text-purple-700">
                                            {serie.taxa_remuneracao_maxima || serie.book_taxa || 'A definir'}
                                          </strong>
                                        </span>
                                      ) : (
                                        <span>
                                          Taxa Final:{' '}
                                          <strong className="text-emerald-700">
                                            {serie.taxa_remuneracao_final ||
                                              serie.taxa_remuneracao_maxima ||
                                              'Definida'}
                                          </strong>
                                        </span>
                                      )}
                                    </div>
                                    {serie.isin && (
                                      <div className="text-[10px] text-slate-400 font-mono">ISIN: {serie.isin}</div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* ================= DETALHAMENTO EXPANDIDO (SÉRIES + DOCUMENTOS + SINDICATO) ================= */}
                          {isExpanded && (
                            <div className="bg-slate-50/70 border-t border-slate-200 p-4 sm:p-6 space-y-6">
                              {/* 1. Detalhamento de Séries e Taxas */}
                              <div>
                                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                                  <Layers size={14} className="text-purple-600" />
                                  Estrutura das Séries & Taxas Contratuais
                                </h4>

                                {temSeries ? (
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {oferta.series!.map((s, idx) => (
                                      <div
                                        key={idx}
                                        className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2 text-xs"
                                      >
                                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                          <span className="font-extrabold text-slate-900">{s.descricao_serie}</span>
                                          {s.avaliacao_risco && (
                                            <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                                              Rating: {s.avaliacao_risco}
                                            </span>
                                          )}
                                        </div>

                                        <div className="space-y-1.5">
                                          <div className="flex justify-between">
                                            <span className="text-slate-500">Volume da Série:</span>
                                            <span className="font-bold text-slate-800">
                                              {formatBRL(s.volume_serie_reais)}
                                            </span>
                                          </div>

                                          {s.taxa_remuneracao_maxima && (
                                            <div className="flex justify-between gap-2">
                                              <span className="text-slate-500">Teto Bookbuilding:</span>
                                              <span className="font-bold text-purple-700 text-right">
                                                {s.taxa_remuneracao_maxima}
                                              </span>
                                            </div>
                                          )}

                                          {s.taxa_remuneracao_final &&
                                            s.taxa_remuneracao_final !== s.taxa_remuneracao_maxima && (
                                              <div className="flex justify-between gap-2">
                                                <span className="text-slate-500">Taxa Final Cortada:</span>
                                                <span className="font-bold text-emerald-700 text-right">
                                                  {s.taxa_remuneracao_final}
                                                </span>
                                              </div>
                                            )}

                                          {s.isin && (
                                            <div className="flex justify-between items-center py-0.5">
                                              <span className="text-slate-500">Código ISIN:</span>
                                              <span className="font-mono text-slate-900 font-bold bg-slate-100 px-1.5 py-0.5 rounded text-[11px] border border-slate-200">
                                                {s.isin}
                                              </span>
                                            </div>
                                          )}

                                          <div className="flex justify-between">
                                            <span className="text-slate-500">Vencimento:</span>
                                            <span className="font-semibold text-slate-800">
                                              {formatDate(s.data_vencimento, s.data_emissao)}
                                            </span>
                                          </div>

                                          {s.forma_amortizacao && (
                                            <div className="flex justify-between">
                                              <span className="text-slate-500">Amortização:</span>
                                              <span className="font-semibold text-slate-800">{s.forma_amortizacao}</span>
                                            </div>
                                          )}

                                          {s.pu_nominal && (
                                            <div className="flex justify-between">
                                              <span className="text-slate-500">PU Unitário:</span>
                                              <span className="font-mono text-slate-700">
                                                R$ {s.pu_nominal.toFixed(2)}
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-xs text-slate-400">
                                    Nenhuma série detalhada disponível para este requerimento.
                                  </p>
                                )}
                              </div>

                              {/* 2. Documentos Oficiais (Prospecto Preliminar, Lâminas, Avisos) */}
                              <div>
                                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                                  <FileText size={14} className="text-blue-600" />
                                  Documentos Oficiais Publicados na CVM
                                </h4>

                                {temDocs ? (
                                  <div className="flex flex-wrap gap-2.5">
                                    {oferta.documentos!.map((doc, dIdx) => (
                                      <a
                                        key={dIdx}
                                        href={doc.url_download}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200 hover:border-blue-300 hover:shadow-sm text-xs font-semibold text-slate-800 transition"
                                      >
                                        <Download size={14} className="text-blue-600" />
                                        <span>{doc.nome_documento}</span>
                                        {doc.data_publicacao && (
                                          <span className="text-[10px] text-slate-400 font-normal">
                                            ({formatDate(doc.data_publicacao)})
                                          </span>
                                        )}
                                      </a>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-xs text-slate-400">
                                    Nenhum documento publicado anexado a este registro até o momento.
                                  </p>
                                )}
                              </div>

                              {/* 3. Sindicato de Distribuição e Participantes */}
                              {oferta.participantes && oferta.participantes.length > 0 && (
                                <div>
                                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                                    <Users size={14} className="text-emerald-600" />
                                    Consórcio de Distribuição & Coordenadores
                                  </h4>

                                  <div className="flex flex-wrap gap-2 text-xs">
                                    {oferta.participantes.map((part, pIdx) => (
                                      <div
                                        key={pIdx}
                                        className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700"
                                      >
                                        <span className="font-bold text-slate-900">{part.razao_social}</span>{' '}
                                        <span className="text-[10px] text-slate-400">({part.tipo_participante})</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Paginação da lista de ofertas encerradas */}
              {activeTab === 'ENCERRADAS' && totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white px-5 py-3.5 rounded-2xl border border-slate-200 text-xs font-semibold text-slate-600 shadow-sm mt-4">
                  <div>
                    Mostrando página <strong className="text-slate-900">{page}</strong> de{' '}
                    <strong className="text-slate-900">{totalPages}</strong> ({ofertasFiltradas.length} ofertas
                    filtradas)
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={page <= 1}
                      onClick={() => {
                        setPage(p => Math.max(1, p - 1));
                      }}
                      className="px-3.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition font-bold"
                    >
                      Anterior
                    </button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pNum = i + 1;
                        if (totalPages > 5 && page > 3) {
                          pNum = page - 2 + i;
                          if (pNum > totalPages) pNum = totalPages - (4 - i);
                        }
                        return (
                          <button
                            key={pNum}
                            onClick={() => {
                              setPage(pNum);
                            }}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold transition cursor-pointer ${
                              page === pNum
                                ? 'bg-purple-600 text-white shadow-xs'
                                : 'hover:bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {pNum}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      disabled={page >= totalPages}
                      onClick={() => {
                        setPage(p => Math.min(totalPages, p + 1));
                      }}
                      className="px-3.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition font-bold"
                    >
                      Próxima
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Primary;
