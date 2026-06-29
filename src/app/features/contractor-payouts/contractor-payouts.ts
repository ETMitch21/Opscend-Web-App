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
  WalletCardsIcon,
} from 'lucide-angular';

import { ToastService } from '../../core/toast/toast-service';
import { ContractorPayoutsStore } from '../../core/contractor-payout/contractor-payouts.store';
import {
  ContractorPayout,
  ContractorPayoutStatus,
} from '../../core/contractor-payout/contractor-payout.model';

type PayoutFilter =
  | 'pending'
  | 'approved'
  | 'processing'
  | 'paid'
  | 'failed'
  | 'all';

type ActivityTone = 'done' | 'active' | 'error' | 'muted';

type PayoutActivityEvent = {
  label: string;
  value: string;
  detail: string | null;
  tone: ActivityTone;
};

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
  readonly walletIcon = WalletCardsIcon;

  readonly activeFilter = signal<PayoutFilter>('all');

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
    if (payout.status !== 'pending' && payout.status !== 'failed') return;

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
      `${this.formatMoney(updated.totalCents)} is ready to process.`
    );
  }

  async processPayout(payout: ContractorPayout): Promise<void> {
    if (payout.status !== 'approved') return;

    const updated = await this.payoutsStore.process(payout.id);

    if (!updated) {
      this.toast.error(
        'Payout not processed',
        this.payoutsStore.error() ?? 'Unable to process this payout.'
      );
      return;
    }

    this.toast.success(
      'Payout processed',
      `${this.formatMoney(updated.totalCents)} was sent through Stripe.`
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

  shopDebitLabel(payout: ContractorPayout): string {
    if (!payout.stripeShopDebitAmountCents) return '—';

    const fee = payout.stripeShopDebitFeeCents ?? 0;

    return `${this.formatMoney(payout.stripeShopDebitAmountCents)} shop debit · ${this.formatMoney(fee)} fee`;
  }

  activityLog(payout: ContractorPayout): PayoutActivityEvent[] {
    const events: PayoutActivityEvent[] = [
      {
        label: 'Created',
        value: this.formatDate(payout.createdAt),
        detail: 'Payout ledger entry created.',
        tone: 'done',
      },
    ];

    if (payout.approvedAt) {
      events.push({
        label: 'Approved',
        value: this.formatDate(payout.approvedAt),
        detail: payout.approvedBy
          ? `Approved by ${payout.approvedBy}`
          : 'Approved for Stripe processing.',
        tone: 'done',
      });
    } else {
      events.push({
        label: 'Approval',
        value: 'Waiting',
        detail: 'Admin review is still pending.',
        tone: payout.status === 'pending' ? 'active' : 'muted',
      });
    }

    if (payout.processingAt) {
      events.push({
        label: 'Processing',
        value: this.formatDate(payout.processingAt),
        detail: 'Stripe payout processing started.',
        tone: payout.status === 'processing' ? 'active' : 'done',
      });
    }

    if (payout.stripeShopDebitPaymentId) {
      events.push({
        label: 'Shop debit',
        value: this.formatMoney(payout.stripeShopDebitAmountCents ?? 0),
        detail: `Fee: ${this.formatMoney(
          payout.stripeShopDebitFeeCents ?? 0
        )} · ${this.shortStripeId(payout.stripeShopDebitPaymentId)}`,
        tone: 'done',
      });
    }

    if (payout.stripeTransferId) {
      events.push({
        label: 'Contractor transfer',
        value: this.formatMoney(payout.totalCents),
        detail: this.shortStripeId(payout.stripeTransferId),
        tone: 'done',
      });
    }

    if (payout.paidAt) {
      events.push({
        label: 'Paid',
        value: this.formatDate(payout.paidAt),
        detail: 'Contractor payout completed successfully.',
        tone: 'done',
      });
    }

    if (payout.failedAt) {
      events.push({
        label: 'Failed',
        value: this.formatDate(payout.failedAt),
        detail: payout.failureReason || 'Stripe processing failed.',
        tone: 'error',
      });
    }

    if (
      payout.status === 'approved' &&
      !payout.processingAt &&
      !payout.stripeTransferId
    ) {
      events.push({
        label: 'Next step',
        value: 'Process payout',
        detail: 'Ready to debit the shop and transfer funds to the contractor.',
        tone: 'active',
      });
    }

    return events;
  }

  activityDotClasses(tone: ActivityTone): string {
    switch (tone) {
      case 'done':
        return 'bg-emerald-500';
      case 'active':
        return 'bg-blue-500';
      case 'error':
        return 'bg-red-500';
      case 'muted':
      default:
        return 'bg-gray-300';
    }
  }

  activityCardClasses(tone: ActivityTone): string {
    switch (tone) {
      case 'done':
        return 'border-emerald-100 bg-emerald-50/50';
      case 'active':
        return 'border-blue-100 bg-blue-50/50';
      case 'error':
        return 'border-red-100 bg-red-50/70';
      case 'muted':
      default:
        return 'border-gray-100 bg-gray-50/70';
    }
  }

  shortStripeId(value: string | null | undefined): string {
    if (!value) return '—';

    if (value.length <= 16) return value;

    return `${value.slice(0, 10)}…${value.slice(-6)}`;
  }

  prettyStatus(status: ContractorPayoutStatus): string {
    switch (status) {
      case 'pending':
        return 'Pending';
      case 'held':
        return 'Held';
      case 'approved':
        return 'Approved';
      case 'processing':
        return 'Processing';
      case 'paid':
        return 'Paid';
      case 'failed':
        return 'Failed';
      case 'disputed':
        return 'Disputed';
      case 'canceled':
        return 'Canceled';
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
      case 'processing':
        return 'border-purple-200 bg-purple-50 text-purple-700';
      case 'paid':
        return 'border-emerald-200 bg-emerald-50 text-emerald-700';
      case 'failed':
      case 'disputed':
        return 'border-red-200 bg-red-50 text-red-700';
      case 'held':
        return 'border-orange-200 bg-orange-50 text-orange-700';
      case 'canceled':
        return 'border-gray-200 bg-gray-50 text-gray-600';
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