import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchCSV, Asset, PriceRecord, Emitter, PaymentEvent, AssetDocument, normalizeRating, getRatingBadgeClass, getTipoBadgeClass } from '../utils/csv';
import ChartComponent from '../components/ChartComponent';
import { ArrowLeft, Star, FileText, Calendar, Percent, Building2, Globe, ExternalLink, ShieldCheck, Receipt, CalendarDays, CheckCircle2, Clock, Sparkles, AlertTriangle, TrendingUp, Tag, Landmark, Layers, FileDown, FolderOpen, ArrowRight, Activity, ArrowLeftRight } from 'lucide-react';

const matchEmitter = (issuers: Emitter[], asset: Asset): Emitter | null => {
  const issuerName = (asset.issuer || '').trim();
  const cnpjClean = (asset.cnpj_emissor || '').replace(/\D/g, '');

  if (cnpjClean && cnpjClean.length >= 8) {
    const byCnpj = issuers.find(e => (e.cnpj || '').replace(/\D/g, '') === cnpjClean);
    if (byCnpj) return byCnpj;
  }

  if (issuerName && !['nan', 'none', '-', ''].includes(issuerName.toLowerCase())) {
    const target = issuerName.toLowerCase();
    const exact = issuers.find(e => 
      (e.razao_social && e.razao_social.trim().toLowerCase() === target) ||
      (e.nome_fantasia && e.nome_fantasia.trim().toLowerCase() === target)
    );
    if (exact) return exact;

    const partial = issuers.find(e => {
      const r = (e.razao_social || '').trim().toLowerCase();
      const f = (e.nome_fantasia || '').trim().toLowerCase();
      return (r.length > 3 && target.includes(r)) || (target.length > 3 && r.includes(target)) ||
             (f.length > 3 && target.includes(f)) || (target.length > 3 && f.includes(target));
    });
    if (partial) return partial;

    return {
      cnpj: asset.cnpj_emissor || '-',
      cnpj_formatado: asset.cnpj_emissor || '-',
      razao_social: issuerName,
      nome_fantasia: issuerName,
      setor: asset.setor || 'Crédito Privado',
      tipo_emissor: 'Emissor / Devedor',
      situacao_cvm: 'Ativo',
      descricao: `Emissor/Devedor registrado no mercado de Crédito Privado para a emissão de ${asset.tipo || 'Títulos'} (${asset.ticker}).`
    };
  }

  return null;
};

// Cache em memória para navegação SPA instantânea (0ms) entre ativos
const assetMemoryCache = new Map<string, any>();

const getPreloadedPayload = (targetKey: string, cleanTargetKey: string) => {
  if (typeof document === 'undefined') return null;
  const preloadedEl = document.getElementById('__PRELOADED_ASSET__');
  if (preloadedEl && preloadedEl.textContent) {
    try {
      const payload = JSON.parse(preloadedEl.textContent);
      if (payload && payload.asset) {
        const pTk = (payload.asset.ticker || '').trim().toUpperCase();
        const pIsin = (payload.asset.isin || '').trim().toUpperCase();
        const pTkClean = pTk.replace(/[\s\-]/g, '');
        const pIsinClean = pIsin.replace(/[\s\-]/g, '');

        if (pTk === targetKey || pIsin === targetKey || 
            (cleanTargetKey && (pTkClean === cleanTargetKey || pIsinClean === cleanTargetKey))) {
          return payload;
        }
      }
    } catch (e) {}
  }
  return null;
};

