import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';

import { AppConfigService } from '../app-config/app-config.service';
import {
  BookingSettings,
  BookingSettingsPatch,
  ListResponse,
  RepairPricingTemplate,
  RepairPricingTemplateCreate,
  RepairPricingTemplatePatch,
  ShopRepairNeed,
  ShopRepairNeedCreate,
  ShopRepairNeedPatch,
  BookingQuoteRequest,
  BookingQuoteRequestActionResponse,
  BookingQuoteRequestPatch,
  BookingQuoteRequestsListParams,
  BookingQuoteRequestsResponse,
} from './model';

export interface BookingTemplateListParams {
  repairNeedId?: string;
  isActive?: boolean;
  brand?: string;
  model?: string;
}

@Injectable({
  providedIn: 'root',
})
export class BookingAdminService {
  private readonly appConfig = inject(AppConfigService);
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${this.apiBase}/booking`;

  private get apiBase(): string {
    return this.appConfig.config.apiBase;
  }

  getSettings(): Observable<BookingSettings> {
    return this.http.get<BookingSettings>(`${this.baseUrl}/settings`);
  }

  updateSettings(payload: BookingSettingsPatch): Observable<BookingSettings> {
    return this.http.patch<BookingSettings>(
      `${this.baseUrl}/settings`,
      payload
    );
  }

  listRepairNeeds(): Observable<ListResponse<ShopRepairNeed>> {
    return this.http.get<ListResponse<ShopRepairNeed>>(
      `${this.baseUrl}/repair-needs`
    );
  }

  createRepairNeed(payload: ShopRepairNeedCreate): Observable<ShopRepairNeed> {
    return this.http.post<ShopRepairNeed>(
      `${this.baseUrl}/repair-needs`,
      payload
    );
  }

  updateRepairNeed(
    id: string,
    payload: ShopRepairNeedPatch
  ): Observable<ShopRepairNeed> {
    return this.http.patch<ShopRepairNeed>(
      `${this.baseUrl}/repair-needs/${id}`,
      payload
    );
  }

  deactivateRepairNeed(id: string): Observable<ShopRepairNeed> {
    return this.http.delete<ShopRepairNeed>(
      `${this.baseUrl}/repair-needs/${id}`
    );
  }

  listTemplates(
    query: BookingTemplateListParams = {}
  ): Observable<ListResponse<RepairPricingTemplate>> {
    let params = new HttpParams();

    if (query.repairNeedId) {
      params = params.set('repairNeedId', query.repairNeedId);
    }

    if (query.isActive != null) {
      params = params.set('isActive', String(query.isActive));
    }

    if (query.brand) {
      params = params.set('brand', query.brand);
    }

    if (query.model) {
      params = params.set('model', query.model);
    }

    return this.http.get<ListResponse<RepairPricingTemplate>>(
      `${this.baseUrl}/templates`,
      { params }
    );
  }

  createTemplate(
    payload: RepairPricingTemplateCreate
  ): Observable<RepairPricingTemplate> {
    return this.http.post<RepairPricingTemplate>(
      `${this.baseUrl}/templates`,
      payload
    );
  }

  updateTemplate(
    id: string,
    payload: RepairPricingTemplatePatch
  ): Observable<RepairPricingTemplate> {
    return this.http.patch<RepairPricingTemplate>(
      `${this.baseUrl}/templates/${id}`,
      payload
    );
  }

  deactivateTemplate(id: string): Observable<RepairPricingTemplate> {
    return this.http.delete<RepairPricingTemplate>(
      `${this.baseUrl}/templates/${id}`
    );
  }

  listQuoteRequests(
    params: BookingQuoteRequestsListParams = {}
  ): Observable<BookingQuoteRequestsResponse> {
    let httpParams = new HttpParams();

    if (params.limit !== undefined) {
      httpParams = httpParams.set('limit', String(params.limit));
    }

    if (params.cursor) {
      httpParams = httpParams.set('cursor', params.cursor);
    }

    if (params.customerId) httpParams = httpParams.set('customerId', params.customerId);
    if (params.quoteStatus) httpParams = httpParams.set('quoteStatus', params.quoteStatus);
    if (params.search) httpParams = httpParams.set('search', params.search);
    if (params.createdFrom) httpParams = httpParams.set('createdFrom', params.createdFrom);
    if (params.createdTo) httpParams = httpParams.set('createdTo', params.createdTo);

    return this.http.get<BookingQuoteRequestsResponse>(
      `${this.baseUrl}/quote-requests`,
      { params: httpParams }
    );
  }

  getQuoteRequest(id: string): Observable<BookingQuoteRequest> {
    return this.http.get<BookingQuoteRequest>(
      `${this.baseUrl}/quote-requests/${encodeURIComponent(id)}`
    );
  }

  updateQuoteRequest(
    id: string,
    body: BookingQuoteRequestPatch
  ): Observable<BookingQuoteRequest> {
    return this.http.patch<BookingQuoteRequest>(this.quoteRequestUrl(id), body);
  }

  sendQuoteRequest(id: string): Observable<BookingQuoteRequest> {
    return this.http
      .post<BookingQuoteRequestActionResponse>(
        `${this.quoteRequestUrl(id)}/send`,
        {}
      )
      .pipe(map((response) => response.data));
  }

  emailQuoteRequest(id: string): Observable<BookingQuoteRequest> {
    return this.http
      .post<BookingQuoteRequestActionResponse>(
        `${this.quoteRequestUrl(id)}/email`,
        {}
      )
      .pipe(map((response) => response.data));
  }

  acceptQuoteRequest(id: string): Observable<BookingQuoteRequest> {
    return this.http
      .post<BookingQuoteRequestActionResponse>(
        `${this.quoteRequestUrl(id)}/accept`,
        {}
      )
      .pipe(map((response) => response.data));
  }

  declineQuoteRequest(id: string): Observable<BookingQuoteRequest> {
    return this.http
      .post<BookingQuoteRequestActionResponse>(
        `${this.quoteRequestUrl(id)}/decline`,
        {}
      )
      .pipe(map((response) => response.data));
  }

  convertQuoteRequest(id: string): Observable<BookingQuoteRequest> {
    return this.http
      .post<BookingQuoteRequestActionResponse>(
        `${this.quoteRequestUrl(id)}/convert-to-repair`,
        {}
      )
      .pipe(map((response) => response.data));
  }

  private quoteRequestUrl(id: string): string {
    return `${this.baseUrl}/quote-requests/${encodeURIComponent(id)}`;
  }
}
