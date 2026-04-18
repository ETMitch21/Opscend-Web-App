import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import {
  FormArray,
  FormControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import {
  BadgeDollarSign,
  CreditCard,
  FilePlus2,
  LoaderCircle,
  LucideAngularModule,
  Package2,
  Pencil,
  Plus,
  ReceiptText,
  RotateCcw,
  Save,
  Search,
  Trash2,
  Wallet,
  XCircle,
} from 'lucide-angular';
import type { StripeCardElement, StripeElements } from '@stripe/stripe-js';

import { OrdersStore } from '../../../../core/orders/orders-store';
import {
  CreateOrderItemPayload,
  Order,
  OrderItemType,
  PaymentMethod,
} from '../../../../core/orders/orders-model';
import { ProductsStore } from '../../../../core/products/products-store';
import { StripeService } from '../../../../core/stripe/stripe-service';
import type { StripeStatusResponse } from '../../../../core/stripe/stripe-model';
import { ToastService } from '../../../../core/toast/toast-service';

type CatalogItemType = OrderItemType;

interface CatalogItemOption {
  id: string;
  type: CatalogItemType;
  name: string;
  description?: string | null;
  priceCents?: number | null;
}

@Component({
  selector: 'app-repair-order-card',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, LucideAngularModule],
  templateUrl: './repair-order-card.html',
})
export class RepairOrderCard {
  readonly repairId = input.required<string>();
  readonly orderId = input<string | null>(null);
  readonly customerId = input<string | null>(null);
  readonly disabled = input(false);

  readonly createRequested = output<void>();

  private readonly fb = inject(NonNullableFormBuilder);
  readonly ordersStore = inject(OrdersStore);
  readonly productsStore = inject(ProductsStore);
  private readonly stripeService = inject(StripeService);
  private readonly toast = inject(ToastService);

  readonly stripeCardHost = viewChild<ElementRef<HTMLDivElement>>('stripeCardHost');

  private stripeElements: StripeElements | null = null;
  private cardElement: StripeCardElement | null = null;
  private stripeCardMounted = false;

  readonly loadingStripeStatus = signal(false);
  readonly stripeStatus = signal<StripeStatusResponse | null>(null);
  readonly initializingStripePayment = signal(false);

  readonly showPaymentForm = signal(false);
  readonly showRefundForm = signal(false);
  readonly searchFocused = signal(false);
  readonly expandedItemIndex = signal<number | null>(null);

  readonly paymentMethod = signal<PaymentMethod>('card');
  readonly refundMethod = signal<PaymentMethod>('card');

  readonly icons = {
    FilePlus2,
    ReceiptText,
    BadgeDollarSign,
    Save,
    Trash2,
    Wallet,
    CreditCard,
    RotateCcw,
    XCircle,
    LoaderCircle,
    Package2,
    Search,
    Plus,
    Pencil,
  };

  readonly order = this.ordersStore.selectedOrder;
  readonly loading = this.ordersStore.selectedOrderLoading;
  readonly saving = this.ordersStore.selectedOrderSaving;
  readonly error = this.ordersStore.selectedOrderError;
  readonly moneyLocked = this.ordersStore.orderLockedByMoney;

  readonly stripeAvailable = computed(() => {
    const status = this.stripeStatus();
    return !!status?.connected && !!status?.chargesEnabled && !!status?.accountId;
  });

  readonly stripeConnectedButNotReady = computed(() => {
    const status = this.stripeStatus();
    return !!status?.connected && !status?.chargesEnabled;
  });

  readonly products = computed<CatalogItemOption[]>(() =>
    this.productsStore.activeProducts().map((product) => ({
      id: product.id,
      type: 'product',
      name: product.name,
      description: product.sku ? `Product SKU: ${product.sku}` : null,
      priceCents: Number(product.price ?? 0),
    }))
  );

  readonly services = computed<CatalogItemOption[]>(() => []);

  readonly itemSearchControl = new FormControl('', { nonNullable: true });

  readonly itemsForm = this.fb.group({
    discountDollars: this.fb.control(0, [Validators.min(0)]),
    items: this.fb.array([]),
  });

  readonly paymentForm = this.fb.group({
    amountDollars: this.fb.control(0, [Validators.required, Validators.min(0.01)]),
    method: this.fb.control<PaymentMethod>('card', [Validators.required]),
    reference: this.fb.control(''),
    note: this.fb.control(''),
  });

  readonly refundForm = this.fb.group({
    amountDollars: this.fb.control(0, [Validators.required, Validators.min(0.01)]),
    method: this.fb.control<PaymentMethod>('card', [Validators.required]),
    reference: this.fb.control(''),
    note: this.fb.control(''),
  });

