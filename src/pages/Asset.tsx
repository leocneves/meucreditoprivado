import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchCSV, Asset, PriceRecord, Emitter, normalizeRating, getRatingBadgeClass } from '../utils/csv';
import ChartComponent from '../components/ChartComponent';
import { ArrowLeft, Star, FileText, Calendar, Percent, Building2, Globe, ExternalLink, ShieldCheck } from 'lucide-react';

const matchEmitter = (issuers: Emitter[], asset: Asset): Emitter | null => {
  if (!asset.issuer) return null;
  const target = asset.issuer.trim().toLowerCase();
  if (['nan', 'none', '-', ''].includes(target)) return null;
  
  // 1. Match exato
  const exact = issuers.find(e => 
    (e.razao_social && e.razao_social.trim().toLowerCase() === target) ||
    (e.nome_fantasia && e.nome_fantasia.trim().toLowerCase() === target)
  );
  if (exact) return exact;

  // 2. Match parcial
  const partial = issuers.find(e => {
    const r = (e.razao_social || '').trim().toLowerCase();
    const f = (e.nome_fantasia || '').trim().toLowerCase();
    return (r.length > 3 && target.includes(r)) || (target.length > 3 && r.includes(target)) ||
           (f.length > 3 && target.includes(f)) || (target.length > 3 && f.includes(target));
  });
  return partial || null;
};

