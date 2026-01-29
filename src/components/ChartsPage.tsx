
import React from 'react';
import { PriceData } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ScatterChart, Scatter, ZAxis } from 'recharts';
import { PieChart, Pie, Cell as PieCell } from 'recharts';
import { TrendingUp, BarChart3, ScatterChart as ScatterIcon, Layers } from 'lucide-react';

interface ChartsPageProps {
  prices: PriceData[];
}

export const ChartsPage: React.FC<ChartsPageProps> = ({ prices }) => {
  const latestPrices = prices.filter(p => p.date === '2026-01-27');
  
  const COLORS = ['#0ea5e9', '#3b82f6', '#2563eb', '#1d4ed8'];

  const spreadData = latestPrices.map(p => ({
    name: p.ticker,
    spread: p.spread_over_ref,
    yield: p.yield * 100,
  }));

  const volumeData = latestPrices.map(p => ({
    name: p.ticker,
    volume: p.volume_traded,
  }));

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
        <h1 className="text-2xl font-black text-slate-800 flex items-center gap-3">
          <Layers className="w-6 h-6 text-brand-600" />
          Panorama do Mercado Secundário
        </h1>
        <p className="text-slate-500 text-sm mt-1">Visão agregada de liquidez e prêmio de risco.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-[400px] flex flex-col">
          <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-brand-600" />
            Spreads por Ativo (bps)
          </h2>
          <div className="flex-1 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={spreadData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" fontSize={12} stroke="#94a3b8" />
                <YAxis fontSize={12} stroke="#94a3b8" />
                <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '12px'}} />
                <Bar dataKey="spread" radius={[4, 4, 0, 0]}>
                  {spreadData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-[400px] flex flex-col">
          <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <ScatterIcon className="w-5 h-5 text-brand-600" />
            Relação Yield vs Spread
          </h2>
          <div className="flex-1 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" dataKey="yield" name="Yield" unit="%" fontSize={12} stroke="#94a3b8" />
                <YAxis type="number" dataKey="spread" name="Spread" unit="bps" fontSize={12} stroke="#94a3b8" />
                <ZAxis range={[100, 100]} />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                <Scatter name="Ativos" data={spreadData} fill="#0ea5e9" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-[400px] flex flex-col md:col-span-2">
           <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-brand-600" />
            Volume Negociado por Ticker
          </h2>
          <div className="flex-1 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={volumeData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" fontSize={12} stroke="#94a3b8" />
                <YAxis dataKey="name" type="category" fontSize={12} stroke="#94a3b8" />
                <Tooltip cursor={{fill: '#f8fafc'}} />
                <Bar dataKey="volume" fill="#0ea5e9" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
