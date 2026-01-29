
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, TrendingUp, BarChart3, ListTree, Star } from 'lucide-react';

const Navbar: React.FC = () => {
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Início', icon: LayoutDashboard },
    { path: '/charts', label: 'Gráficos', icon: BarChart3 },
    { path: '/primary', label: 'Mercado Primário', icon: TrendingUp },
    { path: '/watchlist', label: 'Minha Lista', icon: Star },
  ];

  return (
    <nav className="bg-indigo-900 text-white shadow-lg sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2 font-bold text-xl tracking-tight">
            <span className="bg-white text-indigo-900 p-1 rounded">MCP</span>
            <span className="hidden sm:inline">Meu Crédito Privado</span>
          </Link>
          
          <div className="flex gap-1 md:gap-4 overflow-x-auto">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  location.pathname === item.path 
                  ? 'bg-indigo-800 text-white' 
                  : 'text-indigo-100 hover:bg-indigo-800'
                }`}
              >
                <item.icon size={18} />
                <span className="hidden md:inline">{item.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
