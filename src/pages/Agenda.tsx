import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar,
  Search,
  Filter,
  DollarSign,
  TrendingUp,
  Info,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowUpDown,
  Building2,
  ChevronLeft,
  ChevronRight,
  Download,
  Layers,
  Sparkles,
  X,
  Coins
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend
} from 'recharts';

interface ResumoMensal {
  ano_mes: string;
  total_eventos: number;
  total_ativos: number;
  juros_bi: number;
  amortizacao_bi: number;
  vencimento_bi: number;
  total_bi: number;
}

interface EventoProximo {
  ticker: string;
  tipo: string;
  devedor: string;
  indexador: string;
  taxa_emissao: string;
  data_evento: string;
  data_base_contratual?: string;
  data_liquidacao?: string;
  ajuste_dia_util?: boolean;
  tipo_evento: string;
  volume: number;
  pu_evento: number;
  percentual_amortizacao?: number;
  unidade?: string;
  status: string;
  fonte: string;
}

interface AgendaData {
  atualizado_em: string;
  total_eventos_90d: number;
  resumo_mensal: ResumoMensal[];
  eventos_proximos: EventoProximo[];
  metodologia: {
    nota: string;
  };
}

export default function AgendaPage() {
  const [data, setData] = useState<AgendaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showMethodologyModal, setShowMethodologyModal] = useState(false);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [tipoFilter, setTipoFilter] = useState('ALL');
  const [eventoFilter, setEventoFilter] = useState('ALL');
  const [periodoFilter, setPeriodoFilter] = useState('30'); // '15', '30', '60', '90'
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  useEffect(() => {
    document.title = 'Agenda de Pagamentos & Cupons de Crédito Privado | FIXDATA';
    setLoading(true);
    fetch('/data/agenda_pagamentos.json')
      .then(res => {
        if (!res.ok) throw new Error('Não foi possível carregar a agenda de pagamentos.');
        return res.json();
      })
      .then((json: AgendaData) => {
        setData(json);
        setLoading(false);
      })
      .catch(err => {
        console.error('Erro ao carregar agenda:', err);
        setError('Erro ao carregar a agenda de pagamentos futuros.');
        setLoading(false);
      });
  }, []);

  // Formatação de Moeda
  const formatCurrency = (val: number) => {
    if (!val || isNaN(val)) return 'R$ 0,00';
    if (val >= 1e9) {
      return `R$ ${(val / 1e9).toFixed(2).replace('.', ',')} Bi`;
    }
    if (val >= 1e6) {
      return `R$ ${(val / 1e6).toFixed(2).replace('.', ',')} MM`;
    }
    if (val >= 1e3) {
      return `R$ ${(val / 1e3).toFixed(1).replace('.', ',')} Mil`;
    }
    return `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDateBR = (isoDate: string) => {
    if (!isoDate || !isoDate.includes('-')) return isoDate;
    const parts = isoDate.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return isoDate;
  };

  // Filtragem dos eventos
  const filteredEvents = useMemo(() => {
    if (!data?.eventos_proximos) return [];

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const maxDays = parseInt(periodoFilter, 10) || 30;
    const maxDate = new Date(now);
    maxDate.setDate(maxDate.getDate() + maxDays);

    return data.eventos_proximos.filter(ev => {
      // Filtro de data
      const evDate = new Date(ev.data_evento + 'T00:00:00');
      if (evDate < now || evDate > maxDate) return false;

      // Filtro de tipo
      if (tipoFilter !== 'ALL') {
        if (tipoFilter === 'DEB' && !ev.tipo.toLowerCase().includes('deb')) return false;
        if (tipoFilter === 'CRI' && !ev.tipo.toUpperCase().includes('CRI')) return false;
        if (tipoFilter === 'CRA' && !ev.tipo.toUpperCase().includes('CRA')) return false;
      }

      // Filtro de evento
      if (eventoFilter !== 'ALL') {
        if (eventoFilter === 'JUROS' && !ev.tipo_evento.toLowerCase().includes('juros') && !ev.tipo_evento.toLowerCase().includes('rendimento')) return false;
        if (eventoFilter === 'AMORTIZACAO' && !ev.tipo_evento.toLowerCase().includes('amortiza')) return false;
        if (eventoFilter === 'VENCIMENTO' && !ev.tipo_evento.toLowerCase().includes('vencimento') && !ev.tipo_evento.toLowerCase().includes('principal')) return false;
      }

      // Filtro de texto (ticker ou devedor)
      if (searchTerm.trim()) {
        const term = searchTerm.trim().toLowerCase();
        const matchTicker = ev.ticker.toLowerCase().includes(term);
        const matchDevedor = (ev.devedor || '').toLowerCase().includes(term);
        if (!matchTicker && !matchDevedor) return false;
      }

      return true;
    });
  }, [data, periodoFilter, tipoFilter, eventoFilter, searchTerm]);

  // Paginação
  const totalPages = Math.ceil(filteredEvents.length / itemsPerPage) || 1;
  const paginatedEvents = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredEvents.slice(start, start + itemsPerPage);
  }, [filteredEvents, currentPage]);

  // KPIs dos eventos filtrados
  const kpis = useMemo(() => {
    let volTotal = 0;
    let jurosVol = 0;
    let amortVol = 0;
    const uniqueTickers = new Set<string>();

    filteredEvents.forEach(ev => {
      volTotal += ev.volume || 0;
      uniqueTickers.add(ev.ticker);
      if (ev.tipo_evento.toLowerCase().includes('juros') || ev.tipo_evento.toLowerCase().includes('rendimento')) {
        jurosVol += ev.volume || 0;
      } else {
        amortVol += ev.volume || 0;
      }
    });

    // Próxima data de liquidação
    let proximaData = '-';
    let proximoVolume = 0;
    let proximoAtivos = 0;
    if (filteredEvents.length > 0) {
      proximaData = filteredEvents[0].data_evento;
      const eventosMesmoDia = filteredEvents.filter(e => e.data_evento === proximaData);
      proximoVolume = eventosMesmoDia.reduce((acc, e) => acc + (e.volume || 0), 0);
      proximoAtivos = new Set(eventosMesmoDia.map(e => e.ticker)).size;
    }

    return {
      volTotal,
      jurosVol,
      amortVol,
      totalEventos: filteredEvents.length,
      totalAtivos: uniqueTickers.size,
      proximaData,
      proximoVolume,
      proximoAtivos
    };
  }, [filteredEvents]);

  // Dados do gráfico mensal formatados para Recharts
  const chartData = useMemo(() => {
    if (!data?.resumo_mensal) return [];
    return data.resumo_mensal.slice(0, 12).map(item => {
      const [ano, mes] = item.ano_mes.split('-');
      const mesNome = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][parseInt(mes, 10) - 1];
      return {
        label: `${mesNome}/${ano.slice(2)}`,
        Juros: item.juros_bi,
        Amortização: item.amortizacao_bi,
        Vencimento: item.vencimento_bi,
        Total: item.total_bi
      };
    });
  }, [data]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl space-y-6 animate-fade-in font-sans">
      {/* Cabeçalho */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold border border-blue-100">
                <Calendar size={14} />
                <span>Cronograma de Liquidação Financeira</span>
              </div>
              <button
                type="button"
                onClick={() => setShowMethodologyModal(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
                title="Nota metodológica sobre cálculo de curvas e valores nominais"
              >
                <Info size={13} className="text-slate-500" />
                <span>Nota de Projeção</span>
              </button>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Agenda de Pagamentos & Cupons de Crédito Privado
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 font-medium max-w-3xl">
              Cronograma de liquidação de cupons de juros, amortizações parciais e vencimentos de Debêntures, CRIs e CRAs registrados na ANBIMA e B3.
            </p>
          </div>

          {data && (
            <div className="text-left md:text-right shrink-0">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Atualização da Base</span>
              <span className="text-xs font-mono font-bold text-slate-700">{data.atualizado_em}</span>
            </div>
          )}
        </div>

        {/* 3 KPIs Enxutos & Focados no que Importa */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
          <div className="p-4 bg-slate-50/90 rounded-2xl border border-slate-200/80">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Próxima Liquidação</span>
              <Clock size={15} className="text-blue-500" />
            </div>
            <p className="text-xl sm:text-2xl font-black text-slate-900 font-mono tracking-tight">
              {formatDateBR(kpis.proximaData)}
            </p>
            <span className="text-[11px] text-slate-500 font-medium block mt-1">
              {formatCurrency(kpis.proximoVolume)} em {kpis.proximoAtivos} ativos
            </span>
          </div>

          <div className="p-4 bg-slate-50/90 rounded-2xl border border-slate-200/80">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Volume nos Próximos {periodoFilter} Dias</span>
              <DollarSign size={15} className="text-emerald-500" />
            </div>
            <p className="text-xl sm:text-2xl font-black text-slate-900 font-mono tracking-tight">
              {formatCurrency(kpis.volTotal)}
            </p>
            <span className="text-[11px] text-slate-500 font-medium block mt-1">
              Juros: {formatCurrency(kpis.jurosVol)} | Amort: {formatCurrency(kpis.amortVol)}
            </span>
          </div>

          <div className="p-4 bg-slate-50/90 rounded-2xl border border-slate-200/80">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Eventos Programados</span>
              <Coins size={15} className="text-purple-500" />
            </div>
            <p className="text-xl sm:text-2xl font-black text-slate-900 font-mono tracking-tight">
              {kpis.totalEventos}{' '}
              <span className="text-xs font-sans text-slate-500 font-normal">eventos</span>
            </p>
            <span className="text-[11px] text-slate-500 font-medium block mt-1">
              Distribuídos em {kpis.totalAtivos} títulos distintos
            </span>
          </div>
        </div>
      </div>

      {/* Gráfico Mensal: Projeção de Pagamentos (12 Meses) */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
              Fluxo Consolidado de Pagamentos nos Próximos 12 Meses (R$ Bi)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Valores contratuais agrupados por competência mensal</p>
          </div>
          <span className="text-xs text-slate-400 font-medium">Juros, Amortizações e Vencimentos</span>
        </div>

        <div className="h-64 sm:h-72 w-full pt-2">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="label" tick={{ fill: '#64748B', fontSize: 11, fontWeight: 600 }} axisLine={{ stroke: '#CBD5E1' }} />
                <YAxis tick={{ fill: '#64748B', fontSize: 11 }} tickFormatter={(v) => `R$ ${v}B`} axisLine={false} />
                <RechartsTooltip
                  formatter={(val: any, name: any) => [`R$ ${Number(val).toFixed(2).replace('.', ',')} Bi`, name]}
                  contentStyle={{ backgroundColor: '#0F172A', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                <Bar dataKey="Juros" fill="#3B82F6" stackId="a" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Amortização" fill="#10B981" stackId="a" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Vencimento" fill="#8B5CF6" stackId="a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400 text-sm">Carregando projeções...</div>
          )}
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Busca por Ticker / Devedor */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Buscar Ticker ou Devedor..."
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Filtro de Período */}
          <div>
            <select
              value={periodoFilter}
              onChange={e => {
                setPeriodoFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="15">Próximos 15 dias</option>
              <option value="30">Próximos 30 dias</option>
              <option value="60">Próximos 60 dias</option>
              <option value="90">Próximos 90 dias</option>
            </select>
          </div>

          {/* Filtro de Tipo de Ativo */}
          <div>
            <select
              value={tipoFilter}
              onChange={e => {
                setTipoFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">Todos os Tipos (Deb, CRI, CRA)</option>
              <option value="DEB">Apenas Debêntures</option>
              <option value="CRI">Apenas CRIs</option>
              <option value="CRA">Apenas CRAs</option>
            </select>
          </div>

          {/* Filtro de Evento */}
          <div>
            <select
              value={eventoFilter}
              onChange={e => {
                setEventoFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">Todos os Eventos</option>
              <option value="JUROS">Juros / Cupons</option>
              <option value="AMORTIZACAO">Amortizações</option>
              <option value="VENCIMENTO">Vencimentos Totais</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
          <span>Mostrando <strong>{filteredEvents.length}</strong> eventos no período</span>
          {(searchTerm || tipoFilter !== 'ALL' || eventoFilter !== 'ALL' || periodoFilter !== '30') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setTipoFilter('ALL');
                setEventoFilter('ALL');
                setPeriodoFilter('30');
                setCurrentPage(1);
              }}
              className="text-blue-600 hover:underline font-bold text-xs"
            >
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      {/* Tabela de Eventos: Box fixo menor com scroll vertical interno */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden space-y-3 p-4">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Cronograma Detalhado</span>
            <span className="text-[11px] text-slate-400">({filteredEvents.length} registros)</span>
          </div>
          <span className="text-[11px] text-slate-400 hidden sm:inline">Use o scroll vertical para navegar</span>
        </div>

        {/* Box delimitado com rolagem interna e sticky header */}
        <div className="max-h-[460px] overflow-y-auto overflow-x-auto relative rounded-2xl border border-slate-200/90 shadow-2xs">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="sticky top-0 bg-slate-100/95 backdrop-blur-xs text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px] z-10">
              <tr>
                <th className="px-3.5 py-3" title="Data efetiva de liquidação financeira do pagamento. Se a data contratual cair em final de semana ou feriado, o crédito ocorre no primeiro dia útil subsequente.">
                  Data de Pagamento
                </th>
                <th className="px-3.5 py-3">Ativo</th>
                <th className="px-3.5 py-3">Tipo</th>
                <th className="px-3.5 py-3">Devedor / Emissor</th>
                <th className="px-3.5 py-3">Indexador</th>
                <th className="px-3.5 py-3">Evento</th>
                <th className="px-3.5 py-3 text-right">Valor Unitário</th>
                <th className="px-3.5 py-3 text-right">Volume Total</th>
                <th className="px-3.5 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {paginatedEvents.length > 0 ? (
                paginatedEvents.map((ev, idx) => {
                  const isJuros = ev.tipo_evento.toLowerCase().includes('juros') || ev.tipo_evento.toLowerCase().includes('rendimento');
                  const isVcto = ev.tipo_evento.toLowerCase().includes('vencimento') || ev.tipo_evento.toLowerCase().includes('principal');

                  let badgeColor = 'bg-blue-50 text-blue-700 border-blue-200';
                  if (isVcto) {
                    badgeColor = 'bg-purple-50 text-purple-700 border-purple-200';
                  } else if (!isJuros) {
                    badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                  }

                  let tipoBadge = 'bg-slate-100 text-slate-700';
                  if (ev.tipo.toUpperCase().includes('CRI')) tipoBadge = 'bg-amber-50 text-amber-700 border border-amber-200';
                  if (ev.tipo.toUpperCase().includes('CRA')) tipoBadge = 'bg-emerald-50 text-emerald-700 border border-emerald-200';
                  if (ev.tipo.toUpperCase().includes('DEB')) tipoBadge = 'bg-blue-50 text-blue-700 border border-blue-200';

                  return (
                    <tr key={`${ev.ticker}-${ev.data_evento}-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-3.5 py-2.5 font-semibold text-slate-900 font-mono whitespace-nowrap">
                        <div className="flex flex-col">
                          <span>{formatDateBR(ev.data_evento)}</span>
                          {ev.ajuste_dia_util && ev.data_base_contratual && (
                            <span
                              className="text-[10px] text-slate-400 font-normal cursor-help"
                              title={`Data base estipulada em contrato: ${formatDateBR(ev.data_base_contratual)}. Como caiu em final de semana/feriado, a liquidação ocorre no 1º dia útil seguinte (${formatDateBR(ev.data_evento)}).`}
                            >
                              (Útil • base {formatDateBR(ev.data_base_contratual).slice(0, 5)})
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3.5 py-2.5 font-bold">
                        <Link
                          to={`/asset/${ev.ticker}`}
                          className="text-blue-600 hover:text-blue-800 hover:underline font-mono text-xs"
                        >
                          {ev.ticker}
                        </Link>
                      </td>
                      <td className="px-3.5 py-2.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${tipoBadge}`}>
                          {ev.tipo}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 font-medium text-slate-700 max-w-xs truncate" title={ev.devedor}>
                        {ev.devedor}
                      </td>
                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        <span className="font-semibold text-slate-800">{ev.indexador}</span>
                        {ev.taxa_emissao && ev.taxa_emissao !== '-' && (
                          <span className="text-[11px] text-slate-400 block">+{ev.taxa_emissao}%</span>
                        )}
                      </td>
                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${badgeColor}`}>
                          {ev.tipo_evento}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-mono font-medium text-slate-700 whitespace-nowrap">
                        {ev.unidade || (ev.pu_evento ? `R$ ${ev.pu_evento.toFixed(2)}` : '-')}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-black text-slate-900 font-mono whitespace-nowrap">
                        {formatCurrency(ev.volume)}
                      </td>
                      <td className="px-3.5 py-2.5 text-center whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600">
                          {ev.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                    Nenhum evento futuro encontrado com os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2 px-1 text-xs font-semibold text-slate-600">
            <span>
              Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong> ({filteredEvents.length} registros)
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Popover / Modal Sutil de Metodologia */}
      {showMethodologyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 border border-slate-200 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <Info size={16} className="text-blue-600" />
                <span>Nota Metodológica & Projeção de Valores</span>
              </div>
              <button
                type="button"
                onClick={() => setShowMethodologyModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Os fluxos de cupons e amortizações são calculados a partir das condições contratuais pactuadas na escritura do ativo e registradas na ANBIMA e B3.
            </p>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Para títulos indexados a taxas flutuantes (CDI / DI) e inflação (IPCA / IGP-M), os pagamentos futuros refletem o valor contratual nominal de emissão, <strong>sem projeção dinâmica das curvas a termo futuras de fechamento diário</strong> (DI Futuro / Estrutura a Termo NTN-B).
            </p>
            <p className="text-xs text-slate-500 leading-relaxed border-t border-slate-100 pt-2">
              Ativos resgatados antecipadamente ou com quitação integral confirmada em assembleia foram devidamente expurgados deste cronograma.
            </p>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowMethodologyModal(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
