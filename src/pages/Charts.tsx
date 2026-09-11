import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  fetchCSV,
  Asset,
  PriceRecord,
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
import { TrendingUp, Clock, ShieldCheck, Activity, BarChart3, Database, Calendar, Droplets, Filter } from 'lucide-react'
import { normalizeSector, CANONICAL_SECTORS } from '../utils/sectors'

/* ================= HELPERS ================= */

const unique = (arr: any[]) => Array.from(new Set(arr.filter(Boolean)))

export const normalizeIndexador = (idx: string | undefined | null): string => {
  if (!idx) return ''
  const trimmed = idx.trim()
  const upper = trimmed.toUpperCase()
  if (trimmed === 'DI%' || trimmed === '%DI' || upper.includes('DI%') || upper.includes('%DI') || upper.includes('% DO CDI') || upper.includes('%DO CDI')) return '%DI'
  if (upper.includes('PRÉ') || upper.includes('PRE')) return 'Pré'
  if (upper.includes('IPCA')) return 'IPCA'
  if (trimmed === 'DI+' || upper.includes('DI+') || upper.includes('CDI +') || upper.includes('CDI+')) return 'DI+'
  return trimmed
}

export const getAssetNormalizedIndexador = (a: { indexador?: string | null; taxa_emissao?: string | null; taxa_mercado?: string | null } | null | undefined): string => {
  if (!a) return ''
  let norm = normalizeIndexador(a.indexador)
  const tm = parseFloat(a.taxa_mercado || '')
  const te = parseFloat(a.taxa_emissao || '')

  if (norm === 'DI+') {
    if ((!isNaN(te) && te >= 80 && te <= 200) || (!isNaN(tm) && tm >= 25 && (isNaN(te) || te >= 50))) {
      return '%DI'
    }
  } else if (norm === '%DI') {
    if (!isNaN(tm) && tm < 25 && tm > 0.05) {
      return 'DI+'
    } else if (!isNaN(te) && te < 25 && te > 0.05 && (isNaN(tm) || tm < 50)) {
      return 'DI+'
    }
  }
  return norm
}

export const matchIndexador = (assetOrIdx: Asset | string | undefined | null, selectedIdxs: string[]): boolean => {
  if (!selectedIdxs.length) return true
  const normAsset = typeof assetOrIdx === 'string' || !assetOrIdx
    ? normalizeIndexador(assetOrIdx as string)
    : getAssetNormalizedIndexador(assetOrIdx)

  return selectedIdxs.some(s => {
    const normS = normalizeIndexador(s)
    return normAsset === normS || (typeof assetOrIdx === 'string' && assetOrIdx === s)
  })
}

export interface AssetSpreadDisplayResult {
  label: string
  rawValue: number | null
  unit: 'bps' | '% a.a.' | '% CDI'
}

export const getAssetSpreadDisplay = (a: Asset): AssetSpreadDisplayResult => {
  const norm = getAssetNormalizedIndexador(a)

  if (norm === '%DI') {
    const tm = parseFloat(a.taxa_mercado || '')
    const te = parseFloat(a.taxa_emissao || '')
    const val = !isNaN(tm) && tm > 0 ? tm : (!isNaN(te) && te > 0 ? te : null)
    if (val !== null) {
      return { label: `${val.toFixed(2)}% do CDI`, rawValue: val, unit: '% CDI' }
    }
    return { label: '-', rawValue: null, unit: '% CDI' }
  }

  if (norm === 'DI+') {
    const tm = parseFloat(a.taxa_mercado || '')
    const te = parseFloat(a.taxa_emissao || '')
    const val = !isNaN(tm) && tm > 0 ? tm : (!isNaN(te) && te > 0 ? te : null)
    if (val !== null) {
      return { label: `CDI +${val.toFixed(2)}%`, rawValue: val, unit: '% a.a.' }
    }
    return { label: '-', rawValue: null, unit: '% a.a.' }
  }

  // IPCA ou Pré: Spread Over soberano (NTN-B ou DI Futuro) em bps
  const tm = parseFloat(a.taxa_mercado || a.taxa_emissao || '')
  const tRef = parseFloat(a.taxa_ntnb || '')
  if (!isNaN(tm) && !isNaN(tRef) && tRef > 0) {
    const diffBps = Math.round((tm - tRef) * 100)
    return { label: `${diffBps >= 0 ? `+${diffBps}` : diffBps} bps`, rawValue: diffBps, unit: 'bps' }
  }
  const rawSp = parseFloat(a.spread || '')
  if (!isNaN(rawSp)) {
    const bps = Math.abs(rawSp) < 1 ? Math.round(rawSp * 10000) : Math.round(rawSp)
    return { label: `${bps >= 0 ? `+${bps}` : bps} bps`, rawValue: bps, unit: 'bps' }
  }

  return { label: '-', rawValue: null, unit: 'bps' }
}

