import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';

import { AppConfigService } from '../app-config/app-config.service';
import {
    CreateServicePayload,
    PatchServicePayload,
    Service,
    ServiceListParams,
    ServiceListResponse,
} from './model';

@Injectable({
    providedIn: 'root',
})
export class ServicesService {
    private readonly appConfig = inject(AppConfigService);
    private readonly http = inject(HttpClient);
    private readonly baseUrl = `${this.apiBase}/services`;

    private get apiBase(): string {
        return this.appConfig.config.apiBase;
    }

    list(params?: ServiceListParams): Observable<ServiceListResponse> {
        let httpParams = new HttpParams();

        if (params?.limit != null) {
            httpParams = httpParams.set('limit', String(params.limit));
        }

        if (params?.cursor) {
            httpParams = httpParams.set('cursor', params.cursor);
        }

        if (params?.status) {
            httpParams = httpParams.set('status', params.status);
        }

        if (params?.tag) {
            httpParams = httpParams.set('tag', params.tag);
        }

        if (params?.includeDeleted != null) {
            httpParams = httpParams.set(
                'includeDeleted',
                String(params.includeDeleted)
            );
        }

        return this.http.get<ServiceListResponse>(this.baseUrl, {
            params: httpParams,
        });
    }

    listActive(limit = 100): Observable<Service[]> {
        return this.list({
            limit,
            status: 'active',
            includeDeleted: false,
        }).pipe(map((res) => res.data));
    }

    search(query: string, limit = 20): Observable<Service[]> {
        const normalized = query.trim().toLowerCase();

        return this.list({
            limit: 100,
            status: 'active',
            includeDeleted: false,
        }).pipe(
            map((res) =>
                res.data
                    .filter((service) => {
                        const haystack = [
                            service.name,
                            service.code,
                            ...(service.tags ?? []),
                        ]
                            .filter(Boolean)
                            .join(' ')
                            .toLowerCase();

                        return haystack.includes(normalized);
                    })
                    .slice(0, limit)
            )
        );
    }

    getById(serviceId: string): Observable<Service> {
        return this.http.get<Service>(`${this.baseUrl}/${serviceId}`);
    }

    create(payload: CreateServicePayload): Observable<Service> {
        return this.http.post<Service>(this.baseUrl, payload);
    }

    update(
        serviceId: string,
        payload: PatchServicePayload
    ): Observable<Service> {
        return this.http.patch<Service>(`${this.baseUrl}/${serviceId}`, payload);
    }

    archive(serviceId: string): Observable<null> {
        return this.http.delete<null>(`${this.baseUrl}/${serviceId}`);
    }

    restore(serviceId: string): Observable<Service> {
        return this.http.post<Service>(`${this.baseUrl}/${serviceId}/restore`, {});
    }
}