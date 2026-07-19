import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { AppConfigService } from '../app-config/app-config.service';
import {
  BulkActionResponse,
  BulkAssignResponse,
  ListResponse,
  PricingOption,
  PricingOptionBulkActionInput,
  PricingOptionBulkAssignInput,
  PricingOptionInput,
  PricingOptionListParams,
  RepairType,
  RepairTypeInput,
  ReorderResponse,
} from './model';

@Injectable({ providedIn: 'root' })
export class RepairPricingService {
  private readonly appConfig = inject(AppConfigService);
  private readonly http = inject(HttpClient);

  private get baseUrl(): string {
    return `${this.appConfig.config.apiBase}/repair-pricing`;
  }

  listRepairTypes(): Observable<ListResponse<RepairType>> {
    return this.http.get<ListResponse<RepairType>>(
      `${this.baseUrl}/repair-types`,
    );
  }

  createRepairType(payload: RepairTypeInput): Observable<RepairType> {
    return this.http.post<RepairType>(`${this.baseUrl}/repair-types`, payload);
  }

  updateRepairType(
    id: string,
    payload: Partial<RepairTypeInput>,
  ): Observable<RepairType> {
    return this.http.patch<RepairType>(
      `${this.baseUrl}/repair-types/${encodeURIComponent(id)}`,
      payload,
    );
  }

  deactivateRepairType(id: string): Observable<RepairType> {
    return this.http.delete<RepairType>(
      `${this.baseUrl}/repair-types/${encodeURIComponent(id)}`,
    );
  }

  reorderRepairTypes(orderedIds: string[]): Observable<ReorderResponse> {
    return this.http.post<ReorderResponse>(
      `${this.baseUrl}/repair-types/reorder`,
      { orderedIds },
    );
  }

  listOptions(
    query: PricingOptionListParams = {},
  ): Observable<ListResponse<PricingOption>> {
    let params = new HttpParams()
      .set('includeInactive', String(query.includeInactive ?? true))
      .set('includePrivate', String(query.includePrivate ?? true));

    if (query.modelId) params = params.set('modelId', query.modelId);
    if (query.repairTypeId) {
      params = params.set('repairTypeId', query.repairTypeId);
    }
    if (query.search?.trim()) {
      params = params.set('search', query.search.trim());
    }

    return this.http.get<ListResponse<PricingOption>>(
      `${this.baseUrl}/options`,
      { params },
    );
  }

  createOption(payload: PricingOptionInput): Observable<PricingOption> {
    return this.http.post<PricingOption>(`${this.baseUrl}/options`, payload);
  }

  updateOption(
    id: string,
    payload: Partial<PricingOptionInput>,
  ): Observable<PricingOption> {
    return this.http.patch<PricingOption>(
      `${this.baseUrl}/options/${encodeURIComponent(id)}`,
      payload,
    );
  }

  deactivateOption(id: string): Observable<PricingOption> {
    return this.http.delete<PricingOption>(
      `${this.baseUrl}/options/${encodeURIComponent(id)}`,
    );
  }

  reorderOptions(orderedIds: string[]): Observable<ReorderResponse> {
    return this.http.post<ReorderResponse>(
      `${this.baseUrl}/options/reorder`,
      { orderedIds },
    );
  }

  bulkAssign(
    payload: PricingOptionBulkAssignInput,
  ): Observable<BulkAssignResponse> {
    return this.http.post<BulkAssignResponse>(
      `${this.baseUrl}/options/bulk-assign`,
      payload,
    );
  }

  bulkAction(
    payload: PricingOptionBulkActionInput,
  ): Observable<BulkActionResponse> {
    return this.http.post<BulkActionResponse>(
      `${this.baseUrl}/options/bulk-action`,
      payload,
    );
  }
}
