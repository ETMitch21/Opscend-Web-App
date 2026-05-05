import { CommonModule, DatePipe, TitleCasePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  LucideAngularModule,
  FileTextIcon,
  PlusIcon,
  RefreshCcwIcon,
  MoreHorizontalIcon,
  ExternalLinkIcon,
} from 'lucide-angular';

import { PurchaseOrderStore } from '../../core/purchase-orders/purchase-orders.store';
import {
  CreatePurchaseOrderPayload,
  PurchaseOrder,
  PurchaseOrderStatus,
} from '../../core/purchase-orders/purchase-orders.model';

type PurchaseOrderView =
  | 'open'
  | 'draft'
  | 'submitted'
  | 'partially_received'
  | 'received'
  | 'canceled'
  | 'all';

@Component({
  selector: 'app-purchase-orders',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    DatePipe,
    TitleCasePipe,
    LucideAngularModule,
  ],
  templateUrl: './purchase-orders.html',
})
export class PurchaseOrders implements OnInit {
  private readonly purchaseOrderStore = inject(PurchaseOrderStore);
  private readonly router = inject(Router);

  readonly fileTextIcon = FileTextIcon;
  readonly plusIcon = PlusIcon;
  readonly refreshIcon = RefreshCcwIcon;
  readonly moreHorizontalIcon = MoreHorizontalIcon;
  readonly externalLinkIcon = ExternalLinkIcon;

  readonly activeView = signal<PurchaseOrderView>('open');
  readonly searchTerm = signal('');

  readonly createOpen = signal(false);
  readonly createPoNumber = signal('');
  readonly createNotes = signal('');
  readonly openActionMenuForPurchaseOrderId = signal<string | null>(null);
  readonly actionMenuPosition = signal<{ top: number; right: number } | null>(null);

  readonly loading = this.purchaseOrderStore.loading;
  readonly loadingMore = this.purchaseOrderStore.loadingMore;
  readonly saving = this.purchaseOrderStore.selectedSaving;
  readonly error = this.purchaseOrderStore.error;
  readonly selectedError = this.purchaseOrderStore.selectedError;
  readonly nextCursor = this.purchaseOrderStore.nextCursor;
  readonly purchaseOrders = this.purchaseOrderStore.purchaseOrders;

  readonly counts = computed(() => {
    const orders = this.purchaseOrders();

    return {
      all: orders.length,
      open: orders.filter((po) => this.isOpen(po)).length,
      draft: orders.filter((po) => po.status === 'draft').length,
      submitted: orders.filter((po) => po.status === 'submitted').length,
      partially_received: orders.filter((po) => po.status === 'partially_received').length,
      received: orders.filter((po) => po.status === 'received').length,
      canceled: orders.filter((po) => po.status === 'canceled').length,
    };
  });

  readonly filteredPurchaseOrders = computed(() => {
    const view = this.activeView();
    const search = this.searchTerm().trim().toLowerCase();

    return this.purchaseOrders().filter((po) => {
      if (view === 'open' && !this.isOpen(po)) return false;
      if (view !== 'open' && view !== 'all' && po.status !== view) return false;

      if (!search) return true;

      return [
        po.id,
        po.poNumber,
        po.status,
        po.supplier?.name,
        po.supplierNameSnapshot,
        po.externalOrderId,
        po.externalOrderNumber,
        po.externalStatus,
        po.notes,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search));
    });
  });

  readonly summary = computed(() => {
    const orders = this.filteredPurchaseOrders();

    return {
      count: orders.length,
      openCount: orders.filter((po) => this.isOpen(po)).length,
      totalCents: orders.reduce((sum, po) => sum + po.totalCents, 0),
      openTotalCents: orders
        .filter((po) => this.isOpen(po))
        .reduce((sum, po) => sum + po.totalCents, 0),
    };
  });

  toggleActionMenu(poId: string, event: MouseEvent): void {
    event.stopPropagation();

    const current = this.openActionMenuForPurchaseOrderId();

    if (current === poId) {
      this.closeActionMenu();
      return;
    }

    const button = event.currentTarget as HTMLElement;
    const rect = button.getBoundingClientRect();

    this.actionMenuPosition.set({
      top: rect.bottom + 6,
      right: window.innerWidth - rect.right,
    });

    this.openActionMenuForPurchaseOrderId.set(poId);
  }

  closeActionMenu(): void {
    this.openActionMenuForPurchaseOrderId.set(null);
    this.actionMenuPosition.set(null);
  }

  async ngOnInit(): Promise<void> {
    await this.purchaseOrderStore.loadPurchaseOrders({ includeItems: true });
  }

  async refresh(): Promise<void> {
    await this.purchaseOrderStore.refreshPurchaseOrders();
  }

  async loadMore(): Promise<void> {
    await this.purchaseOrderStore.loadMorePurchaseOrders();
  }

  setView(view: PurchaseOrderView): void {
    this.activeView.set(view);
  }

  setSearchTerm(value: string): void {
    this.searchTerm.set(value);
  }

  openCreate(): void {
    this.createPoNumber.set('');
    this.createNotes.set('');
    this.createOpen.set(true);
  }

  closeCreate(): void {
    this.createOpen.set(false);
    this.createPoNumber.set('');
    this.createNotes.set('');
  }

  async submitCreate(): Promise<void> {
    const payload: CreatePurchaseOrderPayload = {
      poNumber: this.createPoNumber().trim() || null,
      notes: this.createNotes().trim() || null,
    };

    const created = await this.purchaseOrderStore.createPurchaseOrder(payload);

    if (!created) return;

    this.closeCreate();

    await this.router.navigate(['/purchase-orders', created.id]);
  }

  isOpen(po: PurchaseOrder): boolean {
    return (
      po.status === 'draft' ||
      po.status === 'submitted' ||
      po.status === 'partially_received'
    );
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

  itemCount(po: PurchaseOrder): number {
    return po.items?.length ?? 0;
  }

  trackByPurchaseOrderId(_: number, po: PurchaseOrder): string {
    return po.id;
  }
}