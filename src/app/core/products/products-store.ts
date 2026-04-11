import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ProductsService } from './products-service';
import {
  CreateProductPayload,
  PatchProductPayload,
  Product,
  ProductListParams,
  ProductStatus,
} from './products-model';

type ProductListFilters = {
  limit: number;
  status?: ProductStatus;
  tag?: string;
  includeDeleted: boolean;
};

@Injectable({
  providedIn: 'root',
})
export class ProductsStore {
  private readonly service = inject(ProductsService);

  readonly products = signal<Product[]>([]);
  readonly productsLoading = signal(false);
  readonly productsLoadingMore = signal(false);
  readonly productsLoaded = signal(false);
  readonly productsError = signal<string | null>(null);
  readonly nextCursor = signal<string | null>(null);

  readonly selectedProduct = signal<Product | null>(null);
  readonly selectedProductLoading = signal(false);
  readonly selectedProductSaving = signal(false);
  readonly selectedProductError = signal<string | null>(null);

  readonly filters = signal<ProductListFilters>({
    limit: 25,
    status: undefined,
    tag: undefined,
    includeDeleted: false,
  });

  readonly hasProducts = computed(() => this.products().length > 0);
  readonly hasMoreProducts = computed(() => !!this.nextCursor());
  readonly hasSelectedProduct = computed(() => !!this.selectedProduct());

  readonly activeProducts = computed(() =>
    this.products().filter((product) => product.status === 'active')
  );

  readonly inactiveProducts = computed(() =>
    this.products().filter((product) => product.status === 'inactive')
  );

  readonly productCount = computed(() => this.products().length);

  clearProducts(): void {
    this.products.set([]);
    this.nextCursor.set(null);
    this.productsLoaded.set(false);
  }

  clearSelectedProduct(): void {
    this.selectedProduct.set(null);
  }

  clearErrors(): void {
    this.productsError.set(null);
    this.selectedProductError.set(null);
  }

  setFilters(patch: Partial<ProductListFilters>): void {
    this.filters.update((current) => ({
      ...current,
      ...patch,
    }));
  }

  resetFilters(): void {
    this.filters.set({
      limit: 25,
      status: undefined,
      tag: undefined,
      includeDeleted: false,
    });
  }

  private buildListParams(overrides?: Partial<ProductListParams>): ProductListParams {
    const filters = this.filters();

    return {
      limit: filters.limit,
      status: filters.status,
      tag: filters.tag,
      includeDeleted: filters.includeDeleted,
      ...overrides,
    };
  }

  private upsertProductInList(product: Product): void {
    this.products.update((current) => {
      const index = current.findIndex((item) => item.id === product.id);

      if (index === -1) {
        return [product, ...current];
      }

      const copy = [...current];
      copy[index] = product;
      return copy;
    });
  }

  private removeProductFromList(productId: string): void {
    this.products.update((current) => current.filter((item) => item.id !== productId));
  }

  private setProductsError(error: any, fallback: string): void {
    this.productsError.set(
      error?.error?.message ??
      error?.error?.error ??
      fallback
    );
  }

  private setSelectedProductError(error: any, fallback: string): void {
    this.selectedProductError.set(
      error?.error?.message ??
      error?.error?.error ??
      fallback
    );
  }

  async loadProducts(overrides?: Partial<ProductListParams>): Promise<Product[]> {
    this.productsLoading.set(true);
    this.productsError.set(null);

    try {
      const response = await firstValueFrom(this.service.list(this.buildListParams(overrides)));
      this.products.set(response.data);
      this.nextCursor.set(response.nextCursor);
      this.productsLoaded.set(true);
      return response.data;
    } catch (error: any) {
      this.setProductsError(error, 'Unable to load products.');
      return [];
    } finally {
      this.productsLoading.set(false);
    }
  }

  async refreshProducts(): Promise<Product[]> {
    return this.loadProducts({ cursor: null });
  }

