
export interface AssetMaster {
  ticker: string;
  isin: string;
  debtor: string;
  type: string; // DEB, CRI, CRA
  issue_date: string;
  maturity_date: string;
  coupon: string;
  currency: string;
  sector: string;
}

export interface PriceData {
  ticker: string;
  date: string;
  price: string;
  ytm: string;
  spread: string;
  duration: string;
}

export interface Offer {
  ticker: string;
  debtor: string;
  status: string; // Em Aberto, Encerrada, Planejada
  volume: string;
  type: string;
  date: string;
}

export interface CalendarEvent {
  event_date: string;
  ticker: string;
  event_type: string; // Juros, Amortização, Vencimento
}

export interface Document {
  ticker: string;
  doc_name: string;
  url: string;
}

export interface AppMetadata {
  last_updated: string;
}

export interface DataState {
  assets: AssetMaster[];
  prices: PriceData[];
  offers: Offer[];
  calendar: CalendarEvent[];
  documents: Document[];
  metadata: AppMetadata | null;
  loading: boolean;
  error: string | null;
}
