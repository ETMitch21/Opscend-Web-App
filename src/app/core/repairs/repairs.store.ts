import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { RepairsService } from './repairs-service';
import type {
    AttachmentListResponse,
    CreateRepairDto,
    CreateRepairNoteDto,
    CreateRepairOrderDto,
    Order,
    Repair,
    RepairAttachment,
    RepairListParams,
    RepairNote,
    RepairStatus,
    UpdateRepairDto,
} from './repair.model';

@Injectable({
    providedIn: 'root',
})
export class RepairsStore {
    private readonly repairsService = inject(RepairsService);

    private readonly _repairs = signal<Repair[]>([]);
    private readonly _selectedRepair = signal<Repair | null>(null);
    private readonly _nextCursor = signal<string | null>(null);

    private readonly _listLoading = signal(false);
    private readonly _detailLoading = signal(false);
    private readonly _saving = signal(false);
    private readonly _uploading = signal(false);

    private readonly _error = signal<string | null>(null);

    readonly repairs = this._repairs.asReadonly();
    readonly selectedRepair = this._selectedRepair.asReadonly();
    readonly nextCursor = this._nextCursor.asReadonly();

    readonly listLoading = this._listLoading.asReadonly();
    readonly detailLoading = this._detailLoading.asReadonly();
    readonly saving = this._saving.asReadonly();
    readonly uploading = this._uploading.asReadonly();

    readonly error = this._error.asReadonly();

    readonly hasRepairs = computed(() => this._repairs().length > 0);
    readonly hasNextPage = computed(() => !!this._nextCursor());
    readonly selectedRepairNotes = computed(() => this._selectedRepair()?.notes ?? []);
    readonly selectedRepairEvents = computed(() => this._selectedRepair()?.events ?? []);
    readonly selectedRepairAttachments = computed(() => this._selectedRepair()?.attachments ?? []);
    readonly selectedRepairAppointment = computed(() => this._selectedRepair()?.appointment ?? null);

    clearError(): void {
        this._error.set(null);
    }

    resetList(): void {
        this._repairs.set([]);
        this._nextCursor.set(null);
    }

    clearSelectedRepair(): void {
        this._selectedRepair.set(null);
    }

    async loadRepairs(params?: RepairListParams): Promise<void> {
        this._listLoading.set(true);
        this._error.set(null);

        try {
            const response = await firstValueFrom(this.repairsService.listRepairs(params));
            this._repairs.set(response.data);
            this._nextCursor.set(response.nextCursor);
        } catch (error) {
            this.handleError(error, 'Failed to load repairs.');
        } finally {
            this._listLoading.set(false);
        }
    }

    async loadMoreRepairs(params?: Omit<RepairListParams, 'cursor'>): Promise<void> {
        const cursor = this._nextCursor();
        if (!cursor || this._listLoading()) return;

        this._listLoading.set(true);
        this._error.set(null);

        try {
            const response = await firstValueFrom(
                this.repairsService.listRepairs({
                    ...params,
                    cursor,
                })
            );

            this._repairs.update((current) => [...current, ...response.data]);
            this._nextCursor.set(response.nextCursor);
        } catch (error) {
            this.handleError(error, 'Failed to load more repairs.');
        } finally {
            this._listLoading.set(false);
        }
    }

    async loadRepair(id: string): Promise<Repair | null> {
        this._detailLoading.set(true);
        this._error.set(null);

        try {
            const repair = await firstValueFrom(this.repairsService.getRepair(id));
            this._selectedRepair.set(repair);
            this.upsertRepairInList(repair);
            return repair;
        } catch (error) {
            this.handleError(error, 'Failed to load repair.');
            return null;
        } finally {
            this._detailLoading.set(false);
        }
    }

