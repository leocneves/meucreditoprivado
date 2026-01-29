
import React, { useMemo, useState } from 'react';
import { useData } from '../App';
import { Search, Filter, Calendar as CalendarIcon, ExternalLink } from 'lucide-react';

const PrimaryMarket: React.FC = () => {
  const { offers, calendar } = useData();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredOffers = useMemo(() => {
    return offers.filter(o => 
      o.debtor.toLowerCase().includes(searchTerm.toLowerCase()) || 
      o.ticker.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [offers, searchTerm]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black text-slate-900">Mercado Primário</h1>
        <p className="text-slate-500">Acompanhe novas emissões e ofertas públicas em andamento.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Offers Table */}
        <div className="lg:col-span-3 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Filtrar por devedor ou ticker..."
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Ticker</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Devedor</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Status</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Volume</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOffers.length > 0 ? filteredOffers.map((o, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-bold text-indigo-700">{o.ticker}</td>
                    <td className="px-6 py-4">
                      <p className="font-semibold text-slate-800">{o.debtor}</p>
                      <p className="text-xs text-slate-400">{o.type}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                        o.status === 'Em Aberto' ? 'bg-emerald-100 text-emerald-700' : 
                        o.status === 'Planejada' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {o.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{o.volume}</td>
                    <td className="px-6 py-4 text-sm text-slate-600 text-right">{o.date}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-400">Nenhuma oferta encontrada.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mini Calendar sidebar */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><CalendarIcon size={20} className="text-indigo-600"/> Calendário</h2>
            <div className="space-y-4">
              {calendar.length > 0 ? calendar.slice(0, 10).map((e, idx) => (
                <div key={idx} className="flex items-center gap-4 py-2 border-b last:border-0 border-slate-50">
                   <div className="text-center min-w-[40px]">
                      <p className="text-[10px] uppercase font-bold text-slate-400">{new Date(e.event_date).toLocaleDateString('pt-BR', { month: 'short' })}</p>
                      <p className="text-sm font-bold text-slate-700">{new Date(e.event_date).getDate()}</p>
                   </div>
                   <div className="flex-grow">
                      <p className="text-sm font-bold text-slate-900">{e.ticker}</p>
                      <p className="text-[10px] text-slate-500 capitalize">{e.event_type.toLowerCase()}</p>
                   </div>
                </div>
              )) : <p className="text-sm text-slate-400">Nenhum evento agendado.</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrimaryMarket;
