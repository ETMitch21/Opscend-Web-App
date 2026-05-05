import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { AppConfigService } from '../app-config/app-config.service';
import {
    CreateSupplierPayload,
    PatchSupplierPayload,
    Supplier,
    SupplierListParams,
    SupplierListResponse,
} from './suppliers.model';

@Injectable({
    providedIn: 'root',
})
export class SupplierService {
    private readonly appConfig = inject(AppConfigService);
    private readonly http = inject(HttpClient);
    private readonly baseUrl = `${this.apiBase}/suppliers`;

    private get apiBase(): string {
        return this.appConfig.config.apiBase;
    }

    listSuppliers(params?: SupplierListParams): Observable<SupplierListResponse> {
        let httpParams = new HttpParams();

        if (params?.limit != null) httpParams = httpParams.set('limit', params.limit);
        if (params?.cursor) httpParams = httpParams.set('cursor', params.cursor);

        if (params?.q) httpParams = httpParams.set('q', params.q);
        if (params?.provider) httpParams = httpParams.set('provider', params.provider);
        if (params?.status) httpParams = httpParams.set('status', params.status);

        if (params?.includeDeleted != null) {
            httpParams = httpParams.set('includeDeleted', String(params.includeDeleted));
        }

        return this.http.get<SupplierListResponse>(this.baseUrl, {
            params: httpParams,
        });
    }

    getSupplier(id: string): Observable<Supplier> {
        return this.http.get<Supplier>(`${this.baseUrl}/${id}`);
    }

    createSupplier(payload: CreateSupplierPayload): Observable<Supplier> {
        return this.http.post<Supplier>(this.baseUrl, payload);
    }

    updateSupplier(id: string, payload: PatchSupplierPayload): Observable<Supplier> {
        return this.http.patch<Supplier>(`${this.baseUrl}/${id}`, payload);
    }

    archiveSupplier(id: string): Observable<void> {
        return this.http.delete<void>(`${this.baseUrl}/${id}`);
    }

    restoreSupplier(id: string): Observable<Supplier> {
        return this.http.post<Supplier>(`${this.baseUrl}/${id}/restore`, {});
    }
}