  readonly itemsArray = computed(() => this.itemsForm.controls.items as FormArray);

  readonly catalogItems = computed(() => [...this.products(), ...this.services()]);

  readonly filteredCatalogItems = computed(() => {
    const query = this.itemSearchControl.value.trim().toLowerCase();
    const items = this.catalogItems();

    if (!query) return items.slice(0, 8);

    return items
      .filter((item) => {
        const name = item.name.toLowerCase();
        const description = (item.description ?? '').toLowerCase();
        return name.includes(query) || description.includes(query);
      })
      .slice(0, 8);
  });

  readonly draftSubtotalCents = computed(() => {
    const rows = this.itemRowsRawValue();
    return rows.reduce((sum, row) => {
      const quantity = Number(row.quantity ?? 0);
      const unitPriceCents = this.toCents(row.unitPriceDollars ?? 0);
      return sum + Math.max(0, quantity) * Math.max(0, unitPriceCents);
    }, 0);
  });

  readonly draftDiscountCents = computed(() => {
    const subtotal = this.draftSubtotalCents();
    const discount = this.toCents(this.itemsForm.controls.discountDollars.value ?? 0);
    return Math.min(Math.max(0, discount), subtotal);
  });

  readonly draftTotalCents = computed(() =>
    Math.max(0, this.draftSubtotalCents() - this.draftDiscountCents())
  );

  constructor() {
    effect(() => {
      const orderId = this.orderId();
      if (orderId) {
        void this.ordersStore.loadOrder(orderId);
      } else {
        this.ordersStore.clearSelectedOrder();
        this.resetItemsForm();
      }
    });

    effect(() => {
      const order = this.order();
      if (order) {
        this.syncItemsFormFromOrder(order);
      } else {
        this.resetItemsForm();
      }
    });

    this.paymentForm.controls.method.valueChanges.subscribe((value) => {
      const method = (value ?? 'card') as PaymentMethod;
      this.paymentMethod.set(method);

      if (method === 'stripe') {
        if (!this.stripeAvailable()) {
          this.paymentForm.patchValue({ method: 'card' }, { emitEvent: false });
          this.paymentMethod.set('card');
          this.toast.error('Stripe unavailable', 'Stripe is not connected and ready for this shop.');
          return;
        }

        if (this.showPaymentForm()) {
          setTimeout(() => {
            void this.ensureStripeCardElementReady();
          }, 0);
        }
      } else {
        this.destroyStripeCardElement();
      }
    });

    this.refundForm.controls.method.valueChanges.subscribe((value) => {
      const method = (value ?? 'card') as PaymentMethod;
      this.refundMethod.set(method);

      if (method === 'stripe' && !this.stripeAvailable()) {
        this.refundForm.patchValue({ method: 'card' }, { emitEvent: false });
        this.refundMethod.set('card');
        this.toast.error('Stripe unavailable', 'Stripe is not connected and ready for this shop.');
      }
    });

    void this.loadStripeStatus();
  }

  async loadStripeStatus(): Promise<void> {
    this.loadingStripeStatus.set(true);
    try {
      const status = await firstValueFrom(this.stripeService.getStatus());
      this.stripeStatus.set(status ?? null);
    } catch {
      this.stripeStatus.set(null);
    } finally {
      this.loadingStripeStatus.set(false);
    }
  }

  async createOrder(): Promise<void> {
    this.createRequested.emit();
  }

  addCatalogItem(item: CatalogItemOption): void {
    const existingIndex = this.itemRowsRawValue().findIndex(
      (row) =>
        row.name.trim().toLowerCase() === item.name.trim().toLowerCase() &&
        row.type === item.type &&
        (row.sourceId ?? null) === item.id
    );

    if (existingIndex >= 0) {
      const control = this.itemsArray().at(existingIndex);
      const quantity = Number(control.get('quantity')?.value ?? 1);
      control.patchValue({ quantity: quantity + 1 });
      this.expandedItemIndex.set(existingIndex);
    } else {
      this.itemsArray().push(
        this.createItemGroup({
          type: item.type,
          name: item.name,
          quantity: 1,
          unitPriceDollars: (item.priceCents ?? 0) / 100,
          notes: '',
          sourceId: item.id,
        })
      );
      this.expandedItemIndex.set(this.itemsArray().length - 1);
    }

    this.itemSearchControl.setValue('', { emitEvent: true });
    this.searchFocused.set(false);
  }

