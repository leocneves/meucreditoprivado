
import React, { useEffect, useState } from 'react';
import { fetchCSV } from '../utils/csv';
import { BadgeInfo } from 'lucide-react';

const Primary: React.FC = () => {
  const [offers, setOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchCSV<any>('./data/offers.csv');
        setOffers(data);
      } catch (err) {
        console.log("No primary offers found or error loading offers.csv");
        setOffers([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <h1 className="text-3xl font-bold text-slate-900">Mercado Primário</h1>
      <p className="text-slate-600">Novas ofertas e emissões em andamento.</p>

      {loading ? (
        <p>Carregando ofertas...</p>
      ) : offers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {offers.map((offer, idx) => (
            <div key={idx} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="font-bold text-lg">{offer.ticker || 'Nova Oferta'}</h3>
              <p className="text-slate-500">{offer.issuer || 'Emissor'}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-blue-50 p-8 rounded-3xl border border-blue-100 text-center text-blue-700">
          <BadgeInfo className="mx-auto mb-3 opacity-50" size={40} />
          <p className="font-bold">Nenhuma oferta primária disponível no momento.</p>
          <p className="text-sm opacity-80">Fique de olho em novas atualizações de mercado.</p>
        </div>
      )}
    </div>
  );
};

export default Primary;
