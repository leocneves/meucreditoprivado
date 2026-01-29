
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Star, Trash2 } from 'lucide-react';
import { Asset } from '../utils/csv';

interface WatchlistProps {
  assets: Asset[];
}

const Watchlist: React.FC<WatchlistProps> = ({ assets }) => {
  const [watchlist, setWatchlist] = useState<string[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('watchlist');
    if (saved) setWatchlist(JSON.parse(saved));
  }, []);

  const removeFromWatchlist = (ticker: string) => {
    const updated = watchlist.filter(t => t !== ticker);
    setWatchlist(updated);
    localStorage.setItem('watchlist', JSON.stringify(updated));
  };

  const watchlistAssets = assets.filter(a => watchlist.includes(a.ticker));

  if (watchlist.length === 0) {
    return (
      <div className="bg-white p-8 rounded-2xl border border-dashed border-slate-300 text-center text-slate-500">
        <Star className="mx-auto mb-3 opacity-20" size={40} />
        <p>Sua lista de favoritos está vazia.</p>
        <p className="text-sm">Pesquise por um ativo e clique na estrela para adicionar.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {watchlistAssets.map(asset => (
        <div key={asset.ticker} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow group relative">
          <Link to={`/asset/${asset.ticker}`} className="block">
            <h3 className="font-bold text-lg text-blue-900">{asset.ticker}</h3>
            <p className="text-sm text-slate-500 truncate mb-2">{asset.issuer_name}</p>
            <div className="flex gap-2">
              <span className="text-[10px] px-2 py-0.5 bg-slate-100 rounded-full font-semibold uppercase">{asset.asset_type}</span>
              <span className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full font-semibold">{asset.coupon_type}</span>
            </div>
          </Link>
          <button 
            onClick={() => removeFromWatchlist(asset.ticker)}
            className="absolute top-5 right-5 text-slate-300 hover:text-red-500 transition-colors"
          >
            <Trash2 size={18} />
          </button>
        </div>
      ))}
    </div>
  );
};

export default Watchlist;
