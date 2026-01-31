
import React, { useEffect, useState } from 'react';
import { fetchCSV, PriceRecord, Asset } from '../utils/csv';
import ChartComponent from '../components/ChartComponent';

const Charts: React.FC = () => {
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [allPrices, setAllPrices] = useState<PriceRecord[]>([]);
  const [selectedTicker, setSelectedTicker] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const saved = localStorage.getItem('watchlist');
        const list = saved ? JSON.parse(saved) : [];
        setWatchlist(list);
        if (list.length > 0) setSelectedTicker(list[0]);

        const pricesData = await fetchCSV<PriceRecord>('./data/prices.csv');
        setAllPrices(pricesData);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const currentPrices = allPrices.filter(p => p.ticker === selectedTicker);

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <h1 className="text-3xl font-bold text-slate-900">Histórico de Preços</h1>
      
      {watchlist.length > 0 ? (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            {watchlist.map(ticker => (
              <button
                key={ticker}
                onClick={() => setSelectedTicker(ticker)}
                className={`px-4 py-2 rounded-full font-bold transition-all ${
                  selectedTicker === ticker 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-white text-slate-600 border border-slate-200 hover:border-blue-400'
                }`}
              >
                {ticker}
              </button>
            ))}
          </div>

          {selectedTicker && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-slate-700">Visualizando: {selectedTicker}</h2>
              <ChartComponent prices={currentPrices} ticker={selectedTicker} />
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white p-12 rounded-3xl border border-dashed border-slate-300 text-center text-slate-500">
          <p>Adicione ativos à sua watchlist na página inicial para visualizar gráficos aqui.</p>
        </div>
      )}
    </div>
  );
};

export default Charts;
