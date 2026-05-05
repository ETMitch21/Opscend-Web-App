import type { ProductStatus } from '../products/products-model';
import type { SupplierProvider } from '../products/products-model';

export type PurchaseOrderStatus =
  | 'draft'
  | 'submitted'
  | 'partially_received'
  | 'received'
  | 'canceled';

export interface PurchaseOrderSupplierSummary {
  id: string;
  name: string;
  provider: SupplierProvider;
}

export interface PurchaseOrderProductSummary {
  id: string;
  name: string;
  sku: string | null;
  status: ProductStatus;
  priceCents: number;
  costCents: number | null;
}

export interface PurchaseOrderItem {
  id: string;
  shopId: string;

  purchaseOrderId: string;

  productId: string;
  product: PurchaseOrderProductSummary | null;

  productSupplierId: string | null;

  nameSnapshot: string;
  skuSnapshot: string | null;

  supplierSkuSnapshot: string | null;
  supplierProductIdSnapshot: string | null;

  quantityOrdered: number;
  quantityReceived: number;
  quantityRemaining: number;

  unitCostCents: number;
  lineCostCents: number;

  notes: string | null;

  createdAt: string;
  updatedAt: string;
}

export interface PurchaseOrder {
  id: string;
  shopId: string;

  supplierId: string | null;
  supplier: PurchaseOrderSupplierSummary | null;

  poNumber: string;
  status: PurchaseOrderStatus;

  supplierNameSnapshot: string | null;

  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;

  externalOrderId: string | null;
  externalOrderNumber: string | null;
  externalStatus: string | null;

  notes: string | null;

  submittedAt: string | null;
  receivedAt: string | null;
  canceledAt: string | null;

  createdBy: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string | null;

  items?: PurchaseOrderItem[];
}

export interface PurchaseOrderListResponse {
  data: PurchaseOrder[];
  nextCursor: string | null;
}

export interface PurchaseOrderListParams {
  limit?: number;
  cursor?: string | null;

  q?: string;

  supplierId?: string;
  status?: PurchaseOrderStatus;

  includeItems?: boolean;
}

export interface CreatePurchaseOrderPayload {
  supplierId?: string | null;

  poNumber?: string | null;

  shippingCents?: number | null;
  taxCents?: number | null;

  externalOrderId?: string | null;
  externalOrderNumber?: string | null;
  externalStatus?: string | null;

  notes?: string | null;
}

export interface PatchPurchaseOrderPayload {
  supplierId?: string | null;

  poNumber?: string;

  shippingCents?: number | null;
  taxCents?: number | null;

  externalOrderId?: string | null;
  externalOrderNumber?: string | null;
  externalStatus?: string | null;

  notes?: string | null;
}

export interface CreatePurchaseOrderItemPayload {
  productId: string;
  productSupplierId?: string | null;

  quantityOrdered: number;
  unitCostCents: number;

  notes?: string | null;
}

export interface PatchPurchaseOrderItemPayload {
  productSupplierId?: string | null;

  quantityOrdered?: number;
  unitCostCents?: number;

  notes?: string | null;
}

export interface ReceivePurchaseOrderItemPayload {
  itemId: string;
  quantityReceived: number;
}

export interface ReceivePurchaseOrderPayload {
  locationId?: string;
  items: ReceivePurchaseOrderItemPayload[];

  notes?: string | null;
}

export interface SubmitPurchaseOrderPayload {
  externalOrderId?: string | null;
  externalOrderNumber?: string | null;
  externalStatus?: string | null;
}

export interface CancelPurchaseOrderPayload {
  reason?: string | null;
}