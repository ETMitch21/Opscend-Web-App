import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom, Subscription } from 'rxjs';
import {
  AlertTriangle,
  BellRing,
  BookOpen,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  DollarSign,
  ExternalLink,
  Gauge,
  ListTodo,
  Loader2,
  MessageSquare,
  PackageCheck,
  Pause,
  Play,
  RefreshCw,
  UserRound,
  Wrench,
  LucideAngularModule,
} from 'lucide-angular';

import type { RepairStatus } from '../../core/repairs/repair.model';
import { RepairsService } from '../../core/repairs/repairs-service';
import {
  TechnicianDashboardData,
  TechnicianDashboardRepair,
  TechnicianDashboardTask,
} from '../../core/technician-dashboard/model';
import { TechnicianDashboardService } from '../../core/technician-dashboard/service';
import { ToastService } from '../../core/toast/toast-service';
import { WorkQueueService } from '../../core/work-queue/service';

@Component({
  selector: 'app-technician-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './technician-dashboard.html',
  styleUrl: './technician-dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TechnicianDashboard implements OnInit, OnDestroy {
  private readonly api = inject(TechnicianDashboardService);
  private readonly workQueue = inject(WorkQueueService);
  private readonly repairs = inject(RepairsService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);

  readonly icons = {
    AlertTriangle,
    BellRing,
    BookOpen,
    CalendarClock,
    CalendarDays,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    ClipboardCheck,
    Clock3,
    DollarSign,
    ExternalLink,
    Gauge,
    ListTodo,
    Loader2,
    MessageSquare,
    PackageCheck,
    Pause,
    Play,
    RefreshCw,
    UserRound,
    Wrench,
  };

  readonly repairStatuses: ReadonlyArray<{ value: RepairStatus; label: string }> = [
    { value: 'intake', label: 'Intake' },
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'needs_reassignment', label: 'Needs reassignment' },
    { value: 'customer_verified', label: 'Customer verified' },
    { value: 'diagnosing', label: 'Diagnosing' },
    { value: 'awaiting_approval', label: 'Awaiting approval' },
    { value: 'awaiting_parts', label: 'Awaiting parts' },
    { value: 'in_repair', label: 'In repair' },
    { value: 'documentation_pending', label: 'Documentation pending' },
    { value: 'qc', label: 'Quality control' },
    { value: 'ready', label: 'Ready for pickup' },
    { value: 'picked_up', label: 'Picked up' },
    { value: 'canceled', label: 'Canceled' },
  ];

  readonly data = signal<TechnicianDashboardData | null>(null);
  readonly loading = signal(true);
  readonly refreshing = signal(false);
  readonly error = signal<string | null>(null);
  readonly selectedUserId = signal<string | null>(null);
  readonly selectedDate = signal('');
  readonly workingTaskId = signal<string | null>(null);
  readonly workingRepairId = signal<string | null>(null);
  readonly nowTick = signal(Date.now());

  repairStatusDrafts: Record<string, RepairStatus> = {};

  private querySubscription: Subscription | null = null;
  private clockTimer: ReturnType<typeof setInterval> | null = null;

  readonly selectedSchedule = computed(() =>
    (this.data()?.schedule ?? []).filter((appointment) => appointment.isSelectedDate),
  );

  readonly upcomingSchedule = computed(() => {
    const selectedDate = this.data()?.selectedDate ?? this.selectedDate();
    return (this.data()?.schedule ?? []).filter(
      (appointment) => !appointment.isSelectedDate && appointment.dateKey > selectedDate,
    );
  });

  readonly isViewingToday = computed(() => {
    const dashboard = this.data();
    return Boolean(dashboard && dashboard.selectedDate === dashboard.todayDate);
  });

  readonly urgentTasks = computed(() =>
    (this.data()?.tasks ?? []).filter(
      (task) => task.priority === 'urgent' || task.priority === 'high',
    ),
  );

  readonly blockers = computed(() =>
    (this.data()?.repairs ?? []).flatMap((repair) =>
      repair.blockers.map((blocker) => ({ repair, blocker })),
    ),
  );

  readonly dueForms = computed(() => {
    const rows = [...(this.data()?.forms ?? [])];
    return rows.sort((left, right) => {
      const leftDue = left.dueAt ? new Date(left.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
      const rightDue = right.dueAt ? new Date(right.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
      return leftDue - rightDue;
    });
  });

  ngOnInit(): void {
    this.clockTimer = setInterval(() => this.nowTick.set(Date.now()), 1000);
    this.querySubscription = this.route.queryParamMap.subscribe((params) => {
      const userId = params.get('userId');
      const date = params.get('date');
      this.selectedUserId.set(userId);
      this.selectedDate.set(date ?? '');
      void this.load(userId, false, date);
    });
  }

  ngOnDestroy(): void {
    this.querySubscription?.unsubscribe();
    this.querySubscription = null;

    if (this.clockTimer) {
      clearInterval(this.clockTimer);
      this.clockTimer = null;
    }
  }

  async load(
    userId?: string | null,
    silent = false,
    date: string | null = this.selectedDate() || null,
  ): Promise<void> {
    if (!silent) this.loading.set(true);
    this.error.set(null);

    try {
      const response = await firstValueFrom(this.api.load(userId, date));
      this.data.set(response.data);
      this.selectedUserId.set(response.data.technician.id);
      this.selectedDate.set(response.data.selectedDate);
      this.repairStatusDrafts = Object.fromEntries(
        response.data.repairs.map((repair) => [repair.id, repair.status]),
      );
    } catch (error) {
      console.error('Technician dashboard load failed.', error);
      this.error.set('The technician dashboard could not be loaded. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }

  async refresh(): Promise<void> {
    if (this.refreshing()) return;
    this.refreshing.set(true);

    try {
      await this.load(this.selectedUserId(), true);
    } finally {
      this.refreshing.set(false);
    }
  }

  switchTechnician(userId: string): void {
    if (!userId || userId === this.selectedUserId()) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { userId },
      queryParamsHandling: 'merge',
    });
  }

  changeDate(value: string): void {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
    const todayDate = this.data()?.todayDate ?? value;
    const nextDate = value < todayDate ? todayDate : value;
    if (nextDate === this.selectedDate()) return;

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { date: nextDate === todayDate ? null : nextDate },
      queryParamsHandling: 'merge',
    });
  }

  shiftDate(days: number): void {
    const current = this.selectedDate() || this.data()?.todayDate;
    if (!current) return;

    const date = new Date(`${current}T12:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + days);
    this.changeDate(date.toISOString().slice(0, 10));
  }

  goToToday(): void {
    const todayDate = this.data()?.todayDate;
    if (!todayDate) return;
    this.changeDate(todayDate);
  }

  scheduleHeading(): string {
    if (this.isViewingToday()) return "Today's schedule";
    return `${this.formatDateKey(this.selectedDate())} schedule`;
  }

  appointmentSummaryLabel(): string {
    return this.isViewingToday()
      ? "Today's appointments"
      : `Appointments · ${this.formatDateKey(this.selectedDate())}`;
  }

  formatDateKey(value: string): string {
    if (!value) return 'Selected date';
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(new Date(`${value}T12:00:00.000Z`));
  }

  openRoute(route: string | null | undefined): void {
    if (!route) return;
    void this.router.navigateByUrl(route);
  }

  async startTask(task: TechnicianDashboardTask): Promise<void> {
    if (this.workingTaskId()) return;
    this.workingTaskId.set(task.id);

    try {
      await firstValueFrom(this.workQueue.start(task.id));
      this.toast.success('Task started', 'The timer is running.');
      await this.load(this.selectedUserId(), true);
    } catch (error) {
      console.error('Task start failed.', error);
      this.toast.error('Could not start task', 'Please try again.');
    } finally {
      this.workingTaskId.set(null);
    }
  }

  async pauseTask(task: TechnicianDashboardTask): Promise<void> {
    if (this.workingTaskId()) return;
    this.workingTaskId.set(task.id);

    try {
      await firstValueFrom(this.workQueue.pause(task.id));
      this.toast.success('Timer paused', 'Tracked time was saved to the task.');
      await this.load(this.selectedUserId(), true);
    } catch (error) {
      console.error('Task pause failed.', error);
      this.toast.error('Could not pause task', 'Please try again.');
    } finally {
      this.workingTaskId.set(null);
    }
  }

  async completeTask(task: TechnicianDashboardTask): Promise<void> {
    if (this.workingTaskId()) return;
    this.workingTaskId.set(task.id);

    try {
      await firstValueFrom(this.workQueue.complete(task.id));
      this.toast.success('Task completed', 'The item was closed successfully.');
      await this.load(this.selectedUserId(), true);
    } catch (error) {
      console.error('Task completion failed.', error);
      this.toast.error('Could not complete task', 'Please try again.');
    } finally {
      this.workingTaskId.set(null);
    }
  }

  async updateRepairStatus(repair: TechnicianDashboardRepair): Promise<void> {
    const status = this.repairStatusDrafts[repair.id];
    if (!status || status === repair.status || this.workingRepairId()) return;
    this.workingRepairId.set(repair.id);

    try {
      await firstValueFrom(this.repairs.updateRepairStatus(repair.id, status));
      this.toast.success('Repair updated', `Status changed to ${this.statusLabel(status)}.`);
      await this.load(this.selectedUserId(), true);
    } catch (error: any) {
      console.error('Repair status update failed.', error);
      this.repairStatusDrafts[repair.id] = repair.status;
      const message = error?.error?.message || 'The repair status could not be updated.';
      this.toast.error('Status change blocked', message);
    } finally {
      this.workingRepairId.set(null);
    }
  }

  activeTimerSeconds(task: TechnicianDashboardTask | null): number {
    if (!task) return 0;
    const accumulated = Number(task.timerAccumulatedSeconds ?? 0);
    if (!task.timerStartedAt) return accumulated;
    const running = Math.max(0, Math.floor((this.nowTick() - new Date(task.timerStartedAt).getTime()) / 1000));
    return accumulated + running;
  }

  formatDuration(totalSeconds: number): string {
    const seconds = Math.max(0, Math.floor(totalSeconds));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remaining = seconds % 60;
    return hours > 0
      ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`
      : `${minutes}:${String(remaining).padStart(2, '0')}`;
  }

  formatTime(value: string | null): string {
    if (!value) return 'Not scheduled';
    return new Intl.DateTimeFormat('en-US', {
      timeZone: this.data()?.shop.timezone,
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value));
  }

  formatDate(value: string | null): string {
    if (!value) return 'No date';
    return new Intl.DateTimeFormat('en-US', {
      timeZone: this.data()?.shop.timezone,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(new Date(value));
  }

  formatDateTime(value: string | null): string {
    if (!value) return 'No activity yet';
    return new Intl.DateTimeFormat('en-US', {
      timeZone: this.data()?.shop.timezone,
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value));
  }

  isOverdue(value: string | null): boolean {
    return Boolean(value && new Date(value).getTime() < this.nowTick());
  }

  dueLabel(value: string | null): string {
    if (!value) return 'No due date';
    const due = new Date(value).getTime();
    const difference = due - this.nowTick();
    if (difference < 0) return `Overdue · ${this.formatDateTime(value)}`;
    if (difference <= 24 * 60 * 60 * 1000) return `Due soon · ${this.formatDateTime(value)}`;
    return `Due ${this.formatDateTime(value)}`;
  }

  money(cents: number): string {
    const currency = String(this.data()?.shop.currency || 'USD').toUpperCase();
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format((cents || 0) / 100);
  }

  statusLabel(status: string | null): string {
    if (!status) return 'Unknown';
    return this.repairStatuses.find((option) => option.value === status)?.label ?? this.titleCase(status);
  }

  titleCase(value: string): string {
    return String(value || '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  priorityClasses(priority: string): string {
    switch (priority) {
      case 'urgent': return 'border-rose-200 bg-rose-50 text-rose-700';
      case 'high': return 'border-amber-200 bg-amber-50 text-amber-700';
      case 'low': return 'border-slate-200 bg-slate-50 text-slate-500';
      default: return 'border-blue-200 bg-blue-50 text-blue-700';
    }
  }

  statusClasses(status: string): string {
    switch (status) {
      case 'ready': return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
      case 'awaiting_parts':
      case 'awaiting_approval': return 'bg-amber-50 text-amber-700 ring-amber-200';
      case 'in_repair':
      case 'diagnosing':
      case 'qc': return 'bg-blue-50 text-blue-700 ring-blue-200';
      case 'canceled': return 'bg-rose-50 text-rose-700 ring-rose-200';
      default: return 'bg-slate-100 text-slate-600 ring-slate-200';
    }
  }

  blockerIcon(type: string) {
    switch (type) {
      case 'parts':
      case 'inventory': return this.icons.PackageCheck;
      case 'payment': return this.icons.DollarSign;
      case 'form': return this.icons.ClipboardCheck;
      default: return this.icons.AlertTriangle;
    }
  }
}
