import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { SupplierService } from './suppliers.service';
import {
    CreateSupplierPayload,
    PatchSupplierPayload,
    Supplier,
    SupplierListParams,
    SupplierProvider,
    SupplierStatus,
} from './suppliers.model';

type SupplierFilters = {
    limit: number;
    q?: string;
    provider?: SupplierProvider;
    status?: SupplierStatus;
    includeDeleted: boolean;
};

@Injectable({
    providedIn: 'root',
})
export class SupplierStore {
    private readonly service = inject(SupplierService);

    readonly suppliers = signal<Supplier[]>([]);
    readonly suppliersLoading = signal(false);
    readonly suppliersLoadingMore = signal(false);
    readonly suppliersLoaded = signal(false);
    readonly suppliersError = signal<string | null>(null);
    readonly suppliersNextCursor = signal<string | null>(null);

    readonly selectedSupplier = signal<Supplier | null>(null);
    readonly selectedSupplierLoading = signal(false);
    readonly selectedSupplierSaving = signal(false);
    readonly selectedSupplierError = signal<string | null>(null);

    readonly filters = signal<SupplierFilters>({
        limit: 100,
        q: undefined,
        provider: undefined,
        status: 'active',
        includeDeleted: false,
    });

    readonly activeSuppliers = computed(() =>
        this.suppliers().filter((supplier) => supplier.status === 'active' && !supplier.deletedAt)
    );

    readonly mobileSentrixSupplier = computed(() =>
        this.activeSuppliers().find((supplier) => supplier.provider === 'mobilesentrix') ?? null
    );

    readonly hasSuppliers = computed(() => this.suppliers().length > 0);
    readonly hasMore = computed(() => !!this.suppliersNextCursor());

    clear(): void {
        this.suppliers.set([]);
        this.suppliersNextCursor.set(null);
        this.suppliersLoaded.set(false);
        this.suppliersError.set(null);
    }

    clearSelected(): void {
        this.selectedSupplier.set(null);
        this.selectedSupplierError.set(null);
    }

    setFilters(patch: Partial<SupplierFilters>): void {
        this.filters.update((current) => ({
            ...current,
            ...patch,
        }));
    }

    private buildListParams(overrides?: Partial<SupplierListParams>): SupplierListParams {
        const filters = this.filters();

        return {
            limit: filters.limit,
            q: filters.q,
            provider: filters.provider,
            status: filters.status,
            includeDeleted: filters.includeDeleted,
            ...overrides,
        };
    }

    private upsertSupplier(supplier: Supplier): void {
        this.suppliers.update((current) => {
            const index = current.findIndex((item) => item.id === supplier.id);

            if (index === -1) {
                return [supplier, ...current];
            }

            const copy = [...current];
            copy[index] = supplier;
            return copy;
        });

        const selected = this.selectedSupplier();
        if (selected?.id === supplier.id) {
            this.selectedSupplier.set(supplier);
        }
    }

    private getErrorMessage(error: any, fallback: string): string {
        return (
            error?.error?.message ??
            error?.error?.error ??
            error?.message ??
            fallback
        );
    }

    async loadSuppliers(overrides?: Partial<SupplierListParams>): Promise<Supplier[]> {
        this.suppliersLoading.set(true);
        this.suppliersError.set(null);

        try {
            const response = await firstValueFrom(
                this.service.listSuppliers(this.buildListParams(overrides))
            );

            this.suppliers.set(response.data);
            this.suppliersNextCursor.set(response.nextCursor);
            this.suppliersLoaded.set(true);

            return response.data;
        } catch (error: any) {
            this.suppliersError.set(this.getErrorMessage(error, 'Unable to load suppliers.'));
            return [];
        } finally {
            this.suppliersLoading.set(false);
        }
    }

    async refreshSuppliers(): Promise<Supplier[]> {
        return this.loadSuppliers({ cursor: null });
    }

