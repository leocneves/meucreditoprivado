
import Papa from 'papaparse';

export interface Asset {
  ticker: string;
  isin: string;
  issuer_name: string;
  asset_type: string;
  series: string;
  seniority: string;
  guarantee: string;
  issue_date: string;
  vencimento: string;
  indexador: string;
  issuer_cnpj: string;
  sector: string;
}

export interface PriceRecord {
  date: string;
  ticker: string;
  isin: string;
  price: string;
  clean_price: string;
  yield: string;
  ytm: string;
  spread_over_ref: string;
  volume_traded: string;
}

export interface Metadata {
  last_update: string;
}

export const fetchCSV = <T,>(url: string): Promise<T[]> => {
  return new Promise((resolve, reject) => {
    Papa.parse(url, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        resolve(results.data as T[]);
      },
      error: (error) => {
        reject(error);
      }
    });
  });
};

export const fetchMetadata = async (): Promise<Metadata | null> => {
  try {
    const response = await fetch('./data/_metadata.json');
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
};
