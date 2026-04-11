import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { ProductsStore } from '../../../core/products/products-store';
import { PatchProductPayload, ProductStatus } from '../../../core/products/products-model';
import { MobileSentrixService } from '../../../core/mobilesentrix/mobilesentrix-service';
import { mapMobileSentrixItems } from '../../../core/mobilesentrix/mobilesentrix-search-mapper';
import { MobileSentrixSearchResult } from '../../../core/mobilesentrix/mobilesentrix-model';
import { ArrowDownIcon, ArrowRightIcon, ArrowUpIcon, ChevronLeftIcon, LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe, LucideAngularModule, ReactiveFormsModule],
  templateUrl: './product-detail.html',
  styleUrl: './product-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductDetail {
  private readonly route = inject(ActivatedRoute);
  private readonly productsStore = inject(ProductsStore);
  private readonly fb = inject(FormBuilder);
  private readonly mobileSentrixService = inject(MobileSentrixService);

  readonly leftChevronIcon = ChevronLeftIcon;
  readonly arrowUpIcon = ArrowUpIcon;
  readonly arrowDownIcon = ArrowDownIcon;
  readonly arrowRightIcon = ArrowRightIcon;

  readonly product = this.productsStore.selectedProduct;
  readonly loading = this.productsStore.selectedProductLoading;
  readonly saving = this.productsStore.selectedProductSaving;
  readonly error = this.productsStore.selectedProductError;

  readonly productId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('id'))),
    { initialValue: null }
  );

  readonly isArchived = computed(() => !!this.product()?.deletedAt);
  readonly hasTags = computed(() => (this.product()?.tags.length ?? 0) > 0);

  readonly mobileSentrixLoading = signal(false);
  readonly mobileSentrixError = signal<string | null>(null);
  readonly mobileSentrixMatch = signal<MobileSentrixSearchResult | null>(null);
  readonly mobileSentrixConnected = signal<boolean | null>(null);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    sku: ['', [Validators.maxLength(200)]],
    status: ['active' as ProductStatus, [Validators.required]],
    tagsText: [''],
  });

  public sellingPriceDisplay = '';
  public costDisplay = '';

  constructor() {
    effect(
      () => {
        const id = this.productId();
        if (!id) return;

        void this.productsStore.loadProduct(id);
      },
      { allowSignalWrites: true }
    );

    effect(
      () => {
        const product = this.product();
        if (!product) return;

        this.form.patchValue(
          {
            name: product.name,
            sku: product.sku ?? '',
            status: product.status,
            tagsText: product.tags.join(', '),
          },
          { emitEvent: false }
        );

        this.sellingPriceDisplay = this.formatCentsToDisplay(product.price);
        this.costDisplay = this.formatCentsToDisplay(product.cost);

        void this.loadMobileSentrixSnapshot();
      },
      { allowSignalWrites: true }
    );
  }

  async refresh(): Promise<void> {
    const id = this.productId();
    if (!id) return;

    await this.productsStore.loadProduct(id);
  }

  async archive(): Promise<void> {
    const product = this.product();
    if (!product) return;

    const ok = await this.productsStore.archiveProduct(product.id);
    if (ok) {
      await this.refresh();
    }
  }

  async restore(): Promise<void> {
    const product = this.product();
    if (!product) return;

    const restored = await this.productsStore.restoreProduct(product.id);
    if (restored) {
      await this.refresh();
    }
  }

  async save(): Promise<void> {
    const product = this.product();
    if (!product) return;

    this.normalizeSellingPriceDisplay();
    this.normalizeCostDisplay();
    this.form.markAllAsTouched();

    if (this.form.invalid) return;

    const priceCents = this.parseDisplayToCents(this.sellingPriceDisplay);
    const costCents = this.parseDisplayToCents(this.costDisplay);
    const raw = this.form.getRawValue();

    const payload: PatchProductPayload = {
      name: raw.name.trim(),
      sku: raw.sku.trim() || null,
      status: raw.status,
      priceCents: priceCents ?? 0,
      costCents: costCents,
      tags: this.parseTags(raw.tagsText),
    };

    const updated = await this.productsStore.patchProduct(product.id, payload);
    if (!updated) return;

    this.sellingPriceDisplay = this.formatCentsToDisplay(updated.price);
    this.costDisplay = this.formatCentsToDisplay(updated.cost);

    await this.loadMobileSentrixSnapshot();
  }

  onSellingPriceChange(value: string): void {
    this.sellingPriceDisplay = value;
  }

  onCostChange(value: string): void {
    this.costDisplay = value;
  }

  normalizeSellingPriceDisplay(): void {
    const cents = this.parseDisplayToCents(this.sellingPriceDisplay);
    this.sellingPriceDisplay = cents == null ? '' : this.formatCentsToDisplay(cents);
  }

  normalizeCostDisplay(): void {
    const cents = this.parseDisplayToCents(this.costDisplay);
    this.costDisplay = cents == null ? '' : this.formatCentsToDisplay(cents);
  }

  formatMoney(cents: number | null | undefined): string {
    if (cents == null) return '—';

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  }

  formatCentsToDisplay(value: number | null | undefined): string {
    if (value == null) return '';
    return (value / 100).toFixed(2);
  }

  parseDisplayToCents(value: string): number | null {
    if (!value?.trim()) return null;

    const normalized = value.replace(/[^0-9.]/g, '');
    const parsed = Number(normalized);

    if (!Number.isFinite(parsed)) return null;

    return Math.round(parsed * 100);
  }

  currentSupplierCostDiff(): number | null {
    const product = this.product();
    const snapshot = this.mobileSentrixMatch();

    if (!product || !snapshot) return null;
    if (product.cost == null || snapshot.costCents == null) return null;

    return snapshot.costCents - product.cost;
  }

  currentSupplierCostDiffAbs(): number | null {
    const diff = this.currentSupplierCostDiff();
    return diff == null ? null : Math.abs(diff);
  }

  currentSupplierCostDiffPercent(): number | null {
    const product = this.product();
    const diff = this.currentSupplierCostDiff();

    if (!product || diff == null || product.cost == null || product.cost <= 0) {
      return null;
    }

    return Math.round((Math.abs(diff) / product.cost) * 100);
  }

  currentSupplierCostTrend(): 'up' | 'down' | 'same' | null {
    const diff = this.currentSupplierCostDiff();
    if (diff == null) return null;
    if (diff > 0) return 'up';
    if (diff < 0) return 'down';
    return 'same';
  }

  private async loadMobileSentrixSnapshot(): Promise<void> {
    const product = this.product();
    if (!product) return;

    this.mobileSentrixLoading.set(true);
    this.mobileSentrixError.set(null);
    this.mobileSentrixMatch.set(null);

    try {
      const status = await firstValueFrom(this.mobileSentrixService.getStatus());
      this.mobileSentrixConnected.set(status.connected);

      if (!status.connected) return;

      const query = product.sku?.trim() || product.name.trim();
      if (!query) return;

      const response = await firstValueFrom(
        this.mobileSentrixService.search({
          q: query,
          maxResults: 10,
          startIndex: 0,
        })
      );

      const items = mapMobileSentrixItems(response.items);

      const match =
        items.find((item) => !!product.sku && !!item.sku && item.sku === product.sku) ??
        items.find((item) => item.title.toLowerCase() === product.name.toLowerCase()) ??
        items[0] ??
        null;

      this.mobileSentrixMatch.set(match);
    } catch (error) {
      console.error(error);
      this.mobileSentrixError.set('Unable to load MobileSentrix snapshot.');
    } finally {
      this.mobileSentrixLoading.set(false);
    }
  }

  private parseTags(value: string): string[] {
    return value
      .split(',')
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean)
      .filter((tag, index, array) => array.indexOf(tag) === index);
  }

  pricingSourcePriceCents(): number {
    const value = this.parseDisplayToCents(this.sellingPriceDisplay);
    return value ?? this.product()?.price ?? 0;
  }

  pricingSourceCostCents(): number | null {
    const value = this.parseDisplayToCents(this.costDisplay);
    if (value != null) return value;

    const product = this.product();
    return product?.cost ?? null;
  }

  profitCents(): number | null {
    const price = this.pricingSourcePriceCents();
    const cost = this.pricingSourceCostCents();

    if (cost == null) return null;
    return price - cost;
  }

  marginPercent(): number | null {
    const price = this.pricingSourcePriceCents();
    const profit = this.profitCents();

    if (profit == null || price <= 0) return null;
    return Math.round((profit / price) * 100);
  }

  markupPercent(): number | null {
    const cost = this.pricingSourceCostCents();
    const profit = this.profitCents();

    if (profit == null || cost == null || cost <= 0) return null;
    return Math.round((profit / cost) * 100);
  }

  suggestedPriceCents(): number | null {
    const cost = this.pricingSourceCostCents();
    if (cost == null) return null;

    const costDollars = cost / 100;
    const raw = costDollars * 1.8 + 40;

    // round up to nearest whole dollar then end in .99
    const rounded = Math.max(0.99, Math.ceil(raw) - 0.01);
    return Math.round(rounded * 100);
  }

  marginBarWidth(): number {
    const margin = this.marginPercent();
    if (margin == null) return 0;
    return Math.max(0, Math.min(100, margin));
  }

  marginTone(): 'low' | 'medium' | 'high' {
    const margin = this.marginPercent();
    if (margin == null) return 'low';
    if (margin >= 50) return 'high';
    if (margin >= 30) return 'medium';
    return 'low';
  }
}