    async createRepair(payload: CreateRepairDto): Promise<Repair | null> {
        this._saving.set(true);
        this._error.set(null);

        try {
            const repair = await firstValueFrom(this.repairsService.createRepair(payload));
            this._selectedRepair.set(repair);
            this._repairs.update((current) => [repair, ...current]);
            return repair;
        } catch (error) {
            this.handleError(error, 'Failed to create repair.');
            return null;
        } finally {
            this._saving.set(false);
        }
    }

    async updateRepair(id: string, payload: UpdateRepairDto): Promise<Repair | null> {
        this._saving.set(true);
        this._error.set(null);

        try {
            const repair = await firstValueFrom(this.repairsService.updateRepair(id, payload));
            this._selectedRepair.set(repair);
            this.upsertRepairInList(repair);
            return repair;
        } catch (error) {
            this.handleError(error, 'Failed to update repair.');
            return null;
        } finally {
            this._saving.set(false);
        }
    }

    async updateRepairStatus(id: string, status: RepairStatus): Promise<Repair | null> {
        return this.updateRepair(id, { status });
    }

    async updateRepairTrackingEnabled(id: string, enabled: boolean): Promise<Repair | null> {
        return this.updateRepair(id, { publicTrackingEnabled: enabled });
    }

    async regeneratePublicTrackingToken(id: string): Promise<Repair | null> {
        this._saving.set(true);
        this._error.set(null);

        try {
            const repair = await firstValueFrom(
                this.repairsService.regeneratePublicTrackingToken(id)
            );

            this._selectedRepair.set(repair);
            this.upsertRepairInList(repair);

            return repair;
        } catch (error) {
            this.handleError(error, 'Failed to regenerate public tracking link.');
            return null;
        } finally {
            this._saving.set(false);
        }
    }

    async assignRepair(id: string, assignedTo: string | null): Promise<Repair | null> {
        return this.updateRepair(id, { assignedTo });
    }

    async linkOrder(id: string, orderId: string | null): Promise<Repair | null> {
        return this.updateRepair(id, { orderId });
    }

    async addNote(repairId: string, payload: CreateRepairNoteDto): Promise<RepairNote | null> {
        this._saving.set(true);
        this._error.set(null);

        try {
            const note = await firstValueFrom(this.repairsService.createNote(repairId, payload));

            if (this._selectedRepair()?.id === repairId) {
                this._selectedRepair.update((repair) =>
                    repair
                        ? {
                            ...repair,
                            notes: [note, ...repair.notes],
                        }
                        : repair
                );
            }

            this._repairs.update((repairs) =>
                repairs.map((repair) =>
                    repair.id === repairId
                        ? {
                            ...repair,
                            notes: [note, ...repair.notes],
                        }
                        : repair
                )
            );

            return note;
        } catch (error) {
            this.handleError(error, 'Failed to add repair note.');
            return null;
        } finally {
            this._saving.set(false);
        }
    }

    async createOrderFromRepair(repairId: string, payload: CreateRepairOrderDto): Promise<Order | null> {
        this._saving.set(true);
        this._error.set(null);

        try {
            const order = await firstValueFrom(this.repairsService.createOrderFromRepair(repairId, payload));

            if (this._selectedRepair()?.id === repairId) {
                this._selectedRepair.update((repair) =>
                    repair
                        ? {
                            ...repair,
                            orderId: order.id,
                            events: [
                                {
                                    id: `temp-order-link-${order.id}`,
                                    type: 'system',
                                    fromStatus: null,
                                    toStatus: null,
                                    message: `Order ${order.orderNumber} linked`,
                                    createdAt: new Date().toISOString(),
                                    createdBy: 'system',
                                },
                                ...repair.events,
                            ],
                        }
                        : repair
                );
            }

            this._repairs.update((repairs) =>
                repairs.map((repair) =>
                    repair.id === repairId
                        ? {
                            ...repair,
                            orderId: order.id,
                        }
                        : repair
                )
            );

            return order;
        } catch (error) {
            this.handleError(error, 'Failed to create order from repair.');
            return null;
        } finally {
            this._saving.set(false);
        }
    }

