import React, { useState } from 'react';
import { PriceRecord } from '../utils/csv';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import { TrendingUp, DollarSign, Calendar } from 'lucide-react';

interface ChartComponentProps {
  prices: PriceRecord[];
  ticker: string;
  indexador?: string;
}

const ChartComponent: React.FC<ChartComponentProps> = ({ prices, ticker, indexador }) => {
  const [viewMode, setViewMode] = useState<'price' | 'yield'>('yield');

  // Filtrar e ordenar registros válidos
  const validRecords = (prices || [])
    .filter(p => p && p.date)
    .map(p => ({
      date: p.date,
      datePretty: p.date.includes('-')
        ? `${p.date.split('-')[2]}/${p.date.split('-')[1]}/${p.date.split('-')[0].slice(2)}`
        : p.date,
      price: parseFloat(String(p.price || p.clean_price || '').replace(',', '.')),
      yield: parseFloat(String(p.yield || '').replace(',', '.'))
    }))
    .filter(p => !isNaN(p.price) || !isNaN(p.yield))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (validRecords.length === 0) {
    return (
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm text-center space-y-3">
        <div className="p-3 bg-slate-50 text-slate-400 rounded-full w-12 h-12 mx-auto flex items-center justify-center">
          <Calendar size={24} />
        </div>
        <h4 className="text-base font-bold text-slate-800">Histórico de Mercado Secundário</h4>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          Este ativo não registrou negociações no mercado secundário da ANBIMA/B3 nos últimos períodos. Os indicadores apresentados baseiam-se nas condições contratuais de emissão.
        </p>
      </div>
    );
  }

  const hasYields = validRecords.some(r => !isNaN(r.yield) && r.yield > 0);
  const hasPrices = validRecords.some(r => !isNaN(r.price) && r.price > 0);

  return (
    <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <TrendingUp size={22} className="text-blue-600" />
            Evolução Histórica de Mercado ({ticker})
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Série temporal de cotações e taxas indicativas registradas no mercado secundário.
          </p>
        </div>

        <div className="flex items-center p-1 bg-slate-100 rounded-xl">
          {hasYields && (
            <button
              onClick={() => setViewMode('yield')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                viewMode === 'yield'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Taxa Indicativa (% a.a.)
            </button>
          )}

          {hasPrices && (
            <button
              onClick={() => setViewMode('price')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                viewMode === 'price'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Preço Unitário (PU)
            </button>
          )}
        </div>
      </div>

      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={validRecords} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
            <defs>
              <linearGradient id="colorYield" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="datePretty" stroke="#64748b" fontSize={11} tickLine={false} />
            <YAxis
              domain={['auto', 'auto']}
              stroke="#64748b"
              fontSize={11}
              tickLine={false}
              unit={viewMode === 'yield' ? '%' : ''}
              tickFormatter={(v) =>
                viewMode === 'yield' ? `${Number(v).toFixed(2)}%` : `R$ ${Number(v).toFixed(0)}`
              }
            />

            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const dataItem = payload[0].payload;
                  return (
                    <div className="bg-slate-900 text-white p-3 rounded-xl shadow-lg text-xs space-y-1">
                      <p className="font-semibold text-slate-300">Data: {dataItem.date}</p>
                      {!isNaN(dataItem.yield) && (
                        <p className="text-blue-300 font-bold">
                          Taxa Indicativa: {dataItem.yield.toFixed(4)}% a.a.
                        </p>
                      )}
                      {!isNaN(dataItem.price) && (
                        <p className="text-emerald-300 font-bold">
                          PU de Fechamento: R$ {dataItem.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                      )}
                    </div>
                  );
                }
                return null;
              }}
            />

            {viewMode === 'yield' ? (
              <Area
                type="monotone"
                dataKey="yield"
                name="Taxa Indicativa (% a.a.)"
                stroke="#2563eb"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#colorYield)"
              />
            ) : (
              <Area
                type="monotone"
                dataKey="price"
                name="Preço Unitário (PU)"
                stroke="#10b981"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#colorPrice)"
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
        <span>Fonte: ANBIMA / B3 Mercado Secundário</span>
        <span>{validRecords.length} cotações históricas disponíveis</span>
      </div>
    </div>
  );
};

export default ChartComponent;
