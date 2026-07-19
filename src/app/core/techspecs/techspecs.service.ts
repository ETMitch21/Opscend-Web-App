import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, shareReplay, tap } from 'rxjs';

import { AppConfigService } from '../app-config/app-config.service';

export interface DeviceCatalogPage<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface TechSpecsBrand {
  id: string;
  name: string;
  slug?: string | null;
  isActive?: boolean;
  sortOrder?: number | null;
}

export interface TechSpecsModel {
  id: string;
  brandId?: string | null;
  brandName?: string | null;
  name: string;
  slug?: string | null;
  imageUrl?: string | null;
  releaseYear?: number | null;
  isActive?: boolean;
  sortOrder?: number | null;
}

export interface DeviceCatalogModelOption {
  /** Legacy property name retained for compatibility. The value is the internal model ID. */
  techspecsProductId: string;
  category: string;
  brand: string;
  model: string;
  releaseDate?: string;
}

export interface DeviceCatalogPagingParams {
  page?: number;
  size?: number;
}

export interface DeviceCatalogBrandsParams extends DeviceCatalogPagingParams {
  category: string;
  search?: string;
}

export interface DeviceCatalogModelsParams extends DeviceCatalogPagingParams {
  category: string;
  brand: string;
  search?: string;
  keepCasing?: boolean;
}