const AssetPage: React.FC = () => {
  const { ticker } = useParams<{ ticker: string }>();
  const [asset, setAsset] = useState<Asset | null>(null);
  const [emitter, setEmitter] = useState<Emitter | null>(null);
  const [prices, setPrices] = useState<PriceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);

  const formatDatePretty = (dateStr: string) => {
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

  useEffect(() => {
    const loadData = async () => {
      try {
        const [assetsData, pricesData, emittersData] = await Promise.all([
          fetchCSV<Asset>('/data/assets_master.csv'),
          fetchCSV<PriceRecord>('/data/prices.csv'),
          fetchCSV<Emitter>('/data/emitters_master.csv')
        ]);

        const found = assetsData.find(a => a.ticker === ticker);
        if (found) {
          setAsset(found);
          setPrices(pricesData.filter(p => p.ticker === ticker));
          
          const matched = matchEmitter(emittersData || [], found);
          setEmitter(matched);

          // SEO dinâmico por ativo
          const tipoStr = found.tipo || 'Título';
          const emissorStr = found.issuer ? `(${found.issuer})` : '';
          document.title = `${tipoStr} ${found.ticker} ${emissorStr} — Taxas, Spread e Rating | FIXDATA`;
          
          const metaDesc = document.querySelector('meta[name="description"]');
          const descText = `Análise de ${tipoStr} ${found.ticker} emitida por ${found.issuer || 'Emissor'}. Indexador: ${found.indexador || '-'}, Vencimento: ${found.vencimento || '-'}, Rating: ${found.rating || '-'}. Dados de mercado no FIXDATA.`;
          if (metaDesc) {
            metaDesc.setAttribute('content', descText);
          }
        }

        const saved = localStorage.getItem('watchlist');
        if (saved) {
          const watchlist = JSON.parse(saved) as string[];
          setIsFavorite(watchlist.includes(ticker || ''));
        }
      } catch (err) {
        console.error("Error loading asset detail", err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [ticker]);

  const toggleFavorite = () => {
    if (!ticker) return;

    const saved = localStorage.getItem('watchlist');
    let watchlist = saved ? (JSON.parse(saved) as string[]) : [];

    if (isFavorite) {
      watchlist = watchlist.filter(t => t !== ticker);
    } else {
      watchlist.push(ticker);
    }

    localStorage.setItem('watchlist', JSON.stringify(watchlist));
    setIsFavorite(!isFavorite);
  };

  if (loading) return <div className="p-10 text-center">Carregando dados...</div>;

  if (!asset) return (
    <div className="p-10 text-center">
      Ativo não encontrado.{' '}
      <Link to="/" className="text-blue-500 underline">Voltar</Link>
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">

      <Link
        to="/"
        className="inline-flex items-center gap-2 text-slate-500 hover:text-blue-600 transition-colors"
      >
        <ArrowLeft size={20} />
        Voltar para a busca
      </Link>

      <div className="flex flex-col md:flex-row justify-between items-start gap-4">
        <div>
          <h1 className="text-4xl font-black text-slate-900">
            {asset.ticker}
          </h1>
          <p className="text-xl text-slate-500 font-medium">
            {asset.issuer_name}
          </p>
        </div>

        <button
          onClick={toggleFavorite}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all shadow-sm ${
            isFavorite
              ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
              : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <Star size={20} fill={isFavorite ? 'currentColor' : 'none'} />
          {isFavorite ? 'Favorito' : 'Seguir Ativo'}
        </button>
      </div>

      {/* CONTEÚDO */}

      <div className="space-y-8">

        {/* CARDS IPCA + VENCIMENTO */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
              <Percent size={24} />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-bold uppercase">Devedor / EMISSOR</p>
              <p className="text-lg font-bold text-slate-800">
                {asset.issuer}
              </p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
              <Percent size={24} />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-bold uppercase">Indexador</p>
              <p className="text-lg font-bold text-slate-800">
                {asset.indexador}
              </p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
              <Calendar size={24} />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-bold uppercase">VOLUME DA EMISSÃO</p>
              <p className="text-lg font-bold text-slate-800">
                R$ {(asset.volume / 1e6).toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })} MM
              </p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
              <Calendar size={24} />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-bold uppercase">Vencimento</p>
              <p className="text-lg font-bold text-slate-800">
                {formatDatePretty(asset.vencimento)}
              </p>
            </div>
          </div>

        </div>

        {/* DETALHES DO ATIVO (AGORA EMBAIXO) */}

        <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-xl space-y-6">

          <h3 className="text-xl font-bold border-b border-slate-700 pb-4">
            Detalhes do Papel
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

            <div>
              <p className="text-slate-400 text-xs font-bold uppercase">ISIN</p>
              <p className="font-mono text-sm">{asset.isin}</p>
            </div>

            <div>
              <p className="text-slate-400 text-xs font-bold uppercase">EMISSAO</p>
              <p className="font-mono text-sm">{asset.emissao}</p>
            </div>

            <div>
              <p className="text-slate-400 text-xs font-bold uppercase">SÉRIE</p>
              <p className="font-mono text-sm">{asset.serie}</p>
            </div>

            <div>
              <p className="text-slate-400 text-xs font-bold uppercase">Vencimento</p>
              <p className="font-mono text-sm">
                {formatDatePretty(asset.vencimento)}
              </p>
            </div>

            <div>
              <p className="text-slate-400 text-xs font-bold uppercase">Referência NTN-B</p>
              <p className="font-mono text-sm">
                {formatDatePretty(asset.ntnb_referencia)}
              </p>
            </div>

            <div>
              <p className="text-slate-400 text-xs font-bold uppercase">Duration</p>
              <p className="font-mono text-sm">
                {(asset.duration / 365).toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })} anos
              </p>
            </div>

            <div>
              <p className="text-slate-400 text-xs font-bold uppercase">TAXA EMISSÃO</p>
              <p className="font-mono text-sm">{asset.taxa_emissao}</p>
            </div>

            <div>
              <p className="text-slate-400 text-xs font-bold uppercase">DATA EMISSÃO</p>
              <p>{formatDatePretty(asset.data_emissao)}</p>
            </div>

            <div>
              <p className="text-slate-400 text-xs font-bold uppercase">Tipo de Ativo</p>
              <p className="capitalize font-medium text-slate-800">{asset.tipo || 'Título'}</p>
            </div>

            <div>
              <p className="text-slate-400 text-xs font-bold uppercase">Rating Normalizado</p>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-bold border mt-1 ${getRatingBadgeClass(asset.rating_normalizado || normalizeRating(asset.rating))}`}>
                {asset.rating_normalizado || normalizeRating(asset.rating)}
              </span>
            </div>

            <div>
              <p className="text-slate-400 text-xs font-bold uppercase">Rating Original & Agência</p>
              <p className="text-sm font-medium text-slate-800">
                {asset.agencia || '-'} — <span className="font-mono text-slate-600 font-semibold">{asset.rating || '-'}</span>
              </p>
              {asset.divulgacao && (
                <span className="text-xs text-slate-400 block mt-0.5">Divulgado em: {formatDatePretty(asset.divulgacao)}</span>
              )}
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

              {emitter.site_ri && (
                <a
                  href={emitter.site_ri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-xl transition border border-blue-200 shadow-sm"
                >
                  <Globe size={16} />
                  Portal de RI / Website Oficial
                  <ExternalLink size={14} />
                </a>
              )}
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
        <ChartComponent 
          prices={prices} 
          ticker={asset.ticker} 
          indexador={asset.indexador}
        />

      </div>

    </div>
  );
};

export default AssetPage;
