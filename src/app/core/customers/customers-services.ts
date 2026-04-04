import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CreateCustomerRequest,
  Customer,
  CustomerListQuery,
  CustomerListResponse,
  UpdateCustomerRequest,
} from './customer.model';

@Injectable({
  providedIn: 'root',
})
export class CustomersService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBase}/customers`;

  list(query: CustomerListQuery = {}): Observable<CustomerListResponse> {
    let params = new HttpParams();

    if (query.limit != null) {
      params = params.set('limit', String(query.limit));
    }

    if (query.cursor) {
      params = params.set('cursor', query.cursor);
    }

    if (query.includeDeleted != null) {
      params = params.set('includeDeleted', String(query.includeDeleted));
    }

    if (query.search) {
      params = params.set('search', query.search);
    }

    return this.http.get<CustomerListResponse>(this.baseUrl, { params });
  }

  search(query: string): Observable<Customer[]> {
  const params = new HttpParams()
    .set('search', query)
    .set('limit', '10');

  return this.http
    .get<CustomerListResponse>(this.baseUrl, { params })
    .pipe(map((res) => res.data));
}

  getById(id: string): Observable<Customer> {
    return this.http.get<Customer>(`${this.baseUrl}/${id}`);
  }

  create(payload: CreateCustomerRequest): Observable<Customer> {
    return this.http.post<Customer>(this.baseUrl, payload);
  }

  update(id: string, payload: UpdateCustomerRequest): Observable<Customer> {
    return this.http.patch<Customer>(`${this.baseUrl}/${id}`, payload);
  }

  delete(id: string): Observable<null> {
    return this.http.delete<null>(`${this.baseUrl}/${id}`);
  }

  restore(id: string): Observable<Customer> {
    return this.http.post<Customer>(`${this.baseUrl}/${id}/restore`, null);
  }
}