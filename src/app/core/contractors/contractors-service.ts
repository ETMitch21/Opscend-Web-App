import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { AppConfigService } from '../app-config/app-config.service';
import {
    AddContractorCapabilityRequest,
    ContractorListQuery,
    ContractorListResponse,
    ContractorProfile,
    CreateContractorWithUserRequest,
    UpdateContractorRequest,
} from './contractor.model';

@Injectable({
    providedIn: 'root',
})
export class ContractorsService {
    private readonly appConfig = inject(AppConfigService);
    private readonly http = inject(HttpClient);
    private readonly baseUrl = `${this.apiBase}/contractors`;

    private get apiBase(): string {
        return this.appConfig.config.apiBase;
    }

    list(query: ContractorListQuery = {}): Observable<ContractorListResponse> {
        let params = new HttpParams();

        if (query.limit != null) {
            params = params.set('limit', String(query.limit));
        }

        if (query.cursor) {
            params = params.set('cursor', query.cursor);
        }

        if (query.search) {
            params = params.set('search', query.search);
        }

        if (query.isActive != null) {
            params = params.set('isActive', String(query.isActive));
        }

        if (query.tier) {
            params = params.set('tier', query.tier);
        }

        return this.http.get<ContractorListResponse>(this.baseUrl, { params });
    }

    getById(id: string): Observable<ContractorProfile> {
        return this.http.get<ContractorProfile>(`${this.baseUrl}/${id}`);
    }

    createWithUser(
        payload: CreateContractorWithUserRequest
    ): Observable<ContractorProfile> {
        return this.http.post<ContractorProfile>(
            `${this.baseUrl}/create-with-user`,
            payload
        );
    }

    update(
        id: string,
        payload: UpdateContractorRequest
    ): Observable<ContractorProfile> {
        return this.http.patch<ContractorProfile>(`${this.baseUrl}/${id}`, payload);
    }

    activate(id: string): Observable<ContractorProfile> {
        return this.http.patch<ContractorProfile>(
            `${this.baseUrl}/${id}/activate`,
            {}
        );
    }

    deactivate(id: string): Observable<ContractorProfile> {
        return this.http.patch<ContractorProfile>(
            `${this.baseUrl}/${id}/deactivate`,
            {}
        );
    }

    addCapability(
        contractorId: string,
        payload: AddContractorCapabilityRequest
    ): Observable<ContractorProfile> {
        return this.http.post<ContractorProfile>(
            `${this.baseUrl}/${contractorId}/capabilities`,
            payload
        );
    }

    removeCapability(
        contractorId: string,
        serviceId: string
    ): Observable<ContractorProfile> {
        return this.http.delete<ContractorProfile>(
            `${this.baseUrl}/${contractorId}/capabilities/${serviceId}`
        );
    }
}