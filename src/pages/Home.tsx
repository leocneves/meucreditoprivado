
import React, { useEffect, useState } from 'react';
import { fetchCSV, fetchMetadata, Asset, Metadata } from '../utils/csv';
import SearchBar from '../components/SearchBar';
import Watchlist from '../components/Watchlist';
import { Clock } from 'lucide-react';

const Home: React.FC = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [assetsData, metaData] = await Promise.all([
          fetchCSV<Asset>('./data/assets_master.csv'),
          fetchMetadata()
        ]);
        setAssets(assetsData);
        setMetadata(metaData);
      } catch (err) {
        console.error("Error loading home data", err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  return (
    <div className="space-y-12 py-8">
      <section className="text-center space-y-6">
        <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight">
          Meu Crédito Privado
        </h1>
        <p className="text-slate-600 max-w-2xl mx-auto text-lg">
          Consulte ativos de renda fixa, preços secundários e gerencie sua carteira de acompanhamento de forma simples.
        </p>
        <SearchBar assets={assets} />
        
        <div className="flex items-center justify-center gap-2 text-sm text-slate-400">
          <Clock size={16} />
          <span>Última atualização: {metadata ? metadata.last_update : 'desconhecida'}</span>
        </div>
      </section>

      <section className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-slate-800">Sua Watchlist</h2>
        </div>
        {!loading && <Watchlist assets={assets} />}
      </section>
    </div>
  );
};

export default Home;