const AssetPage: React.FC = () => {
  const { ticker } = useParams<{ ticker: string }>();
  const targetKey = decodeURIComponent(ticker || '').trim().toUpperCase();
  const cleanTargetKey = targetKey.replace(/[\s\-]/g, '');

  const initialPayload = assetMemoryCache.get(targetKey) || 
                         assetMemoryCache.get(cleanTargetKey) || 
                         getPreloadedPayload(targetKey, cleanTargetKey);

  const [asset, setAsset] = useState<Asset | null>(initialPayload ? initialPayload.asset : null);
  const [emitter, setEmitter] = useState<Emitter | null>(initialPayload ? initialPayload.emitter : null);
  const [prices, setPrices] = useState<PriceRecord[]>(initialPayload ? (initialPayload.prices || []) : []);
  const [paymentEvents, setPaymentEvents] = useState<PaymentEvent[]>(initialPayload ? (initialPayload.paymentEvents || []) : []);
  const [documents, setDocuments] = useState<AssetDocument[]>(initialPayload ? (initialPayload.documents || []) : []);
  const [filterType, setFilterType] = useState<'ALL' | 'JUROS' | 'AMORTIZACAO' | 'FUTUROS'>('ALL');
  const [docFilter, setDocFilter] = useState<'ALL' | 'PROSPECTO' | 'RELATORIO' | 'ASSEMBLEIA'>('ALL');
  const [loading, setLoading] = useState(!initialPayload);
  const [isFavorite, setIsFavorite] = useState(false);

  const formatDatePretty = (dateStr?: string | null) => {
    if (!dateStr) return "-";
  
    let date: Date;
  
    // Se vier no formato brasileiro DD/MM/YYYY
    if (dateStr.includes("/")) {
      const [day, month, year] = dateStr.split("/").map(Number);
      date = new Date(year, month - 1, day);
    } 
    // Se vier no formato ISO YYYY-MM-DD
    else {
      date = new Date(dateStr + "T00:00:00");
    }
  
    if (isNaN(date.getTime())) return "-";
  
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  };

  const formatDurationDisplay = (dur?: string | number | null) => {
    if (!dur) return "-";
    const d = Number(dur);
    if (isNaN(d) || d <= 0) return "-";
    return `${d.toFixed(2)} anos`;
  };

  const formatVolumeDisplay = (vol?: string | number | null) => {
    if (!vol) return "-";
    const v = Number(vol);
    if (isNaN(v) || v <= 0) return "-";
    if (v >= 1e9) {
      return `R$ ${(v / 1e9).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bi`;
    }
    return `R$ ${(v / 1e6).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MM`;
  };

  const formatPUParDisplay = (pu?: string | number | null) => {
    if (!pu) return "R$ 1.000,00";
    const p = Number(String(pu).replace(',', '.'));
    if (isNaN(p) || p <= 0) return "R$ 1.000,00";
    return `R$ ${p.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatPUMercadoDisplay = (pu?: string | number | null) => {
    if (!pu) return "-";
    const p = Number(String(pu).replace(',', '.'));
    if (isNaN(p) || p <= 0) return "-";
    return `R$ ${p.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatTaxaValue = (taxa?: string | number | null, indexador?: string | null) => {
    if (taxa === null || taxa === undefined || taxa === '' || taxa === 'nan' || taxa === 'None') {
      return null;
    }
    const s = String(taxa).trim();
    if (s.toLowerCase() === 'nan' || s.toLowerCase() === 'none' || s === '-') return null;
    const taxaNum = Number(s.replace('%', '').replace(',', '.').trim());
    if (isNaN(taxaNum)) {
      return s !== '-' && s !== 'nan' ? s : null;
    }

    const idx = (indexador || '').trim();
    const idxUp = idx.toUpperCase();

    if (idxUp.includes('IPCA') || idxUp.includes('IGP')) {
      return `${idx} + ${taxaNum.toFixed(2)}% a.a.`;
    }
    if (idx.includes('DI%') || idx.includes('%CDI') || idx === '%DI' || idx.includes('% DI')) {
      return `${taxaNum.toFixed(2)}% do CDI`;
    }
    if (idx.includes('DI+') || idx.includes('CDI+')) {
      return `CDI + ${taxaNum.toFixed(2)}% a.a.`;
    }
    if (idxUp.includes('PRE') || idxUp.includes('PRÉ') || idxUp === 'PRÉ') {
      return `${taxaNum.toFixed(2)}% a.a. Pré`;
    }
    if (idx) {
      if (taxaNum > 25 && (idxUp.includes('DI') || idxUp.includes('CDI'))) {
        return `${taxaNum.toFixed(2)}% do CDI`;
      }
      return `${idx} + ${taxaNum.toFixed(2)}%`.trim();
    }
    return `${taxaNum.toFixed(2)}% a.a.`;
  };

  const formatTaxaDisplay = (a: Asset) => {
    const idx = (a.indexador || '').trim();
    const tMercado = a.taxa_mercado || a.taxa_ativo;
    const tEmissao = a.taxa_emissao;
    const taxaNum = tMercado ? Number(tMercado) : (tEmissao ? Number(tEmissao) : null);
    
    if (taxaNum === null || isNaN(taxaNum)) {
      return idx || 'A definir';
    }

    if (idx.includes('IPCA') || idx.includes('IGP')) {
      return `${idx} + ${taxaNum.toFixed(2)}% a.a.`;
    }
    if (idx.includes('DI%') || idx.includes('%CDI') || idx === '%DI') {
      return `${taxaNum.toFixed(2)}% do CDI`;
    }
    if (idx.includes('DI+') || idx.includes('CDI+')) {
      return `CDI + ${taxaNum.toFixed(2)}% a.a.`;
    }
    if (idx.includes('PRE') || idx.includes('PRÉ') || idx === 'Pré') {
      return `${taxaNum.toFixed(2)}% a.a. Pré`;
    }
    return `${idx} ${taxaNum > 0 ? `+ ${taxaNum.toFixed(2)}%` : ''}`.trim();
  };

  const applyLoadedData = (payload: {
    asset: Asset;
    prices?: PriceRecord[];
    emitter?: Emitter | null;
    paymentEvents?: PaymentEvent[];
    documents?: AssetDocument[];
  }) => {
    const found = payload.asset;
    setAsset(found);
    setPrices(payload.prices || []);
    setEmitter(payload.emitter || null);

    const assetEvents = [...(payload.paymentEvents || [])];
    assetEvents.sort((a, b) => (a.data_evento || '').localeCompare(b.data_evento || ''));
    setPaymentEvents(assetEvents);

    const assetDocs = [...(payload.documents || [])];
    assetDocs.sort((a, b) => {
      const da = (a.data_entrega || a.data_referencia || '').trim();
      const db = (b.data_entrega || b.data_referencia || '').trim();
      return db.localeCompare(da);
    });
    setDocuments(assetDocs);

    // SEO dinâmico por ativo
    const tipoStr = found.tipo || 'Título';
    const emissorStr = found.issuer ? `(${found.issuer})` : '';
    document.title = `${tipoStr} ${found.ticker} ${emissorStr} — Taxas, Spread e Rating | FIXDATA`;

    const metaDesc = document.querySelector('meta[name="description"]');
    const descText = `Análise de ${tipoStr} ${found.ticker} emitida por ${found.issuer || 'Emissor'}. Indexador: ${found.indexador || '-'}, Vencimento: ${found.vencimento || '-'}, Rating: ${found.rating || '-'}. Dados de mercado no FIXDATA.`;
    if (metaDesc) {
      metaDesc.setAttribute('content', descText);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      // 1. FAST PATH 1: Cache em memória (0ms - instantâneo entre cliques)
      const cached = assetMemoryCache.get(targetKey) || assetMemoryCache.get(cleanTargetKey);
      if (cached && cached.asset) {
        applyLoadedData(cached);
        if (!isMounted) return;
        setLoading(false);
        return;
      }

      // 2. FAST PATH 2: Pré-carregado no HTML SSR da página (0ms de rede)
      const preloaded = getPreloadedPayload(targetKey, cleanTargetKey);
      if (preloaded && preloaded.asset) {
        assetMemoryCache.set(targetKey, preloaded);
        if (cleanTargetKey) assetMemoryCache.set(cleanTargetKey, preloaded);
        applyLoadedData(preloaded);
        if (!isMounted) return;
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        // 3. FAST PATH 3: Busca JSON individual pré-processado (~10 KB em vez de 90 MB)
        const tryKeys = [cleanTargetKey, targetKey].filter(Boolean);
        for (const k of tryKeys) {
          try {
            const jsonResp = await fetch(`/data/assets/${encodeURIComponent(k)}.json`);
            const cType = jsonResp.headers.get('content-type') || '';
            if (jsonResp.ok && !cType.includes('text/html')) {
              const payload = await jsonResp.json();
              if (payload && payload.asset) {
                assetMemoryCache.set(targetKey, payload);
                if (cleanTargetKey) assetMemoryCache.set(cleanTargetKey, payload);
                applyLoadedData(payload);
                if (!isMounted) return;
                setLoading(false);
                return;
              }
            }
          } catch (eJson) {}
        }

        // 4. FALLBACK RÁPIDO: Se não houver JSON individual, busca APENAS o cadastro mestre (5 MB)
        // NÃO baixa cricra_documents (47MB) nem schedules (25MB) para não travar a experiência
        const [assetsData, emittersData] = await Promise.all([
          fetchCSV<Asset>('/data/assets_master.csv').catch(() => []),
          fetchCSV<Emitter>('/data/emitters_master.csv').catch(() => [])
        ]);

        if (!isMounted) return;

        const found = assetsData.find(a => {
          const tk = (a.ticker || '').trim().toUpperCase();
          const isin = (a.isin || '').trim().toUpperCase();
          const tkClean = tk.replace(/[\s\-]/g, '');
          const isinClean = isin.replace(/[\s\-]/g, '');
          return tk === targetKey || isin === targetKey || 
                 (cleanTargetKey.length > 0 && (tkClean === cleanTargetKey || isinClean === cleanTargetKey));
        });

        if (found) {
          const matched = matchEmitter(emittersData || [], found);
          const minimalPayload = {
            asset: found,
            emitter: matched,
            prices: [],
            paymentEvents: [],
            documents: []
          };
          applyLoadedData(minimalPayload);
          setLoading(false);

          // 5. LAZY BACKGROUND: Carrega histórico complementar em segundo plano sem bloquear a tela
          const foundTicker = (found.ticker || '').trim().toUpperCase();
          const foundIsin = (found.isin || '').trim().toUpperCase();
          Promise.all([
            fetchCSV<PriceRecord>('/data/prices.csv').catch(() => []),
            fetchCSV<PaymentEvent>('/data/payment_schedules.csv').catch(() => []),
            fetchCSV<AssetDocument>('/data/cricra_documents.csv').catch(() => [])
          ]).then(([pricesData, schedulesData, docsData]) => {
            if (!isMounted) return;
            const assetPrices = (pricesData || []).filter(p => {
              if (!p) return false;
              const pTk = (p.ticker || '').trim().toUpperCase();
              const pIsin = (p.isin || '').trim().toUpperCase();
              return (foundTicker && pTk === foundTicker) || (foundIsin && (pTk === foundIsin || pIsin === foundIsin));
            });
            const assetEvents = (schedulesData || []).filter(e => {
              if (!e) return false;
              const eTk = (e.ticker || '').trim().toUpperCase();
              const eIsin = ((e as any).isin || (e as any).ISIN || '').trim().toUpperCase();
              return (foundTicker && eTk === foundTicker) || (foundIsin && (eTk === foundIsin || eIsin === foundIsin));
            });
            const assetDocs = (docsData || []).filter(d => {
              if (!d) return false;
              const dTk = (d.ticker || '').trim().toUpperCase();
              const dIsin = (d.isin || '').trim().toUpperCase();
              return (foundTicker && dTk === foundTicker) || (foundIsin && (dTk === foundIsin || dIsin === foundIsin));
            });

            const fullPayload = {
              asset: found,
              emitter: matched,
              prices: assetPrices,
              paymentEvents: assetEvents,
              documents: assetDocs
            };
            assetMemoryCache.set(targetKey, fullPayload);
            applyLoadedData(fullPayload);
          }).catch(() => {});
        }

        const saved = localStorage.getItem('watchlist');
        if (saved) {
          const watchlist = (JSON.parse(saved) as string[]).map(t => (t || '').trim().toUpperCase());
          const curTicker = (ticker || '').trim().toUpperCase();
          const cachedAsset = assetMemoryCache.get(targetKey)?.asset;
          const curIsin = (cachedAsset?.isin || '').trim().toUpperCase();
          setIsFavorite(watchlist.includes(curTicker) || (!!curIsin && watchlist.includes(curIsin)));
        }
      } catch (err) {
        console.error("Error loading asset detail", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [ticker]);

  const toggleFavorite = () => {
    const targetTicker = (asset?.ticker || ticker || '').trim().toUpperCase();
    if (!targetTicker) return;

    const saved = localStorage.getItem('watchlist');
    let watchlist = saved ? (JSON.parse(saved) as string[]) : [];
    const isinTarget = (asset?.isin || '').trim().toUpperCase();

    if (isFavorite) {
      watchlist = watchlist.filter(t => {
        const up = (t || '').trim().toUpperCase();
        return up !== targetTicker && up !== isinTarget;
      });
    } else {
      const upList = watchlist.map(t => (t || '').trim().toUpperCase());
      if (!upList.includes(targetTicker)) {
        watchlist.push(targetTicker);
      }
    }

    localStorage.setItem('watchlist', JSON.stringify(watchlist));
    setIsFavorite(!isFavorite);
    window.dispatchEvent(new Event('fixdata-watchlist-update'));
  };

  if (loading) return <div className="p-10 text-center text-slate-600 font-semibold">Carregando dados do ativo...</div>;

  if (!asset) return (
    <div className="p-10 text-center space-y-4">
      <p className="text-xl font-bold text-slate-800">Ativo não encontrado na base de dados.</p>
      <Link to="/" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-bold rounded-xl shadow-sm hover:bg-blue-700 transition">
        <ArrowLeft size={16} /> Voltar para a busca
      </Link>
    </div>
  );

  const normRating = asset.rating_normalizado || normalizeRating(asset.rating);

  const tMercadoVal = asset.taxa_mercado || asset.taxa_negocio_b3 || asset.taxa_indicativa_anbima || (asset.taxa_ativo && asset.taxa_ativo !== asset.taxa_emissao ? asset.taxa_ativo : null);
  const taxaMercadoFormatted = formatTaxaValue(tMercadoVal, asset.indexador);

  const tEmissaoVal = asset.taxa_emissao || (asset.taxa_mercado ? null : asset.taxa_ativo);
  const taxaEmissaoFormatted = formatTaxaValue(tEmissaoVal, asset.indexador);

  const debtorCnpjClean = (emitter?.cnpj || asset.cnpj_emissor || '').replace(/\D/g, '');
  const debtorSearchQuery = (emitter?.nome_fantasia || emitter?.razao_social || asset.issuer || '').trim();
  const debtorRaioXLink = `/raiox-devedor?cnpj=${debtorCnpjClean}&search=${encodeURIComponent(debtorSearchQuery)}`;

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">

      {/* BARRA DE NAVEGAÇÃO SUPERIOR & ABAS DO ATIVO */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-xs">
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 hover:text-blue-600 hover:border-blue-300 font-bold text-xs sm:text-sm transition-all group shrink-0"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform text-blue-600" />
          Voltar para busca
        </Link>

        {/* ABAS / ATALHOS DO ATIVO */}
        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto py-1">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 text-xs font-black shadow-xs border border-blue-200">
            <Tag size={13} />
            Ficha do Ativo
          </span>

          <Link
            to={debtorRaioXLink}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 text-xs font-bold transition border border-slate-200 hover:border-indigo-300 group"
            title="Ir para o Raio-X e Balanço do Devedor"
          >
            <Building2 size={13} className="text-indigo-600 group-hover:scale-110 transition-transform" />
            <span>Raio-X do Devedor</span>
            <span className="px-1.5 py-0.2 bg-indigo-600 text-white text-[9px] font-black rounded-full uppercase">Novo</span>
          </Link>

          <Link
            to={`/negocios?search=${encodeURIComponent(asset.ticker)}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 text-xs font-bold transition border border-slate-200 hover:border-blue-300"
            title="Ver histórico de negócios B3 deste ativo"
          >
            <ArrowLeftRight size={13} className="text-blue-600" />
            Negócios B3
          </Link>

          <a
            href="#secao-precos"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 text-xs font-semibold transition border border-slate-200"
          >
            <TrendingUp size={13} className="text-slate-500" />
            Preços & Taxas
          </a>

          <a
            href="#secao-cronograma"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 text-xs font-semibold transition border border-slate-200"
          >
            <Receipt size={13} className="text-slate-500" />
            Cronograma
          </a>

          <a
            href="#secao-documentos"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 text-xs font-semibold transition border border-slate-200"
          >
            <FileText size={13} className="text-slate-500" />
            Documentos CVM
          </a>
        </div>

        <button
          onClick={toggleFavorite}
          className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-xs shrink-0 ${
            isFavorite
              ? 'bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100'
              : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Star size={16} className={isFavorite ? 'text-amber-500 fill-amber-400' : 'text-slate-400'} />
          {isFavorite ? 'Ativo Salvo' : 'Seguir Ativo'}
        </button>
      </div>

      {/* ================= HERO CARD PRINCIPAL DO ATIVO ================= */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3">
            {/* BADGES SUPERIORES COM CORES VIBRANTES E ALTO CONTRASTE */}
            <div className="flex flex-wrap items-center gap-2.5">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider ${getTipoBadgeClass(asset.tipo)}`}>
                <Tag size={13} />
                {asset.tipo || 'Título de Crédito'}
              </span>

              {asset.incentivada === 'Sim' && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-extrabold bg-emerald-100 text-emerald-950 border border-emerald-300 shadow-sm">
                  <Sparkles size={13} className="text-emerald-700" />
                  Isento de IR (Lei 12.431)
                </span>
              )}

              {asset.em_recuperacao_judicial === 'Sim' && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-black bg-rose-600 text-white shadow-sm animate-pulse">
                  <AlertTriangle size={13} />
                  Em Recuperação Judicial
                </span>
              )}

              {/* RATING BADGE DE ALTO DESTAQUE */}
              <div className="inline-flex items-center gap-1.5 bg-slate-900 text-white px-3 py-1 rounded-lg text-xs font-bold shadow-sm">
                <span className="text-slate-400 text-[11px] uppercase font-semibold">Rating:</span>
                <span className={`px-2 py-0.5 rounded text-xs font-black ${getRatingBadgeClass(normRating)}`}>
                  {normRating}
                </span>
                {asset.agencia && asset.agencia !== '-' && (
                  <span className="text-slate-300 text-[11px] font-medium">({asset.agencia})</span>
                )}
              </div>
            </div>

            {/* TICKER E EMISSOR */}
            <div>
              <h1 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight">
                {asset.ticker}
              </h1>
              <p className="text-lg sm:text-xl font-semibold text-slate-600 mt-0.5">
                {asset.issuer || 'Emissor Privado'}
              </p>
            </div>
          </div>

          {/* PAINEL DE CONDIÇÕES COMERCIAIS: MERCADO vs EMISSÃO */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full lg:w-auto">
            {/* CARD 1: MERCADO SECUNDÁRIO */}
            <div className="bg-gradient-to-br from-blue-50/90 to-indigo-50/60 p-4 sm:p-5 rounded-2xl border border-blue-200/80 shadow-sm flex flex-col justify-between min-w-[220px]">
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-xs font-bold text-blue-700 uppercase tracking-wider flex items-center gap-1.5">
                    <TrendingUp size={14} className="text-blue-600" />
                    Mercado Secundário
                  </span>
                  {asset.data_ultimo_negocio && (
                    <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">
                      {formatDatePretty(asset.data_ultimo_negocio)}
                    </span>
                  )}
                </div>
                <p className="text-2xl sm:text-3xl font-black text-blue-900 font-mono tracking-tight">
                  {taxaMercadoFormatted || 'Sem cotação'}
                </p>
              </div>

              <div className="mt-3 pt-2.5 border-t border-blue-200/60 flex items-center justify-between text-xs">
                <span className="text-slate-600 font-medium">
                  PU Negócio: <strong className="font-mono text-blue-900">{formatPUMercadoDisplay(asset.pu_mercado)}</strong>
                </span>
                {asset.spread && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200">
                    Spread: {Number(asset.spread) > 0 ? '+' : ''}{(Number(asset.spread) * 100).toFixed(2)}%
                  </span>
                )}
              </div>
            </div>

            {/* CARD 2: EMISSÃO CONTRATUAL */}
            <div className="bg-gradient-to-br from-slate-50 to-slate-100/80 p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between min-w-[220px]">
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                    <Percent size={14} className="text-slate-500" />
                    Emissão Contratual
                  </span>
                  <span className="text-[10px] font-bold bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">
                    Escritura
                  </span>
                </div>
                <p className="text-2xl sm:text-3xl font-black text-slate-800 font-mono tracking-tight">
                  {taxaEmissaoFormatted || (asset.indexador || '-')}
                </p>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-200 flex items-center justify-between text-xs">
                <span className="text-slate-600 font-medium">
                  PU Par: <strong className="font-mono text-slate-800">{formatPUParDisplay(asset.pu_emissao || asset.pu)}</strong>
                </span>
                <span className="text-[11px] text-slate-400 font-medium">
                  Condição original
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* GRID DE CARDS KPI (4 MÉTRICAS ESTRUTURAIS LIMPAS - SEM REPETIÇÃO) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 pt-4 border-t border-slate-100">
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 hover:border-blue-200 transition-colors">
            <div className="flex items-center gap-1.5 text-blue-600 mb-1">
              <Percent size={16} />
              <span className="text-[11px] font-bold text-slate-400 uppercase">Indexador</span>
            </div>
            <p className="text-base font-extrabold text-slate-900">{asset.indexador || '-'}</p>
            <span className="text-[11px] text-slate-400 font-medium">Contratual</span>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 hover:border-indigo-200 transition-colors">
            <div className="flex items-center gap-1.5 text-indigo-600 mb-1">
              <Clock size={16} />
              <span className="text-[11px] font-bold text-slate-400 uppercase">Duration</span>
            </div>
            <p className="text-base font-extrabold text-slate-900">
              {formatDurationDisplay(asset.duration)}
            </p>
            <span className="text-[11px] text-indigo-600 font-semibold">{asset.fonte_precificacao || 'DU / 252'}</span>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 hover:border-emerald-200 transition-colors">
            <div className="flex items-center gap-1.5 text-emerald-600 mb-1">
              <Calendar size={16} />
              <span className="text-[11px] font-bold text-slate-400 uppercase">Vencimento</span>
            </div>
            <p className="text-base font-extrabold text-slate-900">{formatDatePretty(asset.vencimento)}</p>
            <span className="text-[11px] text-slate-400 font-medium">Data Final</span>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 hover:border-violet-200 transition-colors">
            <div className="flex items-center gap-1.5 text-violet-600 mb-1">
              <Landmark size={16} />
              <span className="text-[11px] font-bold text-slate-400 uppercase">Volume Total</span>
            </div>
            <p className="text-base font-extrabold text-slate-900">
              {formatVolumeDisplay(asset.volume || asset.volume_emissao)}
            </p>
            <span className="text-[11px] text-slate-400 font-medium">Série Emitida</span>
          </div>
        </div>
      </div>

      {/* ================= ESPECIFICAÇÕES TÉCNICAS DO PAPEL ================= */}
      <div className="bg-slate-900 text-white p-6 sm:p-8 rounded-3xl shadow-xl space-y-6 border border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <h3 className="text-lg sm:text-xl font-black text-white flex items-center gap-2.5">
            <FileText size={20} className="text-blue-400" />
            Especificações Técnicas da Emissão
          </h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs sm:text-sm">
          <div className="p-3.5 bg-slate-800/80 rounded-xl border border-slate-700/70">
            <span className="text-slate-400 text-xs font-bold uppercase block mb-1">Código ISIN</span>
            <p className="font-mono text-sm font-bold text-blue-300">{asset.isin || '-'}</p>
          </div>

          <div className="p-3.5 bg-slate-800/80 rounded-xl border border-slate-700/70">
            <span className="text-slate-400 text-xs font-bold uppercase block mb-1">Emissão / Série</span>
            <p className="font-semibold text-slate-100">{asset.emissao ? `${asset.emissao}ª Emissão` : '-'} / {asset.serie ? `${asset.serie}ª Série` : '-'}</p>
          </div>

          <div className="p-3.5 bg-slate-800/80 rounded-xl border border-slate-700/70">
            <span className="text-slate-400 text-xs font-bold uppercase block mb-1">Data de Emissão</span>
            <p className="font-semibold text-slate-100">{formatDatePretty(asset.data_emissao)}</p>
          </div>

          <div className="p-3.5 bg-slate-800/80 rounded-xl border border-slate-700/70">
            <span className="text-slate-400 text-xs font-bold uppercase block mb-1">Ref. NTN-B (Benchmark)</span>
            <p className="font-semibold text-slate-100">
              {asset.ntnb_referencia ? formatDatePretty(asset.ntnb_referencia) : '-'}
              {asset.taxa_ntnb && <span className="text-blue-300 ml-1 font-mono">({Number(asset.taxa_ntnb).toFixed(2)}%)</span>}
            </p>
          </div>

          <div className="p-3.5 bg-slate-800/80 rounded-xl border border-slate-700/70">
            <span className="text-slate-400 text-xs font-bold uppercase block mb-1">Setor Econômico (ANBIMA)</span>
            <p className="font-semibold text-slate-100">{asset.setor || 'Crédito Privado'}</p>
          </div>

          <div className="p-3.5 bg-slate-800/80 rounded-xl border border-slate-700/70">
            <span className="text-slate-400 text-xs font-bold uppercase block mb-1">Agente Fiduciário</span>
            <p className="font-semibold text-slate-100 truncate" title={asset.agente_fiduciario}>{asset.agente_fiduciario || '-'}</p>
          </div>

          <div className="p-3.5 bg-slate-800/80 rounded-xl border border-slate-700/70">
            <span className="text-slate-400 text-xs font-bold uppercase block mb-1">Coordenador Líder</span>
            <p className="font-semibold text-slate-100 truncate" title={asset.coordenador_lider}>{asset.coordenador_lider || '-'}</p>
          </div>

          <div className="p-3.5 bg-slate-800/80 rounded-xl border border-slate-700/70">
            <span className="text-slate-400 text-xs font-bold uppercase block mb-1">Regime Fiduciário</span>
            <p className="font-semibold text-emerald-400">
              {asset.tipo === 'CRI' || asset.tipo === 'CRA'
                ? 'Patrimônio Separado (Sim)'
                : (asset.incentivada === 'Sim' ? 'Incentivada (Lei 12.431)' : 'Padrão')}
            </p>
          </div>
        </div>
      </div>

        {/* ================= PERFIL DO EMISSOR / DEVEDOR ================= */}
        {emitter && (
          <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <span className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-md uppercase tracking-wider">
                  {emitter.tipo_emissor || 'Emissor / Devedor'}
                </span>
                <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1">
                  {emitter.nome_fantasia || emitter.razao_social}
                </h3>
                {emitter.razao_social && emitter.nome_fantasia && emitter.razao_social !== emitter.nome_fantasia && (
                  <p className="text-xs text-slate-500 font-medium mt-0.5">{emitter.razao_social}</p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <Link
                  to={debtorRaioXLink}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs sm:text-sm font-extrabold rounded-xl transition shadow-xs hover:shadow-md active:scale-95 group"
                  title="Abrir Demonstrações Financeiras, Balanço, Ratings e Risco no Raio-X do Devedor"
                >
                  <Activity size={16} className="text-blue-200 group-hover:scale-110 transition-transform" />
                  <span>Ir para análise do devedor</span>
                  <ArrowRight size={14} className="text-blue-200 group-hover:translate-x-1 transition-transform" />
                </Link>

                {emitter.site_ri && (
                  <a
                    href={emitter.site_ri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 text-xs font-bold rounded-xl transition border border-slate-200 shadow-xs"
                  >
                    <Globe size={15} />
                    Portal RI
                    <ExternalLink size={13} />
                  </a>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-xs text-slate-400 font-bold uppercase block mb-1">CNPJ do Emissor</span>
                <p className="font-mono text-sm font-bold text-slate-800">{emitter.cnpj_formatado || emitter.cnpj}</p>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-xs text-slate-400 font-bold uppercase block mb-1">Setor de Atuação</span>
                <p className="text-sm font-semibold text-slate-800">{emitter.setor || 'Crédito Privado'}</p>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-xs text-slate-400 font-bold uppercase block mb-1">Registro CVM</span>
                <p className="text-sm font-medium text-slate-800">
                  {emitter.categoria_cvm || 'Emissor Registrado'} — <span className="text-emerald-700 font-semibold">{emitter.situacao_cvm || 'Ativo'}</span>
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-xs text-slate-400 font-bold uppercase block mb-1">Sede Corporativa</span>
                <p className="text-sm font-medium text-slate-800">
                  {emitter.municipio ? `${emitter.municipio} / ${emitter.uf}` : (emitter.uf || 'Brasil')}
                </p>
              </div>
            </div>

            {emitter.descricao && (
              <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-100 text-sm text-slate-600 leading-relaxed">
                <p className="font-semibold text-slate-800 mb-1 flex items-center gap-1.5">
                  <Building2 size={16} className="text-blue-600" />
                  Sobre a Empresa:
                </p>
                <p>{emitter.descricao}</p>
              </div>
            )}
          </div>
        )}

        {/* ================= HISTÓRICO DE PREÇOS E TAXAS ================= */}
        <div id="secao-precos">
          <ChartComponent 
            prices={prices} 
            ticker={asset.ticker} 
            indexador={asset.indexador}
          />
        </div>

        {/* ================= CRONOGRAMA DE CUPONS E AMORTIZAÇÕES ================= */}
        <div id="secao-cronograma" className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <span className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-md uppercase tracking-wider">
                Fluxo de Pagamentos & Cronograma
              </span>
              <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1 flex items-center gap-2">
                <Receipt size={22} className="text-blue-600" />
                Agenda de Cupons e Amortizações
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {paymentEvents.length} eventos registrados no histórico e projeção contratual
              </p>
            </div>

            {/* Filtros rápidos */}
            {paymentEvents.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold text-slate-600">
                <button
                  onClick={() => setFilterType('ALL')}
                  className={`px-3 py-1.5 rounded-lg transition ${filterType === 'ALL' ? 'bg-white text-blue-700 shadow-sm font-extrabold' : 'hover:text-slate-900'}`}
                >
                  Todos ({paymentEvents.length})
                </button>
                <button
                  onClick={() => setFilterType('JUROS')}
                  className={`px-3 py-1.5 rounded-lg transition ${filterType === 'JUROS' ? 'bg-white text-blue-700 shadow-sm font-extrabold' : 'hover:text-slate-900'}`}
                >
                  Cupons
                </button>
                <button
                  onClick={() => setFilterType('AMORTIZACAO')}
                  className={`px-3 py-1.5 rounded-lg transition ${filterType === 'AMORTIZACAO' ? 'bg-white text-blue-700 shadow-sm font-extrabold' : 'hover:text-slate-900'}`}
                >
                  Amortizações
                </button>
                <button
                  onClick={() => setFilterType('FUTUROS')}
                  className={`px-3 py-1.5 rounded-lg transition ${filterType === 'FUTUROS' ? 'bg-white text-blue-700 shadow-sm font-extrabold' : 'hover:text-slate-900'}`}
                >
                  Futuros
                </button>
              </div>
            )}
          </div>

          {/* Tabela com dimensão fixa e scroll vertical suave */}
          {paymentEvents.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-500 text-sm">
              Nenhum evento de pagamento registrado para este ativo até o momento.
            </div>
          ) : (
            <div className="relative overflow-x-auto overflow-y-auto max-h-80 rounded-xl border border-slate-200 shadow-inner">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="text-xs uppercase bg-slate-100 text-slate-700 font-bold sticky top-0 z-10 shadow-sm border-b border-slate-200">
                  <tr>
                    <th scope="col" className="px-4 py-3">Data do Evento</th>
                    <th scope="col" className="px-4 py-3">Tipo de Evento</th>
                    <th scope="col" className="px-4 py-3 text-right">Taxa / %</th>
                    <th scope="col" className="px-4 py-3 text-right">Valor Pago (R$)</th>
                    <th scope="col" className="px-4 py-3 text-center">Status</th>
                    <th scope="col" className="px-4 py-3">Fonte</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {paymentEvents
                    .filter(ev => {
                      if (filterType === 'JUROS') {
                        return (ev.tipo_evento || '').toLowerCase().includes('juros') || (ev.tipo_evento || '').toLowerCase().includes('cupom');
                      }
                      if (filterType === 'AMORTIZACAO') {
                        return (ev.tipo_evento || '').toLowerCase().includes('amortiza') || (ev.tipo_evento || '').toLowerCase().includes('vencimento');
                      }
                      if (filterType === 'FUTUROS') {
                        return (ev.status || '') === 'Previsto';
                      }
                      return true;
                    })
                    .map((ev, idx) => {
                      const isLiquidado = ev.status === 'Liquidado';
                      const isJuros = (ev.tipo_evento || '').toLowerCase().includes('juros') || (ev.tipo_evento || '').toLowerCase().includes('cupom');
                      const isAmort = (ev.tipo_evento || '').toLowerCase().includes('amortiza');
                      
                      return (
                        <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-4 py-3 font-semibold text-slate-800 whitespace-nowrap">
                            {formatDatePretty(ev.data_evento)}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold ${
                              isJuros
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : isAmort
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-purple-50 text-purple-700 border border-purple-200'
                            }`}>
                              {ev.tipo_evento || 'Evento de Pagamento'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-xs text-slate-700">
                            {ev.taxa && Number(ev.taxa) > 0 ? `${Number(ev.taxa).toFixed(2)}%` : '-'}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                            {ev.valor_real && Number(ev.valor_real) > 0 ? (
                              `R$ ${Number(ev.valor_real).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`
                            ) : (
                              <span className="text-slate-400 font-normal text-xs">{isLiquidado ? '-' : 'A liquidar'}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              isLiquidado
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-blue-50 text-blue-700 border border-blue-200'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${isLiquidado ? 'bg-emerald-500' : 'bg-blue-500'}`}></span>
                              {ev.status || 'Previsto'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                            {ev.fonte || 'Cronograma Contratual'}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ================= DOCUMENTOS OFICIAIS (CRI / CRA / DEBÊNTURES) ================= */}
        <div id="secao-documentos" className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-md uppercase tracking-wider">
                  Documentos & Prospectos B3
                </span>
                <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1 flex items-center gap-2">
                  <FileText size={22} className="text-emerald-600" />
                  Documentos Oficiais da Emissão
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  {documents.length} documento(s) oficial(is) arquivado(s) na B3 FNET para este ativo
                </p>
              </div>

              {/* Filtros rápidos de documentos */}
              {documents.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold text-slate-600">
                  <button
                    onClick={() => setDocFilter('ALL')}
                    className={`px-3 py-1.5 rounded-lg transition ${docFilter === 'ALL' ? 'bg-white text-emerald-700 shadow-sm font-extrabold' : 'hover:text-slate-900'}`}
                  >
                    Todos ({documents.length})
                  </button>
                  <button
                    onClick={() => setDocFilter('PROSPECTO')}
                    className={`px-3 py-1.5 rounded-lg transition ${docFilter === 'PROSPECTO' ? 'bg-white text-emerald-700 shadow-sm font-extrabold' : 'hover:text-slate-900'}`}
                  >
                    Prospectos & Termos
                  </button>
                  <button
                    onClick={() => setDocFilter('RELATORIO')}
                    className={`px-3 py-1.5 rounded-lg transition ${docFilter === 'RELATORIO' ? 'bg-white text-emerald-700 shadow-sm font-extrabold' : 'hover:text-slate-900'}`}
                  >
                    Relatórios
                  </button>
                  <button
                    onClick={() => setDocFilter('ASSEMBLEIA')}
                    className={`px-3 py-1.5 rounded-lg transition ${docFilter === 'ASSEMBLEIA' ? 'bg-white text-emerald-700 shadow-sm font-extrabold' : 'hover:text-slate-900'}`}
                  >
                    Assembleias
                  </button>
                </div>
              )}
            </div>

            {/* Box de tamanho fixo com scroll vertical suave */}
            {documents.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-500 text-sm">
                Nenhum documento B3 arquivado para este ativo até o momento.
              </div>
            ) : (
              <div className="relative overflow-x-auto overflow-y-auto max-h-80 rounded-xl border border-slate-200 shadow-inner">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="text-xs uppercase bg-slate-100 text-slate-700 font-bold sticky top-0 z-10 shadow-sm border-b border-slate-200">
                    <tr>
                      <th scope="col" className="px-4 py-3">Data de Entrega</th>
                      <th scope="col" className="px-4 py-3">Categoria</th>
                      <th scope="col" className="px-4 py-3">Tipo de Documento</th>
                      <th scope="col" className="px-4 py-3">Securitizadora</th>
                      <th scope="col" className="px-4 py-3 text-center">Download</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {documents
                      .filter(doc => {
                        const t = (doc.tipo_documento || '').toLowerCase();
                        const c = (doc.categoria_documento || '').toLowerCase();
                        if (docFilter === 'PROSPECTO') {
                          return t.includes('prospecto') || t.includes('termo') || t.includes('lâmina') || t.includes('lamina') || c.includes('oferta');
                        }
                        if (docFilter === 'RELATORIO') {
                          return t.includes('relatório') || t.includes('relatorio') || t.includes('demonstraç') || t.includes('demonstrac') || c.includes('relatório') || c.includes('informes');
                        }
                        if (docFilter === 'ASSEMBLEIA') {
                          return t.includes('ago') || t.includes('age') || t.includes('assembl') || c.includes('assembl');
                        }
                        return true;
                      })
                      .map((doc, idx) => {
                        const isProspecto = (doc.tipo_documento || '').toLowerCase().includes('prospecto') || (doc.tipo_documento || '').toLowerCase().includes('termo');
                        return (
                          <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-4 py-3 font-semibold text-slate-800 whitespace-nowrap text-xs">
                              {formatDatePretty(doc.data_entrega || doc.data_referencia)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-700">
                                {doc.categoria_documento || 'Geral'}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-medium text-slate-900">
                              <div className="flex items-center gap-1.5">
                                {isProspecto && <Sparkles size={14} className="text-amber-500 flex-shrink-0" />}
                                <span className={isProspecto ? 'font-bold text-slate-900' : 'text-slate-800'}>
                                  {doc.tipo_documento || 'Documento B3'}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap truncate max-w-[220px]" title={doc.securitizadora}>
                              {doc.securitizadora || '-'}
                            </td>
                            <td className="px-4 py-3 text-center whitespace-nowrap">
                              <a
                                href={doc.link_download}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 hover:text-emerald-800 text-xs font-bold rounded-lg border border-emerald-200 transition shadow-sm"
                              >
                                <ExternalLink size={13} />
                                Baixar PDF
                              </a>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

    </div>
  );
};

export default AssetPage;
