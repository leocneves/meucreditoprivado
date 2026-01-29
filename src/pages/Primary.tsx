import React, { useEffect, useState } from 'react';
import { fetchCSV } from '../utils/csv';
import { BadgeInfo, CalendarDays, BarChart3, Search } from 'lucide-react';

/* ================= TYPES ================= */

type Offer = {
  serie: string;
  emissao: string;
  issuer: string;
  status: string;
  indexador: string;
  volume_estimado: string;
  prazo_anos: string;
};

type Liquidacao = {
  ticker: string;
  issuer: string;
  settlement_date: string;
  volume: string;
  rating: string;
  indexador: string;
  taxa: string;
};

type OverviewMetric = {
  metric: string;
  value: string;
  label: string;
};

/* ================= COMPONENT ================= */

const Primary: React.FC = () => {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [liquidacoes, setLiquidacoes] = useState<Liquidacao[]>([]);
  const [overview, setOverview] = useState<OverviewMetric[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');

  /* ================= LOAD CSVs ================= */

  useEffect(() => {
    const load = async () => {
      try {
        const offersData = await fetchCSV<Offer>('./data/offers.csv');
        const liqData = await fetchCSV<Liquidacao>('./data/liquidacoes.csv');
        const overviewData = await fetchCSV<OverviewMetric>('./data/primary_overview.csv');

        liqData.sort(
          (a, b) =>
            new Date(a.settlement_date).getTime() -
            new Date(b.settlement_date).getTime()
        );

        setOffers(offersData);
        setLiquidacoes(liqData);
        setOverview(overviewData);
      } catch (err) {
        console.log('Erro ao carregar mercado primário');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  /* ================= HELPERS ================= */

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('pt-BR');

  const formatVolume = (v: string) => {
    const n = Number(v);
    if (!n) return v;
    if (n >= 1e9) return `R$ ${(n / 1e9).toFixed(2)} bi`;
    return `R$ ${(n / 1e6).toFixed(0)} mi`;
  };

  const formatMetric = (m: OverviewMetric) => {
    const n = Number(m.value);
    if (!n) return m.value;
    if (n >= 1e9) return `R$ ${(n / 1e9).toFixed(2)} bi`;
    return `R$ ${(n / 1e6).toFixed(0)} mi`;
  };

  /* ================= FILTER ================= */

  const filteredOffers = offers.filter(o =>
    `${o.emissao} ${o.serie} ${o.issuer}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  /* ================= RENDER ================= */

  return (
    <div className="container mx-auto px-4 py-8 space-y-14">

      {/* HEADER */}

      <div>
        <h1 className="text-3xl font-bold text-slate-900">Mercado Primário</h1>
        <p className="text-slate-600">
          Pipeline de emissões, visão geral e próximas liquidações
        </p>
      </div>

      {loading ? (
        <p>Carregando dados...</p>
      ) : (
        <>

          {/* ================= OVERVIEW ================= */}

          <section className="space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <BarChart3 size={22} />
              Overview do mercado
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {overview.map((m, idx) => (
                <div
                  key={idx}
                  className="bg-white p-5 rounded-2xl border shadow-sm text-center"
                >
                  <p className="text-2xl font-bold">
                    {formatMetric(m)}
                  </p>
                  <p className="text-sm text-slate-500">
                    {m.label}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* ================= PIPELINE ================= */}

          <section className="space-y-4">

            <h2 className="text-xl font-semibold">
              Pipeline de ofertas
            </h2>

            {/* SEARCH */}

            <div className="relative max-w-md">
              <Search className="absolute left-3 top-3 text-slate-400" size={18} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por emissão, série ou emissor..."
                className="pl-10 pr-4 py-2 w-full rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
            </div>

            {/* BOX COM SCROLL */}

            <div className="bg-white rounded-3xl border shadow-sm p-4 max-h-[420px] overflow-y-auto space-y-4">

              {filteredOffers.length > 0 ? (
                filteredOffers.map((offer, idx) => (
                  <div
                    key={idx}
                    className="p-5 rounded-2xl border border-slate-200 hover:shadow transition"
                  >
                    <p className="font-bold text-lg">
                      {offer.emissao}
                    </p>

                    <p className="text-slate-500">
                      {offer.serie} — {offer.issuer}
                    </p>

                    <div className="flex flex-wrap gap-2 mt-3 text-sm">

                      <span className="bg-slate-100 px-3 py-1 rounded-full">
                        {offer.status}
                      </span>

                      <span className="bg-slate-100 px-3 py-1 rounded-full">
                        {offer.indexador}
                      </span>

                      <span className="bg-slate-100 px-3 py-1 rounded-full">
                        {formatVolume(offer.volume_estimado)}
                      </span>

                      <span className="bg-slate-100 px-3 py-1 rounded-full">
                        {offer.prazo_anos} anos
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-16 text-slate-500">
                  Nenhuma oferta encontrada
                </div>
              )}

            </div>

          </section>

          {/* ================= LIQUIDAÇÕES ================= */}

          <section className="space-y-4">

            <h2 className="text-xl font-semibold flex items-center gap-2">
              <CalendarDays size={22} />
              Próximas liquidações
            </h2>

            <div className="bg-white rounded-3xl border shadow-sm p-4 max-h-[420px] overflow-y-auto space-y-4">

              {liquidacoes.length > 0 ? (
                liquidacoes.map((liq, idx) => (
                  <div
                    key={idx}
                    className="p-5 rounded-2xl border hover:shadow transition flex flex-col md:flex-row justify-between gap-4"
                  >
                    <div>
                      <p className="font-bold">
                        {liq.ticker} — {liq.issuer}
                      </p>
                      <p className="text-sm text-slate-500">
                        {liq.indexador} {liq.taxa} | Rating {liq.rating}
                      </p>
                    </div>

                    <div className="flex gap-6 text-sm">

                      <div>
                        <p className="text-slate-400">Liquidação</p>
                        <p className="font-semibold">
                          {formatDate(liq.settlement_date)}
                        </p>
                      </div>

                      <div>
                        <p className="text-slate-400">Volume</p>
                        <p className="font-semibold">
                          {formatVolume(liq.volume)}
                        </p>
                      </div>

                    </div>
                  </div>
                ))
              ) : (
                <div className="bg-blue-50 p-10 rounded-2xl text-center text-blue-700">
                  <BadgeInfo className="mx-auto mb-3 opacity-50" size={40} />
                  Nenhuma liquidação futura
                </div>
              )}

            </div>

          </section>

        </>
      )}
    </div>
  );
};

export default Primary;
