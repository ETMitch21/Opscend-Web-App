import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import {
  CreateCustomerAddressRequest,
  CreateCustomerRequest,
  Customer,
  CustomerAddress,
  CustomerAddressListResponse,
  CustomerListQuery,
  CustomerListResponse,
  UpdateCustomerAddressRequest,
  UpdateCustomerRequest,
} from './customer.model';
import { AppConfigService } from '../app-config/app-config.service';

@Injectable({
  providedIn: 'root',
})
export class CustomersService {
  private readonly appConfig = inject(AppConfigService);
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${this.apiBase}/customers`;

  private get apiBase(): string {
    return this.appConfig.config.apiBase;
  }

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

  listAddresses(customerId: string): Observable<CustomerAddress[]> {
    return this.http
      .get<CustomerAddressListResponse>(`${this.baseUrl}/${customerId}/addresses`)
      .pipe(map((res) => res.data));
  }

  createAddress(
    customerId: string,
    payload: CreateCustomerAddressRequest
  ): Observable<CustomerAddress> {
    return this.http.post<CustomerAddress>(
      `${this.baseUrl}/${customerId}/addresses`,
      payload
    );
  }

  updateAddress(
    customerId: string,
    addressId: string,
    payload: UpdateCustomerAddressRequest
  ): Observable<CustomerAddress> {
    return this.http.patch<CustomerAddress>(
      `${this.baseUrl}/${customerId}/addresses/${addressId}`,
      payload
    );
  }

  setDefaultAddress(customerId: string, addressId: string): Observable<CustomerAddress> {
    return this.http.post<CustomerAddress>(
      `${this.baseUrl}/${customerId}/addresses/${addressId}/default`,
      null
    );
  }

  deleteAddress(customerId: string, addressId: string): Observable<null> {
    return this.http.delete<null>(
      `${this.baseUrl}/${customerId}/addresses/${addressId}`
    );
  }
}