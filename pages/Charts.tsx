
import React, { useMemo, useState } from 'react';
import { useData } from '../App';
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, Legend } from 'recharts';
import { Filter, Download, ChartBar } from 'lucide-react';

const Charts: React.FC = () => {
  const { assets, prices } = useData();
  const [filterType, setFilterType] = useState('ALL');

  const chartData = useMemo(() => {
    return prices
      .map(p => {
        const asset = assets.find(a => a.ticker === p.ticker);
        return {
          ...p,
          assetType: asset?.type || 'N/A',
          durationNum: parseFloat(p.duration) || 0,
          spreadNum: parseFloat(p.spread) || 0,
          ytmNum: parseFloat(p.ytm) || 0,
        };
      })
      .filter(p => filterType === 'ALL' || p.assetType === filterType);
  }, [prices, assets, filterType]);

  const bucketedData = useMemo(() => {
    const buckets = [
      { name: '0-2a', count: 0 },
      { name: '2-5a', count: 0 },
      { name: '5-10a', count: 0 },
      { name: '10a+', count: 0 },
    ];
    chartData.forEach(d => {
      if (d.durationNum < 2) buckets[0].count++;
      else if (d.durationNum < 5) buckets[1].count++;
      else if (d.durationNum < 10) buckets[2].count++;
      else buckets[3].count++;
    });
    return buckets;
  }, [chartData]);

  const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900">Análise de Mercado</h1>
          <p className="text-slate-500">Compare spreads, duration e rentabilidade entre ativos.</p>
        </div>
        <div className="flex gap-4">
          <div className="relative inline-flex items-center">
            <Filter className="absolute left-3 text-slate-400" size={16} />
            <select 
              value={filterType} 
              onChange={(e) => setFilterType(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 appearance-none font-medium"
            >
              <option value="ALL">Todos os Tipos</option>
              <option value="DEB">Debêntures</option>
              <option value="CRI">CRI</option>
              <option value="CRA">CRA</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Risk-Return Scatter */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold">Relação Spread vs Duration</h2>
            <p className="text-xs text-slate-400">Quanto maior spread e duration, maior o risco</p>
          </div>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis type="number" dataKey="durationNum" name="Duration" unit="a" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94a3b8'}} label={{ value: 'Duration (anos)', position: 'insideBottom', offset: -10, fontSize: 12, fill: '#94a3b8' }} />
                <YAxis type="number" dataKey="spreadNum" name="Spread" unit="%" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94a3b8'}} label={{ value: 'Spread (%)', angle: -90, position: 'insideLeft', fontSize: 12, fill: '#94a3b8' }} />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                <Scatter name="Ativos" data={chartData} fill="#4f46e5" shape="circle" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Duration Buckets */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <h2 className="text-lg font-bold mb-6">Concentração por Duration</h2>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bucketedData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94a3b8'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94a3b8'}} />
                <Tooltip />
                <Bar dataKey="count" name="Quantidade de Ativos" radius={[8, 8, 0, 0]}>
                  {bucketedData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Charts;
