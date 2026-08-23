import React, { useState } from 'react';
import { PriceRecord } from '../utils/csv';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts';
import { TrendingUp, Calendar, Table } from 'lucide-react';

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
    .filter(p => (!isNaN(p.price) && p.price > 0) || (!isNaN(p.yield) && p.yield > 0))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (validRecords.length === 0) {
    return (
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm text-center space-y-3">
        <div className="p-3 bg-slate-50 text-slate-400 rounded-full w-12 h-12 mx-auto flex items-center justify-center">
          <Calendar size={24} />
        </div>
        <h4 className="text-base font-bold text-slate-800">Histórico de Mercado Secundário</h4>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          Este ativo não registrou negociações no mercado secundário da ANBIMA/B3 nos últimos 180 dias. As métricas apresentadas baseiam-se nas condições contratuais de emissão.
        </p>
      </div>
    );
  }

  const hasYields = validRecords.some(r => !isNaN(r.yield) && r.yield > 0);
  const hasPrices = validRecords.some(r => !isNaN(r.price) && r.price > 0);
  const effectiveMode = (viewMode === 'yield' && !hasYields && hasPrices) ? 'price' : viewMode;

  const recentRecords = [...validRecords].reverse().slice(0, 5);

  return (
    <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <TrendingUp size={22} className="text-blue-600" />
            Evolução Histórica de Mercado ({ticker})
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Série temporal de cotações e taxas indicativas registradas no mercado secundário ANBIMA/B3.
          </p>
        </div>

        <div className="flex items-center p-1 bg-slate-100 rounded-xl">
          {hasYields && (
            <button
              onClick={() => setViewMode('yield')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                effectiveMode === 'yield'
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
                effectiveMode === 'price'
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
              unit={effectiveMode === 'yield' ? '%' : ''}
              tickFormatter={(v) =>
                effectiveMode === 'yield' ? `${Number(v).toFixed(2)}%` : `R$ ${Number(v).toFixed(0)}`
              }
            />

            <Tooltip
              content={({ active, payload }) => {
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
                          PU Fechamento: R$ {dataItem.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                      )}
                    </div>
                  );
                }
                return null;
              }}
            />

            {effectiveMode === 'yield' ? (
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

      {/* TABELA DE ÚLTIMOS FECHAMENTOS */}
      <div className="pt-4 border-t border-slate-100 space-y-3">
        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
          <Table size={14} className="text-blue-600" />
          Últimas Sessões de Negociação
        </h4>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          {recentRecords.map(r => (
            <div key={r.date} className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs">
              <span className="text-[11px] text-slate-400 font-semibold block">{r.datePretty}</span>
              {!isNaN(r.yield) && (
                <p className="font-bold text-blue-700 mt-0.5">{r.yield.toFixed(4)}% a.a.</p>
              )}
              {!isNaN(r.price) && (
                <p className="text-[11px] text-slate-600 font-medium">
                  R$ {r.price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
        <span>Fonte: ANBIMA / B3 Mercado Secundário</span>
        <span>{validRecords.length} sessões de negociação registradas</span>
      </div>
    </div>
  );
};

export default ChartComponent;
