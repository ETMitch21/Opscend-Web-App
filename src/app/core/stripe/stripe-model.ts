export interface StripeStatusResponse {
  ok: boolean;
  connected: boolean;
  provider: "stripe";
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