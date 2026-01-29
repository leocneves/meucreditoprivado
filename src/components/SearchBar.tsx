
import React, { useState, useMemo } from 'react';
import Fuse from 'fuse.js';
import { useNavigate } from 'react-router-dom';
import { Asset } from '../utils/csv';
import { Search } from 'lucide-react';

interface SearchBarProps {
  assets: Asset[];
}

const SearchBar: React.FC<SearchBarProps> = ({ assets }) => {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  const fuse = useMemo(() => new Fuse(assets, {
    keys: ['ticker', 'issuer_name'],
    threshold: 0.3,
  }), [assets]);

  const results = query ? fuse.search(query).slice(0, 5) : [];

  const handleSelect = (ticker: string) => {
    setQuery('');
    navigate(`/asset/${ticker}`);
  };

  return (
    <div className="relative w-full max-w-xl mx-auto">
      <div className="relative">
        <input
          type="text"
          className="w-full px-4 py-3 pl-12 bg-white border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
          placeholder="Pesquisar por Ticker ou Emissor..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Search className="absolute left-4 top-3.5 text-slate-400" size={20} />
      </div>

      {results.length > 0 && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
          {results.map(({ item }) => (
            <button
              key={item.ticker}
              className="w-full px-4 py-3 text-left hover:bg-slate-50 flex flex-col transition-colors border-b last:border-0 border-slate-100"
              onClick={() => handleSelect(item.ticker)}
            >
              <span className="font-bold text-blue-700">{item.ticker}</span>
              <span className="text-sm text-slate-500 uppercase tracking-tight">{item.issuer_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default SearchBar;
