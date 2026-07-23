import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock3,
  CreditCard,
  DollarSign,
  Download,
  House,
  ListTodo,
  Loader2,
  MessageSquareQuote,
  PackageCheck,
  Receipt,
  RefreshCw,
  Smartphone,
  Store,
  Timer,
  TrendingUp,
  Users,
  Wrench,
  LucideAngularModule,
  type LucideIconData,
} from 'lucide-angular';

import { AnalyticsService } from '../../core/analytics/service';
import type {
  AnalyticsComparisonMetric,
  AnalyticsOverview,
  AnalyticsRange,
} from '../../core/analytics/model';

interface AnalyticsMetricCard {
  key: keyof AnalyticsOverview['metrics'];
  label: string;
  value: string;
  detail: string;
  metric: AnalyticsComparisonMetric;
  icon: LucideIconData;
  iconClass: string;
  toneClass: string;
  favorableDirection: 'up' | 'down';
}

interface AnalyticsStateCard {
  key: string;
  label: string;
  value: string;
  detail: string;
  icon: LucideIconData;
  className: string;
}

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './analytics.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Analytics implements OnInit {
  private readonly analyticsService = inject(AnalyticsService);

  readonly icons = {
    AlertTriangle,
    BarChart3,
    CheckCircle2,
    Clock3,
    CreditCard,
    DollarSign,
    Download,
    House,
    ListTodo,
    Loader2,
    MessageSquareQuote,
    PackageCheck,
    Receipt,
    RefreshCw,
    Smartphone,
    Store,
    Timer,
    TrendingUp,
    Users,
    Wrench,
  };

  readonly ranges: ReadonlyArray<{ label: string; value: AnalyticsRange }> = [
    { label: '7D', value: '7d' },
    { label: '30D', value: '30d' },
    { label: '90D', value: '90d' },
    { label: '1Y', value: '365d' },
  ];

  readonly selectedRange = signal<AnalyticsRange>('30d');
  readonly report = signal<AnalyticsOverview | null>(null);
  readonly loading = signal(true);
  readonly refreshing = signal(false);
  readonly error = signal<string | null>(null);

  readonly metricCards = computed<AnalyticsMetricCard[]>(() => {
    const report = this.report();
    if (!report) return [];

    return [
      {
        key: 'netRevenueCents',
        label: 'Net revenue',
        value: this.money(report.metrics.netRevenueCents.current),
        detail: 'Payments less refunds',
        metric: report.metrics.netRevenueCents,
        icon: this.icons.DollarSign,
        iconClass: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
        toneClass: 'from-emerald-500/15 via-emerald-500/5 to-transparent',
        favorableDirection: 'up',
      },
      {
        key: 'completedRepairs',
        label: 'Completed repairs',
        value: this.integer(report.metrics.completedRepairs.current),
        detail: 'Repairs moved to picked up',
        metric: report.metrics.completedRepairs,
        icon: this.icons.CheckCircle2,
        iconClass: 'bg-blue-50 text-blue-700 ring-blue-100',
        toneClass: 'from-blue-500/15 via-blue-500/5 to-transparent',
        favorableDirection: 'up',
      },
      {
        key: 'averageTicketCents',
        label: 'Average ticket',
        value: this.money(report.metrics.averageTicketCents.current),
        detail: 'Net revenue per paid order',
        metric: report.metrics.averageTicketCents,
        icon: this.icons.Receipt,
        iconClass: 'bg-violet-50 text-violet-700 ring-violet-100',
        toneClass: 'from-violet-500/15 via-violet-500/5 to-transparent',
        favorableDirection: 'up',
      },
      {
        key: 'quoteConversionRate',
        label: 'Quote conversion',
        value: this.percent(report.metrics.quoteConversionRate.current),
        detail: 'Accepted, scheduled, or converted',
        metric: report.metrics.quoteConversionRate,
        icon: this.icons.TrendingUp,
        iconClass: 'bg-amber-50 text-amber-700 ring-amber-100',
        toneClass: 'from-amber-500/15 via-amber-500/5 to-transparent',
        favorableDirection: 'up',
      },
      {
        key: 'averageTurnaroundHours',
        label: 'Average turnaround',
        value: this.durationHours(report.metrics.averageTurnaroundHours.current),
        detail: 'Repair creation to pickup',
        metric: report.metrics.averageTurnaroundHours,
        icon: this.icons.Timer,
        iconClass: 'bg-cyan-50 text-cyan-700 ring-cyan-100',
        toneClass: 'from-cyan-500/15 via-cyan-500/5 to-transparent',
        favorableDirection: 'down',
      },
      {
        key: 'newCustomers',
        label: 'New customers',
        value: this.integer(report.metrics.newCustomers.current),
        detail: 'First-time repair customers',
        metric: report.metrics.newCustomers,
        icon: this.icons.Users,
        iconClass: 'bg-rose-50 text-rose-700 ring-rose-100',
        toneClass: 'from-rose-500/15 via-rose-500/5 to-transparent',
        favorableDirection: 'up',
      },
    ];
  });

  readonly stateCards = computed<AnalyticsStateCard[]>(() => {
    const state = this.report()?.currentState;
    if (!state) return [];

    return [
      {
        key: 'open',
        label: 'Open repairs',
        value: this.integer(state.openRepairs),
        detail: 'Current active workload',
        icon: this.icons.Wrench,
        className: 'bg-slate-100 text-slate-700',
      },
      {
        key: 'ready',
        label: 'Ready for pickup',
        value: this.integer(state.readyForPickup),
        detail: 'Waiting on customers',
        icon: this.icons.PackageCheck,
        className: 'bg-emerald-50 text-emerald-700',
      },
      {
        key: 'parts',
        label: 'Awaiting parts',
        value: this.integer(state.awaitingParts),
        detail: 'Currently blocked',
        icon: this.icons.Clock3,
        className: 'bg-amber-50 text-amber-700',
      },
      {
        key: 'balance',
        label: 'Outstanding balance',
        value: this.money(state.outstandingBalanceCents),
        detail: 'Across non-voided orders',
        icon: this.icons.CreditCard,
        className: 'bg-rose-50 text-rose-700',
      },
      {
        key: 'queue',
        label: 'Active queue',
        value: this.integer(state.activeQueueItems),
        detail: 'Open and in-progress tasks',
        icon: this.icons.ListTodo,
        className: 'bg-blue-50 text-blue-700',
      },
      {
        key: 'overdue',
        label: 'Overdue queue',
        value: this.integer(state.overdueQueueItems),
        detail: 'Tasks past their due time',
        icon: this.icons.AlertTriangle,
        className: 'bg-orange-50 text-orange-700',
      },
    ];
  });

  readonly revenueChart = computed(() => {
    const trends = this.report()?.trends ?? [];
    const width = 760;
    const height = 260;
    const left = 56;
    const right = 18;
    const top = 24;
    const bottom = 42;
    const plotWidth = width - left - right;
    const plotHeight = height - top - bottom;
    const maxValue = Math.max(1, ...trends.map((point) => Math.max(0, point.revenueCents)));
    const divisor = Math.max(1, trends.length - 1);

    const points = trends.map((point, index) => ({
      ...point,
      x: left + (index / divisor) * plotWidth,
      y: top + plotHeight - (Math.max(0, point.revenueCents) / maxValue) * plotHeight,
    }));

    const linePath = points
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
      .join(' ');
    const areaPath = points.length
      ? `${linePath} L ${points[points.length - 1]!.x.toFixed(2)} ${(top + plotHeight).toFixed(2)} L ${points[0]!.x.toFixed(2)} ${(top + plotHeight).toFixed(2)} Z`
      : '';

    return {
      width,
      height,
      left,
      top,
      plotHeight,
      maxValue,
      halfValue: Math.round(maxValue / 2),
      points,
      linePath,
      areaPath,
    };
  });

  readonly activityMax = computed(() => {
    const trends = this.report()?.trends ?? [];
    return Math.max(
      1,
      ...trends.flatMap((row) => [row.repairsCreated, row.repairsCompleted, row.quotesCreated]),
    );
  });

  readonly customerDonut = computed(() => {
    const mix = this.report()?.customerMix;
    if (!mix?.total) {
      return 'conic-gradient(#e2e8f0 0deg 360deg)';
    }
    const newDegrees = (mix.new / mix.total) * 360;
    return `conic-gradient(#0ea5e9 0deg ${newDegrees}deg, #8b5cf6 ${newDegrees}deg 360deg)`;
  });

  readonly quoteFunnelRows = computed(() => {
    const funnel = this.report()?.quoteFunnel;
    if (!funnel) return [];
    const max = Math.max(1, funnel.requested);
    return [
      { key: 'requested', label: 'Requested', value: funnel.requested, percent: (funnel.requested / max) * 100, className: 'bg-slate-900' },
      { key: 'sent', label: 'Quote sent', value: funnel.sent, percent: (funnel.sent / max) * 100, className: 'bg-blue-500' },
      { key: 'accepted', label: 'Accepted', value: funnel.accepted, percent: (funnel.accepted / max) * 100, className: 'bg-violet-500' },
      { key: 'deposit', label: 'Deposit paid', value: funnel.depositPaid, percent: (funnel.depositPaid / max) * 100, className: 'bg-amber-500' },
      { key: 'converted', label: 'Converted', value: funnel.converted, percent: (funnel.converted / max) * 100, className: 'bg-emerald-500' },
    ];
  });

  ngOnInit(): void {
    void this.loadReport();
  }

  async setRange(range: AnalyticsRange): Promise<void> {
    if (range === this.selectedRange()) return;
    this.selectedRange.set(range);
    await this.loadReport();
  }

  async refresh(): Promise<void> {
    if (this.refreshing()) return;
    this.refreshing.set(true);
    await this.loadReport(false);
    this.refreshing.set(false);
  }

  async loadReport(showLoader = true): Promise<void> {
    if (showLoader) this.loading.set(true);
    this.error.set(null);

    try {
      const response = await firstValueFrom(
        this.analyticsService.getOverview(this.selectedRange()),
      );
      this.report.set(response.data);
    } catch (error) {
      console.error('Failed to load analytics.', error);
      this.error.set('Analytics could not be loaded. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }

  metricTrendLabel(card: AnalyticsMetricCard): string {
    const metric = card.metric;
    if (metric.direction === 'flat') return 'No change';
    if (metric.changePercent === null) return 'New activity';
    return `${Math.abs(metric.changePercent).toFixed(0)}% vs prior period`;
  }

  metricTrendClass(card: AnalyticsMetricCard): string {
    const direction = card.metric.direction;
    if (direction === 'flat') return 'bg-slate-100 text-slate-600';
    const favorable = direction === card.favorableDirection;
    return favorable
      ? 'bg-emerald-50 text-emerald-700'
      : 'bg-rose-50 text-rose-700';
  }

  money(cents: number | null | undefined, compact = false): string {
    const value = Number(cents ?? 0) / 100;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: compact ? 'compact' : 'standard',
      maximumFractionDigits: compact ? 1 : 0,
      minimumFractionDigits: 0,
    }).format(value);
  }

  integer(value: number | null | undefined): string {
    return new Intl.NumberFormat('en-US').format(Math.round(Number(value ?? 0)));
  }

  percent(value: number | null | undefined): string {
    return `${Number(value ?? 0).toFixed(0)}%`;
  }

  durationHours(hours: number | null | undefined): string {
    const value = Math.max(0, Number(hours ?? 0));
    if (value < 1) return `${Math.round(value * 60)}m`;
    if (value < 24) return `${value.toFixed(value < 10 ? 1 : 0)}h`;
    return `${(value / 24).toFixed(1)}d`;
  }

  durationSeconds(seconds: number | null | undefined): string {
    const value = Math.max(0, Math.round(Number(seconds ?? 0)));
    if (value < 60) return `${value}s`;
    if (value < 3_600) return `${Math.round(value / 60)}m`;
    const hours = value / 3_600;
    if (hours < 24) return `${hours.toFixed(hours < 10 ? 1 : 0)}h`;
    return `${(hours / 24).toFixed(1)}d`;
  }

  barHeight(value: number): number {
    return Math.max(4, (Math.max(0, value) / this.activityMax()) * 100);
  }

  exportCsv(): void {
    const report = this.report();
    if (!report) return;

    const rows: Array<Array<string | number>> = [
      ['Opscend Advanced Analytics'],
      ['Range', report.range.key],
      ['Generated at', report.generatedAt],
      [],
      ['Metric', 'Current', 'Previous', 'Change percent'],
      ['Net revenue cents', report.metrics.netRevenueCents.current, report.metrics.netRevenueCents.previous, report.metrics.netRevenueCents.changePercent ?? ''],
      ['Completed repairs', report.metrics.completedRepairs.current, report.metrics.completedRepairs.previous, report.metrics.completedRepairs.changePercent ?? ''],
      ['Average ticket cents', report.metrics.averageTicketCents.current, report.metrics.averageTicketCents.previous, report.metrics.averageTicketCents.changePercent ?? ''],
      ['Quote conversion rate', report.metrics.quoteConversionRate.current, report.metrics.quoteConversionRate.previous, report.metrics.quoteConversionRate.changePercent ?? ''],
      ['Average turnaround hours', report.metrics.averageTurnaroundHours.current, report.metrics.averageTurnaroundHours.previous, report.metrics.averageTurnaroundHours.changePercent ?? ''],
      ['New customers', report.metrics.newCustomers.current, report.metrics.newCustomers.previous, report.metrics.newCustomers.changePercent ?? ''],
      [],
      ['Trend label', 'Revenue cents', 'Repairs created', 'Repairs completed', 'Quotes created'],
      ...report.trends.map((row) => [row.label, row.revenueCents, row.repairsCreated, row.repairsCompleted, row.quotesCreated]),
      [],
      ['Repair type', 'Repairs', 'Completed', 'Revenue cents'],
      ...report.repairTypes.map((row) => [row.label, row.repairCount, row.completedCount, row.revenueCents]),
      [],
      ['Device', 'Repairs', 'Completed', 'Revenue cents'],
      ...report.devices.map((row) => [row.label, row.repairCount, row.completedCount, row.revenueCents]),
      [],
      ['Payment method', 'Transactions', 'Revenue cents', 'Percent'],
      ...report.paymentMethods.map((row) => [row.label, row.transactionCount, row.revenueCents, row.percent]),
      [],
      ['Order source', 'Transactions', 'Revenue cents', 'Percent'],
      ...report.orderSources.map((row) => [row.label, row.transactionCount, row.revenueCents, row.percent]),
    ];

    const csv = rows
      .map((row) => row.map((value) => this.csvCell(value)).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `opscend-analytics-${report.range.key}-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  private csvCell(value: string | number): string {
    const text = String(value ?? '');
    return `"${text.replaceAll('"', '""')}"`;
  }
}
