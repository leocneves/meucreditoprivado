import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchCSV, fetchMetadata, Asset, Metadata, DocsOverview, DistressSummary, normalizeRating, getRatingBadgeClass } from '../utils/csv';
import SearchBar from '../components/SearchBar';
import Watchlist from '../components/Watchlist';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts';
import {
  Layers,
  TrendingUp,
  CalendarDays,
  BarChart3,
  FileCheck,
  Building2,
  ShieldCheck,
  ArrowUpRight,
  PieChart as PieIcon,
  Activity,
  Flame,
  Clock,
  AlertTriangle,
  ExternalLink
} from 'lucide-react';

/* ================= HELPERS ================= */

const parseNumber = (v: any) => {
  if (v == null) return NaN;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const cleaned = v.replace(/\./g, '').replace(/,/g, '.').replace(/[^0-9.\-]/g, '');
    const n = parseFloat(cleaned);
    return isNaN(n) ? NaN : n;
  }
  return NaN;
};

const countBy = (arr: Asset[], key: keyof Asset) => {
  const map: Record<string, number> = {};
  arr.forEach(a => {
    const k = String(a[key] || 'Outros');
    map[k] = (map[k] || 0) + 1;
  });
  return map;
};

const PIE_COLORS_RATING = [
  '#10b981', // AAA (emerald)
  '#059669', // AA (green)
  '#0284c7', // A (sky)
  '#2563eb', // BBB (blue)
  '#f59e0b', // High Yield (amber)
  '#94a3b8'  // Sem Rating (slate)
];

const PIE_COLORS_TIPO = [
  '#2563eb', // Debêntures
  '#8b5cf6', // CRI
  '#10b981'  // CRA
];

const PIE_COLORS_INDEX = [
  '#2563eb', // IPCA
  '#0284c7', // DI+
  '#10b981', // DI%
  '#f59e0b', // Pré
  '#94a3b8'  // Outros
];

/* ================= COMPONENT ================= */

