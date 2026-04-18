import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  CreateOrderPayload,
  CreatePaymentPayload,
  CreateRefundPayload,
  CreateStripePaymentIntentPayload,
  CreateStripePaymentIntentResponse,
  CreateStripeRefundPayload,
  Order,
  OrderListResponse,
  PatchOrderPayload,
  RecordStripePaymentPayload,
  ReplaceOrderItemsPayload,
} from './orders-model';
import { AppConfigService } from '../app-config/app-config.service';

@Injectable({
  providedIn: 'root',
})
export class OrdersService {
  private readonly appConfig = inject(AppConfigService);
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${this.apiBase}/orders`;

  private get apiBase(): string {
    return this.appConfig.config.apiBase;
  }

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

  createStripePaymentIntent(
    orderId: string,
    payload: CreateStripePaymentIntentPayload
  ): Observable<CreateStripePaymentIntentResponse> {
    return this.http.post<CreateStripePaymentIntentResponse>(
      `${this.baseUrl}/${orderId}/payments/stripe/intent`,
      payload
    );
  }

  recordStripePayment(
    orderId: string,
    payload: RecordStripePaymentPayload
  ): Observable<Order> {
    return this.http.post<Order>(
      `${this.baseUrl}/${orderId}/payments/stripe/record`,
      payload
    );
  }

  createStripeRefund(
    orderId: string,
    payload: CreateStripeRefundPayload
  ): Observable<Order> {
    return this.http.post<Order>(
      `${this.baseUrl}/${orderId}/refunds/stripe`,
      payload
    );
  }

  voidOrder(orderId: string): Observable<Order> {
    return this.http.post<Order>(`${this.baseUrl}/${orderId}/void`, {});
  }
}