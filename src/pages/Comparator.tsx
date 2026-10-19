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
  X,
  AlertTriangle,
  HelpCircle,
  Plus
} from 'lucide-react';
import { fetchCSV, Asset, normalizeRating } from '../utils/csv';

interface DevedorKPIs {
  altman_z_score?: number;
  altman_zona?: string;
  alavancagem_dl_ebitda?: number;
  cobertura_juros_ebitda?: number;
}

interface DevedorItem {
  cnpj?: string;
  razao_social?: string;
  nome_fantasia?: string;
  kpis_resumo?: DevedorKPIs;
}

export default function ComparatorPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [devedoresMap, setDevedoresMap] = useState<Record<string, DevedorKPIs>>({});
  const [loading, setLoading] = useState(true);

  // Seleção de ativos (por padrão VAZIO, a menos que venha na URL)
  const [ticker1, setTicker1] = useState(searchParams.get('ativo1')?.toUpperCase() || '');
  const [ticker2, setTicker2] = useState(searchParams.get('ativo2')?.toUpperCase() || '');

  // Modais de busca
  const [isSearching1, setIsSearching1] = useState(false);
  const [isSearching2, setIsSearching2] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    document.title = 'Comparador de Debêntures, CRIs e CRAs | FIXDATA';
    
    // Carrega assets_master.csv e devedores_raiox.json em paralelo
    Promise.all([
      fetchCSV<Asset>('/data/assets_master.csv'),
      fetch('/data/devedores_raiox.json')
        .then(r => r.ok ? r.json() : null)
        .catch(() => null)
    ])
      .then(([assetsData, raioxData]) => {
        setAssets(assetsData || []);

        if (raioxData?.devedores && Array.isArray(raioxData.devedores)) {
          const map: Record<string, DevedorKPIs> = {};
          raioxData.devedores.forEach((d: DevedorItem) => {
            if (d.cnpj && d.kpis_resumo) {
              const cleanCnpj = d.cnpj.replace(/\D/g, '');
              map[cleanCnpj] = d.kpis_resumo;
            }
          });
          setDevedoresMap(map);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Erro ao carregar dados do comparador:', err);
        setLoading(false);
      });
  }, []);

  // Atualizar URL params ao mudar de ativo
  const updateTickers = (t1: string, t2: string) => {
    setTicker1(t1);
    setTicker2(t2);
    const params: { ativo1?: string; ativo2?: string } = {};
    if (t1) params.ativo1 = t1;
    if (t2) params.ativo2 = t2;
    setSearchParams(params);
  };

  const asset1 = useMemo(() => {
    if (!ticker1) return null;
    return assets.find(a => a.ticker?.toUpperCase() === ticker1);
  }, [assets, ticker1]);

  const asset2 = useMemo(() => {
    if (!ticker2) return null;
    return assets.find(a => a.ticker?.toUpperCase() === ticker2);
  }, [assets, ticker2]);

  // Lista para busca com priorização por ticker e emissor
  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || !assets.length) return [];
    const term = searchQuery.trim().toLowerCase();
    return assets
      .filter(a => {
        const matchTicker = (a.ticker || '').toLowerCase().includes(term);
        const matchIssuer = (a.issuer || '').toLowerCase().includes(term);
        return matchTicker || matchIssuer;
      })
      .slice(0, 20);
  }, [assets, searchQuery]);

  // Hierarquia de Ratings para comparação (quanto menor o índice, melhor a nota)
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
    if (val === undefined || val === null || val === '') return null;
    if (typeof val === 'number') return isNaN(val) ? null : val;
    const clean = String(val).replace('%', '').replace(',', '.').trim();
    const n = parseFloat(clean);
    return isNaN(n) ? null : n;
  };

  const formatCurrency = (val?: number | string | null) => {
    const n = parseNum(val);
    if (n === null) return 'N/D';
    return `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Calcula prazo restante em anos a partir da data de vencimento
  const getPrazoAnosDesc = (vctoStr?: string) => {
    if (!vctoStr) return '';
    try {
      let targetDate: Date;
      if (vctoStr.includes('/')) {
        const [d, m, y] = vctoStr.split('/');
        targetDate = new Date(`${y}-${m}-${d}`);
      } else {
        targetDate = new Date(vctoStr);
      }
      const diffMs = targetDate.getTime() - new Date().getTime();
      const anos = diffMs / (1000 * 60 * 60 * 24 * 365.25);
      if (anos <= 0) return '(Vencido)';
      return `(${anos.toFixed(1).replace('.', ',')} anos)`;
    } catch {
      return '';
    }
  };

  // Validação de compatibilidade de indexador
  const normalizaIndexador = (idx?: string) => {
    if (!idx) return '';
    const up = idx.toUpperCase().trim();
    if (up.includes('IPCA')) return 'IPCA';
    if (up.includes('DI+') || up.includes('CDI+') || up === 'DI' || up === 'CDI') return 'CDI+';
    if (up.includes('DI%') || up.includes('%DI') || up.includes('% DO CDI')) return '%CDI';
    if (up.includes('PRÉ') || up.includes('PRE')) return 'Pré';
    if (up.includes('IGP')) return 'IGP-M';
    return up;
  };

  const idx1 = normalizaIndexador(asset1?.indexador);
  const idx2 = normalizaIndexador(asset2?.indexador);
  const indexadoresIncompatíveis = Boolean(asset1 && asset2 && idx1 && idx2 && idx1 !== idx2);

  // Financials / Altman Z-Score dos emissores
  const financials1 = useMemo(() => {
    if (!asset1?.cnpj_emissor) return null;
    const clean = String(asset1.cnpj_emissor).replace(/\D/g, '');
    return devedoresMap[clean] || null;
  }, [asset1, devedoresMap]);

  const financials2 = useMemo(() => {
    if (!asset2?.cnpj_emissor) return null;
    const clean = String(asset2.cnpj_emissor).replace(/\D/g, '');
    return devedoresMap[clean] || null;
  }, [asset2, devedoresMap]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl space-y-6 animate-fade-in font-sans">
      {/* Cabeçalho */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold border border-blue-100">
              <Scale size={14} />
              <span>Análise Quantitativa Lado a Lado</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Comparador de Títulos de Crédito Privado
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 font-medium max-w-3xl">
              Selecione dois ativos para comparar taxas indicativas, prêmio sobre NTN-B, notas de rating, duration modificada e solidez de crédito do emissor.
            </p>
          </div>

          {(asset1 || asset2) && (
            <button
              onClick={() => updateTickers('', '')}
              className="px-3.5 py-1.5 text-xs font-bold text-slate-500 hover:text-red-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition shrink-0"
            >
              Limpar Comparação
            </button>
          )}
        </div>

        {/* Seleção dos 2 Ativos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          {/* Card Ativo 1 */}
          <div className={`p-5 rounded-2xl border transition-all ${asset1 ? 'bg-slate-50/80 border-blue-300 shadow-2xs' : 'bg-slate-50 border-dashed border-slate-300 hover:border-blue-400'}`}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Ativo 1</span>
              {asset1 && (
                <button
                  onClick={() => updateTickers('', ticker2)}
                  className="text-slate-400 hover:text-red-500 p-1"
                  title="Remover Ativo 1"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {asset1 ? (
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-black text-slate-900 font-mono tracking-tight">{asset1.ticker}</h2>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                      {asset1.tipo}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-700 mt-1 truncate max-w-sm" title={asset1.issuer}>
                    {asset1.issuer}
                  </p>
                </div>
                <button
                  onClick={() => { setSearchQuery(''); setIsSearching1(true); }}
                  className="px-3 py-1.5 bg-white border border-slate-300 hover:border-blue-500 rounded-xl text-xs font-bold text-slate-700 transition shrink-0 shadow-2xs"
                >
                  Trocar
                </button>
              </div>
            ) : (
              <button
                onClick={() => { setSearchQuery(''); setIsSearching1(true); }}
                className="w-full py-6 flex flex-col items-center justify-center gap-2 text-slate-500 hover:text-blue-600 transition"
              >
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                  <Plus size={20} />
                </div>
                <span className="text-xs font-bold">Clique para selecionar o primeiro ativo</span>
              </button>
            )}
          </div>

          {/* Card Ativo 2 */}
          <div className={`p-5 rounded-2xl border transition-all ${asset2 ? 'bg-slate-50/80 border-indigo-300 shadow-2xs' : 'bg-slate-50 border-dashed border-slate-300 hover:border-indigo-400'}`}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Ativo 2</span>
              {asset2 && (
                <button
                  onClick={() => updateTickers(ticker1, '')}
                  className="text-slate-400 hover:text-red-500 p-1"
                  title="Remover Ativo 2"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {asset2 ? (
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-black text-slate-900 font-mono tracking-tight">{asset2.ticker}</h2>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800">
                      {asset2.tipo}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-700 mt-1 truncate max-w-sm" title={asset2.issuer}>
                    {asset2.issuer}
                  </p>
                </div>
                <button
                  onClick={() => { setSearchQuery(''); setIsSearching2(true); }}
                  className="px-3 py-1.5 bg-white border border-slate-300 hover:border-indigo-500 rounded-xl text-xs font-bold text-slate-700 transition shrink-0 shadow-2xs"
                >
                  Trocar
                </button>
              </div>
            ) : (
              <button
                onClick={() => { setSearchQuery(''); setIsSearching2(true); }}
                className="w-full py-6 flex flex-col items-center justify-center gap-2 text-slate-500 hover:text-indigo-600 transition"
              >
                <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                  <Plus size={20} />
                </div>
                <span className="text-xs font-bold">Clique para selecionar o segundo ativo</span>
              </button>
            )}
          </div>
        </div>

        {/* Aviso de Incompatibilidade de Indexador */}
        {indexadoresIncompatíveis && (
          <div className="bg-amber-50 text-amber-900 rounded-2xl p-4 border border-amber-200 shadow-2xs flex items-start gap-3 animate-fade-in">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed space-y-0.5">
              <strong className="block font-bold">Incompatibilidade Metodológica de Indexadores:</strong>
              <p>
                Os papéis selecionados possuem bases de remuneração distintas (<strong>{asset1?.indexador}</strong> vs <strong>{asset2?.indexador}</strong>).
                A comparação matemática direta de taxas e prêmio de risco é restrita a ativos do mesmo indexador (ex: IPCA vs IPCA ou CDI vs CDI). As métricas de taxa e spread estão sinalizadas como não comparáveis.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Tabela Comparativa Lado a Lado */}
      {asset1 && asset2 ? (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-base sm:text-lg font-black text-slate-900">
              Quadro Comparativo de Indicadores
            </h2>
            <div className="flex items-center gap-3 text-xs">
              <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                <Check size={14} className="text-emerald-600 stroke-[3]" /> Vantagem Relativa
              </span>
              <span className="inline-flex items-center gap-1 font-semibold text-rose-700">
                <X size={14} className="text-rose-500 stroke-[3]" /> Desvantagem
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/90 text-slate-700 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                  <th className="px-4 py-3 w-2/5">Indicador</th>
                  <th className="px-4 py-3 w-[30%] text-center font-mono text-xs text-blue-700">
                    {asset1.ticker}
                  </th>
                  <th className="px-4 py-3 w-[30%] text-center font-mono text-xs text-indigo-700">
                    {asset2.ticker}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {/* 1. Taxa Indicativa de Mercado */}
                {(() => {
                  const t1 = parseNum(asset1.taxa_mercado) ?? parseNum(asset1.taxa_emissao);
                  const t2 = parseNum(asset2.taxa_mercado) ?? parseNum(asset2.taxa_emissao);
                  const canCompare = !indexadoresIncompatíveis && t1 !== null && t2 !== null;
                  const win1 = canCompare && t1! > t2!;
                  const win2 = canCompare && t2! > t1!;

                  return (
                    <tr className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 font-semibold text-slate-800">
                        <div className="flex items-center gap-1.5" title="Taxa indicativa apurada pela ANBIMA ou taxa contratual de emissão.">
                          <span>Taxa Indicativa</span>
                          <HelpCircle size={13} className="text-slate-400" />
                        </div>
                      </td>
                      <td className={`px-4 py-3 text-center font-mono font-bold whitespace-nowrap ${win1 ? 'bg-emerald-50/60 text-emerald-900' : win2 ? 'text-slate-600' : 'text-slate-900'}`}>
                        <div className="flex items-center justify-center gap-1.5">
                          {win1 && <Check size={14} className="text-emerald-600 stroke-[3]" />}
                          {win2 && <X size={14} className="text-rose-500 stroke-[3]" />}
                          <span>{t1 !== null ? `${t1.toFixed(2)}% a.a.` : 'N/D'}</span>
                        </div>
                      </td>
                      <td className={`px-4 py-3 text-center font-mono font-bold whitespace-nowrap ${win2 ? 'bg-emerald-50/60 text-emerald-900' : win1 ? 'text-slate-600' : 'text-slate-900'}`}>
                        <div className="flex items-center justify-center gap-1.5">
                          {win2 && <Check size={14} className="text-emerald-600 stroke-[3]" />}
                          {win1 && <X size={14} className="text-rose-500 stroke-[3]" />}
                          <span>{t2 !== null ? `${t2.toFixed(2)}% a.a.` : 'N/D'}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })()}

                {/* 2. Spread sobre a Curva Soberana NTN-B */}
                {(() => {
                  const s1 = parseNum(asset1.spread);
                  const s2 = parseNum(asset2.spread);
                  const isIpca = idx1 === 'IPCA' && idx2 === 'IPCA';
                  const canCompare = isIpca && s1 !== null && s2 !== null;
                  const win1 = canCompare && s1! > s2!;
                  const win2 = canCompare && s2! > s1!;

                  return (
                    <tr className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 font-semibold text-slate-800">
                        <div className="flex items-center gap-1.5" title="Prêmio de risco adicional sobre a taxa da NTN-B soberana interpolada na mesma duration.">
                          <span>Spread vs NTN-B</span>
                          <HelpCircle size={13} className="text-slate-400" />
                        </div>
                      </td>
                      <td className={`px-4 py-3 text-center font-mono font-bold whitespace-nowrap ${win1 ? 'bg-emerald-50/60 text-emerald-900' : win2 ? 'text-slate-600' : 'text-slate-900'}`}>
                        <div className="flex items-center justify-center gap-1.5">
                          {win1 && <Check size={14} className="text-emerald-600 stroke-[3]" />}
                          {win2 && <X size={14} className="text-rose-500 stroke-[3]" />}
                          <span>{s1 !== null ? `${s1 > 0 ? '+' : ''}${s1.toFixed(2)}%` : 'N/A'}</span>
                        </div>
                      </td>
                      <td className={`px-4 py-3 text-center font-mono font-bold whitespace-nowrap ${win2 ? 'bg-emerald-50/60 text-emerald-900' : win1 ? 'text-slate-600' : 'text-slate-900'}`}>
                        <div className="flex items-center justify-center gap-1.5">
                          {win2 && <Check size={14} className="text-emerald-600 stroke-[3]" />}
                          {win1 && <X size={14} className="text-rose-500 stroke-[3]" />}
                          <span>{s2 !== null ? `${s2 > 0 ? '+' : ''}${s2.toFixed(2)}%` : 'N/A'}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })()}

                {/* 3. Rating de Crédito */}
                {(() => {
                  const r1 = normalizeRating(asset1.rating);
                  const r2 = normalizeRating(asset2.rating);
                  const rank1 = ratingRank(r1);
                  const rank2 = ratingRank(r2);
                  const canCompare = rank1 !== 999 && rank2 !== 999;
                  const win1 = canCompare && rank1 < rank2;
                  const win2 = canCompare && rank2 < rank1;

                  return (
                    <tr className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 font-semibold text-slate-800">
                        <div className="flex items-center gap-1.5" title="Classificação de risco de crédito unificada das agências Fitch, Moody's e S&P.">
                          <span>Rating de Crédito</span>
                          <HelpCircle size={13} className="text-slate-400" />
                        </div>
                      </td>
                      <td className={`px-4 py-3 text-center font-mono font-bold ${win1 ? 'bg-emerald-50/60 text-emerald-900' : win2 ? 'text-slate-600' : 'text-slate-900'}`}>
                        <div className="flex items-center justify-center gap-1.5">
                          {win1 && <Check size={14} className="text-emerald-600 stroke-[3]" />}
                          {win2 && <X size={14} className="text-rose-500 stroke-[3]" />}
                          <span>{r1 || 'Sem Rating'}</span>
                        </div>
                      </td>
                      <td className={`px-4 py-3 text-center font-mono font-bold ${win2 ? 'bg-emerald-50/60 text-emerald-900' : win1 ? 'text-slate-600' : 'text-slate-900'}`}>
                        <div className="flex items-center justify-center gap-1.5">
                          {win2 && <Check size={14} className="text-emerald-600 stroke-[3]" />}
                          {win1 && <X size={14} className="text-rose-500 stroke-[3]" />}
                          <span>{r2 || 'Sem Rating'}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })()}

                {/* 4. Solvência do Emissor (Altman Z'' Score) */}
                {(() => {
                  const z1 = financials1?.altman_z_score;
                  const z2 = financials2?.altman_z_score;
                  const canCompare = z1 !== undefined && z2 !== undefined;
                  const win1 = canCompare && z1 > z2;
                  const win2 = canCompare && z2 > z1;

                  return (
                    <tr className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 font-semibold text-slate-800">
                        <div className="flex items-center gap-1.5" title="Modelo de previsão de solvência Altman Z'' (valores acima de 2,6 indicam zona segura; abaixo de 1,1 indicam estresse).">
                          <span>Solvência do Emissor (Altman Z'')</span>
                          <HelpCircle size={13} className="text-slate-400" />
                        </div>
                      </td>
                      <td className={`px-4 py-3 text-center font-mono font-bold ${win1 ? 'bg-emerald-50/60 text-emerald-900' : win2 ? 'text-slate-600' : 'text-slate-900'}`}>
                        <div className="flex items-center justify-center gap-1.5">
                          {win1 && <Check size={14} className="text-emerald-600 stroke-[3]" />}
                          {win2 && <X size={14} className="text-rose-500 stroke-[3]" />}
                          <span>{z1 !== undefined ? `${z1.toFixed(2)} (${financials1?.altman_zona?.split(' ')[0] || ''})` : 'N/D'}</span>
                        </div>
                      </td>
                      <td className={`px-4 py-3 text-center font-mono font-bold ${win2 ? 'bg-emerald-50/60 text-emerald-900' : win1 ? 'text-slate-600' : 'text-slate-900'}`}>
                        <div className="flex items-center justify-center gap-1.5">
                          {win2 && <Check size={14} className="text-emerald-600 stroke-[3]" />}
                          {win1 && <X size={14} className="text-rose-500 stroke-[3]" />}
                          <span>{z2 !== undefined ? `${z2.toFixed(2)} (${financials2?.altman_zona?.split(' ')[0] || ''})` : 'N/D'}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })()}

                {/* 5. Isenção Fiscal de Imposto de Renda */}
                {(() => {
                  const isIsento1 = asset1.tipo === 'CRI' || asset1.tipo === 'CRA' || asset1.incentivada_lei_12431 === '1' || asset1.incentivada_lei_12431 === 1;
                  const isIsento2 = asset2.tipo === 'CRI' || asset2.tipo === 'CRA' || asset2.incentivada_lei_12431 === '1' || asset2.incentivada_lei_12431 === 1;
                  const win1 = isIsento1 && !isIsento2;
                  const win2 = isIsento2 && !isIsento1;

                  return (
                    <tr className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 font-semibold text-slate-800">
                        <div className="flex items-center gap-1.5" title="Isenção de IR para pessoa física (Lei 12.431/11 ou lastros imobiliários/agrícolas CRI/CRA).">
                          <span>Isenção de IR (Pessoa Física)</span>
                          <HelpCircle size={13} className="text-slate-400" />
                        </div>
                      </td>
                      <td className={`px-4 py-3 text-center font-bold ${win1 ? 'bg-emerald-50/60 text-emerald-900' : win2 ? 'text-slate-600' : 'text-slate-900'}`}>
                        <div className="flex items-center justify-center gap-1.5">
                          {win1 && <Check size={14} className="text-emerald-600 stroke-[3]" />}
                          {win2 && <X size={14} className="text-rose-500 stroke-[3]" />}
                          <span>{isIsento1 ? 'Isento de IR' : 'Tributado (15%-22,5%)'}</span>
                        </div>
                      </td>
                      <td className={`px-4 py-3 text-center font-bold ${win2 ? 'bg-emerald-50/60 text-emerald-900' : win1 ? 'text-slate-600' : 'text-slate-900'}`}>
                        <div className="flex items-center justify-center gap-1.5">
                          {win2 && <Check size={14} className="text-emerald-600 stroke-[3]" />}
                          {win1 && <X size={14} className="text-rose-500 stroke-[3]" />}
                          <span>{isIsento2 ? 'Isento de IR' : 'Tributado (15%-22,5%)'}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })()}

                {/* 6. Duration Modificada */}
                {(() => {
                  const d1 = parseNum(asset1.duration);
                  const d2 = parseNum(asset2.duration);

                  return (
                    <tr className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 font-semibold text-slate-800">
                        <div className="flex items-center gap-1.5" title="Prazo médio ponderado de recebimento dos fluxos de caixa em anos (mede sensibilidade à curva de juros).">
                          <span>Duration Modificada</span>
                          <HelpCircle size={13} className="text-slate-400" />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center font-mono font-medium text-slate-800">
                        {d1 !== null ? `${d1.toFixed(2)} anos` : 'N/D'}
                      </td>
                      <td className="px-4 py-3 text-center font-mono font-medium text-slate-800">
                        {d2 !== null ? `${d2.toFixed(2)} anos` : 'N/D'}
                      </td>
                    </tr>
                  );
                })()}

                {/* 7. Data de Vencimento & Anos Restantes */}
                <tr className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-3 font-semibold text-slate-800">
                    <div className="flex items-center gap-1.5" title="Data final de vencimento do título com o prazo remanescente em anos.">
                      <span>Vencimento</span>
                      <HelpCircle size={13} className="text-slate-400" />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center font-mono font-medium text-slate-800">
                    {asset1.vencimento ? `${asset1.vencimento} ${getPrazoAnosDesc(asset1.vencimento)}` : 'N/D'}
                  </td>
                  <td className="px-4 py-3 text-center font-mono font-medium text-slate-800">
                    {asset2.vencimento ? `${asset2.vencimento} ${getPrazoAnosDesc(asset2.vencimento)}` : 'N/D'}
                  </td>
                </tr>

                {/* 8. PU Par do Dia */}
                <tr className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-3 font-semibold text-slate-800">
                    <div className="flex items-center gap-1.5" title="Preço Unitário Par teórico atualizado com juros e amortizações contratuais.">
                      <span>PU Par do Dia</span>
                      <HelpCircle size={13} className="text-slate-400" />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center font-mono font-medium text-slate-800">
                    {formatCurrency(asset1.pu_par || asset1.pu)}
                  </td>
                  <td className="px-4 py-3 text-center font-mono font-medium text-slate-800">
                    {formatCurrency(asset2.pu_par || asset2.pu)}
                  </td>
                </tr>

                {/* 9. PU Médio de Mercado (B3) */}
                <tr className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-3 font-semibold text-slate-800">
                    <div className="flex items-center gap-1.5" title="Preço Unitário mediano apurado nas negociações executadas na B3.">
                      <span>PU Médio de Mercado</span>
                      <HelpCircle size={13} className="text-slate-400" />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center font-mono font-medium text-slate-800">
                    {formatCurrency(asset1.pu_mercado_mediano || asset1.pu_mercado)}
                  </td>
                  <td className="px-4 py-3 text-center font-mono font-medium text-slate-800">
                    {formatCurrency(asset2.pu_mercado_mediano || asset2.pu_mercado)}
                  </td>
                </tr>

                {/* 10. Ágio / Deságio sobre o Par */}
                {(() => {
                  const ad1 = parseNum(asset1.agio_desagio_pct);
                  const ad2 = parseNum(asset2.agio_desagio_pct);
                  const canCompare = ad1 !== null && ad2 !== null;
                  // Deságio (ad < 0) é compra com desconto = vantagem
                  const win1 = canCompare && ad1! < ad2!;
                  const win2 = canCompare && ad2! < ad1!;

                  return (
                    <tr className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 font-semibold text-slate-800">
                        <div className="flex items-center gap-1.5" title="Relação percentual entre o preço praticado de mercado e o PU Par (valores negativos indicam desconto/deságio).">
                          <span>Ágio / Deságio vs Par</span>
                          <HelpCircle size={13} className="text-slate-400" />
                        </div>
                      </td>
                      <td className={`px-4 py-3 text-center font-mono font-bold ${win1 ? 'bg-emerald-50/60 text-emerald-900' : win2 ? 'text-slate-600' : 'text-slate-900'}`}>
                        <div className="flex items-center justify-center gap-1.5">
                          {win1 && <Check size={14} className="text-emerald-600 stroke-[3]" />}
                          {win2 && <X size={14} className="text-rose-500 stroke-[3]" />}
                          <span>{ad1 !== null ? `${ad1 > 0 ? '+' : ''}${ad1.toFixed(2)}%` : 'N/D'}</span>
                        </div>
                      </td>
                      <td className={`px-4 py-3 text-center font-mono font-bold ${win2 ? 'bg-emerald-50/60 text-emerald-900' : win1 ? 'text-slate-600' : 'text-slate-900'}`}>
                        <div className="flex items-center justify-center gap-1.5">
                          {win2 && <Check size={14} className="text-emerald-600 stroke-[3]" />}
                          {win1 && <X size={14} className="text-rose-500 stroke-[3]" />}
                          <span>{ad2 !== null ? `${ad2 > 0 ? '+' : ''}${ad2.toFixed(2)}%` : 'N/D'}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })()}

                {/* 11. Liquidez Secundária na B3 */}
                {(() => {
                  const b3_1 = asset1.flag_b3 === 1 || asset1.flag_b3 === '1';
                  const b3_2 = asset2.flag_b3 === 1 || asset2.flag_b3 === '1';
                  const win1 = b3_1 && !b3_2;
                  const win2 = b3_2 && !b3_1;

                  return (
                    <tr className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 font-semibold text-slate-800">
                        <div className="flex items-center gap-1.5" title="Indica se o título registra negócios secundários e liquidez custodiada na B3.">
                          <span>Negociado na B3</span>
                          <HelpCircle size={13} className="text-slate-400" />
                        </div>
                      </td>
                      <td className={`px-4 py-3 text-center font-bold ${win1 ? 'bg-emerald-50/60 text-emerald-900' : win2 ? 'text-slate-600' : 'text-slate-900'}`}>
                        <div className="flex items-center justify-center gap-1.5">
                          {win1 && <Check size={14} className="text-emerald-600 stroke-[3]" />}
                          {win2 && <X size={14} className="text-rose-500 stroke-[3]" />}
                          <span>{b3_1 ? 'Sim (Mercado Secundário)' : 'Apenas Balcão / Custódia'}</span>
                        </div>
                      </td>
                      <td className={`px-4 py-3 text-center font-bold ${win2 ? 'bg-emerald-50/60 text-emerald-900' : win1 ? 'text-slate-600' : 'text-slate-900'}`}>
                        <div className="flex items-center justify-center gap-1.5">
                          {win2 && <Check size={14} className="text-emerald-600 stroke-[3]" />}
                          {win1 && <X size={14} className="text-rose-500 stroke-[3]" />}
                          <span>{b3_2 ? 'Sim (Mercado Secundário)' : 'Apenas Balcão / Custódia'}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })()}

                {/* 12. Indexador Contratual */}
                <tr className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-3 font-semibold text-slate-800">
                    <div className="flex items-center gap-1.5" title="Índice de atualização monetária contratual estipulado na escritura.">
                      <span>Indexador</span>
                      <HelpCircle size={13} className="text-slate-400" />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center font-mono font-medium text-slate-800">
                    {asset1.indexador || 'N/D'}
                  </td>
                  <td className="px-4 py-3 text-center font-mono font-medium text-slate-800">
                    {asset2.indexador || 'N/D'}
                  </td>
                </tr>

                {/* 13. Código ISIN */}
                <tr className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-3 font-semibold text-slate-800">
                    <div className="flex items-center gap-1.5" title="Código de identificação internacional do ativo (ISO 6166).">
                      <span>Código ISIN</span>
                      <HelpCircle size={13} className="text-slate-400" />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center font-mono text-[11px] text-slate-600">
                    {asset1.isin || 'N/D'}
                  </td>
                  <td className="px-4 py-3 text-center font-mono text-[11px] text-slate-600">
                    {asset2.isin || 'N/D'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
            <span>Para consultar o dossiê contábil completo do emissor, acesse o Raio-X do Devedor.</span>
            <div className="flex items-center gap-3">
              <Link to={`/asset/${asset1.ticker}`} className="text-blue-600 hover:underline font-bold">
                Raio-X {asset1.ticker} →
              </Link>
              <Link to={`/asset/${asset2.ticker}`} className="text-indigo-600 hover:underline font-bold">
                Raio-X {asset2.ticker} →
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 mx-auto flex items-center justify-center">
            <Scale size={24} />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Selecione os dois títulos para iniciar a comparação</h2>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
            Utilize os cartões acima para buscar por código de negociação (ticker) ou nome da companhia emissora.
          </p>
        </div>
      )}

      {/* Modal de Busca do Ativo 1 */}
      {isSearching1 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 border border-slate-200 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="font-bold text-slate-900 text-sm">Selecionar Ativo 1</span>
              <button onClick={() => setIsSearching1(false)} className="p-1 text-slate-400 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                autoFocus
                placeholder="Digite o código (ex: VALE38) ou nome..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
              {searchResults.length > 0 ? (
                searchResults.map(a => (
                  <button
                    key={`search1-${a.ticker}`}
                    onClick={() => {
                      updateTickers(a.ticker, ticker2);
                      setIsSearching1(false);
                    }}
                    className="w-full p-2.5 text-left hover:bg-slate-50 rounded-lg flex items-center justify-between transition"
                  >
                    <div>
                      <span className="font-mono font-bold text-slate-900 text-xs block">{a.ticker}</span>
                      <span className="text-[11px] text-slate-500 truncate block max-w-xs">{a.issuer}</span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      {a.indexador}
                    </span>
                  </button>
                ))
              ) : (
                <div className="py-6 text-center text-xs text-slate-400">
                  {searchQuery ? 'Nenhum ativo encontrado.' : 'Digite o código ou nome do emissor para buscar.'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Busca do Ativo 2 */}
      {isSearching2 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 border border-slate-200 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="font-bold text-slate-900 text-sm">Selecionar Ativo 2</span>
              <button onClick={() => setIsSearching2(false)} className="p-1 text-slate-400 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                autoFocus
                placeholder="Digite o código (ex: VALEC0) ou nome..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
              {searchResults.length > 0 ? (
                searchResults.map(a => (
                  <button
                    key={`search2-${a.ticker}`}
                    onClick={() => {
                      updateTickers(ticker1, a.ticker);
                      setIsSearching2(false);
                    }}
                    className="w-full p-2.5 text-left hover:bg-slate-50 rounded-lg flex items-center justify-between transition"
                  >
                    <div>
                      <span className="font-mono font-bold text-slate-900 text-xs block">{a.ticker}</span>
                      <span className="text-[11px] text-slate-500 truncate block max-w-xs">{a.issuer}</span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      {a.indexador}
                    </span>
                  </button>
                ))
              ) : (
                <div className="py-6 text-center text-xs text-slate-400">
                  {searchQuery ? 'Nenhum ativo encontrado.' : 'Digite o código ou nome do emissor para buscar.'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
