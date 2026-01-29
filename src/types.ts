
export interface AssetMaster {
  ticker: string;
  isin: string;
  issuer_name: string;
  asset_type: string;
  series: string;
  seniority: string;
  guarantee: string;
  rating_fitch: string;
  issue_date: string;
  maturity_date: string;
  coupon_type: string;
  issuer_cnpj: string;
  sector: string;
}

export interface PriceData {
  date: string;
  ticker: string;
  isin: string;
  price: number;
  clean_price: number;
  yield: number;
  ytm: number;
  spread_over_ref: number;
  volume_traded: number;
}

export interface Offer {
  offer_id: string;
  ticker: string;
  isin: string;
  issuer_name: string;
  offer_type: string;
  announce_date: string;
  open_date: string;
  close_date: string;
  amount_offered: number;
  currency: string;
  status: 'announced' | 'open' | 'closed';
  prospectus_url: string;
}

export interface CalendarEvent {
  event_id: string;
  ticker: string;
  isin: string;
  issuer_name: string;
  event_type: string;
  event_date: string;
  amount: number;
  currency: string;
  notes: string;
}

export interface Document {
  isin: string;
  doc_type: string;
  doc_title: string;
  doc_url: string;
  uploaded_at: string;
}

export interface Metadata {
  last_updated: string;
  source: string;
}