export interface ManagedDeviceCatalogCategory {
  id: string;
  shopId: string;
  name: string;
  slug: string;
  isActive: boolean;
  isPublic: boolean;
  sortOrder: number;
  source: string;
  masterCategoryId: string | null;
  masterRevision: number | null;
  masterSyncedAt: string | null;
  brandCount: number;
  modelCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ManagedDeviceCatalogBrand {
  id: string;
  shopId: string;
  categoryId: string;
  categoryName: string;
  name: string;
  slug: string;
  isActive: boolean;
  isPublic: boolean;
  sortOrder: number;
  source: string;
  masterBrandId: string | null;
  masterRevision: number | null;
  masterSyncedAt: string | null;
  modelCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ManagedDeviceCatalogModel {
  id: string;
  shopId: string;
  categoryId: string;
  categoryName: string;
  brandId: string;
  brandName: string;
  name: string;
  slug: string;
  releaseYear: number | null;
  isActive: boolean;
  isPublic: boolean;
  sortOrder: number;
  externalProvider: string | null;
  externalProductId: string | null;
  source: string;
  masterModelId: string | null;
  masterRevision: number | null;
  masterSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DeviceCatalogCategoryInput {
  name: string;
  isActive?: boolean;
  isPublic?: boolean;
  sortOrder?: number;
}

export interface DeviceCatalogBrandInput {
  categoryId: string;
  name: string;
  isActive?: boolean;
  isPublic?: boolean;
  sortOrder?: number;
}

export interface DeviceCatalogModelInput {
  brandId: string;
  name: string;
  releaseYear?: number | null;
  isActive?: boolean;
  isPublic?: boolean;
  sortOrder?: number;
  externalProvider?: string | null;
  externalProductId?: string | null;
}

export interface DeviceCatalogSyncStatus {
  currentRevision: number;
  lastSyncedRevision: number;
  updateAvailable: boolean;
  lastSyncedAt: string | null;
  latestRelease: {
    title: string;
    summary: string | null;
    publishedAt: string;
  } | null;
  availableCounts: {
    categories: number;
    brands: number;
    models: number;
  };
}

export interface DeviceCatalogSyncResult {
  currentRevision: number;
  categoriesCreated: number;
  categoriesUpdated: number;
  brandsCreated: number;
  brandsUpdated: number;
  modelsCreated: number;
  modelsUpdated: number;
  recordsAvailable: number;
}

export type DeviceCatalogBulkEntity = 'category' | 'brand' | 'model';
export type DeviceCatalogBulkAction =
  | 'activate'
  | 'publish'
  | 'make_private'
  | 'deactivate';

export interface DeviceCatalogBulkActionInput {
  entity: DeviceCatalogBulkEntity;
  ids: string[];
  action: DeviceCatalogBulkAction;
}

export interface DeviceCatalogBulkActionResult {
  entity: DeviceCatalogBulkEntity;
  action: DeviceCatalogBulkAction;
  requestedCount: number;
  updatedCount: number;
}

interface ListResponse<T> {
  data: T[];
}

@Injectable({
  providedIn: 'root',
})
export class TechSpecsService {
  private readonly appConfig = inject(AppConfigService);
  private readonly http = inject(HttpClient);
  private readonly requestCache = new Map<string, Observable<unknown>>();

  private get apiBase(): string {
    return this.appConfig.config.apiBase;
  }

  private get baseUrl(): string {
    return `${this.apiBase}/devices/catalog`;
  }

  listCategories(
    query: DeviceCatalogPagingParams = {}
  ): Observable<DeviceCatalogPage<string>> {
    const params = new HttpParams()
      .set('page', String(query.page ?? 0))
      .set('size', String(query.size ?? 20));

    return this.cachedGet<DeviceCatalogPage<string>>(
      `${this.baseUrl}/categories`,
      params
    );
  }

  listBrands(
    query: DeviceCatalogBrandsParams
  ): Observable<DeviceCatalogPage<string>> {
    let params = new HttpParams()
      .set('category', query.category)
      .set('page', String(query.page ?? 0))
      .set('size', String(query.size ?? 20));

    const search = this.normalizeSearchParam(query.search);
    if (search) params = params.set('search', search);

    return this.cachedGet<DeviceCatalogPage<string>>(
      `${this.baseUrl}/brands`,
      params
    );
  }

  listModels(
    query: DeviceCatalogModelsParams
  ): Observable<DeviceCatalogPage<DeviceCatalogModelOption>> {
    let params = new HttpParams()
      .set('category', query.category)
      .set('brand', query.brand)
      .set('page', String(query.page ?? 0))
      .set('size', String(query.size ?? 20));

    const search = this.normalizeSearchParam(query.search);
    if (search) params = params.set('search', search);

    if (query.keepCasing != null) {
      params = params.set('keepCasing', String(query.keepCasing));
    }

    return this.cachedGet<DeviceCatalogPage<DeviceCatalogModelOption>>(
      `${this.baseUrl}/models`,
      params
    );
  }

  searchBrands(
    category: string,
    search = '',
    query: DeviceCatalogPagingParams = {}
  ): Observable<DeviceCatalogPage<string>> {
    return this.listBrands({
      category,
      search,
      page: query.page ?? 0,
      size: query.size ?? 20,
    });
  }

  searchModels(
    category: string,
    brand: string,
    search = '',
    query: DeviceCatalogPagingParams = {}
  ): Observable<DeviceCatalogPage<DeviceCatalogModelOption>> {
    return this.listModels({
      category,
      brand,
      search,
      page: query.page ?? 0,
      size: query.size ?? 20,
      keepCasing: true,
    });
  }

  listManagedCategories(
    includeInactive = true
  ): Observable<ListResponse<ManagedDeviceCatalogCategory>> {
    const params = new HttpParams().set('includeInactive', String(includeInactive));
    return this.http.get<ListResponse<ManagedDeviceCatalogCategory>>(
      `${this.baseUrl}/manage/categories`,
      { params }
    );
  }

  createManagedCategory(
    payload: DeviceCatalogCategoryInput
  ): Observable<ManagedDeviceCatalogCategory> {
    return this.http
      .post<ManagedDeviceCatalogCategory>(`${this.baseUrl}/manage/categories`, payload)
      .pipe(tap(() => this.clearCache()));
  }

  updateManagedCategory(
    id: string,
    payload: Partial<DeviceCatalogCategoryInput>
  ): Observable<ManagedDeviceCatalogCategory> {
    return this.http
      .patch<ManagedDeviceCatalogCategory>(
        `${this.baseUrl}/manage/categories/${encodeURIComponent(id)}`,
        payload
      )
      .pipe(tap(() => this.clearCache()));
  }

  deactivateManagedCategory(id: string): Observable<ManagedDeviceCatalogCategory> {
    return this.http
      .delete<ManagedDeviceCatalogCategory>(
        `${this.baseUrl}/manage/categories/${encodeURIComponent(id)}`
      )
      .pipe(tap(() => this.clearCache()));
  }

  listManagedBrands(
    categoryId: string,
    includeInactive = true
  ): Observable<ListResponse<ManagedDeviceCatalogBrand>> {
    const params = new HttpParams()
      .set('categoryId', categoryId)
      .set('includeInactive', String(includeInactive));

    return this.http.get<ListResponse<ManagedDeviceCatalogBrand>>(
      `${this.baseUrl}/manage/brands`,
      { params }
    );
  }

  createManagedBrand(
    payload: DeviceCatalogBrandInput
  ): Observable<ManagedDeviceCatalogBrand> {
    return this.http
      .post<ManagedDeviceCatalogBrand>(`${this.baseUrl}/manage/brands`, payload)
      .pipe(tap(() => this.clearCache()));
  }

  updateManagedBrand(
    id: string,
    payload: Partial<DeviceCatalogBrandInput>
  ): Observable<ManagedDeviceCatalogBrand> {
    return this.http
      .patch<ManagedDeviceCatalogBrand>(
        `${this.baseUrl}/manage/brands/${encodeURIComponent(id)}`,
        payload
      )
      .pipe(tap(() => this.clearCache()));
  }

  deactivateManagedBrand(id: string): Observable<ManagedDeviceCatalogBrand> {
    return this.http
      .delete<ManagedDeviceCatalogBrand>(
        `${this.baseUrl}/manage/brands/${encodeURIComponent(id)}`
      )
      .pipe(tap(() => this.clearCache()));
  }

  listManagedModels(
    brandId: string,
    includeInactive = true,
    search = ''
  ): Observable<ListResponse<ManagedDeviceCatalogModel>> {
    let params = new HttpParams()
      .set('brandId', brandId)
      .set('includeInactive', String(includeInactive));

    const normalizedSearch = this.normalizeSearchParam(search);
    if (normalizedSearch) params = params.set('search', normalizedSearch);

    return this.http.get<ListResponse<ManagedDeviceCatalogModel>>(
      `${this.baseUrl}/manage/models`,
      { params }
    );
  }

  createManagedModel(
    payload: DeviceCatalogModelInput
  ): Observable<ManagedDeviceCatalogModel> {
    return this.http
      .post<ManagedDeviceCatalogModel>(`${this.baseUrl}/manage/models`, payload)
      .pipe(tap(() => this.clearCache()));
  }

  updateManagedModel(
    id: string,
    payload: Partial<DeviceCatalogModelInput>
  ): Observable<ManagedDeviceCatalogModel> {
    return this.http
      .patch<ManagedDeviceCatalogModel>(
        `${this.baseUrl}/manage/models/${encodeURIComponent(id)}`,
        payload
      )
      .pipe(tap(() => this.clearCache()));
  }

  deactivateManagedModel(id: string): Observable<ManagedDeviceCatalogModel> {
    return this.http
      .delete<ManagedDeviceCatalogModel>(
        `${this.baseUrl}/manage/models/${encodeURIComponent(id)}`
      )
      .pipe(tap(() => this.clearCache()));
  }

  bulkUpdateManagedCatalog(
    payload: DeviceCatalogBulkActionInput
  ): Observable<DeviceCatalogBulkActionResult> {
    return this.http
      .post<DeviceCatalogBulkActionResult>(
        `${this.baseUrl}/manage/bulk-action`,
        payload
      )
      .pipe(tap(() => this.clearCache()));
  }

  getCatalogSyncStatus(): Observable<DeviceCatalogSyncStatus> {
    return this.http.get<DeviceCatalogSyncStatus>(
      `${this.baseUrl}/manage/sync-status`
    );
  }

  syncMasterCatalog(): Observable<DeviceCatalogSyncResult> {
    return this.http
      .post<DeviceCatalogSyncResult>(`${this.baseUrl}/manage/sync`, {})
      .pipe(tap(() => this.clearCache()));
  }

  // Kept for code compiled against the first internal-catalog pass.
  importExistingCatalogData(): Observable<DeviceCatalogSyncResult> {
    return this.syncMasterCatalog();
  }

  toBrandOption(brand: string): TechSpecsBrand {
    return {
      id: brand,
      name: brand,
      slug: this.slugify(brand),
      isActive: true,
      sortOrder: null,
    };
  }

  toModelOption(option: DeviceCatalogModelOption): TechSpecsModel {
    return {
      id: option.techspecsProductId,
      brandId: option.brand,
      brandName: option.brand,
      name: option.model,
      slug: this.slugify(option.model),
      imageUrl: null,
      releaseYear: this.getReleaseYear(option.releaseDate),
      isActive: true,
      sortOrder: null,
    };
  }

  clearCache(): void {
    this.requestCache.clear();
  }

  private cachedGet<T>(url: string, params: HttpParams): Observable<T> {
    const cacheKey = `${url}?${params.toString()}`;
    const cached = this.requestCache.get(cacheKey);

    if (cached) return cached as Observable<T>;

    const request$ = this.http.get<T>(url, { params }).pipe(
      shareReplay({ bufferSize: 1, refCount: false })
    );

    this.requestCache.set(cacheKey, request$);
    return request$;
  }

  private normalizeSearchParam(value: string | null | undefined): string | null {
    const search = String(value ?? '').trim();
    return search.length >= 2 ? search : null;
  }

  private slugify(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private getReleaseYear(value?: string): number | null {
    if (!value) return null;
    const year = Number(value.slice(0, 4));
    return Number.isFinite(year) ? year : null;
  }
}
