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
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
  TooltipProps,
  LabelList
} from 'recharts'
import PieBox from '../components/PieBox';
/* ===================== UI HELPERS ===================== */

const countBy = <T, K extends keyof T>(arr: T[], key: K) => {
  const map: Record<string, number> = {};

  arr.forEach(item => {
    const k = String(item[key] || 'Outros');
    map[k] = (map[k] || 0) + 1;
  });

  return map;
};

const toPieData = (obj: Record<string, number>) => {
  const total = Object.values(obj).reduce((a, b) => a + b, 0);

  if (total === 0) return [];

  return Object.entries(obj).map(([name, value]) => ({
    name,
    value: Math.round((value / total) * 100),
  }));
};

const KPIBox = ({ title, value }: { title: string; value: any }) => (
  <div className="bg-white rounded-2xl p-6 border shadow-sm">
    <p className="text-slate-500 text-sm">{title}</p>
    <p className="text-3xl font-bold mt-2">{value}</p>
  </div>
)

const COLORS = ['#2563eb', '#16a34a', '#f97316', '#dc2626', '#9333ea', '#0891b2', '#0ea5a4', '#f59e0b']

/* ===================== HELPERS ===================== */

const parseNumber = (v: any) => {
  if (v == null) return NaN
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    // replace comma decimal and remove anything else except digits, dot, minus
    const cleaned = v.replace(/\./g, '').replace(/,/g, '.').replace(/[^0-9.\-]/g, '')
    const n = parseFloat(cleaned)
    return isNaN(n) ? NaN : n
  }
  return NaN
}

const unique = (arr: any[]) => Array.from(new Set(arr.filter(Boolean)))

/* ===================== MAIN COMPONENT ===================== */

