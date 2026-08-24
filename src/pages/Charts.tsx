import React, { useEffect, useMemo, useState } from 'react'
import {
  fetchCSV,
  Asset,
  SpreadHistoryRecord,
  normalizeRating,
  RATING_SCALE_ORDER,
  getRatingBadgeClass
} from '../utils/csv'
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  LabelList,
  AreaChart,
  Area,
  Legend
} from 'recharts'
import PieBox from '../components/PieBox'
import SearchMultiSelect from '../components/SearchMultiSelect'
import { TrendingUp, Clock, ShieldCheck, Activity, BarChart3, Database } from 'lucide-react'

/* ================= HELPERS ================= */

const unique = (arr: any[]) => Array.from(new Set(arr.filter(Boolean)))

const parseNumber = (v: any) => {
  if (v == null) return NaN
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    const cleaned = v.replace(/\./g, '').replace(/,/g, '.').replace(/[^0-9.\-]/g, '')
    return parseFloat(cleaned)
  }
  return NaN
}

const countBy = <T, K extends keyof T>(arr: T[], key: K) => {
  const map: Record<string, number> = {}
  arr.forEach(i => {
    const k = String(i[key] || 'Outros')
    map[k] = (map[k] || 0) + 1
  })
  return map
}

const toTopPieData = (obj: Record<string, number>, topN = 5) => {
  const validEntries = Object.entries(obj)
    .filter(([k, v]) => k && !['null', 'undefined', 'nan', '', '-'].includes(k.toLowerCase()) && v > 0)
    .sort((a, b) => b[1] - a[1]);

  const total = validEntries.reduce((acc, [, val]) => acc + val, 0);
  if (!total) return [];

  if (validEntries.length <= topN) {
    return validEntries.map(([name, count]) => ({
      name,
      count,
      value: Math.round((count / total) * 1000) / 10
    }));
  }

  const top = validEntries.slice(0, topN);
  const othersCount = validEntries.slice(topN).reduce((acc, [, val]) => acc + val, 0);

  const result = top.map(([name, count]) => ({
    name,
    count,
    value: Math.round((count / total) * 1000) / 10
  }));

  if (othersCount > 0) {
    result.push({
      name: `Outros (${validEntries.length - topN})`,
      count: othersCount,
      value: Math.round((othersCount / total) * 1000) / 10
    });
  }

  return result;
};

const downloadCSV = (rows: Asset[]) => {
  if (!rows.length) return

  const headers = Object.keys(rows[0])

  const csv = [
    headers.join(','),
    ...rows.map(r =>
      headers.map(h => `"${(r as any)[h] ?? ''}"`).join(',')
    )
  ].join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = 'ativos_filtrados.csv'
  link.click()

  URL.revokeObjectURL(url)
}

/* ================= KPI ================= */

const KPIBox = ({
  title,
  value,
  subtitle,
  icon: Icon
}: {
  title: string
  value: any
  subtitle?: string
  icon?: any
}) => (
  <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
    <div className="flex items-center justify-between">
      <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">{title}</p>
      {Icon && <Icon size={18} className="text-blue-600" />}
    </div>
    <div className="mt-3">
      <p className="text-2xl sm:text-3xl font-extrabold text-slate-900">{value}</p>
      {subtitle && <p className="text-xs text-slate-400 font-medium mt-0.5">{subtitle}</p>}
    </div>
  </div>
)

/* ================= MAIN ================= */

