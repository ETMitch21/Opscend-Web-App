export interface StripeStatusResponse {
  ok: boolean;
  connected: boolean;
  provider: 'stripe';
  accountId: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  onboardingCompleteAt: string | null;
  country: string | null;
  defaultCurrency: string;
  updatedAt: string | null;
}


export interface StripeConnectResponse {
  ok: boolean;
  url: string;
}

export interface StripeDisconnectResponse {
  ok: boolean;
  disconnected: boolean;
}

export interface StripeOrderPaymentIntentRequest {
  amountCents?: number;
  customerEmail?: string;
  description?: string;
}

export interface StripeOrderPaymentIntentResponse {
  ok: true;
  orderId: string;
  paymentIntentId: string;
  clientSecret: string | null;
  status: string;
  amountCents: number;
}