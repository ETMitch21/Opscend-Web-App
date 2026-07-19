export interface RepairType {
  id: string;
  shopId: string;
  label: string;
  code: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  supplierSearchTerms: string[];
  defaultLaborCents: number | null;
  defaultDurationMins: number | null;
  requiresManualReview: boolean;
  pricingOptionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface RepairTypeInput {
  label: string;
  code: string;
  description?: string | null;
  isActive?: boolean;
  sortOrder?: number;
  supplierSearchTerms?: string[];
  defaultLaborCents?: number | null;
  defaultDurationMins?: number | null;
  requiresManualReview?: boolean;
}

export interface PricingOptionRepairTypeSummary {
  id: string;
  label: string;
  code: string;
}

export interface PricingOptionModelSummary {
  id: string;
  name: string;
  releaseYear: number | null;
  categoryId: string;
  categoryName: string;
  brandId: string;
  brandName: string;
}

export interface PricingOptionServiceSummary {
  id: string;
  name: string;
  priceCents: number;
  durationMins: number | null;
}

export interface PricingOptionProductSummary {
  id: string;
  name: string;
  sku: string | null;
  priceCents: number;
  costCents: number | null;
}

export interface PricingOptionProductSupplierSummary {
  id: string;
  supplierSku: string;
  supplierName: string | null;
  lastKnownCostCents: number | null;
  lastKnownInStock: boolean | null;
}

export type PricingOptionDepositMode = 'none' | 'product_cost' | 'custom';

export interface PricingOption {
  id: string;
  shopId: string;
  repairNeedId: string;
  deviceCatalogModelId: string | null;
  variantName: string;
  name: string;
  description: string | null;
  isActive: boolean;
  isPublic: boolean;
  sortOrder: number;
  fixedPriceCents: number | null;
  useDynamicPricing: boolean;
  depositMode: PricingOptionDepositMode;
  depositAmountCents: number | null;
  laborCents: number | null;
  durationMins: number | null;
  allowInstantConfirmation: boolean;
  requiresManualReview: boolean;
  serviceId: string | null;
  productId: string | null;
  productSupplierId: string | null;
  repairType: PricingOptionRepairTypeSummary;
  model: PricingOptionModelSummary | null;
  service: PricingOptionServiceSummary | null;
  product: PricingOptionProductSummary | null;
  productSupplier: PricingOptionProductSupplierSummary | null;
  createdAt: string;
  updatedAt: string;
}

export interface PricingOptionInput {
  deviceCatalogModelId: string;
  repairNeedId: string;
  variantName: string;
  description?: string | null;
  isActive?: boolean;
  isPublic?: boolean;
  sortOrder?: number;
  serviceId?: string | null;
  productId?: string | null;
  productSupplierId?: string | null;
  fixedPriceCents?: number | null;
  useDynamicPricing?: boolean;
  depositMode?: PricingOptionDepositMode;
  depositAmountCents?: number | null;
  laborCents?: number | null;
  durationMins?: number | null;
  allowInstantConfirmation?: boolean;
  requiresManualReview?: boolean;
}

export interface PricingOptionListParams {
  modelId?: string;
  repairTypeId?: string;
  includeInactive?: boolean;
  includePrivate?: boolean;
  search?: string;
}

export interface PricingOptionBulkAssignInput
  extends Omit<PricingOptionInput, 'deviceCatalogModelId'> {
  modelIds: string[];
  overwriteExisting?: boolean;
}

export type PricingOptionBulkAction =
  | 'activate'
  | 'publish'
  | 'make_private'
  | 'deactivate'
  | 'set_price'
  | 'increase_fixed'
  | 'decrease_fixed'
  | 'increase_percent'
  | 'decrease_percent'
  | 'set_service'
  | 'set_product'
  | 'set_product_supplier'
  | 'clear_links';

export interface PricingOptionBulkActionInput {
  ids: string[];
  action: PricingOptionBulkAction;
  amount?: number;
  serviceId?: string | null;
  productId?: string | null;
  productSupplierId?: string | null;
}

export interface ListResponse<T> {
  data: T[];
}

export interface ReorderResponse {
  updatedCount: number;
}

export interface BulkAssignResponse {
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
}

export interface BulkActionResponse {
  updatedCount: number;
}
