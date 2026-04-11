import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  CreateProductPayload,
  PatchProductPayload,
  Product,
  ProductListParams,
  ProductListResponse,
} from './products-model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class ProductsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBase}/products`;

  getById(productId: string): Observable<Product> {
    return this.http.get<Product>(`${this.baseUrl}/${productId}`);
  }

  list(params?: ProductListParams): Observable<ProductListResponse> {
    let httpParams = new HttpParams();

    if (params?.limit != null) httpParams = httpParams.set('limit', params.limit);
    if (params?.cursor) httpParams = httpParams.set('cursor', params.cursor);
    if (params?.status) httpParams = httpParams.set('status', params.status);
    if (params?.tag) httpParams = httpParams.set('tag', params.tag);
    if (params?.includeDeleted != null) {
      httpParams = httpParams.set('includeDeleted', String(params.includeDeleted));
    }

    return this.http.get<ProductListResponse>(this.baseUrl, { params: httpParams });
  }

  create(payload: CreateProductPayload): Observable<Product> {
    return this.http.post<Product>(this.baseUrl, payload);
  }

  patchProduct(productId: string, payload: PatchProductPayload): Observable<Product> {
    return this.http.patch<Product>(`${this.baseUrl}/${productId}`, payload);
  }

  archive(productId: string): Observable<null> {
    return this.http.delete<null>(`${this.baseUrl}/${productId}`);
  }

  restore(productId: string): Observable<Product> {
    return this.http.post<Product>(`${this.baseUrl}/${productId}/restore`, {});
  }
}