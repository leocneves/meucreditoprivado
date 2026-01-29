
import React from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../App';
import SearchBar from '../components/SearchBar';
import { TrendingUp, Calendar, Zap, AlertCircle } from 'lucide-react';

const Home: React.FC = () => {
  const { assets, prices, offers, calendar, loading } = useData();

  const topSpreads = React.useMemo(() => {
    return [...prices]
      .sort((a, b) => parseFloat(b.spread) - parseFloat(a.spread))
      .slice(0, 4)
      .map(p => ({
        ...p,
        asset: assets.find(a => a.ticker === p.ticker)
      }));
  }, [prices, assets]);

  const activeOffers = React.useMemo(() => {
    return offers.filter(o => o.status === 'Em Aberto').slice(0, 4);
  }, [offers]);

  const upcomingEvents = React.useMemo(() => {
    const today = new Date();
    return [...calendar]
      .filter(e => new Date(e.event_date) >= today)
      .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime())
      .slice(0, 4);
  }, [calendar]);

  if (loading) return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-900"></div></div>;

  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="text-center py-8 space-y-6">
        <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight">
          Sua Central de <span className="text-indigo-600">Crédito Privado</span>
        </h1>
        <p className="text-lg text-slate-600 max-w-2xl mx-auto">
          Análise fundamentalista, preços históricos e acompanhamento de mercado primário de debêntures, CRIs e CRAs.
        </p>
        <SearchBar />
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {/* Top Spreads */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-4 text-indigo-700">
            <TrendingUp size={24} />
            <h2 className="font-bold text-xl text-slate-800">Maiores Spreads</h2>
          </div>
          <div className="space-y-4">
            {topSpreads.length > 0 ? topSpreads.map(p => (
              <Link key={p.ticker} to={`/asset/${p.ticker}`} className="block group">
                <div className="flex justify-between items-center p-3 rounded-lg hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                  <div>
                    <p className="font-bold text-slate-900">{p.ticker}</p>
                    <p className="text-xs text-slate-500">{p.asset?.debtor}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-red-600">{p.spread}%</p>
                    <p className="text-xs text-slate-400">Spread IPCA+</p>
                  </div>
                </div>
              </Link>
            )) : <p className="text-slate-400 text-sm">Sem dados disponíveis.</p>}
          </div>
        </div>

        {/* Primary Market */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-4 text-emerald-600">
            <Zap size={24} />
            <h2 className="font-bold text-xl text-slate-800">Ofertas em Andamento</h2>
          </div>
          <div className="space-y-4">
            {activeOffers.length > 0 ? activeOffers.map(o => (
              <Link key={o.ticker} to="/primary" className="block group">
                <div className="flex justify-between items-center p-3 rounded-lg hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                  <div>
                    <p className="font-bold text-slate-900">{o.debtor}</p>
                    <p className="text-xs text-slate-500">{o.type} • {o.ticker}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] px-2 py-1 bg-emerald-100 text-emerald-700 font-bold rounded-full uppercase tracking-wider">Novo</span>
                  </div>
                </div>
              </Link>
            )) : <p className="text-slate-400 text-sm">Nenhuma oferta aberta no momento.</p>}
          </div>
          <Link to="/primary" className="block text-center mt-6 text-indigo-600 font-medium hover:underline text-sm">Ver todas as ofertas →</Link>
        </div>

        {/* Upcoming Calendar */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-4 text-amber-600">
            <Calendar size={24} />
            <h2 className="font-bold text-xl text-slate-800">Próximos Eventos</h2>
          </div>
          <div className="space-y-4">
            {upcomingEvents.length > 0 ? upcomingEvents.map((e, idx) => (
              <div key={idx} className="flex gap-4 items-start p-3 border-b last:border-0 border-slate-100">
                <div className="bg-slate-50 rounded-lg p-2 flex flex-col items-center min-w-[50px]">
                  <span className="text-[10px] uppercase font-bold text-slate-400">{new Date(e.event_date).toLocaleDateString('pt-BR', { month: 'short' })}</span>
                  <span className="text-lg font-bold text-slate-700">{new Date(e.event_date).getDate()}</span>
                </div>
                <div>
                  <p className="font-bold text-slate-900">{e.ticker}</p>
                  <p className="text-xs text-slate-500 capitalize">{e.event_type.toLowerCase()}</p>
                </div>
              </div>
            )) : <p className="text-slate-400 text-sm">Sem eventos próximos.</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