  async loadMoreProducts(): Promise<Product[]> {
    const cursor = this.nextCursor();
    if (!cursor || this.productsLoadingMore()) return [];

    this.productsLoadingMore.set(true);
    this.productsError.set(null);

    try {
      const response = await firstValueFrom(
        this.service.list(this.buildListParams({ cursor }))
      );

      this.products.update((current) => {
        const seen = new Set(current.map((item) => item.id));
        const incoming = response.data.filter((item) => !seen.has(item.id));
        return [...current, ...incoming];
      });

      this.nextCursor.set(response.nextCursor);
      this.productsLoaded.set(true);

      return response.data;
    } catch (error: any) {
      this.setProductsError(error, 'Unable to load more products.');
      return [];
    } finally {
      this.productsLoadingMore.set(false);
    }
  }

  async loadProduct(productId: string): Promise<Product | null> {
    this.selectedProductLoading.set(true);
    this.selectedProductError.set(null);

    try {
      const product = await firstValueFrom(this.service.getById(productId));
      this.selectedProduct.set(product);
      this.upsertProductInList(product);
      return product;
    } catch (error: any) {
      this.setSelectedProductError(error, 'Unable to load product.');
      return null;
    } finally {
      this.selectedProductLoading.set(false);
    }
  }

  async createProduct(payload: CreateProductPayload): Promise<Product | null> {
    this.selectedProductSaving.set(true);
    this.selectedProductError.set(null);
    this.productsError.set(null);

    try {
      const product = await firstValueFrom(this.service.create(payload));
      this.selectedProduct.set(product);

      const filters = this.filters();
      const matchesStatus = !filters.status || product.status === filters.status;
      const matchesTag = !filters.tag || product.tags.includes(filters.tag);

      if (matchesStatus && matchesTag && !filters.includeDeleted) {
        this.products.update((current) => [product, ...current]);
      }

      return product;
    } catch (error: any) {
      this.setSelectedProductError(error, 'Unable to create product.');
      return null;
    } finally {
      this.selectedProductSaving.set(false);
    }
  }

  async patchProduct(productId: string, payload: PatchProductPayload): Promise<Product | null> {
    this.selectedProductSaving.set(true);
    this.selectedProductError.set(null);
    this.productsError.set(null);

    try {
      const product = await firstValueFrom(this.service.patchProduct(productId, payload));
      this.selectedProduct.set(product);
      this.upsertProductInList(product);
      return product;
    } catch (error: any) {
      this.setSelectedProductError(error, 'Unable to update product.');
      return null;
    } finally {
      this.selectedProductSaving.set(false);
    }
  }

  async archiveProduct(productId: string): Promise<boolean> {
    this.selectedProductSaving.set(true);
    this.selectedProductError.set(null);
    this.productsError.set(null);

    try {
      await firstValueFrom(this.service.archive(productId));

      this.removeProductFromList(productId);

      const selected = this.selectedProduct();
      if (selected?.id === productId) {
        this.selectedProduct.set(null);
      }

      return true;
    } catch (error: any) {
      this.setSelectedProductError(error, 'Unable to archive product.');
      return false;
    } finally {
      this.selectedProductSaving.set(false);
    }
  }

  async restoreProduct(productId: string): Promise<Product | null> {
    this.selectedProductSaving.set(true);
    this.selectedProductError.set(null);
    this.productsError.set(null);

    try {
      const product = await firstValueFrom(this.service.restore(productId));
      this.selectedProduct.set(product);

      const filters = this.filters();
      const matchesStatus = !filters.status || product.status === filters.status;
      const matchesTag = !filters.tag || product.tags.includes(filters.tag);

      if (matchesStatus && matchesTag && !filters.includeDeleted) {
        this.upsertProductInList(product);
      }

      return product;
    } catch (error: any) {
      this.setSelectedProductError(error, 'Unable to restore product.');
      return null;
    } finally {
      this.selectedProductSaving.set(false);
    }
  }

  readonly allProductsForCounts = signal<Product[]>([]);

  async loadProductsForCounts(): Promise<Product[]> {
    try {
      const response = await firstValueFrom(
        this.service.list({
          limit: 100,
          includeDeleted: true,
        })
      );

      this.allProductsForCounts.set(response.data);
      return response.data;
    } catch (error) {
      this.allProductsForCounts.set([]);
      return [];
    }
  }
}