const CreditDashboard: React.FC = () => {
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)

  // multi-select states (arrays); empty array means "ALL"
  const [indexadoresSel, setIndexadoresSel] = useState<string[]>([])
  const [issuersSel, setIssuersSel] = useState<string[]>([])
  const [tickersSel, setTickersSel] = useState<string[]>([])
  const [spreadMin, setSpreadMin] = useState<number | null>(null)
  const [spreadMax, setSpreadMax] = useState<number | null>(null)

  useEffect(() => {
    fetchCSV<Asset>('./data/assets_master.csv')
      .then(data => setAssets(data || []))
      .catch(err => {
        console.error('Erro ao carregar CSV', err)
        setAssets([])
      })
      .finally(() => setLoading(false))
  }, [])

  /* ------------- Base: apenas ativos não vencidos ------------- */

  const ativosVivosBase = useMemo(() => {
    const hoje = new Date()
    return assets.filter(a => {
      if (!a.vencimento) return false

      try {
        let d: Date
        if (typeof a.vencimento === 'string' && a.vencimento.includes('/')) {
          const [dd, mm, yy] = a.vencimento.split('/')
          d = new Date(`${yy}-${mm}-${dd}`)
        } else {
          d = new Date(a.vencimento)
        }
        return d >= hoje
      } catch {
        return false
      }
    })
  }, [assets])

  /* ------------- Options dependentes (encadeados) ------------- */

  const indexadoresOptions = useMemo(() => unique(ativosVivosBase.map(a => a.indexador)), [ativosVivosBase])

  const issuersOptions = useMemo(() => {
    // se há seleção de indexadores, limita por eles
    const base = indexadoresSel.length ? ativosVivosBase.filter(a => indexadoresSel.includes(a.indexador)) : ativosVivosBase
    return unique(base.map(a => a.issuer))
  }, [ativosVivosBase, indexadoresSel])

  const tickersOptions = useMemo(() => {
    let base = ativosVivosBase
    if (indexadoresSel.length) base = base.filter(a => indexadoresSel.includes(a.indexador))
    if (issuersSel.length) base = base.filter(a => issuersSel.includes(a.issuer))
    return unique(base.map(a => a.ticker))
  }, [ativosVivosBase, indexadoresSel, issuersSel])

  /* ------------- Filtered assets (aplicando seleções) ------------- */

  // const filteredAssets = useMemo(() => {
  //   let base = ativosVivosBase
  //   if (indexadoresSel.length) base = base.filter(a => indexadoresSel.includes(a.indexador))
  //   if (issuersSel.length) base = base.filter(a => issuersSel.includes(a.issuer))
  //   if (tickersSel.length) base = base.filter(a => tickersSel.includes(a.ticker))
  //   return base
  // }, [ativosVivosBase, indexadoresSel, issuersSel, tickersSel])
  const filteredAssets = useMemo(() => {
    let base = ativosVivosBase
  
    if (indexadoresSel.length)
      base = base.filter(a => indexadoresSel.includes(a.indexador))
  
    if (issuersSel.length)
      base = base.filter(a => issuersSel.includes(a.issuer))
  
    if (tickersSel.length)
      base = base.filter(a => tickersSel.includes(a.ticker))
  
    // ===== spread range filter =====
    if (spreadMin !== null || spreadMax !== null) {
      base = base.filter(a => {
        const s = parseFloat(a.spread) * 100 // bps (igual no scatter)
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
    spreadMin,
    spreadMax
  ])

  /* ------------- Derived metrics (duration em anos) ------------- */

  // convert duration from days -> years
  const addDurationYears = (a: Asset) => {
    const d = parseFloat(a.duration)
    if (isNaN(d)) return null
    // if (d / 365 < 100) {
    //   return d / 365
    // }
    return d / 365
  }

  /* ---------------- KPIs ---------------- */

  const ativosVivos = filteredAssets.length

  // const volumeVivoBi = useMemo(() => {
  //   const soma = filteredAssets.reduce((acc, a) => {
  //     const v = parseNumber(a.volume)
  //     return acc + (isNaN(v) ? 0 : v)
  //   }, 0)
  //   return soma
  // }, [filteredAssets])

  const volumeVivoBi = useMemo(() => {
    const hoje = new Date();
  
    const soma = filteredAssets.reduce((acc, asset) => {
      if (!asset.vencimento || asset.volume == null) return acc;
  
      let dataVenc;
  
      if (asset.vencimento.includes('/')) {
        const [d, m, y] = asset.vencimento.split('/');
        dataVenc = new Date(`${y}-${m}-${d}`);
      } else {
        dataVenc = new Date(asset.vencimento);
      }
  
      if (dataVenc >= hoje) {
        return acc + Number(asset.volume);
      }
  
      return acc;
    }, 0);
  
    // converte pra bilhões
    return soma;
  
  }, [filteredAssets]);
  

  const durationMedia = useMemo(() => {
    const arr = filteredAssets
      .map(a => addDurationYears(a))
      .filter((v): v is number => typeof v === 'number' && !isNaN(v))
    if (!arr.length) return 0
    return arr.reduce((s, v) => s + v, 0) / arr.length
  }, [filteredAssets])


  const raw = countBy(filteredAssets, 'indexador');
  const byIndexer = useMemo(() => {
    const raw = countBy(filteredAssets, 'indexador');
  
    const principais = ['IPCA', 'DI+', 'DI%', 'Pré-Fixado'];
  
    const result: Record<string, number> = {
      IPCA: 0,
      'DI+': 0,
      'DI%': 0,
      'Pré-Fixado': 0,
      Outros: 0
    };
  
    Object.entries(raw).forEach(([key, value]) => {
      if (principais.includes(key)) {
        result[key] += value;
      } else {
        result.Outros += value;
      }
    });
  
    return result;
  }, [filteredAssets]);


  /* ---------------- SCATTER (Spread x Duration anos) ---------------- */

  const scatterData = useMemo(() => {
    return filteredAssets
      .map(a => {
        const dur = addDurationYears(a)
        const spread = parseFloat(a.spread) * 100
        return dur == null || isNaN(spread)
          ? null
          : {
              x: Number(dur.toFixed(4)),
              y: Number(spread),
              name: a.ticker,
              issuer: a.issuer,
              indexador: a.indexador
            }
      })
      .filter(Boolean) as Array<{ x: number; y: number; name: string; issuer?: string; indexador?: string }>
  }, [filteredAssets])

  /* ---------------- DURATION PIE (faixas) ---------------- */

  const durationPie = useMemo(() => {
    const ranges: Record<string, number> = {
      '0-1 anos': 0,
      '1-2 anos': 0,
      '2-4 anos': 0,
      '4-6 anos': 0,
      '6-10 anos': 0,
      '10+ anos': 0
    }

    filteredAssets.forEach(a => {
      const d = addDurationYears(a)
      if (d == null || isNaN(d)) return
      if (d < 1) ranges['0-1 anos']++
      else if (d < 2) ranges['1-2 anos']++
      else if (d < 4) ranges['2-4 anos']++
      else if (d < 6) ranges['4-6 anos']++
      else if (d < 10) ranges['6-10 anos']++
      else ranges['10+ anos']++
    })

    return Object.entries(ranges).map(([name, value]) => ({ name, value }))
  }, [filteredAssets])

  /* ---------------- INDEXADOR PIE ---------------- */

  const indexerPie = useMemo(() => {
    const principais = ['IPCA', 'DI+', 'DI%', 'Pré-Fixado'];
  
    const result: Record<string, number> = {
      IPCA: 0,
      'DI+': 0,
      'DI%': 0,
      'Pré-Fixado': 0,
      Outros: 0
    };
  
    filteredAssets.forEach(a => {
      const k = a.indexador || 'Outros';
  
      if (principais.includes(k)) {
        result[k]++;
      } else {
        result.Outros++;
      }
    });
  
    return Object.entries(result).map(([name, value]) => ({
      name,
      value
    }));
  }, [filteredAssets]);

  /* ---------------- HISTOGRAM (bins) ---------------- */

  // bins: 0-1,1-2,2-4,4-6,6-10,10+
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
      const d = addDurationYears(a)
      if (d == null || isNaN(d)) return
      const bin = bins.find(b => d >= b.min && d < b.max) || bins[bins.length - 1]
      bin.value++
    })

    return bins.map(b => ({ name: b.name, value: b.value }))
  }, [filteredAssets])

  /* ---------------- SELECT CHANGE HANDLERS ---------------- */

  // helper to get selected values from <select multiple>
  const optionsFromSelect = (sel: HTMLSelectElement) =>
    Array.from(sel.selectedOptions).map(o => o.value)

  const handleIndexadoresChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const vals = optionsFromSelect(e.target)
    setIndexadoresSel(vals)
    // reset dependent selections to avoid invalid combos when upstream changes
    setIssuersSel([])
    setTickersSel([])
  }

  const handleIssuersChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const vals = optionsFromSelect(e.target)
    setIssuersSel(vals)
    setTickersSel([])
  }

  const handleTickersChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const vals = optionsFromSelect(e.target)
    setTickersSel(vals)
  }

  const clearIndexadores = () => {
    setIndexadoresSel([])
    setIssuersSel([])
    setTickersSel([])
  }
  const clearIssuers = () => {
    setIssuersSel([])
    setTickersSel([])
  }
  const clearTickers = () => setTickersSel([])

  if (loading) return <p className="p-8">Carregando...</p>


  /* ---------------- RENDER ---------------- */

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <h1 className="text-3xl font-bold">Dashboard — Crédito Privado</h1>

      {/* FILTERS */}
      <div className="bg-white p-4 rounded-2xl border flex flex-col gap-3 md:flex-row md:items-end">

        <div className="flex-1">
          <label className="block text-sm text-slate-600 mb-1">Indexador (multi)</label>
          <select
            multiple
            size={4}
            value={indexadoresSel}
            onChange={handleIndexadoresChange}
            className="w-full rounded-lg border p-2 bg-white"
          >
            {indexadoresOptions.length === 0 && <option value="">— nenhum —</option>}
            {indexadoresOptions.map(opt => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          <div className="flex gap-2 mt-2">
            <button className="text-sm underline" onClick={() => setIndexadoresSel(unique(indexadoresOptions))}>
              Selecionar todos
            </button>
            <button className="text-sm underline" onClick={clearIndexadores}>
              Limpar
            </button>
          </div>
        </div>

        <div className="flex-1">
          <label className="block text-sm text-slate-600 mb-1">Issuer (multi)</label>
          <select
            multiple
            size={4}
            value={issuersSel}
            onChange={handleIssuersChange}
            className="w-full rounded-lg border p-2 bg-white"
          >
            {issuersOptions.length === 0 && <option value="">— nenhum —</option>}
            {issuersOptions.map(opt => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          <div className="flex gap-2 mt-2">
            <button className="text-sm underline" onClick={() => setIssuersSel(unique(issuersOptions))}>
              Selecionar todos
            </button>
            <button className="text-sm underline" onClick={clearIssuers}>
              Limpar
            </button>
          </div>
        </div>

        <div className="flex-1">
          <label className="block text-sm text-slate-600 mb-1">Papel / Ticker (multi)</label>
          <select
            multiple
            size={4}
            value={tickersSel}
            onChange={handleTickersChange}
            className="w-full rounded-lg border p-2 bg-white"
          >
            {tickersOptions.length === 0 && <option value="">— nenhum —</option>}
            {tickersOptions.map(opt => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          <div className="flex gap-2 mt-2">
            <button className="text-sm underline" onClick={() => setTickersSel(unique(tickersOptions))}>
              Selecionar todos
            </button>
            <button className="text-sm underline" onClick={clearTickers}>
              Limpar
            </button>
          </div>
        </div>

        {/* FILTRO SPREAD */}
        <div className="flex-1">
          <label className="block text-sm text-slate-600 mb-1">
            Spread (bps)
          </label>

          <div className="flex gap-2">
            <input
              type="number"
              placeholder="Min"
              className="w-full rounded-lg border p-2"
              onChange={e =>
                setSpreadMin(e.target.value === '' ? null : Number(e.target.value))
              }
            />

            <input
              type="number"
              placeholder="Max"
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

      {/* KPI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <KPIBox title="Ativos vivos" value={ativosVivos} />
        <KPIBox title="Volume vivo" value={`R$ ${(volumeVivoBi / 1e9).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} bi`} />
        <KPIBox title="Duration média (anos)" value={durationMedia.toFixed(2)} />
      </div>

      {/* SCATTER */}
      <div className="bg-white p-6 rounded-2xl border h-[520px]">
        <h2 className="font-semibold mb-4">Spread Over x Duration (anos)*</h2>
        <ResponsiveContainer width="100%" height="85%">
          <ScatterChart>
            <CartesianGrid />
            <XAxis
              type="number"
              dataKey="x"
              name="Duration (anos)"
              label={{ value: 'Duration (anos)', position: 'insideBottom', offset: -5 }}
              domain={['auto', 'auto']}
            />
            <YAxis
              type="number"
              dataKey="y"
              name="Spread (bps)"
              label={{ value: 'Spread (bps)', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              formatter={(value: any, name: string) => {
                return value
              }}
              content={(props: any) => {
                if (!props.active || !props.payload || !props.payload.length) return null
                const p = props.payload[0].payload
                return (
                  <div className="bg-white p-3 rounded shadow-sm border">
                    <div><strong>{p.name}</strong></div>
                    <div>Issuer: {p.issuer}</div>
                    <div>Indexador: {p.indexador}</div>
                    <div>Duration (anos): {p.x}</div>
                    <div>Spread: {p.y}</div>
                  </div>
                )
              }}
            />
            <Scatter data={scatterData} fill="#2563eb" />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* PIES + HISTOGRAM */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Duration Pie */}
        {/* <div className="bg-white p-6 rounded-2xl border h-[340px]">
          <h2 className="font-semibold mb-4">Duration por faixa</h2>
          <ResponsiveContainer width="100%" height="85%">
            <PieChart>
              <Pie
                data={durationPie}
                dataKey="value"
                nameKey="name"
                outerRadius={100}
                innerRadius={30}
                label={(entry) => `${entry.name}: ${entry.value}`}
              >
                {durationPie.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div> */}

        {/* Indexer Pie */}
        {/* <div className="bg-white p-6 rounded-2xl border h-[340px]">
          <h2 className="font-semibold mb-4">Ativos por indexador</h2>
          <ResponsiveContainer width="100%" height="85%">
            <PieChart>
              <Pie
                data={indexerPie}
                dataKey="value"
                nameKey="name"
                outerRadius={100}
                innerRadius={30}
                label={(entry) => `${entry.name}: ${entry.value}`}
              >
                {indexerPie.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div> */}

        <PieBox
          title="Ativos por indexador"
          data={toPieData(byIndexer)}
        />

        {/* Histogram */}
        {/* <div className="bg-white p-6 rounded-2xl border h-[340px]">
          <h2 className="font-semibold mb-4">Histograma de Duration (anos)</h2>
          <ResponsiveContainer width="100%" height="85%">
            <BarChart data={histogramData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" />
              <Tooltip />
              <Bar dataKey="value" fill="#16a34a">
                <LabelList dataKey="value" position="insideRight" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div> */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition">

        <h3 className="text-lg font-semibold text-slate-800 mb-4">
          Histograma de Duration (anos)
        </h3>

        <div className="h-56">
          <ResponsiveContainer width="100%" height="150%">
            <BarChart
              data={histogramData}
              margin={{ top: 30, right: 30, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" fill="#16a34a">
                <LabelList dataKey="value" position="top" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        </div>

      </div>
    </div>
  )
}

export default CreditDashboard
