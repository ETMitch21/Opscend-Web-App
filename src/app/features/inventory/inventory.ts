import { CommonModule, TitleCasePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LucideAngularModule, PackageIcon, AlertTriangleIcon, SlidersHorizontalIcon } from 'lucide-angular';

import { InventoryStore } from '../../core/inventory/inventory.store';
import { InventoryBalance } from '../../core/inventory/inventory.model';

type InventoryView = 'all' | 'low' | 'out' | 'available';

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TitleCasePipe, LucideAngularModule],
  templateUrl: './inventory.html',
})
export class Inventory implements OnInit {
  private readonly inventoryStore = inject(InventoryStore);

  readonly packageIcon = PackageIcon;
  readonly alertTriangleIcon = AlertTriangleIcon;
  readonly slidersIcon = SlidersHorizontalIcon;

  readonly activeView = signal<InventoryView>('all');
  readonly searchTerm = signal('');

  readonly adjustOpen = signal(false);
  readonly reorderOpen = signal(false);
  readonly selectedBalance = signal<InventoryBalance | null>(null);

  readonly adjustQuantity = signal<number | null>(null);
  readonly adjustReason = signal('');
  readonly adjustNotes = signal('');

  readonly reorderPointQty = signal<number | null>(null);
  readonly reorderQty = signal<number | null>(null);

  readonly loading = this.inventoryStore.balancesLoading;
  readonly loadingMore = this.inventoryStore.balancesLoadingMore;
  readonly error = this.inventoryStore.balancesError;
  readonly nextCursor = this.inventoryStore.balancesNextCursor;
  readonly saving = this.inventoryStore.selectedBalanceSaving;

  readonly balances = this.inventoryStore.balances;

  readonly counts = computed(() => {
    const balances = this.balances();

    return {
      all: balances.length,
      low: balances.filter((balance) => this.isLowStock(balance)).length,
      out: balances.filter((balance) => balance.onHandQty <= 0).length,
      available: balances.filter((balance) => balance.availableQty > 0).length,
    };
  });

  readonly filteredBalances = computed(() => {
    const search = this.searchTerm().trim().toLowerCase();
    const view = this.activeView();

    return this.balances().filter((balance) => {
      if (view === 'low' && !this.isLowStock(balance)) return false;
      if (view === 'out' && balance.onHandQty > 0) return false;
      if (view === 'available' && balance.availableQty <= 0) return false;

      if (!search) return true;

      return [
        balance.id,
        balance.productId,
        balance.product?.name,
        balance.product?.sku,
        balance.product?.status,
        balance.location?.name,
        balance.location?.type,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search));
    });
  });

  readonly totals = computed(() => {
    const balances = this.filteredBalances();

    return {
      onHand: balances.reduce((sum, balance) => sum + balance.onHandQty, 0),
      reserved: balances.reduce((sum, balance) => sum + balance.reservedQty, 0),
      available: balances.reduce((sum, balance) => sum + balance.availableQty, 0),
      onOrder: balances.reduce((sum, balance) => sum + balance.onOrderQty, 0),
    };
  });

  async ngOnInit(): Promise<void> {
    await this.inventoryStore.loadBalances();
  }

  async refresh(): Promise<void> {
    await this.inventoryStore.refreshBalances();
  }

  async loadMore(): Promise<void> {
    await this.inventoryStore.loadMoreBalances();
  }

  setView(view: InventoryView): void {
    this.activeView.set(view);
  }

  setSearchTerm(value: string): void {
    this.searchTerm.set(value);
  }

  formatMoney(cents: number | null | undefined): string {
    if (cents == null) return '—';

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  }

  isLowStock(balance: InventoryBalance): boolean {
    if (balance.reorderPointQty == null) return false;
    return balance.onHandQty <= balance.reorderPointQty;
  }

  inventoryTone(balance: InventoryBalance): 'out' | 'low' | 'healthy' {
    if (balance.onHandQty <= 0) return 'out';
    if (this.isLowStock(balance)) return 'low';
    return 'healthy';
  }

  inventoryLabel(balance: InventoryBalance): string {
    const tone = this.inventoryTone(balance);

    if (tone === 'out') return 'Out of Stock';
    if (tone === 'low') return 'Low Stock';
    return 'Healthy';
  }

  openAdjust(balance: InventoryBalance): void {
    this.selectedBalance.set(balance);
    this.adjustQuantity.set(null);
    this.adjustReason.set('');
    this.adjustNotes.set('');
    this.adjustOpen.set(true);
  }

  closeAdjust(): void {
    this.adjustOpen.set(false);
    this.selectedBalance.set(null);
    this.adjustQuantity.set(null);
    this.adjustReason.set('');
    this.adjustNotes.set('');
  }

  async submitAdjust(): Promise<void> {
    const balance = this.selectedBalance();
    const quantityDelta = Number(this.adjustQuantity());

    if (!balance || !Number.isFinite(quantityDelta) || quantityDelta === 0) return;

    const updated = await this.inventoryStore.adjustProductStock(balance.productId, {
      locationId: balance.locationId,
      quantityDelta,
      reason: this.adjustReason().trim() || null,
      notes: this.adjustNotes().trim() || null,
    });

    if (!updated) return;

    this.closeAdjust();
  }

  openReorder(balance: InventoryBalance): void {
    this.selectedBalance.set(balance);
    this.reorderPointQty.set(balance.reorderPointQty);
    this.reorderQty.set(balance.reorderQty);
    this.reorderOpen.set(true);
  }

  closeReorder(): void {
    this.reorderOpen.set(false);
    this.selectedBalance.set(null);
    this.reorderPointQty.set(null);
    this.reorderQty.set(null);
  }

  async submitReorder(): Promise<void> {
    const balance = this.selectedBalance();
    if (!balance) return;

    const updated = await this.inventoryStore.updateProductBalance(balance.productId, {
      locationId: balance.locationId,
      reorderPointQty: this.normalizeNullableNumber(this.reorderPointQty()),
      reorderQty: this.normalizeNullableNumber(this.reorderQty()),
    });

    if (!updated) return;

    this.closeReorder();
  }

  private normalizeNullableNumber(value: number | null): number | null {
    if (value == null) return null;

    const numberValue = Number(value);

    if (!Number.isFinite(numberValue)) return null;
    if (numberValue < 0) return null;

    return Math.trunc(numberValue);
  }

  trackByBalanceId(_: number, balance: InventoryBalance): string {
    return balance.id;
  }
}