export interface CustomerPortalShop {
  slug: string;
  name: string;
  logoUrl: string | null;
  primaryColor: string | null;
  phone: string | null;
  email: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressPostalCode: string | null;
  addressCountry: string | null;
  stripePaymentsEnabled?: boolean;
}

export interface CustomerPortalCustomer {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
}

export interface CustomerPortalConfigResponse {
  shop: CustomerPortalShop;
}

export interface CustomerPortalAccount {
  id: string;
  shopId: string;
  customerId: string;
  email: string;
}

export interface CustomerPortalSessionResponse {
  sessionToken?: string;
  expiresAt: string;
  account: CustomerPortalAccount;
  customer: CustomerPortalCustomer;
  shop: CustomerPortalShop;
}

export interface CustomerPortalDeviceSummary {
  id: string;
  displayName: string;
  nickname: string | null;
  brand: string | null;
  model: string | null;
}

export interface CustomerPortalAppointment {
  id: string;
  startAt: string;
  endAt: string;
  status: string;
}

export interface CustomerPortalTimelineItem {
  id: string;
  status: string;
  label: string;
  message: string | null;
  createdAt: string;
}

export interface CustomerPortalOrderItem {
  id: string;
  type: string;
  name: string;
  sku: string | null;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  notes: string | null;
}

export interface CustomerPortalOrderPayment {
  id: string;
  type: string;
  method: string;
  reference: string | null;
  amountCents: number;
  note: string | null;
  createdAt: string;
}

export interface CustomerPortalOrder {
  id: string;
  orderNumber: string;
  source: string;
  fulfillmentStatus: string;
  paymentStatus: string;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  paidCents: number;
  refundedCents: number;
  balanceCents: number;
  canPayOnline: boolean;
  repairId: string | null;
  createdAt: string;
  updatedAt: string;
  items: CustomerPortalOrderItem[];
  payments: CustomerPortalOrderPayment[];
}

export interface CustomerPortalQuoteLineItem {
  id: string;
  type: string;
  name: string;
  description: string | null;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  sortOrder: number;
}

export interface CustomerPortalQuote {
  id: string;
  status: string;
  statusLabel: string;
  category: string | null;
  brand: string | null;
  model: string | null;
  serviceMode: string;
  estimatedSubtotalCents: number | null;
  estimatedTotalCents: number | null;
  depositRequired: boolean;
  depositAmountCents: number | null;
  depositPaidAt: string | null;
  depositPaidAmountCents: number | null;
  publicApprovalToken: string | null;
  quoteSentAt: string | null;
  acceptedAt: string | null;
  declinedAt: string | null;
  convertedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  repairId: string | null;
  repairNeed: {
    id: string;
    label: string;
    code: string;
  } | null;
  lineItems: CustomerPortalQuoteLineItem[];
}

export interface CustomerPortalRepair {
  id: string;
  status: string;
  statusLabel: string;
  problemSummary: string;
  serviceMode: string;
  createdAt: string;
  updatedAt: string;
  device: CustomerPortalDeviceSummary | null;
  appointment: CustomerPortalAppointment | null;
  order: CustomerPortalOrder | null;
  quote: CustomerPortalQuote | null;
  timeline: CustomerPortalTimelineItem[];
  unreadMessageCount: number;
}

export interface CustomerPortalDevice {
  id: string;
  displayName: string;
  nickname: string | null;
  brand: string | null;
  model: string | null;
  serial: string | null;
  createdAt: string;
  updatedAt: string;
  repairCount: number;
  latestRepair: {
    id: string;
    status: string;
    statusLabel: string;
    problemSummary: string;
    updatedAt: string;
  } | null;
}

export interface CustomerPortalSummary {
  activeRepairs: number;
  upcomingAppointments: number;
  quotesNeedingAttention: number;
  balanceDueCents: number;
  unreadMessages: number;
  savedDevices: number;
}

export interface CustomerPortalDashboard {
  shop: CustomerPortalShop;
  customer: CustomerPortalCustomer;
  summary: CustomerPortalSummary;
  activeRepairs: CustomerPortalRepair[];
  repairHistory: CustomerPortalRepair[];
  quotes: CustomerPortalQuote[];
  orders: CustomerPortalOrder[];
  devices: CustomerPortalDevice[];
  generatedAt: string;
}

export interface CustomerPortalDashboardResponse {
  data: CustomerPortalDashboard;
}

export interface CustomerPortalRepairResponse {
  data: CustomerPortalRepair;
}

export interface CustomerPortalMessage {
  id: string;
  repairId: string;
  role: string;
  visibility: string;
  message: string;
  readByCustomerAt: string | null;
  createdAt: string;
}

export interface CustomerPortalMessagesResponse {
  messages: CustomerPortalMessage[];
}

export interface CustomerPortalPaymentIntentResponse {
  ok: true;
  orderId: string;
  paymentIntentId: string;
  clientSecret: string;
  stripeAccountId: string;
  amountCents: number;
  currency: string;
}

export interface CustomerPortalPaymentRecordResponse {
  ok: true;
  orderId: string;
  paymentStatus: string;
  paidCents: number;
  refundedCents: number;
  balanceCents: number;
}