const CreditDashboard: React.FC = () => {
  const [assets, setAssets] = useState<Asset[]>([])
  const [spreadHistory, setSpreadHistory] = useState<SpreadHistoryRecord[]>([])
  const [loading, setLoading] = useState(true)

  const [indexadoresSel, setIndexadoresSel] = useState<string[]>([])
  const [issuersSel, setIssuersSel] = useState<string[]>([])
  const [tickersSel, setTickersSel] = useState<string[]>([])
  const [ratingsSel, setRatingsSel] = useState<string[]>([])

  const [spreadMin, setSpreadMin] = useState<number | null>(null)
  const [spreadMax, setSpreadMax] = useState<number | null>(null)

  const [spreadHistIdx, setSpreadHistIdx] = useState<'IPCA' | 'DI+' | 'ALL'>('ALL')

  /* ---------- Load CSVs ---------- */

  useEffect(() => {
    Promise.all([
      fetchCSV<Asset>('./data/assets_master.csv'),
      fetchCSV<SpreadHistoryRecord>('./data/spread_history.csv').catch(() => [])
    ])
      .then(([assetsData, historyData]) => {
        setAssets(assetsData || [])
        setSpreadHistory(historyData || [])
      })
      .finally(() => setLoading(false))
  }, [])

  /* ---------- Ativos vivos ---------- */

  const ativosVivosBase = useMemo(() => {
    const hoje = new Date()

    return assets
      .filter(a => {
        if (!a.vencimento) return false

        let d: Date
        if (a.vencimento.includes('/')) {
          const [dd, mm, yy] = a.vencimento.split('/')
          d = new Date(`${yy}-${mm}-${dd}`)
        } else {
          d = new Date(a.vencimento)
        }

        return d >= hoje
      })
      .map(a => ({
        ...a,
        rating_normalizado: a.rating_normalizado || normalizeRating(a.rating)
      }))
  }, [assets])

  /* ---------- Options encadeadas ---------- */

  const indexadoresOptions = useMemo(
    () => unique(ativosVivosBase.map(a => a.indexador)),
    [ativosVivosBase]
  )

  const issuersOptions = useMemo(() => {
    let base = ativosVivosBase
    if (indexadoresSel.length)
      base = base.filter(a => indexadoresSel.includes(a.indexador || ''))
    return unique(base.map(a => a.issuer))
  }, [ativosVivosBase, indexadoresSel])

  const tickersOptions = useMemo(() => {
    let base = ativosVivosBase

    if (indexadoresSel.length)
      base = base.filter(a => indexadoresSel.includes(a.indexador || ''))

    if (issuersSel.length)
      base = base.filter(a => issuersSel.includes(a.issuer || ''))

    return unique(base.map(a => a.ticker))
  }, [ativosVivosBase, indexadoresSel, issuersSel])

  const ratingsOptions = useMemo(() => {
    let base = ativosVivosBase
    if (indexadoresSel.length)
      base = base.filter(a => indexadoresSel.includes(a.indexador || ''))
    if (issuersSel.length)
      base = base.filter(a => issuersSel.includes(a.issuer || ''))
    if (tickersSel.length)
      base = base.filter(a => tickersSel.includes(a.ticker))

    const existingRatings = unique(base.map(a => a.rating_normalizado || 'Sem Rating'))
    return RATING_SCALE_ORDER.filter(r => existingRatings.includes(r))
  }, [ativosVivosBase, indexadoresSel, issuersSel, tickersSel])

  /* ---------- Filtered ---------- */

  const filteredAssets = useMemo(() => {
    let base = ativosVivosBase

    if (indexadoresSel.length)
      base = base.filter(a => indexadoresSel.includes(a.indexador || ''))

    if (issuersSel.length)
      base = base.filter(a => issuersSel.includes(a.issuer || ''))

    if (tickersSel.length)
      base = base.filter(a => tickersSel.includes(a.ticker))

    if (ratingsSel.length)
      base = base.filter(a => ratingsSel.includes(a.rating_normalizado || 'Sem Rating'))

    if (spreadMin !== null || spreadMax !== null) {
      base = base.filter(a => {
        const s = parseFloat(a.spread || '') * 100
        if (isNaN(s)) return false
        if (spreadMin !== null && s < spreadMin) return false
        if (spreadMax !== null && s > spreadMax) return false
        return true
      })
    }

    return base
  }, [
    ativosVivosBase,
    indexadoresSel,
    issuersSel,
    tickersSel,
    ratingsSel,
    spreadMin,
    spreadMax
  ])

  /* ---------- Metrics ---------- */

  const durationYears = (a: Asset) => {
    const d = parseFloat(a.duration || '')
    return isNaN(d) || d <= 0 ? null : d
  }

  const ativosVivos = filteredAssets.length

  const volumeVivo = useMemo(() => {
    return filteredAssets.reduce((s, a) => {
      const v = Number(a.volume)
      return s + (isNaN(v) ? 0 : v)
    }, 0)
  }, [filteredAssets])

  const durationMedia = useMemo(() => {
    const arr = filteredAssets
      .map(durationYears)
      .filter((v): v is number => v !== null)

    if (!arr.length) return 0
    return arr.reduce((a, b) => a + b, 0) / arr.length
  }, [filteredAssets])

  const totalComPrecoMercado = useMemo(() => {
    return filteredAssets.filter(a => a.fonte_precificacao === 'ANBIMA Mercado').length
  }, [filteredAssets])

  /* ---------- Pies ---------- */

  const pieIndexador = useMemo(
    () => toTopPieData(countBy(filteredAssets, 'indexador'), 5),
    [filteredAssets]
  )

  const pieIssuer = useMemo(
    () => toTopPieData(countBy(filteredAssets, 'issuer'), 5),
    [filteredAssets]
  )

  const pieRating = useMemo(
    () => toTopPieData(countBy(filteredAssets, 'rating_normalizado'), 5),
    [filteredAssets]
  )

  /* ---------- Scatter ---------- */

  const scatterData = useMemo(() => {
    return filteredAssets
      .map(a => {
        const x = durationYears(a)
        const rawSpread = parseFloat(a.spread || '')
        const y = !isNaN(rawSpread) ? Number((rawSpread * 100).toFixed(2)) : null

        if (x === null || y === null) return null

        return {
          x,
          y,
          name: a.ticker,
          issuer: a.issuer,
          indexador: a.indexador,
          rating: a.rating_normalizado || 'Sem Rating',
          fonte: a.fonte_precificacao || 'Duration Calculada'
        }
      })
      .filter(Boolean)
  }, [filteredAssets])

  /* ---------- Histogram ---------- */

  const histogramData = useMemo(() => {
    const bins = [
      { name: '0-1a', min: 0, max: 1, value: 0 },
      { name: '1-3a', min: 1, max: 3, value: 0 },
      { name: '3-5a', min: 3, max: 5, value: 0 },
      { name: '5-7a', min: 5, max: 7, value: 0 },
      { name: '7-10a', min: 7, max: 10, value: 0 },
      { name: '10a+', min: 10, max: Infinity, value: 0 }
    ]

    filteredAssets.forEach(a => {
      const d = durationYears(a)
      if (d === null) return
      const bin = bins.find(b => d >= b.min && d < b.max)
      if (bin) bin.value++
    })

    return bins
  }, [filteredAssets])

  /* ---------- Spread History Time Series ---------- */

  const formattedSpreadHistory = useMemo(() => {
    if (!spreadHistory.length) return []

    // Agrupar por data
    const dateMap: Record<string, { date: string; datePretty: string; ipca?: number; di?: number; total?: number }> = {}

    spreadHistory.forEach(h => {
      if (!h.date) return
      if (!dateMap[h.date]) {
        const parts = h.date.split('-')
        dateMap[h.date] = {
          date: h.date,
          datePretty: parts.length === 3 ? `${parts[2]}/${parts[1]}` : h.date
        }
      }
      const val = parseFloat(h.spread_mediano_bps || '')
      if (!isNaN(val)) {
        if (h.indexador === 'IPCA') dateMap[h.date].ipca = Math.round(val)
        if (h.indexador === 'DI+' || h.indexador.includes('CDI')) dateMap[h.date].di = Math.round(val)
      }
    })

    return Object.values(dateMap).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }, [spreadHistory])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <div className="animate-spin w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full mx-auto" />
          <p className="text-slate-500 font-medium text-sm">Carregando métricas e curvas de crédito...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Activity className="text-blue-600" size={30} />
            Dashboard Analítico de Crédito Privado
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Visão consolidada de spreads over, durations calculadas (DU/252), ratings normalizados e histórico secundário.
          </p>
        </div>
      </div>

      {/* FILTROS */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Filtros Dinâmicos</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <SearchMultiSelect
            label="Indexadores"
            options={indexadoresOptions}
            selected={indexadoresSel}
            onChange={setIndexadoresSel}
          />
          <SearchMultiSelect
            label="Emissores"
            options={issuersOptions}
            selected={issuersSel}
            onChange={setIssuersSel}
          />
          <SearchMultiSelect
            label="Tickers"
            options={tickersOptions}
            selected={tickersSel}
            onChange={setTickersSel}
          />
          <SearchMultiSelect
            label="Rating (Normalizado)"
            options={ratingsOptions}
            selected={ratingsSel}
            onChange={setRatingsSel}
          />
        </div>

        <div className="flex flex-wrap items-center gap-4 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <span>Filtro de Spread (bps):</span>
            <input
              type="number"
              placeholder="Min"
              value={spreadMin ?? ''}
              onChange={e => setSpreadMin(e.target.value === '' ? null : Number(e.target.value))}
              className="border border-slate-300 rounded-lg px-2.5 py-1.5 w-24 text-xs bg-slate-50 focus:bg-white"
            />
            <span>até</span>
            <input
              type="number"
              placeholder="Max"
              value={spreadMax ?? ''}
              onChange={e => setSpreadMax(e.target.value === '' ? null : Number(e.target.value))}
              className="border border-slate-300 rounded-lg px-2.5 py-1.5 w-24 text-xs bg-slate-50 focus:bg-white"
            />
          </div>

          {(spreadMin !== null || spreadMax !== null || indexadoresSel.length > 0 || issuersSel.length > 0 || tickersSel.length > 0 || ratingsSel.length > 0) && (
            <button
              onClick={() => {
                setIndexadoresSel([])
                setIssuersSel([])
                setTickersSel([])
                setRatingsSel([])
                setSpreadMin(null)
                setSpreadMax(null)
              }}
              className="text-xs text-blue-600 font-bold hover:underline"
            >
              Limpar todos os filtros
            </button>
          )}
        </div>
      </div>

      {/* KPIS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPIBox
          title="Ativos Filtrados"
          value={ativosVivos.toLocaleString('pt-BR')}
          subtitle="Títulos ativos em carteira"
          icon={Database}
        />
        <KPIBox
          title="Volume em Estoque"
          value={`R$ ${(volumeVivo / 1e9).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} bi`}
          subtitle="Valor emitido em circulação"
          icon={TrendingUp}
        />
        <KPIBox
          title="Duration Média"
          value={`${durationMedia.toFixed(2)} anos`}
          subtitle="Base Dias Úteis (DU/252)"
          icon={Clock}
        />
        <KPIBox
          title="Negociados ANBIMA"
          value={totalComPrecoMercado.toLocaleString('pt-BR')}
          subtitle={`${Math.round((totalComPrecoMercado / (ativosVivos || 1)) * 100)}% com preço secundário`}
          icon={ShieldCheck}
        />
      </div>

      {/* ================= HISTÓRICO DE SPREAD OVER NO TEMPO ================= */}
      {formattedSpreadHistory.length > 0 && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <BarChart3 className="text-blue-600" size={20} />
                Evolução Histórica do Spread Over Médio de Mercado (bps)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Acompanhamento temporal da abertura e compressão de prêmios de crédito no mercado secundário (ANBIMA / B3).
              </p>
            </div>

            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-bold">
              <button
                onClick={() => setSpreadHistIdx('ALL')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  spreadHistIdx === 'ALL' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setSpreadHistIdx('IPCA')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  spreadHistIdx === 'IPCA' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600'
                }`}
              >
                IPCA (vs NTN-B)
              </button>
              <button
                onClick={() => setSpreadHistIdx('DI+')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  spreadHistIdx === 'DI+' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600'
                }`}
              >
                DI+ (sobre CDI)
              </button>
            </div>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={formattedSpreadHistory} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorIpca" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorDi" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="datePretty" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} unit=" bps" domain={['auto', 'auto']} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload
                      return (
                        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-lg text-xs space-y-1">
                          <p className="font-semibold text-slate-300">Data: {d.date}</p>
                          {d.ipca !== undefined && (
                            <p className="text-blue-300 font-bold">Spread IPCA: +{d.ipca} bps (+{(d.ipca / 100).toFixed(2)}%)</p>
                          )}
                          {d.di !== undefined && (
                            <p className="text-emerald-300 font-bold">Spread DI+: +{d.di} bps (+{(d.di / 100).toFixed(2)}%)</p>
                          )}
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Legend />
                {(spreadHistIdx === 'ALL' || spreadHistIdx === 'IPCA') && (
                  <Area
                    type="monotone"
                    dataKey="ipca"
                    name="Spread IPCA vs NTN-B (bps)"
                    stroke="#2563eb"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorIpca)"
                  />
                )}
                {(spreadHistIdx === 'ALL' || spreadHistIdx === 'DI+') && (
                  <Area
                    type="monotone"
                    dataKey="di"
                    name="Spread DI+ sobre CDI (bps)"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorDi)"
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* PIE CHARTS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <PieBox title="Indexador" subtitle="Top 5 + Outros" data={pieIndexador} />
        <PieBox title="Emissores Mais Concentrados" subtitle="Top 5 + Outros" data={pieIssuer} />
        <PieBox title="Ratings Mais Frequentes" subtitle="Top 5 + Outros" data={pieRating} />
      </div>

      {/* SCATTER PLOT */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-[540px] flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-bold text-slate-900 text-lg">
            Dispersão: Spread Over x Duration (anos)
          </h2>
          <span className="text-xs text-slate-500 font-medium">
            {scatterData.length} ativos plotados
          </span>
        </div>

        <div className="flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                type="number"
                dataKey="x"
                stroke="#64748b"
                fontSize={11}
                label={{
                  value: 'Duration (anos úteis DU/252)',
                  position: 'insideBottom',
                  offset: -10,
                  fontSize: 12
                }}
              />
              <YAxis
                type="number"
                dataKey="y"
                stroke="#64748b"
                fontSize={11}
                label={{
                  value: 'Spread Over (bps)',
                  angle: -90,
                  position: 'insideLeft',
                  fontSize: 12
                }}
              />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                content={(props: any) => {
                  if (!props.active || !props.payload || !props.payload.length) return null
                  const p = props.payload[0].payload

                  return (
                    <div className="bg-slate-900 text-white p-3 rounded-xl shadow-lg border border-slate-800 text-xs space-y-1">
                      <div className="font-bold text-blue-400 text-sm">{p.name}</div>
                      <div>Emissor: {p.issuer || '-'}</div>
                      <div>Indexador: {p.indexador || '-'}</div>
                      <div>Rating: <span className="font-bold">{p.rating}</span></div>
                      <div>Duration: {p.x.toFixed(2)} anos (DU/252)</div>
                      <div className="text-emerald-400 font-bold">Spread: +{p.y} bps (+{(p.y / 100).toFixed(2)}%)</div>
                      <div className="text-[10px] text-slate-400 border-t border-slate-800 pt-1 mt-1">
                        Base: {p.fonte}
                      </div>
                    </div>
                  )
                }}
              />
              <Scatter data={scatterData} fill="#2563eb" />
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-2 text-xs text-slate-500 pt-2 border-t border-slate-100">
          * Spread Over calculado para IPCA (vs NTN-B correspondente), DI+ (spread sobre CDI), DI% e Pré-Fixados (vs Curva DI ANBIMA). Duration calculada na convenção DU/252 com cupons semestrais.
        </div>
      </div>

      {/* HISTOGRAM */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h2 className="font-bold text-slate-900 text-lg mb-4">
          Distribuição de Duration (Prazo Médio em Anos)
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={histogramData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
            <YAxis allowDecimals={false} stroke="#64748b" fontSize={12} />
            <Tooltip />
            <Bar dataKey="value" fill="#3b82f6" radius={[6, 6, 0, 0]}>
              <LabelList dataKey="value" position="top" fill="#64748b" fontSize={11} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* LISTA DE ATIVOS FILTRADOS */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="font-bold text-slate-900 text-lg">
              Ativos Filtrados ({filteredAssets.length})
            </h2>
            <p className="text-xs text-slate-500">Tabela completa com ratings normalizados, spreads e metodologia de precificação.</p>
          </div>

          <button
            onClick={() => downloadCSV(filteredAssets)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm"
          >
            Baixar CSV
          </button>
        </div>

        <div className="border border-slate-200 rounded-xl overflow-y-auto max-h-[450px]">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-100 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
              <tr>
                <th className="p-2.5 text-left">Ticker</th>
                <th className="p-2.5 text-left">Emissor</th>
                <th className="p-2.5 text-left">Tipo</th>
                <th className="p-2.5 text-left">Indexador</th>
                <th className="p-2.5 text-left">Taxa Ativo</th>
                <th className="p-2.5 text-left">Rating Normalizado</th>
                <th className="p-2.5 text-right">Spread (bps)</th>
                <th className="p-2.5 text-right">Duration (anos)</th>
                <th className="p-2.5 text-left">Fonte Precificação</th>
                <th className="p-2.5 text-left">Vencimento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAssets.slice(0, 200).map(a => {
                const spreadVal = parseFloat(a.spread || '') * 100
                const durVal = parseFloat(a.duration || '')
                const normRating = a.rating_normalizado || normalizeRating(a.rating)

                return (
                  <tr key={a.ticker} className="hover:bg-slate-50 transition">
                    <td className="p-2.5 font-mono font-bold text-blue-600">
                      <a href={`/asset/${a.ticker}`} className="hover:underline">
                        {a.ticker}
                      </a>
                    </td>
                    <td className="p-2.5 font-medium text-slate-800 truncate max-w-[200px]" title={a.issuer}>
                      {a.issuer || '-'}
                    </td>
                    <td className="p-2.5 text-slate-600">{a.tipo || '-'}</td>
                    <td className="p-2.5 font-semibold text-slate-700">{a.indexador || '-'}</td>
                    <td className="p-2.5 text-slate-700">{a.taxa_ativo || a.taxa_emissao || '-'}</td>
                    <td className="p-2.5">
                      <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] border ${getRatingBadgeClass(normRating)}`}>
                        {normRating}
                      </span>
                    </td>
                    <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                      {isNaN(spreadVal) ? '-' : `+${spreadVal.toFixed(0)} bps`}
                    </td>
                    <td className="p-2.5 text-right font-mono text-slate-700">
                      {isNaN(durVal) ? '-' : durVal.toFixed(2)}
                    </td>
                    <td className="p-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        a.fonte_precificacao === 'ANBIMA Mercado'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {a.fonte_precificacao || 'Calculada'}
                      </span>
                    </td>
                    <td className="p-2.5 text-slate-500 font-mono">{a.vencimento || '-'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default CreditDashboard
