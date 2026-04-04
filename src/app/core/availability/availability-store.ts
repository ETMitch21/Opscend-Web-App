import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AvailabilityService } from './availability-service';
import type {
  AvailabilityOverride,
  AvailabilityOverridesListParams,
  AvailabilityRule,
  AvailabilitySlot,
  AvailabilitySlotsParams,
  CreateAvailabilityOverrideDto,
  CreateAvailabilityRuleDto,
  UpdateAvailabilityRuleDto,
} from './availability-model';

@Injectable({
  providedIn: 'root',
})
export class AvailabilityStore {
  private readonly availabilityService = inject(AvailabilityService);

  private readonly _rules = signal<AvailabilityRule[]>([]);
  private readonly _overrides = signal<AvailabilityOverride[]>([]);
  private readonly _slots = signal<AvailabilitySlot[]>([]);

  private readonly _listLoading = signal(false);
  private readonly _saving = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly rules = this._rules.asReadonly();
  readonly overrides = this._overrides.asReadonly();
  readonly slots = this._slots.asReadonly();

  readonly listLoading = this._listLoading.asReadonly();
  readonly saving = this._saving.asReadonly();
  readonly error = this._error.asReadonly();

  readonly hasRules = computed(() => this._rules().length > 0);
  readonly hasOverrides = computed(() => this._overrides().length > 0);
  readonly hasSlots = computed(() => this._slots().length > 0);

  clearError(): void {
    this._error.set(null);
  }

  reset(): void {
    this._rules.set([]);
    this._overrides.set([]);
    this._slots.set([]);
    this._error.set(null);
  }

  clearSlots(): void {
    this._slots.set([]);
  }

  async loadRules(): Promise<AvailabilityRule[]> {
    this._listLoading.set(true);
    this._error.set(null);

    try {
      const response = await firstValueFrom(this.availabilityService.listRules());
      this._rules.set(response.data);
      return response.data;
    } catch (error) {
      this.handleError(error, 'Failed to load availability rules.');
      return [];
    } finally {
      this._listLoading.set(false);
    }
  }

  async createRule(payload: CreateAvailabilityRuleDto): Promise<AvailabilityRule | null> {
    this._saving.set(true);
    this._error.set(null);

    try {
      const rule = await firstValueFrom(this.availabilityService.createRule(payload));
      this._rules.update((current) => this.sortRules([rule, ...current]));
      return rule;
    } catch (error) {
      this.handleError(error, 'Failed to create availability rule.');
      return null;
    } finally {
      this._saving.set(false);
    }
  }

  async updateRule(id: string, payload: UpdateAvailabilityRuleDto): Promise<AvailabilityRule | null> {
    this._saving.set(true);
    this._error.set(null);

    try {
      const rule = await firstValueFrom(this.availabilityService.updateRule(id, payload));

      this._rules.update((current) =>
        this.sortRules(current.map((item) => (item.id === id ? rule : item)))
      );

      return rule;
    } catch (error) {
      this.handleError(error, 'Failed to update availability rule.');
      return null;
    } finally {
      this._saving.set(false);
    }
  }

  async deleteRule(id: string): Promise<boolean> {
    this._saving.set(true);
    this._error.set(null);

    try {
      await firstValueFrom(this.availabilityService.deleteRule(id));
      this._rules.update((current) => current.filter((item) => item.id !== id));
      return true;
    } catch (error) {
      this.handleError(error, 'Failed to delete availability rule.');
      return false;
    } finally {
      this._saving.set(false);
    }
  }

  async loadOverrides(params: AvailabilityOverridesListParams): Promise<AvailabilityOverride[]> {
    this._listLoading.set(true);
    this._error.set(null);

    try {
      const response = await firstValueFrom(this.availabilityService.listOverrides(params));
      this._overrides.set(response.data);
      return response.data;
    } catch (error) {
      this.handleError(error, 'Failed to load availability overrides.');
      return [];
    } finally {
      this._listLoading.set(false);
    }
  }

  async createOverride(payload: CreateAvailabilityOverrideDto): Promise<AvailabilityOverride | null> {
    this._saving.set(true);
    this._error.set(null);

    try {
      const override = await firstValueFrom(this.availabilityService.createOverride(payload));
      this._overrides.update((current) =>
        [...current, override].sort(
          (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
        )
      );
      return override;
    } catch (error) {
      this.handleError(error, 'Failed to create availability override.');
      return null;
    } finally {
      this._saving.set(false);
    }
  }

  async deleteOverride(id: string): Promise<boolean> {
    this._saving.set(true);
    this._error.set(null);

    try {
      await firstValueFrom(this.availabilityService.deleteOverride(id));
      this._overrides.update((current) => current.filter((item) => item.id !== id));
      return true;
    } catch (error) {
      this.handleError(error, 'Failed to delete availability override.');
      return false;
    } finally {
      this._saving.set(false);
    }
  }

  async loadSlots(params: AvailabilitySlotsParams): Promise<AvailabilitySlot[]> {
    this._listLoading.set(true);
    this._error.set(null);

    try {
      const response = await firstValueFrom(this.availabilityService.listSlots(params));
      this._slots.set(response.data);
      return response.data;
    } catch (error) {
      this.handleError(error, 'Failed to load available slots.');
      return [];
    } finally {
      this._listLoading.set(false);
    }
  }

  private sortRules(rules: AvailabilityRule[]): AvailabilityRule[] {
    const dayOrder: Record<string, number> = {
      mon: 1,
      tue: 2,
      wed: 3,
      thu: 4,
      fri: 5,
      sat: 6,
      sun: 7,
    };

    return [...rules].sort((a, b) => {
      const aUser = a.userId ?? '';
      const bUser = b.userId ?? '';

      if (aUser !== bUser) {
        return aUser.localeCompare(bUser);
      }

      const dayDiff = (dayOrder[a.dayOfWeek] ?? 99) - (dayOrder[b.dayOfWeek] ?? 99);
      if (dayDiff !== 0) {
        return dayDiff;
      }

      return a.startMin - b.startMin;
    });
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