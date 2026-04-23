import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import type {
  AvailabilityOverride,
  AvailabilityOverridesListParams,
  AvailabilityOverridesListResponse,
  AvailabilityRule,
  AvailabilityRulesListResponse,
  AvailabilitySlotsParams,
  AvailabilitySlotsResponse,
  CreateAvailabilityOverrideDto,
  CreateAvailabilityRuleDto,
  UpdateAvailabilityRuleDto,
} from './availability-model';
import { AppConfigService } from '../app-config/app-config.service';

@Injectable({
  providedIn: 'root',
})
export class AvailabilityService {
  private readonly appConfig = inject(AppConfigService);
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${this.apiBase}/availability`;

  private get apiBase(): string {
    return this.appConfig.config.apiBase;
  }

  listRules(): Observable<AvailabilityRulesListResponse> {
    return this.http.get<AvailabilityRulesListResponse>(`${this.baseUrl}/rules`);
  }

  createRule(payload: CreateAvailabilityRuleDto): Observable<AvailabilityRule> {
    return this.http.post<AvailabilityRule>(`${this.baseUrl}/rules`, payload);
  }

  updateRule(id: string, payload: UpdateAvailabilityRuleDto): Observable<AvailabilityRule> {
    return this.http.patch<AvailabilityRule>(`${this.baseUrl}/rules/${id}`, payload);
  }

  deleteRule(id: string): Observable<null> {
    return this.http.delete<null>(`${this.baseUrl}/rules/${id}`);
  }

  listOverrides(params: AvailabilityOverridesListParams): Observable<AvailabilityOverridesListResponse> {
    let httpParams = new HttpParams()
      .set('from', params.from)
      .set('to', params.to);

    if (params.userId) {
      httpParams = httpParams.set('userId', params.userId);
    }

    return this.http.get<AvailabilityOverridesListResponse>(`${this.baseUrl}/overrides`, {
      params: httpParams,
    });
  }

  createOverride(payload: CreateAvailabilityOverrideDto): Observable<AvailabilityOverride> {
    return this.http.post<AvailabilityOverride>(`${this.baseUrl}/overrides`, payload);
  }

  deleteOverride(id: string): Observable<null> {
    return this.http.delete<null>(`${this.baseUrl}/overrides/${id}`);
  }

    listSlots(params: AvailabilitySlotsParams): Observable<AvailabilitySlotsResponse> {
    let httpParams = new HttpParams()
      .set('from', params.from)
      .set('to', params.to);

    if (params.durationMinutes != null) {
      httpParams = httpParams.set('durationMinutes', String(params.durationMinutes));
    }

    if (params.repairId) {
      httpParams = httpParams.set('repairId', params.repairId);
    }

    if (params.assignedUserId) {
      httpParams = httpParams.set('assignedUserId', params.assignedUserId);
    }

    if (params.slotMinutes != null) {
      httpParams = httpParams.set('slotMinutes', String(params.slotMinutes));
    }

    if (params.serviceMode) {
      httpParams = httpParams.set('serviceMode', params.serviceMode);
    }

    if (params.serviceAddressId) {
      httpParams = httpParams.set('serviceAddressId', params.serviceAddressId);
    }

    if (params.serviceAddress) {
      httpParams = httpParams.set('serviceAddressLine1', params.serviceAddress.line1);

      if (params.serviceAddress.line2) {
        httpParams = httpParams.set('serviceAddressLine2', params.serviceAddress.line2);
      }

      httpParams = httpParams
        .set('serviceAddressCity', params.serviceAddress.city)
        .set('serviceAddressState', params.serviceAddress.state)
        .set('serviceAddressPostalCode', params.serviceAddress.postalCode)
        .set('serviceAddressCountry', params.serviceAddress.country);

      if (params.serviceAddress.geo?.lat != null) {
        httpParams = httpParams.set('serviceAddressLat', String(params.serviceAddress.geo.lat));
      }

      if (params.serviceAddress.geo?.lng != null) {
        httpParams = httpParams.set('serviceAddressLng', String(params.serviceAddress.geo.lng));
      }
    }

    return this.http.get<AvailabilitySlotsResponse>(`${this.baseUrl}/slots`, {
      params: httpParams,
    });
  }
}