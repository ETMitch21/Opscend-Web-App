import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RepairsService } from '../../../core/repairs/repairs-service';
import {
  type Repair,
  type RepairListParams,
  type RepairStatus,
} from '../../../core/repairs/repair.model';
import { ChevronDownIcon, LucideAngularModule } from 'lucide-angular';
import { PhonePipe } from '../../../core/pipes/phone-pipe';
import { RouterLink } from '@angular/router';

type RepairViewFilter =
  | 'all'
  | 'upcoming'
  | 'past'
  | 'complete'
  | 'canceled'
  | 'open';

type RepairSortKey =
  | 'repair'
  | 'status'
  | 'appointment'
  | 'customer'
  | 'device'
  | 'technician';

type SortDirection = 'asc' | 'desc';

@Component({
  selector: 'app-repairs-overview',
  standalone: true,
  imports: [CommonModule, DatePipe, LucideAngularModule, PhonePipe, RouterLink],
  templateUrl: './repairs-overview.html',
  styleUrl: './repairs-overview.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RepairsOverview {
  private readonly repairsService = inject(RepairsService);

  readonly chevronDownIcon = ChevronDownIcon;

  readonly repairs = signal<Repair[]>([]);
  readonly loading = signal(false);
  readonly loadingMore = signal(false);
  readonly error = signal<string | null>(null);
  readonly nextCursor = signal<string | null>(null);

  readonly activeView = signal<RepairViewFilter>('all');
  readonly searchTerm = signal('');
  readonly selectedStatus = signal<RepairStatus | null>(null);

  readonly customerId = signal('');
  readonly customerDeviceId = signal('');
  readonly orderId = signal('');
  readonly pageSize = signal(25);

  readonly sortKey = signal<RepairSortKey>('appointment');
  readonly sortDirection = signal<SortDirection>('asc');

  readonly statuses: ReadonlyArray<RepairStatus> = [
    'intake',
    'scheduled',
    'diagnosing',
    'awaiting_approval',
    'awaiting_parts',
    'in_repair',
    'qc',
    'ready',
    'picked_up',
    'canceled',
  ];

  readonly viewOptions: ReadonlyArray<{ value: RepairViewFilter; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'open', label: 'Open' },
    { value: 'upcoming', label: 'Upcoming' },
    { value: 'past', label: 'Past' },
    { value: 'complete', label: 'Complete' },
    { value: 'canceled', label: 'Canceled' },
  ];

  readonly counts = computed(() => {
    const repairs = this.repairs();
    const now = Date.now();

    return {
      all: repairs.length,
      open: repairs.filter((r) => this.isOpenRepair(r)).length,
      upcoming: repairs.filter((r) => this.isUpcomingRepair(r, now)).length,
      past: repairs.filter((r) => this.isPastRepair(r, now)).length,
      complete: repairs.filter((r) => r.status === 'picked_up').length,
      canceled: repairs.filter((r) => r.status === 'canceled').length,
    };
  });

  readonly filteredRepairs = computed(() => {
    let list = [...this.repairs()];
    const activeView = this.activeView();
    const search = this.searchTerm().trim().toLowerCase();
    const now = Date.now();

    switch (activeView) {
      case 'complete':
        list = list.filter((r) => r.status === 'picked_up');
        break;
      case 'canceled':
        list = list.filter((r) => r.status === 'canceled');
        break;
      case 'open':
        list = list.filter((r) => this.isOpenRepair(r));
        break;
      case 'upcoming':
        list = list.filter((r) => this.isUpcomingRepair(r, now));
        break;
      case 'past':
        list = list.filter((r) => this.isPastRepair(r, now));
        break;
      case 'all':
      default:
        break;
    }

    if (search) {
      list = list.filter((repair) => this.matchesSearch(repair, search));
    }

    const sortKey = this.sortKey();
    const sortDirection = this.sortDirection();

    list.sort((a, b) => {
      const comparison = this.compareRepairs(a, b, sortKey);
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return list;
  });

  readonly activeFiltersSummary = computed(() => ({
    view: this.activeView(),
    status: this.selectedStatus(),
    customerId: this.customerId().trim() || null,
    customerDeviceId: this.customerDeviceId().trim() || null,
    orderId: this.orderId().trim() || null,
    searchTerm: this.searchTerm().trim() || null,
  }));

  constructor() {
    effect(
      () => {
        void this.loadRepairs();
      },
      { allowSignalWrites: true }
    );
  }

  async refresh(): Promise<void> {
    this.nextCursor.set(null);
    await this.loadRepairs();
  }

  async loadMore(): Promise<void> {
    const cursor = this.nextCursor();
    if (!cursor || this.loadingMore()) return;

    this.loadingMore.set(true);
    this.error.set(null);

    try {
      const response = await this.repairsService
        .listRepairs({
          ...this.buildApiParams(),
          cursor,
        })
        .toPromise();

      if (!response) return;

      this.repairs.update((current) => [...current, ...response.data]);
      this.nextCursor.set(response.nextCursor);
    } catch (error) {
      console.error(error);
      this.error.set('Failed to load more repairs.');
    } finally {
      this.loadingMore.set(false);
    }
  }

  setView(view: RepairViewFilter): void {
    this.activeView.set(view);

    switch (view) {
      case 'complete':
        this.selectedStatus.set('picked_up');
        break;
      case 'canceled':
        this.selectedStatus.set('canceled');
        break;
      case 'open':
        this.selectedStatus.set(null);
        break;
      case 'upcoming':
      case 'past':
      case 'all':
      default:
        this.selectedStatus.set(null);
        break;
    }
  }

  setStatus(status: RepairStatus | null): void {
    this.selectedStatus.set(status);

    if (status === 'picked_up') {
      this.activeView.set('complete');
    } else if (status === 'canceled') {
      this.activeView.set('canceled');
    } else {
      this.activeView.set('all');
    }
  }

  setSearchTerm(value: string): void {
    this.searchTerm.set(value);
  }

  setCustomerId(value: string): void {
    this.customerId.set(value);
  }

  setCustomerDeviceId(value: string): void {
    this.customerDeviceId.set(value);
  }

  setOrderId(value: string): void {
    this.orderId.set(value);
  }

  setPageSize(value: number): void {
    const next = Number.isFinite(value) ? Math.max(1, Math.min(100, value)) : 25;
    this.pageSize.set(next);
  }

  setSort(key: RepairSortKey): void {
    if (this.sortKey() === key) {
      this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
      return;
    }

    this.sortKey.set(key);
    this.sortDirection.set(key === 'appointment' ? 'asc' : 'asc');
  }

  isSortedBy(key: RepairSortKey): boolean {
    return this.sortKey() === key;
  }

  getSortIconRotation(key: RepairSortKey): string {
    if (this.sortKey() !== key) return 'rotate(0deg)';
    return this.sortDirection() === 'asc' ? 'rotate(180deg)' : 'rotate(0deg)';
  }

  clearFilters(): void {
    this.activeView.set('all');
    this.selectedStatus.set(null);
    this.searchTerm.set('');
    this.customerId.set('');
    this.customerDeviceId.set('');
    this.orderId.set('');
  }

  trackByRepairId(_: number, repair: Repair): string {
    return repair.id;
  }

  hasAppointment(repair: Repair): boolean {
    return !!repair.appointment?.startAt;
  }

  getAppointmentDate(repair: Repair): Date | null {
    if (!repair.appointment?.startAt) return null;

    const date = new Date(repair.appointment.startAt);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private async loadRepairs(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const response = await this.repairsService
        .listRepairs(this.buildApiParams())
        .toPromise();

      if (!response) return;

      console.log(response.data);

      this.repairs.set(response.data);
      this.nextCursor.set(response.nextCursor);
    } catch (error) {
      console.error(error);
      this.error.set('Failed to load repairs.');
      this.repairs.set([]);
      this.nextCursor.set(null);
    } finally {
      this.loading.set(false);
    }
  }

  private buildApiParams(): RepairListParams {
    const params: RepairListParams = {
      limit: this.pageSize(),
    };

    const status = this.selectedStatus();
    const customerId = this.customerId().trim();
    const customerDeviceId = this.customerDeviceId().trim();
    const orderId = this.orderId().trim();

    if (status) {
      params.status = status;
    }

    if (customerId) {
      params.customerId = customerId;
    }

    if (customerDeviceId) {
      params.customerDeviceId = customerDeviceId;
    }

    if (orderId) {
      params.orderId = orderId;
    }

    return params;
  }

  private matchesSearch(repair: Repair, search: string): boolean {
    return [
      repair.id,
      repair.problemSummary,
      repair.status,
      repair.orderId ?? '',
      repair.customerId,
      repair.customerDeviceId,
      repair.assignedTo ?? '',
      repair.intakeNotes ?? '',
      repair.conditionNotes ?? '',
      ...(repair.accessories ?? []),
      repair.appointment?.notes ?? '',
      repair.customer?.name ?? '',
      repair.customer?.phone ?? '',
    ]
      .join(' ')
      .toLowerCase()
      .includes(search);
  }

  private compareRepairs(a: Repair, b: Repair, key: RepairSortKey): number {
    switch (key) {
      case 'repair':
        return this.compareStrings(
          a.problemSummary || a.id,
          b.problemSummary || b.id
        );

      case 'status':
        return this.compareStrings(a.status, b.status);

      case 'appointment':
        return this.compareNumbers(
          this.getAppointmentTimestamp(a),
          this.getAppointmentTimestamp(b)
        );

      case 'customer':
        return this.compareStrings(
          a.customer?.name || '',
          b.customer?.name || ''
        );

      case 'device':
        return this.compareStrings(
          this.getDeviceSortValue(a),
          this.getDeviceSortValue(b)
        );

      case 'technician':
        return this.compareStrings(
          a.assignedTo || '',
          b.assignedTo || ''
        );

      default:
        return 0;
    }
  }

  private getDeviceSortValue(repair: Repair): string {
    const device = (repair as any).customerDevice;

    return (
      device?.nickname ||
      [device?.manufacturer, device?.model].filter((value) => !!value).join(' ') ||
      repair.customerDeviceId ||
      ''
    ).toLowerCase();
  }

  private getAppointmentTimestamp(repair: Repair): number {
    if (!repair.appointment?.startAt) return Number.MAX_SAFE_INTEGER;

    const value = new Date(repair.appointment.startAt).getTime();
    return Number.isNaN(value) ? Number.MAX_SAFE_INTEGER : value;
  }

  private compareStrings(a: string, b: string): number {
    return a.localeCompare(b, undefined, { sensitivity: 'base' });
  }

  private compareNumbers(a: number, b: number): number {
    return a - b;
  }

  private isOpenRepair(repair: Repair): boolean {
    return repair.status !== 'picked_up' && repair.status !== 'canceled';
  }

  private isUpcomingRepair(repair: Repair, now: number): boolean {
    if (!repair.appointment?.startAt) return false;
    const startAt = new Date(repair.appointment.startAt).getTime();
    if (Number.isNaN(startAt)) return false;

    return startAt >= now && repair.status !== 'picked_up' && repair.status !== 'canceled';
  }

  private isPastRepair(repair: Repair, now: number): boolean {
    if (!repair.appointment?.startAt) return false;
    const startAt = new Date(repair.appointment.startAt).getTime();
    if (Number.isNaN(startAt)) return false;

    return startAt < now;
  }
}