
import React, { useState, useEffect } from 'react';
import { useData } from '../App';
import { Link } from 'react-router-dom';
import { Star, ArrowRight, Trash2, Download, Upload } from 'lucide-react';

const Watchlist: React.FC = () => {
  const { assets, prices } = useData();
  const [watchlist, setWatchlist] = useState<string[]>(JSON.parse(localStorage.getItem('watchlist') || '[]'));

  const watchedAssets = assets.filter(a => watchlist.includes(a.ticker)).map(a => {
    const latestPrice = [...prices].filter(p => p.ticker === a.ticker).sort((p1, p2) => new Date(p2.date).getTime() - new Date(p1.date).getTime())[0];
    return { ...a, latestPrice };
  });

  const removeAsset = (ticker: string) => {
    const newList = watchlist.filter(t => t !== ticker);
    setWatchlist(newList);
    localStorage.setItem('watchlist', JSON.stringify(newList));
  };

  const exportCSV = () => {
    const csvContent = "ticker\n" + watchlist.join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'minha_watchlist.csv';
    a.click();
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
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-2">
            <Star size={32} className="text-amber-500" fill="currentColor" />
            Minha Watchlist
          </h1>
          <p className="text-slate-500">Monitore seus ativos favoritos em uma única tela.</p>
        </div>
        <div className="flex gap-2">
           <label className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-all font-bold text-slate-600">
             <Upload size={18} />
             Importar
             <input type="file" className="hidden" accept=".csv" onChange={handleImport} />
           </label>
           <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all font-bold text-slate-600">
             <Download size={18} />
             Exportar
           </button>
        </div>
      </div>

      {watchedAssets.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {watchedAssets.map(asset => (
            <div key={asset.ticker} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 hover:shadow-md transition-all relative group">
              <button 
                onClick={() => removeAsset(asset.ticker)}
                className="absolute top-4 right-4 text-slate-300 hover:text-red-500 p-2 rounded-full hover:bg-red-50 transition-all"
              >
                <Trash2 size={18} />
              </button>
              
              <div className="mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded">{asset.type}</span>
                  <span className="text-xs text-slate-400 font-mono">{asset.isin}</span>
                </div>
                <h3 className="text-xl font-bold text-slate-900 mt-1">{asset.ticker}</h3>
                <p className="text-sm text-slate-500 line-clamp-1">{asset.debtor}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 border-y border-slate-50 py-4 mb-4">
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400">YTM</p>
                  <p className="text-lg font-black text-indigo-600">{asset.latestPrice?.ytm}%</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400">Spread</p>
                  <p className="text-lg font-black text-red-600">{asset.latestPrice?.spread}%</p>
                </div>
              </div>

              <Link 
                to={`/asset/${asset.ticker}`} 
                className="flex items-center justify-center gap-2 w-full py-2.5 bg-indigo-50 text-indigo-700 font-bold rounded-xl hover:bg-indigo-100 transition-all"
              >
                Ver Detalhes <ArrowRight size={16} />
              </Link>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-dashed border-slate-200 p-12 text-center space-y-4">
          <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto text-slate-400">
             <Star size={32} />
          </div>
          <h2 className="text-xl font-bold text-slate-800">Sua lista está vazia</h2>
          <p className="text-slate-500 max-w-sm mx-auto">Use a barra de busca no topo para encontrar ativos e clique no ícone de estrela para monitorá-los.</p>
          <Link to="/" className="inline-block px-6 py-2 bg-indigo-900 text-white rounded-xl font-bold">Explorar Mercado</Link>
        </div>
      )}
    </div>
  );
};

export default Watchlist;
