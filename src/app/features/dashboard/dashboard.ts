import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  ArrowRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  DollarSign,
  House,
  Loader2,
  LucideAngularModule,
  MessageSquareQuote,
  PackageCheck,
  RefreshCw,
  Store,
  TrendingUp,
  Wrench,
  type LucideIconData,
} from 'lucide-angular';

import { TechDayView } from '../../components/tech-day-view/tech-day-view';
import { BookingAdminService } from '../../core/booking/service';
import type {
  BookingQuoteRequest,
  BookingQuoteRequestsResponse,
} from '../../core/booking/model';
import { OrdersService } from '../../core/orders/orders-service';
import type { Order, OrderListResponse } from '../../core/orders/orders-model';
import type {
  Repair,
  RepairListResponse,
  RepairStatus,
} from '../../core/repairs/repair.model';
import { RepairsService } from '../../core/repairs/repairs-service';
import { ShopContextService } from '../../core/shop/shop-context.store';

type DashboardRange = 1 | 14 | 30 | 90;
type TrendDirection = 'up' | 'down' | 'flat';
type AttentionTone = 'rose' | 'amber' | 'blue' | 'emerald' | 'slate';

interface DashboardTrend {
  direction: TrendDirection;
  label: string;
}

interface DashboardMetric {
  key: string;
  label: string;
  value: string;
  detail: string;
  trend: DashboardTrend;
  icon: LucideIconData;
  toneClass: string;
  iconClass: string;
}

interface ActivityPoint {
  key: string;
  label: string;
  repairs: number;
  quotes: number;
  x: number;
  repairY: number;
  quoteY: number;
}

interface RevenueBar {
  key: string;
  label: string;
  valueCents: number;
  height: number;
}

interface StatusMixItem {
  key: string;
  label: string;
  count: number;
  color: string;
}

interface FunnelItem {
  key: string;
  label: string;
  count: number;
  percent: number;
  barClass: string;
}

interface AttentionItem {
  key: string;
  label: string;
  detail: string;
  count: number;
  route: string | any[];
  queryParams?: Record<string, string>;
  tone: AttentionTone;
  icon: LucideIconData;
}

interface DashboardActivityItem {
  key: string;
  title: string;
  detail: string;
  occurredAt: Date;
  route?: string | any[];
  queryParams?: Record<string, string>;
  icon: LucideIconData;
  iconClass: string;
}

const COMPLETED_QUOTE_STATUSES = new Set([
  'accepted',
  'deposit_pending',
  'deposit_paid',
  'scheduled',
  'converted',
]);

const SENT_QUOTE_STATUSES = new Set([
  'sent',
  'accepted',
  'declined',
  'deposit_pending',
  'deposit_paid',
  'scheduled',
  'converted',
  'expired',
]);

const ACTIVE_REPAIR_STATUSES = new Set<RepairStatus>([
  'customer_verified',
  'diagnosing',
  'in_repair',
  'documentation_pending',
  'qc',
]);

