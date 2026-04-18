import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { loadStripe } from '@stripe/stripe-js';
import type {
  Stripe,
  StripeCardElement,
  StripeCardElementOptions,
  StripeElements,
} from '@stripe/stripe-js';

import {
  StripeConnectResponse,
  StripeDisconnectResponse,
  StripeStatusResponse,
} from './stripe-model';
import { AppConfigService } from '../app-config/app-config.service';

@Injectable({
  providedIn: 'root',
})
export class StripeService {
  private readonly appConfig = inject(AppConfigService);
  private readonly http = inject(HttpClient);
  private readonly stripePromises = new Map<string, Promise<Stripe | null>>();

  private get apiBase(): string {
    return this.appConfig.config.apiBase;
  }

  private get stripePublishableKey(): string {
    return this.appConfig.config.stripePublishableKey;
  }

  private get baseUrl(): string {
    return `${this.apiBase}/integrations/stripe`;
  }

  getStatus(): Observable<StripeStatusResponse> {
    return this.http.get<StripeStatusResponse>(`${this.baseUrl}/status`);
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.http
        .post<StripeConnectResponse>(`${this.baseUrl}/connect/onboard`, {})
        .subscribe({
          next: (res) => {
            if (res?.url) {
              window.location.href = res.url;
              resolve();
              return;
            }

            reject(new Error('Missing Stripe onboarding URL.'));
          },
          error: reject,
        });
    });
  }

  openDashboard(): void {
    this.http
      .post<StripeConnectResponse>(`${this.baseUrl}/connect/dashboard-link`, {})
      .subscribe({
        next: (res) => {
          if (res?.url) {
            window.location.href = res.url;
          }
        },
        error: () => {
          throw new Error('Unable to open Stripe dashboard.');
        },
      });
  }

  disconnect(): Observable<StripeDisconnectResponse> {
    return this.http.delete<StripeDisconnectResponse>(this.baseUrl);
  }

  async getStripe(stripeAccountId: string): Promise<Stripe | null> {
    if (!stripeAccountId) {
      throw new Error('Missing Stripe connected account id.');
    }

    if (!this.stripePromises.has(stripeAccountId)) {
      this.stripePromises.set(
        stripeAccountId,
        loadStripe(this.stripePublishableKey, {
          stripeAccount: stripeAccountId,
        })
      );
    }

    return this.stripePromises.get(stripeAccountId)!;
  }

  async createCardElement(opts: {
    stripeAccountId: string;
  }): Promise<{
    stripe: Stripe;
    elements: StripeElements;
    card: StripeCardElement;
  }> {
    const stripe = await this.getStripe(opts.stripeAccountId);

    if (!stripe) {
      throw new Error('Stripe.js failed to load.');
    }

    const elements = stripe.elements();

    const card = elements.create('card', {
      hidePostalCode: true,
    } satisfies StripeCardElementOptions);

    return { stripe, elements, card };
  }

  async confirmCardPayment(opts: {
    stripeAccountId: string;
    clientSecret: string;
    card: StripeCardElement;
  }) {
    const stripe = await this.getStripe(opts.stripeAccountId);

    if (!stripe) {
      throw new Error('Stripe.js failed to load.');
    }

    return stripe.confirmCardPayment(opts.clientSecret, {
      payment_method: {
        card: opts.card,
      },
    });
  }
}