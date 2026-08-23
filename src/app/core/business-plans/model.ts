export type BusinessPlanPricingModel = 'per_device' | 'flat' | 'flat_plus_device';
export type BusinessPlanBillingInterval = 'month' | 'year';
export type BusinessEnrollmentBillingChangePolicy = 'next_cycle' | 'prorate' | 'approval';
export type BusinessEnrollmentPaymentSetupMethod = 'email_checkout' | 'opscend_tech';
export type BusinessEnrollmentPaymentSetupStatus = 'not_required' | 'pending' | 'email_sent' | 'ready_in_tech' | 'processing' | 'completed' | 'failed';
export type BusinessEnrollmentStatus = 'none' | 'pending' | 'active' | 'paused' | 'canceled' | 'expired';
export type BusinessEntitlementResetPolicy = 'billing_period' | 'month' | 'year' | 'never';

export interface BusinessPlanEntitlement {
  id?: string; name: string; description?: string | null; allowanceQuantity?: number | null; unitLabel: string; resetPolicy: BusinessEntitlementResetPolicy; sortOrder?: number; isActive?: boolean;
}


export interface BusinessPlan {
  id: string; shopId: string; name: string; description: string | null; isActive: boolean;
  pricingModel: BusinessPlanPricingModel;
  baseRecurringFeeCents: number; perDeviceFeeCents: number; setupFeeCents: number; currency: string;
  minimumDeviceCount: number; maximumDeviceCount: number | null;
  planLaborCents: number | null; standardLaborCents: number | null;
  partsDiscountBps: number; serviceDiscountBps: number; benefits: string[]; entitlements?: BusinessPlanEntitlement[];
  billingInterval: BusinessPlanBillingInterval; billingIntervalCount: number; defaultContractTermMonths: number | null;
  enrollmentCount?: number; activeEnrollmentCount?: number; createdAt: string; updatedAt: string;
}

export interface BusinessPlanInput {
  name: string; description?: string | null; isActive?: boolean; pricingModel: BusinessPlanPricingModel;
  baseRecurringFeeCents?: number; perDeviceFeeCents?: number; setupFeeCents?: number; currency?: string;
  minimumDeviceCount?: number; maximumDeviceCount?: number | null;
  planLaborCents?: number | null; standardLaborCents?: number | null; partsDiscountBps?: number; serviceDiscountBps?: number;
  benefits?: string[]; entitlements?: BusinessPlanEntitlement[]; billingInterval?: BusinessPlanBillingInterval; billingIntervalCount?: number; defaultContractTermMonths?: number | null;
}

export interface BusinessPlanEnrollment {
  id: string; businessAccountId: string; planId: string | null; status: BusinessEnrollmentStatus;
  planNameSnapshot: string; pricingModel: BusinessPlanPricingModel;
  baseRecurringFeeCents: number; perDeviceFeeCents: number; setupFeeCents: number; currency: string;
  minimumDeviceCount: number; maximumDeviceCount: number | null;
  planLaborCents: number | null; standardLaborCents: number | null; partsDiscountBps: number; serviceDiscountBps: number; benefits: string[];
  billingInterval: BusinessPlanBillingInterval; billingIntervalCount: number; contractTermMonths: number | null;
  startsAt: string; endsAt: string | null; billingManagedByStripe: boolean; billingChangePolicy: BusinessEnrollmentBillingChangePolicy;
  paymentSetupMethod: BusinessEnrollmentPaymentSetupMethod | null; paymentSetupStatus: BusinessEnrollmentPaymentSetupStatus;
  paymentSetupContactId: string | null; paymentSetupContactName: string | null; paymentSetupContactEmail: string | null;
  paymentSetupSentAt: string | null; paymentSetupCompletedAt: string | null;
  coveredDeviceCount: number; billableDeviceCount: number; pendingDeviceCount: number | null; monthlyEquivalentCents: number;
  stripeSubscriptionId: string | null; stripeSubscriptionStatus: string | null; stripeCheckoutUrl: string | null;
  stripeCurrentPeriodStartAt: string | null; stripeCurrentPeriodEndAt: string | null; stripeCancelAtPeriodEnd: boolean;
  stripeLatestInvoiceId: string | null; stripeLatestInvoiceStatus: string | null; stripeLatestInvoiceAmountDueCents: number | null;
  stripeLatestInvoiceHostedUrl: string | null; stripeLatestInvoicePdfUrl: string | null; stripeLastPaymentError: string | null;
  createdAt: string; updatedAt: string;
}

export interface BusinessBillingInvoice {
  id: string; number: string | null; status: string | null; currency: string; totalCents: number; amountPaidCents: number; amountDueCents: number;
  hostedInvoiceUrl: string | null; invoicePdfUrl: string | null; createdAt: string; periodStartAt: string | null; periodEndAt: string | null;
}
export interface BusinessBillingOverview {
  stripeConnected: boolean; stripeReady: boolean; currency: string; enrollment: BusinessPlanEnrollment | null; invoices: BusinessBillingInvoice[];
  paymentMethod: { brand: string; last4: string; expMonth: number; expYear: number } | null;
}
