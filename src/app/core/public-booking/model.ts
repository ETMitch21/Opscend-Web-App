export interface PublicBookingSettings {
  enabled: boolean;
  embedEnabled: boolean;
  sameDayEnabled: boolean;
  sameDayCutoffMin: number | null;
  sameDayBufferMins: number;
  inStockLeadDays: number;
  outOfStockLeadDays: number;
  notCarriedLeadDays: number;
  manualReviewLeadDays: number;
  defaultDurationMins: number;
  quoteDisclaimer: string | null;
  shop: {
    name: string;
    phone: string | null;
    email: string | null;
    logoUrl: string | null;
    primaryColor: string | null;
    addressLine1: string | null;
    addressLine2: string | null;
    addressCity: string | null;
    addressState: string | null;
    addressPostalCode: string | null;
    addressCountry: string | null;
  };
}

export interface PublicBookingPage<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface PublicDeviceModelOption {
  techspecsProductId: string;
  category: string;
  brand: string;
  model: string;
  releaseDate?: string;
}

export interface PublicRepairNeed {
  id: string;
  label: string;
  code: string;
  description: string | null;
  sortOrder: number;
  requiresManualReview: boolean;
  defaultDurationMins: number | null;
}

export interface PublicRepairNeedsResponse {
  data: PublicRepairNeed[];
}

export interface PublicQuoteRequest {
  category?: string;
  brand: string;
  model: string;
  techspecsProductId?: string;
  repairNeedId: string;
  serviceMode: 'in_shop' | 'on_site';
}

export interface PublicQuoteRepairNeedSummary {
  id: string;
  label: string;
  code: string;
}

export interface PublicQuoteTemplateSummary {
  id: string;
  name: string;
  allowInstantConfirmation: boolean;
}

export interface PublicQuoteMatchedProduct {
  productId: string | null;
  productSupplierId: string | null;
  supplierSku: string | null;
  supplierProductId: string | null;
  supplierName: string | null;
  supplierUrl: string | null;
}

export interface PublicRepairQuote {
  quoteId: string;
  status: string;
  confidence: 'template_confirmed' | 'supplier_estimated' | 'manual_review' | string;
  requiresManualReview: boolean;
  canSchedule: boolean;
  category: string | null;
  brand: string;
  model: string;
  techspecsProductId: string | null;

  repairNeed: PublicQuoteRepairNeedSummary;
  template: PublicQuoteTemplateSummary | null;
  matchedProduct: PublicQuoteMatchedProduct | null;

  partCostCents: number | null;
  laborCents: number | null;
  estimatedSubtotalCents: number | null;
  estimatedTotalCents: number | null;

  inStock: boolean;
  availableQty: number | null;

  serviceMode: string;
  durationMins: number;
  leadDays: number;

  message: string;
  expiresAt: string | null;
}

export interface PublicAvailabilityQuery {
  quoteId: string;
  days?: number;
  slotMinutes?: number;
}

export interface PublicAvailabilitySlot {
  startAt: string;
  endAt: string;
  candidateType: 'internal' | 'contractor' | 'unassigned' | string;
  assignedUserId: string | null;
  contractorId: string | null;
}

export interface PublicAvailabilityResponse {
  quoteId: string;
  leadDays: number;
  earliestSchedulableAt: string;
  durationMins: number;
  data: PublicAvailabilitySlot[];
}

export interface PublicScheduleRequest {
  quoteId: string;

  startAt: string;
  endAt: string;

  candidateType: 'internal' | 'contractor' | 'unassigned';
  assignedUserId?: string | null;
  contractorId?: string | null;

  customer: {
    name?: string;
    email?: string;
    phone?: string;
  };

  address?: {
    label?: string;
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
    country?: string;
    notes?: string;
  };

  notes?: string;
}

export interface PublicScheduleResponse {
  quoteId: string;
  repairId: string;
  appointmentId: string;
  publicTrackingToken: string | null;
  status: string;
  message: string;
}

export interface PublicQuoteRequestBody {
  quoteId: string;
  customer: {
    name: string;
    email: string;
    phone: string;
  };
  address?: {
    label?: string;
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  notes?: string;
}

export interface PublicQuoteRequestResponse {
  quoteId: string;
  status: string;
  message: string;
}
export type PublicQuoteApprovalStatus =
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
  | 'canceled'
  | string;

export interface PublicQuoteApprovalAddress {
  label: string | null;
  line1: string | null;
  line2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  notes: string | null;
}

export interface PublicQuoteApproval {
  quoteId: string;
  status: PublicQuoteApprovalStatus;
  confidence: string;
  requiresManualReview: boolean;

  category: string | null;
  brand: string | null;
  model: string | null;
  techspecsProductId: string | null;

  repairNeed: PublicQuoteRepairNeedSummary;
  serviceMode: 'in_shop' | 'on_site' | string;

  partCostCents: number | null;
  laborCents: number | null;
  tripFeeCents: number | null;
  estimatedSubtotalCents: number | null;
  estimatedTotalCents: number | null;

  depositRequired: boolean;
  depositAmountCents: number | null;
  depositPaidAt: string | null;

  customerMessage: string | null;

  customer: {
    name: string | null;
    email: string | null;
    phone: string | null;
  };

  request: {
    customerNotes: string | null;
    address: PublicQuoteApprovalAddress | null;
  };

  shop: PublicBookingSettings['shop'];

  quoteSentAt: string | null;
  acceptedAt: string | null;
  declinedAt: string | null;
  convertedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PublicQuoteApprovalActionResponse {
  data: PublicQuoteApproval;
}
