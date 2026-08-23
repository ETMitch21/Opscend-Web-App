export type BusinessEnrollmentStage = 'draft' | 'sent' | 'agreement_signed' | 'company_setup' | 'billing_setup' | 'active' | 'canceled';

export interface BusinessEnrollmentAgreementSnapshot {
  version: number;
  enrollmentId: string;
  businessAccountId: string;
  businessName: string;
  legalName: string | null;
  shopName: string;
  shopSlug: string;
  planName: string;
  planDescription: string | null;
  billingTerms: string;
  pricingModel: string;
  setupFeeCents: number;
  recurringFeeCents: number;
  baseRecurringFeeCents: number;
  perDeviceFeeCents: number;
  currency: string;
  minimumDeviceCount: number;
  maximumDeviceCount: number | null;
  coveredDeviceCount: number;
  billableDeviceCount: number;
  contractTermMonths: number | null;
  startsAt: string;
  endsAt: string | null;
  billingManagedByStripe: boolean;
  benefits: string[];
  partsDiscountBps: number;
  serviceDiscountBps: number;
  planLaborCents: number | null;
  standardLaborCents: number | null;
  agreementTemplateId: string;
  agreementTemplateVersion: number;
  agreementTemplateName: string;
  agreementTitle: string;
  agreementIntroduction: string;
  agreementSections: Array<{ id: string; title: string; body: string }>;
  signatureStatement: string;
}



export interface PublicBusinessEnrollmentDeviceInput {
  catalogRef: string;
  displayName?: string;
  category?: string | null;
  brand?: string | null;
  model?: string | null;
  assignedToName?: string | null;
  assignedToEmail?: string | null;
  department?: string | null;
  assetTag?: string | null;
  serial?: string | null;
  imei?: string | null;
}

export interface PublicBusinessEnrollmentCatalogCategory {
  id: string;
  name: string;
}

export interface PublicBusinessEnrollmentCatalogBrand {
  id: string;
  categoryId: string;
  name: string;
}

export interface PublicBusinessEnrollmentCatalogModel {
  id: string;
  name: string;
  brandId: string;
  brandName: string;
  categoryId: string;
  categoryName: string;
  releaseYear?: number | null;
}

export interface PublicBusinessEnrollment {
  account: {
    id: string;
    name: string;
    legalName: string | null;
    billingTerms: string;
    billingTermsLabel: string;
    billingEmail: string | null;
    billingPhone: string | null;
    portalEnabled: boolean;
  };
  shop: { name: string; slug: string; primaryColor: string | null };
  enrollment: {
    id: string;
    status: string;
    planName: string;
    setupFeeCents: number;
    recurringFeeCents: number;
    currency: string;
    minimumDeviceCount: number;
    maximumDeviceCount: number | null;
    coveredDeviceCount: number;
    billableDeviceCount: number;
    contractTermMonths: number | null;
    startsAt: string;
    endsAt: string | null;
    billingManagedByStripe: boolean;
    paymentSetupMethod: 'email_checkout' | 'opscend_tech' | null;
    paymentSetupStatus: string;
    stripeCheckoutUrl: string | null;
    benefits: string[];
    partsDiscountBps: number;
    serviceDiscountBps: number;
    planLaborCents: number | null;
    standardLaborCents: number | null;
  };
  state: {
    stage: BusinessEnrollmentStage;
    agreementSigned: boolean;
    contactConfirmed: boolean;
    fleetConfirmed: boolean;
    signedAt: string | null;
    signer: { name: string; title: string; email: string; signature: string } | null;
    confirmedContact: Record<string, unknown> | null;
    confirmedFleet: Record<string, unknown> | null;
  };
  agreement: BusinessEnrollmentAgreementSnapshot;
  links: { agreementDocument: string; portal: string };
  portalUrl?: string;
}

export interface BusinessEnrollmentAdminEvent {
  action: string;
  createdAt: string;
  metadata: Record<string, unknown> | null;
}

export interface BusinessEnrollmentAdminState {
  enrollmentId: string | null;
  url: string | null;
  stage: BusinessEnrollmentStage;
  agreementSigned: boolean;
  contactConfirmed: boolean;
  fleetConfirmed: boolean;
  signedAt: string | null;
  signer: { name: string | null; title: string | null; email: string | null } | null;
  sentAt: string | null;
  activatedAt: string | null;
  history: BusinessEnrollmentAdminEvent[];
}
