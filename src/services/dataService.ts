
import Papa from 'papaparse';
import { AssetMaster, PriceData, Offer, CalendarEvent, Document, Metadata } from '../types';

async function fetchCSV<T>(url: string): Promise<T[]> {
  const response = await fetch(url);
  const csvString = await response.text();
  return new Promise((resolve, reject) => {
    Papa.parse<T>(csvString, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results) => resolve(results.data),
      error: (error: any) => reject(error)
    });
  });
}

export const dataService = {
  getAssets: () => fetchCSV<AssetMaster>('./data/assets_master.csv'),
  getPrices: () => fetchCSV<PriceData>('./data/prices.csv'),
  getOffers: () => fetchCSV<Offer>('./data/offers.csv'),
  getCalendar: () => fetchCSV<CalendarEvent>('./data/calendar.csv'),
  getDocuments: () => fetchCSV<Document>('./data/documents.csv'),
  getMetadata: async (): Promise<Metadata> => {
    const response = await fetch('./data/_metadata.json');
    return response.json();
  }
};
