import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  AlertTriangle,
  ArrowRight,
  CircleDollarSign,
  CreditCard,
  Loader2,
  RefreshCw,
  Search,
  UserRound,
  WalletCards,
  Wrench,
  LucideAngularModule,
} from 'lucide-angular';
import { ReceivablesService } from '../../core/receivables/service';
import type {
  ReceivableRow,
  ReceivablesSnapshot,
} from '../../core/receivables/model';

type BalanceFilter = 'all' | 'unpaid' | 'partial' | 'issues';

@Component({
  selector: 'app-receivables',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, LucideAngularModule],
  templateUrl: './receivables.html',
  styleUrl: './receivables.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Receivables implements OnInit {
  private readonly receivablesService = inject(ReceivablesService);

  readonly icons = {
    AlertTriangle,
    ArrowRight,
    CircleDollarSign,
    CreditCard,
    Loader2,
    RefreshCw,
    Search,
    UserRound,
    WalletCards,
    Wrench,
  };

  readonly loading = signal(true);
  readonly refreshing = signal(false);
  readonly error = signal<string | null>(null);
  readonly snapshot = signal<ReceivablesSnapshot | null>(null);
  readonly search = signal('');
  readonly filter = signal<BalanceFilter>('all');

  readonly rows = computed(() => this.snapshot()?.rows ?? []);
  readonly summary = computed(() => this.snapshot()?.summary ?? null);

  readonly filteredRows = computed(() => {
    const search = this.search().trim().toLowerCase();
    const filter = this.filter();

    return this.rows().filter((row) => {
      if (filter === 'unpaid' && row.netPaidCents > 0) return false;
      if (filter === 'partial' && row.netPaidCents <= 0) return false;
      if (filter === 'issues' && !row.balanceMismatch) return false;

      if (!search) return true;

      const haystack = [
        row.orderNumber,
        row.customer?.name,
        row.customer?.email,
        row.customer?.phone,
        row.repair?.deviceName,
        row.repair?.problemSummary,
        row.repair?.id,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(search);
    });
  });

  ngOnInit(): void {
    void this.load();
  }

  async refresh(): Promise<void> {
    if (this.refreshing()) return;
    this.refreshing.set(true);
    await this.load(false);
    this.refreshing.set(false);
  }

  setFilter(filter: BalanceFilter): void {
    this.filter.set(filter);
  }

  money(cents: number | null | undefined): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format((Number(cents ?? 0) || 0) / 100);
  }

  customerName(row: ReceivableRow): string {
    return row.customer?.name?.trim() || row.customer?.email || row.customer?.phone || 'Unassigned customer';
  }

  customerDetail(row: ReceivableRow): string {
    return row.customer?.email || row.customer?.phone || 'No contact information';
  }

  statusLabel(row: ReceivableRow): string {
    return row.netPaidCents > 0 ? 'Partially paid' : 'Unpaid';
  }

  statusClass(row: ReceivableRow): string {
    return row.netPaidCents > 0
      ? 'bg-amber-50 text-amber-700 ring-amber-200'
      : 'bg-rose-50 text-rose-700 ring-rose-200';
  }

  repairStatusLabel(status: string | null | undefined): string {
    if (!status) return '';
    return status
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  date(value: string | null | undefined): string {
    if (!value) return '—';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '—';
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(parsed);
  }

  private async load(showLoader = true): Promise<void> {
    if (showLoader) this.loading.set(true);
    this.error.set(null);

    try {
      const response = await firstValueFrom(this.receivablesService.load());
      this.snapshot.set(response.data);
    } catch (error: any) {
      this.error.set(
        error?.error?.message ??
          error?.error?.error ??
          'Outstanding balances could not be loaded.',
      );
    } finally {
      this.loading.set(false);
    }
  }
}
