import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
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
  Coins
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
  ativo_secundario?: {
    ticker: string;
    isin: string;
  } | null;
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
  ofertas_em_andamento: SREOffer[];
  ofertas_recentes: SREOffer[];
}

const Primary: React.FC = () => {
  const [data, setData] = useState<PrimaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ANDAMENTO' | 'ENCERRADAS' | 'LEAGUE'>('ANDAMENTO');
  const [filterTipo, setFilterTipo] = useState<string>('TODOS');
  const [filterAno, setFilterAno] = useState<string>('TODOS');
  const [filterIndexador, setFilterIndexador] = useState<string>('TODOS');
  const [chartPeriod, setChartPeriod] = useState<'ALL' | '24M' | '12M'>('24M');
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

  const formatDate = (dtStr?: string) => {
    if (!dtStr) return '-';
    const s = dtStr.trim();
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
            {activeTab !== 'LEAGUE' && (
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

                                  {/* Vínculo com Ativo Secundário (se houver ticker mapeado) */}
                                  {oferta.ativo_secundario && (
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
                                          Venc. {formatDate(serie.data_vencimento)}
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
                                              {formatDate(s.data_vencimento)}
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
                                    Participantes & Sindicato de Distribuição
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
