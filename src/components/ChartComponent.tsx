
import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { PriceRecord } from '../utils/csv';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface ChartComponentProps {
  prices: PriceRecord[];
  ticker: string;
}

const ChartComponent: React.FC<ChartComponentProps> = ({ prices, ticker }) => {
  const sortedPrices = [...prices].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  const data = {
    labels: sortedPrices.map(p => p.date),
    datasets: [
      {
        label: `Preço de Fechamento - ${ticker}`,
        data: sortedPrices.map(p => parseFloat(p.price)),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.3,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
      },
    },
    scales: {
      y: {
        ticks: {
          callback: (value: any) => `R$ ${value.toFixed(2)}`
        }
      }
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
      <Line data={data} options={options} />
    </div>
  );
};

export default ChartComponent;
