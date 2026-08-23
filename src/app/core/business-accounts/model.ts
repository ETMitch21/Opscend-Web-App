export type BusinessAccountStatus = 'active' | 'paused' | 'closed';
export type BusinessBillingTerms = 'due_on_receipt' | 'net_15' | 'net_30' | 'net_45' | 'net_60';
export type BusinessPlanStatus = 'none' | 'pending' | 'active' | 'paused' | 'canceled' | 'expired';
export type BusinessDeviceStatus = 'active' | 'spare' | 'retired' | 'lost';

export interface BusinessAccountStats {
  contacts: number;
  devices: number;
  activeDevices: number;
  repairs: number;
  openRepairs: number;
  openQuotes: number;
  lifetimeValueCents: number;
  outstandingBalanceCents: number;
}

export interface BusinessAccountContact {
  id: string;
  businessAccountId: string;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
  isBilling: boolean;
  canAuthorizeRepairs: boolean;
  receivesUpdates: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessAccountDevice {
  id: string;
  shopId: string;
  customerId: string;
  businessAccountId: string | null;
  catalogRef: string | null;
  displayName: string;
  brand: string | null;
  model: string | null;
  nickname: string | null;
  notes: string | null;
  imei: string | null;
  serial: string | null;
  assetTag: string | null;
  assignedToName: string | null;
  assignedToEmail: string | null;
  department: string | null;
  fleetStatus: BusinessDeviceStatus;
  isPlanCovered: boolean;
  businessLocationId: string | null; purchaseDate: string | null; warrantyExpiresAt: string | null; carrier: string | null; linePhone: string | null; replacementTargetDate: string | null; retiredAt: string | null; retirementReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessAccountSummary {
  id: string;
  shopId: string;
  customerId: string;
  name: string;
  legalName: string | null;
  status: BusinessAccountStatus;
  billingEmail: string | null;
  billingPhone: string | null;
  billingTerms: BusinessBillingTerms;
  purchaseOrderRequired: boolean;
  creditLimitCents: number | null;
  taxExempt: boolean;
  taxExemptId: string | null;
  planName: string | null;
  planStatus: BusinessPlanStatus;
  planMonthlyFeeCents: number | null;
  planLaborCents: number | null;
  standardLaborCents: number | null;
  partsDiscountBps: number;
  serviceDiscountBps: number;
  coveredDeviceLimit: number | null;
  planStartsAt: string | null;
  planEndsAt: string | null;
  notes: string | null;
  tags: string[];
  primaryContact: BusinessAccountContact | null;
  stats: BusinessAccountStats;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessRecentRepair {
  id: string;
  status: string;
  problemSummary: string;
  customerDeviceId: string;
  deviceLabel: string;
  assetTag: string | null;
  orderId: string | null;
  orderNumber: string | null;
  totalCents: number | null;
  balanceCents: number | null;
  appointmentStartAt: string | null;
  createdAt: string;
}

export interface BusinessRecentOrder {
  id: string;
  orderNumber: string;
  fulfillmentStatus: string;
  paymentStatus: string;
  totalCents: number;
  paidCents: number;
  balanceCents: number;
  repairId: string | null;
  createdAt: string;
}

export interface BusinessRecentQuote {
  id: string;
  status: string;
  model: string | null;
  repairNeedLabel: string | null;
  estimatedTotalCents: number | null;
  createdAt: string;
}

export interface BusinessAccountDetail extends BusinessAccountSummary {
  contacts: BusinessAccountContact[];
  devices: BusinessAccountDevice[];
  recentRepairs: BusinessRecentRepair[];
  recentOrders: BusinessRecentOrder[];
  recentQuotes: BusinessRecentQuote[];
}

export interface BusinessAccountListResponse {
  data: BusinessAccountSummary[];
  nextCursor: string | null;
}

export interface BusinessPrimaryContactInput {
  name: string;
  title?: string | null;
  email?: string | null;
  phone?: string | null;
}

export interface BusinessAccountCreateInput {
  customerId?: string | null;
  name: string;
  legalName?: string | null;
  billingEmail?: string | null;
  billingPhone?: string | null;
  billingTerms?: BusinessBillingTerms;
  purchaseOrderRequired?: boolean;
  creditLimitCents?: number | null;
  taxExempt?: boolean;
  taxExemptId?: string | null;
  planName?: string | null;
  planStatus?: BusinessPlanStatus;
  planMonthlyFeeCents?: number | null;
  planLaborCents?: number | null;
  standardLaborCents?: number | null;
  partsDiscountBps?: number;
  serviceDiscountBps?: number;
  coveredDeviceLimit?: number | null;
  planStartsAt?: string | null;
  planEndsAt?: string | null;
  notes?: string | null;
  tags?: string[];
  primaryContact?: BusinessPrimaryContactInput | null;
}

export type BusinessAccountPatchInput = Partial<Omit<BusinessAccountCreateInput, 'customerId' | 'primaryContact'>> & {
  status?: BusinessAccountStatus;
};

export interface BusinessContactCreateInput {
  name: string;
  title?: string | null;
  email?: string | null;
  phone?: string | null;
  isPrimary?: boolean;
  isBilling?: boolean;
  canAuthorizeRepairs?: boolean;
  receivesUpdates?: boolean;
  notes?: string | null;
}
export type BusinessContactPatchInput = Partial<BusinessContactCreateInput>;

export interface BusinessDeviceCreateInput {
  catalogRef: string;
  /** Device identity is derived by the API from catalogRef. */
  displayName?: string;
  brand?: string | null;
  model?: string | null;
  nickname?: string | null;
  notes?: string | null;
  imei?: string | null;
  serial?: string | null;
  assetTag?: string | null;
  assignedToName?: string | null;
  assignedToEmail?: string | null;
  department?: string | null;
  fleetStatus?: BusinessDeviceStatus;
  isPlanCovered?: boolean;
  businessLocationId?: string | null; purchaseDate?: string | null; warrantyExpiresAt?: string | null; carrier?: string | null; linePhone?: string | null; replacementTargetDate?: string | null; retiredAt?: string | null; retirementReason?: string | null;
}
export type BusinessDevicePatchInput = Partial<BusinessDeviceCreateInput>;

export type BusinessBillingMode = 'per_repair' | 'consolidated';

export interface BusinessLocation {
  id: string; businessAccountId: string; name: string; code: string | null;
  addressLine1: string | null; addressLine2: string | null; city: string | null; state: string | null; postalCode: string | null; country: string | null;
  isDefault: boolean; isBilling: boolean; isActive: boolean; notes: string | null; createdAt: string; updatedAt: string;
}

export interface BusinessEnrollmentEntitlement {
  id: string; nameSnapshot: string; descriptionSnapshot: string | null; allowanceQuantity: number | null; unitLabel: string;
  resetPolicy: 'billing_period' | 'month' | 'year' | 'never'; usedQuantity: number; periodStartAt: string | null; periodEndAt: string | null;
}

export interface BusinessStatementLine {
  id: string; orderId: string | null; description: string; sourceType: string; sourceId: string | null; quantity: number; unitAmountCents: number; lineTotalCents: number;
  order?: { orderNumber: string } | null;
}
export interface BusinessStatement {
  id: string; number: string | null; status: 'draft' | 'finalized' | 'open' | 'paid' | 'overdue' | 'void'; currency: string;
  periodStartAt: string; periodEndAt: string; dueAt: string | null; subtotalCents: number; creditAppliedCents: number; totalCents: number; amountPaidCents: number; balanceCents: number;
  stripeHostedInvoiceUrl: string | null; stripeInvoicePdfUrl: string | null; createdAt: string; lines: BusinessStatementLine[];
}
export interface BusinessCreditTransaction { id: string; type: 'credit' | 'debit'; amountCents: number; note: string | null; reference: string | null; createdAt: string; }
export interface BusinessAccountManager { id: string; name: string; email: string | null; }
export interface BusinessOperationsSettings {
  billingMode: BusinessBillingMode; statementBillingDay: number; authorizationThresholdCents: number | null; purchaseOrderThresholdCents: number | null;
  requireAuthorizedContact: boolean; portalEnabled: boolean; accountManagerUserId: string | null; accountManager: BusinessAccountManager | null;
  contractSignedAt: string | null; contractStartsAt: string | null; contractEndsAt: string | null; contractAutoRenew: boolean; cancellationNoticeDays: number | null; contractDocumentUrl: string | null;
  slaResponseMinutes: number | null; slaTurnaroundHours: number | null; priorityLevel: number; preferredPartQuality: string | null; dataWipeRequiresApproval: boolean;
  maxRepairSpendCents: number | null; replaceInsteadThresholdPercent: number | null;
}
export interface BusinessOperationsOverview {
  settings: BusinessOperationsSettings; locations: BusinessLocation[]; entitlements: BusinessEnrollmentEntitlement[]; statements: BusinessStatement[];
  credits: BusinessCreditTransaction[]; creditBalanceCents: number; managers: BusinessAccountManager[]; assignments: any[];
  reporting: { repairRevenueCents: number; outstandingBalanceCents: number; repairs: number; devices: number; coveredDevices: number; averageTurnaroundHours: number | null; averageRepairValueCents: number; spendByDepartment: Array<{ department: string; totalCents: number }>; monthlyRecurringRevenueCents: number; partsCostCents: number; marginBeforeLaborCents: number; mostRepairedDevices: Array<{ deviceId: string; displayName: string; repairCount: number; totalCents: number }>; frequentModels: Array<{ model: string; repairCount: number; totalCents: number }>; };
  healthScore: number;
  health: Array<{ severity: 'warning' | 'critical' | 'info'; code: string; message: string }>;
}

export interface BusinessOperationsPatchInput extends Partial<Omit<BusinessOperationsSettings, 'accountManager'>> {}
