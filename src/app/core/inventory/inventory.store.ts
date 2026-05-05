import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { InventoryService } from './inventory.service';
import {
    InventoryAdjustPayload,
    InventoryBalance,
    InventoryBalancePatchPayload,
    InventoryListParams,
    InventoryMovement,
    InventoryMovementListParams,
} from './inventory.model';

type InventoryFilters = {
    limit: number;
    q?: string;
    locationId?: string;
    lowStockOnly: boolean;
    outOfStockOnly: boolean;
    includeInactiveProducts: boolean;
};

@Injectable({
    providedIn: 'root',
})
export class InventoryStore {
    private readonly service = inject(InventoryService);

    readonly balances = signal<InventoryBalance[]>([]);
    readonly balancesLoading = signal(false);
    readonly balancesLoadingMore = signal(false);
    readonly balancesLoaded = signal(false);
    readonly balancesError = signal<string | null>(null);
    readonly balancesNextCursor = signal<string | null>(null);

    readonly selectedBalance = signal<InventoryBalance | null>(null);
    readonly selectedBalanceLoading = signal(false);
    readonly selectedBalanceSaving = signal(false);
    readonly selectedBalanceError = signal<string | null>(null);

    readonly movements = signal<InventoryMovement[]>([]);
    readonly movementsLoading = signal(false);
    readonly movementsLoadingMore = signal(false);
    readonly movementsError = signal<string | null>(null);
    readonly movementsNextCursor = signal<string | null>(null);

    readonly filters = signal<InventoryFilters>({
        limit: 25,
        q: undefined,
        locationId: undefined,
        lowStockOnly: false,
        outOfStockOnly: false,
        includeInactiveProducts: false,
    });

    readonly hasBalances = computed(() => this.balances().length > 0);
    readonly hasMoreBalances = computed(() => !!this.balancesNextCursor());
    readonly hasMovements = computed(() => this.movements().length > 0);
    readonly hasMoreMovements = computed(() => !!this.movementsNextCursor());

    readonly totalOnHandQty = computed(() =>
        this.balances().reduce((sum, balance) => sum + balance.onHandQty, 0)
    );

    readonly totalReservedQty = computed(() =>
        this.balances().reduce((sum, balance) => sum + balance.reservedQty, 0)
    );

    readonly totalAvailableQty = computed(() =>
        this.balances().reduce((sum, balance) => sum + balance.availableQty, 0)
    );

    readonly lowStockCount = computed(() =>
        this.balances().filter((balance) => {
            if (balance.reorderPointQty == null) return false;
            return balance.onHandQty <= balance.reorderPointQty;
        }).length
    );

    readonly outOfStockCount = computed(() =>
        this.balances().filter((balance) => balance.onHandQty <= 0).length
    );

    clearBalances(): void {
        this.balances.set([]);
        this.balancesNextCursor.set(null);
        this.balancesLoaded.set(false);
    }

    clearSelectedBalance(): void {
        this.selectedBalance.set(null);
    }

    clearMovements(): void {
        this.movements.set([]);
        this.movementsNextCursor.set(null);
    }

    clearErrors(): void {
        this.balancesError.set(null);
        this.selectedBalanceError.set(null);
        this.movementsError.set(null);
    }

    setFilters(patch: Partial<InventoryFilters>): void {
        this.filters.update((current) => ({
            ...current,
            ...patch,
        }));
    }

    resetFilters(): void {
        this.filters.set({
            limit: 25,
            q: undefined,
            locationId: undefined,
            lowStockOnly: false,
            outOfStockOnly: false,
            includeInactiveProducts: false,
        });
    }

    private buildListParams(overrides?: Partial<InventoryListParams>): InventoryListParams {
        const filters = this.filters();

        return {
            limit: filters.limit,
            q: filters.q,
            locationId: filters.locationId,
            lowStockOnly: filters.lowStockOnly,
            outOfStockOnly: filters.outOfStockOnly,
            includeInactiveProducts: filters.includeInactiveProducts,
            ...overrides,
        };
    }

    private upsertBalanceInList(balance: InventoryBalance): void {
        this.balances.update((current) => {
            const index = current.findIndex((item) => item.id === balance.id);

            if (index === -1) {
                return [balance, ...current];
            }

            const copy = [...current];
            copy[index] = balance;
            return copy;
        });
    }

    private setBalancesError(error: any, fallback: string): void {
        this.balancesError.set(
            error?.error?.message ??
            error?.error?.error ??
            fallback
        );
    }

    private setSelectedBalanceError(error: any, fallback: string): void {
        this.selectedBalanceError.set(
            error?.error?.message ??
            error?.error?.error ??
            fallback
        );
    }

    private setMovementsError(error: any, fallback: string): void {
        this.movementsError.set(
            error?.error?.message ??
            error?.error?.error ??
            fallback
        );
    }

