import { CommonModule, DatePipe, TitleCasePipe } from '@angular/common';
import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LucideAngularModule, ChevronLeftIcon } from 'lucide-angular';

import { PurchaseOrderStore } from '../../../core/purchase-orders/purchase-orders.store';
import {
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseOrderStatus,
} from '../../../core/purchase-orders/purchase-orders.model';
import { ProductsStore } from '../../../core/products/products-store';
import { Product } from '../../../core/products/products-model';
import { SupplierStore } from '../../../core/suppliers/suppliers.store';

@Component({
  selector: 'app-purchase-order-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DatePipe, LucideAngularModule],
  templateUrl: './purchase-order-detail.html',
})
export class PurchaseOrderDetail implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly purchaseOrderStore = inject(PurchaseOrderStore);
  private readonly productsStore = inject(ProductsStore);
  private readonly supplierStore = inject(SupplierStore);

  readonly leftChevronIcon = ChevronLeftIcon;

  readonly suppliers = this.supplierStore.activeSuppliers;
  readonly suppliersLoading = this.supplierStore.suppliersLoading;
  readonly suppliersError = this.supplierStore.suppliersError;

  readonly selectedSupplierId = signal<string | null>(null);

  readonly order = this.purchaseOrderStore.selectedPurchaseOrder;
  readonly loading = this.purchaseOrderStore.selectedLoading;
  readonly saving = this.purchaseOrderStore.selectedSaving;
  readonly error = this.purchaseOrderStore.selectedError;

  readonly products = this.productsStore.products;
  readonly productsLoading = this.productsStore.productsLoading;

  readonly addItemOpen = signal(false);
  readonly receiveOpen = signal(false);
  readonly cancelOpen = signal(false);

  readonly productSearch = signal('');
  readonly selectedProductId = signal<string | null>(null);
  readonly selectedProductSupplierId = signal<string | null>(null);
  readonly itemQty = signal<number | null>(1);
  readonly itemUnitCostDisplay = signal('');
  readonly itemNotes = signal('');

  readonly receiveNotes = signal('');
  readonly receiveQuantities = signal<Record<string, number>>({});

  readonly cancelReason = signal('');

  readonly shippingDisplay = signal('');
  readonly taxDisplay = signal('');
  readonly notesDraft = signal('');

  readonly filteredProducts = computed(() => {
    const search = this.productSearch().trim().toLowerCase();

    const products = this.products()
      .filter((product) => !product.deletedAt && product.status === 'active')
      .filter((product) => this.productMatchesOrderSupplier(product));

    if (!search) return products.slice(0, 25);

    return products
      .filter((product) =>
        [
          product.id,
          product.name,
          product.sku,
          ...product.tags,
          ...(product.supplierLinks ?? []).flatMap((link) => [
            link.supplierName,
            link.supplierProvider,
            link.supplierSku,
            link.supplierProductId,
            link.supplierProductName,
          ]),
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(search))
      )
      .slice(0, 25);
  });

  readonly selectedProduct = computed(() => {
    const id = this.selectedProductId();
    if (!id) return null;

    return this.products().find((product) => product.id === id) ?? null;
  });

  readonly selectedProductSupplierLinks = computed(() => {
    const product = this.selectedProduct();
    return product?.supplierLinks ?? [];
  });

  readonly canEditDraft = computed(() => this.order()?.status === 'draft');

  readonly canSubmit = computed(() => {
    const order = this.order();
    return !!order && order.status === 'draft' && (order.items?.length ?? 0) > 0;
  });

  readonly canReceive = computed(() => {
    const order = this.order();
    return !!order && (order.status === 'submitted' || order.status === 'partially_received');
  });

  readonly canCancel = computed(() => {
    const order = this.order();
    return !!order && order.status !== 'received' && order.status !== 'canceled';
  });

  readonly subtotalCents = computed(() => this.order()?.subtotalCents ?? 0);
  readonly totalCents = computed(() => this.order()?.totalCents ?? 0);

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;

    const order = await this.purchaseOrderStore.loadPurchaseOrder(id);

    if (order) {
      this.syncEditableFields(order);
    }

    if (!this.productsStore.productsLoaded()) {
      await this.productsStore.loadProducts({ includeDeleted: false });
    }

    if (!this.supplierStore.suppliersLoaded()) {
      await this.supplierStore.loadSuppliers({
        status: 'active',
        includeDeleted: false,
        limit: 100,
      });
    }
  }

  ngOnDestroy(): void {
    this.purchaseOrderStore.clearSelected();
  }

  private syncEditableFields(order: PurchaseOrder): void {
    this.shippingDisplay.set(this.formatCentsToDisplay(order.shippingCents));
    this.taxDisplay.set(this.formatCentsToDisplay(order.taxCents));
    this.notesDraft.set(order.notes ?? '');
    this.selectedSupplierId.set(order.supplierId ?? null);
  }

  statusLabel(status: PurchaseOrderStatus): string {
    if (status === 'partially_received') return 'Partially Received';

    return status
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  statusTone(status: PurchaseOrderStatus): 'gray' | 'blue' | 'amber' | 'emerald' | 'rose' {
    if (status === 'draft') return 'gray';
    if (status === 'submitted') return 'blue';
    if (status === 'partially_received') return 'amber';
    if (status === 'received') return 'emerald';
    return 'rose';
  }

  formatMoney(cents: number | null | undefined): string {
    if (cents == null) return '—';

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  }

  formatDate(value: string | null | undefined): string {
    if (!value) return '—';
    return new Date(value).toLocaleDateString();
  }

  formatCentsToDisplay(cents: number | null | undefined): string {
    if (cents == null) return '';
    return (cents / 100).toFixed(2);
  }

  parseMoneyToCents(value: string): number {
    const normalized = value.replace(/[^0-9.]/g, '');
    const number = Number(normalized);

    if (!Number.isFinite(number) || number < 0) return 0;

    return Math.round(number * 100);
  }

  onShippingChange(value: string): void {
    this.shippingDisplay.set(value);
  }

  onTaxChange(value: string): void {
    this.taxDisplay.set(value);
  }

  normalizeShippingDisplay(): void {
    this.shippingDisplay.set(this.formatCentsToDisplay(this.parseMoneyToCents(this.shippingDisplay())));
  }

  normalizeTaxDisplay(): void {
    this.taxDisplay.set(this.formatCentsToDisplay(this.parseMoneyToCents(this.taxDisplay())));
  }

  async saveMeta(): Promise<void> {
    const order = this.order();
    if (!order) return;

    const updated = await this.purchaseOrderStore.updatePurchaseOrder(order.id, {
      supplierId: this.selectedSupplierId(),
      shippingCents: this.parseMoneyToCents(this.shippingDisplay()),
      taxCents: this.parseMoneyToCents(this.taxDisplay()),
      notes: this.notesDraft().trim() || null,
    });

    if (updated) this.syncEditableFields(updated);
  }

  openAddItem(): void {
    this.productSearch.set('');
    this.selectedProductId.set(null);
    this.selectedProductSupplierId.set(null);
    this.itemQty.set(1);
    this.itemUnitCostDisplay.set('');
    this.itemNotes.set('');
    this.addItemOpen.set(true);
  }

  closeAddItem(): void {
    this.addItemOpen.set(false);
    this.productSearch.set('');
    this.selectedProductId.set(null);
    this.selectedProductSupplierId.set(null);
    this.itemQty.set(1);
    this.itemUnitCostDisplay.set('');
    this.itemNotes.set('');
  }

  selectProduct(product: Product): void {
    this.selectedProductId.set(product.id);

    const supplierLink = this.preferredSupplierLinkForOrder(product);

    this.selectedProductSupplierId.set(supplierLink?.id ?? null);

    const costCents = supplierLink?.lastKnownCostCents ?? product.cost ?? 0;
    this.itemUnitCostDisplay.set(this.formatCentsToDisplay(costCents));
  }

  async submitAddItem(): Promise<void> {
    const order = this.order();
    const product = this.selectedProduct();
    const qty = Number(this.itemQty());

    if (!order || !product || !Number.isFinite(qty) || qty <= 0) return;

    const updated = await this.purchaseOrderStore.addItem(order.id, {
      productId: product.id,
      productSupplierId: this.selectedProductSupplierId(),
      quantityOrdered: Math.trunc(qty),
      unitCostCents: this.parseMoneyToCents(this.itemUnitCostDisplay()),
      notes: this.itemNotes().trim() || null,
    });

    if (!updated) return;

    this.closeAddItem();
  }

  async deleteItem(item: PurchaseOrderItem): Promise<void> {
    const order = this.order();
    if (!order || !confirm('Remove this item from the purchase order?')) return;

    await this.purchaseOrderStore.deleteItem(order.id, item.id);
  }

  async submitOrder(): Promise<void> {
    const order = this.order();
    if (!order) return;

    await this.purchaseOrderStore.submitPurchaseOrder(order.id, {
      externalStatus: 'submitted',
    });
  }

  openReceive(): void {
    const order = this.order();
    if (!order) return;

    const quantities: Record<string, number> = {};

    for (const item of order.items ?? []) {
      const remaining = Math.max(item.quantityOrdered - item.quantityReceived, 0);
      if (remaining > 0) quantities[item.id] = remaining;
    }

    this.receiveQuantities.set(quantities);
    this.receiveNotes.set('');
    this.receiveOpen.set(true);
  }

  closeReceive(): void {
    this.receiveOpen.set(false);
    this.receiveQuantities.set({});
    this.receiveNotes.set('');
  }

  setReceiveQty(itemId: string, value: number | string): void {
    const qty = Number(value);

    this.receiveQuantities.update((current) => ({
      ...current,
      [itemId]: Number.isFinite(qty) ? Math.trunc(qty) : 0,
    }));
  }

  receiveQtyFor(item: PurchaseOrderItem): number {
    return this.receiveQuantities()[item.id] ?? 0;
  }

  async submitReceive(): Promise<void> {
    const order = this.order();
    if (!order) return;

    const items = (order.items ?? [])
      .map((item) => ({
        itemId: item.id,
        quantityReceived: this.receiveQtyFor(item),
      }))
      .filter((item) => item.quantityReceived > 0);

    if (!items.length) return;

    const updated = await this.purchaseOrderStore.receivePurchaseOrder(order.id, {
      items,
      notes: this.receiveNotes().trim() || null,
    });

    if (!updated) return;

    this.closeReceive();
  }

  openCancel(): void {
    this.cancelReason.set('');
    this.cancelOpen.set(true);
  }

  closeCancel(): void {
    this.cancelReason.set('');
    this.cancelOpen.set(false);
  }

  async submitCancel(): Promise<void> {
    const order = this.order();
    if (!order) return;

    const updated = await this.purchaseOrderStore.cancelPurchaseOrder(order.id, {
      reason: this.cancelReason().trim() || null,
    });

    if (!updated) return;

    this.closeCancel();
  }

  remainingQty(item: PurchaseOrderItem): number {
    return Math.max(item.quantityOrdered - item.quantityReceived, 0);
  }

  trackByItemId(_: number, item: PurchaseOrderItem): string {
    return item.id;
  }

  trackByProductId(_: number, product: Product): string {
    return product.id;
  }

  supplierProviderLabel(provider: string | null | undefined): string {
    if (!provider) return 'Manual';

    return provider
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  private orderSupplierId(): string | null {
    return this.order()?.supplierId ?? null;
  }

  productMatchesOrderSupplier(product: Product): boolean {
    const supplierId = this.orderSupplierId();

    if (!supplierId) return true;

    return (product.supplierLinks ?? []).some((link) => link.supplierId === supplierId);
  }

  preferredSupplierLinkForOrder(product: Product) {
    const supplierId = this.orderSupplierId();

    if (!supplierId) {
      return (
        product.supplierLinks?.find((link) => link.isPreferred) ??
        product.supplierLinks?.[0] ??
        null
      );
    }

    return (
      product.supplierLinks?.find(
        (link) => link.supplierId === supplierId && link.isPreferred
      ) ??
      product.supplierLinks?.find((link) => link.supplierId === supplierId) ??
      null
    );
  }
}