
import React, { useState, useEffect } from 'react';
import { Star } from 'lucide-react';
import { Link } from 'react-router-dom';

const LOCAL_STORAGE_KEY = 'meu_credito_watchlist';

export const useWatchlist = () => {
  const [watchlist, setWatchlist] = useState<string[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) setWatchlist(JSON.parse(saved));
  }, []);

  const toggle = (ticker: string) => {
    const newWatchlist = watchlist.includes(ticker)
      ? watchlist.filter(t => t !== ticker)
      : [...watchlist, ticker];
    setWatchlist(newWatchlist);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newWatchlist));
  };

  return { watchlist, toggle };
};

export const WatchlistSidebar: React.FC<{ watchlist: string[] }> = ({ watchlist }) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
      <div className="flex items-center gap-2 mb-4">
        <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
        <h3 className="font-bold text-slate-800">Sua Watchlist</h3>
      </div>
      {watchlist.length === 0 ? (
        <p className="text-sm text-slate-500 italic">Sua lista está vazia. Adicione ativos usando a estrela.</p>
      ) : (
        <ul className="space-y-2">
          {watchlist.map(ticker => (
            <li key={ticker}>
              <Link to={`/asset/${ticker}`} className="block px-3 py-2 bg-slate-50 hover:bg-slate-100 rounded text-sm font-medium text-slate-700 transition-colors">
                {ticker}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
