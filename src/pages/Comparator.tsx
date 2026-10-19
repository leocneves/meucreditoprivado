import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  ArrowLeftRight,
  Search,
  CheckCircle2,
  TrendingUp,
  ShieldCheck,
  Scale,
  Award,
  AlertCircle,
  Clock,
  Layers,
  Sparkles,
  ChevronRight,
  Info,
  Calendar,
  ExternalLink,
  Building2,
  Check,
  X
} from 'lucide-react';
import { fetchCSV, Asset, normalizeRating } from '../utils/csv';

export default function ComparatorPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);

  // Seleção de ativos
  const [ticker1, setTicker1] = useState(searchParams.get('ativo1')?.toUpperCase() || 'VALE38');
  const [ticker2, setTicker2] = useState(searchParams.get('ativo2')?.toUpperCase() || 'VALEC0');

  // Modais de busca
  const [isSearching1, setIsSearching1] = useState(false);
  const [isSearching2, setIsSearching2] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    document.title = 'Comparador de Debêntures, CRIs e CRAs | FIXDATA';
    fetchCSV<Asset>('/data/assets_master.csv')
      .then(data => {
        setAssets(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Erro ao carregar ativos para comparador:', err);
        setLoading(false);
      });
  }, []);

  // Atualizar URL params ao mudar de ativo
  const updateTickers = (t1: string, t2: string) => {
    setTicker1(t1);
    setTicker2(t2);
    setSearchParams({ ativo1: t1, ativo2: t2 });
  };

  const asset1 = useMemo(() => {
    return assets.find(a => a.ticker?.toUpperCase() === ticker1);
  }, [assets, ticker1]);

  const asset2 = useMemo(() => {
    return assets.find(a => a.ticker?.toUpperCase() === ticker2);
  }, [assets, ticker2]);

  // Lista para busca
  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || !assets.length) return [];
    const term = searchQuery.trim().toLowerCase();
    return assets
      .filter(a => {
        const matchTicker = (a.ticker || '').toLowerCase().includes(term);
        const matchIssuer = (a.issuer || '').toLowerCase().includes(term);
        return matchTicker || matchIssuer;
      })
      .slice(0, 15);
  }, [assets, searchQuery]);

  // Hierarquia de Ratings para comparação (quanto menor o índice, melhor)
  const ratingRank = (rStr?: string): number => {
    if (!rStr) return 999;
    const r = rStr.toUpperCase().replace(/\s+/g, '');
    const ranks: { [key: string]: number } = {
      'AAA': 1, 'AA+': 2, 'AA': 3, 'AA-': 4,
      'A+': 5, 'A': 6, 'A-': 7,
      'BBB+': 8, 'BBB': 9, 'BBB-': 10,
      'BB+': 11, 'BB': 12, 'BB-': 13,
      'B+': 14, 'B': 15, 'B-': 16,
      'CCC+': 17, 'CCC': 18, 'CCC-': 19,
      'CC': 20, 'C': 21, 'D': 22
    };
    for (const k in ranks) {
      if (r.startsWith(k)) return ranks[k];
    }
    return 999;
  };

  // Funções de extração numérica
  const parseNum = (val?: string | number): number | null => {
    if (val === undefined || val === null) return null;
    const s = String(val).replace('%', '').replace(',', '.').trim();
    const flt = parseFloat(s);
    return isNaN(flt) ? null : flt;
  };

  // Comparação de métricas
  const comparison = useMemo(() => {
    if (!asset1 || !asset2) return null;

    // 1. Taxa Indicativa / Taxa Ativo
    const taxa1 = parseNum(asset1.taxa_mercado || asset1.taxa_indicativa_anbima || asset1.taxa_ativo || asset1.taxa_emissao);
    const taxa2 = parseNum(asset2.taxa_mercado || asset2.taxa_indicativa_anbima || asset2.taxa_ativo || asset2.taxa_emissao);
    const taxaWinner = taxa1 !== null && taxa2 !== null ? (taxa1 > taxa2 ? 1 : taxa2 > taxa1 ? 2 : 0) : null;
    const taxaDiff = taxa1 !== null && taxa2 !== null ? Math.abs(taxa1 - taxa2) : 0;

    // 2. Spread vs NTN-B
    const spread1 = parseNum(asset1.spread);
    const spread2 = parseNum(asset2.spread);
    const spreadWinner = spread1 !== null && spread2 !== null ? (spread1 > spread2 ? 1 : spread2 > spread1 ? 2 : 0) : null;
    const spreadDiff = spread1 !== null && spread2 !== null ? Math.abs(spread1 - spread2) * 100 : 0;

    // 3. Rating de Crédito (Menor rank = menor risco de inadimplência)
    const rank1 = ratingRank(asset1.rating_normalizado || asset1.rating);
    const rank2 = ratingRank(asset2.rating_normalizado || asset2.rating);
    const ratingWinner = rank1 < 900 && rank2 < 900 ? (rank1 < rank2 ? 1 : rank2 < rank1 ? 2 : 0) : null;

    // 4. Duration (Menor duration = menor risco de mercado / taxa)
    const dur1 = parseNum(asset1.duration);
    const dur2 = parseNum(asset2.duration);
    const durWinner = dur1 !== null && dur2 !== null ? (dur1 < dur2 ? 1 : dur2 < dur1 ? 2 : 0) : null;

    // 5. Isenção Fiscal (Lei 12.431/11)
    const isento1 = String(asset1.incentivada || '').toLowerCase() === 'sim' || String(asset1.lei || '') === '12.431';
    const isento2 = String(asset2.incentivada || '').toLowerCase() === 'sim' || String(asset2.lei || '') === '12.431';
    const isencaoWinner = isento1 !== isento2 ? (isento1 ? 1 : 2) : 0;

    // 6. Liquidez B3 (Volume recente)
    const vol1 = parseNum(asset1.volume_negociado_b3 || asset1.volume);
    const vol2 = parseNum(asset2.volume_negociado_b3 || asset2.volume);
    const volWinner = vol1 !== null && vol2 !== null ? (vol1 > vol2 ? 1 : vol2 > vol1 ? 2 : 0) : null;

    // Destaques objetivos de cada um
    const vantagens1: string[] = [];
    const vantagens2: string[] = [];

    if (taxaWinner === 1) vantagens1.push(`Taxa indicativa superior (+${taxaDiff.toFixed(2)}% a.a.)`);
    if (taxaWinner === 2) vantagens2.push(`Taxa indicativa superior (+${taxaDiff.toFixed(2)}% a.a.)`);

    if (spreadWinner === 1) vantagens1.push(`Maior spread sobre NTN-B (+${spreadDiff.toFixed(2)}% a.a.)`);
    if (spreadWinner === 2) vantagens2.push(`Maior spread sobre NTN-B (+${spreadDiff.toFixed(2)}% a.a.)`);

    if (ratingWinner === 1) vantagens1.push(`Rating de crédito superior (${asset1.rating_normalizado || asset1.rating})`);
    if (ratingWinner === 2) vantagens2.push(`Rating de crédito superior (${asset2.rating_normalizado || asset2.rating})`);

    if (durWinner === 1 && dur1 !== null) vantagens1.push(`Menor duration (${dur1.toFixed(1)} anos) — menor risco de taxa`);
    if (durWinner === 2 && dur2 !== null) vantagens2.push(`Menor duration (${dur2.toFixed(1)} anos) — menor risco de taxa`);

    if (isencaoWinner === 1) vantagens1.push('Isenção fiscal de IR para Pessoa Física (Lei 12.431)');
    if (isencaoWinner === 2) vantagens2.push('Isenção fiscal de IR para Pessoa Física (Lei 12.431)');

    if (volWinner === 1) vantagens1.push('Maior volume recente negociado na B3');
    if (volWinner === 2) vantagens2.push('Maior volume recente negociado na B3');

    return {
      taxaWinner,
      spreadWinner,
      ratingWinner,
      durWinner,
      isencaoWinner,
      volWinner,
      vantagens1,
      vantagens2
    };
  }, [asset1, asset2]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl space-y-8 animate-fade-in font-sans">
      {/* Cabeçalho */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold border border-blue-100">
              <Scale size={14} />
              <span>Análise Comparativa Direta</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Comparador de Debêntures, CRIs e CRAs
            </h1>
            <p className="text-sm sm:text-base text-slate-600 font-medium max-w-2xl">
              Compare lado a lado rentabilidade, spread sobre NTN-B, rating de crédito, duration e enquadramento tributário de dois títulos de renda fixa.
            </p>
          </div>

          {/* Sugestões Rápidas */}
          <div className="space-y-1.5 sm:text-right">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Pares Sugeridos</span>
            <div className="flex flex-wrap gap-1.5 sm:justify-end">
              <button
                onClick={() => updateTickers('VALE38', 'VALEC0')}
                className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 transition"
              >
                VALE38 vs VALEC0
              </button>
              <button
                onClick={() => updateTickers('PETR28', 'PETR19')}
                className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 transition"
              >
                PETR28 vs PETR19
              </button>
              <button
                onClick={() => updateTickers('BBRK12', 'BBRK13')}
                className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 transition"
              >
                BBRK12 vs BBRK13
              </button>
            </div>
          </div>
        </div>

        {/* Seletores dos 2 Ativos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {/* Seletor Ativo 1 */}
          <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ativo 1</span>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setIsSearching1(true);
                }}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
              >
                <Search size={13} /> Trocar ativo
              </button>
            </div>
            <div className="flex items-baseline justify-between">
              <div>
                <h3 className="text-2xl font-black text-slate-900 font-mono tracking-tight">{asset1?.ticker || ticker1}</h3>
                <p className="text-xs text-slate-600 font-semibold truncate max-w-xs">{asset1?.issuer || 'Não localizado'}</p>
              </div>
              <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700">
                {asset1?.tipo || 'Título'}
              </span>
            </div>
          </div>

          {/* Seletor Ativo 2 */}
          <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ativo 2</span>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setIsSearching2(true);
                }}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
              >
                <Search size={13} /> Trocar ativo
              </button>
            </div>
            <div className="flex items-baseline justify-between">
              <div>
                <h3 className="text-2xl font-black text-slate-900 font-mono tracking-tight">{asset2?.ticker || ticker2}</h3>
                <p className="text-xs text-slate-600 font-semibold truncate max-w-xs">{asset2?.issuer || 'Não localizado'}</p>
              </div>
              <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700">
                {asset2?.tipo || 'Título'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Quadro de Destaques Objetivos (O que cada um tem de melhor) */}
      {comparison && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Vantagens Ativo 1 */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs">
                1
              </div>
              <h3 className="font-extrabold text-slate-900 text-base">
                Destaques de {asset1?.ticker}:
              </h3>
            </div>
            {comparison.vantagens1.length > 0 ? (
              <ul className="space-y-2 text-xs sm:text-sm">
                {comparison.vantagens1.map((v, i) => (
                  <li key={i} className="flex items-center gap-2 text-slate-700 font-medium">
                    <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
                    <span>{v}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-400 italic">Nenhuma métrica com superioridade evidente contra o Ativo 2.</p>
            )}
          </div>

          {/* Vantagens Ativo 2 */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <div className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs">
                2
              </div>
              <h3 className="font-extrabold text-slate-900 text-base">
                Destaques de {asset2?.ticker}:
              </h3>
            </div>
            {comparison.vantagens2.length > 0 ? (
              <ul className="space-y-2 text-xs sm:text-sm">
                {comparison.vantagens2.map((v, i) => (
                  <li key={i} className="flex items-center gap-2 text-slate-700 font-medium">
                    <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
                    <span>{v}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-400 italic">Nenhuma métrica com superioridade evidente contra o Ativo 1.</p>
            )}
          </div>
        </div>
      )}

      {/* Tabela de Comparação Lado a Lado */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-lg font-extrabold text-slate-900">Métricas Comparativas Detalhadas</h2>
          <p className="text-xs text-slate-500">Valores consolidados de taxas, prêmios de risco e condições contratuais.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-bold text-[11px] uppercase tracking-wider border-b border-slate-200">
                <th className="px-6 py-3.5 w-1/3">Métrica Analítica</th>
                <th className="px-6 py-3.5 w-1/3 font-mono text-blue-700">{asset1?.ticker || 'Ativo 1'}</th>
                <th className="px-6 py-3.5 w-1/3 font-mono text-indigo-700">{asset2?.ticker || 'Ativo 2'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {/* Emissor */}
              <tr className="hover:bg-slate-50/60">
                <td className="px-6 py-3.5 font-bold text-slate-600">Emissor / Devedor</td>
                <td className="px-6 py-3.5 font-medium">{asset1?.issuer || '-'}</td>
                <td className="px-6 py-3.5 font-medium">{asset2?.issuer || '-'}</td>
              </tr>

              {/* Indexador & Taxa */}
              <tr className="hover:bg-slate-50/60">
                <td className="px-6 py-3.5 font-bold text-slate-600">Taxa Indicativa (Mercado)</td>
                <td className="px-6 py-3.5">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold font-mono text-base text-slate-900">
                      {asset1?.taxa_mercado || asset1?.taxa_ativo || asset1?.taxa_emissao || '-'}
                    </span>
                    {comparison?.taxaWinner === 1 && (
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[10px] font-bold">
                        Maior Taxa
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-3.5">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold font-mono text-base text-slate-900">
                      {asset2?.taxa_mercado || asset2?.taxa_ativo || asset2?.taxa_emissao || '-'}
                    </span>
                    {comparison?.taxaWinner === 2 && (
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[10px] font-bold">
                        Maior Taxa
                      </span>
                    )}
                  </div>
                </td>
              </tr>

              {/* Spread NTN-B */}
              <tr className="hover:bg-slate-50/60">
                <td className="px-6 py-3.5 font-bold text-slate-600">Spread sobre NTN-B</td>
                <td className="px-6 py-3.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold font-mono">
                      {asset1?.spread ? `${(parseFloat(asset1.spread) * 100).toFixed(2)}% a.a.` : '-'}
                    </span>
                    {comparison?.spreadWinner === 1 && (
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded text-[10px] font-bold">
                        Maior Prêmio
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-3.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold font-mono">
                      {asset2?.spread ? `${(parseFloat(asset2.spread) * 100).toFixed(2)}% a.a.` : '-'}
                    </span>
                    {comparison?.spreadWinner === 2 && (
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded text-[10px] font-bold">
                        Maior Prêmio
                      </span>
                    )}
                  </div>
                </td>
              </tr>

              {/* Rating */}
              <tr className="hover:bg-slate-50/60">
                <td className="px-6 py-3.5 font-bold text-slate-600">Rating de Crédito</td>
                <td className="px-6 py-3.5">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 bg-slate-100 rounded text-xs font-black text-slate-900">
                      {asset1?.rating_normalizado || asset1?.rating || 'Sem Rating'}
                    </span>
                    {comparison?.ratingWinner === 1 && (
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[10px] font-bold">
                        Menor Risco
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-3.5">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 bg-slate-100 rounded text-xs font-black text-slate-900">
                      {asset2?.rating_normalizado || asset2?.rating || 'Sem Rating'}
                    </span>
                    {comparison?.ratingWinner === 2 && (
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[10px] font-bold">
                        Menor Risco
                      </span>
                    )}
                  </div>
                </td>
              </tr>

              {/* Duration */}
              <tr className="hover:bg-slate-50/60">
                <td className="px-6 py-3.5 font-bold text-slate-600">Duration Modificada</td>
                <td className="px-6 py-3.5">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold font-mono">
                      {asset1?.duration ? `${parseFloat(asset1.duration).toFixed(2)} anos` : '-'}
                    </span>
                    {comparison?.durWinner === 1 && (
                      <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded text-[10px] font-bold">
                        Menor Sensibilidade
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-3.5">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold font-mono">
                      {asset2?.duration ? `${parseFloat(asset2.duration).toFixed(2)} anos` : '-'}
                    </span>
                    {comparison?.durWinner === 2 && (
                      <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded text-[10px] font-bold">
                        Menor Sensibilidade
                      </span>
                    )}
                  </div>
                </td>
              </tr>

              {/* Isenção Fiscal */}
              <tr className="hover:bg-slate-50/60">
                <td className="px-6 py-3.5 font-bold text-slate-600">Isenção Fiscal (IR PF)</td>
                <td className="px-6 py-3.5">
                  {String(asset1?.incentivada || '').toLowerCase() === 'sim' || String(asset1?.lei || '') === '12.431' ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-md font-bold text-xs">
                      <Check size={13} /> Isento (Lei 12.431)
                    </span>
                  ) : (
                    <span className="text-slate-500 text-xs font-medium">Tributado (Regressivo)</span>
                  )}
                </td>
                <td className="px-6 py-3.5">
                  {String(asset2?.incentivada || '').toLowerCase() === 'sim' || String(asset2?.lei || '') === '12.431' ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-md font-bold text-xs">
                      <Check size={13} /> Isento (Lei 12.431)
                    </span>
                  ) : (
                    <span className="text-slate-500 text-xs font-medium">Tributado (Regressivo)</span>
                  )}
                </td>
              </tr>

              {/* Vencimento */}
              <tr className="hover:bg-slate-50/60">
                <td className="px-6 py-3.5 font-bold text-slate-600">Data de Vencimento</td>
                <td className="px-6 py-3.5 font-mono font-medium">{asset1?.vencimento || '-'}</td>
                <td className="px-6 py-3.5 font-mono font-medium">{asset2?.vencimento || '-'}</td>
              </tr>

              {/* Código ISIN */}
              <tr className="hover:bg-slate-50/60">
                <td className="px-6 py-3.5 font-bold text-slate-600">Código ISIN</td>
                <td className="px-6 py-3.5 font-mono text-xs text-slate-600">{asset1?.isin || '-'}</td>
                <td className="px-6 py-3.5 font-mono text-xs text-slate-600">{asset2?.isin || '-'}</td>
              </tr>

              {/* Setor */}
              <tr className="hover:bg-slate-50/60">
                <td className="px-6 py-3.5 font-bold text-slate-600">Setor Econômico</td>
                <td className="px-6 py-3.5 font-medium">{asset1?.setor || '-'}</td>
                <td className="px-6 py-3.5 font-medium">{asset2?.setor || '-'}</td>
              </tr>

              {/* Link para Raio-X individual */}
              <tr className="bg-slate-50/40">
                <td className="px-6 py-4 font-bold text-slate-600">Página do Ativo</td>
                <td className="px-6 py-4">
                  {asset1?.ticker && (
                    <Link
                      to={`/asset/${asset1.ticker}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition"
                    >
                      <span>Ver {asset1.ticker}</span>
                      <ExternalLink size={13} />
                    </Link>
                  )}
                </td>
                <td className="px-6 py-4">
                  {asset2?.ticker && (
                    <Link
                      to={`/asset/${asset2.ticker}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition"
                    >
                      <span>Ver {asset2.ticker}</span>
                      <ExternalLink size={13} />
                    </Link>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Busca do Ativo 1 */}
      {isSearching1 && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-slate-900 text-base">Selecionar Ativo 1</h3>
              <button onClick={() => setIsSearching1(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                autoFocus
                placeholder="Digite o Ticker ou Emissor (ex: VALE38, BBRK12)..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 text-xs">
              {searchResults.map(a => (
                <button
                  key={a.ticker}
                  onClick={() => {
                    updateTickers(a.ticker, ticker2);
                    setIsSearching1(false);
                  }}
                  className="w-full text-left p-2.5 hover:bg-blue-50 transition flex items-center justify-between"
                >
                  <div>
                    <strong className="font-mono text-slate-900 block">{a.ticker}</strong>
                    <span className="text-slate-500 truncate max-w-xs block">{a.issuer}</span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                    {a.tipo}
                  </span>
                </button>
              ))}
              {searchQuery && searchResults.length === 0 && (
                <p className="p-4 text-center text-slate-400">Nenhum ativo encontrado para esta busca.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Busca do Ativo 2 */}
      {isSearching2 && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-slate-900 text-base">Selecionar Ativo 2</h3>
              <button onClick={() => setIsSearching2(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                autoFocus
                placeholder="Digite o Ticker ou Emissor (ex: VALEC0, PETR28)..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 text-xs">
              {searchResults.map(a => (
                <button
                  key={a.ticker}
                  onClick={() => {
                    updateTickers(ticker1, a.ticker);
                    setIsSearching2(false);
                  }}
                  className="w-full text-left p-2.5 hover:bg-indigo-50 transition flex items-center justify-between"
                >
                  <div>
                    <strong className="font-mono text-slate-900 block">{a.ticker}</strong>
                    <span className="text-slate-500 truncate max-w-xs block">{a.issuer}</span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                    {a.tipo}
                  </span>
                </button>
              ))}
              {searchQuery && searchResults.length === 0 && (
                <p className="p-4 text-center text-slate-400">Nenhum ativo encontrado para esta busca.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
