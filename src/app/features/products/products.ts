import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ChevronDownIcon, LucideAngularModule } from 'lucide-angular';

import { ProductsStore } from '../../core/products/products-store';
import {
  type Product,
  type ProductStatus,
} from '../../core/products/products-model';
import { ProductCreateDrawer } from '../../components/drawers/product-create-drawer/product-create-drawer';

type ProductViewFilter = 'all' | 'active' | 'inactive' | 'archived';

@Component({
  selector: 'app-products-overview',
  standalone: true,
  imports: [CommonModule, RouterLink, LucideAngularModule, ProductCreateDrawer],
  templateUrl: './products.html',
  styleUrl: './products.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Products {
  private readonly productsStore = inject(ProductsStore);

  readonly chevronDownIcon = ChevronDownIcon;

  readonly activeView = signal<ProductViewFilter>('all');
  readonly searchTerm = signal('');
  readonly selectedStatus = signal<ProductStatus | null>(null);
  readonly selectedTag = signal('');
  readonly includeArchived = signal(false);
  readonly allProductsForCounts = this.productsStore.allProductsForCounts;
  readonly countsLoading = signal(false);

  readonly createDrawerOpen = signal(false);

  readonly statuses: ReadonlyArray<ProductStatus> = ['active', 'inactive'];

  readonly products = this.productsStore.products;
  readonly loading = this.productsStore.productsLoading;
  readonly loadingMore = this.productsStore.productsLoadingMore;
  readonly error = this.productsStore.productsError;
  readonly nextCursor = this.productsStore.nextCursor;

  readonly counts = computed(() => {
    const products = this.allProductsForCounts();

    return {
      all: products.filter((p) => !p.deletedAt).length,
      active: products.filter((p) => !p.deletedAt && p.status === 'active').length,
      inactive: products.filter((p) => !p.deletedAt && p.status === 'inactive').length,
      archived: products.filter((p) => !!p.deletedAt).length,
    };
  });

  readonly filteredProducts = computed(() => {
    let list = [...this.products()];
    const activeView = this.activeView();
    const search = this.searchTerm().trim().toLowerCase();
    const tag = this.selectedTag().trim().toLowerCase();

    switch (activeView) {
      case 'active':
        list = list.filter((product) => !product.deletedAt && product.status === 'active');
        break;
      case 'inactive':
        list = list.filter((product) => !product.deletedAt && product.status === 'inactive');
        break;
      case 'archived':
        list = list.filter((product) => !!product.deletedAt);
        break;
      case 'all':
      default:
        list = list.filter((product) => !product.deletedAt);
        break;
    }

    if (tag) {
      list = list.filter((product) =>
        product.tags.some((productTag) => productTag.toLowerCase().includes(tag))
      );
    }

    if (search) {
      list = list.filter((product) => this.matchesSearch(product, search));
    }

    return list;
  });

  readonly activeFiltersSummary = computed(() => ({
    view: this.activeView(),
    status: this.selectedStatus(),
    tag: this.selectedTag().trim() || null,
    includeArchived: this.includeArchived(),
    searchTerm: this.searchTerm().trim() || null,
  }));

  constructor() {
    void this.reloadForCurrentFilters();
  }

  async refresh(): Promise<void> {
    await this.productsStore.refreshProducts();
  }

  async loadMore(): Promise<void> {
    await this.productsStore.loadMoreProducts();
  }

  async setView(view: ProductViewFilter): Promise<void> {
    this.activeView.set(view);

    switch (view) {
      case 'active':
        this.selectedStatus.set('active');
        break;
      case 'inactive':
        this.selectedStatus.set('inactive');
        break;
      case 'archived':
        this.selectedStatus.set(null);
        break;
      case 'all':
      default:
        this.selectedStatus.set(null);
        break;
    }

    await this.reloadForCurrentFilters();
  }

  async setStatus(status: ProductStatus | null): Promise<void> {
    this.selectedStatus.set(status);

    if (status === 'active') {
      this.activeView.set('active');
    } else if (status === 'inactive') {
      this.activeView.set('inactive');
    } else {
      this.activeView.set('all');
    }

    await this.reloadForCurrentFilters();
  }

  setSearchTerm(value: string): void {
    this.searchTerm.set(value);
  }

  async setTag(value: string): Promise<void> {
    this.selectedTag.set(value);
    await this.reloadForCurrentFilters();
  }

  async setIncludeArchived(value: boolean): Promise<void> {
    this.includeArchived.set(value);
    await this.reloadForCurrentFilters();
  }

  async archiveProduct(productId: string): Promise<void> {
    const ok = await this.productsStore.archiveProduct(productId);
    if (ok) {
      await this.reloadForCurrentFilters();
    }
  }

  async restoreProduct(productId: string): Promise<void> {
    const restored = await this.productsStore.restoreProduct(productId);
    if (restored) {
      await this.reloadForCurrentFilters();
    }
  }

  trackByProductId(_: number, product: Product): string {
    return product.id;
  }

  clearFilters(): void {
    this.activeView.set('all');
    this.selectedStatus.set(null);
    this.searchTerm.set('');
    this.selectedTag.set('');
    this.includeArchived.set(false);
  }

  formatMoney(cents: number | null | undefined): string {
    if (cents == null) return '—';

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  }

  openCreateDrawer(): void {
    this.createDrawerOpen.set(true);
  }

  closeCreateDrawer(): void {
    this.createDrawerOpen.set(false);
  }

  async handleProductCreated(): Promise<void> {
    this.createDrawerOpen.set(false);
    await this.refresh();
  }

  private matchesSearch(product: Product, search: string): boolean {
    return [
      product.id,
      product.name,
      product.sku ?? '',
      product.status,
      ...product.tags,
      product.createdBy,
    ]
      .join(' ')
      .toLowerCase()
      .includes(search);
  }

  private async reloadForCurrentFilters(): Promise<void> {
    this.productsStore.setFilters({
      status:
        this.activeView() === 'active'
          ? 'active'
          : this.activeView() === 'inactive'
            ? 'inactive'
            : undefined,
      tag: this.selectedTag().trim() || undefined,
      includeDeleted: this.activeView() === 'archived',
    });

    await Promise.all([
      this.productsStore.loadProducts(),
      this.productsStore.loadProductsForCounts(),
    ]);
  }
}