  addCustomItem(): void {
    this.itemsArray().push(
      this.createItemGroup({
        type: 'service',
        quantity: 1,
        unitPriceDollars: 0,
        notes: '',
        sourceId: null,
      })
    );
    this.expandedItemIndex.set(this.itemsArray().length - 1);
  }

  removeItem(index: number): void {
    this.itemsArray().removeAt(index);
    if (this.expandedItemIndex() === index) {
      this.expandedItemIndex.set(null);
    }
  }

  toggleExpandedItem(index: number): void {
    this.expandedItemIndex.set(this.expandedItemIndex() === index ? null : index);
  }

  onSearchFocus(): void {
    this.searchFocused.set(true);
  }

  onSearchBlur(): void {
    setTimeout(() => this.searchFocused.set(false), 150);
  }

  async saveItems(): Promise<void> {
    const order = this.order();
    if (!order) return;

    if (this.itemsForm.invalid) {
      this.itemsForm.markAllAsTouched();
      return;
    }

    const payloadItems: CreateOrderItemPayload[] = this.itemRowsRawValue().map((row) => ({
      type: row.type,
      name: String(row.name ?? '').trim(),
      quantity: Number(row.quantity ?? 1),
      unitPriceCents: this.toCents(row.unitPriceDollars ?? 0),
      notes: String(row.notes ?? '').trim() || null,
      sku: null,
    }));

    const updated = await this.ordersStore.replaceOrderItems(order.id, {
      items: payloadItems,
      discountCents: this.toCents(this.itemsForm.controls.discountDollars.value ?? 0),
    });

    if (updated) {
      this.toast.success('Order saved', 'Line items updated.');
      this.expandedItemIndex.set(null);
    } else {
      this.toast.error('Save failed', this.error() ?? 'Unable to save line items.');
    }
  }

  async collectPayment(): Promise<void> {
    const order = this.order();
    if (!order) return;

    if (this.paymentForm.invalid) {
      this.paymentForm.markAllAsTouched();
      return;
    }

    const value = this.paymentForm.getRawValue();
    const amountCents = this.toCents(value.amountDollars);

    if (value.method === 'stripe') {
      await this.collectStripePayment(order.id, amountCents);
      return;
    }

    const updated = await this.ordersStore.addPayment(order.id, {
      amountCents,
      method: value.method,
      reference: value.reference.trim() || null,
      note: value.note.trim() || null,
    });

    if (updated) {
      this.paymentForm.patchValue({
        amountDollars: 0,
        method: this.stripeAvailable() ? 'stripe' : 'card',
        reference: '',
        note: '',
      });
      this.paymentMethod.set(this.stripeAvailable() ? 'stripe' : 'card');
      this.closePaymentModal();
      this.toast.success('Payment added', 'Order payment recorded.');
    } else {
      this.toast.error('Payment failed', this.error() ?? 'Unable to collect payment.');
    }
  }

  async refund(): Promise<void> {
    const order = this.order();
    if (!order) return;

    if (this.refundForm.invalid) {
      this.refundForm.markAllAsTouched();
      return;
    }

    const value = this.refundForm.getRawValue();
    const amountCents = this.toCents(value.amountDollars);

    if (value.method === 'stripe') {
      if (!this.stripeAvailable()) {
        this.toast.error('Stripe unavailable', 'Stripe is not connected and ready for this shop.');
        return;
      }

      const updated = await this.ordersStore.createStripeRefund(order.id, {
        amountCents,
        reason: 'requested_by_customer',
      });

      if (updated) {
        this.refundForm.patchValue({
          amountDollars: 0,
          method: this.stripeAvailable() ? 'stripe' : 'card',
          reference: '',
          note: '',
        });
        this.refundMethod.set(this.stripeAvailable() ? 'stripe' : 'card');
        this.closeRefundModal();
        this.toast.success('Refund processed', 'Stripe refund recorded on order.');
      } else {
        this.toast.error('Refund failed', this.error() ?? 'Unable to process Stripe refund.');
      }

      return;
    }

    const updated = await this.ordersStore.addRefund(order.id, {
      amountCents,
      method: value.method,
      reference: value.reference.trim() || null,
      note: value.note.trim() || null,
    });

    if (updated) {
      this.refundForm.patchValue({
        amountDollars: 0,
        method: this.stripeAvailable() ? 'stripe' : 'card',
        reference: '',
        note: '',
      });
      this.refundMethod.set(this.stripeAvailable() ? 'stripe' : 'card');
      this.closeRefundModal();
      this.toast.success('Refund added', 'Refund recorded on order.');
    } else {
      this.toast.error('Refund failed', this.error() ?? 'Unable to refund order.');
    }
  }

