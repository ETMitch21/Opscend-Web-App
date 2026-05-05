import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { AppConfigService } from '../app-config/app-config.service';
import {
    CancelPurchaseOrderPayload,
    CreatePurchaseOrderItemPayload,
    CreatePurchaseOrderPayload,
    PatchPurchaseOrderItemPayload,
    PatchPurchaseOrderPayload,
    PurchaseOrder,
    PurchaseOrderListParams,
    PurchaseOrderListResponse,
    ReceivePurchaseOrderPayload,
    SubmitPurchaseOrderPayload,
} from './purchase-orders.model';

@Injectable({
    providedIn: 'root',
})
export class PurchaseOrderService {
    private readonly appConfig = inject(AppConfigService);
    private readonly http = inject(HttpClient);
    private readonly baseUrl = `${this.apiBase}/purchase-orders`;

    private get apiBase(): string {
        return this.appConfig.config.apiBase;
    }

    listPurchaseOrders(params?: PurchaseOrderListParams): Observable<PurchaseOrderListResponse> {
        let httpParams = new HttpParams();

        if (params?.limit != null) httpParams = httpParams.set('limit', params.limit);
        if (params?.cursor) httpParams = httpParams.set('cursor', params.cursor);

        if (params?.q) httpParams = httpParams.set('q', params.q);
        if (params?.supplierId) httpParams = httpParams.set('supplierId', params.supplierId);
        if (params?.status) httpParams = httpParams.set('status', params.status);

        if (params?.includeItems != null) {
            httpParams = httpParams.set('includeItems', String(params.includeItems));
        }

        return this.http.get<PurchaseOrderListResponse>(this.baseUrl, {
            params: httpParams,
        });
    }

    getPurchaseOrder(id: string): Observable<PurchaseOrder> {
        return this.http.get<PurchaseOrder>(`${this.baseUrl}/${id}`);
    }

    createPurchaseOrder(payload: CreatePurchaseOrderPayload): Observable<PurchaseOrder> {
        return this.http.post<PurchaseOrder>(this.baseUrl, payload);
    }

    updatePurchaseOrder(
        id: string,
        payload: PatchPurchaseOrderPayload
    ): Observable<PurchaseOrder> {
        return this.http.patch<PurchaseOrder>(`${this.baseUrl}/${id}`, payload);
    }

    addPurchaseOrderItem(
        id: string,
        payload: CreatePurchaseOrderItemPayload
    ): Observable<PurchaseOrder> {
        return this.http.post<PurchaseOrder>(`${this.baseUrl}/${id}/items`, payload);
    }

    updatePurchaseOrderItem(
        id: string,
        itemId: string,
        payload: PatchPurchaseOrderItemPayload
    ): Observable<PurchaseOrder> {
        return this.http.patch<PurchaseOrder>(
            `${this.baseUrl}/${id}/items/${itemId}`,
            payload
        );
    }

    deletePurchaseOrderItem(id: string, itemId: string): Observable<PurchaseOrder> {
        return this.http.delete<PurchaseOrder>(`${this.baseUrl}/${id}/items/${itemId}`);
    }

    submitPurchaseOrder(
        id: string,
        payload?: SubmitPurchaseOrderPayload
    ): Observable<PurchaseOrder> {
        return this.http.post<PurchaseOrder>(`${this.baseUrl}/${id}/submit`, payload ?? {});
    }

    cancelPurchaseOrder(
        id: string,
        payload?: CancelPurchaseOrderPayload
    ): Observable<PurchaseOrder> {
        return this.http.post<PurchaseOrder>(`${this.baseUrl}/${id}/cancel`, payload ?? {});
    }

    receivePurchaseOrder(
        id: string,
        payload: ReceivePurchaseOrderPayload
    ): Observable<PurchaseOrder> {
        return this.http.post<PurchaseOrder>(`${this.baseUrl}/${id}/receive`, payload);
    }
}