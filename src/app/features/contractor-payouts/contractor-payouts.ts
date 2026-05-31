import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  CheckCircle2Icon,
  CircleDollarSignIcon,
  Clock3Icon,
  ExternalLinkIcon,
  Loader2Icon,
  LucideAngularModule,
} from 'lucide-angular';

import { ToastService } from '../../core/toast/toast-service';
import { ContractorPayoutsStore } from '../../core/contractor-payout/contractor-payouts.store';
import {
  ContractorPayout,
  ContractorPayoutStatus,
} from '../../core/contractor-payout/contractor-payout.model';

type PayoutFilter = 'pending' | 'approved' | 'paid' | 'all';

@Component({
  selector: 'app-contractor-payouts',
  standalone: true,
  imports: [CommonModule, RouterLink, LucideAngularModule],
  templateUrl: './contractor-payouts.html',
  styleUrl: './contractor-payouts.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContractorPayouts {
  private readonly toast = inject(ToastService);

  readonly payoutsStore = inject(ContractorPayoutsStore);

  readonly dollarIcon = CircleDollarSignIcon;
  readonly clockIcon = Clock3Icon;
  readonly checkIcon = CheckCircle2Icon;
  readonly externalLinkIcon = ExternalLinkIcon;
  readonly loaderIcon = Loader2Icon;

  readonly activeFilter = signal<PayoutFilter>('pending');

  readonly filteredPayouts = computed(() => {
    const filter = this.activeFilter();
    const payouts = [...this.payoutsStore.items()];

    if (filter === 'all') {
      return payouts;
    }

    return payouts.filter((payout) => payout.status === filter);
  });

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    await this.payoutsStore.load();

    if (this.payoutsStore.error()) {
      this.toast.error(
        'Payouts not loaded',
        this.payoutsStore.error() ?? 'Unable to load contractor payouts.'
      );
    }
  }

  setFilter(filter: PayoutFilter): void {
    this.activeFilter.set(filter);
  }

  async approvePayout(payout: ContractorPayout): Promise<void> {
    if (payout.status !== 'pending') return;

    const updated = await this.payoutsStore.updateStatus(payout.id, 'approved');

    if (!updated) {
      this.toast.error(
        'Payout not approved',
        this.payoutsStore.error() ?? 'Unable to approve this payout.'
      );
      return;
    }

    this.toast.success(
      'Payout approved',
      `${this.formatMoney(updated.totalCents)} is ready to be paid.`
    );
  }

  async markPaid(payout: ContractorPayout): Promise<void> {
    if (payout.status !== 'approved') return;

    const updated = await this.payoutsStore.updateStatus(payout.id, 'paid');

    if (!updated) {
      this.toast.error(
        'Payout not marked paid',
        this.payoutsStore.error() ?? 'Unable to mark this payout paid.'
      );
      return;
    }

    this.toast.success(
      'Payout marked paid',
      `${this.formatMoney(updated.totalCents)} has been marked paid.`
    );
  }

  contractorLabel(payout: ContractorPayout): string {
    return payout.contractorName || payout.contractorEmail || payout.contractorId;
  }

  contractorSubtext(payout: ContractorPayout): string {
    if (payout.contractorName && payout.contractorEmail) {
      return payout.contractorEmail;
    }

    return payout.contractorId;
  }

  repairLabel(payout: ContractorPayout): string {
    if (!payout.repairId) return 'No repair linked';

    return payout.repairSummary || `Repair ${payout.repairId}`;
  }

  prettyStatus(status: ContractorPayoutStatus): string {
    switch (status) {
      case 'pending':
        return 'Pending';
      case 'approved':
        return 'Approved';
      case 'paid':
        return 'Paid';
      case 'disputed':
        return 'Disputed';
      default:
        return status;
    }
  }

  statusPillClasses(status: ContractorPayoutStatus): string {
    switch (status) {
      case 'pending':
        return 'border-amber-200 bg-amber-50 text-amber-700';
      case 'approved':
        return 'border-blue-200 bg-blue-50 text-blue-700';
      case 'paid':
        return 'border-emerald-200 bg-emerald-50 text-emerald-700';
      case 'disputed':
        return 'border-red-200 bg-red-50 text-red-700';
      default:
        return 'border-gray-200 bg-gray-50 text-gray-600';
    }
  }

  filterButtonClasses(filter: PayoutFilter): string {
    return this.activeFilter() === filter
      ? 'border-brand text-brand'
      : 'border-transparent text-gray-500 hover:text-gray-900';
  }

  formatMoney(cents: number | null | undefined): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format((cents ?? 0) / 100);
  }

  formatDate(value: string | null | undefined): string {
    if (!value) return '—';

    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value));
  }
}
