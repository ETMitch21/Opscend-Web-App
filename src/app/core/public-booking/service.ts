import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { AppConfigService } from '../app-config/app-config.service';
import {
    PublicAvailabilityQuery,
    PublicAvailabilityResponse,
    PublicBookingPage,
    PublicBookingSettings,
    PublicDeviceModelOption,
    PublicQuoteApproval,
    PublicQuoteApprovalActionResponse,
    PublicQuoteRequest,
    PublicQuoteRequestBody,
    PublicQuoteRequestResponse,
    PublicRepairNeedsResponse,
    PublicRepairQuote,
    PublicScheduleRequest,
    PublicScheduleResponse,
} from './model';

@Injectable({
    providedIn: 'root',
})
export class PublicBookingService {
    private readonly appConfig = inject(AppConfigService);
    private readonly http = inject(HttpClient);

    private get apiBase(): string {
        return this.appConfig.config.apiBase;
    }

    private baseUrl(shopSlug: string): string {
        return `${this.apiBase}/public/shops/${encodeURIComponent(shopSlug)}/booking`;
    }

    private publicQuoteUrl(token: string): string {
        return `${this.apiBase}/public/quotes/${encodeURIComponent(token)}`;
    }

    getSettings(shopSlug: string): Observable<PublicBookingSettings> {
        return this.http.get<PublicBookingSettings>(
            `${this.baseUrl(shopSlug)}/settings`
        );
    }

    listCategories(
        shopSlug: string,
        page = 0,
        size = 50
    ): Observable<PublicBookingPage<string>> {
        const params = new HttpParams()
            .set('page', String(page))
            .set('size', String(size));

        return this.http.get<PublicBookingPage<string>>(
            `${this.baseUrl(shopSlug)}/categories`,
            { params }
        );
    }

    listBrands(
        shopSlug: string,
        category: string,
        page = 0,
        size = 50
    ): Observable<PublicBookingPage<string>> {
        const params = new HttpParams()
            .set('category', category)
            .set('page', String(page))
            .set('size', String(size));

        return this.http.get<PublicBookingPage<string>>(
            `${this.baseUrl(shopSlug)}/brands`,
            { params }
        );
    }

    listModels(
        shopSlug: string,
        paramsInput: {
            category: string;
            brand: string;
            page?: number;
            size?: number;
            search?: string;
            keepCasing?: boolean;
        }
    ): Observable<PublicBookingPage<PublicDeviceModelOption>> {
        let params = new HttpParams()
            .set('category', paramsInput.category)
            .set('brand', paramsInput.brand)
            .set('page', String(paramsInput.page ?? 0))
            .set('size', String(paramsInput.size ?? 100));

        if (paramsInput.search) {
            params = params.set('search', paramsInput.search);
        }

        if (paramsInput.keepCasing != null) {
            params = params.set('keepCasing', String(paramsInput.keepCasing));
        }

        return this.http.get<PublicBookingPage<PublicDeviceModelOption>>(
            `${this.baseUrl(shopSlug)}/models`,
            { params }
        );
    }

    listRepairNeeds(shopSlug: string): Observable<PublicRepairNeedsResponse> {
        return this.http.get<PublicRepairNeedsResponse>(
            `${this.baseUrl(shopSlug)}/repair-needs`
        );
    }

    createQuote(
        shopSlug: string,
        payload: PublicQuoteRequest
    ): Observable<PublicRepairQuote> {
        return this.http.post<PublicRepairQuote>(
            `${this.baseUrl(shopSlug)}/quote`,
            payload
        );
    }

    getAvailability(
        shopSlug: string,
        query: PublicAvailabilityQuery
    ): Observable<PublicAvailabilityResponse> {
        let params = new HttpParams().set('quoteId', query.quoteId);

        if (query.days != null) {
            params = params.set('days', String(query.days));
        }

        if (query.slotMinutes != null) {
            params = params.set('slotMinutes', String(query.slotMinutes));
        }

        return this.http.get<PublicAvailabilityResponse>(
            `${this.baseUrl(shopSlug)}/availability`,
            { params }
        );
    }

    schedule(
        shopSlug: string,
        payload: PublicScheduleRequest
    ): Observable<PublicScheduleResponse> {
        return this.http.post<PublicScheduleResponse>(
            `${this.baseUrl(shopSlug)}/schedule`,
            payload
        );
    }

    submitQuoteRequest(
        shopSlug: string,
        body: PublicQuoteRequestBody
    ): Observable<PublicQuoteRequestResponse> {
        return this.http.post<PublicQuoteRequestResponse>(
            `${this.baseUrl(shopSlug)}/quote-request`,
            body
        );
    }

    getPublicQuote(token: string): Observable<PublicQuoteApproval> {
        return this.http.get<PublicQuoteApproval>(this.publicQuoteUrl(token));
    }

    acceptPublicQuote(token: string): Observable<PublicQuoteApprovalActionResponse> {
        return this.http.post<PublicQuoteApprovalActionResponse>(
            `${this.publicQuoteUrl(token)}/accept`,
            {}
        );
    }

    declinePublicQuote(token: string): Observable<PublicQuoteApprovalActionResponse> {
        return this.http.post<PublicQuoteApprovalActionResponse>(
            `${this.publicQuoteUrl(token)}/decline`,
            {}
        );
    }
}