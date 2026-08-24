import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip
} from 'recharts';

export type PieItem = {
  name: string;
  value: number;
  count?: number;
};

interface PieBoxProps {
  title: string;
  data: PieItem[];
  subtitle?: string;
}

const COLORS = [
  '#2563eb', // Blue
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#8b5cf6', // Purple
  '#06b6d4', // Cyan
  '#ec4899', // Pink
  '#94a3b8', // Slate (Outros)
];

const PieBox: React.FC<PieBoxProps> = ({ title, data, subtitle }) => {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
        <h3 className="text-base font-bold text-slate-900">{title}</h3>
        <p className="text-xs text-slate-400 my-12 text-center">Nenhum dado com os filtros atuais.</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition flex flex-col justify-between">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-base font-bold text-slate-900">{title}</h3>
        {subtitle && <span className="text-xs text-slate-400 font-medium">{subtitle}</span>}
      </div>

      <div className="h-48 w-full my-2">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={48}
              outerRadius={74}
              paddingAngle={3}
            >
              {data.map((entry, index) => {
                const isOthers = entry.name.toLowerCase().startsWith('outros');
                const fillColor = isOthers ? '#94a3b8' : COLORS[index % (COLORS.length - 1)];
                return <Cell key={`cell-${index}`} fill={fillColor} />;
              })}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const p = payload[0].payload as PieItem;
                  return (
                    <div className="bg-slate-900 text-white p-2.5 rounded-xl shadow-lg text-xs space-y-0.5">
                      <p className="font-bold text-slate-200">{p.name}</p>
                      <p className="text-blue-300 font-semibold">{p.value}% do total</p>
                      {p.count !== undefined && (
                        <p className="text-slate-400 text-[11px]">{p.count.toLocaleString('pt-BR')} ativos</p>
                      )}
                    </div>
                  );
                }
                return null;
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legend compacta e elegante com truncamento seguro */}
      <div className="pt-3 border-t border-slate-100 space-y-1.5 text-xs">
        {data.map((d, i) => {
          const isOthers = d.name.toLowerCase().startsWith('outros');
          const color = isOthers ? '#94a3b8' : COLORS[i % (COLORS.length - 1)];
          return (
            <div key={i} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ background: color }}
                />
                <span className="text-slate-700 font-medium truncate max-w-[140px] sm:max-w-[160px]" title={d.name}>
                  {d.name}
                </span>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0 text-slate-500 font-semibold">
                {d.count !== undefined && (
                  <span className="text-[11px] text-slate-400 font-normal">({d.count})</span>
                )}
                <span className="font-bold text-slate-800">{d.value}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PieBox;