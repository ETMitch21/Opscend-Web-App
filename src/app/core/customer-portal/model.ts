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

export interface CustomerPortalFormAssignment {
  id: string;
  title: string;
  status: 'pending' | 'in_progress' | 'completed' | 'canceled';
  dueAt: string | null;
  completedAt: string | null;
  publicToken: string;
  templateName: string;
  templateDescription: string | null;
  repairId: string | null;
  deviceName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerPortalDevice {
  id: string;
  catalogRef: string | null;
  businessAccountId: string | null;
  displayName: string;
  nickname: string | null;
  brand: string | null;
  model: string | null;
  serial: string | null;
  imei: string | null;
  assetTag: string | null;
  assignedToName: string | null;
  assignedToEmail: string | null;
  department: string | null;
  fleetStatus: string | null;
  isPlanCovered: boolean;
  carrier: string | null;
  linePhone: string | null;
  warrantyExpiresAt: string | null;
  replacementTargetDate: string | null;
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




export interface CustomerPortalDeviceCatalogCategory {
  id: string;
  name: string;
}

export interface CustomerPortalDeviceCatalogBrand {
  id: string;
  categoryId: string;
  name: string;
}

export interface CustomerPortalDeviceCatalogModel {
  id: string;
  name: string;
  brandId: string;
  brandName: string;
  categoryId: string;
  categoryName: string;
  releaseYear?: number | null;
}

export interface CustomerPortalBusinessEntitlement {
  id: string;
  name: string;
  description: string | null;
  allowanceQuantity: number | null;
  usedQuantity: number;
  remainingQuantity: number | null;
  unitLabel: string;
  periodEndAt: string | null;
}

export interface CustomerPortalBusinessStatement {
  id: string;
  number: string | null;
  status: string;
  totalCents: number;
  amountPaidCents: number;
  balanceCents: number;
  dueAt: string | null;
  hostedInvoiceUrl: string | null;
  invoicePdfUrl: string | null;
  createdAt: string;
}

export interface CustomerPortalBusinessContact {
  id: string;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
  isBilling: boolean;
  canAuthorizeRepairs: boolean;
  receivesUpdates: boolean;
}

export interface CustomerPortalBusinessPermissions {
  canManageAccount: boolean;
  canManageBilling: boolean;
  canManageContacts: boolean;
  canManageDevices: boolean;
}

export interface CustomerPortalBusinessPlan {
  id: string;
  name: string;
  description: string | null;
  status: string;
  pricingModel: string;
  recurringChargeCents: number;
  setupFeeCents: number;
  currency: string;
  billingInterval: string;
  billingIntervalCount: number;
  coveredDeviceCount: number;
  billableDeviceCount: number;
  pendingDeviceCount: number | null;
  minimumDeviceCount: number;
  maximumDeviceCount: number | null;
  billingManagedByStripe: boolean;
  stripeBillingPortalAvailable: boolean;
  stripeSubscriptionStatus: string | null;
  stripeCurrentPeriodEndAt: string | null;
  stripeCancelAtPeriodEnd: boolean;
  benefits: string[];
  entitlements: CustomerPortalBusinessEntitlement[];
}

export interface CustomerPortalBusinessAgreement {
  signed: boolean;
  signedAt: string | null;
  signerName: string | null;
  signerTitle: string | null;
  signerEmail: string | null;
  title: string | null;
  templateName: string | null;
  templateVersion: number | null;
  documentPath: string;
}

export interface CustomerPortalBusiness {
  id: string;
  fleetManagementEnabled: boolean;
  name: string;
  legalName: string | null;
  billingEmail: string | null;
  billingPhone: string | null;
  billingMode: 'per_repair' | 'consolidated';
  billingTerms: string;
  purchaseOrderRequired: boolean;
  authorizationThresholdCents: number | null;
  purchaseOrderThresholdCents: number | null;
  contractStartsAt: string | null;
  contractEndsAt: string | null;
  contractAutoRenew: boolean;
  accountManager: { id: string; name: string; email: string | null; phone?: string | null } | null;
  viewerContact: CustomerPortalBusinessContact | null;
  permissions: CustomerPortalBusinessPermissions | null;
  contacts: CustomerPortalBusinessContact[];
  locations: Array<{ id: string; name: string; code: string | null; city: string | null; state: string | null; isDefault: boolean }>;
  plan: CustomerPortalBusinessPlan | null;
  agreement: CustomerPortalBusinessAgreement | null;
  statements: CustomerPortalBusinessStatement[];
}

export interface CustomerPortalSummary {
  activeRepairs: number;
  upcomingAppointments: number;
  quotesNeedingAttention: number;
  balanceDueCents: number;
  unreadMessages: number;
  savedDevices: number;
  pendingForms: number;
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
  forms: CustomerPortalFormAssignment[];
  business: CustomerPortalBusiness | null;
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
