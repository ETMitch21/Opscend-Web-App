export interface MobileSentrixStatusResponse {
    ok: boolean;
    connected: boolean;
    provider: "mobilesentrix";
    connectedAt: string | null;
    updatedAt: string | null;
}

export interface MobileSentrixConnectResponse {
    ok: boolean;
    url: string;
}

export interface MobileSentrixDisconnectResponse {
    ok: boolean;
    disconnected: boolean;
}

export interface MobileSentrixSearchParams {
  q: string;
  maxResults?: number;
  startIndex?: number;
}

export interface MobileSentrixRawItem {
    [key: string]: any;
}

export interface MobileSentrixSearchItemApi {
  product_id: string;
  original_product_id: string;
  title: string;
  description: string;
  link: string;
  price: string;
  list_price: string;
  quantity: string; // "1" or "0"
  product_code: string;
  new_sku?: string; // ← optional
  image_link: string;
  total_reviews: string;
  reviews_average_score: string;
  tags: string;
  front_position: string;
}

export type MobileSentrixSearchSource = 'live' | 'cache' | 'linked_products' | 'unavailable';

export interface MobileSentrixSearchResponse {
  ok: boolean;
  items: MobileSentrixSearchItemApi[];
  source?: MobileSentrixSearchSource;
  cached?: boolean;
  stale?: boolean;
  fetchedAt?: string | null;
  warning?: string | null;
  unavailable?: boolean;
  requiresReconnect?: boolean;
  code?: string | number | null;
  upstreamStatus?: number | null;
  cfRay?: string | null;
  attempts?: number | null;
}

export interface MobileSentrixSearchResult {
  id: string; // product_id
  title: string;
  link: string | null;
  sku: string | null; // new_sku > product_code
  costCents: number | null; // price
  inStock: boolean; // quantity === "1"
  imageUrl: string | null;
  tags: string[];
  category: string | null;
  supplier: 'mobilesentrix';
}