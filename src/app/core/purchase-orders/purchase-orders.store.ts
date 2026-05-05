import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { PurchaseOrderService } from './purchase-orders.service';
import {
    CancelPurchaseOrderPayload,
    CreatePurchaseOrderItemPayload,
    CreatePurchaseOrderPayload,
    PatchPurchaseOrderItemPayload,
    PatchPurchaseOrderPayload,
    PurchaseOrder,
    PurchaseOrderListParams,
    PurchaseOrderStatus,
    ReceivePurchaseOrderPayload,
    SubmitPurchaseOrderPayload,
} from './purchase-orders.model';

type PurchaseOrderFilters = {
    limit: number;
    q?: string;
    supplierId?: string;
    status?: PurchaseOrderStatus;
    includeItems: boolean;
};

@Injectable({
    providedIn: 'root',
})
export class PurchaseOrderStore {
    private readonly service = inject(PurchaseOrderService);

    readonly purchaseOrders = signal<PurchaseOrder[]>([]);
    readonly loading = signal(false);
    readonly loadingMore = signal(false);
    readonly loaded = signal(false);
    readonly error = signal<string | null>(null);
    readonly nextCursor = signal<string | null>(null);

    readonly selectedPurchaseOrder = signal<PurchaseOrder | null>(null);
    readonly selectedLoading = signal(false);
    readonly selectedSaving = signal(false);
    readonly selectedError = signal<string | null>(null);

    readonly filters = signal<PurchaseOrderFilters>({
        limit: 25,
        q: undefined,
        supplierId: undefined,
        status: undefined,
        includeItems: false,
    });

    readonly hasPurchaseOrders = computed(() => this.purchaseOrders().length > 0);
    readonly hasMore = computed(() => !!this.nextCursor());

    readonly draftCount = computed(() =>
        this.purchaseOrders().filter((po) => po.status === 'draft').length
    );

    readonly submittedCount = computed(() =>
        this.purchaseOrders().filter((po) => po.status === 'submitted').length
    );

    readonly partiallyReceivedCount = computed(() =>
        this.purchaseOrders().filter((po) => po.status === 'partially_received').length
    );

    readonly receivedCount = computed(() =>
        this.purchaseOrders().filter((po) => po.status === 'received').length
    );

    readonly canceledCount = computed(() =>
        this.purchaseOrders().filter((po) => po.status === 'canceled').length
    );

    readonly openCount = computed(() =>
        this.purchaseOrders().filter((po) =>
            po.status === 'draft' ||
            po.status === 'submitted' ||
            po.status === 'partially_received'
        ).length
    );

    readonly totalOpenValueCents = computed(() =>
        this.purchaseOrders()
            .filter((po) =>
                po.status === 'draft' ||
                po.status === 'submitted' ||
                po.status === 'partially_received'
            )
            .reduce((sum, po) => sum + po.totalCents, 0)
    );

    clear(): void {
        this.purchaseOrders.set([]);
        this.nextCursor.set(null);
        this.loaded.set(false);
        this.error.set(null);
    }

    clearSelected(): void {
        this.selectedPurchaseOrder.set(null);
        this.selectedError.set(null);
    }

    clearErrors(): void {
        this.error.set(null);
        this.selectedError.set(null);
    }

    setFilters(patch: Partial<PurchaseOrderFilters>): void {
        this.filters.update((current) => ({
            ...current,
            ...patch,
        }));
    }

    resetFilters(): void {
        this.filters.set({
            limit: 25,
            q: undefined,
            supplierId: undefined,
            status: undefined,
            includeItems: false,
        });
    }

    private buildListParams(overrides?: Partial<PurchaseOrderListParams>): PurchaseOrderListParams {
        const filters = this.filters();

        return {
            limit: filters.limit,
            q: filters.q,
            supplierId: filters.supplierId,
            status: filters.status,
            includeItems: filters.includeItems,
            ...overrides,
        };
    }

