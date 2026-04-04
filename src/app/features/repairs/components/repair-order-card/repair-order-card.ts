import { CommonModule } from '@angular/common';
import {
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  LucideAngularModule,
  BadgeDollarSign,
  CreditCard,
  FilePlus2,
  LoaderCircle,
  Package2,
  ReceiptText,
  RotateCcw,
  Save,
  Trash2,
  Wallet,
  XCircle,
} from 'lucide-angular';
import { OrdersStore } from '../../../../core/orders/orders-store';
import {
  CreateOrderItemPayload,
  Order,
  OrderItemType,
  PaymentMethod,
} from '../../../../core/orders/orders-model';
import { ToastService } from '../../../../core/toast/toast-service';

@Component({
  selector: 'app-repair-order-card',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    LucideAngularModule,
  ],
  templateUrl: './repair-order-card.html',
})
export class RepairOrderCard {
  readonly repairId = input.required<string>();
  readonly orderId = input<string | null>(null);
  readonly customerId = input<string | null>(null);
  readonly disabled = input(false);

  readonly createRequested = output<void>();

  private readonly fb = inject(FormBuilder);
  readonly ordersStore = inject(OrdersStore);
  private readonly toast = inject(ToastService);

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
  };

  readonly order = this.ordersStore.selectedOrder;
  readonly loading = this.ordersStore.selectedOrderLoading;
  readonly saving = this.ordersStore.selectedOrderSaving;
  readonly error = this.ordersStore.selectedOrderError;
  readonly moneyLocked = this.ordersStore.orderLockedByMoney;

  readonly showPaymentForm = signal(false);
  readonly showRefundForm = signal(false);

  readonly itemsForm = this.fb.group({
    discountDollars: [0, [Validators.min(0)]],
    items: this.fb.array([]),
  });

  readonly paymentForm = this.fb.nonNullable.group({
    amountDollars: [0, [Validators.required, Validators.min(0.01)]],
    method: ['card' as PaymentMethod, Validators.required],
    reference: [''],
    note: [''],
  });

  readonly refundForm = this.fb.nonNullable.group({
    amountDollars: [0, [Validators.required, Validators.min(0.01)]],
    method: ['card' as PaymentMethod, Validators.required],
    reference: [''],
    note: [''],
  });

  readonly itemsArray = computed(() => this.itemsForm.controls.items as FormArray);

  readonly draftSubtotalCents = computed(() => {
    const rows = this.itemRowsRawValue();
    return rows.reduce((sum, row) => {
      const quantity = Number(row.quantity ?? 0);
      const unitPriceCents = this.dollarsToCents(row.unitPriceDollars ?? 0);
      return sum + Math.max(0, quantity) * Math.max(0, unitPriceCents);
    }, 0);
  });

  readonly draftDiscountCents = computed(() => {
    const subtotal = this.draftSubtotalCents();
    const discount = this.dollarsToCents(this.itemsForm.controls.discountDollars.value ?? 0);
    return Math.min(Math.max(0, discount), subtotal);
  });

  readonly draftTotalCents = computed(() => {
    return this.draftSubtotalCents() - this.draftDiscountCents();
  });

  private readonly loadOrderEffect = effect(() => {
    const orderId = this.orderId();

    if (!orderId) {
      this.ordersStore.clearSelectedOrder();
      this.resetItemsForm();
      return;
    }

    const current = this.ordersStore.selectedOrder();
    if (current?.id === orderId) return;

    this.ordersStore.loadOrder(orderId);
  });

  private readonly syncItemsEffect = effect(() => {
    const order = this.order();
    if (!order) {
      this.resetItemsForm();
      return;
    }

    this.syncItemsFormFromOrder(order);
  });

  createOrder(): void {
  if (this.disabled()) return;
  this.createRequested.emit();
}

  addItem(type: OrderItemType): void {
    this.itemsArray().push(
      this.fb.group({
        type: [type as OrderItemType, Validators.required],
        name: ['', [Validators.required, Validators.maxLength(120)]],
        quantity: [1, [Validators.required, Validators.min(1), Validators.max(100)]],
        unitPriceDollars: [0, [Validators.required, Validators.min(0)]],
        notes: [''],
      })
    );
  }

  removeItem(index: number): void {
    this.itemsArray().removeAt(index);
  }

  async saveItems(): Promise<void> {
    const order = this.order();
    if (!order || this.moneyLocked()) return;

    if (this.itemsForm.invalid || !this.itemsArray().length) {
      this.itemsForm.markAllAsTouched();
      return;
    }

    const payloadItems: CreateOrderItemPayload[] = this.itemRowsRawValue().map((row) => ({
      type: row.type,
      name: String(row.name ?? '').trim(),
      quantity: Number(row.quantity ?? 1),
      unitPriceCents: this.dollarsToCents(row.unitPriceDollars ?? 0),
      notes: String(row.notes ?? '').trim() || null,
      sku: null,
    }));

    const updated = await this.ordersStore.replaceOrderItems(order.id, {
      items: payloadItems,
      discountCents: this.dollarsToCents(this.itemsForm.controls.discountDollars.value ?? 0),
    });

    if (updated) {
      this.toast.success('Order saved', 'Line items updated.');
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
    const updated = await this.ordersStore.addPayment(order.id, {
      amountCents: this.dollarsToCents(value.amountDollars),
      method: value.method,
      reference: value.reference.trim() || null,
      note: value.note.trim() || null,
    });

    if (updated) {
      this.paymentForm.patchValue({
        amountDollars: 0,
        method: 'card',
        reference: '',
        note: '',
      });
      this.showPaymentForm.set(false);
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
    const updated = await this.ordersStore.addRefund(order.id, {
      amountCents: this.dollarsToCents(value.amountDollars),
      method: value.method,
      reference: value.reference.trim() || null,
      note: value.note.trim() || null,
    });

    if (updated) {
      this.refundForm.patchValue({
        amountDollars: 0,
        method: 'card',
        reference: '',
        note: '',
      });
      this.showRefundForm.set(false);
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

    return order.totals.paidCents === 0 && order.totals.refundedCents === 0;
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
    return this.money(quantity * this.dollarsToCents(dollars));
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

  private resetItemsForm(): void {
    const array = this.itemsArray();
    while (array.length) {
      array.removeAt(0);
    }
    this.itemsForm.patchValue({ discountDollars: 0 }, { emitEvent: false });
  }

  private syncItemsFormFromOrder(order: Order): void {
    const array = this.itemsArray();
    while (array.length) {
      array.removeAt(0);
    }

    for (const item of order.items) {
      array.push(
        this.fb.group({
          type: [item.type, Validators.required],
          name: [item.name, [Validators.required, Validators.maxLength(120)]],
          quantity: [item.quantity, [Validators.required, Validators.min(1), Validators.max(100)]],
          unitPriceDollars: [item.unitPriceCents / 100, [Validators.required, Validators.min(0)]],
          notes: [item.notes ?? ''],
        })
      );
    }

    this.itemsForm.patchValue(
      {
        discountDollars: order.totals.discountCents / 100,
      },
      { emitEvent: false }
    );
  }

  private itemRowsRawValue(): Array<{
    type: OrderItemType;
    name: string;
    quantity: number;
    unitPriceDollars: number;
    notes: string;
  }> {
    return this.itemsArray().getRawValue() as Array<{
      type: OrderItemType;
      name: string;
      quantity: number;
      unitPriceDollars: number;
      notes: string;
    }>;
  }

  private dollarsToCents(value: number | string | null | undefined): number {
    const numeric = Number(value ?? 0);
    if (!Number.isFinite(numeric)) return 0;
    return Math.round(numeric * 100);
  }
}