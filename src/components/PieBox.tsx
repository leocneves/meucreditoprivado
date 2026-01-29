import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip
} from 'recharts';

type PieItem = {
  name: string;
  value: number;
};

interface PieBoxProps {
  title: string;
  data: PieItem[];
}

const COLORS = [
  '#2563eb', // blue
  '#0ea5e9', // sky
  '#22c55e', // green
  '#f59e0b', // amber
  '#ef4444', // red
];

const PieBox: React.FC<PieBoxProps> = ({ title, data }) => {
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition">

      <h3 className="text-lg font-semibold text-slate-800 mb-4">
        {title}
      </h3>

      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={55}
              outerRadius={85}
              paddingAngle={3}
            >
              {data.map((_, index) => (
                <Cell key={index} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>

            <Tooltip formatter={(v: number) => `${v}%`} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legend simples */}
      <div className="mt-4 space-y-1 text-sm">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full"
              style={{ background: COLORS[i % COLORS.length] }}
            />
            <span className="text-slate-600">
              {d.name}: <b>{d.value}%</b>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PieBox;