const formatDateBr = (isoDate?: string | null): string => {
  if (!isoDate) return '-'
  if (isoDate.includes('/')) return isoDate
  const parts = isoDate.split('-')
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`
  }
  return isoDate
}

const subtractDaysFromIso = (isoDate: string, days: number): string => {
  if (!isoDate) return ''
  const [y, m, d] = isoDate.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() - days)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
}

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

  const fieldOrder: { key: keyof Asset | string; label: string }[] = [
    { key: 'ticker', label: 'ticker' },
    { key: 'tipo', label: 'tipo_ativo' },
    { key: 'issuer', label: 'emissor_devedor' },
    { key: 'setor', label: 'setor_anbima' },
    { key: 'indexador', label: 'indexador' },
    { key: 'incentivada', label: 'incentivada_lei_12431' },
    { key: 'em_recuperacao_judicial', label: 'em_recuperacao_judicial' },
    { key: 'taxa_emissao', label: 'taxa_emissao' },
    { key: 'taxa_mercado', label: 'taxa_mercado_atual' },
    { key: 'taxa_ativo', label: 'taxa_referencia' },
    { key: 'taxa_compra', label: 'taxa_bid_compra' },
    { key: 'taxa_venda', label: 'taxa_ask_venda' },
    { key: 'spread', label: 'spread_over_decimal' },
    { key: 'duration', label: 'duration_anos_du252' },
    { key: 'pu_emissao', label: 'pu_emissao' },
    { key: 'pu_mercado', label: 'pu_mercado_atual' },
    { key: 'data_ultimo_negocio', label: 'data_ultimo_negocio_b3' },
    { key: 'dias_negociados_30d', label: 'dias_negociados_30d_b3' },
    { key: 'volume_emissao', label: 'volume_emissao_brl' },
    { key: 'quantidade_emitida', label: 'quantidade_emitida' },
    { key: 'data_emissao', label: 'data_emissao' },
    { key: 'vencimento', label: 'data_vencimento' },
    { key: 'emissao', label: 'numero_emissao' },
    { key: 'serie', label: 'numero_serie' },
    { key: 'isin', label: 'codigo_isin' },
    { key: 'rating_normalizado', label: 'rating_normalizado' },
    { key: 'rating_original', label: 'rating_original' },
    { key: 'rating_agencia', label: 'rating_agencia' },
    { key: 'rating_data', label: 'rating_data_divulgacao' },
    { key: 'cnpj_emissor', label: 'cnpj_emissor' },
    { key: 'agente_fiduciario', label: 'agente_fiduciario' },
    { key: 'coordenador_lider', label: 'coordenador_lider' },
    { key: 'fonte_precificacao', label: 'fonte_precificacao' },
    { key: 'ntnb_referencia', label: 'ntnb_referencia' }
  ]

  const headers = fieldOrder.map(f => f.label)
  const csv = [
    headers.join(','),
    ...rows.map(r =>
      fieldOrder.map(f => {
        let val = (r as any)[f.key]
        if (f.key === 'spread' && val != null) {
          const num = parseFloat(val)
          val = !isNaN(num) ? num.toFixed(6) : val
        }
        return `"${val ?? ''}"`
      }).join(',')
    )
  ].join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = `fixdata_credito_privado_${new Date().toISOString().slice(0, 10)}.csv`
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
  const [prices, setPrices] = useState<PriceRecord[]>([])
  const [spreadHistory, setSpreadHistory] = useState<SpreadHistoryRecord[]>([])
  const [b3Liquidity, setB3Liquidity] = useState<Record<string, { dias: number; last_date: string }>>({})
  const [loading, setLoading] = useState(true)

  const [tiposSel, setTiposSel] = useState<string[]>([])
  const [setoresSel, setSetoresSel] = useState<string[]>([])
  const [incentivadaSel, setIncentivadaSel] = useState<'ALL' | 'SIM' | 'NAO'>('ALL')
  const [rjSel, setRjSel] = useState<'ALL' | 'EXCLUIR_RJ' | 'APENAS_RJ'>('ALL')
  const [indexadoresSel, setIndexadoresSel] = useState<string[]>([])
  const [issuersSel, setIssuersSel] = useState<string[]>([])
  const [tickersSel, setTickersSel] = useState<string[]>([])
  const [ratingsSel, setRatingsSel] = useState<string[]>([])

  const [spreadMin, setSpreadMin] = useState<number | null>(null)
  const [spreadMax, setSpreadMax] = useState<number | null>(null)

  // Novos Filtros: Duration, Liquidez B3 e Data dos Negócios
  const [durationPreset, setDurationPreset] = useState<'ALL' | '<1' | '1-3' | '3-5' | '5-7' | '>7' | 'CUSTOM'>('ALL')
  const [durationMin, setDurationMin] = useState<number | null>(null)
  const [durationMax, setDurationMax] = useState<number | null>(null)

  const [bidAskFilter, setBidAskFilter] = useState<'ALL' | 'BID_ASK' | 'BID_ONLY' | 'ASK_ONLY'>('ALL')
  const [minDiasNegociados, setMinDiasNegociados] = useState<number>(0)

  const [tradeRecencyFilter, setTradeRecencyFilter] = useState<'ALL' | 'LATEST' | '3D' | '7D' | '15D' | '30D' | 'CUSTOM'>('ALL')
  const [tradeDateMin, setTradeDateMin] = useState<string>('')
  const [tradeDateMax, setTradeDateMax] = useState<string>('')

  const [spreadHistIdx, setSpreadHistIdx] = useState<'ALL' | 'IPCA' | 'DI+' | 'DI%' | 'PRE'>('ALL')
  const [tableSearch, setTableSearch] = useState('')

  /* ---------- Load CSVs & B3 Liquidity ---------- */

  useEffect(() => {
    Promise.all([
      fetchCSV<Asset>('./data/assets_master.csv'),
      fetchCSV<PriceRecord>('./data/prices.csv').catch(() => []),
      fetchCSV<SpreadHistoryRecord>('./data/spread_history.csv').catch(() => []),
      fetch('/data/b3_liquidity_summary.json').then(r => r.json()).catch(() => ({}))
    ])
      .then(([assetsData, pricesData, historyData, b3Data]) => {
        setAssets(assetsData || [])
        setPrices(pricesData || [])
        setSpreadHistory(historyData || [])
        setB3Liquidity(b3Data || {})
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
      .map(a => {
        const tKey = (a.ticker || '').trim().toUpperCase()
        const b3Info = b3Liquidity[tKey]
        const b3LastDate = b3Info?.last_date
        const effectiveLastDate = b3LastDate && (!a.data_ultimo_negocio || b3LastDate > a.data_ultimo_negocio)
          ? b3LastDate
          : a.data_ultimo_negocio
        const dias30d = b3Info?.dias || 0

        return {
          ...a,
          rating_normalizado: a.rating_normalizado || normalizeRating(a.rating),
          setor: normalizeSector(a.setor),
          data_ultimo_negocio: effectiveLastDate,
          dias_negociados_30d: dias30d
        }
      })
  }, [assets, b3Liquidity])

  /* ---------- Data Máxima de Negócio Disponível ---------- */

  const maxAvailableTradeDate = useMemo(() => {
    let maxD = ''
    for (const a of ativosVivosBase) {
      if (a.data_ultimo_negocio && a.data_ultimo_negocio > maxD) {
        maxD = a.data_ultimo_negocio
      }
    }
    return maxD || '2026-09-10'
  }, [ativosVivosBase])

  /* ---------- Options encadeadas ---------- */

  const tiposOptions = useMemo(
    () => unique(ativosVivosBase.map(a => a.tipo)),
    [ativosVivosBase]
  )

  const setoresOptions = useMemo(() => {
    let base = ativosVivosBase
    if (tiposSel.length) base = base.filter(a => tiposSel.includes(a.tipo || ''))
    if (indexadoresSel.length) base = base.filter(a => matchIndexador(a, indexadoresSel))
    const activeSectors = new Set(base.map(a => a.setor).filter(Boolean))
    return CANONICAL_SECTORS.filter(s => activeSectors.has(s))
  }, [ativosVivosBase, tiposSel, indexadoresSel])

  const indexadoresOptions = useMemo(() => {
    let base = ativosVivosBase
    if (tiposSel.length) base = base.filter(a => tiposSel.includes(a.tipo || ''))
    if (setoresSel.length) base = base.filter(a => setoresSel.includes(a.setor || ''))

    const rawSet = new Set<string>()
    base.forEach(a => {
      const norm = getAssetNormalizedIndexador(a)
      if (norm) rawSet.add(norm)
    })

    const PRIMARY_ORDER = ['IPCA', 'DI+', '%DI', 'Pré']
    const primaries = PRIMARY_ORDER.filter(p => rawSet.has(p))
    const others = Array.from(rawSet).filter(x => !PRIMARY_ORDER.includes(x)).sort()
    return [...primaries, ...others]
  }, [ativosVivosBase, tiposSel, setoresSel])

  const issuersOptions = useMemo(() => {
    let base = ativosVivosBase
    if (tiposSel.length) base = base.filter(a => tiposSel.includes(a.tipo || ''))
    if (setoresSel.length) base = base.filter(a => setoresSel.includes(a.setor || ''))
    if (indexadoresSel.length) base = base.filter(a => matchIndexador(a, indexadoresSel))
    return unique(base.map(a => a.issuer))
  }, [ativosVivosBase, tiposSel, setoresSel, indexadoresSel])

  const tickersOptions = useMemo(() => {
    let base = ativosVivosBase
    if (tiposSel.length) base = base.filter(a => tiposSel.includes(a.tipo || ''))
    if (setoresSel.length) base = base.filter(a => setoresSel.includes(a.setor || ''))
    if (indexadoresSel.length) base = base.filter(a => matchIndexador(a, indexadoresSel))
    if (issuersSel.length) base = base.filter(a => issuersSel.includes(a.issuer || ''))
    return unique(base.map(a => a.ticker))
  }, [ativosVivosBase, tiposSel, setoresSel, indexadoresSel, issuersSel])

  const ratingsOptions = useMemo(() => {
    let base = ativosVivosBase
    if (tiposSel.length) base = base.filter(a => tiposSel.includes(a.tipo || ''))
    if (setoresSel.length) base = base.filter(a => setoresSel.includes(a.setor || ''))
    if (indexadoresSel.length) base = base.filter(a => matchIndexador(a, indexadoresSel))
    if (issuersSel.length) base = base.filter(a => issuersSel.includes(a.issuer || ''))
    if (tickersSel.length) base = base.filter(a => tickersSel.includes(a.ticker))

    const existingRatings = unique(base.map(a => a.rating_normalizado || 'Sem Rating'))
    return RATING_SCALE_ORDER.filter(r => existingRatings.includes(r))
  }, [ativosVivosBase, tiposSel, setoresSel, indexadoresSel, issuersSel, tickersSel])

  /* ---------- Duration Helper ---------- */

  const durationYears = (a: Asset) => {
    const d = parseFloat(a.duration || '')
    return isNaN(d) || d <= 0 ? null : d
  }

  /* ---------- Filtered ---------- */

  const filteredAssets = useMemo(() => {
    let base = ativosVivosBase

    if (tiposSel.length)
      base = base.filter(a => tiposSel.includes(a.tipo || ''))

    if (setoresSel.length)
      base = base.filter(a => setoresSel.includes(a.setor || ''))

    if (incentivadaSel === 'SIM')
      base = base.filter(a => a.incentivada === 'Sim')

    if (incentivadaSel === 'NAO')
      base = base.filter(a => a.incentivada === 'Não')

    if (rjSel === 'EXCLUIR_RJ')
      base = base.filter(a => a.em_recuperacao_judicial !== 'Sim')

    if (rjSel === 'APENAS_RJ')
      base = base.filter(a => a.em_recuperacao_judicial === 'Sim')

    if (indexadoresSel.length) {
      base = base.filter(a => matchIndexador(a, indexadoresSel))
    }

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

    // Filtro de Duration
    if (durationMin !== null || durationMax !== null) {
      base = base.filter(a => {
        const d = durationYears(a)
        if (d === null) return false
        if (durationMin !== null && d < durationMin) return false
        if (durationMax !== null && d > durationMax) return false
        return true
      })
    }

    // Filtro de Liquidez B3: Cotações Firmes
    if (bidAskFilter === 'BID_ASK') {
      base = base.filter(a => {
        const c = parseFloat(a.taxa_compra || '')
        const v = parseFloat(a.taxa_venda || '')
        return !isNaN(c) && !isNaN(v) && c > 0 && v > 0
      })
    } else if (bidAskFilter === 'BID_ONLY') {
      base = base.filter(a => {
        const c = parseFloat(a.taxa_compra || '')
        return !isNaN(c) && c > 0
      })
    } else if (bidAskFilter === 'ASK_ONLY') {
      base = base.filter(a => {
        const v = parseFloat(a.taxa_venda || '')
        return !isNaN(v) && v > 0
      })
    }

    // Filtro de Liquidez B3: Dias Negociados (30D)
    if (minDiasNegociados > 0) {
      base = base.filter(a => (a.dias_negociados_30d || 0) >= minDiasNegociados)
    }

    // Filtro de Data dos Negócios
    if (tradeRecencyFilter !== 'ALL') {
      base = base.filter(a => {
        if (!a.data_ultimo_negocio) return false
        const d = a.data_ultimo_negocio
        if (tradeRecencyFilter === 'LATEST') {
          return d === maxAvailableTradeDate
        }
        if (tradeRecencyFilter === '3D') {
          return d >= subtractDaysFromIso(maxAvailableTradeDate, 3)
        }
        if (tradeRecencyFilter === '7D') {
          return d >= subtractDaysFromIso(maxAvailableTradeDate, 7)
        }
        if (tradeRecencyFilter === '15D') {
          return d >= subtractDaysFromIso(maxAvailableTradeDate, 15)
        }
        if (tradeRecencyFilter === '30D') {
          return d >= subtractDaysFromIso(maxAvailableTradeDate, 30)
        }
        if (tradeRecencyFilter === 'CUSTOM') {
          if (tradeDateMin && d < tradeDateMin) return false
          if (tradeDateMax && d > tradeDateMax) return false
          return true
        }
        return true
      })
    }

    return base
  }, [
    ativosVivosBase,
    tiposSel,
    setoresSel,
    incentivadaSel,
    rjSel,
    indexadoresSel,
    issuersSel,
    tickersSel,
    ratingsSel,
    spreadMin,
    spreadMax,
    durationMin,
    durationMax,
    bidAskFilter,
    minDiasNegociados,
    tradeRecencyFilter,
    tradeDateMin,
    tradeDateMax,
    maxAvailableTradeDate
  ])

  /* ---------- Metrics ---------- */

  const ativosVivos = filteredAssets.length

  const volumeVivo = useMemo(() => {
    return filteredAssets.reduce((s, a) => {
      const v = Number(a.volume_emissao || a.volume)
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
    return filteredAssets.filter(a => a.fonte_precificacao === 'ANBIMA Mercado' || a.taxa_mercado).length
  }, [filteredAssets])

  const totalIncentivados = useMemo(() => {
    return filteredAssets.filter(a => a.incentivada === 'Sim').length
  }, [filteredAssets])

  /* ---------- Pies ---------- */

  const pieIndexador = useMemo(() => {
    const counts: Record<string, number> = {}
    filteredAssets.forEach(a => {
      const idx = getAssetNormalizedIndexador(a) || 'Outros'
      counts[idx] = (counts[idx] || 0) + 1
    })
    return toTopPieData(counts, 5)
  }, [filteredAssets])

  const pieIssuer = useMemo(
    () => toTopPieData(countBy(filteredAssets, 'issuer'), 5),
    [filteredAssets]
  )

  const pieRating = useMemo(
    () => toTopPieData(countBy(filteredAssets, 'rating_normalizado'), 5),
    [filteredAssets]
  )

  /* ---------- Scatter ---------- */

  const [scatterViewIdx, setScatterViewIdx] = useState<string>('AUTO')

  const scatterData = useMemo(() => {
    return filteredAssets
      .map(a => {
        const x = durationYears(a)
        const spDisplay = getAssetSpreadDisplay(a)
        const normIdx = getAssetNormalizedIndexador(a)
        const y = spDisplay.rawValue

        if (x === null || y === null) return null

        return {
          x,
          y,
          spreadLabel: spDisplay.label,
          unit: spDisplay.unit,
          name: a.ticker,
          issuer: a.issuer,
          indexador: normIdx || a.indexador || 'Outros',
          tipo: a.tipo,
          incentivada: a.incentivada,
          rating: a.rating_normalizado || 'Sem Rating',
          fonte: a.fonte_precificacao || 'Duration Calculada'
        }
      })
      .filter(Boolean) as Array<{
        x: number
        y: number
        spreadLabel: string
        unit: 'bps' | '% a.a.' | '% CDI'
        name: string
        issuer?: string
        indexador: string
        tipo?: string
        incentivada?: string
        rating: string
        fonte: string
      }>
  }, [filteredAssets])

  const presentScatterIndexers = useMemo(() => {
    const set = new Set<string>()
    scatterData.forEach(d => {
      if (d.indexador) set.add(d.indexador)
    })
    const order = ['IPCA', 'DI+', '%DI', 'Pré']
    const primaries = order.filter(k => set.has(k))
    const others = Array.from(set).filter(k => !order.includes(k)).sort()
    return [...primaries, ...others]
  }, [scatterData])

  const displayedScatterPoints = useMemo(() => {
    if (scatterViewIdx !== 'AUTO' && scatterViewIdx !== 'ALL') {
      return scatterData.filter(d => d.indexador === scatterViewIdx)
    }
    return scatterData
  }, [scatterData, scatterViewIdx])

  const scatterBySeries = useMemo(() => {
    const groups: { [key: string]: typeof scatterData } = {
      'IPCA': [],
      'DI+': [],
      '%DI': [],
      'Pré': [],
      'Outros': []
    }
    displayedScatterPoints.forEach(p => {
      if (groups[p.indexador]) {
        groups[p.indexador].push(p)
      } else {
        groups['Outros'].push(p)
      }
    })
    return groups
  }, [displayedScatterPoints])

  const yAxisConfig = useMemo(() => {
    const effectiveView = (scatterViewIdx !== 'AUTO' && scatterViewIdx !== 'ALL')
      ? scatterViewIdx
      : (presentScatterIndexers.length === 1 ? presentScatterIndexers[0] : 'ALL')

    if (effectiveView === 'DI+') {
      return {
        label: 'Taxa / Spread CDI+ (% a.a.)',
        unit: '% a.a.',
        domain: [0, 'auto'] as [number, string]
      }
    }
    if (effectiveView === '%DI') {
      return {
        label: 'Taxa (% do CDI)',
        unit: '% CDI',
        domain: ['dataMin - 2', 'dataMax + 2'] as [string, string]
      }
    }
    if (effectiveView === 'IPCA') {
      return {
        label: 'Spread Over Soberano NTN-B (bps)',
        unit: 'bps',
        domain: ['auto', 'auto'] as [string, string]
      }
    }
    if (effectiveView === 'Pré') {
      return {
        label: 'Spread Over Curva DI B3 (bps)',
        unit: 'bps',
        domain: ['auto', 'auto'] as [string, string]
      }
    }
    return {
      label: 'Taxa / Spread (bps / % a.a. / % CDI)',
      unit: 'misto',
      domain: ['auto', 'auto'] as [string, string]
    }
  }, [scatterViewIdx, presentScatterIndexers])

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

  const hasActiveFilters = useMemo(() => {
    return (
      tiposSel.length > 0 ||
      setoresSel.length > 0 ||
      incentivadaSel !== 'ALL' ||
      rjSel !== 'ALL' ||
      indexadoresSel.length > 0 ||
      issuersSel.length > 0 ||
      tickersSel.length > 0 ||
      ratingsSel.length > 0 ||
      spreadMin !== null ||
      spreadMax !== null ||
      durationPreset !== 'ALL' ||
      durationMin !== null ||
      durationMax !== null ||
      bidAskFilter !== 'ALL' ||
      minDiasNegociados > 0 ||
      tradeRecencyFilter !== 'ALL' ||
      tradeDateMin !== '' ||
      tradeDateMax !== ''
    )
  }, [
    tiposSel,
    setoresSel,
    incentivadaSel,
    rjSel,
    indexadoresSel,
    issuersSel,
    tickersSel,
    ratingsSel,
    spreadMin,
    spreadMax,
    durationPreset,
    durationMin,
    durationMax,
    bidAskFilter,
    minDiasNegociados,
    tradeRecencyFilter,
    tradeDateMin,
    tradeDateMax
  ])

  const filteredTickerSet = useMemo(() => {
    return new Set(filteredAssets.map(a => a.ticker))
  }, [filteredAssets])

  const formattedSpreadHistory = useMemo(() => {
    if (!spreadHistory.length) return []

    const dateMap: Record<
      string,
      {
        date: string
        datePretty: string
        ipca?: number
        di?: number
        diRate?: number
        diPercent?: number
        pre?: number
      }
    > = {}

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
      const tm = parseFloat(h.taxa_media || '')
      if (!isNaN(val)) {
        const norm = normalizeIndexador(h.indexador)
        if (norm === 'IPCA') dateMap[h.date].ipca = Math.round(val)
        else if (norm === 'DI+') {
          dateMap[h.date].di = Math.round(val)
          dateMap[h.date].diRate = Number((val / 100).toFixed(2))
        }
        else if (norm === '%DI') {
          dateMap[h.date].diPercent = !isNaN(tm) && tm > 50 ? Number(tm.toFixed(2)) : Number((100 + val / 100).toFixed(2))
        }
        else if (norm === 'Pré') dateMap[h.date].pre = Math.round(val)
      }
    })

    return Object.values(dateMap).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }, [spreadHistory])

  const dynamicSpreadHistory = useMemo(() => {
    if (!hasActiveFilters || !prices.length) {
      return formattedSpreadHistory
    }

    const dateMap: Record<
      string,
      {
        date: string
        datePretty: string
        ipcaValues: number[]
        diValues: number[]
        diPercentValues: number[]
        preValues: number[]
      }
    > = {}

    const tickerIndexadorMap = new Map<string, string>()
    filteredAssets.forEach(a => {
      tickerIndexadorMap.set(a.ticker, a.indexador || '')
    })

    prices.forEach(p => {
      if (!p.date || !p.ticker || !filteredTickerSet.has(p.ticker)) return
      const sp = parseFloat(String(p.spread_over_ref || ''))
      if (isNaN(sp)) return

      const rawIdx = tickerIndexadorMap.get(p.ticker) || ''
      const norm = normalizeIndexador(rawIdx)

      if (!dateMap[p.date]) {
        const parts = p.date.split('-')
        dateMap[p.date] = {
          date: p.date,
          datePretty: parts.length === 3 ? `${parts[2]}/${parts[1]}` : p.date,
          ipcaValues: [],
          diValues: [],
          diPercentValues: [],
          preValues: []
        }
      }

      if (norm === 'IPCA') {
        dateMap[p.date].ipcaValues.push(sp)
      } else if (norm === 'DI+') {
        dateMap[p.date].diValues.push(sp)
      } else if (norm === '%DI') {
        const yld = parseFloat(String(p.yield || ''))
        dateMap[p.date].diPercentValues.push(!isNaN(yld) && yld > 50 ? yld : (100 + sp / 100))
      } else if (norm === 'Pré') {
        dateMap[p.date].preValues.push(sp)
      }
    })

    const median = (arr: number[]) => {
      if (!arr.length) return undefined
      const sorted = [...arr].sort((a, b) => a - b)
      const mid = Math.floor(sorted.length / 2)
      return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
    }

    const result = Object.values(dateMap)
      .map(d => {
        const ipcaMed = d.ipcaValues.length ? Math.round(median(d.ipcaValues)!) : undefined
        const diMedBps = d.diValues.length ? Math.round(median(d.diValues)!) : undefined
        const diPercentMed = d.diPercentValues.length ? Number(median(d.diPercentValues)!.toFixed(2)) : undefined
        const preMed = d.preValues.length ? Math.round(median(d.preValues)!) : undefined

        return {
          date: d.date,
          datePretty: d.datePretty,
          ipca: ipcaMed,
          di: diMedBps,
          diRate: diMedBps !== undefined ? Number((diMedBps / 100).toFixed(2)) : undefined,
          diPercent: diPercentMed,
          pre: preMed
        }
      })
      .filter(d => d.ipca !== undefined || d.di !== undefined || d.diPercent !== undefined || d.pre !== undefined)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    return result
  }, [hasActiveFilters, prices, filteredTickerSet, filteredAssets, formattedSpreadHistory])

  /* ---------- Curvas Ativas no Gráfico de Spread Histórico ---------- */

  const { showIpcaCurve, showDiCurve, showDiPercentCurve, showPreCurve } = useMemo(() => {
    // 1. Filtro explícito de indexador via multiselect
    if (indexadoresSel.length > 0) {
      return {
        showIpcaCurve: indexadoresSel.some(s => normalizeIndexador(s) === 'IPCA'),
        showDiCurve: indexadoresSel.some(s => normalizeIndexador(s) === 'DI+'),
        showDiPercentCurve: indexadoresSel.some(s => normalizeIndexador(s) === '%DI'),
        showPreCurve: indexadoresSel.some(s => normalizeIndexador(s) === 'Pré')
      }
    }

    // 2. Filtro rápido de indexador selecionado no gráfico (spreadHistIdx)
    if (spreadHistIdx !== 'ALL') {
      return {
        showIpcaCurve: spreadHistIdx === 'IPCA',
        showDiCurve: spreadHistIdx === 'DI+',
        showDiPercentCurve: spreadHistIdx === 'DI%',
        showPreCurve: spreadHistIdx === 'PRE'
      }
    }

    // 3. spreadHistIdx === 'ALL' e sem indexadoresSel:
    // Se outros filtros estiverem ativos (ex: emissor ou setor), exibir apenas os indexadores presentes nos ativos filtrados
    if (hasActiveFilters) {
      const activeIdxs = new Set<string>()
      filteredAssets.forEach(a => {
        const norm = normalizeIndexador(a.indexador)
        if (norm) activeIdxs.add(norm)
      })
      return {
        showIpcaCurve: activeIdxs.has('IPCA'),
        showDiCurve: activeIdxs.has('DI+'),
        showDiPercentCurve: activeIdxs.has('%DI'),
        showPreCurve: activeIdxs.has('Pré')
      }
    }

    // 4. Sem nenhum filtro: exibir todas as 4 curvas separadas do mercado
    return {
      showIpcaCurve: true,
      showDiCurve: true,
      showDiPercentCurve: true,
      showPreCurve: true
    }
  }, [indexadoresSel, spreadHistIdx, hasActiveFilters, filteredAssets])

  const hasAnyVisibleCurve = showIpcaCurve || showDiCurve || showDiPercentCurve || showPreCurve

  const isOnlyDiPlus = showDiCurve && !showIpcaCurve && !showPreCurve && !showDiPercentCurve
  const isOnlyDiPercent = showDiPercentCurve && !showIpcaCurve && !showPreCurve && !showDiCurve
  const isOnlyIpca = showIpcaCurve && !showDiCurve && !showDiPercentCurve && !showPreCurve
  const isOnlyPre = showPreCurve && !showDiCurve && !showDiPercentCurve && !showIpcaCurve

  const chartTitle = isOnlyDiPlus
    ? 'Evolução Histórica da Taxa DI+ (CDI + % a.a.)'
    : isOnlyDiPercent
    ? 'Evolução Histórica da Taxa %DI (% do CDI)'
    : isOnlyIpca
    ? 'Evolução Histórica do Spread Over NTN-B (bps)'
    : isOnlyPre
    ? 'Evolução Histórica do Spread Over DI Futuro (bps)'
    : 'Evolução Histórica das Taxas e Spreads de Mercado'

  const chartSubtitle = hasActiveFilters
    ? `Série temporal recalculada dinamicamente para os ${filteredAssets.length} ativos selecionados.`
    : isOnlyDiPlus
    ? 'Acompanhamento do spread pós-fixado sobre o CDI (% ao ano).'
    : isOnlyDiPercent
    ? 'Acompanhamento da taxa média negociada no mercado secundário (% do CDI).'
    : isOnlyIpca
    ? 'Prêmio de crédito corporativo sobre a taxa soberana da NTN-B correspondente (bps).'
    : isOnlyPre
    ? 'Prêmio de crédito corporativo sobre a curva soberana de DI Futuro B3 (bps).'
    : 'Acompanhamento temporal dos prêmios de crédito e taxas de mercado secundário (ANBIMA / B3).'

  const yAxisUnit = isOnlyDiPlus
    ? '% a.a.'
    : isOnlyDiPercent
    ? '% do CDI'
    : isOnlyIpca || isOnlyPre
    ? ' bps'
    : ''

  /* ---------- Tabela Filtrada com Busca ---------- */

  const displayTableAssets = useMemo(() => {
    if (!tableSearch.trim()) return filteredAssets
    const q = tableSearch.toLowerCase().trim()
    return filteredAssets.filter(a =>
      (a.ticker && a.ticker.toLowerCase().includes(q)) ||
      (a.issuer && a.issuer.toLowerCase().includes(q)) ||
      (a.setor && a.setor.toLowerCase().includes(q)) ||
      (a.isin && a.isin.toLowerCase().includes(q)) ||
      (a.indexador && a.indexador.toLowerCase().includes(q))
    )
  }, [filteredAssets, tableSearch])

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
            Visão consolidada de spreads over, durations calculadas (DU/252), debêntures incentivadas (Lei 12.431), recuperação judicial e cotações secundárias.
          </p>
        </div>
      </div>

      {/* FILTROS */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Filtros Dinâmicos</h3>
          {hasActiveFilters && (
            <button
              onClick={() => {
                setTiposSel([])
                setSetoresSel([])
                setIncentivadaSel('ALL')
                setRjSel('ALL')
                setSpreadHistIdx('ALL')
                setIndexadoresSel([])
                setIssuersSel([])
                setTickersSel([])
                setRatingsSel([])
                setSpreadMin(null)
                setSpreadMax(null)
                setDurationPreset('ALL')
                setDurationMin(null)
                setDurationMax(null)
                setBidAskFilter('ALL')
                setMinDiasNegociados(0)
                setTradeRecencyFilter('ALL')
                setTradeDateMin('')
                setTradeDateMax('')
              }}
              className="text-xs text-blue-600 font-bold hover:underline"
            >
              Limpar todos os filtros
            </button>
          )}
        </div>

        {/* Linha 1: MultiSelects */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <SearchMultiSelect
            label="Tipo de Ativo"
            options={tiposOptions}
            selected={tiposSel}
            onChange={setTiposSel}
          />
          <SearchMultiSelect
            label="Setor (ANBIMA)"
            options={setoresOptions}
            selected={setoresSel}
            onChange={setSetoresSel}
          />
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
            label="Rating (Normalizado)"
            options={ratingsOptions}
            selected={ratingsSel}
            onChange={setRatingsSel}
          />
          <SearchMultiSelect
            label="Tickers"
            options={tickersOptions}
            selected={tickersSel}
            onChange={setTickersSel}
          />
        </div>

        {/* Linha 2: Indexador Rápido, Incentivada (Lei 12.431), Recuperação Judicial e Faixas de Spread */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-4">
            {/* Filtro Rápido de Indexador */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Indexador:
              </span>
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
                <button
                  onClick={() => {
                    setSpreadHistIdx('ALL')
                    setIndexadoresSel([])
                  }}
                  className={`px-3 py-1 rounded-lg transition ${
                    spreadHistIdx === 'ALL' && indexadoresSel.length === 0
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Todos
                </button>
                <button
                  onClick={() => {
                    setSpreadHistIdx('IPCA')
                    setIndexadoresSel(['IPCA'])
                  }}
                  className={`px-3 py-1 rounded-lg transition ${
                    spreadHistIdx === 'IPCA' || (indexadoresSel.length === 1 && indexadoresSel[0] === 'IPCA')
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  IPCA
                </button>
                <button
                  onClick={() => {
                    setSpreadHistIdx('DI+')
                    setIndexadoresSel(['DI+'])
                  }}
                  className={`px-3 py-1 rounded-lg transition ${
                    spreadHistIdx === 'DI+' || (indexadoresSel.length === 1 && indexadoresSel[0] === 'DI+')
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  DI+
                </button>
                <button
                  onClick={() => {
                    setSpreadHistIdx('DI%')
                    setIndexadoresSel(['%DI'])
                  }}
                  className={`px-3 py-1 rounded-lg transition ${
                    spreadHistIdx === 'DI%' || (indexadoresSel.length === 1 && (indexadoresSel[0] === '%DI' || indexadoresSel[0] === 'DI%'))
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  %DI
                </button>
                <button
                  onClick={() => {
                    setSpreadHistIdx('PRE')
                    setIndexadoresSel(['Pré'])
                  }}
                  className={`px-3 py-1 rounded-lg transition ${
                    spreadHistIdx === 'PRE' || (indexadoresSel.length === 1 && (indexadoresSel[0] === 'Pré' || indexadoresSel[0] === 'PRE'))
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Pré
                </button>
              </div>
            </div>

            {/* Filtro Incentivadas */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Incentivadas:
              </span>
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
                <button
                  onClick={() => setIncentivadaSel('ALL')}
                  className={`px-3 py-1 rounded-lg transition ${
                    incentivadaSel === 'ALL' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Todos
                </button>
                <button
                  onClick={() => setIncentivadaSel('SIM')}
                  className={`px-3 py-1 rounded-lg transition flex items-center gap-1 ${
                    incentivadaSel === 'SIM' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>⚡ 12.431 / Isentos</span>
                </button>
                <button
                  onClick={() => setIncentivadaSel('NAO')}
                  className={`px-3 py-1 rounded-lg transition ${
                    incentivadaSel === 'NAO' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Comuns
                </button>
              </div>
            </div>

            {/* Filtro Recuperação Judicial */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Recuperação Judicial:
              </span>
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
                <button
                  onClick={() => setRjSel('ALL')}
                  className={`px-3 py-1 rounded-lg transition ${
                    rjSel === 'ALL' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Todos
                </button>
                <button
                  onClick={() => setRjSel('EXCLUIR_RJ')}
                  className={`px-3 py-1 rounded-lg transition flex items-center gap-1 ${
                    rjSel === 'EXCLUIR_RJ' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Oculta títulos de devedores que estão em recuperação judicial ou falência"
                >
                  <span>🛡️ Excluir em RJ</span>
                </button>
                <button
                  onClick={() => setRjSel('APENAS_RJ')}
                  className={`px-3 py-1 rounded-lg transition flex items-center gap-1 ${
                    rjSel === 'APENAS_RJ' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Filtra apenas títulos distressed sob regime de recuperação judicial"
                >
                  <span>⚠️ Apenas em RJ</span>
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <span>Spread / Taxa:</span>
            <input
              type="number"
              placeholder="Min"
              value={spreadMin ?? ''}
              onChange={e => setSpreadMin(e.target.value === '' ? null : Number(e.target.value))}
              className="border border-slate-300 rounded-lg px-2.5 py-1 w-20 text-xs bg-slate-50 focus:bg-white"
            />
            <span>até</span>
            <input
              type="number"
              placeholder="Max"
              value={spreadMax ?? ''}
              onChange={e => setSpreadMax(e.target.value === '' ? null : Number(e.target.value))}
              className="border border-slate-300 rounded-lg px-2.5 py-1 w-20 text-xs bg-slate-50 focus:bg-white"
            />
          </div>
        </div>

        {/* Linha 3: Filtros Quantitativos de Crédito (Duration, Liquidez B3 e Data dos Negócios) */}
        <div className="pt-3 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Filtro Duration */}
          <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-200/70 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Clock size={13} className="text-blue-600" />
                Duration (anos DU/252)
              </span>
              {(durationMin !== null || durationMax !== null || durationPreset !== 'ALL') && (
                <button
                  onClick={() => {
                    setDurationPreset('ALL')
                    setDurationMin(null)
                    setDurationMax(null)
                  }}
                  className="text-[10px] text-blue-600 hover:underline font-bold"
                >
                  Limpar
                </button>
              )}
            </div>
            {/* Presets */}
            <div className="flex flex-wrap items-center gap-1 bg-white p-1 rounded-lg border border-slate-200/60 text-xs font-semibold">
              {[
                { id: 'ALL', label: 'Todos', min: null, max: null },
                { id: '<1', label: '< 1a', min: null, max: 1 },
                { id: '1-3', label: '1-3a', min: 1, max: 3 },
                { id: '3-5', label: '3-5a', min: 3, max: 5 },
                { id: '5-7', label: '5-7a', min: 5, max: 7 },
                { id: '>7', label: '> 7a', min: 7, max: null }
              ].map(p => (
                <button
                  key={p.id}
                  onClick={() => {
                    setDurationPreset(p.id as any)
                    setDurationMin(p.min)
                    setDurationMax(p.max)
                  }}
                  className={`px-2 py-1 rounded-md text-[11px] transition ${
                    durationPreset === p.id
                      ? 'bg-blue-600 text-white shadow-xs font-bold'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {/* Min / Max inputs */}
            <div className="flex items-center gap-2 text-xs text-slate-600 pt-0.5">
              <span className="text-[11px] font-medium">Faixa:</span>
              <input
                type="number"
                step="0.5"
                placeholder="Min"
                value={durationMin ?? ''}
                onChange={e => {
                  setDurationPreset('CUSTOM')
                  setDurationMin(e.target.value === '' ? null : Number(e.target.value))
                }}
                className="border border-slate-200 rounded-lg px-2 py-0.5 w-16 text-xs bg-white focus:ring-1 focus:ring-blue-500 outline-none"
              />
              <span className="text-[11px]">até</span>
              <input
                type="number"
                step="0.5"
                placeholder="Max"
                value={durationMax ?? ''}
                onChange={e => {
                  setDurationPreset('CUSTOM')
                  setDurationMax(e.target.value === '' ? null : Number(e.target.value))
                }}
                className="border border-slate-200 rounded-lg px-2 py-0.5 w-16 text-xs bg-white focus:ring-1 focus:ring-blue-500 outline-none"
              />
              <span className="text-[11px] text-slate-400">anos</span>
            </div>
          </div>

          {/* Filtro Liquidez & Cotações (ANBIMA Compra/Venda & B3 Dias Negociados) */}
          <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-200/70 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Droplets size={13} className="text-emerald-600" />
                Liquidez & Cotações
              </span>
              {(bidAskFilter !== 'ALL' || minDiasNegociados > 0) && (
                <button
                  onClick={() => {
                    setBidAskFilter('ALL')
                    setMinDiasNegociados(0)
                  }}
                  className="text-[10px] text-blue-600 hover:underline font-bold"
                >
                  Limpar
                </button>
              )}
            </div>
            {/* Cotação Firme Bid/Ask ANBIMA */}
            <div className="space-y-1">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider" title="Taxas de Compra (Bid) e Venda (Ask) informadas pelos formadores de mercado à ANBIMA">
                Cotações ANBIMA (Bid / Ask Firme):
              </div>
              <div className="flex flex-wrap items-center gap-1 bg-white p-1 rounded-lg border border-slate-200/60 text-xs font-semibold">
                {[
                  { id: 'ALL', label: 'Todas' },
                  { id: 'BID_ASK', label: 'Bid & Ask' },
                  { id: 'BID_ONLY', label: 'Apenas Bid' },
                  { id: 'ASK_ONLY', label: 'Apenas Ask' }
                ].map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => setBidAskFilter(opt.id as any)}
                    className={`px-2 py-1 rounded-md text-[11px] transition ${
                      bidAskFilter === opt.id
                        ? 'bg-emerald-600 text-white shadow-xs font-bold'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            {/* Frequência B3 (Dias Negociados em 30 Pregões) */}
            <div className="space-y-1 pt-0.5">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider" title="Frequência de pregões com negócios executados na B3 nos últimos 30 dias úteis">
                Negociação B3 (Últimos 30 pregões):
              </div>
              <div className="flex flex-wrap items-center gap-1 bg-white p-1 rounded-lg border border-slate-200/60 text-xs font-semibold">
                {[
                  { val: 0, label: 'Todos' },
                  { val: 1, label: '≥ 1d' },
                  { val: 5, label: '≥ 5d' },
                  { val: 10, label: '≥ 10d' },
                  { val: 15, label: '≥ 15d' },
                  { val: 20, label: '≥ 20d' }
                ].map(opt => (
                  <button
                    key={opt.val}
                    onClick={() => setMinDiasNegociados(opt.val)}
                    className={`px-2 py-0.5 rounded-md text-[11px] transition ${
                      minDiasNegociados === opt.val
                        ? 'bg-emerald-600 text-white shadow-xs font-bold'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Filtro Data dos Negócios */}
          <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-200/70 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar size={13} className="text-indigo-600" />
                Data dos Negócios (Recência)
              </span>
              {(tradeRecencyFilter !== 'ALL' || tradeDateMin !== '' || tradeDateMax !== '') && (
                <button
                  onClick={() => {
                    setTradeRecencyFilter('ALL')
                    setTradeDateMin('')
                    setTradeDateMax('')
                  }}
                  className="text-[10px] text-blue-600 hover:underline font-bold"
                >
                  Limpar
                </button>
              )}
            </div>
            {/* Presets de Recência */}
            <div className="flex flex-wrap items-center gap-1 bg-white p-1 rounded-lg border border-slate-200/60 text-xs font-semibold">
              {[
                { id: 'ALL', label: 'Todas' },
                { id: 'LATEST', label: `Último Pregão (${formatDateBr(maxAvailableTradeDate).slice(0, 5)})` },
                { id: '3D', label: '3 Dias' },
                { id: '7D', label: '7 Dias' },
                { id: '15D', label: '15 Dias' },
                { id: '30D', label: '30 Dias' },
                { id: 'CUSTOM', label: 'Personalizado' }
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setTradeRecencyFilter(opt.id as any)}
                  className={`px-2 py-1 rounded-md text-[11px] transition ${
                    tradeRecencyFilter === opt.id
                      ? 'bg-indigo-600 text-white shadow-xs font-bold'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {/* Custom Date Range if selected */}
            {tradeRecencyFilter === 'CUSTOM' ? (
              <div className="flex items-center gap-1.5 text-xs text-slate-600 pt-0.5">
                <span className="text-[11px]">De:</span>
                <input
                  type="date"
                  value={tradeDateMin}
                  onChange={e => setTradeDateMin(e.target.value)}
                  className="border border-slate-200 rounded-lg px-2 py-0.5 text-[11px] bg-white focus:ring-1 focus:ring-indigo-500 outline-none"
                />
                <span className="text-[11px]">Até:</span>
                <input
                  type="date"
                  value={tradeDateMax}
                  onChange={e => setTradeDateMax(e.target.value)}
                  className="border border-slate-200 rounded-lg px-2 py-0.5 text-[11px] bg-white focus:ring-1 focus:ring-indigo-500 outline-none"
                />
              </div>
            ) : (
              <p className="text-[11px] text-slate-500 pt-0.5">
                {tradeRecencyFilter === 'LATEST'
                  ? `Mostrando ativos negociados no último pregão (${formatDateBr(maxAvailableTradeDate)}).`
                  : tradeRecencyFilter === '3D'
                  ? `Negociação registrada nos últimos 3 dias corridos (desde ${formatDateBr(subtractDaysFromIso(maxAvailableTradeDate, 3))}).`
                  : tradeRecencyFilter === '7D'
                  ? `Negociação na última semana (desde ${formatDateBr(subtractDaysFromIso(maxAvailableTradeDate, 7))}).`
                  : tradeRecencyFilter === '15D'
                  ? `Negociação na quinzena (desde ${formatDateBr(subtractDaysFromIso(maxAvailableTradeDate, 15))}).`
                  : tradeRecencyFilter === '30D'
                  ? `Negociação no último mês (desde ${formatDateBr(subtractDaysFromIso(maxAvailableTradeDate, 30))}).`
                  : 'Filtre por proximidade temporal para comparar ativos sob as mesmas condições macroeconômicas de juros.'}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* KPIS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KPIBox
          title="Ativos Vivos"
          value={ativosVivos.toLocaleString('pt-BR')}
          subtitle={`Total filtrado`}
          icon={TrendingUp}
        />
        <KPIBox
          title="Incentivados (12.431)"
          value={totalIncentivados.toLocaleString('pt-BR')}
          subtitle={`${Math.round((totalIncentivados / (ativosVivos || 1)) * 100)}% dos ativos`}
          icon={ShieldCheck}
        />
        <KPIBox
          title="Volume Emitido"
          value={`R$ ${(volumeVivo / 1e9).toFixed(1)}B`}
          subtitle="Volume total emitido"
          icon={Database}
        />
        <KPIBox
          title="Duration Média"
          value={`${durationMedia.toFixed(2)}a`}
          subtitle="Média ponderada DU/252"
          icon={Clock}
        />
        <KPIBox
          title="Com Preço Mercado"
          value={totalComPrecoMercado.toLocaleString('pt-BR')}
          subtitle={`${Math.round((totalComPrecoMercado / (ativosVivos || 1)) * 100)}% com taxa secundária`}
          icon={Activity}
        />
      </div>

      {/* ================= HISTÓRICO DE SPREAD OVER NO TEMPO ================= */}
      {dynamicSpreadHistory.length > 0 && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <BarChart3 className="text-blue-600" size={20} />
                  {chartTitle}
                </h2>
                {hasActiveFilters && (
                  <span className="text-[11px] font-extrabold px-2 py-0.5 bg-blue-100 text-blue-800 rounded-md">
                    Filtro Ativo ({filteredAssets.length} ativos)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {chartSubtitle}
              </p>
            </div>

            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-bold overflow-x-auto max-w-full">
              <button
                onClick={() => {
                  setSpreadHistIdx('ALL')
                  setIndexadoresSel([])
                }}
                className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap ${
                  spreadHistIdx === 'ALL' && indexadoresSel.length === 0 ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => {
                  setSpreadHistIdx('IPCA')
                  setIndexadoresSel(['IPCA'])
                }}
                className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap ${
                  spreadHistIdx === 'IPCA' || (indexadoresSel.length === 1 && indexadoresSel[0] === 'IPCA') ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                IPCA (vs NTN-B)
              </button>
              <button
                onClick={() => {
                  setSpreadHistIdx('DI+')
                  setIndexadoresSel(['DI+'])
                }}
                className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap ${
                  spreadHistIdx === 'DI+' || (indexadoresSel.length === 1 && indexadoresSel[0] === 'DI+') ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                DI+ (sobre CDI)
              </button>
              <button
                onClick={() => {
                  setSpreadHistIdx('DI%')
                  setIndexadoresSel(['%DI'])
                }}
                className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap ${
                  spreadHistIdx === 'DI%' || (indexadoresSel.length === 1 && (indexadoresSel[0] === '%DI' || indexadoresSel[0] === 'DI%')) ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                %DI (% do CDI)
              </button>
              <button
                onClick={() => {
                  setSpreadHistIdx('PRE')
                  setIndexadoresSel(['Pré'])
                }}
                className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap ${
                  spreadHistIdx === 'PRE' || (indexadoresSel.length === 1 && (indexadoresSel[0] === 'Pré' || indexadoresSel[0] === 'PRE')) ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Pré (Taxa Pré)
              </button>
            </div>
          </div>

          {dynamicSpreadHistory.length === 0 || !hasAnyVisibleCurve ? (
            <div className="h-72 flex flex-col items-center justify-center text-slate-400 text-sm gap-2">
              <BarChart3 size={32} className="text-slate-300" />
              <span>Nenhum histórico de spread disponível para a seleção atual.</span>
            </div>
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dynamicSpreadHistory} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorIpca" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="colorDi" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="colorDiPercent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="colorPre" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="datePretty" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} unit={yAxisUnit} domain={['auto', 'auto']} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload
                        return (
                          <div className="bg-slate-900 text-white p-3 rounded-xl shadow-lg text-xs space-y-1.5 border border-slate-700">
                            <p className="font-semibold text-slate-300">Data: {d.date}</p>
                            {showIpcaCurve && d.ipca !== undefined && (
                              <p className="text-blue-300 font-bold">
                                Spread IPCA: {d.ipca >= 0 ? `+${d.ipca}` : d.ipca} bps ({d.ipca >= 0 ? `+${(d.ipca / 100).toFixed(2)}` : (d.ipca / 100).toFixed(2)}%)
                              </p>
                            )}
                            {showDiCurve && (d.diRate !== undefined || d.di !== undefined) && (
                              <p className="text-emerald-300 font-bold">
                                Taxa DI+: CDI +{(d.diRate ?? (d.di ? d.di / 100 : 0)).toFixed(2)}% a.a.
                              </p>
                            )}
                            {showDiPercentCurve && d.diPercent !== undefined && (
                              <p className="text-purple-300 font-bold">
                                Taxa %DI: {d.diPercent.toFixed(2)}% do CDI
                              </p>
                            )}
                            {showPreCurve && d.pre !== undefined && (
                              <p className="text-amber-300 font-bold">
                                Spread Pré: {d.pre >= 0 ? `+${d.pre}` : d.pre} bps ({d.pre >= 0 ? `+${(d.pre / 100).toFixed(2)}` : (d.pre / 100).toFixed(2)}%)
                              </p>
                            )}
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Legend />
                  {showIpcaCurve && (
                    <Area
                      type="monotone"
                      dataKey="ipca"
                      name="Spread IPCA vs NTN-B (bps)"
                      stroke="#2563eb"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#colorIpca)"
                      connectNulls
                    />
                  )}
                  {showDiCurve && (
                    <Area
                      type="monotone"
                      dataKey={isOnlyDiPlus ? "diRate" : "di"}
                      name="Taxa DI+ sobre CDI (% a.a.)"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#colorDi)"
                      connectNulls
                    />
                  )}
                  {showDiPercentCurve && (
                    <Area
                      type="monotone"
                      dataKey="diPercent"
                      name="Taxa %DI (% do CDI)"
                      stroke="#8b5cf6"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#colorDiPercent)"
                      connectNulls
                    />
                  )}
                  {showPreCurve && (
                    <Area
                      type="monotone"
                      dataKey="pre"
                      name="Spread Pré sobre DI Futuro (bps)"
                      stroke="#f59e0b"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#colorPre)"
                      connectNulls
                    />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* PIE CHARTS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <PieBox title="Indexador" subtitle="Top 5 + Outros" data={pieIndexador} />
        <PieBox title="Emissores Mais Concentrados" subtitle="Top 5 + Outros" data={pieIssuer} />
        <PieBox title="Ratings Mais Frequentes" subtitle="Top 5 + Outros" data={pieRating} />
      </div>

      {/* SCATTER PLOT */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm min-h-[560px] flex flex-col">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
          <div>
            <h2 className="font-bold text-slate-900 text-lg">
              Dispersão: Spread Over x Duration (anos)
            </h2>
            <p className="text-xs text-slate-500">
              Relação de prazo médio ponderado e retorno. {displayedScatterPoints.length} ativos plotados.
            </p>
          </div>

          {/* Quick toggle if multiple indexers are present */}
          {presentScatterIndexers.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-semibold self-start md:self-auto">
              <button
                type="button"
                onClick={() => setScatterViewIdx('ALL')}
                className={`px-2.5 py-1 rounded-lg transition text-xs font-bold ${
                  (scatterViewIdx === 'ALL' || scatterViewIdx === 'AUTO')
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Todos ({scatterData.length})
              </button>
              {presentScatterIndexers.map(idx => {
                const count = scatterData.filter(d => d.indexador === idx).length
                const isSelected = scatterViewIdx === idx
                const colorClass =
                  idx === 'DI+' ? (isSelected ? 'bg-emerald-600 text-white shadow-sm' : 'text-emerald-700 hover:bg-emerald-50') :
                  idx === '%DI' ? (isSelected ? 'bg-purple-600 text-white shadow-sm' : 'text-purple-700 hover:bg-purple-50') :
                  idx === 'IPCA' ? (isSelected ? 'bg-blue-600 text-white shadow-sm' : 'text-blue-700 hover:bg-blue-50') :
                  (isSelected ? 'bg-amber-600 text-white shadow-sm' : 'text-amber-700 hover:bg-amber-50')

                const labelUnit =
                  idx === 'DI+' ? 'DI+ (% a.a.)' :
                  idx === '%DI' ? '%DI (% CDI)' :
                  idx === 'IPCA' ? 'IPCA (bps)' :
                  idx === 'Pré' ? 'Pré (bps)' : idx

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setScatterViewIdx(idx)}
                    className={`px-2.5 py-1 rounded-lg transition text-xs font-bold ${colorClass}`}
                  >
                    {labelUnit} ({count})
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="flex-1 min-h-[380px]">
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
                domain={yAxisConfig.domain}
                label={{
                  value: yAxisConfig.label,
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

                  const badgeColor =
                    p.indexador === 'DI+' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' :
                    p.indexador === '%DI' ? 'bg-purple-500/20 text-purple-400 border-purple-500/40' :
                    p.indexador === 'IPCA' ? 'bg-blue-500/20 text-blue-400 border-blue-500/40' :
                    p.indexador === 'Pré' ? 'bg-amber-500/20 text-amber-400 border-amber-500/40' :
                    'bg-slate-700 text-slate-300 border-slate-600'

                  return (
                    <div className="bg-slate-900 text-white p-3.5 rounded-xl shadow-xl border border-slate-800 text-xs space-y-1.5 min-w-[220px]">
                      <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1.5 mb-1">
                        <span className="font-bold text-blue-400 text-sm">{p.name}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${badgeColor}`}>
                          {p.indexador}
                        </span>
                      </div>
                      <div className="text-slate-300">Emissor: <span className="font-semibold text-white">{p.issuer || '-'}</span></div>
                      <div className="text-slate-300">Tipo: <span className="text-white">{p.tipo || '-'}</span> {p.incentivada === 'Sim' && <span className="text-emerald-400 font-bold ml-1">(Incentivado)</span>}</div>
                      <div className="text-slate-300">Rating: <span className="font-bold text-amber-300">{p.rating}</span></div>
                      <div className="text-slate-300">Duration: <span className="font-semibold text-white">{p.x.toFixed(2)} anos</span> <span className="text-[10px] text-slate-400">(DU/252)</span></div>
                      <div className="pt-1 border-t border-slate-800/80 flex items-center justify-between">
                        <span className="text-slate-400">Spread / Taxa:</span>
                        <span className="text-emerald-400 font-extrabold text-sm">{p.spreadLabel || `${p.y}`}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 border-t border-slate-800/80 pt-1 mt-1">
                        Base: {p.fonte}
                      </div>
                    </div>
                  )
                }}
              />
              <Legend verticalAlign="top" height={36} />
              {scatterBySeries['IPCA'].length > 0 && (
                <Scatter name="IPCA (bps)" data={scatterBySeries['IPCA']} fill="#2563eb" />
              )}
              {scatterBySeries['DI+'].length > 0 && (
                <Scatter name="DI+ (% a.a.)" data={scatterBySeries['DI+']} fill="#10b981" />
              )}
              {scatterBySeries['%DI'].length > 0 && (
                <Scatter name="%DI (% do CDI)" data={scatterBySeries['%DI']} fill="#8b5cf6" />
              )}
              {scatterBySeries['Pré'].length > 0 && (
                <Scatter name="Pré (bps)" data={scatterBySeries['Pré']} fill="#f59e0b" />
              )}
              {scatterBySeries['Outros'].length > 0 && (
                <Scatter name="Outros" data={scatterBySeries['Outros']} fill="#64748b" />
              )}
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-2 text-xs text-slate-500 pt-2 border-t border-slate-100">
          * Spread Over calculado para IPCA (vs NTN-B correspondente) e Pré-Fixados (vs Curva DI B3) em bps. Para DI+, taxa adicional anual (% a.a.) sobre o CDI; para %DI, percentual da taxa CDI contratada. Duration calculada na convenção DU/252 com cupons semestrais.
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

      {/* LISTA DE ATIVOS FILTRADOS COMPLETA */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col space-y-4">
        <div className="flex flex-wrap justify-between items-center gap-4">
          <div>
            <h2 className="font-bold text-slate-900 text-lg">
              Tabela Completa de Ativos ({displayTableAssets.length.toLocaleString('pt-BR')} de {filteredAssets.length.toLocaleString('pt-BR')})
            </h2>
            <p className="text-xs text-slate-500">
              Detalhamento de taxas de emissão vs mercado atual, PUs, debêntures 12.431, ratings normalizados e spreads.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              placeholder="Buscar ticker, emissor, setor, ISIN..."
              value={tableSearch}
              onChange={e => setTableSearch(e.target.value)}
              className="border border-slate-200 rounded-xl px-3 py-1.5 text-xs bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none w-64"
            />
            <button
              onClick={() => downloadCSV(filteredAssets)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-1.5"
              title="Baixar arquivo estruturado com todos os 27 campos para análise em Excel ou Python"
            >
              <span>Baixar CSV Completo ({filteredAssets.length.toLocaleString('pt-BR')})</span>
            </button>
          </div>
        </div>

        <div className="border border-slate-200 rounded-xl overflow-x-auto overflow-y-auto max-h-[500px]">
          <table className="w-full text-xs text-left">
            <thead className="sticky top-0 bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider whitespace-nowrap">
              <tr>
                <th className="p-2.5">Ticker</th>
                <th className="p-2.5">Tipo</th>
                <th className="p-2.5">Incentivada</th>
                <th className="p-2.5">Emissor / Devedor</th>
                <th className="p-2.5">Setor (ANBIMA)</th>
                <th className="p-2.5">Indexador</th>
                <th className="p-2.5">Taxa Emissão</th>
                <th className="p-2.5">Taxa Mercado</th>
                <th className="p-2.5" title="Taxas indicativas de Compra (Bid) e Venda (Ask) apuradas pela ANBIMA junto aos dealers de mercado secundário">Cotações ANBIMA (Bid / Ask)</th>
                <th className="p-2.5 text-right">Spread / Taxa</th>
                <th className="p-2.5 text-right">Duration (anos)</th>
                <th className="p-2.5 text-right">PU Mercado</th>
                <th className="p-2.5">Último Negócio B3</th>
                <th className="p-2.5 text-center">Dias Negoc. (30D)</th>
                <th className="p-2.5">Rating Normalizado</th>
                <th className="p-2.5">Rating Original</th>
                <th className="p-2.5">Vencimento</th>
                <th className="p-2.5">ISIN</th>
                <th className="p-2.5">Fonte Precificação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 whitespace-nowrap">
              {displayTableAssets.slice(0, 250).map((a, idx) => {
                const spreadDisplay = getAssetSpreadDisplay(a)
                const durVal = parseFloat(a.duration || '')
                const normRating = a.rating_normalizado || normalizeRating(a.rating)
                const puNum = parseFloat(a.pu_mercado || a.pu || '')

                return (
                  <tr key={`${a.ticker}_${a.isin || a.issuer || idx}`} className="hover:bg-slate-50 transition">
                    <td className="p-2.5 font-mono font-bold text-blue-600">
                      <Link to={`/asset/${a.ticker}`} className="hover:underline">
                        {a.ticker}
                      </Link>
                    </td>
                    <td className="p-2.5 text-slate-600">{a.tipo || '-'}</td>
                    <td className="p-2.5">
                      {a.incentivada === 'Sim' ? (
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded text-[10px] font-bold">
                          Sim (12.431/Isento)
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[10px] font-medium">
                          Não (Comum)
                        </span>
                      )}
                    </td>
                    <td className="p-2.5 font-medium text-slate-800 truncate max-w-[200px]" title={a.issuer}>
                      <span>{a.issuer || '-'}</span>
                      {a.em_recuperacao_judicial === 'Sim' && (
                        <span className="ml-1.5 px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 text-[9px] font-extrabold" title="Emissor em Recuperação Judicial / Falência">
                          ⚠️ Em RJ
                        </span>
                      )}
                    </td>
                    <td className="p-2.5 text-slate-700 truncate max-w-[160px]" title={a.setor}>
                      <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[11px] font-medium">
                        {a.setor || 'Outros Serviços'}
                      </span>
                    </td>
                    <td className="p-2.5 font-semibold text-slate-700">{getAssetNormalizedIndexador(a) || a.indexador || '-'}</td>
                    <td className="p-2.5 text-slate-600 font-mono">{a.taxa_emissao || '-'}</td>
                    <td className="p-2.5 font-mono font-bold text-blue-700">
                      {a.taxa_mercado ? (
                        <span>{a.taxa_mercado}%</span>
                      ) : (
                        <span className="text-slate-400 font-normal">-</span>
                      )}
                    </td>
                    <td className="p-2.5 font-mono text-[11px]">
                      {a.taxa_compra || a.taxa_venda ? (
                        <div className="flex items-center gap-1">
                          {a.taxa_compra ? (
                            <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-1 py-0.5 rounded font-bold" title="Taxa Bid (Compra)">
                              C: {a.taxa_compra}%
                            </span>
                          ) : (
                            <span className="text-slate-300">C: -</span>
                          )}
                          {a.taxa_venda ? (
                            <span className="text-blue-700 bg-blue-50 border border-blue-200 px-1 py-0.5 rounded font-bold" title="Taxa Ask (Venda)">
                              V: {a.taxa_venda}%
                            </span>
                          ) : (
                            <span className="text-slate-300">V: -</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 font-normal">-</span>
                      )}
                    </td>
                    <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                      {spreadDisplay.label}
                    </td>
                    <td className="p-2.5 text-right font-mono text-slate-700">
                      {isNaN(durVal) ? '-' : durVal.toFixed(2)}
                    </td>
                    <td className="p-2.5 text-right font-mono text-slate-700">
                      {!isNaN(puNum) && puNum > 0 ? `R$ ${puNum.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                    </td>
                    <td className="p-2.5 font-mono text-slate-700">
                      {a.data_ultimo_negocio ? (
                        <div className="flex items-center gap-1.5">
                          <span>{formatDateBr(a.data_ultimo_negocio)}</span>
                          {a.data_ultimo_negocio === maxAvailableTradeDate && (
                            <span className="bg-emerald-100 text-emerald-800 text-[9px] font-extrabold px-1.5 py-0.5 rounded">
                              Último
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 font-normal">-</span>
                      )}
                    </td>
                    <td className="p-2.5 text-center">
                      {(a.dias_negociados_30d || 0) > 0 ? (
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          (a.dias_negociados_30d || 0) >= 15
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : (a.dias_negociados_30d || 0) >= 5
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {a.dias_negociados_30d}d / 30
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[10px] font-medium">-</span>
                      )}
                    </td>
                    <td className="p-2.5">
                      <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] border ${getRatingBadgeClass(normRating)}`}>
                        {normRating}
                      </span>
                    </td>
                    <td className="p-2.5 text-slate-500 font-mono text-[11px]">
                      {a.rating_original ? `${a.rating_original} (${a.rating_agencia || a.agencia || ''})` : '-'}
                    </td>
                    <td className="p-2.5 text-slate-600 font-mono">{a.vencimento || '-'}</td>
                    <td className="p-2.5 text-slate-400 font-mono text-[11px]">{a.isin || '-'}</td>
                    <td className="p-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        a.fonte_precificacao === 'ANBIMA Mercado'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {a.fonte_precificacao || 'Calculada'}
                      </span>
                    </td>
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
