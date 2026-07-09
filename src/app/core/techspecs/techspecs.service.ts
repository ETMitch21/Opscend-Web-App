import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, shareReplay } from 'rxjs';

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
    let params = new HttpParams()
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

    if (search) {
      params = params.set('search', search);
    }

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

    if (search) {
      params = params.set('search', search);
    }

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


  private cachedGet<T>(url: string, params: HttpParams): Observable<T> {
    const cacheKey = `${url}?${params.toString()}`;
    const cached = this.requestCache.get(cacheKey);

    if (cached) {
      return cached as Observable<T>;
    }

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
