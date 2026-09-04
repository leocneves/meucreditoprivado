
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import AssetPage from './pages/Asset';
import Charts from './pages/Charts';
import NtnbDashboard from './pages/NtnbDashboard';
import Primary from './pages/Primary';
import Contact from './pages/Contact';
import Trades from './pages/Trades';
import { LayoutDashboard, LineChart, Files, Tag, Menu, X, Landmark, Coffee, ArrowLeftRight } from 'lucide-react';

const Navbar = () => {
  const location = useLocation();
  const [isOpen, setIsOpen] = React.useState(false);

  const navItems = [
    { path: '/', label: 'Home', icon: <LayoutDashboard size={18} /> },
    { path: '/negocios', label: 'Negócios B3', icon: <ArrowLeftRight size={18} /> },
    { path: '/charts', label: 'Crédito Privado', icon: <LineChart size={18} /> },
    { path: '/ntnb', label: 'Curva NTN-B', icon: <Landmark size={18} /> },
    { path: '/primary', label: 'Mercado Primário', icon: <Tag size={18} /> },
    { path: '/contact', label: 'Contato & Apoio', icon: <Coffee size={18} /> },
  ];

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-[100]">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="flex items-center gap-2">
            <div className="px-3 py-1 bg-blue-600 rounded-lg flex items-center justify-center text-white font-black tracking-wider text-base shadow-sm">
              FIX<span className="text-blue-200 font-extrabold">DATA</span>
            </div>
            <span className="font-extrabold text-lg tracking-tight text-slate-800 hidden sm:block">
              FIX<span className="text-blue-600">DATA</span>
            </span>
          </Link>

          {/* Mobile Menu Button */}
          <button className="md:hidden p-2 text-slate-600" onClick={() => setIsOpen(!isOpen)}>
            {isOpen ? <X /> : <Menu />}
          </button>

          {/* Desktop Nav */}
          <div className="hidden md:flex gap-1">
            {navItems.map(item => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                  location.pathname === item.path 
                  ? 'bg-blue-50 text-blue-600' 
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                {item.icon}
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile Nav Dropdown */}
      {isOpen && (
        <div className="md:hidden bg-white border-t border-slate-100 p-4 space-y-2 shadow-lg">
          {navItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setIsOpen(false)}
              className={`flex items-center gap-4 p-3 rounded-xl font-bold transition-all ${
                location.pathname === item.path 
                ? 'bg-blue-50 text-blue-600' 
                : 'text-slate-600'
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
};

const App: React.FC = () => {
  return (
    <Router basename="/">
      <div className="min-h-screen flex flex-col font-sans">
        <Navbar />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/negocios" element={<Trades />} />
            <Route path="/trades" element={<Trades />} />
            <Route path="/asset/:ticker" element={<AssetPage />} />
            <Route path="/charts" element={<Charts />} />
            <Route path="/ntnb" element={<NtnbDashboard />} />
            <Route path="/dashboard-ntnb" element={<NtnbDashboard />} />
            <Route path="/primary" element={<Primary />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/apoiar" element={<Contact />} />
          </Routes>
        </main>
        <footer className="bg-white border-t border-slate-200 py-10 mt-20">
          <div className="container mx-auto px-4 text-center space-y-3">
            <p className="text-slate-500 text-sm font-semibold">
              &copy; {new Date().getFullYear()} FIXDATA — Inteligência e Dados de Renda Fixa e Mercado Secundário.
            </p>
            <p className="text-slate-400 text-xs font-medium flex items-center justify-center gap-2 flex-wrap">
              <span>Desenvolvido por{' '}
              <a
                href="https://www.linkedin.com/in/leonardo-contador-neves-096312119/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:text-blue-600 transition-colors font-bold"
              >
                Leonardo Contador Neves
              </a></span>
              <span>•</span>
              <Link to="/contact" className="text-amber-600 hover:text-amber-700 font-bold flex items-center gap-1">
                <Coffee size={14} />
                <span>Buy Me a Coffee / Contato</span>
              </Link>
            </p>
            <p className="text-slate-300 text-[10px] uppercase tracking-widest">
              Base de dados CVM, ANBIMA e B3
            </p>
          </div>
        </footer>
      </div>
    </Router>
  );
};

export default App;
