
import React, { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useData } from '../App';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Line } from 'recharts';
import { FileText, Download, Star, Info, ChevronLeft, TrendingUp } from 'lucide-react';

const AssetDetail: React.FC = () => {
  const { ticker } = useParams<{ ticker: string }>();
  const { assets, prices, documents } = useData();
  const [watchlist, setWatchlist] = useState<string[]>(JSON.parse(localStorage.getItem('watchlist') || '[]'));

  const asset = assets.find(a => a.ticker === ticker);
  const assetPrices = useMemo(() => 
    prices.filter(p => p.ticker === ticker).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [prices, ticker]
  );
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

  const handleDownloadCSV = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!assetPrices.length) return;
    
    const headers = "ticker,date,price,ytm,spread,duration\n";
    const rows = assetPrices.map(p => 
      `${p.ticker},${p.date},${p.price},${p.ytm},${p.spread},${p.duration}`
    ).join("\n");
    
    const csvContent = headers + rows;
    const encodedUri = encodeURI("data:text/csv;charset=utf-8," + csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${ticker}_precos.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!asset) return (
    <div className="p-12 text-center bg-white rounded-3xl border border-slate-100 shadow-sm">
      <h2 className="text-2xl font-bold text-slate-800">Ativo não encontrado</h2>
      <p className="text-slate-500 mt-2">O ticker {ticker} não consta na base de dados atual.</p>
      <Link to="/" className="mt-6 inline-flex items-center gap-2 text-indigo-600 font-bold hover:underline">
        <ChevronLeft size={18}/> Voltar para a busca
      </Link>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">{asset.ticker}</h1>
            <span className="px-3 py-1 bg-indigo-100 text-indigo-700 text-xs font-black rounded-lg uppercase">{asset.type}</span>
          </div>
          <p className="text-lg text-slate-500 mt-1 font-medium">{asset.debtor} • <span className="text-indigo-600/70">{asset.sector}</span></p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={toggleWatchlist}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold transition-all shadow-sm ${
              isWatchlisted 
              ? 'bg-amber-50 text-amber-600 border border-amber-200' 
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Star size={18} fill={isWatchlisted ? 'currentColor' : 'none'} />
            {isWatchlisted ? 'Monitorado' : 'Monitorar'}
          </button>
          <button
            onClick={handleDownloadCSV}
            className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
          >
            <Download size={18} />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Preço PU', value: latestPrice?.price || 'N/A', sub: 'Última Marcação' },
          { label: 'YTM (Taxa)', value: latestPrice?.ytm ? `${latestPrice.ytm}%` : 'N/A', color: 'text-indigo-600' },
          { label: 'Spread', value: latestPrice?.spread ? `${latestPrice.spread}%` : 'N/A', color: 'text-red-600' },
          { label: 'Duration', value: latestPrice?.duration ? `${latestPrice.duration}a` : 'N/A' },
        ].map((m, i) => (
          <div key={i} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{m.label}</p>
            <p className={`text-3xl font-black ${m.color || 'text-slate-900'}`}>{m.value}</p>
            {m.sub && <p className="text-[10px] text-slate-400 mt-2 font-bold uppercase">{m.sub}</p>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
            <h2 className="text-xl font-black mb-8 flex items-center gap-2 text-slate-800">
              <TrendingUp size={22} className="text-indigo-600"/> 
              Histórico de Negociação
            </h2>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={assetPrices}>
                  <defs>
                    <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(val) => new Date(val).toLocaleDateString('pt-BR', {month: 'short'})}
                    tick={{fontSize: 11, fontWeight: 700, fill: '#94a3b8'}}
                    axisLine={false}
                    tickLine={false}
                    dy={10}
                  />
                  <YAxis 
                    yAxisId="left" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fontSize: 11, fontWeight: 700, fill: '#94a3b8'}}
                    domain={['auto', 'auto']}
                  />
                  <YAxis 
                    yAxisId="right" 
                    orientation="right" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fontSize: 11, fontWeight: 700, fill: '#94a3b8'}}
                    domain={['auto', 'auto']}
                  />
                  <Tooltip 
                    contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '12px'}} 
                  />
                  <Area yAxisId="left" type="monotone" dataKey="price" stroke="#4f46e5" strokeWidth={4} fillOpacity={1} fill="url(#colorPrice)" name="Preço PU" />
                  <Line yAxisId="right" type="monotone" dataKey="ytm" stroke="#ef4444" strokeWidth={2} dot={{r: 4, fill: '#ef4444'}} name="Taxa (YTM) %" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
            <h2 className="text-lg font-black mb-6 flex items-center gap-2 text-slate-800">
              <Info size={20} className="text-indigo-600"/> 
              Master Data
            </h2>
            <div className="space-y-4">
              {[
                { label: 'ISIN', value: asset.isin },
                { label: 'Emissão', value: asset.issue_date },
                { label: 'Vencimento', value: asset.maturity_date },
                { label: 'Cupom', value: asset.coupon },
                { label: 'Moeda', value: asset.currency },
              ].map((item, i) => (
                <div key={i} className="flex justify-between items-center text-sm py-2 border-b border-slate-50 last:border-0">
                  <span className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">{item.label}</span>
                  <span className="font-black text-slate-800">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
            <h2 className="text-lg font-black mb-6 flex items-center gap-2 text-slate-800">
              <FileText size={20} className="text-indigo-600"/> 
              Documentos
            </h2>
            <div className="space-y-3">
              {assetDocs.length > 0 ? assetDocs.map((doc, i) => (
                <a 
                  key={i} 
                  href={doc.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 hover:bg-slate-50 hover:border-indigo-200 transition-all group"
                >
                  <span className="text-xs font-bold text-slate-600 group-hover:text-indigo-600">{doc.doc_name}</span>
                  <Download size={14} className="text-slate-300 group-hover:text-indigo-400" />
                </a>
              )) : <p className="text-sm text-slate-400 font-medium">Nenhum documento disponível.</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssetDetail;
