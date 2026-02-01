
import React from 'react';
import { HashRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import AssetPage from './pages/Asset';
import Charts from './pages/Charts';
import Primary from './pages/Primary';
import { LayoutDashboard, LineChart, Files, Tag, Menu, X } from 'lucide-react';

const Navbar = () => {
  const location = useLocation();
  const [isOpen, setIsOpen] = React.useState(false);

  const navItems = [
    { path: '/', label: 'Home', icon: <LayoutDashboard size={18} /> },
    // { path: '/x', label: 'Radar de Eventos', icon: <Files size={18} /> },
    { path: '/charts', label: 'Dashboard', icon: <LineChart size={18} /> },
    { path: '/primary', label: 'Mercado Primário', icon: <Tag size={18} /> },
  ];

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-[100]">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-10 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">MCP</div>
            {/* <span className="font-black text-xl tracking-tighter text-slate-900 hidden sm:block">MCP</span> */}
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
    <Router>
      <div className="min-h-screen flex flex-col font-sans">
        <Navbar />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/asset/:ticker" element={<AssetPage />} />
            <Route path="/charts" element={<Charts />} />
            <Route path="/primary" element={<Primary />} />
          </Routes>
        </main>
        <footer className="bg-white border-t border-slate-200 py-10 mt-20">
          <div className="container mx-auto px-4 text-center">
            <p className="text-slate-400 text-sm font-medium">
              &copy; {new Date().getFullYear()} Meu Crédito Privado. Todos os direitos reservados.
            </p>
            <p className="text-slate-400 text-sm font-medium">
              Desenvolvido por{' '}
              <a
                href="https://www.linkedin.com/in/leonardo-contador-neves-096312119/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:text-blue-600 transition-colors"
              >
                Leonardo Contador Neves
              </a>
            </p>
            <p className="text-slate-300 text-[10px] mt-2 uppercase tracking-widest">
              Base de dados CVM e ANBIMA
            </p>
          </div>
        </footer>
      </div>
    </Router>
  );
};

export default App;
