
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
    const safeFetchCSV = async <T,>(path: string): Promise<T[]> => {
      try {
        console.log(`Buscando: ${path}`);
        const response = await fetch(path);
        if (!response.ok) {
          console.warn(`Aviso: Arquivo não encontrado ou erro no fetch: ${path} (${response.status})`);
          return [];
        }
        const csvText = await response.text();
        return new Promise((resolve) => {
          Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
              console.log(`Carregado ${path}: ${results.data.length} linhas`);
              resolve(results.data as T[]);
            },
            error: (err) => {
              console.error(`Erro PapaParse em ${path}:`, err);
              resolve([]);
            },
          });
        });
      } catch (e) {
        console.error(`Erro crítico no fetch de ${path}:`, e);
        return [];
      }
    };

    try {
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
        console.warn("Metadados não encontrados, usando data atual.");
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
        error: assets.length === 0 ? "Nenhum ativo encontrado em 'data/assets_master.csv'. Verifique a pasta /data/ no seu repositório." : null
      });
    } catch (err: any) {
      console.error("Erro fatal na inicialização:", err);
      setState(prev => ({ 
        ...prev, 
        loading: false, 
        error: "Erro crítico ao inicializar aplicação. Verifique o console do navegador." 
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
                <p className="text-slate-500 font-medium">Sincronizando dados...</p>
              </div>
            ) : (
              <>
                {state.error && (
                  <div className="bg-amber-50 border-l-4 border-amber-500 p-4 mb-6 shadow-sm rounded-r-xl">
                    <div className="flex p-4">
                       <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                             <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                       </div>
                       <div className="ml-3">
                          <p className="text-sm text-amber-700 font-medium">{state.error}</p>
                       </div>
                    </div>
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
          <footer className="bg-white border-t py-8 mt-12">
            <div className="container mx-auto px-4 text-center">
              <p className="font-bold text-slate-800">Meu Crédito Privado</p>
              <p className="text-slate-400 text-xs mt-1">Análise de ativos de renda fixa</p>
              {state.metadata && (
                <p className="mt-4 text-[10px] text-slate-400 uppercase tracking-widest">
                  Base de dados: {new Date(state.metadata.last_updated).toLocaleString('pt-BR')}
                </p>
              )}
            </div>
          </footer>
        </div>
      </HashRouter>
    </DataContext.Provider>
  );
};

export default App;
