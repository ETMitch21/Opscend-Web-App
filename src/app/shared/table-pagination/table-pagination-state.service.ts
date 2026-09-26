import { Injectable, inject, signal, WritableSignal } from '@angular/core';
import { TenantService } from '../../core/tenant/tenant.service';

type PaginationState = {
  page: WritableSignal<number>;
  pageSize: WritableSignal<number>;
};

type StoredPaginationState = {
  page?: number;
  pageSize?: number;
};

@Injectable({ providedIn: 'root' })
export class TablePaginationStateService {
  private readonly tenant = inject(TenantService);
  private readonly states = new Map<string, PaginationState>();
  private readonly storagePrefix = 'opscend.table-pagination.v1.';

  slice<T>(storageKey: string, items: readonly T[] | null | undefined, defaultPageSize = 25): T[] {
    const list = items ? Array.from(items) : [];
    if (!list.length) return [];

    const state = this.getState(storageKey, defaultPageSize);
    const pageSize = this.normalizePageSize(state.pageSize(), defaultPageSize);
    const totalPages = Math.max(1, Math.ceil(list.length / pageSize));
    const page = Math.min(Math.max(1, state.page()), totalPages);
    const start = (page - 1) * pageSize;

    return list.slice(start, start + pageSize);
  }

  page(storageKey: string, defaultPageSize = 25): number {
    return this.getState(storageKey, defaultPageSize).page();
  }

  pageSize(storageKey: string, defaultPageSize = 25): number {
    return this.getState(storageKey, defaultPageSize).pageSize();
  }

  totalPages(storageKey: string, totalItems: number, defaultPageSize = 25): number {
    const pageSize = this.pageSize(storageKey, defaultPageSize);
    return Math.max(1, Math.ceil(Math.max(0, totalItems) / pageSize));
  }

  rangeStart(storageKey: string, totalItems: number, defaultPageSize = 25): number {
    if (totalItems <= 0) return 0;
    const page = Math.min(
      this.page(storageKey, defaultPageSize),
      this.totalPages(storageKey, totalItems, defaultPageSize),
    );
    return (page - 1) * this.pageSize(storageKey, defaultPageSize) + 1;
  }

  rangeEnd(storageKey: string, totalItems: number, defaultPageSize = 25): number {
    if (totalItems <= 0) return 0;
    const page = Math.min(
      this.page(storageKey, defaultPageSize),
      this.totalPages(storageKey, totalItems, defaultPageSize),
    );
    return Math.min(totalItems, page * this.pageSize(storageKey, defaultPageSize));
  }

  setPage(storageKey: string, page: number, totalItems?: number, defaultPageSize = 25): void {
    const state = this.getState(storageKey, defaultPageSize);
    let next = Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1;

    if (typeof totalItems === 'number') {
      next = Math.min(next, this.totalPages(storageKey, totalItems, defaultPageSize));
    }

    state.page.set(next);
    this.persist(storageKey, state);
  }

  setPageSize(storageKey: string, pageSize: number, totalItems?: number, defaultPageSize = 25): void {
    const state = this.getState(storageKey, defaultPageSize);
    const oldPageSize = this.normalizePageSize(state.pageSize(), defaultPageSize);
    const oldPage = Math.max(1, state.page());
    const firstVisibleIndex = (oldPage - 1) * oldPageSize;
    const nextPageSize = this.normalizePageSize(pageSize, defaultPageSize);
    let nextPage = Math.floor(firstVisibleIndex / nextPageSize) + 1;

    state.pageSize.set(nextPageSize);

    if (typeof totalItems === 'number') {
      const totalPages = Math.max(1, Math.ceil(Math.max(0, totalItems) / nextPageSize));
      nextPage = Math.min(nextPage, totalPages);
    }

    state.page.set(Math.max(1, nextPage));
    this.persist(storageKey, state);
  }

  clamp(storageKey: string, totalItems: number, defaultPageSize = 25): void {
    const state = this.getState(storageKey, defaultPageSize);
    const totalPages = this.totalPages(storageKey, totalItems, defaultPageSize);
    if (state.page() > totalPages) {
      state.page.set(totalPages);
      this.persist(storageKey, state);
    }
  }

  firstPage(storageKey: string, defaultPageSize = 25): void {
    this.setPage(storageKey, 1, undefined, defaultPageSize);
  }

  private getState(storageKey: string, defaultPageSize: number): PaginationState {
    const scopedKey = this.scopedKey(storageKey);
    const existing = this.states.get(scopedKey);
    if (existing) return existing;

    const stored = this.readStoredState(storageKey);
    const state: PaginationState = {
      page: signal(this.normalizePage(stored?.page)),
      pageSize: signal(this.normalizePageSize(stored?.pageSize, defaultPageSize)),
    };

    this.states.set(scopedKey, state);
    return state;
  }

  private readStoredState(storageKey: string): StoredPaginationState | null {
    if (typeof window === 'undefined') return null;

    try {
      const raw = window.localStorage.getItem(this.storagePrefix + this.scopedKey(storageKey));
      if (!raw) return null;
      return JSON.parse(raw) as StoredPaginationState;
    } catch {
      return null;
    }
  }

  private persist(storageKey: string, state: PaginationState): void {
    if (typeof window === 'undefined') return;

    try {
      window.localStorage.setItem(
        this.storagePrefix + this.scopedKey(storageKey),
        JSON.stringify({ page: state.page(), pageSize: state.pageSize() }),
      );
    } catch {
      // Pagination memory is a convenience. Do not block table interaction if storage is unavailable.
    }
  }

  private scopedKey(storageKey: string): string {
    const shopSlug = this.tenant.getShopSlug()?.trim().toLowerCase() || 'global';
    return `${shopSlug}.${storageKey}`;
  }

  private normalizePage(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : 1;
  }

  private normalizePageSize(value: unknown, fallback: number): number {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 250) {
      return Math.floor(parsed);
    }

    return Math.max(1, Math.min(250, Math.floor(fallback || 25)));
  }
}
