
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Star, Trash2, ArrowUpRight } from 'lucide-react';
import { Asset } from '../utils/csv';

interface WatchlistProps {
  assets: Asset[];
}

const Watchlist: React.FC<WatchlistProps> = ({ assets }) => {
  const [watchlist, setWatchlist] = useState<string[]>([]);

  const syncWatchlist = useCallback(() => {
    try {
      const saved = localStorage.getItem('watchlist');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setWatchlist(parsed);
          return;
        }
      }
      setWatchlist([]);
    } catch {
      setWatchlist([]);
    }
  }, []);

  useEffect(() => {
    syncWatchlist();
    window.addEventListener('storage', syncWatchlist);
    window.addEventListener('fixdata-watchlist-update', syncWatchlist);
    return () => {
      window.removeEventListener('storage', syncWatchlist);
      window.removeEventListener('fixdata-watchlist-update', syncWatchlist);
    };
  }, [syncWatchlist]);

  const removeFromWatchlist = (targetCode: string) => {
    const codeUp = (targetCode || '').trim().toUpperCase();
    const updated = watchlist.filter(t => {
      const tUp = (t || '').trim().toUpperCase();
      return tUp !== codeUp;
    });
    setWatchlist(updated);
    localStorage.setItem('watchlist', JSON.stringify(updated));
    window.dispatchEvent(new Event('fixdata-watchlist-update'));
  };

  // Build list of display items resolving each item in watchlist
  const displayItems = React.useMemo(() => {
    if (!watchlist.length) return [];

    const normKeys = Array.from(new Set(watchlist.map(t => (t || '').trim().toUpperCase()))).filter(Boolean);

    return normKeys.map(wKey => {
      // Find asset matching ticker or isin case-insensitively
      const match = assets.find(a => {
        const aTick = (a.ticker || '').trim().toUpperCase();
        const aIsin = (a.isin || '').trim().toUpperCase();
        return aTick === wKey || aIsin === wKey;
      });

      if (match) {
        return {
          key: wKey,
          ticker: match.ticker || wKey,
          issuer: match.issuer || (match as any).issuer_name || 'Emissor Registrado',
          tipo: match.tipo || (match as any).asset_type || 'Crédito Privado',
          indexador: match.indexador || (match as any).coupon_type || '-',
          taxa: match.taxa_mercado || match.taxa_ativo || match.taxa_emissao,
          vencimento: match.vencimento
        };
      }

      // Graceful fallback if asset record is still loading or partially referenced
      return {
        key: wKey,
        ticker: wKey,
        issuer: 'Título de Crédito Privado',
        tipo: wKey.startsWith('BR') ? 'Ativo por ISIN' : 'Debênture / Título',
        indexador: '-',
        taxa: undefined,
        vencimento: undefined
      };
    });
  }, [watchlist, assets]);

  if (watchlist.length === 0 || displayItems.length === 0) {
    return (
      <div className="bg-white p-8 rounded-2xl border border-dashed border-slate-300 text-center text-slate-500">
        <Star className="mx-auto mb-3 opacity-20 text-amber-500" size={40} />
        <p className="font-semibold text-slate-700">Sua lista de favoritos está vazia.</p>
        <p className="text-sm text-slate-500 mt-1">Pesquise por uma Debênture, CRI ou CRA e clique na estrela da página do ativo para favoritá-lo.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {displayItems.map(item => (
        <div 
          key={item.key} 
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all group relative flex flex-col justify-between"
        >
          <Link to={`/asset/${item.ticker}`} className="block pr-8">
            <div className="flex items-center gap-2">
              <h3 className="font-black text-lg text-blue-900 group-hover:text-blue-600 transition-colors">
                {item.ticker}
              </h3>
              <ArrowUpRight size={15} className="text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </div>

            <p className="text-xs font-medium text-slate-500 truncate mt-1 mb-3" title={item.issuer}>
              {item.issuer}
            </p>

            <div className="flex flex-wrap items-center gap-1.5 mt-auto">
              <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md font-bold uppercase tracking-wider">
                {item.tipo}
              </span>
              {item.indexador && item.indexador !== '-' && (
                <span className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md font-bold">
                  {item.indexador}
                </span>
              )}
              {item.taxa && (
                <span className="text-[10px] px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-md font-mono font-bold">
                  {typeof item.taxa === 'number' ? `${item.taxa.toFixed(2)}%` : `${item.taxa}%`}
                </span>
              )}
            </div>
          </Link>

          <button 
            onClick={() => removeFromWatchlist(item.key)}
            title="Remover dos favoritos"
            className="absolute top-4 right-4 p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ))}
    </div>
  );
};

export default Watchlist;
