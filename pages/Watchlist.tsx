
import React, { useState } from 'react';
import { useData } from '../App';
import { Link } from 'react-router-dom';
import { Star, ArrowRight, Trash2, Download, Upload } from 'lucide-react';

const Watchlist: React.FC = () => {
  const { assets, prices } = useData();
  const [watchlist, setWatchlist] = useState<string[]>(JSON.parse(localStorage.getItem('watchlist') || '[]'));

  const watchedAssets = assets.filter(a => watchlist.includes(a.ticker)).map(a => {
    const assetPrices = prices.filter(p => p.ticker === a.ticker).sort((p1, p2) => new Date(p2.date).getTime() - new Date(p1.date).getTime());
    const latestPrice = assetPrices[0];
    return { ...a, latestPrice };
  });

  const removeAsset = (ticker: string) => {
    const newList = watchlist.filter(t => t !== ticker);
    setWatchlist(newList);
    localStorage.setItem('watchlist', JSON.stringify(newList));
  };

  const exportCSV = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (watchlist.length === 0) return;

    const csvContent = "ticker\n" + watchlist.join("\n");
    const encodedUri = encodeURI("data:text/csv;charset=utf-8," + csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", 'minha_watchlist.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').map(l => l.trim()).filter(l => l && l !== 'ticker');
      const newList = Array.from(new Set([...watchlist, ...lines]));
      setWatchlist(newList);
      localStorage.setItem('watchlist', JSON.stringify(newList));
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
            <Star size={32} className="text-amber-500" fill="currentColor" />
            Minha Carteira
          </h1>
          <p className="text-slate-500 font-medium">Acompanhamento personalizado dos seus ativos favoritos.</p>
        </div>
        <div className="flex gap-3">
           <label className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 rounded-2xl cursor-pointer hover:bg-slate-50 transition-all font-bold text-slate-600 shadow-sm">
             <Upload size={18} />
             Importar CSV
             <input type="file" className="hidden" accept=".csv" onChange={handleImport} />
           </label>
           <button 
             onClick={exportCSV} 
             className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 transition-all font-bold text-slate-600 shadow-sm"
           >
             <Download size={18} />
             Exportar
           </button>
        </div>
      </div>

      {watchedAssets.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {watchedAssets.map(asset => (
            <div key={asset.ticker} className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8 hover:shadow-xl hover:-translate-y-1 transition-all relative group">
              <button 
                onClick={() => removeAsset(asset.ticker)}
                className="absolute top-6 right-6 text-slate-300 hover:text-red-500 p-2 rounded-xl hover:bg-red-50 transition-all"
                title="Remover da lista"
              >
                <Trash2 size={20} />
              </button>
              
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-black px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-lg uppercase tracking-wider">{asset.type}</span>
                  <span className="text-[10px] text-slate-400 font-bold font-mono tracking-tight">{asset.isin}</span>
                </div>
                <h3 className="text-2xl font-black text-slate-900">{asset.ticker}</h3>
                <p className="text-sm text-slate-500 font-medium line-clamp-1">{asset.debtor}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 border-y border-slate-50 py-6 mb-6">
                <div>
                  <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest">YTM</p>
                  <p className="text-xl font-black text-indigo-600">{asset.latestPrice?.ytm || 'N/A'}%</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Spread</p>
                  <p className="text-xl font-black text-red-600">{asset.latestPrice?.spread || 'N/A'}%</p>
                </div>
              </div>

              <Link 
                to={`/asset/${asset.ticker}`} 
                className="flex items-center justify-center gap-2 w-full py-4 bg-indigo-50 text-indigo-700 font-black rounded-2xl hover:bg-indigo-600 hover:text-white transition-all group/btn"
              >
                Análise Completa <ArrowRight size={18} className="group-hover/btn:translate-x-1 transition-transform" />
              </Link>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-[2rem] border-2 border-dashed border-slate-200 p-20 text-center space-y-6">
          <div className="bg-indigo-50 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto text-indigo-500">
             <Star size={40} />
          </div>
          <div className="max-w-sm mx-auto">
            <h2 className="text-2xl font-black text-slate-800">Sua lista está vazia</h2>
            <p className="text-slate-500 font-medium mt-2">Adicione ativos à sua carteira para monitorar taxas e spreads em tempo real.</p>
          </div>
          <Link to="/" className="inline-flex px-10 py-4 bg-indigo-900 text-white rounded-2xl font-black shadow-lg shadow-indigo-100 hover:bg-indigo-800 transition-all">Explorar Mercado</Link>
        </div>
      )}
    </div>
  );
};

export default Watchlist;
