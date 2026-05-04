export type ProductStatus = 'active' | 'inactive';
export type SupplierProvider = 'mobilesentrix' | 'manual' | 'other';

export interface ProductSupplierLink {
  id: string;
  supplierId: string;

  supplierName: string | null;
  supplierProvider: SupplierProvider | null;

  supplierSku: string;
  supplierProductId: string | null;
  supplierProductName: string | null;
  supplierUrl: string | null;

  lastKnownCostCents: number | null;
  lastKnownInStock: boolean | null;
  lastSyncedAt: string | null;

  isPreferred: boolean;
}

export interface Product {
  id: string;
  shopId: string;
  name: string;
  sku: string | null;
  status: ProductStatus;
  price: number;
  cost: number | null;
  tags: string[];
  supplierLinks?: ProductSupplierLink[];
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

export interface CreateProductSupplierLinkPayload {
  supplierId?: string;
  provider?: SupplierProvider;
  supplierName?: string | null;

  supplierSku: string;
  supplierProductId?: string | null;
  supplierProductName?: string | null;
  supplierUrl?: string | null;

  lastKnownCostCents?: number | null;
  lastKnownInStock?: boolean | null;

  isPreferred?: boolean;
}

export interface CreateProductPayload {
  name: string;

  /**
   * Internal/shop SKU only.
   * Do not send MobileSentrix SKU here.
   */
  sku?: string | null;

  priceCents: number;
  costCents?: number | null;
  tags?: string[];

  supplierLink?: CreateProductSupplierLinkPayload;
}

export interface PatchProductPayload {
  name?: string;

  /**
   * Internal/shop SKU only.
   * Do not send MobileSentrix SKU here.
   */
  sku?: string | null;

  status?: ProductStatus;
  priceCents?: number;
  costCents?: number | null;
  tags?: string[];
}