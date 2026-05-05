import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { AppConfigService } from '../app-config/app-config.service';
import {
    InventoryAdjustPayload,
    InventoryBalance,
    InventoryBalanceListResponse,
    InventoryBalancePatchPayload,
    InventoryListParams,
    InventoryMovementListParams,
    InventoryMovementListResponse,
} from './inventory.model';

@Injectable({
    providedIn: 'root',
})
export class InventoryService {
    private readonly appConfig = inject(AppConfigService);
    private readonly http = inject(HttpClient);
    private readonly baseUrl = `${this.apiBase}/inventory`;

    private get apiBase(): string {
        return this.appConfig.config.apiBase;
    }

    listProducts(params?: InventoryListParams): Observable<InventoryBalanceListResponse> {
        let httpParams = new HttpParams();

        if (params?.limit != null) httpParams = httpParams.set('limit', params.limit);
        if (params?.cursor) httpParams = httpParams.set('cursor', params.cursor);

        if (params?.q) httpParams = httpParams.set('q', params.q);
        if (params?.locationId) httpParams = httpParams.set('locationId', params.locationId);

        if (params?.lowStockOnly != null) {
            httpParams = httpParams.set('lowStockOnly', String(params.lowStockOnly));
        }

        if (params?.outOfStockOnly != null) {
            httpParams = httpParams.set('outOfStockOnly', String(params.outOfStockOnly));
        }

        if (params?.includeInactiveProducts != null) {
            httpParams = httpParams.set(
                'includeInactiveProducts',
                String(params.includeInactiveProducts)
            );
        }

        return this.http.get<InventoryBalanceListResponse>(`${this.baseUrl}/products`, {
            params: httpParams,
        });
    }

    getProductBalance(
        productId: string,
        params?: Pick<InventoryListParams, 'locationId'>
    ): Observable<InventoryBalance> {
        let httpParams = new HttpParams();

        if (params?.locationId) {
            httpParams = httpParams.set('locationId', params.locationId);
        }

        return this.http.get<InventoryBalance>(`${this.baseUrl}/products/${productId}`, {
            params: httpParams,
        });
    }

    updateProductBalance(
        productId: string,
        payload: InventoryBalancePatchPayload
    ): Observable<InventoryBalance> {
        return this.http.patch<InventoryBalance>(
            `${this.baseUrl}/products/${productId}`,
            payload
        );
    }

    adjustProductStock(
        productId: string,
        payload: InventoryAdjustPayload
    ): Observable<InventoryBalance> {
        return this.http.post<InventoryBalance>(
            `${this.baseUrl}/products/${productId}/adjust`,
            payload
        );
    }

    listProductMovements(
        productId: string,
        params?: InventoryMovementListParams
    ): Observable<InventoryMovementListResponse> {
        let httpParams = new HttpParams();

        if (params?.limit != null) httpParams = httpParams.set('limit', params.limit);
        if (params?.cursor) httpParams = httpParams.set('cursor', params.cursor);

        if (params?.locationId) httpParams = httpParams.set('locationId', params.locationId);
        if (params?.type) httpParams = httpParams.set('type', params.type);

        return this.http.get<InventoryMovementListResponse>(
            `${this.baseUrl}/products/${productId}/movements`,
            {
                params: httpParams,
            }
        );
    }
}