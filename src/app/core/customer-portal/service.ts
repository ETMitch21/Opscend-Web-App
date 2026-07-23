import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { AppConfigService } from '../app-config/app-config.service';
import {
  CustomerPortalConfigResponse,
  CustomerPortalDashboardResponse,
  CustomerPortalMessage,
  CustomerPortalMessagesResponse,
  CustomerPortalPaymentIntentResponse,
  CustomerPortalPaymentRecordResponse,
  CustomerPortalRepairResponse,
  CustomerPortalSessionResponse,
} from './model';

@Injectable({ providedIn: 'root' })
export class CustomerPortalService {
  private readonly appConfig = inject(AppConfigService);
  private readonly http = inject(HttpClient);

  private get apiBase(): string {
    return this.appConfig.config.apiBase;
  }

  private baseUrl(shopSlug: string): string {
    return `${this.apiBase}/public/portal/${encodeURIComponent(shopSlug)}`;
  }

  private storageKey(shopSlug: string): string {
    return `opscend_customer_portal_session:${shopSlug.trim().toLowerCase()}`;
  }

  getSessionToken(shopSlug: string): string | null {
    return localStorage.getItem(this.storageKey(shopSlug));
  }

  saveSessionToken(shopSlug: string, token: string): void {
    localStorage.setItem(this.storageKey(shopSlug), token);
  }

  clearSessionToken(shopSlug: string): void {
    localStorage.removeItem(this.storageKey(shopSlug));
  }

  private portalHeaders(shopSlug: string): HttpHeaders {
    const token = this.getSessionToken(shopSlug);

    return token
      ? new HttpHeaders({ Authorization: `Portal ${token}` })
      : new HttpHeaders();
  }

  getConfig(shopSlug: string): Observable<CustomerPortalConfigResponse> {
    return this.http.get<CustomerPortalConfigResponse>(
      `${this.baseUrl(shopSlug)}/config`,
    );
  }

  requestLink(shopSlug: string, email: string): Observable<{ ok: true }> {
    return this.http.post<{ ok: true }>(
      `${this.baseUrl(shopSlug)}/auth/request-link`,
      { email },
    );
  }

  verifyLink(
    shopSlug: string,
    token: string,
  ): Observable<CustomerPortalSessionResponse> {
    return this.http.post<CustomerPortalSessionResponse>(
      `${this.baseUrl(shopSlug)}/auth/verify`,
      { token },
    );
  }

  validateSession(shopSlug: string): Observable<CustomerPortalSessionResponse> {
    return this.http.get<CustomerPortalSessionResponse>(
      `${this.baseUrl(shopSlug)}/session`,
      { headers: this.portalHeaders(shopSlug) },
    );
  }

  logout(shopSlug: string): Observable<{ ok: true }> {
    return this.http.delete<{ ok: true }>(
      `${this.baseUrl(shopSlug)}/session`,
      { headers: this.portalHeaders(shopSlug) },
    );
  }

  getDashboard(shopSlug: string): Observable<CustomerPortalDashboardResponse> {
    return this.http.get<CustomerPortalDashboardResponse>(
      `${this.baseUrl(shopSlug)}/dashboard`,
      { headers: this.portalHeaders(shopSlug) },
    );
  }

  getRepair(
    shopSlug: string,
    repairId: string,
  ): Observable<CustomerPortalRepairResponse> {
    return this.http.get<CustomerPortalRepairResponse>(
      `${this.baseUrl(shopSlug)}/repairs/${encodeURIComponent(repairId)}`,
      { headers: this.portalHeaders(shopSlug) },
    );
  }

  listMessages(
    shopSlug: string,
    repairId: string,
  ): Observable<CustomerPortalMessagesResponse> {
    return this.http.get<CustomerPortalMessagesResponse>(
      `${this.baseUrl(shopSlug)}/repairs/${encodeURIComponent(repairId)}/messages`,
      { headers: this.portalHeaders(shopSlug) },
    );
  }

  sendMessage(
    shopSlug: string,
    repairId: string,
    message: string,
  ): Observable<CustomerPortalMessage> {
    return this.http.post<CustomerPortalMessage>(
      `${this.baseUrl(shopSlug)}/repairs/${encodeURIComponent(repairId)}/messages`,
      { message },
      { headers: this.portalHeaders(shopSlug) },
    );
  }

  markMessagesRead(
    shopSlug: string,
    repairId: string,
  ): Observable<{ ok: true }> {
    return this.http.post<{ ok: true }>(
      `${this.baseUrl(shopSlug)}/repairs/${encodeURIComponent(repairId)}/messages/read`,
      {},
      { headers: this.portalHeaders(shopSlug) },
    );
  }

  createOrderPaymentIntent(
    shopSlug: string,
    orderId: string,
  ): Observable<CustomerPortalPaymentIntentResponse> {
    return this.http.post<CustomerPortalPaymentIntentResponse>(
      `${this.baseUrl(shopSlug)}/orders/${encodeURIComponent(orderId)}/payment-intent`,
      {},
      { headers: this.portalHeaders(shopSlug) },
    );
  }

  recordOrderPayment(
    shopSlug: string,
    orderId: string,
    paymentIntentId: string,
  ): Observable<CustomerPortalPaymentRecordResponse> {
    return this.http.post<CustomerPortalPaymentRecordResponse>(
      `${this.baseUrl(shopSlug)}/orders/${encodeURIComponent(orderId)}/payment-record`,
      { paymentIntentId },
      { headers: this.portalHeaders(shopSlug) },
    );
  }
}
