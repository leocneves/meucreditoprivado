import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchCSV, Asset, PriceRecord } from '../utils/csv';
import ChartComponent from '../components/ChartComponent';
import { ArrowLeft, Star, FileText, Calendar, Percent, ShieldCheck } from 'lucide-react';

const AssetPage: React.FC = () => {
  const { ticker } = useParams<{ ticker: string }>();
  const [asset, setAsset] = useState<Asset | null>(null);
  const [prices, setPrices] = useState<PriceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [assetsData, pricesData] = await Promise.all([
          fetchCSV<Asset>('./data/assets_master.csv'),
          fetchCSV<PriceRecord>('./data/prices.csv')
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* ESQUERDA */}
        <div className="lg:col-span-2 space-y-8">

          {/* CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

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
                <p className="text-xs text-slate-400 font-bold uppercase">Vencimento</p>
                <p className="text-lg font-bold text-slate-800">
                  {asset.vencimento}
                </p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-green-50 text-green-600 rounded-lg">
                <ShieldCheck size={24} />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-bold uppercase">Garantia</p>
                <p className="text-lg font-bold text-slate-800">
                  {asset.guarantee}
                </p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
                <FileText size={24} />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-bold uppercase">Sênioridade</p>
                <p className="text-lg font-bold text-slate-800">
                  {asset.seniority}
                </p>
              </div>
            </div>

          </div>

          {/* GRÁFICO MENOR */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">

          <p className="text-sm font-bold text-slate-500 mb-2">
            Histórico de Preços
          </p>

          <div className="h-[340px] w-full">
            <ChartComponent 
              prices={prices} 
              ticker={asset.ticker} 
            />
          </div>

          </div>

        </div>

        {/* DIREITA */}
        <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-xl space-y-6">

          <h3 className="text-xl font-bold border-b border-slate-700 pb-4">
            Detalhes do Emissor
          </h3>

          <div className="space-y-4">

            <div>
              <p className="text-slate-400 text-xs font-bold uppercase">CNPJ</p>
              <p className="font-mono">{asset.issuer_cnpj}</p>
            </div>

            <div>
              <p className="text-slate-400 text-xs font-bold uppercase">Setor</p>
              <p>{asset.sector}</p>
            </div>

            <div>
              <p className="text-slate-400 text-xs font-bold uppercase">ISIN</p>
              <p className="font-mono text-sm">{asset.isin}</p>
            </div>

            <div>
              <p className="text-slate-400 text-xs font-bold uppercase">Tipo de Ativo</p>
              <p className="capitalize">{asset.asset_type}</p>
            </div>

            <div>
              <p className="text-slate-400 text-xs font-bold uppercase">Série</p>
              <p>{asset.series}</p>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
};

export default AssetPage;
