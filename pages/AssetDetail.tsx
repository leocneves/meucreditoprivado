
import React, { useMemo, useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useData } from '../App';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
// Added TrendingUp to the imports from lucide-react
import { FileText, Download, Star, Info, ChevronLeft, TrendingUp } from 'lucide-react';

const AssetDetail: React.FC = () => {
  const { ticker } = useParams<{ ticker: string }>();
  const { assets, prices, documents } = useData();
  const [watchlist, setWatchlist] = useState<string[]>(JSON.parse(localStorage.getItem('watchlist') || '[]'));

  const asset = assets.find(a => a.ticker === ticker);
  const assetPrices = prices.filter(p => p.ticker === ticker).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const assetDocs = documents.filter(d => d.ticker === ticker);
  
  const latestPrice = assetPrices[assetPrices.length - 1];

  const toggleWatchlist = () => {
    let newList;
    if (watchlist.includes(ticker!)) {
      newList = watchlist.filter(t => t !== ticker);
    } else {
      newList = [...watchlist, ticker!];
    }
    setWatchlist(newList);
    localStorage.setItem('watchlist', JSON.stringify(newList));
  };

  const isWatchlisted = watchlist.includes(ticker!);

  if (!asset) return (
    <div className="p-8 text-center space-y-4">
      <h2 className="text-2xl font-bold">Ativo não encontrado</h2>
      <Link to="/" className="text-indigo-600 hover:underline inline-flex items-center gap-1"><ChevronLeft size={18}/> Voltar para o início</Link>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-extrabold text-slate-900">{asset.ticker}</h1>
            <span className="px-3 py-1 bg-indigo-100 text-indigo-700 text-sm font-bold rounded-lg">{asset.type}</span>
          </div>
          <p className="text-lg text-slate-500 mt-1">{asset.debtor} • {asset.sector}</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={toggleWatchlist}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-all ${
              isWatchlisted 
              ? 'bg-amber-100 text-amber-600 border border-amber-200' 
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Star size={18} fill={isWatchlisted ? 'currentColor' : 'none'} />
            {isWatchlisted ? 'Monitorado' : 'Monitorar'}
          </button>
          <a
            href={`data:text/csv;charset=utf-8,${encodeURIComponent(JSON.stringify(assetPrices))}`}
            download={`${asset.ticker}_prices.csv`}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-900 text-white rounded-xl font-bold hover:bg-indigo-800 transition-all shadow-sm shadow-indigo-200"
          >
            <Download size={18} />
            CSV
          </a>
        </div>
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Preço Atual', value: latestPrice?.price || 'N/A', sub: 'PU' },
          { label: 'YTM (Ao Ano)', value: latestPrice?.ytm ? `${latestPrice.ytm}%` : 'N/A', color: 'text-indigo-600' },
          { label: 'Spread', value: latestPrice?.spread ? `${latestPrice.spread}%` : 'N/A', color: 'text-red-600' },
          { label: 'Duration', value: latestPrice?.duration ? `${latestPrice.duration} anos` : 'N/A' },
        ].map((m, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm text-center md:text-left">
            <p className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-1">{m.label}</p>
            <p className={`text-2xl md:text-3xl font-black ${m.color || 'text-slate-900'}`}>{m.value}</p>
            {m.sub && <p className="text-xs text-slate-400 mt-1">{m.sub}</p>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Charts Section */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><TrendingUp size={20} className="text-indigo-600"/> Histórico de Preço e Yield</h2>
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={assetPrices}>
                  <defs>
                    <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(val) => new Date(val).toLocaleDateString('pt-BR', {month: 'short'})}
                    tick={{fontSize: 12, fill: '#94a3b8'}}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis 
                    yAxisId="left" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fontSize: 12, fill: '#94a3b8'}}
                    domain={['auto', 'auto']}
                  />
                  <YAxis 
                    yAxisId="right" 
                    orientation="right" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fontSize: 12, fill: '#94a3b8'}}
                    domain={['auto', 'auto']}
                  />
                  <Tooltip 
                    contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} 
                  />
                  <Area yAxisId="left" type="monotone" dataKey="price" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorPrice)" name="Preço" />
                  <Line yAxisId="right" type="monotone" dataKey="ytm" stroke="#ef4444" strokeWidth={2} dot={false} name="Yield %" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Sidebar: Master Data & Documents */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><Info size={20} className="text-slate-500"/> Detalhes do Ativo</h2>
            <div className="space-y-3">
              {[
                { label: 'ISIN', value: asset.isin },
                { label: 'Emissão', value: asset.issue_date },
                { label: 'Vencimento', value: asset.maturity_date },
                { label: 'Cupom', value: asset.coupon },
                { label: 'Moeda', value: asset.currency },
              ].map((item, i) => (
                <div key={i} className="flex justify-between text-sm py-2 border-b last:border-0 border-slate-50">
                  <span className="text-slate-500">{item.label}</span>
                  <span className="font-semibold text-slate-800">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><FileText size={20} className="text-slate-500"/> Documentos</h2>
            <div className="space-y-3">
              {assetDocs.length > 0 ? assetDocs.map((doc, i) => (
                <a 
                  key={i} 
                  href={doc.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:bg-slate-50 hover:border-indigo-200 transition-all group"
                >
                  <span className="text-sm font-medium text-slate-600 group-hover:text-indigo-600">{doc.doc_name}</span>
                  <FileText size={16} className="text-slate-300 group-hover:text-indigo-400" />
                </a>
              )) : <p className="text-sm text-slate-400">Nenhum documento anexado.</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssetDetail;