const WAITING_REPAIR_STATUSES = new Set<RepairStatus>([
  'awaiting_approval',
  'awaiting_parts',
  'needs_reassignment',
]);

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    LucideAngularModule,
    TechDayView,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent implements OnInit {
  readonly shopContext = inject(ShopContextService);

  private readonly repairsService = inject(RepairsService);
  private readonly bookingApi = inject(BookingAdminService);
  private readonly ordersService = inject(OrdersService);

  readonly icons = {
    ArrowRight,
    Building2,
    CalendarDays,
    CheckCircle2,
    Clock3,
    CreditCard,
    DollarSign,
    House,
    Loader2,
    MessageSquareQuote,
    PackageCheck,
    RefreshCw,
    Store,
    TrendingUp,
    Wrench,
  };

  readonly ranges: ReadonlyArray<{ label: string; value: DashboardRange }> = [
    { label: '14D', value: 14 },
    { label: '30D', value: 30 },
    { label: '90D', value: 90 },
  ];

  readonly selectedRange = signal<DashboardRange>(30);
  readonly repairs = signal<Repair[]>([]);
  readonly quotes = signal<BookingQuoteRequest[]>([]);
  readonly orders = signal<Order[]>([]);
  readonly loading = signal(true);
  readonly refreshing = signal(false);
  readonly error = signal<string | null>(null);
  readonly loadedAt = signal<Date | null>(null);

  readonly todayHeaderLabel = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date());

  readonly greeting = (() => {
    const hour = new Date().getHours();
    return hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
  })();

  readonly rangeStart = computed(() => {
    const start = this.startOfDay(new Date());
    start.setDate(start.getDate() - (this.selectedRange() - 1));
    return start;
  });

  readonly previousRange = computed(() => {
    const currentStart = this.rangeStart();
    const previousEnd = new Date(currentStart.getTime() - 1);
    const previousStart = this.startOfDay(previousEnd);
    previousStart.setDate(previousStart.getDate() - (this.selectedRange() - 1));
    return { start: previousStart, end: previousEnd };
  });

  readonly currentRepairs = computed(() =>
    this.repairs().filter((repair) =>
      this.isInRange(this.parseDate(repair.createdAt), this.rangeStart(), new Date()),
    ),
  );

  readonly currentQuotes = computed(() =>
    this.quotes().filter((quote) =>
      this.isInRange(this.quoteCreatedDate(quote), this.rangeStart(), new Date()),
    ),
  );

  readonly currentRevenueCents = computed(() =>
    this.revenueBetween(this.rangeStart(), new Date()),
  );

  readonly previousRevenueCents = computed(() => {
    const range = this.previousRange();
    return this.revenueBetween(range.start, range.end);
  });

  readonly completedRepairsCount = computed(() =>
    this.repairs().filter((repair) => {
      const completion = this.repairCompletionDate(repair);
      return completion && this.isInRange(completion, this.rangeStart(), new Date());
    }).length,
  );

  readonly previousCompletedRepairsCount = computed(() => {
    const range = this.previousRange();
    return this.repairs().filter((repair) => {
      const completion = this.repairCompletionDate(repair);
      return completion && this.isInRange(completion, range.start, range.end);
    }).length;
  });

  readonly quoteConversionRate = computed(() =>
    this.conversionRate(this.currentQuotes()),
  );

  readonly previousQuoteConversionRate = computed(() => {
    const range = this.previousRange();
    const quotes = this.quotes().filter((quote) =>
      this.isInRange(this.quoteCreatedDate(quote), range.start, range.end),
    );
    return this.conversionRate(quotes);
  });

  readonly newQuoteCount = computed(() => this.currentQuotes().length);

  readonly previousNewQuoteCount = computed(() => {
    const range = this.previousRange();
    return this.quotes().filter((quote) =>
      this.isInRange(this.quoteCreatedDate(quote), range.start, range.end),
    ).length;
  });

  readonly dashboardMetrics = computed<DashboardMetric[]>(() => [
    {
      key: 'revenue',
      label: 'Revenue collected',
      value: this.money(this.currentRevenueCents()),
      detail: `Payments received in the last ${this.selectedRange()} days`,
      trend: this.buildTrend(this.currentRevenueCents(), this.previousRevenueCents()),
      icon: this.icons.DollarSign,
      toneClass: 'from-emerald-500/15 via-emerald-500/5 to-transparent',
      iconClass: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    },
    {
      key: 'completed',
      label: 'Completed repairs',
      value: this.integer(this.completedRepairsCount()),
      detail: 'Repairs moved to picked up',
      trend: this.buildTrend(
        this.completedRepairsCount(),
        this.previousCompletedRepairsCount(),
      ),
      icon: this.icons.CheckCircle2,
      toneClass: 'from-blue-500/15 via-blue-500/5 to-transparent',
      iconClass: 'bg-blue-50 text-blue-700 ring-blue-100',
    },
    {
      key: 'conversion',
      label: 'Quote conversion',
      value: `${this.quoteConversionRate().toFixed(0)}%`,
      detail: 'Requests accepted or converted',
      trend: this.buildTrend(
        this.quoteConversionRate(),
        this.previousQuoteConversionRate(),
      ),
      icon: this.icons.TrendingUp,
      toneClass: 'from-violet-500/15 via-violet-500/5 to-transparent',
      iconClass: 'bg-violet-50 text-violet-700 ring-violet-100',
    },
    {
      key: 'quotes',
      label: 'Quote requests',
      value: this.integer(this.newQuoteCount()),
      detail: `New demand in the last ${this.selectedRange()} days`,
      trend: this.buildTrend(this.newQuoteCount(), this.previousNewQuoteCount()),
      icon: this.icons.MessageSquareQuote,
      toneClass: 'from-amber-500/15 via-amber-500/5 to-transparent',
      iconClass: 'bg-amber-50 text-amber-700 ring-amber-100',
    },
  ]);

  readonly openRepairsCount = computed(() =>
    this.repairs().filter((repair) => this.isOpenRepair(repair)).length,
  );

  readonly outstandingBalanceCents = computed(() =>
    this.orders()
      .filter((order) => order.paymentStatus !== 'voided')
      .reduce((sum, order) => sum + Math.max(0, order.totals.balanceCents), 0),
  );

  readonly depositsCollectedCents = computed(() =>
    this.currentQuotes().reduce((sum, quote) => {
      if (!quote.depositPaidAt) return sum;
      const paidAt = this.parseDate(quote.depositPaidAt);
      if (!this.isInRange(paidAt, this.rangeStart(), new Date())) return sum;
      return sum + Math.max(0, quote.depositAmountCents ?? 0);
    }, 0),
  );

  readonly averageTicketCents = computed(() => {
    const paidOrderIds = new Set<string>();
    let revenue = 0;

    for (const order of this.orders()) {
      for (const payment of order.payments ?? []) {
        const occurredAt = this.parseDate(payment.createdAt);
        if (!this.isInRange(occurredAt, this.rangeStart(), new Date())) continue;
        revenue += payment.type === 'refund' ? -payment.amountCents : payment.amountCents;
        if (payment.type !== 'refund') paidOrderIds.add(order.id);
      }
    }

    return paidOrderIds.size ? Math.max(0, revenue) / paidOrderIds.size : 0;
  });

  readonly todayAppointmentsCount = computed(() => {
    const start = this.startOfDay(new Date());
    const end = this.endOfDay(new Date());
    return this.repairs().filter((repair) => {
      const appointment = this.parseDate(repair.appointment?.startAt);
      return appointment && this.isInRange(appointment, start, end);
    }).length;
  });

  readonly activityChart = computed(() => {
    const start = this.rangeStart();
    const dayCount = this.selectedRange();
    const width = 700;
    const height = 220;
    const left = 38;
    const right = 18;
    const top = 22;
    const bottom = 34;
    const plotWidth = width - left - right;
    const plotHeight = height - top - bottom;

    const daily = Array.from({ length: dayCount }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const key = this.dateKey(date);

      return {
        key,
        date,
        label: new Intl.DateTimeFormat('en-US', {
          month: 'short',
          day: 'numeric',
        }).format(date),
        repairs: 0,
        quotes: 0,
      };
    });

    const byKey = new Map(daily.map((item) => [item.key, item]));

    for (const repair of this.currentRepairs()) {
      const item = byKey.get(this.dateKey(this.parseDate(repair.createdAt)!));
      if (item) item.repairs += 1;
    }

    for (const quote of this.currentQuotes()) {
      const item = byKey.get(this.dateKey(this.quoteCreatedDate(quote)!));
      if (item) item.quotes += 1;
    }

    const maxValue = Math.max(
      1,
      ...daily.flatMap((item) => [item.repairs, item.quotes]),
    );

    const pointDivisor: number = Math.max(dayCount - 1, 1);

    const points: ActivityPoint[] = daily.map((item, index) => {
      const x = left + (index / pointDivisor) * plotWidth;
      return {
        key: item.key,
        label: item.label,
        repairs: item.repairs,
        quotes: item.quotes,
        x,
        repairY: top + plotHeight - (item.repairs / maxValue) * plotHeight,
        quoteY: top + plotHeight - (item.quotes / maxValue) * plotHeight,
      };
    });

    const visibleLabelCount = this.selectedRange() === 90 ? 6 : 7;
    const labelIndexes = new Set(
      Array.from({ length: visibleLabelCount }, (_, index) =>
        Math.round((index / (visibleLabelCount - 1)) * (points.length - 1)),
      ),
    );

    return {
      width,
      height,
      left,
      right,
      top,
      bottom,
      plotHeight,
      maxValue,
      halfValue: Math.ceil(maxValue / 2),
      points,
      repairPath: this.linePath(points.map((point) => ({ x: point.x, y: point.repairY }))),
      quotePath: this.linePath(points.map((point) => ({ x: point.x, y: point.quoteY }))),
      labelPoints: points.filter((_, index) => labelIndexes.has(index)),
    };
  });

  readonly revenueBars = computed<RevenueBar[]>(() => {
    const start = this.rangeStart();
    const bucketSize = this.selectedRange() === 90 ? 7 : this.selectedRange() === 30 ? 3 : 1;
    const buckets: RevenueBar[] = [];

    for (let offset = 0; offset < this.selectedRange(); offset += bucketSize) {
      const bucketStart = new Date(start);
      bucketStart.setDate(start.getDate() + offset);
      const bucketEnd = this.endOfDay(new Date(bucketStart));
      bucketEnd.setDate(bucketStart.getDate() + bucketSize - 1);

      const valueCents = this.revenueBetween(bucketStart, bucketEnd);
      const label = new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
      }).format(bucketStart);

      buckets.push({
        key: this.dateKey(bucketStart),
        label,
        valueCents,
        height: 0,
      });
    }

    const maxValue = Math.max(1, ...buckets.map((bucket) => bucket.valueCents));
    return buckets.map((bucket) => ({
      ...bucket,
      height: bucket.valueCents > 0 ? Math.max(8, (bucket.valueCents / maxValue) * 100) : 3,
    }));
  });

  readonly repairStatusDonut = computed(() => {
    const openRepairs = this.repairs().filter((repair) => this.isOpenRepair(repair));
    const items: StatusMixItem[] = [
      {
        key: 'scheduled',
        label: 'Scheduled / intake',
        count: openRepairs.filter((repair) =>
          repair.status === 'scheduled' || repair.status === 'intake',
        ).length,
        color: '#6366f1',
      },
      {
        key: 'active',
        label: 'In progress',
        count: openRepairs.filter((repair) => ACTIVE_REPAIR_STATUSES.has(repair.status)).length,
        color: '#0ea5e9',
      },
      {
        key: 'waiting',
        label: 'Waiting / blocked',
        count: openRepairs.filter((repair) => WAITING_REPAIR_STATUSES.has(repair.status)).length,
        color: '#f59e0b',
      },
      {
        key: 'ready',
        label: 'Ready for pickup',
        count: openRepairs.filter((repair) => repair.status === 'ready').length,
        color: '#10b981',
      },
    ];

    const total = items.reduce((sum, item) => sum + item.count, 0);
    if (!total) {
      return {
        total,
        items,
        gradient: 'conic-gradient(#e2e8f0 0deg 360deg)',
      };
    }

    let cursor = 0;
    const stops = items
      .filter((item) => item.count > 0)
      .map((item) => {
        const start = cursor;
        cursor += (item.count / total) * 360;
        return `${item.color} ${start}deg ${cursor}deg`;
      });

    return {
      total,
      items,
      gradient: `conic-gradient(${stops.join(', ')})`,
    };
  });

  readonly quoteFunnel = computed<FunnelItem[]>(() => {
    const quotes = this.currentQuotes().filter((quote) => quote.requestStatus !== 'canceled');
    const requested = quotes.length;
    const sent = quotes.filter((quote) =>
      !!quote.quoteSentAt || SENT_QUOTE_STATUSES.has(quote.quoteStatus),
    ).length;
    const accepted = quotes.filter((quote) => COMPLETED_QUOTE_STATUSES.has(quote.quoteStatus)).length;
    const deposits = quotes.filter((quote) => !!quote.depositPaidAt).length;
    const converted = quotes.filter((quote) => quote.quoteStatus === 'converted' || !!quote.convertedAt).length;
    const max = Math.max(1, requested);

    return [
      { key: 'requested', label: 'Requested', count: requested, percent: (requested / max) * 100, barClass: 'bg-slate-900' },
      { key: 'sent', label: 'Quote sent', count: sent, percent: (sent / max) * 100, barClass: 'bg-blue-500' },
      { key: 'accepted', label: 'Accepted', count: accepted, percent: (accepted / max) * 100, barClass: 'bg-violet-500' },
      { key: 'deposits', label: 'Deposit paid', count: deposits, percent: (deposits / max) * 100, barClass: 'bg-amber-500' },
      { key: 'converted', label: 'Converted', count: converted, percent: (converted / max) * 100, barClass: 'bg-emerald-500' },
    ];
  });

  readonly serviceModeMix = computed(() => {
    const repairs = this.currentRepairs();
    const total = Math.max(1, repairs.length);
    const inShop = repairs.filter((repair) => repair.serviceMode === 'in_shop').length;
    const onSite = repairs.filter((repair) => repair.serviceMode === 'on_site').length;

    return {
      total: repairs.length,
      inShop,
      onSite,
      inShopPercent: (inShop / total) * 100,
      onSitePercent: (onSite / total) * 100,
    };
  });

  readonly attentionItems = computed<AttentionItem[]>(() => {
    const newQuotes = this.quotes().filter((quote) => quote.requestStatus === 'new');
    const approval = this.repairs().filter((repair) => repair.status === 'awaiting_approval');
    const parts = this.repairs().filter((repair) => repair.status === 'awaiting_parts');
    const ready = this.repairs().filter((repair) => repair.status === 'ready');
    const unassigned = this.repairs().filter((repair) =>
      this.isOpenRepair(repair) &&
      (repair.status === 'needs_reassignment' || repair.dispatchType === 'unassigned'),
    );

    const items: AttentionItem[] = [
      {
        key: 'new-quotes',
        label: 'New quote requests',
        detail: 'Customers waiting for pricing or contact',
        count: newQuotes.length,
        route: '/quote-requests',
        tone: 'rose',
        icon: this.icons.MessageSquareQuote,
      },
      {
        key: 'approval',
        label: 'Awaiting customer approval',
        detail: 'Repairs paused until the customer responds',
        count: approval.length,
        route: '/repairs/overview',
        tone: 'amber',
        icon: this.icons.Clock3,
      },
      {
        key: 'parts',
        label: 'Waiting on parts',
        detail: 'Open jobs blocked by parts availability',
        count: parts.length,
        route: '/repairs/overview',
        tone: 'blue',
        icon: this.icons.PackageCheck,
      },
      {
        key: 'ready',
        label: 'Ready for pickup',
        detail: 'Completed devices still awaiting handoff',
        count: ready.length,
        route: '/repairs/overview',
        tone: 'emerald',
        icon: this.icons.CheckCircle2,
      },
      {
        key: 'unassigned',
        label: 'Needs assignment',
        detail: 'Repairs without a confirmed provider',
        count: unassigned.length,
        route: '/repairs/overview',
        tone: 'slate',
        icon: this.icons.Wrench,
      },
    ];

    return items.filter((item) => item.count > 0).slice(0, 5);
  });

  readonly upcomingAppointments = computed(() => {
    const now = Date.now();
    return this.repairs()
      .filter((repair) => {
        const appointment = this.parseDate(repair.appointment?.startAt);
        return !!appointment && appointment.getTime() >= now && this.isOpenRepair(repair);
      })
      .sort((a, b) =>
        this.parseDate(a.appointment?.startAt)!.getTime() -
        this.parseDate(b.appointment?.startAt)!.getTime(),
      )
      .slice(0, 5);
  });

  readonly recentActivity = computed<DashboardActivityItem[]>(() => {
    const items: DashboardActivityItem[] = [];

    for (const repair of this.repairs()) {
      const occurredAt = this.parseDate(repair.createdAt);
      if (!occurredAt) continue;
      items.push({
        key: `repair-${repair.id}`,
        title: 'Repair created',
        detail: `${this.customerName(repair)} · ${this.deviceName(repair)}`,
        occurredAt,
        route: ['/repairs/detail', repair.id],
        icon: this.icons.Wrench,
        iconClass: 'bg-blue-50 text-blue-700',
      });
    }

    for (const quote of this.quotes()) {
      const occurredAt = this.quoteCreatedDate(quote);
      if (!occurredAt) continue;
      items.push({
        key: `quote-${quote.id}`,
        title: 'Quote request received',
        detail: `${quote.customer?.name || 'Customer'} · ${this.quoteDeviceName(quote)}`,
        occurredAt,
        route: '/quote-requests',
        queryParams: { quoteRequestId: quote.id },
        icon: this.icons.MessageSquareQuote,
        iconClass: 'bg-violet-50 text-violet-700',
      });
    }

    for (const order of this.orders()) {
      const linkedRepair = this.repairs().find((repair) => repair.orderId === order.id);
      for (const payment of order.payments ?? []) {
        if (payment.type === 'refund') continue;
        const occurredAt = this.parseDate(payment.createdAt);
        if (!occurredAt) continue;
        items.push({
          key: `payment-${payment.id}`,
          title: 'Payment received',
          detail: `${order.orderNumber} · ${this.money(payment.amountCents)}`,
          occurredAt,
          route: linkedRepair ? ['/repairs/detail', linkedRepair.id] : undefined,
          icon: this.icons.CreditCard,
          iconClass: 'bg-emerald-50 text-emerald-700',
        });
      }
    }

    return items
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
      .slice(0, 6);
  });

  ngOnInit(): void {
    void this.loadDashboard();
  }

  setRange(range: DashboardRange): void {
    this.selectedRange.set(range);
  }

  async refresh(): Promise<void> {
    if (this.refreshing()) return;
    this.refreshing.set(true);
    await this.loadDashboard(false);
    this.refreshing.set(false);
  }

  async loadDashboard(showInitialLoader = true): Promise<void> {
    if (showInitialLoader) this.loading.set(true);
    this.error.set(null);

    const [repairsResult, quotesResult, ordersResult] = await Promise.allSettled([
      this.loadAllRepairs(),
      this.loadAllQuotes(),
      this.loadAllOrders(),
    ]);

    if (repairsResult.status === 'fulfilled') this.repairs.set(repairsResult.value);
    if (quotesResult.status === 'fulfilled') this.quotes.set(quotesResult.value);
    if (ordersResult.status === 'fulfilled') this.orders.set(ordersResult.value);

    const failed = [repairsResult, quotesResult, ordersResult].filter(
      (result) => result.status === 'rejected',
    ).length;

    if (failed === 3) {
      this.error.set('Dashboard data could not be loaded. Please try again.');
    } else if (failed > 0) {
      this.error.set('Some dashboard data could not be loaded. The available sections are shown below.');
    }

    this.loadedAt.set(new Date());
    this.loading.set(false);
  }

  money(cents: number | null | undefined, compact = false): string {
    const value = Number(cents ?? 0) / 100;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: compact ? 'compact' : 'standard',
      maximumFractionDigits: compact ? 1 : 0,
      minimumFractionDigits: compact ? 0 : 0,
    }).format(value);
  }

  integer(value: number): string {
    return new Intl.NumberFormat('en-US').format(value);
  }

  customerName(repair: Repair): string {
    return repair.customer?.name || 'Customer';
  }

  deviceName(repair: Repair): string {
    const device = repair.customerDevice;
    return (
      device?.displayName ||
      device?.nickname ||
      [device?.brand, device?.model].filter(Boolean).join(' ') ||
      'Device'
    );
  }

  quoteDeviceName(quote: BookingQuoteRequest): string {
    return [quote.brand, quote.model].filter(Boolean).join(' ') || quote.category || 'Device';
  }

  repairStatusLabel(status: RepairStatus): string {
    return status
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  appointmentDay(repair: Repair): string {
    const date = this.parseDate(repair.appointment?.startAt);
    if (!date) return 'Unscheduled';

    const today = this.startOfDay(new Date());
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    if (this.dateKey(date) === this.dateKey(today)) return 'Today';
    if (this.dateKey(date) === this.dateKey(tomorrow)) return 'Tomorrow';

    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(date);
  }

  appointmentTime(repair: Repair): string {
    const date = this.parseDate(repair.appointment?.startAt);
    if (!date) return '';
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  }

  relativeTime(date: Date): string {
    const diffMs = date.getTime() - Date.now();
    const absMinutes = Math.abs(Math.round(diffMs / 60_000));

    if (absMinutes < 1) return 'Just now';
    if (absMinutes < 60) return diffMs < 0 ? `${absMinutes}m ago` : `in ${absMinutes}m`;

    const hours = Math.round(absMinutes / 60);
    if (hours < 24) return diffMs < 0 ? `${hours}h ago` : `in ${hours}h`;

    const days = Math.round(hours / 24);
    if (days < 7) return diffMs < 0 ? `${days}d ago` : `in ${days}d`;

    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
    }).format(date);
  }

  attentionToneClasses(tone: AttentionTone): string {
    switch (tone) {
      case 'rose':
        return 'bg-rose-50 text-rose-700 ring-rose-100';
      case 'amber':
        return 'bg-amber-50 text-amber-700 ring-amber-100';
      case 'blue':
        return 'bg-blue-50 text-blue-700 ring-blue-100';
      case 'emerald':
        return 'bg-emerald-50 text-emerald-700 ring-emerald-100';
      case 'slate':
      default:
        return 'bg-slate-100 text-slate-700 ring-slate-200';
    }
  }

  private async loadAllRepairs(maxItems = 500): Promise<Repair[]> {
    const items: Repair[] = [];
    let cursor: string | undefined = undefined;

    while (items.length < maxItems) {
      const requestCursor: string | undefined = cursor;
      const page: RepairListResponse = await firstValueFrom<RepairListResponse>(
        this.repairsService.listRepairs({
          limit: 100,
          cursor: requestCursor,
        }),
      );

      items.push(...page.data);

      const nextCursor: string | null = page.nextCursor;
      if (!nextCursor) break;
      cursor = nextCursor;
    }

    return items.slice(0, maxItems);
  }

  private async loadAllQuotes(maxItems = 500): Promise<BookingQuoteRequest[]> {
    const items: BookingQuoteRequest[] = [];
    let cursor: string | null = null;

    while (items.length < maxItems) {
      const requestCursor: string | null = cursor;
      const page: BookingQuoteRequestsResponse =
        await firstValueFrom<BookingQuoteRequestsResponse>(
          this.bookingApi.listQuoteRequests({
            limit: 100,
            cursor: requestCursor,
          }),
        );

      items.push(...page.data);

      const nextCursor: string | null = page.nextCursor;
      if (!nextCursor) break;
      cursor = nextCursor;
    }

    return items.slice(0, maxItems);
  }

  private async loadAllOrders(maxItems = 500): Promise<Order[]> {
    const items: Order[] = [];
    let cursor: string | null = null;

    while (items.length < maxItems) {
      const requestCursor: string | null = cursor;
      const page: OrderListResponse = await firstValueFrom<OrderListResponse>(
        this.ordersService.list({
          limit: 100,
          cursor: requestCursor,
        }),
      );

      items.push(...page.data);

      const nextCursor: string | null = page.nextCursor;
      if (!nextCursor) break;
      cursor = nextCursor;
    }

    return items.slice(0, maxItems);
  }

  private revenueBetween(start: Date, end: Date): number {
    let total = 0;

    for (const order of this.orders()) {
      for (const payment of order.payments ?? []) {
        const occurredAt = this.parseDate(payment.createdAt);
        if (!this.isInRange(occurredAt, start, end)) continue;
        total += payment.type === 'refund' ? -payment.amountCents : payment.amountCents;
      }
    }

    return Math.max(0, total);
  }

  private conversionRate(quotes: BookingQuoteRequest[]): number {
    const eligible = quotes.filter(
      (quote) => quote.requestStatus !== 'canceled' && quote.quoteStatus !== 'canceled',
    );
    if (!eligible.length) return 0;

    const converted = eligible.filter((quote) =>
      COMPLETED_QUOTE_STATUSES.has(quote.quoteStatus),
    ).length;

    return (converted / eligible.length) * 100;
  }

  private buildTrend(current: number, previous: number): DashboardTrend {
    if (current === previous) return { direction: 'flat', label: 'No change' };
    if (previous === 0) {
      return {
        direction: current > 0 ? 'up' : 'flat',
        label: current > 0 ? 'New activity' : 'No change',
      };
    }

    const percent = Math.abs(((current - previous) / previous) * 100);
    return {
      direction: current > previous ? 'up' : 'down',
      label: `${percent.toFixed(0)}% vs prior period`,
    };
  }

  private quoteCreatedDate(quote: BookingQuoteRequest): Date | null {
    return this.parseDate(quote.requestedAt || quote.createdAt);
  }

  private repairCompletionDate(repair: Repair): Date | null {
    const completionEvent = [...(repair.events ?? [])]
      .filter((event) => event.toStatus === 'picked_up')
      .sort(
        (a, b) =>
          (this.parseDate(b.createdAt)?.getTime() ?? 0) -
          (this.parseDate(a.createdAt)?.getTime() ?? 0),
      )[0];

    if (completionEvent) return this.parseDate(completionEvent.createdAt);
    return repair.status === 'picked_up' ? this.parseDate(repair.updatedAt) : null;
  }

  private isOpenRepair(repair: Repair): boolean {
    return repair.status !== 'picked_up' && repair.status !== 'canceled';
  }

  private linePath(points: Array<{ x: number; y: number }>): string {
    return points
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
      .join(' ');
  }

  private parseDate(value: string | Date | null | undefined): Date | null {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private isInRange(date: Date | null, start: Date, end: Date): boolean {
    if (!date) return false;
    return date.getTime() >= start.getTime() && date.getTime() <= end.getTime();
  }

  private startOfDay(value: Date): Date {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  private endOfDay(value: Date): Date {
    const date = new Date(value);
    date.setHours(23, 59, 59, 999);
    return date;
  }

  private dateKey(value: Date): string {
    return [
      value.getFullYear(),
      String(value.getMonth() + 1).padStart(2, '0'),
      String(value.getDate()).padStart(2, '0'),
    ].join('-');
  }
}