  async voidOrder(): Promise<void> {
    const order = this.order();
    if (!order) return;

    const updated = await this.ordersStore.voidOrder(order.id);

    if (updated) {
      this.toast.success('Order voided', `${updated.orderNumber} was voided.`);
    } else {
      this.toast.error('Void failed', this.error() ?? 'Unable to void order.');
    }
  }

  canVoid(): boolean {
    const order = this.order();
    if (!order) return false;

    return (
      order.totals.paidCents === 0 &&
      order.totals.refundedCents === 0 &&
      order.paymentStatus !== 'voided'
    );
  }

  money(valueCents: number | null | undefined): string {
    const cents = valueCents ?? 0;
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  }

  formatDate(value: string | null | undefined): string {
    if (!value) return '—';
    return new Date(value).toLocaleString();
  }

  lineTotal(index: number): string {
    const control = this.itemsArray().at(index);
    const quantity = Number(control.get('quantity')?.value ?? 0);
    const dollars = Number(control.get('unitPriceDollars')?.value ?? 0);
    return this.money(quantity * this.toCents(dollars));
  }

  toCents(value: number | string | null | undefined): number {
    const numeric = Number(value ?? 0);
    if (!Number.isFinite(numeric)) return 0;
    return Math.round(numeric * 100);
  }

  statusClasses(status: string): string {
    if (status === 'paid' || status === 'fulfilled') {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }

    if (status === 'unpaid' || status === 'unfulfilled') {
      return 'bg-amber-50 text-amber-700 border-amber-200';
    }

    if (status === 'refunded') {
      return 'bg-blue-50 text-blue-700 border-blue-200';
    }

    if (status === 'voided') {
      return 'bg-rose-50 text-rose-700 border-rose-200';
    }

    return 'bg-gray-50 text-gray-700 border-gray-200';
  }

  paymentTypeClasses(type: string): string {
    return type === 'refund'
      ? 'bg-rose-50 text-rose-700 border-rose-200'
      : 'bg-emerald-50 text-emerald-700 border-emerald-200';
  }

  trackCatalogItem(_: number, item: CatalogItemOption): string {
    return `${item.type}-${item.id}`;
  }

  openPaymentModal(): void {
    const order = this.order();
    const defaultMethod: PaymentMethod = this.stripeAvailable() ? 'stripe' : 'card';

    this.showRefundForm.set(false);
    this.paymentForm.patchValue({
      amountDollars: order ? Math.max(0, order.totals.balanceCents) / 100 : 0,
      method: defaultMethod,
      reference: '',
      note: '',
    });
    this.paymentMethod.set(defaultMethod);
    this.showPaymentForm.set(true);

    if (defaultMethod === 'stripe') {
      setTimeout(() => {
        void this.ensureStripeCardElementReady();
      }, 0);
    }
  }

  closePaymentModal(): void {
    this.showPaymentForm.set(false);
    this.destroyStripeCardElement();
  }

  openRefundModal(): void {
    const order = this.order();
    const refundable = order
      ? Math.max(0, (order.totals.paidCents ?? 0) - (order.totals.refundedCents ?? 0))
      : 0;
    const defaultMethod: PaymentMethod = this.stripeAvailable() ? 'stripe' : 'card';

    this.showPaymentForm.set(false);
    this.refundForm.patchValue({
      amountDollars: refundable / 100,
      method: defaultMethod,
      reference: '',
      note: '',
    });
    this.refundMethod.set(defaultMethod);
    this.showRefundForm.set(true);
  }

  closeRefundModal(): void {
    this.showRefundForm.set(false);
  }

  private async collectStripePayment(orderId: string, amountCents: number): Promise<void> {
    const order = this.order();
    const stripeAccountId = this.stripeStatus()?.accountId;

    if (!order || !stripeAccountId) return;

    if (!this.stripeAvailable()) {
      this.toast.error('Stripe unavailable', 'Stripe is not connected and ready for this shop.');
      return;
    }

    const ready = await this.ensureStripeCardElementReady();
    if (!ready || !this.cardElement) {
      this.toast.error('Payment failed', 'Unable to load secure card form.');
      return;
    }

    const intent = await this.ordersStore.createStripePaymentIntent(orderId, {
      amountCents,
      description: `Payment for order ${order.orderNumber}`,
    });

    if (!intent?.clientSecret) {
      this.toast.error('Payment failed', this.error() ?? 'Unable to start Stripe payment.');
      return;
    }

    const confirm = await this.stripeService.confirmCardPayment({
      stripeAccountId,
      clientSecret: intent.clientSecret,
      card: this.cardElement,
    });

    if (confirm.error) {
      this.toast.error('Payment failed', confirm.error.message ?? 'Stripe payment failed.');
      return;
    }

    const paymentIntentId = confirm.paymentIntent?.id ?? intent.paymentIntentId;

    if (!paymentIntentId) {
      this.toast.error('Payment failed', 'Stripe payment completed but payment id was missing.');
      return;
    }

    const updated = await this.ordersStore.recordStripePayment(orderId, {
      paymentIntentId,
    });

    if (updated) {
      this.paymentForm.patchValue({
        amountDollars: 0,
        method: this.stripeAvailable() ? 'stripe' : 'card',
        reference: '',
        note: '',
      });
      this.paymentMethod.set(this.stripeAvailable() ? 'stripe' : 'card');
      this.closePaymentModal();
      this.toast.success('Payment added', 'Stripe payment recorded.');
    } else {
      this.toast.error('Payment failed', this.error() ?? 'Unable to record Stripe payment.');
    }
  }

