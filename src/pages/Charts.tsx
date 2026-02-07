import React, { useEffect, useMemo, useState } from 'react'
import { fetchCSV, Asset } from '../utils/csv'
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
  LabelList
} from 'recharts'
import PieBox from '../components/PieBox'
import SearchMultiSelect from '../components/SearchMultiSelect'

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

const toPieData = (obj: Record<string, number>) => {
  const total = Object.values(obj).reduce((a, b) => a + b, 0)
  if (!total) return []
  return Object.entries(obj).map(([name, value]) => ({
    name,
    value: Math.round((value / total) * 100)
  }))
}

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

const KPIBox = ({ title, value }: { title: string; value: any }) => (
  <div className="bg-white rounded-2xl p-6 border shadow-sm">
    <p className="text-slate-500 text-sm">{title}</p>
    <p className="text-3xl font-bold mt-2">{value}</p>
  </div>
)

/* ================= MAIN ================= */

const CreditDashboard: React.FC = () => {

  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)

  const [indexadoresSel, setIndexadoresSel] = useState<string[]>([])
  const [issuersSel, setIssuersSel] = useState<string[]>([])
  const [tickersSel, setTickersSel] = useState<string[]>([])
  const [ratingsSel, setRatingsSel] = useState<string[]>([])

  const [spreadMin, setSpreadMin] = useState<number | null>(null)
  const [spreadMax, setSpreadMax] = useState<number | null>(null)

  /* ---------- Load CSV ---------- */

  useEffect(() => {
    fetchCSV<Asset>('./data/assets_master.csv')
      .then(d => setAssets(d || []))
      .finally(() => setLoading(false))
  }, [])

  /* ---------- Ativos vivos ---------- */

  const ativosVivosBase = useMemo(() => {
    const hoje = new Date()

    return assets.filter(a => {
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
  }, [assets])

  /* ---------- Options encadeadas ---------- */

  const indexadoresOptions = useMemo(
    () => unique(ativosVivosBase.map(a => a.indexador)),
    [ativosVivosBase]
  )

  const issuersOptions = useMemo(() => {
    let base = ativosVivosBase
    if (indexadoresSel.length)
      base = base.filter(a => indexadoresSel.includes(a.indexador))
    return unique(base.map(a => a.issuer))
  }, [ativosVivosBase, indexadoresSel])

  const tickersOptions = useMemo(() => {
    let base = ativosVivosBase

    if (indexadoresSel.length)
      base = base.filter(a => indexadoresSel.includes(a.indexador))

    if (issuersSel.length)
      base = base.filter(a => issuersSel.includes(a.issuer))

    return unique(base.map(a => a.ticker))
  }, [ativosVivosBase, indexadoresSel, issuersSel])

  const ratingsOptions = useMemo(() => {
    let base = ativosVivosBase
  
    if (indexadoresSel.length)
      base = base.filter(a => indexadoresSel.includes(a.indexador))
  
    if (issuersSel.length)
      base = base.filter(a => issuersSel.includes(a.issuer))
  
    if (tickersSel.length)
      base = base.filter(a => tickersSel.includes(a.ticker))
  
    return unique(base.map(a => a.rating))
  }, [ativosVivosBase, indexadoresSel, issuersSel, tickersSel])

  /* ---------- Assets filtrados ---------- */

  const filteredAssets = useMemo(() => {
    let base = ativosVivosBase

    if (indexadoresSel.length)
      base = base.filter(a => indexadoresSel.includes(a.indexador))

    if (issuersSel.length)
      base = base.filter(a => issuersSel.includes(a.issuer))

    if (tickersSel.length)
      base = base.filter(a => tickersSel.includes(a.ticker))

    if (ratingsSel.length)
      base = base.filter(a => ratingsSel.includes(a.rating))

    if (spreadMin !== null || spreadMax !== null) {
      base = base.filter(a => {
        const s = parseFloat(a.spread) * 100
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
    const d = parseFloat(a.duration)
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

  const byIndexer = useMemo(() => {
    const raw = countBy(filteredAssets, 'indexador')

    const principais = ['IPCA', 'DI+', 'DI%', 'Pré-Fixado']

    const result: Record<string, number> = {
      IPCA: 0,
      'DI+': 0,
      'DI%': 0,
      'Pré-Fixado': 0,
      Outros: 0
    }

    Object.entries(raw).forEach(([k, v]) => {
      if (principais.includes(k)) result[k] += v
      else result.Outros += v
    })

    return result
  }, [filteredAssets])

  /* ---------- Scatter ---------- */

  const scatterData = useMemo(() => {
    return filteredAssets
      .map(a => {
        const d = durationYears(a)
        const s = parseFloat(a.spread) * 100

        if (d == null || isNaN(s)) return null

        return {
          x: Number(d.toFixed(4)),
          y: s,
          name: a.ticker,
          issuer: a.issuer,
          indexador: a.indexador
        }
      })
      .filter(Boolean) as any[]
  }, [filteredAssets])

  /* ---------- Histogram ---------- */

  const histogramData = useMemo(() => {
    const bins = [
      { name: '0-1', min: 0, max: 1, value: 0 },
      { name: '1-2', min: 1, max: 2, value: 0 },
      { name: '2-4', min: 2, max: 4, value: 0 },
      { name: '4-6', min: 4, max: 6, value: 0 },
      { name: '6-10', min: 6, max: 10, value: 0 },
      { name: '10+', min: 10, max: Infinity, value: 0 }
    ]

    filteredAssets.forEach(a => {
      const d = durationYears(a)
      if (d == null) return
      const bin = bins.find(b => d >= b.min && d < b.max)!
      bin.value++
    })

    return bins.map(b => ({ name: b.name, value: b.value }))
  }, [filteredAssets])

  if (loading) return <p className="p-8">Carregando...</p>

  /* ================= RENDER ================= */

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">

      <h1 className="text-3xl font-bold">
        Dashboard — Crédito Privado
      </h1>

      {/* FILTERS */}

      <div className="bg-white p-4 rounded-2xl border grid md:grid-cols-4 gap-4">

        <div>
          <label className="text-sm text-slate-600 mb-1 block">
            Indexador
          </label>

          <SearchMultiSelect
            options={indexadoresOptions}
            selected={indexadoresSel}
            onChange={vals => {
              setIndexadoresSel(vals)
              setIssuersSel([])
              setTickersSel([])
            }}
            placeholder="Buscar indexador..."
          />

          <button
            className="text-sm underline mt-2"
            onClick={() => {
              setIndexadoresSel([])
              setIssuersSel([])
              setTickersSel([])
            }}
          >
            Limpar
          </button>
        </div>

        <div>
          <label className="text-sm text-slate-600 mb-1 block">
          Emissor / Devedor
          </label>

          <SearchMultiSelect
            options={issuersOptions}
            selected={issuersSel}
            onChange={vals => {
              setIssuersSel(vals)
              setTickersSel([])
            }}
            placeholder="Buscar emissor/devedor..."
          />

          <button
            className="text-sm underline mt-2"
            onClick={() => {
              setIssuersSel([])
              setTickersSel([])
            }}
          >
            Limpar
          </button>
        </div>

        <div>
          <label className="text-sm text-slate-600 mb-1 block">
            Ticker
          </label>

          <SearchMultiSelect
            options={tickersOptions}
            selected={tickersSel}
            onChange={setTickersSel}
            placeholder="Buscar ticker..."
          />

          <button
            className="text-sm underline mt-2"
            onClick={() => setTickersSel([])}
          >
            Limpar
          </button>
        </div>

        <div>
          <label className="text-sm text-slate-600 mb-1 block">
            Rating
          </label>

          <SearchMultiSelect
            options={ratingsOptions}
            selected={ratingsSel}
            onChange={setRatingsSel}
            placeholder="Buscar rating..."
          />

          <button
            className="text-sm underline mt-2"
            onClick={() => setRatingsSel([])}
          >
            Limpar
          </button>
        </div>

        <div>
          <label className="text-sm text-slate-600 mb-1 block">
            Spread Over (bps)
          </label>

          <div className="flex gap-2">
            <input
              type="number"
              placeholder="Min"
              value={spreadMin ?? ''}
              className="w-full rounded-lg border p-2"
              onChange={e =>
                setSpreadMin(e.target.value === '' ? null : Number(e.target.value))
              }
            />

            <input
              type="number"
              placeholder="Max"
              value={spreadMax ?? ''}
              className="w-full rounded-lg border p-2"
              onChange={e =>
                setSpreadMax(e.target.value === '' ? null : Number(e.target.value))
              }
            />
          </div>

          <button
            className="text-sm underline mt-2"
            onClick={() => {
              setSpreadMin(null)
              setSpreadMax(null)
            }}
          >
            Limpar spread
          </button>
        </div>

      </div>

      {/* KPIs */}

      <div className="grid md:grid-cols-3 gap-6">
        <KPIBox title="Papéis ativos" value={ativosVivos} />
        <KPIBox
          title="Volume emissão"
          value={`R$ ${(volumeVivo / 1e9).toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          })} bi`}
        />
        <KPIBox
          title="Duration média (anos)"
          value={durationMedia.toFixed(2)}
        />
      </div>

      {/* SCATTER */}

      <div className="bg-white p-6 rounded-2xl border h-[520px] flex flex-col">

        <h2 className="font-semibold mb-2">
          Spread Over x Duration (anos)
        </h2>

        <div className="flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart>
              <CartesianGrid />

              <XAxis
                type="number"
                dataKey="x"
                label={{
                  value: 'Duration (anos)',
                  position: 'insideBottom',
                  offset: -5
                }}
              />

              <YAxis
                type="number"
                dataKey="y"
                label={{
                  value: 'Spread Over (bps)',
                  angle: -90,
                  position: 'insideLeft'
                }}
              />

              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                content={(props: any) => {
                  if (!props.active || !props.payload || !props.payload.length) return null

                  const p = props.payload[0].payload

                  return (
                    <div className="bg-white p-3 rounded shadow-sm border text-sm">
                      <div className="font-semibold">{p.name}</div>
                      <div>Issuer: {p.issuer}</div>
                      <div>Indexador: {p.indexador}</div>
                      <div>Duration (anos): {p.x}</div>
                      <div>Spread (bps): {p.y}</div>
                    </div>
                  )
                }}
              />

              <Scatter data={scatterData} fill="#2563eb" />
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        {/* OBSERVAÇÃO */}

        <div className="mt-2 text-xs text-slate-500">
          * Spread Over calculado só para papéis atrelados ao IPCA e utilizando taxas indicativas.
        </div>

      </div>


      {/* HISTOGRAM */}

      <div className="bg-white p-6 rounded-2xl border">

        <h2 className="font-semibold mb-4">
          Histograma de Duration
        </h2>

        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={histogramData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="value">
              <LabelList dataKey="value" position="top" />
            </Bar>
          </BarChart>
        </ResponsiveContainer>

      </div>

      {/* LISTA DE ATIVOS FILTRADOS */}

      <div className="bg-white p-6 rounded-2xl border flex flex-col">

        <div className="flex justify-between items-center mb-4">
          <h2 className="font-semibold">
            Ativos filtrados ({filteredAssets.length})
          </h2>

          <button
            onClick={() => downloadCSV(filteredAssets)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
          >
            Baixar CSV
          </button>
        </div>

        <div className="border rounded-lg overflow-y-auto h-[350px]">

          <table className="w-full text-sm">

            <thead className="sticky top-0 bg-slate-100 border-b">
              <tr>
                <th className="p-2 text-left">Ticker</th>
                <th className="p-2 text-left">ISIN</th>
                <th className="p-2 text-left">Emissão</th>
                <th className="p-2 text-left">Serie</th>
                <th className="p-2 text-left">Emissor</th>
                <th className="p-2 text-left">Volume Emissão</th>
                <th className="p-2 text-left">Indexador</th>
                <th className="p-2 text-left">Taxa Emissão</th>
                <th className="p-2 text-left">Data Emissão</th>
                <th className="p-2 text-left">Data Vencimento</th>
                <th className="p-2 text-left">PU</th>
                <th className="p-2 text-left">Agência Rating</th>
                <th className="p-2 text-left">Rating</th>
                <th className="p-2 text-left">Data Divulgação Rating</th>
                <th className="p-2 text-right">Spread</th>
                <th className="p-2 text-right">Duration (anos)</th>
                <th className="p-2 text-right">Volume</th>
              </tr>
            </thead>

            <tbody>

              {filteredAssets.map((a, i) => {

                const d = durationYears(a)
                const spread = parseFloat(a.spread) * 100

                return (
                  <tr
                    key={i}
                    className="border-b hover:bg-slate-50"
                  >
                    <td className="p-2 font-medium">{a.ticker}</td>
                    <td className="p-2 font-medium">{a.isin}</td>
                    <td className="p-2 font-medium">{a.emissao}</td>
                    <td className="p-2 font-medium">{a.serie}</td>
                    <td className="p-2">{a.issuer}</td>
                    <td className="p-2">{a.volume}</td>
                    <td className="p-2">{a.indexador}</td>
                    <td className="p-2">{a.taxa_emissao}</td>
                    <td className="p-2">{a.data_emissao}</td>
                    <td className="p-2">{a.vencimento}</td>
                    <td className="p-2">{a.pu}</td>
                    <td className="p-2">{a.agencia}</td>
                    <td className="p-2">{a.rating}</td>
                    <td className="p-2">{a.divulgacao}</td>

                    <td className="p-2 text-right">
                      {isNaN(spread) ? '-' : spread.toFixed(1)}
                    </td>

                    <td className="p-2 text-right">
                      {d == null ? '-' : d.toFixed(2)}
                    </td>

                    <td className="p-2 text-right">
                      {Number(a.volume).toLocaleString('pt-BR')}
                    </td>
                  </tr>
                )
              })}

              {!filteredAssets.length && (
                <tr>
                  <td
                    colSpan={6}
                    className="p-6 text-center text-slate-500"
                  >
                    Nenhum ativo encontrado com os filtros atuais
                  </td>
                </tr>
              )}

            </tbody>
          </table>

        </div>

      </div>



    </div>
  )
}

export default CreditDashboard