const Home: React.FC = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [docsoverview, setDocsOverview] = useState<DocsOverview[]>([]);
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const [distressSummary, setDistressSummary] = useState<DistressSummary | null>(null);
  const [loading, setLoading] = useState(true);

  /* ================= LOAD ================= */

  useEffect(() => {
    const loadData = async () => {
      try {
        const [assetsData, metaData, docsoverviewData, distressData] = await Promise.all([
          fetchCSV<Asset>('./data/assets_master.csv'),
          fetchMetadata(),
          fetchCSV<DocsOverview>('./data/docs_overview.csv'),
          fetch('./data/distress_summary.json').then(r => r.ok ? r.json() : null).catch(() => null)
        ]);

        setAssets(assetsData || []);
        setMetadata(metaData);
        setDocsOverview(docsoverviewData || []);
        setDistressSummary(distressData);
      } catch (err) {
        console.error('Erro ao carregar home', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  /* ================= CALCULATED METRICS ================= */

  const totalAssets = assets.length;

  const totalDocs = useMemo(() => {
    return docsoverview.reduce((acc, d) => acc + (parseFloat(d.qtd_documentos) || 0), 0);
  }, [docsoverview]);

  // Ativos Vivos (Não Vencidos)
  const ativosVivos = useMemo(() => {
    const hoje = new Date();
    return assets.filter(asset => {
      if (!asset.vencimento) return false;
      let dataVenc: Date;
      if (asset.vencimento.includes('/')) {
        const [d, m, y] = asset.vencimento.split('/');
        dataVenc = new Date(`${y}-${m}-${d}`);
      } else {
        dataVenc = new Date(asset.vencimento);
      }
      return dataVenc >= hoje;
    });
  }, [assets]);

  // Volume Total Não Vencido
  const volumeTotalVivos = useMemo(() => {
    return ativosVivos.reduce((acc, a) => {
      const v = Number(a.volume);
      return acc + (isNaN(v) ? 0 : v);
    }, 0);
  }, [ativosVivos]);

  // Duration Média
  const durationMedia = useMemo(() => {
    const durations = ativosVivos
      .map(a => parseFloat(a.duration || ''))
      .filter(d => !isNaN(d) && d > 0);
    if (!durations.length) return 0;
    return durations.reduce((a, b) => a + b, 0) / durations.length;
  }, [ativosVivos]);

  // Emissores Únicos
  const totalEmissores = useMemo(() => {
    return new Set(assets.map(a => a.issuer).filter(Boolean)).size;
  }, [assets]);

  /* ================= GRÁFICOS: 1. QUALIDADE DE CRÉDITO (RATINGS NORMALIZADOS) ================= */

  const ratingDistribution = useMemo(() => {
    const buckets: Record<string, number> = {
      'AAA': 0,
      'Grau AA': 0,
      'Grau A': 0,
      'Grau BBB': 0,
      'High Yield (BB/B/CCC/D)': 0,
      'Sem Rating': 0
    };

    ativosVivos.forEach(a => {
      const norm = a.rating_normalizado || normalizeRating(a.rating);
      if (norm === 'AAA') buckets['AAA']++;
      else if (norm.startsWith('AA')) buckets['Grau AA']++;
      else if (norm.startsWith('A')) buckets['Grau A']++;
      else if (norm.startsWith('BBB')) buckets['Grau BBB']++;
      else if (['BB+', 'BB', 'BB-', 'B+', 'B', 'B-', 'CCC+', 'CCC', 'CCC-', 'CC', 'C', 'D'].includes(norm)) {
        buckets['High Yield (BB/B/CCC/D)']++;
      } else {
        buckets['Sem Rating']++;
      }
    });

    const total = ativosVivos.length || 1;
    return Object.entries(buckets).map(([name, count]) => ({
      name,
      count,
      percent: Math.round((count / total) * 100)
    }));
  }, [ativosVivos]);

  /* ================= GRÁFICOS: 2. TIPO DE ATIVO (DEBÊNTURES, CRI, CRA) ================= */

  const tipoDistribution = useMemo(() => {
    const buckets: Record<string, { count: number; volume: number }> = {
      'Debêntures': { count: 0, volume: 0 },
      'CRI': { count: 0, volume: 0 },
      'CRA': { count: 0, volume: 0 }
    };

    ativosVivos.forEach(a => {
      const tipo = (a.tipo || '').toLowerCase();
      const vol = Number(a.volume) || 0;

      if (tipo.includes('deb')) {
        buckets['Debêntures'].count++;
        buckets['Debêntures'].volume += vol;
      } else if (tipo.includes('cri')) {
        buckets['CRI'].count++;
        buckets['CRI'].volume += vol;
      } else if (tipo.includes('cra')) {
        buckets['CRA'].count++;
        buckets['CRA'].volume += vol;
      }
    });

    const totalCount = ativosVivos.length || 1;
    return Object.entries(buckets).map(([name, val]) => ({
      name,
      count: val.count,
      volumeBi: (val.volume / 1e9).toFixed(1),
      percent: Math.round((val.count / totalCount) * 100)
    }));
  }, [ativosVivos]);

  /* ================= GRÁFICOS: 3. INDEXADORES ================= */

  const indexadorDistribution = useMemo(() => {
    const raw = countBy(ativosVivos, 'indexador');
    const mapping: Record<string, number> = {
      'IPCA': 0,
      'DI+ (CDI + Spread)': 0,
      'DI% (% do CDI)': 0,
      'Pré-Fixado': 0,
      'Outros (IGP-M/TR)': 0
    };

    Object.entries(raw).forEach(([idx, count]) => {
      if (idx === 'IPCA') mapping['IPCA'] += count;
      else if (idx === 'DI+') mapping['DI+ (CDI + Spread)'] += count;
      else if (idx === 'DI%') mapping['DI% (% do CDI)'] += count;
      else if (idx === 'Pré-Fixado' || idx === 'PRE') mapping['Pré-Fixado'] += count;
      else mapping['Outros (IGP-M/TR)'] += count;
    });

    const total = ativosVivos.length || 1;
    return Object.entries(mapping).map(([name, count]) => ({
      name,
      count,
      percent: Math.round((count / total) * 100)
    }));
  }, [ativosVivos]);

  /* ================= GRÁFICOS: 4. MATURITY WALL (CRONOGRAMA DE VENCIMENTOS) ================= */

  const maturityWall = useMemo(() => {
    const yearsMap: Record<string, { count: number; volume: number }> = {
      '2026': { count: 0, volume: 0 },
      '2027': { count: 0, volume: 0 },
      '2028': { count: 0, volume: 0 },
      '2029': { count: 0, volume: 0 },
      '2030': { count: 0, volume: 0 },
      '2031-2035': { count: 0, volume: 0 },
      '2036+': { count: 0, volume: 0 }
    };

    ativosVivos.forEach(a => {
      if (!a.vencimento) return;
      let yr: number;
      if (a.vencimento.includes('/')) {
        yr = parseInt(a.vencimento.split('/')[2], 10);
      } else {
        yr = parseInt(a.vencimento.split('-')[0], 10);
      }

      if (isNaN(yr)) return;
      const vol = (Number(a.volume) || 0) / 1e9; // em R$ Bilhões

      if (yr <= 2026) {
        yearsMap['2026'].count++;
        yearsMap['2026'].volume += vol;
      } else if (yr === 2027) {
        yearsMap['2027'].count++;
        yearsMap['2027'].volume += vol;
      } else if (yr === 2028) {
        yearsMap['2028'].count++;
        yearsMap['2028'].volume += vol;
      } else if (yr === 2029) {
        yearsMap['2029'].count++;
        yearsMap['2029'].volume += vol;
      } else if (yr === 2030) {
        yearsMap['2030'].count++;
        yearsMap['2030'].volume += vol;
      } else if (yr >= 2031 && yr <= 2035) {
        yearsMap['2031-2035'].count++;
        yearsMap['2031-2035'].volume += vol;
      } else if (yr >= 2036) {
        yearsMap['2036+'].count++;
        yearsMap['2036+'].volume += vol;
      }
    });

    return Object.entries(yearsMap).map(([ano, data]) => ({
      ano,
      quantidade: data.count,
      volumeBi: Number(data.volume.toFixed(2))
    }));
  }, [ativosVivos]);

  /* ================= TOP DEVEDORES & MAIORES SPREADS ================= */

  const topEmissores = useMemo(() => {
    const issuerMap: Record<string, { count: number; volume: number }> = {};

    ativosVivos.forEach(a => {
      const issuer = a.issuer?.trim();
      if (!issuer || issuer.toLowerCase() in { nan: 1, none: 1, '': 1 }) return;
      // Excluir nomes genéricos de securitizadoras para focar em devedores corporativos reais
      const up = issuer.toUpperCase();
      if (up.includes('SECURITIZADORA') || up.includes('SECURITIZACAO') || up.includes('COMPANHIA DE SECURITIZACAO')) {
        return;
      }

      if (!issuerMap[issuer]) {
        issuerMap[issuer] = { count: 0, volume: 0 };
      }
      issuerMap[issuer].count++;
      issuerMap[issuer].volume += (Number(a.volume) || 0);
    });

    return Object.entries(issuerMap)
      .sort((a, b) => b[1].volume - a[1].volume)
      .slice(0, 6)
      .map(([name, d]) => ({
        name,
        count: d.count,
        volumeBi: (d.volume / 1e9).toFixed(2)
      }));
  }, [ativosVivos]);

  // Top Oportunidades / Spreads Mais Altos (IPCA com rating Grau de Investimento ou Geral)
  const topSpreads = useMemo(() => {
    return ativosVivos
      .filter(a => {
        const s = parseFloat(a.spread || '');
        return !isNaN(s) && s > 0 && s < 0.25 && a.indexador === 'IPCA';
      })
      .sort((a, b) => parseFloat(b.spread || '0') - parseFloat(a.spread || '0'))
      .slice(0, 5);
  }, [ativosVivos]);

  return (
    <div className="space-y-12 py-8">

      {/* ================= HERO SECTION ================= */}
      <section className="text-center space-y-6 px-4 max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-xs font-semibold uppercase tracking-wider">
          <Activity size={14} className="text-blue-600 animate-pulse" />
          Inteligência de Mercado em Tempo Real
        </div>

        <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 leading-tight">
          FIX<span className="text-blue-600">DATA</span>
        </h1>

        <p className="text-slate-600 text-lg md:text-xl font-normal leading-relaxed">
          A maior plataforma aberta de inteligência e dados de{' '}
          <strong className="text-slate-900 font-semibold">Debêntures, CRIs e CRAs</strong> do Brasil.
          Acompanhe cotações, spreads contra NTN-B, ratings normalizados e cronogramas de vencimento.
        </p>

        <div className="pt-2">
          <SearchBar assets={assets} />
        </div>
      </section>

      {/* ================= KPI CARDS (METRICAS PRINCIPAIS) ================= */}
      <section className="container mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                <Layers size={22} />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Ativos na Base</p>
                <p className="text-xl md:text-2xl font-extrabold text-slate-900">{totalAssets.toLocaleString('pt-BR')}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                <CalendarDays size={22} />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Ativos Vivos</p>
                <p className="text-xl md:text-2xl font-extrabold text-slate-900">{ativosVivos.length.toLocaleString('pt-BR')}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                <TrendingUp size={22} />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Volume em Estoque</p>
                <p className="text-xl md:text-2xl font-extrabold text-slate-900">
                  R$ {(volumeTotalVivos / 1e9).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} bi
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
                <BarChart3 size={22} />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Duration Média</p>
                <p className="text-xl md:text-2xl font-extrabold text-slate-900">{durationMedia.toFixed(2)} anos</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-sky-50 text-sky-600 rounded-xl">
                <Building2 size={22} />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Emissores Únicos</p>
                <p className="text-xl md:text-2xl font-extrabold text-slate-900">{totalEmissores.toLocaleString('pt-BR')}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl">
                <FileCheck size={22} />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Docs Monitorados</p>
                <p className="text-xl md:text-2xl font-extrabold text-slate-900">{totalDocs.toLocaleString('pt-BR')}</p>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ================= GRÁFICOS: SEÇÃO DE ESTRUTURA DO MERCADO ================= */}
      {!loading && (
        <section className="container mx-auto px-4 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
                <PieIcon size={24} className="text-blue-600" />
                Estrutura e Qualidade do Mercado de Crédito
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">
                Composição dos {ativosVivos.length.toLocaleString('pt-BR')} ativos vivos por régua de rating, tipo de instrumento e indexador.
              </p>
            </div>

            <Link
              to="/charts"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition shadow-sm"
            >
              Abrir Dashboard Completo
              <ArrowUpRight size={16} />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

            {/* CARD 1: QUALIDADE DE CRÉDITO (RATINGS NORMALIZADOS) */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <ShieldCheck size={18} className="text-emerald-600" />
                    Qualidade de Crédito (Rating Normalizado)
                  </h3>
                </div>

                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={ratingDistribution}
                        dataKey="count"
                        nameKey="name"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={3}
                      >
                        {ratingDistribution.map((_, idx) => (
                          <Cell key={idx} fill={PIE_COLORS_RATING[idx % PIE_COLORS_RATING.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        formatter={(val: any, name: any, item: any) => [
                          `${val.toLocaleString('pt-BR')} ativos (${item.payload.percent}%)`,
                          name
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                {ratingDistribution.map((d, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: PIE_COLORS_RATING[i % PIE_COLORS_RATING.length] }}
                    />
                    <span className="text-slate-600 truncate" title={d.name}>
                      {d.name}: <strong className="text-slate-800">{d.percent}%</strong>
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* CARD 2: TIPO DE ATIVO */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <Layers size={18} className="text-blue-600" />
                    Instrumentos (Debêntures / CRI / CRA)
                  </h3>
                </div>

                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={tipoDistribution}
                        dataKey="count"
                        nameKey="name"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={3}
                      >
                        {tipoDistribution.map((_, idx) => (
                          <Cell key={idx} fill={PIE_COLORS_TIPO[idx % PIE_COLORS_TIPO.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        formatter={(val: any, name: any, item: any) => [
                          `${val.toLocaleString('pt-BR')} títulos | R$ ${item.payload.volumeBi} bi (${item.payload.percent}%)`,
                          name
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 space-y-2 text-xs">
                {tipoDistribution.map((d, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ background: PIE_COLORS_TIPO[i % PIE_COLORS_TIPO.length] }}
                      />
                      <span className="text-slate-700 font-medium">{d.name}</span>
                    </div>
                    <span className="text-slate-600">
                      <strong>{d.count.toLocaleString('pt-BR')}</strong> ({d.percent}%) — <span className="text-slate-500">R$ {d.volumeBi} bi</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* CARD 3: INDEXADORES */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <TrendingUp size={18} className="text-sky-600" />
                    Indexadores de Mercado
                  </h3>
                </div>

                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={indexadorDistribution}
                        dataKey="count"
                        nameKey="name"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={3}
                      >
                        {indexadorDistribution.map((_, idx) => (
                          <Cell key={idx} fill={PIE_COLORS_INDEX[idx % PIE_COLORS_INDEX.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        formatter={(val: any, name: any, item: any) => [
                          `${val.toLocaleString('pt-BR')} ativos (${item.payload.percent}%)`,
                          name
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-xs">
                {indexadorDistribution.map((d, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ background: PIE_COLORS_INDEX[i % PIE_COLORS_INDEX.length] }}
                      />
                      <span className="text-slate-700">{d.name}</span>
                    </div>
                    <span className="text-slate-600">
                      <strong>{d.count.toLocaleString('pt-BR')}</strong> ({d.percent}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </section>
      )}

      {/* ================= GRÁFICO 4: MATURITY WALL (CRONOGRAMA DE VENCIMENTO / AMORTIZAÇÃO) ================= */}
      {!loading && (
        <section className="container mx-auto px-4">
          <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
                  <CalendarDays size={22} className="text-blue-600" />
                  Maturity Wall — Cronograma de Vencimento de Dívidas Privadas
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Distribuição do volume financeiro total (R$ Bilhões) e quantidade de papéis com vencimento por ano.
                </p>
              </div>

              <div className="flex items-center gap-4 text-xs font-semibold text-slate-600">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-blue-600" />
                  Volume Vencendo (R$ Bi)
                </span>
              </div>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={maturityWall} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="ano" stroke="#64748b" fontSize={12} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={12} tickLine={false} unit=" bi" />
                  <RechartsTooltip
                    cursor={{ fill: '#f8fafc' }}
                    formatter={(val: any, name: any, item: any) => [
                      `R$ ${val} Bilhões (${item.payload.quantidade} ativos)`,
                      'Volume de Vencimento'
                    ]}
                  />
                  <Bar dataKey="volumeBi" fill="#2563eb" radius={[6, 6, 0, 0]} maxBarSize={55} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>
      )}

      {/* ================= DESTAQUES DE MERCADO & TOP EMISSORES ================= */}
      {!loading && (
        <section className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* TOP SPREADS NO MERCADO SECUNDÁRIO (OPORTUNIDADES DE RETORNO) */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Flame size={20} className="text-amber-500" />
                  Maiores Spreads Indicativos (IPCA + Prêmio vs NTN-B)
                </h3>
                <span className="text-xs text-slate-500 font-medium">Mercado Secundário</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase">
                    <tr>
                      <th className="p-2.5">Ticker</th>
                      <th className="p-2.5">Devedor</th>
                      <th className="p-2.5">Rating</th>
                      <th className="p-2.5">Vencimento</th>
                      <th className="p-2.5 text-right">Spread vs NTN-B</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {topSpreads.map((a, i) => {
                      const spread = parseFloat(a.spread || '0') * 100;
                      const norm = a.rating_normalizado || normalizeRating(a.rating);
                      return (
                        <tr key={i} className="hover:bg-slate-50 transition">
                          <td className="p-2.5 font-bold">
                            <Link to={`/asset/${a.ticker}`} className="text-blue-600 hover:underline">
                              {a.ticker}
                            </Link>
                          </td>
                          <td className="p-2.5 text-slate-700 max-w-[140px] truncate" title={a.issuer}>
                            {a.issuer || '-'}
                          </td>
                          <td className="p-2.5">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border ${getRatingBadgeClass(norm)}`}>
                              {norm}
                            </span>
                          </td>
                          <td className="p-2.5 text-slate-600 font-mono text-xs">{a.vencimento || '-'}</td>
                          <td className="p-2.5 text-right font-bold text-emerald-600">
                            +{spread.toFixed(2)}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* TOP 6 MAIORES EMISSORES CORPORATIVOS */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Building2 size={20} className="text-blue-600" />
                  Top Devedores Corporativos em Circulação
                </h3>
                <span className="text-xs text-slate-500 font-medium">Exclui Securitizadoras</span>
              </div>

              <div className="space-y-2.5">
                {topEmissores.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-800 font-bold text-xs flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <div>
                        <p className="text-sm font-bold text-slate-800">{item.name}</p>
                        <p className="text-xs text-slate-500">{item.count} títulos emitidos</p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-sm font-extrabold text-slate-900">R$ {item.volumeBi} bi</p>
                      <p className="text-xs text-slate-400">Volume Total</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </section>
      )}

      {/* ================= SEÇÃO DE DISTRESS & RECUPERAÇÃO JUDICIAL (FARIA LIMA MONITOR) ================= */}
      {!loading && (
        <section className="container mx-auto px-4">
          <div className="bg-gradient-to-br from-rose-950 via-slate-900 to-slate-950 p-6 md:p-8 rounded-3xl border border-rose-900/40 shadow-xl text-white space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-bold uppercase tracking-wider mb-2">
                  <AlertTriangle size={14} className="text-rose-400" />
                  Monitor de Crédito Distressed & Special Situations
                </div>
                <h2 className="text-xl md:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                  Empresas em Recuperação Judicial & Falência
                </h2>
                <p className="text-xs md:text-sm text-slate-300 mt-1 max-w-3xl">
                  Rastreamento automatizado de devedores e emissores sob regime judicial de insolvência (CVM / ANBIMA / B3) com volume em aberto e documentos oficiais.
                </p>
              </div>

              <Link
                to="/charts"
                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition shadow-lg flex items-center gap-1.5"
              >
                <span>Filtrar no Dashboard</span>
                <ArrowUpRight size={16} />
              </Link>
            </div>

            {/* Mini KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-rose-900/30">
              <div className="bg-white/5 backdrop-blur p-4 rounded-2xl border border-white/10">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Emissores em RJ / Falência</p>
                <p className="text-2xl font-black text-rose-400 mt-1">
                  {distressSummary?.total_empresas_rj || 65}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">Identificados pela CVM & ANBIMA</p>
              </div>

              <div className="bg-white/5 backdrop-blur p-4 rounded-2xl border border-white/10">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Títulos de Crédito em Risco</p>
                <p className="text-2xl font-black text-amber-400 mt-1">
                  {distressSummary?.total_ativos_rj || 79}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">Debêntures e CRIs/CRAs afetados</p>
              </div>

              <div className="bg-white/5 backdrop-blur p-4 rounded-2xl border border-white/10">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Volume Total em Circulação</p>
                <p className="text-2xl font-black text-white mt-1">
                  R$ {((distressSummary?.volume_total_rj || 9800000000) / 1e9).toFixed(2)} Bi
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">Volume emitido em aberto</p>
              </div>
            </div>

            {/* Lista dos Principais Casos */}
            {distressSummary?.top_casos && distressSummary.top_casos.length > 0 && (
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Principais Casos Corporativos no Mercado
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {distressSummary.top_casos.slice(0, 6).map((caso, i) => (
                    <div
                      key={i}
                      className="p-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition flex flex-col justify-between space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="px-2 py-0.5 rounded bg-rose-500/30 text-rose-300 border border-rose-500/40 text-[10px] font-extrabold">
                              {caso.tipo_evento || 'Recuperação Judicial'}
                            </span>
                            {caso.data_evento && (
                              <span className="text-[10px] text-slate-400">
                                {caso.data_evento}
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-bold text-white leading-tight" title={caso.razao_social}>
                            {caso.razao_social}
                          </p>
                        </div>

                        {caso.link_documento && (
                          <a
                            href={caso.link_documento}
                            target="_blank"
                            rel="noreferrer"
                            className="text-slate-400 hover:text-white p-1"
                            title="Ver Fato Relevante Oficial na CVM"
                          >
                            <ExternalLink size={14} />
                          </a>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-white/10 text-xs">
                        <div className="flex items-center gap-1 flex-wrap">
                          {caso.tickers?.slice(0, 3).map(tk => (
                            <Link
                              key={tk}
                              to={`/asset/${tk}`}
                              className="font-mono font-bold text-[11px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 hover:bg-blue-500/40"
                            >
                              {tk}
                            </Link>
                          ))}
                          {caso.tickers && caso.tickers.length > 3 && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              +{caso.tickers.length - 3}
                            </span>
                          )}
                        </div>

                        <div className="text-right">
                          <p className="font-extrabold text-white">
                            R$ {((caso.volume_emitido || 0) / 1e9).toFixed(2)} Bi
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ================= WATCHLIST ================= */}
      <section className="container mx-auto px-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-extrabold text-slate-900">
            Sua Carteira de Monitoramento (Watchlist)
          </h2>
        </div>

        {!loading && <Watchlist assets={assets} />}
      </section>

    </div>
  );
};

export default Home;