    private upsertPurchaseOrder(order: PurchaseOrder): void {
        this.purchaseOrders.update((current) => {
            const index = current.findIndex((item) => item.id === order.id);

            if (index === -1) {
                return [order, ...current];
            }

            const copy = [...current];
            copy[index] = order;
            return copy;
        });

        const selected = this.selectedPurchaseOrder();
        if (selected?.id === order.id) {
            this.selectedPurchaseOrder.set(order);
        }
    }

    private removePurchaseOrder(id: string): void {
        this.purchaseOrders.update((current) => current.filter((item) => item.id !== id));

        const selected = this.selectedPurchaseOrder();
        if (selected?.id === id) {
            this.selectedPurchaseOrder.set(null);
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

    async loadPurchaseOrders(
        overrides?: Partial<PurchaseOrderListParams>
    ): Promise<PurchaseOrder[]> {
        this.loading.set(true);
        this.error.set(null);

        try {
            const response = await firstValueFrom(
                this.service.listPurchaseOrders(this.buildListParams(overrides))
            );

            this.purchaseOrders.set(response.data);
            this.nextCursor.set(response.nextCursor);
            this.loaded.set(true);

            return response.data;
        } catch (error: any) {
            this.error.set(this.getErrorMessage(error, 'Unable to load purchase orders.'));
            return [];
        } finally {
            this.loading.set(false);
        }
    }

    async refreshPurchaseOrders(): Promise<PurchaseOrder[]> {
        return this.loadPurchaseOrders({ cursor: null });
    }

    async loadMorePurchaseOrders(): Promise<PurchaseOrder[]> {
        const cursor = this.nextCursor();
        if (!cursor || this.loadingMore()) return [];

        this.loadingMore.set(true);
        this.error.set(null);

        try {
            const response = await firstValueFrom(
                this.service.listPurchaseOrders(this.buildListParams({ cursor }))
            );

            this.purchaseOrders.update((current) => {
                const seen = new Set(current.map((item) => item.id));
                const incoming = response.data.filter((item) => !seen.has(item.id));
                return [...current, ...incoming];
            });

            this.nextCursor.set(response.nextCursor);
            this.loaded.set(true);

            return response.data;
        } catch (error: any) {
            this.error.set(this.getErrorMessage(error, 'Unable to load more purchase orders.'));
            return [];
        } finally {
            this.loadingMore.set(false);
        }
    }

    async loadPurchaseOrder(id: string): Promise<PurchaseOrder | null> {
        this.selectedLoading.set(true);
        this.selectedError.set(null);

        try {
            const order = await firstValueFrom(this.service.getPurchaseOrder(id));

            this.selectedPurchaseOrder.set(order);
            this.upsertPurchaseOrder(order);

            return order;
        } catch (error: any) {
            this.selectedError.set(
                this.getErrorMessage(error, 'Unable to load purchase order.')
            );
            return null;
        } finally {
            this.selectedLoading.set(false);
        }
    }

    async createPurchaseOrder(
        payload: CreatePurchaseOrderPayload
    ): Promise<PurchaseOrder | null> {
        this.selectedSaving.set(true);
        this.error.set(null);
        this.selectedError.set(null);

        try {
            const order = await firstValueFrom(this.service.createPurchaseOrder(payload));

            this.upsertPurchaseOrder(order);
            this.selectedPurchaseOrder.set(order);

            return order;
        } catch (error: any) {
            this.selectedError.set(
                this.getErrorMessage(error, 'Unable to create purchase order.')
            );
            return null;
        } finally {
            this.selectedSaving.set(false);
        }
    }

    async updatePurchaseOrder(
        id: string,
        payload: PatchPurchaseOrderPayload
    ): Promise<PurchaseOrder | null> {
        this.selectedSaving.set(true);
        this.selectedError.set(null);

        try {
            const order = await firstValueFrom(this.service.updatePurchaseOrder(id, payload));

            this.upsertPurchaseOrder(order);

            return order;
        } catch (error: any) {
            this.selectedError.set(
                this.getErrorMessage(error, 'Unable to update purchase order.')
            );
            return null;
        } finally {
            this.selectedSaving.set(false);
        }
    }

    async addItem(
        id: string,
        payload: CreatePurchaseOrderItemPayload
    ): Promise<PurchaseOrder | null> {
        this.selectedSaving.set(true);
        this.selectedError.set(null);

        try {
            const order = await firstValueFrom(this.service.addPurchaseOrderItem(id, payload));

            this.upsertPurchaseOrder(order);

            return order;
        } catch (error: any) {
            this.selectedError.set(
                this.getErrorMessage(error, 'Unable to add purchase order item.')
            );
            return null;
        } finally {
            this.selectedSaving.set(false);
        }
    }

    async updateItem(
        id: string,
        itemId: string,
        payload: PatchPurchaseOrderItemPayload
    ): Promise<PurchaseOrder | null> {
        this.selectedSaving.set(true);
        this.selectedError.set(null);

        try {
            const order = await firstValueFrom(
                this.service.updatePurchaseOrderItem(id, itemId, payload)
            );

            this.upsertPurchaseOrder(order);

            return order;
        } catch (error: any) {
            this.selectedError.set(
                this.getErrorMessage(error, 'Unable to update purchase order item.')
            );
            return null;
        } finally {
            this.selectedSaving.set(false);
        }
    }

    async deleteItem(id: string, itemId: string): Promise<PurchaseOrder | null> {
        this.selectedSaving.set(true);
        this.selectedError.set(null);

        try {
            const order = await firstValueFrom(
                this.service.deletePurchaseOrderItem(id, itemId)
            );

            this.upsertPurchaseOrder(order);

            return order;
        } catch (error: any) {
            this.selectedError.set(
                this.getErrorMessage(error, 'Unable to delete purchase order item.')
            );
            return null;
        } finally {
            this.selectedSaving.set(false);
        }
    }

    async submitPurchaseOrder(
        id: string,
        payload?: SubmitPurchaseOrderPayload
    ): Promise<PurchaseOrder | null> {
        this.selectedSaving.set(true);
        this.selectedError.set(null);

        try {
            const order = await firstValueFrom(
                this.service.submitPurchaseOrder(id, payload)
            );

            this.upsertPurchaseOrder(order);

            return order;
        } catch (error: any) {
            this.selectedError.set(
                this.getErrorMessage(error, 'Unable to submit purchase order.')
            );
            return null;
        } finally {
            this.selectedSaving.set(false);
        }
    }

    async cancelPurchaseOrder(
        id: string,
        payload?: CancelPurchaseOrderPayload
    ): Promise<PurchaseOrder | null> {
        this.selectedSaving.set(true);
        this.selectedError.set(null);

        try {
            const order = await firstValueFrom(
                this.service.cancelPurchaseOrder(id, payload)
            );

            this.upsertPurchaseOrder(order);

            return order;
        } catch (error: any) {
            this.selectedError.set(
                this.getErrorMessage(error, 'Unable to cancel purchase order.')
            );
            return null;
        } finally {
            this.selectedSaving.set(false);
        }
    }

    async receivePurchaseOrder(
        id: string,
        payload: ReceivePurchaseOrderPayload
    ): Promise<PurchaseOrder | null> {
        this.selectedSaving.set(true);
        this.selectedError.set(null);

        try {
            const order = await firstValueFrom(
                this.service.receivePurchaseOrder(id, payload)
            );

            this.upsertPurchaseOrder(order);

            return order;
        } catch (error: any) {
            this.selectedError.set(
                this.getErrorMessage(error, 'Unable to receive purchase order.')
            );
            return null;
        } finally {
            this.selectedSaving.set(false);
        }
    }
}