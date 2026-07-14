import { CommonModule } from '@angular/common';
import {
  Component,
  DestroyRef,
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
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import {
  BadgeDollarSign,
  CheckCircle2,
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
  OrderPayment,
  PaymentMethod,
} from '../../../../core/orders/orders-model';
import { ProductsService } from '../../../../core/products/products-service';
import { ServicesService } from '../../../../core/services/service';
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
  sku?: string | null;
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
  private readonly destroyRef = inject(DestroyRef);
  readonly ordersStore = inject(OrdersStore);
  private readonly productsService = inject(ProductsService);
  private readonly servicesService = inject(ServicesService);
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
  readonly paymentsExpanded = signal(false);

  readonly paymentMethod = signal<PaymentMethod>('card');
  readonly refundMethod = signal<PaymentMethod>('card');

  readonly icons = {
    CheckCircle2,
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
  readonly itemsLocked = this.ordersStore.orderItemsLocked;

  readonly stripeAvailable = computed(() => {
    const status = this.stripeStatus();
    return !!status?.connected && !!status?.chargesEnabled && !!status?.accountId;
  });

  readonly stripeConnectedButNotReady = computed(() => {
    const status = this.stripeStatus();
    return !!status?.connected && !status?.chargesEnabled;
  });

  readonly catalogLoading = signal(false);
  readonly catalogLoadFailed = signal(false);

  private readonly productCatalogItems = signal<CatalogItemOption[]>([]);
  private readonly serviceCatalogItems = signal<CatalogItemOption[]>([]);

  readonly products = computed<CatalogItemOption[]>(() => this.productCatalogItems());
  readonly services = computed<CatalogItemOption[]>(() => this.serviceCatalogItems());

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

  private readonly itemsFormRevision = signal(0);

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
    this.itemsFormRevision();
    const rows = this.itemRowsRawValue();
    return rows.reduce((sum, row) => {
      const quantity = Number(row.quantity ?? 0);
      const unitPriceCents = this.toCents(row.unitPriceDollars ?? 0);
      return sum + Math.max(0, quantity) * Math.max(0, unitPriceCents);
    }, 0);
  });

  readonly draftDiscountCents = computed(() => {
    this.itemsFormRevision();
    const subtotal = this.draftSubtotalCents();
    const discount = this.toCents(this.itemsForm.controls.discountDollars.value ?? 0);
    return Math.min(Math.max(0, discount), subtotal);
  });

  readonly draftTotalCents = computed(() =>
    Math.max(0, this.draftSubtotalCents() - this.draftDiscountCents())
  );

  readonly draftBalanceCents = computed(() =>
    Math.max(0, this.draftTotalCents() - this.netPaidCents())
  );

  readonly balanceSummaryCents = computed(() =>
    this.hasUnsavedItemChanges()
      ? this.draftBalanceCents()
      : Math.max(0, this.order()?.totals.balanceCents ?? 0)
  );

  readonly hasUnsavedItemChanges = computed(() => {
    const order = this.order();
    if (!order || !this.canEditItems()) return false;

    return this.draftOrderSignature() !== this.persistedOrderSignature(order);
  });

  constructor() {
    void this.loadCatalogItems();

    this.itemsForm.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.bumpDraftTotals());

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

  async loadCatalogItems(): Promise<void> {
    if (this.catalogLoading()) return;

    this.catalogLoading.set(true);
    this.catalogLoadFailed.set(false);

    const [productsResult, servicesResult] = await Promise.allSettled([
      firstValueFrom(this.productsService.list({ status: 'active', limit: 150 })),
      firstValueFrom(this.servicesService.listActive(150)),
    ]);

    if (productsResult.status === 'fulfilled') {
      this.productCatalogItems.set(
        (productsResult.value.data ?? [])
          .filter((product: any) => product?.status === 'active')
          .map((product: any) => ({
            id: product.id,
            type: 'product' as CatalogItemType,
            name: product.name,
            description: product.sku ? `Product SKU: ${product.sku}` : null,
            priceCents: Number(product.price ?? product.priceCents ?? 0),
            sku: product.sku ?? null,
          }))
      );
    } else {
      this.productCatalogItems.set([]);
    }

    if (servicesResult.status === 'fulfilled') {
      this.serviceCatalogItems.set(
        (servicesResult.value ?? [])
          .filter((service: any) => service?.status === 'active')
          .map((service: any) => ({
            id: service.id,
            type: 'service' as CatalogItemType,
            name: service.name,
            description: [
              service.code ? `Service Code: ${service.code}` : null,
              service.duration != null ? `${service.duration} min` : null,
              service.description ?? null,
            ].filter(Boolean).join(' · ') || null,
            priceCents: Number(service.price ?? service.priceCents ?? 0),
            sku: null,
          }))
      );
    } else {
      this.serviceCatalogItems.set([]);
    }

    const failed =
      productsResult.status === 'rejected' &&
      servicesResult.status === 'rejected';

    this.catalogLoadFailed.set(failed);

    if (failed) {
      this.toast.error(
        'Catalog unavailable',
        'Products and services could not be loaded for this order.'
      );
    }

    this.catalogLoading.set(false);
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
          productId: item.type === 'product' ? item.id : null,
          name: item.name,
          quantity: 1,
          unitPriceDollars: (item.priceCents ?? 0) / 100,
          notes: '',
          sku: item.sku ?? null,
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
        productId: null,
        quantity: 1,
        unitPriceDollars: 0,
        notes: '',
        sku: null,
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

  private bumpDraftTotals(): void {
    this.itemsFormRevision.update((value) => value + 1);
  }

  netPaidCents(): number {
    const totals = this.order()?.totals;
    if (!totals) return 0;

    return Math.max(0, Number(totals.paidCents ?? 0) - Number(totals.refundedCents ?? 0));
  }

  draftTotalBelowNetPaid(): boolean {
    return this.draftTotalCents() < this.netPaidCents();
  }

  canEditItems(): boolean {
    const order = this.order();
    if (!order) return false;

    return !this.itemsLocked();
  }

  canSaveItems(): boolean {
    return (
      this.canEditItems() &&
      this.itemsArray().length > 0 &&
      this.hasUnsavedItemChanges() &&
      !this.draftTotalBelowNetPaid()
    );
  }

  balanceSummaryLabel(): string {
    return this.hasUnsavedItemChanges() ? 'Draft balance' : 'Balance due';
  }

  saveButtonLabel(): string {
    return this.hasUnsavedItemChanges() ? 'Save Changes' : 'Saved';
  }

  primaryPaymentButtonLabel(): string {
    if (this.hasUnsavedItemChanges()) return 'Save First';

    const balanceCents = Math.max(0, this.order()?.totals.balanceCents ?? 0);
    return balanceCents > 0 ? `Collect ${this.money(balanceCents)}` : 'Add Payment';
  }

  canOpenPaymentModal(): boolean {
    const order = this.order();
    if (!order) return false;

    return order.paymentStatus !== 'voided' && !this.hasUnsavedItemChanges();
  }

  isQuoteCreatedOrder(order: Order | null | undefined): boolean {
    if (!order) return false;

    const notes = (order.notes ?? '').toLowerCase();
    const tags = order.tags ?? [];

    return (
      order.source === 'booking' ||
      !!order.externalRefs.bookingId ||
      tags.some((tag) => tag.toLowerCase().includes('quote')) ||
      notes.includes('quote')
    );
  }

  emptyOrderTitle(order: Order): string {
    return this.isQuoteCreatedOrder(order)
      ? 'Order created from accepted quote'
      : 'No items yet';
  }

  emptyOrderDescription(order: Order): string {
    return this.isQuoteCreatedOrder(order)
      ? 'Add repair services, parts, or a custom line item to finish pricing.'
      : 'Search above to add a service or product.';
  }

  isQuoteDepositPayment(payment: OrderPayment): boolean {
    const note = (payment.note ?? '').toLowerCase();
    return payment.type === 'payment' && note.includes('quote deposit');
  }

  paymentDisplayTitle(payment: OrderPayment): string {
    if (this.isQuoteDepositPayment(payment)) return 'Quote Deposit';
    return payment.type === 'refund' ? 'Refund' : 'Payment';
  }

  paymentDisplaySubtitle(payment: OrderPayment): string {
    const method = payment.method === 'stripe' ? 'Stripe' : this.toTitleCase(payment.method);
    return payment.type === 'refund' ? `${method} refund` : `${method} payment`;
  }

  paymentReferenceLabel(payment: OrderPayment): string {
    if (!payment.reference) return '';
    return payment.reference.startsWith('pi_') ? 'Payment Intent' : 'Reference';
  }

  visiblePayments(payments: OrderPayment[]): OrderPayment[] {
    if (this.paymentsExpanded() || payments.length <= 2) return payments;
    return payments.slice(-2);
  }

  hiddenPaymentCount(payments: OrderPayment[]): number {
    if (this.paymentsExpanded() || payments.length <= 2) return 0;
    return payments.length - 2;
  }

  togglePaymentsExpanded(): void {
    this.paymentsExpanded.update((value) => !value);
  }

  async saveItems(): Promise<void> {
    const order = this.order();
    if (!order) return;

    if (!this.canEditItems()) {
      this.toast.error(
        'Order locked',
        order.fulfillmentStatus === 'fulfilled'
          ? 'Fulfilled orders cannot be edited.'
          : 'Voided orders cannot be edited.'
      );
      return;
    }

    if (this.itemsForm.invalid) {
      this.itemsForm.markAllAsTouched();
      return;
    }

    if (this.draftTotalBelowNetPaid()) {
      this.toast.error(
        'Order total is too low',
        `The order total cannot be less than the net amount already paid (${this.money(this.netPaidCents())}). Add items or issue a refund first.`
      );
      return;
    }

    const payloadItems: CreateOrderItemPayload[] = this.itemRowsRawValue().map((row) => ({
      type: row.type,
      productId: row.type === 'product' ? row.productId ?? row.sourceId ?? null : null,
      name: String(row.name ?? '').trim(),
      quantity: Number(row.quantity ?? 1),
      unitPriceCents: this.toCents(row.unitPriceDollars ?? 0),
      notes: String(row.notes ?? '').trim() || null,
      sku: row.sku ?? null,
    }));

    const updated = await this.ordersStore.replaceOrderItems(order.id, {
      items: payloadItems,
      discountCents: this.toCents(this.itemsForm.controls.discountDollars.value ?? 0),
    });

    if (updated) {
      await this.ordersStore.loadOrder(order.id);
      this.toast.success('Order saved', 'Line items updated and totals refreshed.');
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

  canFulfill(): boolean {
    const order = this.order();
    if (!order) return false;

    return (
      order.paymentStatus !== 'voided' &&
      order.fulfillmentStatus !== 'fulfilled' &&
      order.totals.balanceCents === 0 &&
      order.items.length > 0 &&
      !!order.customerId
    );
  }

  async markFulfilled(): Promise<void> {
    const order = this.order();
    if (!order) return;

    const updated = await this.ordersStore.patchOrder(order.id, {
      fulfillmentStatus: 'fulfilled',
    });

    if (updated) {
      this.toast.success('Order fulfilled', `${updated.orderNumber} was marked fulfilled.`);
    } else {
      this.toast.error(
        'Fulfillment failed',
        this.error() ?? 'Unable to mark order fulfilled.'
      );
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

  private toTitleCase(value: string): string {
    if (!value) return '';
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  trackCatalogItem(_: number, item: CatalogItemOption): string {
    return `${item.type}-${item.id}`;
  }

  openPaymentModal(): void {
    const order = this.order();

    if (this.hasUnsavedItemChanges()) {
      this.toast.info('Save order first', 'Save item changes before collecting another payment.');
      return;
    }

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
    this.bumpDraftTotals();
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
          productId: item.productId ?? null,
          name: item.name,
          quantity: item.quantity,
          unitPriceDollars: item.unitPriceCents / 100,
          notes: item.notes ?? '',
          sku: item.sku ?? null,
          sourceId: item.productId ?? null,
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
    this.bumpDraftTotals();
  }

  private createItemGroup(input?: {
    type?: OrderItemType;
    productId?: string | null;
    name?: string;
    quantity?: number;
    unitPriceDollars?: number;
    notes?: string;
    sku?: string | null;
    sourceId?: string | null;
  }) {
    return this.fb.group({
      type: this.fb.control<OrderItemType>(input?.type ?? 'service', Validators.required),
      productId: this.fb.control<string | null>(input?.productId ?? null),
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
      sku: this.fb.control<string | null>(input?.sku ?? null),
      sourceId: this.fb.control<string | null>(input?.sourceId ?? null),
    });
  }

  private itemRowsRawValue(): Array<{
    type: OrderItemType;
    productId?: string | null;
    name: string;
    quantity: number;
    unitPriceDollars: number;
    notes: string;
    sku?: string | null;
    sourceId?: string | null;
  }> {
    return this.itemsArray().getRawValue() as Array<{
      type: OrderItemType;
      productId?: string | null;
      name: string;
      quantity: number;
      unitPriceDollars: number;
      notes: string;
      sku?: string | null;
      sourceId?: string | null;
    }>;
  }

  private draftOrderSignature(): string {
    this.itemsFormRevision();

    const items = this.itemRowsRawValue().map((row) => ({
      type: row.type,
      productId: row.type === 'product' ? row.productId ?? row.sourceId ?? null : null,
      name: String(row.name ?? '').trim(),
      quantity: Number(row.quantity ?? 1),
      unitPriceCents: this.toCents(row.unitPriceDollars ?? 0),
      notes: String(row.notes ?? '').trim() || null,
      sku: row.sku ?? null,
    }));

    return JSON.stringify({
      items,
      discountCents: this.toCents(this.itemsForm.controls.discountDollars.value ?? 0),
    });
  }

  private persistedOrderSignature(order: Order): string {
    const items = (order.items ?? []).map((item) => ({
      type: item.type,
      productId: item.type === 'product' ? item.productId ?? null : null,
      name: String(item.name ?? '').trim(),
      quantity: Number(item.quantity ?? 1),
      unitPriceCents: Number(item.unitPriceCents ?? 0),
      notes: item.notes?.trim() || null,
      sku: item.sku ?? null,
    }));

    return JSON.stringify({
      items,
      discountCents: Number(order.totals.discountCents ?? 0),
    });
  }

}