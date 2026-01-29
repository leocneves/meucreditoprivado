
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Fuse from 'fuse.js';
import { Search } from 'lucide-react';
import { useData } from '../App';

const SearchBar: React.FC = () => {
  const { assets } = useData();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const wrapperRef = useRef<HTMLDivElement>(null);

  const fuse = useMemo(() => new Fuse(assets, {
    keys: ['ticker', 'isin', 'debtor'],
    threshold: 0.3,
  }), [assets]);

  useEffect(() => {
    if (query.trim()) {
      const r = fuse.search(query).slice(0, 8);
      setResults(r);
      setIsOpen(true);
    } else {
      setResults([]);
      setIsOpen(false);
    }
  }, [query, fuse]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (ticker: string) => {
    navigate(`/asset/${ticker}`);
    setQuery('');
    setIsOpen(false);
  };

  return (
    <div className="relative w-full max-w-2xl mx-auto" ref={wrapperRef}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
        <input
          type="text"
          placeholder="Busque por Ticker, ISIN ou Devedor (Ex: VALE3, PETR...)"
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-sm transition-all"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query && setIsOpen(true)}
        />
      </div>

      {isOpen && results.length > 0 && (
        <ul className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
          {results.map((r) => (
            <li
              key={r.item.ticker}
              className="p-3 hover:bg-slate-50 cursor-pointer border-b last:border-0 flex justify-between items-center group"
              onClick={() => handleSelect(r.item.ticker)}
            >
              <div>
                <p className="font-bold text-indigo-700 group-hover:text-indigo-900">{r.item.ticker}</p>
                <p className="text-xs text-slate-500">{r.item.debtor} • {r.item.type}</p>
              </div>
              <span className="text-xs font-mono text-slate-400">{r.item.isin}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default SearchBar;