    async refreshAttachments(repairId: string): Promise<RepairAttachment[] | null> {
        this._uploading.set(true);
        this._error.set(null);

        try {
            const response: AttachmentListResponse = await firstValueFrom(
                this.repairsService.listAttachments(repairId)
            );

            this.patchRepairAttachments(repairId, response.data);
            return response.data;
        } catch (error) {
            this.handleError(error, 'Failed to load attachments.');
            return null;
        } finally {
            this._uploading.set(false);
        }
    }

    async uploadAttachment(repairId: string, file: File): Promise<RepairAttachment | null> {
        this._uploading.set(true);
        this._error.set(null);

        try {
            const attachment = await firstValueFrom(this.repairsService.uploadAttachment(repairId, file));

            if (this._selectedRepair()?.id === repairId) {
                this._selectedRepair.update((repair) =>
                    repair
                        ? {
                            ...repair,
                            attachments: [attachment, ...repair.attachments],
                        }
                        : repair
                );
            }

            this._repairs.update((repairs) =>
                repairs.map((repair) =>
                    repair.id === repairId
                        ? {
                            ...repair,
                            attachments: [attachment, ...repair.attachments],
                        }
                        : repair
                )
            );

            return attachment;
        } catch (error) {
            this.handleError(error, 'Failed to upload attachment.');
            return null;
        } finally {
            this._uploading.set(false);
        }
    }

    async deleteAttachment(repairId: string, attachmentId: string): Promise<boolean> {
        this._uploading.set(true);
        this._error.set(null);

        try {
            await firstValueFrom(this.repairsService.deleteAttachment(repairId, attachmentId));

            if (this._selectedRepair()?.id === repairId) {
                this._selectedRepair.update((repair) =>
                    repair
                        ? {
                            ...repair,
                            attachments: repair.attachments.filter((a) => a.id !== attachmentId),
                        }
                        : repair
                );
            }

            this._repairs.update((repairs) =>
                repairs.map((repair) =>
                    repair.id === repairId
                        ? {
                            ...repair,
                            attachments: repair.attachments.filter((a) => a.id !== attachmentId),
                        }
                        : repair
                )
            );

            return true;
        } catch (error) {
            this.handleError(error, 'Failed to delete attachment.');
            return false;
        } finally {
            this._uploading.set(false);
        }
    }

    async getAttachmentDownloadUrl(repairId: string, attachmentId: string): Promise<string | null> {
        this._error.set(null);

        try {
            const response = await firstValueFrom(
                this.repairsService.getAttachmentDownloadUrl(repairId, attachmentId)
            );
            return response.downloadUrl;
        } catch (error) {
            this.handleError(error, 'Failed to get attachment download URL.');
            return null;
        }
    }

    private upsertRepairInList(repair: Repair): void {
        this._repairs.update((current) => {
            const exists = current.some((item) => item.id === repair.id);
            if (!exists) return [repair, ...current];

            return current.map((item) => (item.id === repair.id ? repair : item));
        });
    }

    private patchRepairAttachments(repairId: string, attachments: RepairAttachment[]): void {
        if (this._selectedRepair()?.id === repairId) {
            this._selectedRepair.update((repair) =>
                repair
                    ? {
                        ...repair,
                        attachments,
                    }
                    : repair
            );
        }

        this._repairs.update((repairs) =>
            repairs.map((repair) =>
                repair.id === repairId
                    ? {
                        ...repair,
                        attachments,
                    }
                    : repair
            )
        );
    }

    private handleError(error: unknown, fallbackMessage: string): void {
        console.error(error);
        const message =
            typeof error === 'object' &&
                error !== null &&
                'error' in error &&
                typeof (error as { error?: unknown }).error === 'string'
                ? (error as { error: string }).error
                : fallbackMessage;

        this._error.set(message);
    }
}