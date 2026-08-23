import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { AppConfigService } from '../app-config/app-config.service';
import type { BusinessEnrollmentAdminState } from '../business-enrollment/model';
import {
  BusinessAccountContact,
  BusinessAccountCreateInput,
  BusinessAccountDetail,
  BusinessAccountDevice,
  BusinessAccountListResponse,
  BusinessAccountPatchInput,
  BusinessAccountStatus,
  BusinessContactCreateInput,
  BusinessContactPatchInput,
  BusinessDeviceCreateInput,
  BusinessDevicePatchInput,
  BusinessEnrollmentEntitlement,
  BusinessLocation,
  BusinessOperationsOverview,
  BusinessOperationsPatchInput,
  BusinessStatement,
} from './model';

@Injectable({ providedIn: 'root' })
export class BusinessAccountsService {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);

  private get baseUrl(): string {
    return `${this.appConfig.config.apiBase}/business-accounts`;
  }

  list(paramsInput: { search?: string; status?: BusinessAccountStatus | ''; limit?: number; cursor?: string } = {}): Observable<BusinessAccountListResponse> {
    let params = new HttpParams().set('limit', String(paramsInput.limit ?? 100));
    if (paramsInput.search?.trim()) params = params.set('search', paramsInput.search.trim());
    if (paramsInput.status) params = params.set('status', paramsInput.status);
    if (paramsInput.cursor) params = params.set('cursor', paramsInput.cursor);
    return this.http.get<BusinessAccountListResponse>(this.baseUrl, { params });
  }

  get(id: string): Observable<BusinessAccountDetail> {
    return this.http.get<BusinessAccountDetail>(`${this.baseUrl}/${encodeURIComponent(id)}`);
  }

  create(payload: BusinessAccountCreateInput): Observable<BusinessAccountDetail> {
    return this.http.post<BusinessAccountDetail>(this.baseUrl, payload);
  }

  update(id: string, payload: BusinessAccountPatchInput): Observable<BusinessAccountDetail> {
    return this.http.patch<BusinessAccountDetail>(`${this.baseUrl}/${encodeURIComponent(id)}`, payload);
  }

  addContact(accountId: string, payload: BusinessContactCreateInput): Observable<BusinessAccountContact> {
    return this.http.post<BusinessAccountContact>(`${this.baseUrl}/${encodeURIComponent(accountId)}/contacts`, payload);
  }

  updateContact(accountId: string, contactId: string, payload: BusinessContactPatchInput): Observable<BusinessAccountContact> {
    return this.http.patch<BusinessAccountContact>(`${this.baseUrl}/${encodeURIComponent(accountId)}/contacts/${encodeURIComponent(contactId)}`, payload);
  }

  deleteContact(accountId: string, contactId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${encodeURIComponent(accountId)}/contacts/${encodeURIComponent(contactId)}`);
  }

  addDevice(accountId: string, payload: BusinessDeviceCreateInput): Observable<BusinessAccountDevice> {
    return this.http.post<BusinessAccountDevice>(`${this.baseUrl}/${encodeURIComponent(accountId)}/devices`, payload);
  }

  updateDevice(accountId: string, deviceId: string, payload: BusinessDevicePatchInput): Observable<BusinessAccountDevice> {
    return this.http.patch<BusinessAccountDevice>(`${this.baseUrl}/${encodeURIComponent(accountId)}/devices/${encodeURIComponent(deviceId)}`, payload);
  }

  archiveDevice(accountId: string, deviceId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${encodeURIComponent(accountId)}/devices/${encodeURIComponent(deviceId)}`);
  }

  getOperations(accountId: string): Observable<BusinessOperationsOverview> {
    return this.http.get<BusinessOperationsOverview>(`${this.baseUrl}/${encodeURIComponent(accountId)}/operations`);
  }

  updateOperations(accountId: string, payload: BusinessOperationsPatchInput): Observable<{ ok: true }> {
    return this.http.patch<{ ok: true }>(`${this.baseUrl}/${encodeURIComponent(accountId)}/operations`, payload);
  }

  getEnrollment(accountId: string): Observable<BusinessEnrollmentAdminState> {
    return this.http.get<BusinessEnrollmentAdminState>(`${this.baseUrl}/${encodeURIComponent(accountId)}/enrollment`);
  }

  sendEnrollment(accountId: string, contactId?: string | null): Observable<{ ok: true; url: string; sentTo: { id: string; name: string; email: string } }> {
    return this.http.post<{ ok: true; url: string; sentTo: { id: string; name: string; email: string } }>(
      `${this.baseUrl}/${encodeURIComponent(accountId)}/enrollment/send`,
      { contactId: contactId || null },
    );
  }

  sharePortal(accountId: string, contactId: string): Observable<{ ok: true; url: string; sentTo: { id: string; name: string; email: string } }> {
    return this.http.post<{ ok: true; url: string; sentTo: { id: string; name: string; email: string } }>(
      `${this.baseUrl}/${encodeURIComponent(accountId)}/portal/share`,
      { contactId },
    );
  }

  addLocation(accountId: string, payload: Partial<BusinessLocation> & { name: string }): Observable<BusinessLocation> {
    return this.http.post<BusinessLocation>(`${this.baseUrl}/${encodeURIComponent(accountId)}/locations`, payload);
  }

  updateLocation(accountId: string, locationId: string, payload: Partial<BusinessLocation>): Observable<BusinessLocation> {
    return this.http.patch<BusinessLocation>(`${this.baseUrl}/${encodeURIComponent(accountId)}/locations/${encodeURIComponent(locationId)}`, payload);
  }

  addCredit(accountId: string, payload: { amountCents: number; note?: string | null; reference?: string | null }): Observable<unknown> {
    return this.http.post(`${this.baseUrl}/${encodeURIComponent(accountId)}/credits`, payload);
  }

  prepareStatement(accountId: string, payload: { periodStartAt?: string; periodEndAt?: string } = {}): Observable<BusinessStatement> {
    return this.http.post<BusinessStatement>(`${this.baseUrl}/${encodeURIComponent(accountId)}/statements/prepare`, payload);
  }

  finalizeStatement(accountId: string, statementId: string): Observable<BusinessStatement> {
    return this.http.post<BusinessStatement>(`${this.baseUrl}/${encodeURIComponent(accountId)}/statements/${encodeURIComponent(statementId)}/finalize`, {});
  }

  recordStatementPayment(accountId: string, statementId: string, payload: { amountCents: number; reference?: string | null; note?: string | null }): Observable<BusinessStatement> {
    return this.http.post<BusinessStatement>(`${this.baseUrl}/${encodeURIComponent(accountId)}/statements/${encodeURIComponent(statementId)}/payment`, payload);
  }

  voidStatement(accountId: string, statementId: string): Observable<BusinessStatement> {
    return this.http.post<BusinessStatement>(`${this.baseUrl}/${encodeURIComponent(accountId)}/statements/${encodeURIComponent(statementId)}/void`, {});
  }

  useEntitlement(accountId: string, entitlementId: string, payload: { quantity: number; repairId?: string | null; note?: string | null }): Observable<BusinessEnrollmentEntitlement> {
    return this.http.post<BusinessEnrollmentEntitlement>(`${this.baseUrl}/${encodeURIComponent(accountId)}/entitlements/${encodeURIComponent(entitlementId)}/use`, payload);
  }

  bulkUpdateDevices(accountId: string, deviceIds: string[], patch: Record<string, unknown>): Observable<{ updated: number }> {
    return this.http.post<{ updated: number }>(`${this.baseUrl}/${encodeURIComponent(accountId)}/devices/bulk`, { deviceIds, patch });
  }

  importDevices(accountId: string, rows: Record<string, unknown>[]): Observable<{ created: number; devices: BusinessAccountDevice[] }> {
    return this.http.post<{ created: number; devices: BusinessAccountDevice[] }>(`${this.baseUrl}/${encodeURIComponent(accountId)}/devices/import`, { rows });
  }
}
