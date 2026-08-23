import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AppConfigService } from '../app-config/app-config.service';
import type { PublicBusinessEnrollment, PublicBusinessEnrollmentCatalogBrand, PublicBusinessEnrollmentCatalogCategory, PublicBusinessEnrollmentCatalogModel, PublicBusinessEnrollmentDeviceInput } from './model';

@Injectable({ providedIn: 'root' })
export class BusinessEnrollmentService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(AppConfigService);

  private url(token: string, suffix = ''): string {
    return `${this.config.config.apiBase}/public/business-enrollment/${encodeURIComponent(token)}${suffix}`;
  }

  get(token: string): Observable<PublicBusinessEnrollment> {
    return this.http.get<PublicBusinessEnrollment>(this.url(token));
  }

  sign(token: string, payload: { signerName: string; signerTitle: string; signerEmail: string; signature: string; accepted: true }): Observable<PublicBusinessEnrollment> {
    return this.http.post<PublicBusinessEnrollment>(this.url(token, '/sign'), payload);
  }

  confirmContact(token: string, payload: { name: string; title?: string | null; email: string; phone?: string | null; billingEmail?: string | null; billingPhone?: string | null }): Observable<PublicBusinessEnrollment> {
    return this.http.post<PublicBusinessEnrollment>(this.url(token, '/contact'), payload);
  }

  listDeviceCatalogCategories(token: string): Observable<{ data: PublicBusinessEnrollmentCatalogCategory[] }> {
    return this.http.get<{ data: PublicBusinessEnrollmentCatalogCategory[] }>(this.url(token, '/device-catalog/categories'));
  }

  listDeviceCatalogBrands(token: string, categoryId: string): Observable<{ data: PublicBusinessEnrollmentCatalogBrand[] }> {
    const params = new HttpParams().set('categoryId', categoryId);
    return this.http.get<{ data: PublicBusinessEnrollmentCatalogBrand[] }>(this.url(token, '/device-catalog/brands'), { params });
  }

  listDeviceCatalogModels(token: string, brandId: string, search = ''): Observable<{ data: PublicBusinessEnrollmentCatalogModel[] }> {
    let params = new HttpParams().set('brandId', brandId);
    if (search.trim()) params = params.set('search', search.trim());
    return this.http.get<{ data: PublicBusinessEnrollmentCatalogModel[] }>(this.url(token, '/device-catalog/models'), { params });
  }

  confirmFleet(token: string, payload: { expectedDeviceCount: number; addDevicesLater: boolean; notes?: string | null; devices?: PublicBusinessEnrollmentDeviceInput[] }): Observable<PublicBusinessEnrollment> {
    return this.http.post<PublicBusinessEnrollment>(this.url(token, '/fleet'), payload);
  }

  complete(token: string): Observable<PublicBusinessEnrollment> {
    return this.http.post<PublicBusinessEnrollment>(this.url(token, '/complete'), {});
  }

  agreementUrl(token: string): string {
    return this.url(token, '/agreement');
  }
}
