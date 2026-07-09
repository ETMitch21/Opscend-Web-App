import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  CreateCustomerDeviceRequest,
  CustomerDevice,
  CustomerDeviceListQuery,
  CustomerDeviceListResponse,
  UpdateCustomerDeviceRequest,
} from './customer-device.model';
import { AppConfigService } from '../app-config/app-config.service';

@Injectable({
  providedIn: 'root',
})
export class CustomerDevicesService {
  private readonly appConfig = inject(AppConfigService);
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${this.apiBase}`;

  private get apiBase(): string {
    return this.appConfig.config.apiBase;
  }

  list(
    customerId: string,
    query: CustomerDeviceListQuery = {}
  ): Observable<CustomerDeviceListResponse> {
    let params = new HttpParams();

    if (query.limit != null) {
      params = params.set('limit', String(query.limit));
    }

    if (query.cursor) {
      params = params.set('cursor', query.cursor);
    }

    const search = this.normalizeSearch(query.search);

    if (search) {
      params = params.set('search', search);
    }

    return this.http.get<CustomerDeviceListResponse>(
      `${this.baseUrl}/customers/${customerId}/devices`,
      { params }
    );
  }

  search(customerId: string, query: string): Observable<CustomerDevice[]> {
    return this.list(customerId, {
      search: this.normalizeSearch(query) ?? undefined,
      limit: 10,
    }).pipe(map((res) => res.data));
  }

  getById(id: string): Observable<CustomerDevice> {
    return this.http.get<CustomerDevice>(`${this.baseUrl}/customer-devices/${id}`);
  }

  create(
    customerId: string,
    payload: CreateCustomerDeviceRequest
  ): Observable<CustomerDevice> {
    return this.http.post<CustomerDevice>(
      `${this.baseUrl}/customers/${customerId}/devices`,
      payload
    );
  }

  update(
    id: string,
    payload: UpdateCustomerDeviceRequest
  ): Observable<CustomerDevice> {
    return this.http.patch<CustomerDevice>(
      `${this.baseUrl}/customer-devices/${id}`,
      payload
    );
  }

  private normalizeSearch(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const search = value.trim();
    return search.length >= 2 ? search : null;
  }
}
