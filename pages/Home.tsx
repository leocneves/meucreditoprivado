
import React from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../App';
import SearchBar from '../components/SearchBar';
import { TrendingUp, Calendar, Zap, ArrowUpRight } from 'lucide-react';

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
    <div className="space-y-16 animate-in fade-in duration-700">
      {/* Hero Section */}
      <section className="text-center py-16 md:py-24 space-y-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-full text-xs font-black uppercase tracking-widest mb-4">
          <Zap size={14} /> Dados do Mercado em Tempo Real
        </div>
        <h1 className="text-5xl md:text-7xl font-black text-slate-900 tracking-tighter leading-tight">
          Meu <span className="text-indigo-600">Crédito Privado</span>
        </h1>
        <p className="text-xl text-slate-500 max-w-2xl mx-auto font-medium">
          A plataforma definitiva para análise de spreads, marcação a mercado e radar de emissões primárias.
        </p>
        <div className="max-w-3xl mx-auto pt-6 px-4">
          <SearchBar />
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
        {/* Top Spreads Card */}
        <div className="bg-white rounded-[2.5rem] p-10 shadow-sm border border-slate-100 hover:shadow-xl transition-all group">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4 text-indigo-600">
              <div className="p-3 bg-indigo-50 rounded-2xl group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                <TrendingUp size={28} />
              </div>
              <h2 className="font-black text-2xl text-slate-800">Top Spreads</h2>
            </div>
            <ArrowUpRight className="text-slate-200 group-hover:text-indigo-400 transition-colors" />
          </div>
          <div className="space-y-4">
            {topSpreads.length > 0 ? topSpreads.map(p => (
              <Link key={p.ticker} to={`/asset/${p.ticker}`} className="block group/item">
                <div className="flex justify-between items-center p-5 rounded-3xl bg-slate-50 group-hover/item:bg-white border border-transparent group-hover/item:border-slate-100 group-hover/item:shadow-sm transition-all">
                  <div>
                    <p className="font-black text-slate-900 text-lg">{p.ticker}</p>
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{p.asset?.debtor}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-red-600 text-xl">{p.spread}%</p>
                    <p className="text-[9px] font-black text-slate-300 uppercase tracking-tighter">Premium</p>
                  </div>
                </div>
              </Link>
            )) : <div className="text-center py-10 text-slate-300 font-bold italic">Sem dados de preços...</div>}
          </div>
        </div>

        {/* Mercado Primário Card */}
        <div className="bg-white rounded-[2.5rem] p-10 shadow-sm border border-slate-100 hover:shadow-xl transition-all group">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4 text-emerald-600">
              <div className="p-3 bg-emerald-50 rounded-2xl group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <Zap size={28} />
              </div>
              <h2 className="font-black text-2xl text-slate-800">Radar Primário</h2>
            </div>
            <ArrowUpRight className="text-slate-200 group-hover:text-emerald-400 transition-colors" />
          </div>
          <div className="space-y-4">
            {activeOffers.length > 0 ? activeOffers.map(o => (
              <Link key={o.ticker} to="/primary" className="block group/item">
                <div className="flex justify-between items-center p-5 rounded-3xl bg-slate-50 group-hover/item:bg-white border border-transparent group-hover/item:border-slate-100 group-hover/item:shadow-sm transition-all">
                  <div className="max-w-[160px]">
                    <p className="font-black text-slate-900 text-lg truncate">{o.debtor}</p>
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{o.type} • {o.ticker}</p>
                  </div>
                  <div className="text-right">
                    <span className={`text-[9px] px-3 py-1.5 font-black rounded-xl uppercase tracking-widest ${
                      o.status === 'Em Aberto' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {o.status}
                    </span>
                  </div>
                </div>
              </Link>
            )) : <div className="text-center py-10 text-slate-300 font-bold italic">Nenhuma oferta ativa...</div>}
          </div>
          <Link to="/primary" className="block text-center mt-8 text-indigo-600 font-black text-xs uppercase tracking-widest bg-indigo-50/50 py-4 rounded-2xl hover:bg-indigo-600 hover:text-white transition-all">Ver Pipeline Completo</Link>
        </div>

        {/* Agenda Card */}
        <div className="bg-white rounded-[2.5rem] p-10 shadow-sm border border-slate-100 hover:shadow-xl transition-all group">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4 text-amber-600">
              <div className="p-3 bg-amber-50 rounded-2xl group-hover:bg-amber-600 group-hover:text-white transition-colors">
                <Calendar size={28} />
              </div>
              <h2 className="font-black text-2xl text-slate-800">Agenda</h2>
            </div>
            <ArrowUpRight className="text-slate-200 group-hover:text-amber-400 transition-colors" />
          </div>
          <div className="space-y-4">
            {upcomingEvents.length > 0 ? upcomingEvents.map((e, idx) => (
              <div key={idx} className="flex gap-5 items-center p-5 bg-slate-50 rounded-3xl">
                <div className="bg-white shadow-sm rounded-2xl p-3 flex flex-col items-center min-w-[65px] border border-slate-100">
                  <span className="text-[9px] uppercase font-black text-indigo-400 leading-none mb-1">{new Date(e.event_date).toLocaleDateString('pt-BR', { month: 'short' })}</span>
                  <span className="text-2xl font-black text-slate-800 leading-none">{new Date(e.event_date).getDate()}</span>
                </div>
                <div>
                  <p className="font-black text-slate-900 text-lg leading-tight">{e.ticker}</p>
                  <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mt-1">{e.event_type}</p>
                </div>
              </div>
            )) : <div className="text-center py-10 text-slate-300 font-bold italic">Nenhum evento próximo...</div>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
