import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ContractorPayoutsService } from './contractor-payouts.service';
import {
  ContractorPayout,
  ContractorPayoutListQuery,
  ContractorPayoutStatus,
} from './contractor-payout.model';

@Injectable({
  providedIn: 'root',
})
export class ContractorPayoutsStore {
  private readonly service = inject(ContractorPayoutsService);

  readonly items = signal<ContractorPayout[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly counts = computed(() => {
    const payouts = this.items();

    return {
      all: payouts.length,
      pending: payouts.filter((payout) => payout.status === 'pending').length,
      approved: payouts.filter((payout) => payout.status === 'approved').length,
      paid: payouts.filter((payout) => payout.status === 'paid').length,
      disputed: payouts.filter((payout) => payout.status === 'disputed').length,
    };
  });

  readonly pendingTotalCents = computed(() =>
    this.items()
      .filter((payout) => payout.status === 'pending')
      .reduce((total, payout) => total + payout.totalCents, 0)
  );

  readonly approvedTotalCents = computed(() =>
    this.items()
      .filter((payout) => payout.status === 'approved')
      .reduce((total, payout) => total + payout.totalCents, 0)
  );

  readonly paidTotalCents = computed(() =>
    this.items()
      .filter((payout) => payout.status === 'paid')
      .reduce((total, payout) => total + payout.totalCents, 0)
  );

  clearError(): void {
    this.error.set(null);
  }

  async load(query?: ContractorPayoutListQuery): Promise<ContractorPayout[]> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const payouts = await firstValueFrom(this.service.list(query));
      this.items.set(payouts);
      return payouts;
    } catch (error: any) {
      this.error.set(
        error?.error?.message ??
        error?.error?.error ??
        'Unable to load contractor payouts.'
      );
      this.items.set([]);
      return [];
    } finally {
      this.loading.set(false);
    }
  }

  async updateStatus(
    payoutId: string,
    status: ContractorPayoutStatus
  ): Promise<ContractorPayout | null> {
    this.saving.set(true);
    this.error.set(null);

    try {
      const payout = await firstValueFrom(
        this.service.updateStatus(payoutId, { status })
      );

      this.items.update((items) =>
        items.map((item) => (item.id === payout.id ? payout : item))
      );

      return payout;
    } catch (error: any) {
      this.error.set(
        error?.error?.message ??
        error?.error?.error ??
        'Unable to update contractor payout.'
      );
      return null;
    } finally {
      this.saving.set(false);
    }
  }
}
