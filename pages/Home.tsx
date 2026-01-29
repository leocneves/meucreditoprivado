
import React from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../App';
import SearchBar from '../components/SearchBar';
import { TrendingUp, Calendar, Zap } from 'lucide-react';

const Home: React.FC = () => {
  const { assets, prices, offers, calendar } = useData();

  const topSpreads = React.useMemo(() => {
    return [...prices]
      .sort((a, b) => parseFloat(b.spread) - parseFloat(a.spread))
      .slice(0, 5)
      .map(p => ({
        ...p,
        asset: assets.find(a => a.ticker === p.ticker)
      }));
  }, [prices, assets]);

  const activeOffers = React.useMemo(() => {
    return offers.filter(o => o.status === 'Em Aberto' || o.status === 'Planejada').slice(0, 5);
  }, [offers]);

  const upcomingEvents = React.useMemo(() => {
    const today = new Date();
    return [...calendar]
      .filter(e => new Date(e.event_date) >= today)
      .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime())
      .slice(0, 5);
  }, [calendar]);

  return (
    <div className="space-y-12 animate-in fade-in duration-700">
      {/* Hero */}
      <section className="text-center py-12 space-y-6">
        <h1 className="text-4xl md:text-6xl font-black text-slate-900 tracking-tight">
          Meu <span className="text-indigo-600">Crédito Privado</span>
        </h1>
        <p className="text-xl text-slate-600 max-w-2xl mx-auto">
          Análise de spreads, histórico de preços e radar de mercado para investidores de renda fixa.
        </p>
        <div className="max-w-3xl mx-auto pt-4">
          <SearchBar />
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {/* Maiores Spreads */}
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 transition-hover hover:shadow-md">
          <div className="flex items-center gap-3 mb-6 text-indigo-700">
            <div className="p-2 bg-indigo-50 rounded-xl">
              <TrendingUp size={24} />
            </div>
            <h2 className="font-black text-xl text-slate-800 tracking-tight">Top Spreads</h2>
          </div>
          <div className="space-y-4">
            {topSpreads.length > 0 ? topSpreads.map(p => (
              <Link key={p.ticker} to={`/asset/${p.ticker}`} className="block group">
                <div className="flex justify-between items-center p-4 rounded-2xl bg-slate-50 group-hover:bg-indigo-50 transition-all border border-transparent group-hover:border-indigo-100">
                  <div>
                    <p className="font-bold text-slate-900">{p.ticker}</p>
                    <p className="text-xs text-slate-500 font-medium uppercase">{p.asset?.debtor}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-red-600 text-lg">{p.spread}%</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Spread</p>
                  </div>
                </div>
              </Link>
            )) : <p className="text-slate-400 text-center py-4">Aguardando dados...</p>}
          </div>
        </div>

        {/* Mercado Primário */}
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 transition-hover hover:shadow-md">
          <div className="flex items-center gap-3 mb-6 text-emerald-600">
            <div className="p-2 bg-emerald-50 rounded-xl">
              <Zap size={24} />
            </div>
            <h2 className="font-black text-xl text-slate-800 tracking-tight">Radar Primário</h2>
          </div>
          <div className="space-y-4">
            {activeOffers.length > 0 ? activeOffers.map(o => (
              <Link key={o.ticker} to="/primary" className="block group">
                <div className="flex justify-between items-center p-4 rounded-2xl bg-slate-50 group-hover:bg-emerald-50 transition-all border border-transparent group-hover:border-emerald-100">
                  <div>
                    <p className="font-bold text-slate-900">{o.debtor}</p>
                    <p className="text-xs text-slate-500 font-medium">{o.type} • {o.ticker}</p>
                  </div>
                  <div className="text-right">
                    <span className={`text-[10px] px-2.5 py-1 font-bold rounded-lg uppercase tracking-wider ${
                      o.status === 'Em Aberto' ? 'bg-emerald-200 text-emerald-800' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {o.status}
                    </span>
                  </div>
                </div>
              </Link>
            )) : <p className="text-slate-400 text-center py-4">Nenhuma oferta no radar.</p>}
          </div>
          <Link to="/primary" className="block text-center mt-8 text-indigo-600 font-bold hover:underline text-sm bg-indigo-50 py-3 rounded-2xl">Explorar Ofertas Pública</Link>
        </div>

        {/* Calendário */}
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 transition-hover hover:shadow-md">
          <div className="flex items-center gap-3 mb-6 text-amber-600">
            <div className="p-2 bg-amber-50 rounded-xl">
              <Calendar size={24} />
            </div>
            <h2 className="font-black text-xl text-slate-800 tracking-tight">Agenda</h2>
          </div>
          <div className="space-y-4">
            {upcomingEvents.length > 0 ? upcomingEvents.map((e, idx) => (
              <div key={idx} className="flex gap-4 items-center p-4 bg-slate-50 rounded-2xl">
                <div className="bg-white shadow-sm rounded-xl p-2 flex flex-col items-center min-w-[55px] border border-slate-100">
                  <span className="text-[10px] uppercase font-black text-indigo-400">{new Date(e.event_date).toLocaleDateString('pt-BR', { month: 'short' })}</span>
                  <span className="text-xl font-black text-slate-800">{new Date(e.event_date).getDate()}</span>
                </div>
                <div>
                  <p className="font-bold text-slate-900">{e.ticker}</p>
                  <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider">{e.event_type}</p>
                </div>
              </div>
            )) : <p className="text-slate-400 text-center py-4">Nenhum evento próximo.</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