    async loadMoreSuppliers(): Promise<Supplier[]> {
        const cursor = this.suppliersNextCursor();
        if (!cursor || this.suppliersLoadingMore()) return [];

        this.suppliersLoadingMore.set(true);
        this.suppliersError.set(null);

        try {
            const response = await firstValueFrom(
                this.service.listSuppliers(this.buildListParams({ cursor }))
            );

            this.suppliers.update((current) => {
                const seen = new Set(current.map((item) => item.id));
                const incoming = response.data.filter((item) => !seen.has(item.id));
                return [...current, ...incoming];
            });

            this.suppliersNextCursor.set(response.nextCursor);
            this.suppliersLoaded.set(true);

            return response.data;
        } catch (error: any) {
            this.suppliersError.set(this.getErrorMessage(error, 'Unable to load more suppliers.'));
            return [];
        } finally {
            this.suppliersLoadingMore.set(false);
        }
    }

    async loadSupplier(id: string): Promise<Supplier | null> {
        this.selectedSupplierLoading.set(true);
        this.selectedSupplierError.set(null);

        try {
            const supplier = await firstValueFrom(this.service.getSupplier(id));

            this.selectedSupplier.set(supplier);
            this.upsertSupplier(supplier);

            return supplier;
        } catch (error: any) {
            this.selectedSupplierError.set(
                this.getErrorMessage(error, 'Unable to load supplier.')
            );
            return null;
        } finally {
            this.selectedSupplierLoading.set(false);
        }
    }

    async createSupplier(payload: CreateSupplierPayload): Promise<Supplier | null> {
        this.selectedSupplierSaving.set(true);
        this.selectedSupplierError.set(null);
        this.suppliersError.set(null);

        try {
            const supplier = await firstValueFrom(this.service.createSupplier(payload));

            this.upsertSupplier(supplier);
            this.selectedSupplier.set(supplier);

            return supplier;
        } catch (error: any) {
            this.selectedSupplierError.set(
                this.getErrorMessage(error, 'Unable to create supplier.')
            );
            return null;
        } finally {
            this.selectedSupplierSaving.set(false);
        }
    }

    async updateSupplier(
        id: string,
        payload: PatchSupplierPayload
    ): Promise<Supplier | null> {
        this.selectedSupplierSaving.set(true);
        this.selectedSupplierError.set(null);
        this.suppliersError.set(null);

        try {
            const supplier = await firstValueFrom(this.service.updateSupplier(id, payload));

            this.upsertSupplier(supplier);

            return supplier;
        } catch (error: any) {
            this.selectedSupplierError.set(
                this.getErrorMessage(error, 'Unable to update supplier.')
            );
            return null;
        } finally {
            this.selectedSupplierSaving.set(false);
        }
    }

    async archiveSupplier(id: string): Promise<boolean> {
        this.selectedSupplierSaving.set(true);
        this.selectedSupplierError.set(null);
        this.suppliersError.set(null);

        try {
            await firstValueFrom(this.service.archiveSupplier(id));

            this.suppliers.update((current) => current.filter((supplier) => supplier.id !== id));

            if (this.selectedSupplier()?.id === id) {
                this.selectedSupplier.set(null);
            }

            return true;
        } catch (error: any) {
            this.selectedSupplierError.set(
                this.getErrorMessage(error, 'Unable to archive supplier.')
            );
            return false;
        } finally {
            this.selectedSupplierSaving.set(false);
        }
    }

    async restoreSupplier(id: string): Promise<Supplier | null> {
        this.selectedSupplierSaving.set(true);
        this.selectedSupplierError.set(null);
        this.suppliersError.set(null);

        try {
            const supplier = await firstValueFrom(this.service.restoreSupplier(id));

            this.upsertSupplier(supplier);
            this.selectedSupplier.set(supplier);

            return supplier;
        } catch (error: any) {
            this.selectedSupplierError.set(
                this.getErrorMessage(error, 'Unable to restore supplier.')
            );
            return null;
        } finally {
            this.selectedSupplierSaving.set(false);
        }
    }
}