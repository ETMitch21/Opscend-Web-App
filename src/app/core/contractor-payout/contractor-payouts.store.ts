import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ContractorPayoutsService } from './contractor-payouts.service';
import {
  ContractorPayout,
  ContractorPayoutBalance,
  ContractorPayoutListQuery,
  ContractorPayoutStatus,
} from './contractor-payout.model';

@Injectable({
  providedIn: 'root',
})
export class ContractorPayoutsStore {
  private readonly service = inject(ContractorPayoutsService);

  readonly items = signal<ContractorPayout[]>([]);
  readonly balance = signal<ContractorPayoutBalance | null>(null);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly counts = computed(() => {
    const payouts = this.items();

    return {
      all: payouts.length,
      pending: payouts.filter((payout) => payout.status === 'pending').length,
      approved: payouts.filter((payout) => payout.status === 'approved').length,
      processing: payouts.filter((payout) => payout.status === 'processing').length,
      paid: payouts.filter((payout) => payout.status === 'paid').length,
      failed: payouts.filter((payout) => payout.status === 'failed').length,
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

  readonly processingTotalCents = computed(() =>
    this.items()
      .filter((payout) => payout.status === 'processing')
      .reduce((total, payout) => total + payout.totalCents, 0)
  );

  readonly failedTotalCents = computed(() =>
    this.items()
      .filter((payout) => payout.status === 'failed')
      .reduce((total, payout) => total + payout.totalCents, 0)
  );

  readonly totalShopDebitCents = computed(() =>
    this.items()
      .filter((payout) => payout.status === 'paid')
      .reduce(
        (total, payout) => total + (payout.stripeShopDebitAmountCents ?? 0),
        0
      )
  );

  readonly totalShopDebitFeeCents = computed(() =>
    this.items()
      .filter((payout) => payout.status === 'paid')
      .reduce(
        (total, payout) => total + (payout.stripeShopDebitFeeCents ?? 0),
        0
      )
  );

  clearError(): void {
    this.error.set(null);
  }

  async load(query?: ContractorPayoutListQuery): Promise<ContractorPayout[]> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const [payouts, balance] = await Promise.all([
        firstValueFrom(this.service.list(query)),
        firstValueFrom(this.service.getBalance()).catch(() => null),
      ]);

      this.items.set(payouts);
      this.balance.set(balance);

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

  async refreshBalance(): Promise<ContractorPayoutBalance | null> {
    try {
      const balance = await firstValueFrom(this.service.getBalance());
      this.balance.set(balance);
      return balance;
    } catch {
      this.balance.set(null);
      return null;
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

  async process(payoutId: string): Promise<ContractorPayout | null> {
    this.saving.set(true);
    this.error.set(null);

    try {
      const payout = await firstValueFrom(this.service.process(payoutId));

      this.items.update((items) =>
        items.map((item) => (item.id === payout.id ? payout : item))
      );

      await this.refreshBalance();

      return payout;
    } catch (error: any) {
      this.error.set(
        error?.error?.message ??
          error?.error?.error ??
          'Unable to process contractor payout.'
      );
      await this.refreshBalance();
      return null;
    } finally {
      this.saving.set(false);
    }
  }
}