import React, { useEffect, useMemo, useState } from 'react';
import { fetchCSV, fetchMetadata, Asset, Metadata } from '../utils/csv';
import SearchBar from '../components/SearchBar';
import Watchlist from '../components/Watchlist';
import PieBox from '../components/PieBox';
import { Clock, Layers, TrendingUp } from 'lucide-react';

/* ================= HELPERS ================= */

const countBy = (arr: Asset[], key: keyof Asset) => {
  const map: Record<string, number> = {};
  arr.forEach(a => {
    const k = String(a[key] || 'Outros');
    map[k] = (map[k] || 0) + 1;
  });
  return map;
};

const toPieData = (obj: Record<string, number>) => {
  const total = Object.values(obj).reduce((a, b) => a + b, 0);

  return Object.entries(obj).map(([name, value]) => ({
    name,
    value: Math.round((value / total) * 100),
  }));
};

/* ================= COMPONENT ================= */

const Home: React.FC = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const [loading, setLoading] = useState(true);

  /* ================= LOAD ================= */

  useEffect(() => {
    const loadData = async () => {
      try {
        const [assetsData, metaData] = await Promise.all([
          fetchCSV<Asset>('./data/assets_master.csv'),
          fetchMetadata(),
        ]);

        setAssets(assetsData);
        setMetadata(metaData);
      } catch (err) {
        console.error('Erro ao carregar home', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  /* ================= METRICS ================= */

  const totalAssets = assets.length;

  const byIndexer = useMemo(
    () => countBy(assets, 'indexador'),
    [assets]
  );

  const byRating = useMemo(() => {
    const map: Record<string, number> = {
      'AA ou superior': 0,
      Outros: 0,
    };

    assets.forEach(a => {
      if (!a.rating) return;

      if (a.rating.startsWith('AAA') || a.rating.startsWith('AA')) {
        map['AA ou superior']++;
      } else {
        map['Outros']++;
      }
    });

    return map;
  }, [assets]);

  const byIssuer = useMemo(() => {
    const m = countBy(assets, 'issuer');

    return Object.entries(m)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [assets]);

  const byIssuerTotal = useMemo(() => {
    const m = countBy(assets, 'issuer');

    return Object.entries(m)
      .sort((a, b) => b[1] - a[1]);
  }, [assets]);

  /* ================= RENDER ================= */

  return (
    <div className="space-y-14 py-10">

      {/* ================= HERO ================= */}

      <section className="text-center space-y-6 px-4">
      <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
        Meu{' '}
        <span className="text-blue-700">
          Crédito Privado
        </span>
      </h1>

        <p className="text-slate-600 max-w-2xl mx-auto text-lg">
          Plataforma de crédito privado construída com automação e{' '}
          <span className="font-semibold text-slate-800">
            inteligência artificial
          </span>{' '}
          para organizar e analisar dados do{' '}
          <span className="font-semibold text-slate-800">
            mercado de crédito privado brasileiro
          </span>.
        </p>

        <SearchBar assets={assets} />

        {/* <div className="flex items-center justify-center gap-2 text-sm text-slate-400">
          <Clock size={16} />
          <span>
            Última atualização:{' '}
            {metadata ? metadata.last_update : 'desconhecida'}
          </span>
        </div> */}
      </section>

      {/* ================= OVERVIEW NUMÉRICO ================= */}

      <section className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <Layers size={36} className="text-blue-600" />
            <div>
              <p className="text-slate-400 text-sm">Ativos na base</p>
              <p className="text-3xl font-bold text-slate-900">
                {totalAssets}
              </p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <TrendingUp size={36} className="text-green-600" />
            <div>
              <p className="text-slate-400 text-sm">Emissores distintos</p>
              <p className="text-3xl font-bold text-slate-900">
                {Object.keys(byIssuerTotal).length}
              </p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <TrendingUp size={36} className="text-purple-600" />
            <div>
              <p className="text-slate-400 text-sm">Ratings AA+</p>
              <p className="text-3xl font-bold text-slate-900">
                {byRating['AA ou superior']}
              </p>
            </div>
          </div>

        </div>
      </section>

      {/* ================= GRÁFICOS ================= */}

      {!loading && (
        <section className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

            <PieBox
              title="Indexadores"
              data={toPieData(byIndexer)}
            />

            <PieBox
              title="Qualidade de crédito"
              data={toPieData(byRating)}
            />

            {/* ===== TOP EMISSORES ===== */}

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition">

              <h3 className="text-lg font-semibold text-slate-800 mb-4">
                Top emissores
              </h3>

              <div className="space-y-2">

                {byIssuer.map(([issuer, qty], i) => (
                  <div
                    key={i}
                    className="flex justify-between items-center bg-slate-50 px-4 py-2 rounded-lg text-sm"
                  >
                    <span className="text-slate-700 font-medium">
                      {issuer}
                    </span>
                    <span className="text-slate-500">
                      {qty}
                    </span>
                  </div>
                ))}

              </div>

            </div>

          </div>
        </section>
      )}

      {/* ================= WATCHLIST ================= */}

      <section className="container mx-auto px-4 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-800">
            Sua Watchlist
          </h2>
        </div>

        {!loading && <Watchlist assets={assets} />}
      </section>

    </div>
  );
};

export default Home;
