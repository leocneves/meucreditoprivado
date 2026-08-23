import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { fetchCSV, NtnbRecord } from '../utils/csv';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  Area
} from 'recharts';
import {
  TrendingUp,
  Activity,
  Layers,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Info,
  CheckSquare,
  Square
} from 'lucide-react';

const COLORS = [
  '#2563eb', // Blue
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#8b5cf6', // Purple
  '#06b6d4', // Cyan
  '#ec4899', // Pink
  '#64748b', // Slate
  '#84cc16', // Lime
  '#f97316', // Orange
  '#14b8a6', // Teal
  '#6366f1', // Indigo
  '#d946ef', // Fuchsia
  '#0ea5e9'  // Sky
];

const NtnbDashboard: React.FC = () => {
  const [data, setData] = useState<NtnbRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVertices, setSelectedVertices] = useState<number[]>([2027, 2029, 2035, 2045, 2055]);
  const [timeRange, setTimeRange] = useState<'30' | '90' | '180' | 'ALL'>('180');
  const [metricMode, setMetricMode] = useState<'yield' | 'pu'>('yield');

  useEffect(() => {
    const loadNtnb = async () => {
      try {
        const records = await fetchCSV<NtnbRecord>('/data/ntnb_history.csv');
        setData(records || []);
      } catch (err) {
        console.error('Erro ao carregar dados de NTN-B:', err);
      } finally {
        setLoading(false);
      }
    };
    loadNtnb();
  }, []);

  // Vértices únicos disponíveis
  const allVertices = useMemo(() => {
    const setV = new Set<number>();
    data.forEach(d => {
      const yr = parseInt(d.vertice_ano, 10);
      if (!isNaN(yr)) setV.add(yr);
    });
    return Array.from(setV).sort((a, b) => a - b);
  }, [data]);

  // Datas únicas ordenadas
  const allDates = useMemo(() => {
    const setD = new Set<string>();
    data.forEach(d => {
      if (d.date) setD.add(d.date);
    });
    return Array.from(setD).sort();
  }, [data]);

  const latestDate = allDates[allDates.length - 1] || '';
  const date30dAgo = allDates[Math.max(0, allDates.length - 22)] || '';
  const date90dAgo = allDates[Math.max(0, allDates.length - 65)] || '';

  // Filtragem de datas pelo timeRange
  const filteredDates = useMemo(() => {
    if (timeRange === '30') return allDates.slice(-22);
    if (timeRange === '90') return allDates.slice(-65);
    if (timeRange === '180') return allDates.slice(-130);
    return allDates;
  }, [allDates, timeRange]);

  // Estrutura para o Gráfico de Evolução Temporal (uma linha por vértice selecionado)
  const timeSeriesData = useMemo(() => {
    const dateMap: { [date: string]: any } = {};

    filteredDates.forEach(dt => {
      dateMap[dt] = {
        date: dt,
        datePretty: `${dt.split('-')[2]}/${dt.split('-')[1]}/${dt.split('-')[0].slice(2)}`
      };
    });

    data.forEach(d => {
      if (dateMap[d.date]) {
        const yr = parseInt(d.vertice_ano, 10);
        if (selectedVertices.includes(yr)) {
          const val = metricMode === 'yield'
            ? parseFloat(String(d.taxa_indicativa).replace(',', '.'))
            : parseFloat(String(d.pu).replace(',', '.'));
          if (!isNaN(val)) {
            dateMap[d.date][`NTNB_${yr}`] = val;
          }
        }
      }
    });

    return Object.values(dateMap);
  }, [data, filteredDates, selectedVertices, metricMode]);

  // Dados para a Curva de Juros Real (Estrutura a Termo: Hoje vs 30D vs 90D)
  const curveData = useMemo(() => {
    const mapVertices: { [vertice: number]: any } = {};

    allVertices.forEach(v => {
      mapVertices[v] = {
        vertice: `NTN-B ${v}`,
        ano: v,
        taxaAtual: null,
        taxa30d: null,
        taxa90d: null
      };
    });

    data.forEach(d => {
      const yr = parseInt(d.vertice_ano, 10);
      const taxa = parseFloat(String(d.taxa_indicativa).replace(',', '.'));
      if (isNaN(taxa) || !mapVertices[yr]) return;

      if (d.date === latestDate) {
        mapVertices[yr].taxaAtual = taxa;
      } else if (d.date === date30dAgo) {
        mapVertices[yr].taxa30d = taxa;
      } else if (d.date === date90dAgo) {
        mapVertices[yr].taxa90d = taxa;
      }
    });

    return Object.values(mapVertices).sort((a: any, b: any) => a.ano - b.ano);
  }, [data, allVertices, latestDate, date30dAgo, date90dAgo]);

  // Tabela Resumo dos Vértices no Último Fechamento
  const tableData = useMemo(() => {
    const mapSummary: { [yr: number]: any } = {};

    allVertices.forEach(yr => {
      mapSummary[yr] = {
        ano: yr,
        titulo: `NTN-B ${yr}`,
        vencimento: '',
        taxaAtual: null,
        taxaCompra: null,
        taxaVenda: null,
        pu: null,
        minTaxa: Infinity,
        maxTaxa: -Infinity,
        var1mBps: null
      };
    });

    data.forEach(d => {
      const yr = parseInt(d.vertice_ano, 10);
      const taxa = parseFloat(String(d.taxa_indicativa).replace(',', '.'));
      if (isNaN(yr) || !mapSummary[yr]) return;

      if (!isNaN(taxa)) {
        if (taxa < mapSummary[yr].minTaxa) mapSummary[yr].minTaxa = taxa;
        if (taxa > mapSummary[yr].maxTaxa) mapSummary[yr].maxTaxa = taxa;
      }

      if (d.date === latestDate) {
        mapSummary[yr].vencimento = d.vencimento_iso || d.data_vencimento;
        mapSummary[yr].taxaAtual = taxa;
        mapSummary[yr].taxaCompra = parseFloat(String(d.taxa_compra || '').replace(',', '.'));
        mapSummary[yr].taxaVenda = parseFloat(String(d.taxa_venda || '').replace(',', '.'));
        mapSummary[yr].pu = parseFloat(String(d.pu || '').replace(',', '.'));
      }

      if (d.date === date30dAgo && !isNaN(taxa)) {
        mapSummary[yr].taxa30d = taxa;
      }
    });

    return Object.values(mapSummary).map((row: any) => {
      if (row.taxaAtual !== null && row.taxa30d !== null) {
        row.var1mBps = (row.taxaAtual - row.taxa30d) * 100;
      }
      return row;
    });
  }, [data, allVertices, latestDate, date30dAgo]);

  // KPIs
  const kpiCurta = tableData.find(t => t.ano === 2029) || tableData.find(t => t.ano === 2028);
  const kpiMedia = tableData.find(t => t.ano === 2035);
  const kpiLonga = tableData.find(t => t.ano === 2045);
  const kpiUltra = tableData.find(t => t.ano === 2055) || tableData.find(t => t.ano === 2060);

  const slopeBps = kpiLonga && kpiCurta && kpiLonga.taxaAtual && kpiCurta.taxaAtual
    ? ((kpiLonga.taxaAtual - kpiCurta.taxaAtual) * 100).toFixed(0)
    : null;

  const toggleVertice = (yr: number) => {
    if (selectedVertices.includes(yr)) {
      if (selectedVertices.length > 1) {
        setSelectedVertices(selectedVertices.filter(v => v !== yr));
      }
    } else {
      setSelectedVertices([...selectedVertices, yr].sort((a, b) => a - b));
    }
  };

  const selectAllVertices = () => setSelectedVertices(allVertices);
  const selectBenchmarkVertices = () => setSelectedVertices([2027, 2029, 2035, 2045, 2055]);

  const formatDatePretty = (dStr: string) => {
    if (!dStr) return '-';
    const parts = dStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dStr;
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* HEADER DA PÁGINA */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 text-xs font-bold rounded-full uppercase tracking-wider">
              Títulos Públicos Federais
            </span>
            <span className="text-xs text-slate-500 font-medium">
              Fechamento: <strong>{formatDatePretty(latestDate)}</strong>
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Curva de Juros Real & Taxas de NTN-B (Tesouro IPCA+)
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-3xl">
            Acompanhe a estrutura a termo da taxa de juros real no Brasil da ANBIMA, com a evolução diária das taxas indicativas de mercado secundário e marcação a mercado dos PUs para todos os vencimentos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/charts"
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
          >
            &larr; Spreads de Crédito Privado
          </Link>
          <div className="p-1 bg-slate-100 rounded-xl flex items-center gap-1 text-xs font-bold">
            {(['30', '90', '180', 'ALL'] as const).map(rng => (
              <button
                key={rng}
                onClick={() => setTimeRange(rng)}
                className={`px-3 py-1.5 rounded-lg transition ${
                  timeRange === rng ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {rng === 'ALL' ? 'Tudo' : `${rng}D`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPIS DE TAXAS DE NTN-B */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">NTN-B Curta (2029)</span>
          <div className="flex items-baseline gap-2 mt-1">
            <strong className="text-2xl font-extrabold text-slate-900">
              {kpiCurta && kpiCurta.taxaAtual ? `${kpiCurta.taxaAtual.toFixed(2)}%` : '-'}
            </strong>
            <span className="text-xs text-slate-500 font-semibold">IPCA +</span>
          </div>
          {kpiCurta && kpiCurta.var1mBps !== null && (
            <span className={`text-xs font-bold mt-1 inline-flex items-center gap-0.5 ${kpiCurta.var1mBps >= 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
              {kpiCurta.var1mBps >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
              {Math.abs(kpiCurta.var1mBps).toFixed(0)} bps (30d)
            </span>
          )}
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">NTN-B Média (2035)</span>
          <div className="flex items-baseline gap-2 mt-1">
            <strong className="text-2xl font-extrabold text-slate-900">
              {kpiMedia && kpiMedia.taxaAtual ? `${kpiMedia.taxaAtual.toFixed(2)}%` : '-'}
            </strong>
            <span className="text-xs text-slate-500 font-semibold">IPCA +</span>
          </div>
          {kpiMedia && kpiMedia.var1mBps !== null && (
            <span className={`text-xs font-bold mt-1 inline-flex items-center gap-0.5 ${kpiMedia.var1mBps >= 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
              {kpiMedia.var1mBps >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
              {Math.abs(kpiMedia.var1mBps).toFixed(0)} bps (30d)
            </span>
          )}
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">NTN-B Longa (2045)</span>
          <div className="flex items-baseline gap-2 mt-1">
            <strong className="text-2xl font-extrabold text-slate-900">
              {kpiLonga && kpiLonga.taxaAtual ? `${kpiLonga.taxaAtual.toFixed(2)}%` : '-'}
            </strong>
            <span className="text-xs text-slate-500 font-semibold">IPCA +</span>
          </div>
          {kpiLonga && kpiLonga.var1mBps !== null && (
            <span className={`text-xs font-bold mt-1 inline-flex items-center gap-0.5 ${kpiLonga.var1mBps >= 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
              {kpiLonga.var1mBps >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
              {Math.abs(kpiLonga.var1mBps).toFixed(0)} bps (30d)
            </span>
          )}
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Ultra-Longa (2055/60)</span>
          <div className="flex items-baseline gap-2 mt-1">
            <strong className="text-2xl font-extrabold text-slate-900">
              {kpiUltra && kpiUltra.taxaAtual ? `${kpiUltra.taxaAtual.toFixed(2)}%` : '-'}
            </strong>
            <span className="text-xs text-slate-500 font-semibold">IPCA +</span>
          </div>
          <span className="text-xs text-slate-400 font-medium mt-1 block">Vencimento em 30+ anos</span>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-5 rounded-2xl border border-blue-100 shadow-sm">
          <span className="text-xs font-bold text-blue-700 uppercase tracking-wider block">Inclinação (2045 - 2029)</span>
          <div className="flex items-baseline gap-1 mt-1">
            <strong className="text-2xl font-extrabold text-blue-900">
              {slopeBps !== null ? `${parseFloat(slopeBps) > 0 ? '+' : ''}${slopeBps}` : '-'}
            </strong>
            <span className="text-xs text-blue-700 font-bold">bps</span>
          </div>
          <span className="text-[11px] text-blue-600 font-medium mt-1 block">Spread de prazo longo vs curto</span>
        </div>
      </div>

      {/* GRÁFICO 1: ESTRUTURA A TERMO (YIELD CURVE REAL) */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
              <Layers size={22} className="text-blue-600" />
              Estrutura a Termo da Taxa de Juros Real (Curva NTN-B)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Comparação da Curva de Juros Real no fechamento mais recente versus 30 dias e 90 dias atrás.
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs font-semibold text-slate-600">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-blue-600 inline-block"></span>
              <span>Hoje ({formatDatePretty(latestDate)})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span>
              <span>30 dias atrás</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-amber-500 inline-block"></span>
              <span>90 dias atrás</span>
            </div>
          </div>
        </div>

        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={curveData} margin={{ top: 15, right: 30, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="vertice" stroke="#64748b" fontSize={11} tickLine={false} />
              <YAxis
                domain={['auto', 'auto']}
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                tickFormatter={(v) => `${Number(v).toFixed(2)}%`}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const item = payload[0].payload;
                    return (
                      <div className="bg-slate-900 text-white p-3.5 rounded-xl shadow-xl text-xs space-y-1.5">
                        <p className="font-extrabold text-slate-200 border-b border-slate-700 pb-1">{item.vertice}</p>
                        {item.taxaAtual !== null && (
                          <p className="text-blue-300 font-bold">Hoje: {item.taxaAtual.toFixed(4)}% a.a.</p>
                        )}
                        {item.taxa30d !== null && (
                          <p className="text-emerald-300 font-medium">30D atrás: {item.taxa30d.toFixed(4)}% a.a.</p>
                        )}
                        {item.taxa90d !== null && (
                          <p className="text-amber-300 font-medium">90D atrás: {item.taxa90d.toFixed(4)}% a.a.</p>
                        )}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Line
                type="monotone"
                dataKey="taxaAtual"
                name="Taxa Atual"
                stroke="#2563eb"
                strokeWidth={3}
                dot={{ r: 4, fill: '#2563eb' }}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="taxa30d"
                name="30 Dias Atrás"
                stroke="#10b981"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={{ r: 3, fill: '#10b981' }}
              />
              <Line
                type="monotone"
                dataKey="taxa90d"
                name="90 Dias Atrás"
                stroke="#f59e0b"
                strokeWidth={2}
                strokeDasharray="2 2"
                dot={{ r: 3, fill: '#f59e0b' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* GRÁFICO 2: EVOLUÇÃO TEMPORAL POR VENCIMENTO */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
              <TrendingUp size={22} className="text-blue-600" />
              Evolução Temporal das NTN-Bs no Mercado Secundário
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Trajetória diária das taxas indicativas (% a.a.) e preços unitários ao longo do tempo.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="p-1 bg-slate-100 rounded-xl flex items-center text-xs font-bold">
              <button
                onClick={() => setMetricMode('yield')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  metricMode === 'yield' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Taxas (% a.a.)
              </button>
              <button
                onClick={() => setMetricMode('pu')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  metricMode === 'pu' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Preço Unitário (PU)
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={selectBenchmarkVertices}
                className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200"
              >
                Vértices Principais
              </button>
              <button
                onClick={selectAllVertices}
                className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200"
              >
                Todos
              </button>
            </div>
          </div>
        </div>

        {/* SELETOR RÁPIDO DE VÉRTICES */}
        <div className="flex flex-wrap items-center gap-2 pt-1 pb-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">Vértices:</span>
          {allVertices.map((yr, idx) => {
            const isSelected = selectedVertices.includes(yr);
            const color = COLORS[idx % COLORS.length];
            return (
              <button
                key={yr}
                onClick={() => toggleVertice(yr)}
                style={{
                  borderColor: isSelected ? color : '#e2e8f0',
                  backgroundColor: isSelected ? `${color}15` : 'transparent',
                  color: isSelected ? color : '#64748b'
                }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border transition hover:opacity-80"
              >
                {isSelected ? <CheckSquare size={13} /> : <Square size={13} />}
                NTN-B {yr}
              </button>
            );
          })}
        </div>

        <div className="h-88 w-full" style={{ height: '360px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={timeSeriesData} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="datePretty" stroke="#64748b" fontSize={11} tickLine={false} />
              <YAxis
                domain={['auto', 'auto']}
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                tickFormatter={(v) =>
                  metricMode === 'yield' ? `${Number(v).toFixed(2)}%` : `R$ ${Number(v).toFixed(0)}`
                }
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-slate-900 text-white p-3.5 rounded-xl shadow-xl text-xs space-y-1.5 max-h-60 overflow-y-auto">
                        <p className="font-extrabold text-slate-200 border-b border-slate-700 pb-1">
                          Data: {payload[0]?.payload?.date}
                        </p>
                        {payload.map((p: any) => (
                          <div key={p.dataKey} className="flex items-center justify-between gap-4 font-semibold">
                            <span style={{ color: p.color }}>{p.name.replace('_', ' ')}:</span>
                            <span className="font-mono">
                              {metricMode === 'yield'
                                ? `${Number(p.value).toFixed(4)}% a.a.`
                                : `R$ ${Number(p.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              {selectedVertices.map((yr) => {
                const globalIdx = allVertices.indexOf(yr);
                const color = COLORS[globalIdx >= 0 ? globalIdx % COLORS.length : 0];
                return (
                  <Line
                    key={yr}
                    type="monotone"
                    dataKey={`NTNB_${yr}`}
                    name={`NTN-B ${yr}`}
                    stroke={color}
                    strokeWidth={2.2}
                    dot={false}
                    activeDot={{ r: 5 }}
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* TABELA DETALHADA DE FECHAMENTO */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-lg font-extrabold text-slate-900">Grade Completa de Fechamento por Vencimento</h3>
            <p className="text-xs text-slate-500">Dados oficiais ANBIMA de fechamento do mercado secundário.</p>
          </div>
          <span className="text-xs font-bold text-slate-500">{tableData.length} vencimentos negociados</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Título</th>
                <th className="py-3 px-4">Data Vencimento</th>
                <th className="py-3 px-4 text-right">Taxa Indicativa</th>
                <th className="py-3 px-4 text-right">Taxa Compra (Bid)</th>
                <th className="py-3 px-4 text-right">Taxa Venda (Ask)</th>
                <th className="py-3 px-4 text-right">PU Fechamento</th>
                <th className="py-3 px-4 text-center">Var. 30D (bps)</th>
                <th className="py-3 px-4 text-right">Mín / Máx (180D)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tableData.map(row => (
                <tr key={row.ano} className="hover:bg-slate-50 transition">
                  <td className="py-3 px-4 font-bold text-slate-900 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                    {row.titulo}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-600">{formatDatePretty(row.vencimento)}</td>
                  <td className="py-3 px-4 text-right font-extrabold text-blue-700">
                    {row.taxaAtual !== null ? `${row.taxaAtual.toFixed(4)}%` : '-'}
                  </td>
                  <td className="py-3 px-4 text-right font-medium text-slate-600">
                    {row.taxaCompra !== null && !isNaN(row.taxaCompra) ? `${row.taxaCompra.toFixed(4)}%` : '-'}
                  </td>
                  <td className="py-3 px-4 text-right font-medium text-slate-600">
                    {row.taxaVenda !== null && !isNaN(row.taxaVenda) ? `${row.taxaVenda.toFixed(4)}%` : '-'}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-slate-800 font-semibold">
                    {row.pu !== null && !isNaN(row.pu)
                      ? `R$ ${row.pu.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : '-'}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {row.var1mBps !== null ? (
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                          row.var1mBps >= 0 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
                        }`}
                      >
                        {row.var1mBps >= 0 ? `+${row.var1mBps.toFixed(0)}` : row.var1mBps.toFixed(0)} bps
                      </span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="py-3 px-4 text-right text-xs text-slate-500 font-medium">
                    {row.minTaxa !== Infinity && row.maxTaxa !== -Infinity
                      ? `${row.minTaxa.toFixed(2)}% — ${row.maxTaxa.toFixed(2)}%`
                      : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default NtnbDashboard;