  private async ensureStripeCardElementReady(): Promise<boolean> {
    if (this.initializingStripePayment()) return false;
    if (!this.showPaymentForm()) return false;
    if (this.paymentMethod() !== 'stripe') return false;
    if (!this.stripeAvailable()) return false;
    if (this.stripeCardMounted && this.cardElement) return true;

    const host = this.stripeCardHost();
    const stripeAccountId = this.stripeStatus()?.accountId;

    if (!host || !stripeAccountId) return false;

    this.initializingStripePayment.set(true);

    try {
      await this.mountStripeCardElement(stripeAccountId);
      return true;
    } finally {
      this.initializingStripePayment.set(false);
    }
  }

  private async mountStripeCardElement(stripeAccountId: string): Promise<void> {
    const host = this.stripeCardHost();
    if (!host) return;

    this.destroyStripeCardElement();

    const stripeReady = await this.stripeService.createCardElement({
      stripeAccountId,
    });

    this.stripeElements = stripeReady.elements;
    this.cardElement = stripeReady.card;
    this.cardElement.mount(host.nativeElement);
    this.stripeCardMounted = true;
  }

  private destroyStripeCardElement(): void {
    this.cardElement?.destroy();
    this.cardElement = null;
    this.stripeElements = null;
    this.stripeCardMounted = false;
  }

  private resetItemsForm(): void {
    const array = this.itemsArray();
    while (array.length) {
      array.removeAt(0);
    }

    this.itemsForm.patchValue({ discountDollars: 0 }, { emitEvent: false });
    this.itemSearchControl.setValue('', { emitEvent: false });
    this.searchFocused.set(false);
    this.expandedItemIndex.set(null);
  }

  private syncItemsFormFromOrder(order: Order): void {
    const array = this.itemsArray();
    while (array.length) {
      array.removeAt(0);
    }

    for (const item of order.items) {
      array.push(
        this.createItemGroup({
          type: item.type,
          name: item.name,
          quantity: item.quantity,
          unitPriceDollars: item.unitPriceCents / 100,
          notes: item.notes ?? '',
          sourceId: null,
        })
      );
    }

    this.itemsForm.patchValue(
      {
        discountDollars: order.totals.discountCents / 100,
      },
      { emitEvent: false }
    );

    this.itemSearchControl.setValue('', { emitEvent: false });
    this.searchFocused.set(false);
    this.expandedItemIndex.set(null);
  }

  private createItemGroup(input?: {
    type?: OrderItemType;
    name?: string;
    quantity?: number;
    unitPriceDollars?: number;
    notes?: string;
    sourceId?: string | null;
  }) {
    return this.fb.group({
      type: this.fb.control<OrderItemType>(input?.type ?? 'service', Validators.required),
      name: this.fb.control(input?.name ?? '', [
        Validators.required,
        Validators.maxLength(120),
      ]),
      quantity: this.fb.control(input?.quantity ?? 1, [
        Validators.required,
        Validators.min(1),
        Validators.max(100),
      ]),
      unitPriceDollars: this.fb.control(input?.unitPriceDollars ?? 0, [
        Validators.required,
        Validators.min(0),
      ]),
      notes: this.fb.control(input?.notes ?? ''),
      sourceId: this.fb.control<string | null>(input?.sourceId ?? null),
    });
  }

  private itemRowsRawValue(): Array<{
    type: OrderItemType;
    name: string;
    quantity: number;
    unitPriceDollars: number;
    notes: string;
    sourceId?: string | null;
  }> {
    return this.itemsArray().getRawValue() as Array<{
      type: OrderItemType;
      name: string;
      quantity: number;
      unitPriceDollars: number;
      notes: string;
      sourceId?: string | null;
    }>;
  }
}