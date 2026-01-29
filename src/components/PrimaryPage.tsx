
import React, { useState } from 'react';
import { Offer, CalendarEvent } from '../types';
import { TablePaged } from './TablePaged';
import { format } from 'date-fns';
import { ExternalLink, Tag, Filter, Search } from 'lucide-react';

interface PrimaryPageProps {
  offers: Offer[];
  calendar: CalendarEvent[];
}

export const PrimaryPage: React.FC<PrimaryPageProps> = ({ offers, calendar }) => {
  const [activeTab, setActiveTab] = useState<'offers' | 'calendar'>('offers');
  const [filter, setFilter] = useState('');

  const filteredOffers = offers.filter(o => 
    o.ticker.toLowerCase().includes(filter.toLowerCase()) || 
    o.issuer_name.toLowerCase().includes(filter.toLowerCase())
  );

  const filteredEvents = calendar.filter(e => 
    e.ticker.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-3">
            <Tag className="w-6 h-6 text-brand-600" />
            Mercado Primário
          </h1>
          <p className="text-slate-500 text-sm mt-1">Acompanhe as novas emissões e o calendário de eventos corporativos.</p>
        </div>
        <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl w-fit">
          <button 
            onClick={() => setActiveTab('offers')}
            className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'offers' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Ofertas
          </button>
          <button 
            onClick={() => setActiveTab('calendar')}
            className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'calendar' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Calendário
          </button>
        </div>
      </div>

      <div className="relative">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
          <Search className="w-4 h-4" />
        </div>
        <input 
          type="text" 
          placeholder="Filtrar por ticker ou emissor..." 
          className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      {activeTab === 'offers' ? (
        // Explicitly typed TablePaged<Offer> to fix type inference errors for columns
        <TablePaged<Offer>
          data={filteredOffers}
          columns={[
            { header: 'Ticker', accessor: 'ticker' },
            { header: 'Emissor', accessor: (o) => <span className="font-semibold text-slate-800">{o.issuer_name}</span> },
            { header: 'Tipo', accessor: 'offer_type' },
            { header: 'Abertura', accessor: (o) => format(new Date(o.open_date), 'dd/MM/yy') },
            { header: 'Volume', accessor: (o) => `${(o.amount_offered / 1000000).toFixed(1)}M` },
            { header: 'Status', accessor: (o) => (
              <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                o.status === 'open' ? 'bg-green-100 text-green-700' : 
                o.status === 'announced' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
              }`}>
                {o.status}
              </span>
            )},
            { header: 'Link', accessor: (o) => (
              <a href={o.prospectus_url} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline flex items-center gap-1">
                Docs <ExternalLink className="w-3 h-3" />
              </a>
            )},
          ]}
        />
      ) : (
        // Explicitly typed TablePaged<CalendarEvent> to fix type inference errors for columns
        <TablePaged<CalendarEvent>
          data={filteredEvents}
          columns={[
            { header: 'Data', accessor: (e) => <span className="font-mono text-slate-600">{format(new Date(e.event_date), 'dd/MM/yyyy')}</span> },
            { header: 'Ticker', accessor: 'ticker' },
            { header: 'Evento', accessor: 'event_type' },
            { header: 'Valor', accessor: (e) => `R$ ${e.amount.toLocaleString()}` },
            { header: 'Notas', accessor: 'notes' },
          ]}
        />
      )}
    </div>
  );
};
