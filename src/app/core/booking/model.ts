export type PricingRoundingMode =
  | 'none'
  | 'nearest_dollar'
  | 'nearest_nine';

export interface BookingSettings {
  shopId: string;
  shopSlug: string | null;
  
  enabled: boolean;
  embedEnabled: boolean;

  publicCatalogCategories: string[];

  defaultMarkupMultiplier: number | string;
  defaultLaborCents: number;
  roundingMode: PricingRoundingMode;

  minimumRetailCents: number | null;
  maximumRetailCents: number | null;

  sameDayEnabled: boolean;
  sameDayCutoffMin: number | null;
  sameDayBufferMins: number;

  inStockLeadDays: number;
  outOfStockLeadDays: number;
  notCarriedLeadDays: number;
  manualReviewLeadDays: number;

  defaultDurationMins: number;

  quoteExpirationHours: number;
  quoteDisclaimer: string | null;

  allowedEmbedOrigins: string[];

  createdAt: string;
  updatedAt: string;
}

export interface BookingSettingsPatch {
  enabled?: boolean;
  embedEnabled?: boolean;

  defaultMarkupMultiplier?: number;
  defaultLaborCents?: number;
  roundingMode?: PricingRoundingMode;

  minimumRetailCents?: number | null;
  maximumRetailCents?: number | null;

  publicCatalogCategories: string[];

  sameDayEnabled?: boolean;
  sameDayCutoffMin?: number | null;
  sameDayBufferMins?: number;

  inStockLeadDays?: number;
  outOfStockLeadDays?: number;
  notCarriedLeadDays?: number;
  manualReviewLeadDays?: number;

  defaultDurationMins?: number;

  quoteExpirationHours?: number;
  quoteDisclaimer?: string | null;

  allowedEmbedOrigins?: string[];
}

export interface ShopRepairNeed {
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

  createdAt: string;
  updatedAt: string;
}

export interface ShopRepairNeedCreate {
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

export type ShopRepairNeedPatch = Partial<ShopRepairNeedCreate>;

export interface RepairPricingTemplateRepairNeedSummary {
  id: string;
  label: string;
  code: string;
}

export interface RepairPricingTemplateServiceSummary {
  id: string;
  name: string;
  priceCents: number;
  durationMins: number | null;
}

export interface RepairPricingTemplateProductSummary {
  id: string;
  name: string;
  sku: string | null;
  priceCents: number;
  costCents: number | null;
}

export interface RepairPricingTemplateProductSupplierSummary {
  id: string;
  supplierSku: string;
  supplierName: string | null;
  lastKnownCostCents: number | null;
  lastKnownInStock: boolean | null;
}

export interface RepairPricingTemplate {
  id: string;
  shopId: string;

  repairNeedId: string;

  name: string;
  isActive: boolean;
  sortOrder: number;

  category: string | null;
  brand: string | null;
  model: string | null;
  techspecsProductId: string | null;

  serviceId: string | null;
  productId: string | null;
  productSupplierId: string | null;

  fixedPriceCents: number | null;
  useDynamicPricing: boolean;

  laborCents: number | null;
  durationMins: number | null;

  allowInstantConfirmation: boolean;
  requiresManualReview: boolean;

  createdAt: string;
  updatedAt: string;

  repairNeed: RepairPricingTemplateRepairNeedSummary | null;
  service: RepairPricingTemplateServiceSummary | null;
  product: RepairPricingTemplateProductSummary | null;
  productSupplier: RepairPricingTemplateProductSupplierSummary | null;
}

export interface RepairPricingTemplateCreate {
  repairNeedId: string;

  name: string;
  isActive?: boolean;
  sortOrder?: number;

  category?: string | null;
  brand?: string | null;
  model?: string | null;
  techspecsProductId?: string | null;

  serviceId?: string | null;
  productId?: string | null;
  productSupplierId?: string | null;

  fixedPriceCents?: number | null;
  useDynamicPricing?: boolean;

  laborCents?: number | null;
  durationMins?: number | null;

  allowInstantConfirmation?: boolean;
  requiresManualReview?: boolean;
}

export type RepairPricingTemplatePatch = Partial<RepairPricingTemplateCreate>;

export interface ListResponse<T> {
  data: T[];
}

export type BookingQuoteRequestStatus = 'new' | 'contacted' | 'canceled';

export type BookingQuoteWorkflowStatus =
  | 'draft'
  | 'quote_requested'
  | 'quoted'
  | 'sent'
  | 'accepted'
  | 'declined'
  | 'deposit_pending'
  | 'deposit_paid'
  | 'scheduled'
  | 'converted'
  | 'expired'
  | 'canceled';

export interface BookingQuoteRequest {
  id: string;
  shopId: string;
  repairId: string | null;
  conversationId: string | null;

  requestStatus: BookingQuoteRequestStatus;
  quoteStatus: BookingQuoteWorkflowStatus;

  category: string | null;
  brand: string | null;
  model: string | null;
  techspecsProductId: string | null;

  serviceMode: 'in_shop' | 'on_site' | null;

  confidence: string;
  requiresManualReview: boolean;

  partCostCents: number | null;
  laborCents: number | null;
  tripFeeCents: number | null;
  estimatedSubtotalCents: number | null;
  estimatedTotalCents: number | null;

  depositRequired: boolean;
  depositAmountCents: number | null;
  depositPaidAt: string | null;
  depositPaidAmountCents?: number | null;
  depositPaidCurrency?: string | null;

  publicApprovalToken: string | null;

  quoteSentAt: string | null;
  acceptedAt: string | null;
  declinedAt: string | null;
  convertedAt: string | null;

  customerMessage: string | null;

  inStock: boolean | null;
  availableQty: number | null;

  durationMins: number | null;
  leadDays: number | null;

  customer: {
    name: string | null;
    email: string | null;
    phone: string | null;
  };

  address: {
    label: string | null;
    line1: string | null;
    line2: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    country: string | null;
    notes: string | null;
  } | null;

  customerNotes: string | null;
  internalNotes: string | null;

  requestedAt: string | null;
  contactedAt: string | null;
  canceledAt: string | null;

  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;

  repairNeed: {
    id: string;
    label: string;
    code: string;
  } | null;

  template: {
    id: string;
    name: string;
  } | null;
}

export interface BookingQuoteRequestsResponse {
  data: BookingQuoteRequest[];
  nextCursor: string | null;
}

export interface BookingQuoteRequestsListParams {
  limit?: number;
  cursor?: string | null;
}

export interface BookingQuoteRequestPatch {
  requestStatus?: BookingQuoteRequestStatus;
  quoteStatus?: BookingQuoteWorkflowStatus;

  partCostCents?: number | null;
  laborCents?: number | null;
  tripFeeCents?: number | null;
  estimatedSubtotalCents?: number | null;
  estimatedTotalCents?: number | null;

  depositRequired?: boolean;
  depositAmountCents?: number | null;

  customerMessage?: string | null;
  internalNotes?: string | null;
}

export interface BookingQuoteRequestActionResponse {
  data: BookingQuoteRequest;
}
