
import React, { useState, useEffect, useRef } from 'react';
import Fuse from 'fuse.js';
import { AssetMaster } from '../types';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';

interface SearchBarProps {
  assets: AssetMaster[];
}

export const SearchBar: React.FC<SearchBarProps> = ({ assets }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AssetMaster[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const navigate = useNavigate();
  const fuseRef = useRef<Fuse<AssetMaster> | null>(null);

  useEffect(() => {
    if (assets.length > 0) {
      fuseRef.current = new Fuse(assets, {
        keys: ['ticker', 'isin', 'issuer_name'],
        threshold: 0.3
      });
    }
  }, [assets]);

  const handleSearch = (val: string) => {
    setQuery(val);
    if (val.length > 1 && fuseRef.current) {
      const fuseResults = fuseRef.current.search(val);
      setResults(fuseResults.map(r => r.item).slice(0, 5));
      setShowDropdown(true);
    } else {
      setResults([]);
      setShowDropdown(false);
    }
  };

  const handleSelect = (ticker: string) => {
    navigate(`/asset/${ticker}`);
    setQuery('');
    setShowDropdown(false);
  };

  return (
    <div className="relative w-full max-w-xl mx-auto">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Busque por Ticker, ISIN ou Emissor..."
          className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-full shadow-lg focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all text-sm sm:text-base"
        />
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
      </div>

      {showDropdown && results.length > 0 && (
        <div className="absolute top-full mt-2 w-full bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 overflow-hidden">
          {results.map((asset) => (
            <button
              key={asset.isin}
              onClick={() => handleSelect(asset.ticker)}
              className="w-full px-6 py-4 text-left hover:bg-slate-50 flex flex-col border-b last:border-0 border-slate-100 transition-colors"
            >
              <div className="flex justify-between items-center mb-1">
                <span className="font-bold text-brand-700 text-lg">{asset.ticker}</span>
                <span className="text-xs font-semibold bg-slate-100 px-2 py-0.5 rounded text-slate-600 uppercase">{asset.asset_type}</span>
              </div>
              <span className="text-sm text-slate-600 font-medium truncate">{asset.issuer_name}</span>
              <span className="text-[10px] text-slate-400 mt-0.5 tracking-tight">{asset.isin}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
