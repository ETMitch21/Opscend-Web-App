import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import {
    AddContractorCapabilityRequest,
    ContractorListQuery,
    ContractorMetrics,
    ContractorProfile,
    CreateContractorWithUserRequest,
    UpdateContractorRequest,
} from './contractor.model';
import { ContractorsService } from './contractors-service';

@Injectable({
    providedIn: 'root',
})
export class ContractorsStore {
    private readonly contractorsService = inject(ContractorsService);

    private readonly _items = signal<ContractorProfile[]>([]);
    private readonly _selected = signal<ContractorProfile | null>(null);
    private readonly _loading = signal(false);
    private readonly _saving = signal(false);
    private readonly _error = signal<string | null>(null);
    private readonly _nextCursor = signal<string | null>(null);
    private readonly _loaded = signal(false);

    private readonly _selectedMetrics = signal<ContractorMetrics | null>(null);
    private readonly _metricsLoading = signal(false);

    readonly selectedMetrics = this._selectedMetrics.asReadonly();
    readonly metricsLoading = this._metricsLoading.asReadonly();

    readonly items = this._items.asReadonly();
    readonly selected = this._selected.asReadonly();
    readonly loading = this._loading.asReadonly();
    readonly saving = this._saving.asReadonly();
    readonly error = this._error.asReadonly();
    readonly nextCursor = this._nextCursor.asReadonly();
    readonly loaded = this._loaded.asReadonly();

    readonly hasItems = computed(() => this._items().length > 0);
    readonly hasMore = computed(() => !!this._nextCursor());

    async load(query: ContractorListQuery = { limit: 25 }): Promise<void> {
        this._loading.set(true);
        this._error.set(null);

        try {
            const res = await firstValueFrom(this.contractorsService.list(query));
            this._items.set(res ?? []);
            this._nextCursor.set(null);
            this._loaded.set(true);
        } catch (err: any) {
            this._error.set(err?.error?.error ?? 'Failed to load contractors.');
        } finally {
            this._loading.set(false);
        }
    }

    async loadMore(): Promise<void> {
        return;
    }

    async getById(id: string): Promise<ContractorProfile | null> {
        this._loading.set(true);
        this._error.set(null);

        try {
            const contractor = await firstValueFrom(
                this.contractorsService.getById(id)
            );

            this._selected.set(contractor);

            this._items.update((items) => {
                const index = items.findIndex((x) => x.id === contractor.id);
                if (index === -1) return [contractor, ...items];

                const copy = [...items];
                copy[index] = contractor;
                return copy;
            });

            return contractor;
        } catch (err: any) {
            this._error.set(err?.error?.error ?? 'Failed to load contractor.');
            return null;
        } finally {
            this._loading.set(false);
        }
    }

    async createWithUser(
        payload: CreateContractorWithUserRequest
    ): Promise<ContractorProfile | null> {
        this._saving.set(true);
        this._error.set(null);

        try {
            const created = await firstValueFrom(
                this.contractorsService.createWithUser(payload)
            );

            this._items.update((items) => [created, ...items]);
            this._selected.set(created);

            return created;
        } catch (err: any) {
            this._error.set(err?.error?.error ?? 'Failed to create contractor.');
            return null;
        } finally {
            this._saving.set(false);
        }
    }

    async update(
        id: string,
        payload: UpdateContractorRequest
    ): Promise<ContractorProfile | null> {
        this._saving.set(true);
        this._error.set(null);

        try {
            const updated = await firstValueFrom(
                this.contractorsService.update(id, payload)
            );

            this.upsertItem(updated);

            if (this._selected()?.id === updated.id) {
                this._selected.set(updated);
            }

            return updated;
        } catch (err: any) {
            this._error.set(err?.error?.error ?? 'Failed to update contractor.');
            return null;
        } finally {
            this._saving.set(false);
        }
    }

    async activate(id: string): Promise<ContractorProfile | null> {
        this._saving.set(true);
        this._error.set(null);

        try {
            const updated = await firstValueFrom(
                this.contractorsService.activate(id)
            );

            this.upsertItem(updated);

            if (this._selected()?.id === updated.id) {
                this._selected.set(updated);
            }

            return updated;
        } catch (err: any) {
            this._error.set(err?.error?.error ?? 'Failed to activate contractor.');
            return null;
        } finally {
            this._saving.set(false);
        }
    }

    async deactivate(id: string): Promise<ContractorProfile | null> {
        this._saving.set(true);
        this._error.set(null);

        try {
            const updated = await firstValueFrom(
                this.contractorsService.deactivate(id)
            );

            this.upsertItem(updated);

            if (this._selected()?.id === updated.id) {
                this._selected.set(updated);
            }

            return updated;
        } catch (err: any) {
            this._error.set(err?.error?.error ?? 'Failed to deactivate contractor.');
            return null;
        } finally {
            this._saving.set(false);
        }
    }

    async addCapability(
        contractorId: string,
        payload: AddContractorCapabilityRequest
    ): Promise<ContractorProfile | null> {
        this._saving.set(true);
        this._error.set(null);

        try {
            const updated = await firstValueFrom(
                this.contractorsService.addCapability(contractorId, payload)
            );

            this.upsertItem(updated);

            if (this._selected()?.id === updated.id) {
                this._selected.set(updated);
            }

            return updated;
        } catch (err: any) {
            this._error.set(err?.error?.error ?? 'Failed to add capability.');
            return null;
        } finally {
            this._saving.set(false);
        }
    }

    async removeCapability(
        contractorId: string,
        serviceId: string
    ): Promise<ContractorProfile | null> {
        this._saving.set(true);
        this._error.set(null);

        try {
            const updated = await firstValueFrom(
                this.contractorsService.removeCapability(contractorId, serviceId)
            );

            this.upsertItem(updated);

            if (this._selected()?.id === updated.id) {
                this._selected.set(updated);
            }

            return updated;
        } catch (err: any) {
            this._error.set(err?.error?.error ?? 'Failed to remove capability.');
            return null;
        } finally {
            this._saving.set(false);
        }
    }

    clearSelected(): void {
        this._selected.set(null);
        this._selectedMetrics.set(null);
    }

    clearError(): void {
        this._error.set(null);
    }

    private upsertItem(contractor: ContractorProfile): void {
        this._items.update((items) => {
            const index = items.findIndex((x) => x.id === contractor.id);

            if (index === -1) {
                return [contractor, ...items];
            }

            const copy = [...items];
            copy[index] = contractor;
            return copy;
        });
    }

    async getMetrics(id: string): Promise<ContractorMetrics | null> {
        this._metricsLoading.set(true);
        this._error.set(null);

        try {
            const metrics = await firstValueFrom(
                this.contractorsService.getMetrics(id)
            );

            this._selectedMetrics.set(metrics);

            return metrics;
        } catch (err: any) {
            this._error.set(err?.error?.error ?? 'Failed to load contractor metrics.');
            return null;
        } finally {
            this._metricsLoading.set(false);
        }
    }
}