    async loadBalances(overrides?: Partial<InventoryListParams>): Promise<InventoryBalance[]> {
        this.balancesLoading.set(true);
        this.balancesError.set(null);

        try {
            const response = await firstValueFrom(
                this.service.listProducts(this.buildListParams(overrides))
            );

            this.balances.set(response.data);
            this.balancesNextCursor.set(response.nextCursor);
            this.balancesLoaded.set(true);

            return response.data;
        } catch (error: any) {
            this.setBalancesError(error, 'Unable to load inventory.');
            return [];
        } finally {
            this.balancesLoading.set(false);
        }
    }

    async refreshBalances(): Promise<InventoryBalance[]> {
        return this.loadBalances({ cursor: null });
    }

    async loadMoreBalances(): Promise<InventoryBalance[]> {
        const cursor = this.balancesNextCursor();
        if (!cursor || this.balancesLoadingMore()) return [];

        this.balancesLoadingMore.set(true);
        this.balancesError.set(null);

        try {
            const response = await firstValueFrom(
                this.service.listProducts(this.buildListParams({ cursor }))
            );

            this.balances.update((current) => {
                const seen = new Set(current.map((item) => item.id));
                const incoming = response.data.filter((item) => !seen.has(item.id));
                return [...current, ...incoming];
            });

            this.balancesNextCursor.set(response.nextCursor);
            this.balancesLoaded.set(true);

            return response.data;
        } catch (error: any) {
            this.setBalancesError(error, 'Unable to load more inventory.');
            return [];
        } finally {
            this.balancesLoadingMore.set(false);
        }
    }

    async loadProductBalance(
        productId: string,
        locationId?: string
    ): Promise<InventoryBalance | null> {
        this.selectedBalanceLoading.set(true);
        this.selectedBalanceError.set(null);

        try {
            const balance = await firstValueFrom(
                this.service.getProductBalance(productId, { locationId })
            );

            this.selectedBalance.set(balance);
            this.upsertBalanceInList(balance);

            return balance;
        } catch (error: any) {
            this.setSelectedBalanceError(error, 'Unable to load product inventory.');
            return null;
        } finally {
            this.selectedBalanceLoading.set(false);
        }
    }

    async updateProductBalance(
        productId: string,
        payload: InventoryBalancePatchPayload
    ): Promise<InventoryBalance | null> {
        this.selectedBalanceSaving.set(true);
        this.selectedBalanceError.set(null);
        this.balancesError.set(null);

        try {
            const balance = await firstValueFrom(
                this.service.updateProductBalance(productId, payload)
            );

            this.selectedBalance.set(balance);
            this.upsertBalanceInList(balance);

            return balance;
        } catch (error: any) {
            this.setSelectedBalanceError(error, 'Unable to update inventory settings.');
            return null;
        } finally {
            this.selectedBalanceSaving.set(false);
        }
    }

    async adjustProductStock(
        productId: string,
        payload: InventoryAdjustPayload
    ): Promise<InventoryBalance | null> {
        this.selectedBalanceSaving.set(true);
        this.selectedBalanceError.set(null);
        this.balancesError.set(null);

        try {
            const balance = await firstValueFrom(
                this.service.adjustProductStock(productId, payload)
            );

            this.selectedBalance.set(balance);
            this.upsertBalanceInList(balance);

            return balance;
        } catch (error: any) {
            this.setSelectedBalanceError(error, 'Unable to adjust stock.');
            return null;
        } finally {
            this.selectedBalanceSaving.set(false);
        }
    }

    async loadProductMovements(
        productId: string,
        params?: InventoryMovementListParams
    ): Promise<InventoryMovement[]> {
        this.movementsLoading.set(true);
        this.movementsError.set(null);

        try {
            const response = await firstValueFrom(
                this.service.listProductMovements(productId, {
                    limit: 25,
                    ...params,
                })
            );

            this.movements.set(response.data);
            this.movementsNextCursor.set(response.nextCursor);

            return response.data;
        } catch (error: any) {
            this.setMovementsError(error, 'Unable to load inventory movements.');
            return [];
        } finally {
            this.movementsLoading.set(false);
        }
    }

    async loadMoreProductMovements(
        productId: string,
        params?: InventoryMovementListParams
    ): Promise<InventoryMovement[]> {
        const cursor = this.movementsNextCursor();
        if (!cursor || this.movementsLoadingMore()) return [];

        this.movementsLoadingMore.set(true);
        this.movementsError.set(null);

        try {
            const response = await firstValueFrom(
                this.service.listProductMovements(productId, {
                    limit: 25,
                    ...params,
                    cursor,
                })
            );

            this.movements.update((current) => {
                const seen = new Set(current.map((item) => item.id));
                const incoming = response.data.filter((item) => !seen.has(item.id));
                return [...current, ...incoming];
            });

            this.movementsNextCursor.set(response.nextCursor);

            return response.data;
        } catch (error: any) {
            this.setMovementsError(error, 'Unable to load more inventory movements.');
            return [];
        } finally {
            this.movementsLoadingMore.set(false);
        }
    }
}