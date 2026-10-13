
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import AssetPage from './pages/Asset';
import Charts from './pages/Charts';
import NtnbDashboard from './pages/NtnbDashboard';
import Primary from './pages/Primary';
import Contact from './pages/Contact';
import Trades from './pages/Trades';
import DebtorRadar from './pages/DebtorRadar';
import CalculatorPage from './pages/Calculator';
import { LayoutDashboard, LineChart, Files, Tag, Menu, X, Landmark, Coffee, ArrowLeftRight, Building2, Calculator, LogOut, User as UserIcon } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LeadGate } from './components/LeadGate';

const Navbar = () => {
  const location = useLocation();
  const [isOpen, setIsOpen] = React.useState(false);
  const { user, loginWithGoogle, logout, isConfigured } = useAuth();

  const navItems = [
    { path: '/', label: 'Home', icon: <LayoutDashboard size={18} /> },
    { path: '/raiox-devedor', label: 'Raio-X Devedor', icon: <Building2 size={18} /> },
    { path: '/calculadora', label: 'Calculadora', icon: <Calculator size={18} /> },
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
          <Link to="/" className="flex items-center shrink-0" title="FIXDATA — Página Inicial">
            <div className="px-3 py-1 bg-blue-600 rounded-lg flex items-center justify-center text-white font-black tracking-wider text-sm sm:text-base shadow-xs hover:bg-blue-700 transition">
              FIX<span className="text-blue-200 font-extrabold">DATA</span>
            </div>
          </Link>

          {/* Mobile Menu Button */}
          <button className="md:hidden p-2 text-slate-600" onClick={() => setIsOpen(!isOpen)}>
            {isOpen ? <X /> : <Menu />}
          </button>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-0.5 lg:gap-1">
            {navItems.map(item => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 rounded-lg font-bold text-xs lg:text-sm whitespace-nowrap transition-all ${
                  location.pathname === item.path 
                  ? 'bg-blue-50 text-blue-600' 
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            ))}

            {/* Auth Button Desktop */}
            {isConfigured && (
              <div className="ml-2 pl-2 border-l border-slate-200 flex items-center">
                {user ? (
                  <div className="flex items-center gap-2">
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt={user.displayName || 'Usuário'}
                        className="w-7 h-7 rounded-full border border-slate-300 object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center">
                        {(user.displayName || user.email || 'U')[0].toUpperCase()}
                      </div>
                    )}
                    <span className="text-xs font-semibold text-slate-700 hidden lg:inline max-w-[100px] truncate">
                      {user.displayName?.split(' ')[0] || user.email?.split('@')[0]}
                    </span>
                    <button
                      onClick={() => logout()}
                      title="Sair da conta"
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                    >
                      <LogOut size={16} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => loginWithGoogle('navbar')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                    </svg>
                    <span>Entrar</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Nav Dropdown */}
      {isOpen && (
        <div className="md:hidden bg-white border-t border-slate-100 p-4 space-y-2 shadow-lg">
          {isConfigured && (
            <div className="pb-3 mb-2 border-b border-slate-100">
              {user ? (
                <div className="flex items-center justify-between p-2 bg-slate-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt={user.displayName || 'Usuário'}
                        className="w-8 h-8 rounded-full border border-slate-300 object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold text-sm flex items-center justify-center">
                        {(user.displayName || user.email || 'U')[0].toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="text-xs font-bold text-slate-800">{user.displayName || 'Usuário'}</p>
                      <p className="text-[11px] text-slate-400 truncate max-w-[180px]">{user.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => { logout(); setIsOpen(false); }}
                    className="p-2 text-slate-400 hover:text-red-500 rounded-lg"
                  >
                    <LogOut size={18} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { loginWithGoogle('navbar_mobile'); setIsOpen(false); }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold shadow-xs"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                  </svg>
                  <span>Entrar com o Google</span>
                </button>
              )}
            </div>
          )}
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
    <AuthProvider>
      <Router basename="/">
        <div className="min-h-screen flex flex-col font-sans">
          <Navbar />
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route
                path="/raiox-devedor"
                element={
                  <LeadGate
                    title="Raio-X do Devedor Completo"
                    subtitle="Consulte indicadores contábeis, endividamento, cronograma de amortizações e riscos de emissores de crédito privado."
                    featureOrigin="raiox_devedor"
                  >
                    <DebtorRadar />
                  </LeadGate>
                }
              />
              <Route
                path="/devedor"
                element={
                  <LeadGate
                    title="Raio-X do Devedor Completo"
                    subtitle="Consulte indicadores contábeis, endividamento, cronograma de amortizações e riscos de emissores de crédito privado."
                    featureOrigin="raiox_devedor"
                  >
                    <DebtorRadar />
                  </LeadGate>
                }
              />
              <Route path="/calculadora" element={<CalculatorPage />} />
              <Route path="/calculator" element={<CalculatorPage />} />
              <Route path="/grossup" element={<CalculatorPage />} />
              <Route path="/negocios" element={<Trades />} />
              <Route path="/trades" element={<Trades />} />
              <Route path="/asset/:ticker" element={<AssetPage />} />
              <Route
                path="/charts"
                element={
                  <LeadGate
                    title="Painel Analítico de Crédito Privado"
                    subtitle="Gráficos avançados de taxas ANBIMA, dispersão de PU e comportamento de mercado secundário."
                    featureOrigin="charts_dashboard"
                  >
                    <Charts />
                  </LeadGate>
                }
              />
              <Route
                path="/ntnb"
                element={
                  <LeadGate
                    title="Curva NTN-B & Spreads de Crédito"
                    subtitle="Acesse a estrutura a termo da taxa de juros real, prêmios de risco e histórico de spreads."
                    featureOrigin="ntnb_dashboard"
                  >
                    <NtnbDashboard />
                  </LeadGate>
                }
              />
              <Route
                path="/dashboard-ntnb"
                element={
                  <LeadGate
                    title="Curva NTN-B & Spreads de Crédito"
                    subtitle="Acesse a estrutura a termo da taxa de juros real, prêmios de risco e histórico de spreads."
                    featureOrigin="ntnb_dashboard"
                  >
                    <NtnbDashboard />
                  </LeadGate>
                }
              />
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
    </AuthProvider>
  );
};


export default App;
