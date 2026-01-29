
import React, { useMemo } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { AssetMaster, PriceData } from '../types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
// Added TrendingUp to imports to fix "Cannot find name 'TrendingUp'"
import { FileText, Download, Building2, MapPin, Calendar, Award, Info, Star, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
// Added ptBR import to fix "Cannot find name 'ptBR'"
import { ptBR } from 'date-fns/locale';
import { useWatchlist } from './Watchlist';

interface AssetPageProps {
  assets: AssetMaster[];
  prices: PriceData[];
}

export const AssetPage: React.FC<AssetPageProps> = ({ assets, prices }) => {
  const { ticker } = useParams();
  const { watchlist, toggle } = useWatchlist();
  
  const asset = assets.find(a => a.ticker === ticker);
  const assetPrices = prices.filter(p => p.ticker === ticker).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (!asset) return <Navigate to="/" />;

  const lastPrice = assetPrices[assetPrices.length - 1];
  const isFavorite = watchlist.includes(asset.ticker);

  const downloadCSV = () => {
    const headers = Object.keys(assetPrices[0]).join(',');
    const rows = assetPrices.map(p => Object.values(p).join(',')).join('\n');
    const blob = new Blob([[headers, rows].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${asset.ticker}_precos.csv`;
    link.click();
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">{asset.ticker}</h1>
            <button 
              onClick={() => toggle(asset.ticker)}
              className={`p-2 rounded-full transition-all ${isFavorite ? 'bg-yellow-50 text-yellow-500' : 'bg-slate-50 text-slate-300 hover:text-slate-400'}`}
            >
              <Star className={`w-6 h-6 ${isFavorite ? 'fill-yellow-500' : ''}`} />
            </button>
            <span className="text-xs font-bold px-2 py-1 bg-brand-50 text-brand-700 rounded-md border border-brand-100 uppercase">{asset.asset_type}</span>
          </div>
          <p className="text-slate-500 font-medium flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            {asset.issuer_name} • <span className="text-xs font-mono">{asset.isin}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button 
            onClick={downloadCSV}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-xl hover:bg-slate-700 transition-colors text-sm font-bold shadow-lg"
          >
            <Download className="w-4 h-4" />
            Exportar Dados
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Último Preço', value: lastPrice?.price.toFixed(2), sub: 'PU' },
          { label: 'Yield Atual', value: `${(lastPrice?.yield * 100).toFixed(2)}%`, sub: asset.coupon_type },
          { label: 'Spread Over', value: `+${lastPrice?.spread_over_ref}bps`, sub: 'vs Ref' },
          { label: 'Rating', value: asset.rating_fitch, sub: 'Fitch' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
            <p className="text-xs font-bold text-slate-400 uppercase mb-1">{stat.label}</p>
            <p className="text-xl font-black text-slate-800">{stat.value}</p>
            <p className="text-[10px] font-bold text-brand-600 mt-1">{stat.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-[450px] flex flex-col">
          <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-brand-600" />
            Histórico de Spread
          </h2>
          <div className="flex-1 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={assetPrices}>
                <defs>
                  <linearGradient id="colorSpread" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(val) => format(new Date(val), 'dd/MM')} 
                  fontSize={10} 
                  stroke="#94a3b8" 
                />
                <YAxis fontSize={10} stroke="#94a3b8" unit="bps" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} 
                  labelFormatter={(val) => format(new Date(val), "d 'de' MMM", { locale: ptBR })}
                />
                <Area type="monotone" dataKey="spread_over_ref" stroke="#0ea5e9" strokeWidth={3} fillOpacity={1} fill="url(#colorSpread)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Info className="w-5 h-5 text-brand-600" />
            Raio-X do Ativo
          </h2>
          <div className="space-y-4 flex-1 overflow-auto pr-2">
            {[
              { icon: Building2, label: 'CNPJ Emissor', value: asset.issuer_cnpj },
              { icon: MapPin, label: 'Setor', value: asset.sector },
              { icon: Calendar, label: 'Emissão', value: format(new Date(asset.issue_date), 'dd/MM/yyyy') },
              { icon: Calendar, label: 'Vencimento', value: format(new Date(asset.maturity_date), 'dd/MM/yyyy') },
              { icon: Award, label: 'Senioridade', value: asset.seniority },
              { icon: Info, label: 'Garantia', value: asset.guarantee.replace(/_/g, ' ') },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3 p-2 hover:bg-slate-50 rounded-lg transition-colors">
                <div className="bg-slate-100 p-2 rounded-lg text-slate-500">
                  <item.icon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase leading-none mb-1">{item.label}</p>
                  <p className="text-sm font-semibold text-slate-700">{item.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
