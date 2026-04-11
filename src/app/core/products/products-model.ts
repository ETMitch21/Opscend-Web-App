export type ProductStatus = 'active' | 'inactive';

export interface Product {
  id: string;
  shopId: string;
  name: string;
  sku: string | null;
  status: ProductStatus;
  price: number;
  cost: number | null;
  tags: string[];
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  deletedAt: string | null;
  deletedBy: string | null;
}

export interface ProductListResponse {
  data: Product[];
  nextCursor: string | null;
}

export interface ProductListParams {
  limit?: number;
  cursor?: string | null;
  status?: ProductStatus;
  tag?: string;
  includeDeleted?: boolean;
}

export interface CreateProductPayload {
  name: string;
  sku?: string | null;
  priceCents: number;
  costCents?: number | null;
  tags?: string[];
}

export interface PatchProductPayload {
  name?: string;
  sku?: string | null;
  status?: ProductStatus;
  priceCents?: number;
  costCents?: number | null;
  tags?: string[];
}