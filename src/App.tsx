
import React, { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { SearchBar } from './components/SearchBar';
import { AssetPage } from './components/AssetPage';
import { PrimaryPage } from './components/PrimaryPage';
import { ChartsPage } from './components/ChartsPage';
import { dataService } from './services/dataService';
import { AssetMaster, PriceData, Offer, CalendarEvent, Metadata } from './types';
import { LayoutDashboard, TrendingUp, Calendar, Info, Clock, Star } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const Home: React.FC<{
  assets: AssetMaster[];
  prices: PriceData[];
  offers: Offer[];
  events: CalendarEvent[];
  metadata: Metadata | null;
}> = ({ assets, prices, offers, events, metadata }) => {
  const lastPrices = prices.filter(p => p.date === '2026-01-27');
  const topSpreads = [...lastPrices].sort((a, b) => b.spread_over_ref - a.spread_over_ref).slice(0, 3);
  const openOffers = offers.filter(o => o.status === 'open' || o.status === 'announced').slice(0, 3);
  const nextEvents = events.slice(0, 3);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="text-center py-12 bg-gradient-to-r from-brand-900 to-brand-700 rounded-3xl text-white shadow-xl px-4">
        <h1 className="text-4xl sm:text-5xl font-extrabold mb-4 tracking-tight">Meu Crédito Privado</h1>
        <p className="text-brand-100 max-w-2xl mx-auto mb-8 text-lg">Inteligência de mercado para Debêntures, CRIs e CRAs.</p>
        <SearchBar assets={assets} />
        {metadata && (
          <div className="mt-8 flex items-center justify-center gap-2 text-brand-200 text-xs sm:text-sm">
            <Clock className="w-4 h-4" />
            <span>Última atualização: {format(new Date(metadata.last_updated), "d 'de' MMMM 'às' HH:mm", { locale: ptBR })}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-4">
            <TrendingUp className="text-brand-600 w-6 h-6" />
            <h2 className="text-lg font-bold text-slate-800">Maiores Spreads</h2>
          </div>
          <div className="space-y-3">
            {topSpreads.map(s => (
              <Link key={s.ticker} to={`/asset/${s.ticker}`} className="flex justify-between items-center p-3 hover:bg-slate-50 rounded-lg group transition-colors">
                <div>
                  <div className="font-bold text-brand-600 group-hover:underline">{s.ticker}</div>
                  <div className="text-xs text-slate-400">Yield: {(s.yield * 100).toFixed(2)}%</div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-bold text-slate-800">+{s.spread_over_ref}bps</div>
                  <div className="text-[10px] text-slate-400">Spread/Ref</div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-4">
            <Calendar className="text-brand-600 w-6 h-6" />
            <h2 className="text-lg font-bold text-slate-800">Próximos Eventos</h2>
          </div>
          <div className="space-y-3">
            {nextEvents.map(e => (
              <div key={e.event_id} className="flex justify-between items-center p-3 hover:bg-slate-50 rounded-lg">
                <div>
                  <div className="font-bold text-slate-700">{e.ticker}</div>
                  <div className="text-xs text-slate-500">{e.event_type}</div>
                </div>
                <div className="text-right text-xs font-semibold text-slate-600">
                  {format(new Date(e.event_date), 'dd/MM/yyyy')}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-4">
            <LayoutDashboard className="text-brand-600 w-6 h-6" />
            <h2 className="text-lg font-bold text-slate-800">Ofertas Ativas</h2>
          </div>
          <div className="space-y-3">
            {openOffers.map(o => (
              <Link key={o.offer_id} to={`/primary`} className="flex justify-between items-center p-3 hover:bg-slate-50 rounded-lg group">
                <div>
                  <div className="font-bold text-brand-600 group-hover:underline">{o.ticker}</div>
                  <div className="text-xs text-slate-500 truncate max-w-[120px]">{o.issuer_name}</div>
                </div>
                <div className="text-right">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${o.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                    {o.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const Navigation = () => {
  const location = useLocation();
  const links = [
    { to: '/', label: 'Home', icon: LayoutDashboard },
    { to: '/charts', label: 'Mercado', icon: TrendingUp },
    { to: '/primary', label: 'Emissões', icon: Calendar },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 shadow-2xl md:static md:bg-transparent md:border-t-0 md:shadow-none mb-4">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-around md:justify-end items-center h-16 md:h-12 gap-2 md:gap-8">
          {links.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={`flex flex-col md:flex-row items-center gap-1 md:gap-2 text-xs md:text-sm font-semibold transition-colors ${
                location.pathname === to ? 'text-brand-600' : 'text-slate-500 hover:text-brand-500'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{label}</span>
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
};

const App: React.FC = () => {
  const [data, setData] = useState<{
    assets: AssetMaster[];
    prices: PriceData[];
    offers: Offer[];
    calendar: CalendarEvent[];
    metadata: Metadata | null;
  }>({
    assets: [],
    prices: [],
    offers: [],
    calendar: [],
    metadata: null,
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAll = async () => {
      try {
        const [assets, prices, offers, calendar, metadata] = await Promise.all([
          dataService.getAssets(),
          dataService.getPrices(),
          dataService.getOffers(),
          dataService.getCalendar(),
          dataService.getMetadata(),
        ]);
        setData({ assets, prices, offers, calendar, metadata });
      } catch (err) {
        console.error("Failed to load data", err);
      } finally {
        setLoading(false);
      }
    };
    loadAll();
  }, []);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-slate-600 font-medium animate-pulse">Carregando Mercado...</p>
      </div>
    </div>
  );

  return (
    <HashRouter>
      <div className="min-h-screen flex flex-col pb-20 md:pb-0">
        <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2 group">
              <div className="bg-brand-600 p-1.5 rounded-lg group-hover:rotate-6 transition-transform">
                <TrendingUp className="text-white w-6 h-6" />
              </div>
              <span className="font-black text-xl tracking-tighter text-slate-800">CREDITO<span className="text-brand-600">HUB</span></span>
            </Link>
            <Navigation />
          </div>
        </header>

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8">
          <Routes>
            <Route path="/" element={<Home {...data} events={data.calendar} />} />
            <Route path="/asset/:ticker" element={<AssetPage assets={data.assets} prices={data.prices} />} />
            <Route path="/primary" element={<PrimaryPage offers={data.offers} calendar={data.calendar} />} />
            <Route path="/charts" element={<ChartsPage prices={data.prices} />} />
          </Routes>
        </main>

        <footer className="hidden md:block bg-slate-800 text-slate-400 py-12 mt-auto">
          <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="col-span-2">
              <h3 className="text-white font-bold text-lg mb-4">Meu Crédito Privado</h3>
              <p className="text-sm">Plataforma educativa para visualização de dados de renda fixa. Os dados são baseados em amostras simuladas e não constituem recomendação de investimento.</p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Links Rápidos</h4>
              <ul className="text-sm space-y-2">
                <li><Link to="/" className="hover:text-brand-400">Home</Link></li>
                <li><Link to="/charts" className="hover:text-brand-400">Visão Geral de Mercado</Link></li>
                <li><Link to="/primary" className="hover:text-brand-400">Mercado Primário</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Sobre os Dados</h4>
              <p className="text-xs">Fonte: Arquivos CSV Locais</p>
              <p className="text-xs mt-2">Versão: 1.0.0-static</p>
            </div>
          </div>
        </footer>
      </div>
    </HashRouter>
  );
};

export default App;
