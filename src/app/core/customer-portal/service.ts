import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { AppConfigService } from '../app-config/app-config.service';
import {
  CustomerPortalConfigResponse,
  CustomerPortalDashboardResponse,
  CustomerPortalDeviceCatalogBrand,
  CustomerPortalDeviceCatalogCategory,
  CustomerPortalDeviceCatalogModel,
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

  submitBusinessRepairRequest(
    shopSlug: string,
    payload: { customerDeviceId: string; problemSummary: string; purchaseOrderNumber?: string | null; intakeNotes?: string | null },
  ): Observable<{ data: { id: string; status: string; problemSummary: string; customerDeviceId: string; createdAt: string } }> {
    return this.http.post<{ data: { id: string; status: string; problemSummary: string; customerDeviceId: string; createdAt: string } }>(
      `${this.baseUrl(shopSlug)}/business/repair-requests`,
      payload,
      { headers: this.portalHeaders(shopSlug) },
    );
  }

  resolveApiPath(path: string): string {
    if (/^https?:\/\//i.test(path)) return path;
    const apiBase = this.apiBase.replace(/\/+$/, '');
    const origin = apiBase.replace(/\/v1$/i, '');
    return path.startsWith('/v1/') ? `${origin}${path}` : `${apiBase}/${path.replace(/^\/+/, '')}`;
  }

  openBusinessBillingPortal(shopSlug: string): Observable<{ url: string }> {
    return this.http.post<{ url: string }>(
      `${this.baseUrl(shopSlug)}/business/billing-portal`,
      {},
      { headers: this.portalHeaders(shopSlug) },
    );
  }

  updateBusinessAccount(
    shopSlug: string,
    payload: { name?: string; legalName?: string | null; billingEmail?: string | null; billingPhone?: string | null },
  ): Observable<{ data: { id: string } }> {
    return this.http.patch<{ data: { id: string } }>(
      `${this.baseUrl(shopSlug)}/business/account`,
      payload,
      { headers: this.portalHeaders(shopSlug) },
    );
  }

  addBusinessContact(
    shopSlug: string,
    payload: { name: string; title?: string | null; email?: string | null; phone?: string | null; isPrimary?: boolean; isBilling?: boolean; canAuthorizeRepairs?: boolean; receivesUpdates?: boolean },
  ): Observable<{ data: { id: string } }> {
    return this.http.post<{ data: { id: string } }>(
      `${this.baseUrl(shopSlug)}/business/contacts`,
      payload,
      { headers: this.portalHeaders(shopSlug) },
    );
  }

  updateBusinessContact(
    shopSlug: string,
    contactId: string,
    payload: { name?: string; title?: string | null; email?: string | null; phone?: string | null; isPrimary?: boolean; isBilling?: boolean; canAuthorizeRepairs?: boolean; receivesUpdates?: boolean },
  ): Observable<{ data: { id: string } }> {
    return this.http.patch<{ data: { id: string } }>(
      `${this.baseUrl(shopSlug)}/business/contacts/${encodeURIComponent(contactId)}`,
      payload,
      { headers: this.portalHeaders(shopSlug) },
    );
  }

  deleteBusinessContact(shopSlug: string, contactId: string): Observable<{ ok: true }> {
    return this.http.delete<{ ok: true }>(
      `${this.baseUrl(shopSlug)}/business/contacts/${encodeURIComponent(contactId)}`,
      { headers: this.portalHeaders(shopSlug) },
    );
  }

  listBusinessDeviceCatalogCategories(
    shopSlug: string,
  ): Observable<{ data: CustomerPortalDeviceCatalogCategory[] }> {
    return this.http.get<{ data: CustomerPortalDeviceCatalogCategory[] }>(
      `${this.baseUrl(shopSlug)}/business/device-catalog/categories`,
      { headers: this.portalHeaders(shopSlug) },
    );
  }

  listBusinessDeviceCatalogBrands(
    shopSlug: string,
    categoryId: string,
  ): Observable<{ data: CustomerPortalDeviceCatalogBrand[] }> {
    const params = new HttpParams().set('categoryId', categoryId);
    return this.http.get<{ data: CustomerPortalDeviceCatalogBrand[] }>(
      `${this.baseUrl(shopSlug)}/business/device-catalog/brands`,
      { headers: this.portalHeaders(shopSlug), params },
    );
  }

  listBusinessDeviceCatalogModels(
    shopSlug: string,
    brandId: string,
    search = '',
  ): Observable<{ data: CustomerPortalDeviceCatalogModel[] }> {
    let params = new HttpParams().set('brandId', brandId);
    if (search.trim()) params = params.set('search', search.trim());
    return this.http.get<{ data: CustomerPortalDeviceCatalogModel[] }>(
      `${this.baseUrl(shopSlug)}/business/device-catalog/models`,
      { headers: this.portalHeaders(shopSlug), params },
    );
  }

  getBusinessDeviceCatalogModel(
    shopSlug: string,
    modelId: string,
  ): Observable<{ data: CustomerPortalDeviceCatalogModel }> {
    return this.http.get<{ data: CustomerPortalDeviceCatalogModel }>(
      `${this.baseUrl(shopSlug)}/business/device-catalog/models/${encodeURIComponent(modelId)}`,
      { headers: this.portalHeaders(shopSlug) },
    );
  }

  addBusinessDevice(
    shopSlug: string,
    payload: { catalogRef: string; assetTag?: string | null; serial?: string | null; imei?: string | null; assignedToName?: string | null; assignedToEmail?: string | null; department?: string | null; fleetStatus?: 'active' | 'spare' | 'retired' | 'lost'; isPlanCovered?: boolean },
  ): Observable<{ data: { id: string } }> {
    return this.http.post<{ data: { id: string } }>(
      `${this.baseUrl(shopSlug)}/business/devices`,
      payload,
      { headers: this.portalHeaders(shopSlug) },
    );
  }

  updateBusinessDevice(
    shopSlug: string,
    deviceId: string,
    payload: { catalogRef?: string; assetTag?: string | null; serial?: string | null; imei?: string | null; assignedToName?: string | null; assignedToEmail?: string | null; department?: string | null; fleetStatus?: 'active' | 'spare' | 'retired' | 'lost'; isPlanCovered?: boolean },
  ): Observable<{ data: { id: string } }> {
    return this.http.patch<{ data: { id: string } }>(
      `${this.baseUrl(shopSlug)}/business/devices/${encodeURIComponent(deviceId)}`,
      payload,
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
