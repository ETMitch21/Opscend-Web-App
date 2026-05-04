import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { LucideAngularModule, SearchIcon, XIcon } from 'lucide-angular';
import { firstValueFrom } from 'rxjs';

import { ProductsStore } from '../../../core/products/products-store';
import { MobileSentrixService } from '../../../core/mobilesentrix/mobilesentrix-service';
import { mapMobileSentrixItems } from '../../../core/mobilesentrix/mobilesentrix-search-mapper';
import { MobileSentrixSearchResult } from '../../../core/mobilesentrix/mobilesentrix-model';

@Component({
  selector: 'app-product-create-drawer',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, LucideAngularModule],
  templateUrl: './product-create-drawer.html',
  styleUrl: './product-create-drawer.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductCreateDrawer {
  private readonly fb = inject(FormBuilder);
  private readonly productsStore = inject(ProductsStore);
  private readonly mobileSentrixService = inject(MobileSentrixService);

  @Output() closed = new EventEmitter<void>();
  @Output() created = new EventEmitter<string>();

  readonly searchIcon = SearchIcon;
  readonly xIcon = XIcon;

  readonly isOpen = signal(true);

  readonly searching = signal(false);
  readonly searchError = signal<string | null>(null);
  readonly searchTerm = signal('');
  readonly searchResults = signal<MobileSentrixSearchResult[]>([]);
  readonly selectedSearchResult = signal<MobileSentrixSearchResult | null>(null);

  readonly submitted = signal(false);

  readonly saving = this.productsStore.selectedProductSaving;
  readonly saveError = this.productsStore.selectedProductError;

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    sku: ['', [Validators.maxLength(200)]],
    priceCents: [0, [Validators.required, Validators.min(0)]],
    costCents: [0, [Validators.min(0)]],
    status: ['active' as 'active' | 'inactive', [Validators.required]],
    tagsText: [''],
  });

  public sellingPriceDisplay = '';
  public costDisplay = '';

  readonly hasSearchResults = computed(() => this.searchResults().length > 0);
  readonly canSearch = computed(() => this.searchTerm().trim().length >= 2);

  readonly selectedResultSummary = computed(() => {
    const selected = this.selectedSearchResult();
    if (!selected) return null;

    return [selected.supplier ?? null, selected.sku ?? null]
      .filter(Boolean)
      .join(' • ');
  });

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

  onSellingPriceChange(value: string): void {
    this.sellingPriceDisplay = value;

    const cents = this.parseDisplayToCents(value);
    this.form.controls.priceCents.setValue(cents ?? 0);
    this.form.controls.priceCents.markAsDirty();
    this.form.controls.priceCents.markAsTouched();
    this.form.controls.priceCents.updateValueAndValidity({ emitEvent: false });
  }

  onCostChange(value: string): void {
    this.costDisplay = value;

    const cents = this.parseDisplayToCents(value);
    this.form.controls.costCents.setValue(cents ?? 0);
    this.form.controls.costCents.markAsDirty();
    this.form.controls.costCents.markAsTouched();
    this.form.controls.costCents.updateValueAndValidity({ emitEvent: false });
  }

  normalizeSellingPriceDisplay(): void {
    const cents = this.parseDisplayToCents(this.sellingPriceDisplay);
    this.form.controls.priceCents.setValue(cents ?? 0);
    this.sellingPriceDisplay = cents == null ? '' : this.formatCentsToDisplay(cents);
  }

  normalizeCostDisplay(): void {
    const cents = this.parseDisplayToCents(this.costDisplay);
    this.form.controls.costCents.setValue(cents ?? 0);
    this.costDisplay = cents == null ? '' : this.formatCentsToDisplay(cents);
  }

  async searchMobileSentrix(): Promise<void> {
    const term = this.searchTerm().trim();
    if (term.length < 2) return;

    this.searching.set(true);
    this.searchError.set(null);

    try {
      const response = await firstValueFrom(
        this.mobileSentrixService.search({
          q: term,
          maxResults: 25,
          startIndex: 0,
        })
      );

      this.searchResults.set(mapMobileSentrixItems(response.items));
    } catch (error) {
      console.error(error);
      this.searchError.set('Unable to search MobileSentrix right now.');
      this.searchResults.set([]);
    } finally {
      this.searching.set(false);
    }
  }

  selectSearchResult(result: MobileSentrixSearchResult): void {
    this.selectedSearchResult.set(result);

    const costCents = result.costCents ?? 0;
    const priceCents = result.costCents ?? 0;

    this.form.patchValue({
      name: result.title,

      // Important:
      // Product.sku is now the shop/internal SKU only.
      // MobileSentrix SKU will be sent through supplierLink on submit.
      sku: '',

      costCents,
      priceCents,
    });

    this.costDisplay = this.formatCentsToDisplay(costCents);
    this.sellingPriceDisplay = this.formatCentsToDisplay(priceCents);

    const currentTags = this.parseTags(this.form.controls.tagsText.value);
    const mergedTags = new Set([
      ...currentTags,
      'mobilesentrix',
      ...(result.category ? [result.category.toLowerCase()] : []),
      ...(result.tags ?? []),
    ]);

    this.form.patchValue({
      tagsText: Array.from(mergedTags).join(', '),
    });
  }

  clearSelectedSearchResult(): void {
    this.selectedSearchResult.set(null);
  }

  setSearchTerm(value: string): void {
    this.searchTerm.set(value);
  }

  async submit(): Promise<void> {
    this.submitted.set(true);

    this.normalizeSellingPriceDisplay();
    this.normalizeCostDisplay();

    this.form.markAllAsTouched();

    if (this.form.invalid) return;

    const raw = this.form.getRawValue();
    const selectedMobileSentrixItem = this.selectedSearchResult();

    const created = await this.productsStore.createProduct({
      name: raw.name.trim(),

      // Internal/shop SKU only.
      // If this product came from MobileSentrix, this should usually stay null.
      sku: raw.sku.trim() || null,

      priceCents: Number(raw.priceCents) || 0,
      costCents: raw.costCents > 0 ? Number(raw.costCents) : null,
      tags: this.parseTags(raw.tagsText),

      ...(selectedMobileSentrixItem?.sku
        ? {
          supplierLink: {
            provider: 'mobilesentrix',
            supplierName: 'MobileSentrix',

            supplierSku: selectedMobileSentrixItem.sku,
            supplierProductId: selectedMobileSentrixItem.id ?? null,
            supplierProductName: selectedMobileSentrixItem.title,
            supplierUrl: selectedMobileSentrixItem.link ?? null,

            lastKnownCostCents: selectedMobileSentrixItem.costCents ?? null,
            lastKnownInStock: selectedMobileSentrixItem.inStock ?? null,

            isPreferred: true,
          },
        }
        : {}),
    });

    if (!created) return;

    this.created.emit(created.id);
    this.close();
  }

  close(): void {
    this.isOpen.set(false);
    this.closed.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.close();
    }
  }

  private parseTags(value: string): string[] {
    return value
      .split(',')
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean)
      .filter((tag, index, array) => array.indexOf(tag) === index);
  }
}