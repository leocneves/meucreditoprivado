
import React, { useState, useEffect, createContext, useContext } from 'react';
import { HashRouter, Routes, Route, Link } from 'react-router-dom';
import Papa from 'papaparse';
import { DataState, AssetMaster, PriceData, Offer, CalendarEvent, Document, AppMetadata } from './types';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import AssetDetail from './pages/AssetDetail';
import Charts from './pages/Charts';
import PrimaryMarket from './pages/PrimaryMarket';
import Watchlist from './pages/Watchlist';

// Context for global data
const DataContext = createContext<DataState | undefined>(undefined);

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) throw new Error("useData must be used within DataProvider");
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
    try {
      const fetchCSV = <T,>(url: string): Promise<T[]> => 
        new Promise((resolve, reject) => {
          Papa.parse(url, {
            download: true,
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
              if (results.errors.length > 0 && results.data.length === 0) {
                reject(results.errors[0]);
              } else {
                resolve(results.data as T[]);
              }
            },
            error: (err) => reject(err),
          });
        });

      // Usando caminhos relativos que funcionam bem com o build do Vite
      const [assets, prices, offers, calendar, documents, metadataRes] = await Promise.all([
        fetchCSV<AssetMaster>('data/assets_master.csv'),
        fetchCSV<PriceData>('data/prices.csv'),
        fetchCSV<Offer>('data/offers.csv'),
        fetchCSV<CalendarEvent>('data/calendar.csv'),
        fetchCSV<Document>('data/documents.csv'),
        fetch('data/metadata.json').then(res => res.json()).catch(() => ({ last_updated: new Date().toISOString() }))
      ]);

      setState({
        assets,
        prices,
        offers,
        calendar,
        documents,
        metadata: metadataRes,
        loading: false,
        error: null
      });
    } catch (err: any) {
      console.error("Failed to fetch data:", err);
      setState(prev => ({ 
        ...prev, 
        loading: false, 
        error: `Erro ao carregar dados: ${err.message || 'Verifique se os arquivos CSV existem na pasta /public/data/ ou /data/'}` 
      }));
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <DataContext.Provider value={state}>
      <HashRouter>
        <div className="min-h-screen flex flex-col">
          <Navbar />
          <main className="flex-grow container mx-auto px-4 py-8">
            {state.error && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
                <p className="text-red-700 font-medium">{state.error}</p>
              </div>
            )}
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/asset/:ticker" element={<AssetDetail />} />
              <Route path="/charts" element={<Charts />} />
              <Route path="/primary" element={<PrimaryMarket />} />
              <Route path="/watchlist" element={<Watchlist />} />
            </Routes>
          </main>
          <footer className="bg-white border-t py-6">
            <div className="container mx-auto px-4 text-center text-slate-500 text-sm">
              <p>Meu Crédito Privado &copy; {new Date().getFullYear()}</p>
              {state.metadata && (
                <p className="mt-1">Última atualização: {new Date(state.metadata.last_updated).toLocaleString('pt-BR')}</p>
              )}
            </div>
          </footer>
        </div>
      </HashRouter>
    </DataContext.Provider>
  );
};

export default App;
