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
  PricingNotOffered,
  PricingNotOfferedClearResponse,
  PricingNotOfferedInput,
  PricingNotOfferedListParams,
  PricingNotOfferedResponse,
  RepairType,
  RepairTypeInput,
  ReorderResponse,
  PricingOverview,
  PricingRule,
  PricingRuleInput,
  SupplierPricingHealthRow,
} from './model';

@Injectable({ providedIn: 'root' })
export class RepairPricingService {
  private readonly appConfig = inject(AppConfigService);
  private readonly http = inject(HttpClient);

  private get baseUrl(): string {
    return `${this.appConfig.config.apiBase}/repair-pricing`;
  }


  getOverview(query: { categoryId?: string; brandId?: string } = {}): Observable<PricingOverview> {
    let params = new HttpParams();
    if (query.categoryId) params = params.set('categoryId', query.categoryId);
    if (query.brandId) params = params.set('brandId', query.brandId);
    return this.http.get<PricingOverview>(`${this.baseUrl}/overview`, { params });
  }

  listRules(): Observable<ListResponse<PricingRule>> {
    return this.http.get<ListResponse<PricingRule>>(`${this.baseUrl}/rules`);
  }

  createRule(payload: PricingRuleInput): Observable<{ data: PricingRule; materialized: BulkAssignResponse }> {
    return this.http.post<{ data: PricingRule; materialized: BulkAssignResponse }>(`${this.baseUrl}/rules`, payload);
  }

  updateRule(id: string, payload: Partial<PricingRuleInput>): Observable<{ data: PricingRule; materialized: BulkAssignResponse }> {
    return this.http.patch<{ data: PricingRule; materialized: BulkAssignResponse }>(`${this.baseUrl}/rules/${encodeURIComponent(id)}`, payload);
  }

  applyRule(id: string): Observable<BulkAssignResponse> {
    return this.http.post<BulkAssignResponse>(`${this.baseUrl}/rules/${encodeURIComponent(id)}/apply`, {});
  }

  deactivateRule(id: string): Observable<{ data: PricingRule }> {
    return this.http.delete<{ data: PricingRule }>(`${this.baseUrl}/rules/${encodeURIComponent(id)}`);
  }

  listSupplierHealth(): Observable<ListResponse<SupplierPricingHealthRow>> {
    return this.http.get<ListResponse<SupplierPricingHealthRow>>(`${this.baseUrl}/supplier-health`);
  }

  refreshSupplierHealth(id: string): Observable<{ checked: boolean; changed: boolean; costCents?: number | null; inStock?: boolean | null }> {
    return this.http.post<{ checked: boolean; changed: boolean; costCents?: number | null; inStock?: boolean | null }>(`${this.baseUrl}/supplier-health/${encodeURIComponent(id)}/refresh`, {});
  }

  setSupplierMonitoring(id: string, priceMonitoringEnabled: boolean): Observable<{ data: SupplierPricingHealthRow }> {
    return this.http.patch<{ data: SupplierPricingHealthRow }>(`${this.baseUrl}/supplier-health/${encodeURIComponent(id)}`, { priceMonitoringEnabled });
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

  batchUpdatePrices(changes: Array<{ id: string; expectedUpdatedAt: string; laborCents?: number | null; manualPartCostCents?: number | null; fixedPriceCents?: number | null; useDynamicPricing?: boolean; isPublic?: boolean; isActive?: boolean }>): Observable<{ updatedCount: number; data: PricingOption[] }> {
    return this.http.post<{ updatedCount: number; data: PricingOption[] }>(`${this.baseUrl}/options/batch-prices`, { changes });
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
    if (query.categoryId) {
      params = params.set('categoryId', query.categoryId);
    }
    if (query.brandId) {
      params = params.set('brandId', query.brandId);
    }
    if (query.search?.trim()) {
      params = params.set('search', query.search.trim());
    }

    return this.http.get<ListResponse<PricingOption>>(
      `${this.baseUrl}/options`,
      { params },
    );
  }

  listNotOffered(
    query: PricingNotOfferedListParams = {},
  ): Observable<ListResponse<PricingNotOffered>> {
    let params = new HttpParams();
    if (query.modelId) params = params.set('modelId', query.modelId);
    if (query.repairTypeId) {
      params = params.set('repairTypeId', query.repairTypeId);
    }
    if (query.categoryId) {
      params = params.set('categoryId', query.categoryId);
    }
    if (query.brandId) {
      params = params.set('brandId', query.brandId);
    }

    return this.http.get<ListResponse<PricingNotOffered>>(
      `${this.baseUrl}/not-offered`,
      { params },
    );
  }

  markNotOffered(
    payload: PricingNotOfferedInput,
  ): Observable<PricingNotOfferedResponse> {
    return this.http.post<PricingNotOfferedResponse>(
      `${this.baseUrl}/not-offered`,
      payload,
    );
  }

  clearNotOffered(
    payload: PricingNotOfferedInput,
  ): Observable<PricingNotOfferedClearResponse> {
    return this.http.post<PricingNotOfferedClearResponse>(
      `${this.baseUrl}/not-offered/clear`,
      payload,
    );
  }

  getOption(id: string): Observable<PricingOption> {
    return this.http.get<PricingOption>(
      `${this.baseUrl}/options/${encodeURIComponent(id)}`,
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

  resetWorksheetOption(id: string): Observable<PricingOption> {
    return this.http.post<PricingOption>(`${this.baseUrl}/options/${encodeURIComponent(id)}/reset-worksheet`, {});
  }

  deleteWorksheetOption(id: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`${this.baseUrl}/options/${encodeURIComponent(id)}/permanent`);
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
