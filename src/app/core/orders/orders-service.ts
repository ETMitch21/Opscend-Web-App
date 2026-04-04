import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  CreateOrderPayload,
  CreatePaymentPayload,
  CreateRefundPayload,
  Order,
  OrderListResponse,
  PatchOrderPayload,
  ReplaceOrderItemsPayload,
} from './orders-model';

@Injectable({
  providedIn: 'root',
})
export class OrdersService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/v1/orders';

  getById(orderId: string): Observable<Order> {
    return this.http.get<Order>(`${this.baseUrl}/${orderId}`);
  }

  list(params?: {
    limit?: number;
    cursor?: string | null;
    paymentStatus?: string;
    fulfillmentStatus?: string;
    tag?: string;
  }): Observable<OrderListResponse> {
    let httpParams = new HttpParams();

    if (params?.limit != null) httpParams = httpParams.set('limit', params.limit);
    if (params?.cursor) httpParams = httpParams.set('cursor', params.cursor);
    if (params?.paymentStatus) httpParams = httpParams.set('paymentStatus', params.paymentStatus);
    if (params?.fulfillmentStatus) httpParams = httpParams.set('fulfillmentStatus', params.fulfillmentStatus);
    if (params?.tag) httpParams = httpParams.set('tag', params.tag);

    return this.http.get<OrderListResponse>(this.baseUrl, { params: httpParams });
  }

  create(payload: CreateOrderPayload): Observable<Order> {
    return this.http.post<Order>(this.baseUrl, payload);
  }

  patchOrder(orderId: string, payload: PatchOrderPayload): Observable<Order> {
    return this.http.patch<Order>(`${this.baseUrl}/${orderId}`, payload);
  }

  replaceItems(orderId: string, payload: ReplaceOrderItemsPayload): Observable<Order> {
    return this.http.patch<Order>(`${this.baseUrl}/${orderId}/items`, payload);
  }

  addPayment(orderId: string, payload: CreatePaymentPayload): Observable<Order> {
    return this.http.post<Order>(`${this.baseUrl}/${orderId}/payments`, payload);
  }

  addRefund(orderId: string, payload: CreateRefundPayload): Observable<Order> {
    return this.http.post<Order>(`${this.baseUrl}/${orderId}/refunds`, payload);
  }

  voidOrder(orderId: string): Observable<Order> {
    return this.http.post<Order>(`${this.baseUrl}/${orderId}/void`, {});
  }
}