import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchCSV, Asset, PriceRecord } from '../utils/csv';
import ChartComponent from '../components/ChartComponent';
import { ArrowLeft, Star, FileText, Calendar, Percent } from 'lucide-react';

const AssetPage: React.FC = () => {
  const { ticker } = useParams<{ ticker: string }>();
  const [asset, setAsset] = useState<Asset | null>(null);
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
        const [assetsData, pricesData] = await Promise.all([
          fetchCSV<Asset>('/data/assets_master.csv'),
          fetchCSV<PriceRecord>('/data/prices.csv')
        ]);

        const found = assetsData.find(a => a.ticker === ticker);
        if (found) {
          setAsset(found);
          setPrices(pricesData.filter(p => p.ticker === ticker));
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
              <p className="capitalize">{asset.tipo}</p>
            </div>

            <div>
              <p className="text-slate-400 text-xs font-bold uppercase">Rating</p>
              <p>{asset.agencia} {asset.rating}</p>
              ({asset.divulgacao})
            </div>

          </div>

        </div>

        {/* (se quiser depois pode voltar o gráfico aqui embaixo) */}

      </div>

    </div>
  );
};

export default AssetPage;


          {/* GRÁFICO MENOR */}
          {/* <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">

          <p className="text-sm font-bold text-slate-500 mb-2">
            Histórico de Preços
          </p>

          <div className="h-[300px] w-full">
            <ChartComponent 
              prices={prices} 
              ticker={asset.ticker} 
            />
          </div>

          </div> */}
