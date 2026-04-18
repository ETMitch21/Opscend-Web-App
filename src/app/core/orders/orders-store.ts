import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { OrdersService } from './orders-service';
import {
  CreateOrderPayload,
  CreatePaymentPayload,
  CreateRefundPayload,
  CreateStripePaymentIntentPayload,
  CreateStripePaymentIntentResponse,
  CreateStripeRefundPayload,
  Order,
  PatchOrderPayload,
  RecordStripePaymentPayload,
  ReplaceOrderItemsPayload,
} from './orders-model';

@Injectable({
  providedIn: 'root',
})
export class OrdersStore {
  private readonly service = inject(OrdersService);

  readonly selectedOrder = signal<Order | null>(null);
  readonly selectedOrderLoading = signal(false);
  readonly selectedOrderSaving = signal(false);
  readonly selectedOrderError = signal<string | null>(null);

  readonly hasSelectedOrder = computed(() => !!this.selectedOrder());
  readonly orderLockedByMoney = computed(() => {
    const order = this.selectedOrder();
    if (!order) return false;

    return order.totals.paidCents > 0 || order.totals.refundedCents > 0;
  });

  clearSelectedOrder(): void {
    this.selectedOrder.set(null);
  }

  clearError(): void {
    this.selectedOrderError.set(null);
  }

  async loadOrder(orderId: string): Promise<Order | null> {
    this.selectedOrderLoading.set(true);
    this.selectedOrderError.set(null);

    try {
      const order = await firstValueFrom(this.service.getById(orderId));
      this.selectedOrder.set(order);
      return order;
    } catch (error: any) {
      this.selectedOrderError.set(
        error?.error?.message ??
        error?.error?.error ??
        'Unable to load order.'
      );
      return null;
    } finally {
      this.selectedOrderLoading.set(false);
    }
  }

  async createOrder(payload: CreateOrderPayload): Promise<Order | null> {
    this.selectedOrderSaving.set(true);
    this.selectedOrderError.set(null);

    try {
      const order = await firstValueFrom(this.service.create(payload));
      this.selectedOrder.set(order);
      return order;
    } catch (error: any) {
      this.selectedOrderError.set(
        error?.error?.message ??
        error?.error?.error ??
        'Unable to create order.'
      );
      return null;
    } finally {
      this.selectedOrderSaving.set(false);
    }
  }

  async patchOrder(orderId: string, payload: PatchOrderPayload): Promise<Order | null> {
    this.selectedOrderSaving.set(true);
    this.selectedOrderError.set(null);

    try {
      const order = await firstValueFrom(this.service.patchOrder(orderId, payload));
      this.selectedOrder.set(order);
      return order;
    } catch (error: any) {
      this.selectedOrderError.set(
        error?.error?.message ??
        error?.error?.error ??
        'Unable to update order.'
      );
      return null;
    } finally {
      this.selectedOrderSaving.set(false);
    }
  }

  async replaceOrderItems(
    orderId: string,
    payload: ReplaceOrderItemsPayload
  ): Promise<Order | null> {
    this.selectedOrderSaving.set(true);
    this.selectedOrderError.set(null);

    try {
      const order = await firstValueFrom(this.service.replaceItems(orderId, payload));
      this.selectedOrder.set(order);
      return order;
    } catch (error: any) {
      this.selectedOrderError.set(
        error?.error?.message ??
        error?.error?.error ??
        'Unable to save order items.'
      );
      return null;
    } finally {
      this.selectedOrderSaving.set(false);
    }
  }

  async addPayment(orderId: string, payload: CreatePaymentPayload): Promise<Order | null> {
    this.selectedOrderSaving.set(true);
    this.selectedOrderError.set(null);

    try {
      const order = await firstValueFrom(this.service.addPayment(orderId, payload));
      this.selectedOrder.set(order);
      return order;
    } catch (error: any) {
      this.selectedOrderError.set(
        error?.error?.message ??
        error?.error?.error ??
        'Unable to collect payment.'
      );
      return null;
    } finally {
      this.selectedOrderSaving.set(false);
    }
  }

  async addRefund(orderId: string, payload: CreateRefundPayload): Promise<Order | null> {
    this.selectedOrderSaving.set(true);
    this.selectedOrderError.set(null);

    try {
      const order = await firstValueFrom(this.service.addRefund(orderId, payload));
      this.selectedOrder.set(order);
      return order;
    } catch (error: any) {
      this.selectedOrderError.set(
        error?.error?.message ??
        error?.error?.error ??
        'Unable to refund order.'
      );
      return null;
    } finally {
      this.selectedOrderSaving.set(false);
    }
  }

  async createStripePaymentIntent(
    orderId: string,
    payload: CreateStripePaymentIntentPayload
  ): Promise<CreateStripePaymentIntentResponse | null> {
    this.selectedOrderSaving.set(true);
    this.selectedOrderError.set(null);

    try {
      return await firstValueFrom(this.service.createStripePaymentIntent(orderId, payload));
    } catch (error: any) {
      this.selectedOrderError.set(
        error?.error?.message ??
        error?.error?.error ??
        'Unable to start Stripe payment.'
      );
      return null;
    } finally {
      this.selectedOrderSaving.set(false);
    }
  }

  async recordStripePayment(
    orderId: string,
    payload: RecordStripePaymentPayload
  ): Promise<Order | null> {
    this.selectedOrderSaving.set(true);
    this.selectedOrderError.set(null);

    try {
      const order = await firstValueFrom(this.service.recordStripePayment(orderId, payload));
      this.selectedOrder.set(order);
      return order;
    } catch (error: any) {
      this.selectedOrderError.set(
        error?.error?.message ??
        error?.error?.error ??
        'Unable to record Stripe payment.'
      );
      return null;
    } finally {
      this.selectedOrderSaving.set(false);
    }
  }

  async createStripeRefund(
    orderId: string,
    payload: CreateStripeRefundPayload
  ): Promise<Order | null> {
    this.selectedOrderSaving.set(true);
    this.selectedOrderError.set(null);

    try {
      const order = await firstValueFrom(this.service.createStripeRefund(orderId, payload));
      this.selectedOrder.set(order);
      return order;
    } catch (error: any) {
      this.selectedOrderError.set(
        error?.error?.message ??
        error?.error?.error ??
        'Unable to process Stripe refund.'
      );
      return null;
    } finally {
      this.selectedOrderSaving.set(false);
    }
  }

  async voidOrder(orderId: string): Promise<Order | null> {
    this.selectedOrderSaving.set(true);
    this.selectedOrderError.set(null);

    try {
      const order = await firstValueFrom(this.service.voidOrder(orderId));
      this.selectedOrder.set(order);
      return order;
    } catch (error: any) {
      this.selectedOrderError.set(
        error?.error?.message ??
        error?.error?.error ??
        'Unable to void order.'
      );
      return null;
    } finally {
      this.selectedOrderSaving.set(false);
    }
  }
}