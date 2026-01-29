
import React, { useState, useEffect, createContext, useContext } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import Papa from 'papaparse';
import { DataState, AssetMaster, PriceData, Offer, CalendarEvent, Document } from './types';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import AssetDetail from './pages/AssetDetail';
import Charts from './pages/Charts';
import PrimaryMarket from './pages/PrimaryMarket';
import Watchlist from './pages/Watchlist';

const DataContext = createContext<DataState | undefined>(undefined);

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) throw new Error("useData deve ser usado dentro de um DataProvider");
  return context;
};

const App: React.FC = () => {
  const [state, setState] = useState<DataState>({
    assets: [],
    prices: [],
    offers: [],
    calendar: [],
    documents: [],
    metadata: null,
    loading: true,
    error: null,
  });

  const fetchData = async () => {
    // Helper para buscar CSV com fallback para array vazio em caso de erro
    const safeFetchCSV = async <T,>(path: string): Promise<T[]> => {
      try {
        const response = await fetch(path);
        if (!response.ok) return []; // Retorna vazio se não encontrar o arquivo
        const csvText = await response.text();
        return new Promise((resolve) => {
          Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => resolve(results.data as T[]),
            error: () => resolve([]),
          });
        });
      } catch {
        return [];
      }
    };

    try {
      // Carrega os dados. Usamos Promise.all mas com o safeFetch para não estourar erro global
      const [assets, prices, offers, calendar, documents] = await Promise.all([
        safeFetchCSV<AssetMaster>('data/assets_master.csv'),
        safeFetchCSV<PriceData>('data/prices.csv'),
        safeFetchCSV<Offer>('data/offers.csv'),
        safeFetchCSV<CalendarEvent>('data/calendar.csv'),
        safeFetchCSV<Document>('data/documents.csv'),
      ]);

      let metadata = null;
      try {
        const metaRes = await fetch('data/metadata.json');
        if (metaRes.ok) metadata = await metaRes.json();
      } catch (e) {
        metadata = { last_updated: new Date().toISOString() };
      }

      setState({
        assets,
        prices,
        offers,
        calendar,
        documents,
        metadata,
        loading: false,
        error: assets.length === 0 ? "Nenhum ativo carregado. Verifique se os arquivos CSV estão na pasta /data/." : null
      });
    } catch (err: any) {
      setState(prev => ({ 
        ...prev, 
        loading: false, 
        error: "Erro crítico ao inicializar aplicação." 
      }));
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <DataContext.Provider value={state}>
      <HashRouter>
        <div className="min-h-screen flex flex-col bg-slate-50">
          <Navbar />
          <main className="flex-grow container mx-auto px-4 py-8">
            {state.loading ? (
              <div className="flex flex-col justify-center items-center h-96 space-y-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-900"></div>
                <p className="text-slate-500 font-medium">Carregando dados do mercado...</p>
              </div>
            ) : (
              <>
                {state.error && (
                  <div className="bg-amber-50 border-l-4 border-amber-500 p-4 mb-6 shadow-sm">
                    <p className="text-amber-800 font-medium">{state.error}</p>
                  </div>
                )}
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/asset/:ticker" element={<AssetDetail />} />
                  <Route path="/charts" element={<Charts />} />
                  <Route path="/primary" element={<PrimaryMarket />} />
                  <Route path="/watchlist" element={<Watchlist />} />
                </Routes>
              </>
            )}
          </main>
          <footer className="bg-white border-t py-6 mt-12">
            <div className="container mx-auto px-4 text-center text-slate-500 text-sm">
              <p className="font-semibold">Meu Crédito Privado &copy; {new Date().getFullYear()}</p>
              {state.metadata && (
                <p className="mt-1 opacity-75">Sincronizado em: {new Date(state.metadata.last_updated).toLocaleString('pt-BR')}</p>
              )}
            </div>
          </footer>
        </div>
      </HashRouter>
    </DataContext.Provider>
  );
};

export default App;
