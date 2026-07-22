
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
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  AlertTriangle,
  BellRing,
  CalendarClock,
  Check,
  CheckCircle2,
  CircleDot,
  ClipboardCheck,
  Clock3,
  ExternalLink,
  FileText,
  ListTodo,
  Loader2,
  MailWarning,
  MessageSquare,
  PackageCheck,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Users,
  Wrench,
  X,
  type LucideIconData,
  LucideAngularModule,
} from 'lucide-angular';

import { ToastService } from '../../core/toast/toast-service';
import {
  CreateWorkQueueItemPayload,
  WorkQueueAssignee,
  WorkQueueItem,
  WorkQueueListParams,
  WorkQueuePriority,
  WorkQueueSourceType,
  WorkQueueSummary,
} from '../../core/work-queue/model';
import { WorkQueueService } from '../../core/work-queue/service';

type QueueView = 'open' | 'mine' | 'snoozed' | 'completed';
type QueuePriorityFilter = 'all' | WorkQueuePriority;
type QueueSourceFilter = 'all' | WorkQueueSourceType;
type QueueAssignmentFilter = 'all' | 'unassigned' | string;
type QueueDueFilter = 'all' | 'overdue' | 'today';

interface QueueViewOption {
  key: QueueView;
  label: string;
}

interface TaskDraft {
  title: string;
  description: string;
  category: string;
  priority: WorkQueuePriority;
  assignedToUserId: string;
  dueAt: string;
}

@Component({
  selector: 'app-work-queue',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './work-queue.html',
  styleUrl: './work-queue.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkQueue implements OnInit, OnDestroy {
  private readonly workQueueService = inject(WorkQueueService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly icons = {
    AlertTriangle,
    BellRing,
    CalendarClock,
    Check,
    CheckCircle2,
      CircleDot,
    ClipboardCheck,
    Clock3,
    ExternalLink,
    FileText,
      ListTodo,
    Loader2,
    MailWarning,
    MessageSquare,
    PackageCheck,
    Pencil,
    Plus,
    RefreshCw,
    RotateCcw,
    Search,
        Users,
    Wrench,
    X,
  };

  readonly views: ReadonlyArray<QueueViewOption> = [
    { key: 'open', label: 'Open' },
    { key: 'mine', label: 'Assigned to me' },
    { key: 'snoozed', label: 'Snoozed' },
    { key: 'completed', label: 'Completed' },
  ];

  readonly priorityOptions: ReadonlyArray<{
    value: QueuePriorityFilter;
    label: string;
  }> = [
    { value: 'all', label: 'All priorities' },
    { value: 'urgent', label: 'Urgent' },
    { value: 'high', label: 'High' },
    { value: 'normal', label: 'Normal' },
    { value: 'low', label: 'Low' },
  ];

  readonly sourceOptions: ReadonlyArray<{
    value: QueueSourceFilter;
    label: string;
  }> = [
    { value: 'all', label: 'All sources' },
    { value: 'manual', label: 'Manual tasks' },
    { value: 'repair', label: 'Repairs' },
    { value: 'quote', label: 'Quotes' },
    { value: 'order', label: 'Orders' },
    { value: 'appointment', label: 'Appointments' },
    { value: 'communication', label: 'Communications' },
  ];

  readonly dueOptions: ReadonlyArray<{
    value: QueueDueFilter;
    label: string;
  }> = [
    { value: 'all', label: 'All due dates' },
    { value: 'overdue', label: 'Overdue' },
    { value: 'today', label: 'Due today' },
  ];

  readonly items = signal<WorkQueueItem[]>([]);
  readonly assignees = signal<WorkQueueAssignee[]>([]);
  readonly summary = signal<WorkQueueSummary | null>(null);
  readonly loading = signal(true);
  readonly refreshing = signal(false);
  readonly error = signal<string | null>(null);
  readonly workingItemId = signal<string | null>(null);
  readonly nextCursor = signal<string | null>(null);
  readonly loadingMore = signal(false);

  readonly activeView = signal<QueueView>('open');
  readonly searchQuery = signal('');
  readonly priorityFilter = signal<QueuePriorityFilter>('all');
  readonly sourceFilter = signal<QueueSourceFilter>('all');
  readonly assignmentFilter = signal<QueueAssignmentFilter>('all');
  readonly dueFilter = signal<QueueDueFilter>('all');

  readonly taskModalOpen = signal(false);
  readonly editingItem = signal<WorkQueueItem | null>(null);
  readonly taskSaving = signal(false);

  readonly resolutionModalOpen = signal(false);
  readonly resolvingItem = signal<WorkQueueItem | null>(null);
  readonly resolutionNote = signal('');
  readonly resolutionSaving = signal(false);

  readonly snoozeMenuItemId = signal<string | null>(null);

  taskDraft: TaskDraft = this.emptyTaskDraft();

  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  readonly activeCount = computed(() => this.summary()?.counts.open ?? 0);
  readonly resultLabel = computed(() => {
    const count = this.items().length;
    return `${count} item${count === 1 ? '' : 's'}`;
  });

  readonly hasFilters = computed(
    () =>
      Boolean(this.searchQuery().trim()) ||
      this.priorityFilter() !== 'all' ||
      this.sourceFilter() !== 'all' ||
      this.assignmentFilter() !== 'all' ||
      this.dueFilter() !== 'all',
  );

  ngOnInit(): void {
    void this.loadAll();
  }

  ngOnDestroy(): void {
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
      this.searchTimer = null;
    }
  }

  async loadAll(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    const [summaryResult, assigneeResult, listResult] = await Promise.allSettled([
      firstValueFrom(this.workQueueService.getSummary()),
      firstValueFrom(this.workQueueService.listAssignees()),
      this.loadItems(),
    ]);

    if (summaryResult.status === 'fulfilled') {
      this.summary.set(summaryResult.value.data);
    }

    if (assigneeResult.status === 'fulfilled') {
      this.assignees.set(assigneeResult.value.data ?? []);
    }

    if (listResult.status === 'rejected') {
      this.error.set('The work queue could not be loaded. Please try again.');
    }

    this.loading.set(false);
  }

  async refresh(): Promise<void> {
    if (this.refreshing()) return;

    this.refreshing.set(true);

    try {
      const [summary, list] = await Promise.all([
        firstValueFrom(this.workQueueService.getSummary()),
        this.loadItems(),
      ]);
      this.summary.set(summary.data);
    } catch (error) {
      console.error('Work queue refresh failed.', error);
      this.toast.error('Refresh failed', 'The work queue could not be refreshed.');
    } finally {
      this.refreshing.set(false);
    }
  }

  async setView(view: QueueView): Promise<void> {
    this.activeView.set(view);
    this.snoozeMenuItemId.set(null);
    await this.loadItems();
  }

  onSearchInput(value: string): void {
    this.searchQuery.set(value);

    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }

    this.searchTimer = setTimeout(() => {
      void this.loadItems();
    }, 300);
  }

  async applyFilters(): Promise<void> {
    await this.loadItems();
  }

  async clearFilters(): Promise<void> {
    this.searchQuery.set('');
    this.priorityFilter.set('all');
    this.sourceFilter.set('all');
    this.assignmentFilter.set('all');
    this.dueFilter.set('all');
    await this.loadItems();
  }

  async showSummary(
    view: QueueView,
    filter: 'all' | 'urgent' | 'overdue' | 'today' | 'unassigned' = 'all',
  ): Promise<void> {
    this.activeView.set(view);
    this.searchQuery.set('');
    this.priorityFilter.set(filter === 'urgent' ? 'urgent' : 'all');
    this.sourceFilter.set('all');
    this.assignmentFilter.set(filter === 'unassigned' ? 'unassigned' : 'all');
    this.dueFilter.set(
      filter === 'overdue'
        ? 'overdue'
        : filter === 'today'
          ? 'today'
          : 'all',
    );
    this.snoozeMenuItemId.set(null);
    await this.loadItems();
  }

  openCreateTask(): void {
    this.editingItem.set(null);
    this.taskDraft = this.emptyTaskDraft();
    this.taskModalOpen.set(true);
  }

  openEditTask(item: WorkQueueItem): void {
    if (item.automatic) return;

    this.editingItem.set(item);
    this.taskDraft = {
      title: item.title,
      description: item.description ?? '',
      category: item.category,
      priority: item.priority,
      assignedToUserId: item.assignedToUserId ?? '',
      dueAt: this.toDateTimeLocal(item.dueAt),
    };
    this.taskModalOpen.set(true);
  }

  closeTaskModal(): void {
    if (this.taskSaving()) return;
    this.taskModalOpen.set(false);
    this.editingItem.set(null);
  }

  async saveTask(): Promise<void> {
    const title = this.taskDraft.title.trim();
    if (!title || this.taskSaving()) return;

    this.taskSaving.set(true);

    try {
      const payload: CreateWorkQueueItemPayload = {
        title,
        description: this.taskDraft.description.trim() || null,
        category: this.taskDraft.category.trim() || 'Manual task',
        priority: this.taskDraft.priority,
        assignedToUserId: this.taskDraft.assignedToUserId || null,
        dueAt: this.taskDraft.dueAt
          ? new Date(this.taskDraft.dueAt).toISOString()
          : null,
      };

      const editing = this.editingItem();

      if (editing) {
        await firstValueFrom(
          this.workQueueService.update(editing.id, payload),
        );
        this.toast.success('Task updated', title);
      } else {
        await firstValueFrom(this.workQueueService.create(payload));
        this.toast.success('Task created', title);
      }

      this.taskModalOpen.set(false);
      this.editingItem.set(null);
      await this.refresh();
    } catch (error) {
      console.error('Work queue task could not be saved.', error);
      this.toast.error('Task not saved', 'Please review the task and try again.');
    } finally {
      this.taskSaving.set(false);
    }
  }

  async updateAssignment(item: WorkQueueItem, value: string): Promise<void> {
    await this.runItemAction(item, async () => {
      await firstValueFrom(
        this.workQueueService.update(item.id, {
          assignedToUserId: value || null,
        }),
      );
      this.toast.success(
        'Assignment updated',
        value
          ? `Assigned to ${this.assigneeName(value)}.`
          : 'The item is now unassigned.',
      );
    });
  }

  async updatePriority(
    item: WorkQueueItem,
    priority: WorkQueuePriority,
  ): Promise<void> {
    if (item.priority === priority) return;

    await this.runItemAction(item, async () => {
      await firstValueFrom(
        this.workQueueService.update(item.id, { priority }),
      );
    });
  }

  async startItem(item: WorkQueueItem): Promise<void> {
    await this.runItemAction(item, async () => {
      await firstValueFrom(
        this.workQueueService.update(item.id, { status: 'in_progress' }),
      );
      this.toast.success('Work started', item.title);
    });
  }

  openResolutionModal(item: WorkQueueItem): void {
    this.resolvingItem.set(item);
    this.resolutionNote.set('');
    this.resolutionModalOpen.set(true);
  }

  closeResolutionModal(): void {
    if (this.resolutionSaving()) return;
    this.resolutionModalOpen.set(false);
    this.resolvingItem.set(null);
    this.resolutionNote.set('');
  }

  async completeItem(): Promise<void> {
    const item = this.resolvingItem();
    if (!item || this.resolutionSaving()) return;

    this.resolutionSaving.set(true);

    try {
      await firstValueFrom(
        this.workQueueService.complete(item.id, {
          resolutionNote: this.resolutionNote().trim() || null,
        }),
      );
      this.toast.success('Item completed', item.title);
      this.resolutionModalOpen.set(false);
      this.resolvingItem.set(null);
      this.resolutionNote.set('');
      await this.refresh();
    } catch (error) {
      console.error('Work queue item could not be completed.', error);
      this.toast.error('Item not completed', 'Please try again.');
    } finally {
      this.resolutionSaving.set(false);
    }
  }

  async dismissItem(item: WorkQueueItem): Promise<void> {
    await this.runItemAction(item, async () => {
      await firstValueFrom(
        this.workQueueService.dismiss(item.id, {
          resolutionNote: 'Dismissed from the work queue.',
        }),
      );
      this.toast.success('Item dismissed', item.title);
    });
  }

  async reopenItem(item: WorkQueueItem): Promise<void> {
    await this.runItemAction(item, async () => {
      await firstValueFrom(this.workQueueService.reopen(item.id));
      this.toast.success('Item reopened', item.title);
    });
  }

  toggleSnoozeMenu(item: WorkQueueItem): void {
    this.snoozeMenuItemId.update((current) =>
      current === item.id ? null : item.id,
    );
  }

  async snoozeForHours(item: WorkQueueItem, hours: number): Promise<void> {
    const until = new Date(Date.now() + hours * 60 * 60 * 1000);
    await this.snoozeUntil(item, until);
  }

  async snoozeUntilTomorrow(item: WorkQueueItem): Promise<void> {
    const until = new Date();
    until.setDate(until.getDate() + 1);
    until.setHours(9, 0, 0, 0);
    await this.snoozeUntil(item, until);
  }

  async snoozeUntilNextWeek(item: WorkQueueItem): Promise<void> {
    const until = new Date();
    until.setDate(until.getDate() + 7);
    until.setHours(9, 0, 0, 0);
    await this.snoozeUntil(item, until);
  }

  async openSource(item: WorkQueueItem): Promise<void> {
    if (!item.route) return;
    await this.router.navigateByUrl(item.route);
  }

  itemIcon(item: WorkQueueItem): LucideIconData {
    switch (item.sourceType) {
      case 'repair':
        return this.icons.Wrench;
      case 'quote':
        return this.icons.FileText;
      case 'order':
        return this.icons.PackageCheck;
      case 'appointment':
        return this.icons.CalendarClock;
      case 'communication':
        return item.kind === 'delivery_issue'
          ? this.icons.MailWarning
          : this.icons.MessageSquare;
      case 'manual':
      default:
        return this.icons.ClipboardCheck;
    }
  }

  sourceLabel(sourceType: WorkQueueSourceType): string {
    switch (sourceType) {
      case 'repair':
        return 'Repair';
      case 'quote':
        return 'Quote';
      case 'order':
        return 'Order';
      case 'appointment':
        return 'Appointment';
      case 'communication':
        return 'Communication';
      case 'manual':
        return 'Manual';
    }
  }

  priorityLabel(priority: WorkQueuePriority): string {
    return priority.charAt(0).toUpperCase() + priority.slice(1);
  }

  priorityBadgeClass(priority: WorkQueuePriority): string {
    switch (priority) {
      case 'urgent':
        return 'border-rose-200 bg-rose-50 text-rose-700';
      case 'high':
        return 'border-amber-200 bg-amber-50 text-amber-700';
      case 'normal':
        return 'border-sky-200 bg-sky-50 text-sky-700';
      case 'low':
      default:
        return 'border-slate-200 bg-slate-50 text-slate-600';
    }
  }

  sourceIconClass(item: WorkQueueItem): string {
    switch (item.sourceType) {
      case 'repair':
        return 'bg-blue-50 text-blue-700';
      case 'quote':
        return 'bg-violet-50 text-violet-700';
      case 'order':
        return 'bg-amber-50 text-amber-700';
      case 'appointment':
        return 'bg-cyan-50 text-cyan-700';
      case 'communication':
        return item.kind === 'delivery_issue'
          ? 'bg-rose-50 text-rose-700'
          : 'bg-emerald-50 text-emerald-700';
      case 'manual':
      default:
        return 'bg-slate-100 text-slate-700';
    }
  }

  statusLabel(item: WorkQueueItem): string {
    switch (item.status) {
      case 'in_progress':
        return 'In progress';
      case 'snoozed':
        return 'Snoozed';
      case 'completed':
        return 'Completed';
      case 'dismissed':
        return 'Dismissed';
      case 'resolved':
        return 'Auto-resolved';
      case 'open':
      default:
        return 'Open';
    }
  }

  dueLabel(item: WorkQueueItem): string {
    if (item.status === 'snoozed' && item.snoozedUntil) {
      return `Snoozed until ${this.formatDateTime(item.snoozedUntil)}`;
    }

    if (!item.dueAt) return 'No due date';

    const date = new Date(item.dueAt);
    const diff = date.getTime() - Date.now();
    const hours = Math.round(Math.abs(diff) / 3_600_000);

    if (diff < 0) {
      if (hours < 1) return 'Overdue';
      if (hours < 24) return `${hours}h overdue`;
      return `${Math.round(hours / 24)}d overdue`;
    }

    if (hours < 1) return 'Due soon';
    if (hours < 24) return `Due in ${hours}h`;

    return this.formatDateTime(item.dueAt);
  }

  dueClass(item: WorkQueueItem): string {
    if (this.isOverdue(item)) return 'text-rose-700';
    if (item.dueAt && new Date(item.dueAt).getTime() - Date.now() < 86_400_000) {
      return 'text-amber-700';
    }
    return 'text-slate-500';
  }

  isOverdue(item: WorkQueueItem): boolean {
    return Boolean(
      item.dueAt &&
      ['open', 'in_progress'].includes(item.status) &&
      new Date(item.dueAt).getTime() < Date.now(),
    );
  }

  formatDateTime(value: string): string {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value));
  }

  assigneeName(userId: string): string {
    return this.assignees().find((user) => user.id === userId)?.name ?? 'User';
  }

  trackItem(_index: number, item: WorkQueueItem): string {
    return item.id;
  }

  async loadMore(): Promise<void> {
    const cursor = this.nextCursor();
    if (!cursor || this.loadingMore()) return;

    this.loadingMore.set(true);

    try {
      const response = await firstValueFrom(
        this.workQueueService.list(this.buildListParams(cursor)),
      );

      const combined = [
        ...this.items(),
        ...(response.data ?? []),
      ];

      this.items.set(
        [...new Map(combined.map((item) => [item.id, item])).values()],
      );
      this.nextCursor.set(response.nextCursor ?? null);
    } catch (error) {
      console.error('More work queue items could not be loaded.', error);
      this.toast.error('More items not loaded', 'Please try again.');
    } finally {
      this.loadingMore.set(false);
    }
  }

  private buildListParams(cursor?: string | null): WorkQueueListParams {
    const view = this.activeView();
    const assignmentFilter = this.assignmentFilter();
    const priorityFilter = this.priorityFilter();
    const sourceFilter = this.sourceFilter();
    const dueFilter = this.dueFilter();

    return {
      limit: 100,
      cursor: cursor ?? undefined,
      status:
        view === 'snoozed'
          ? 'snoozed'
          : view === 'completed'
            ? 'closed'
            : 'active',
      assignedToUserId:
        view === 'mine'
          ? 'me'
          : assignmentFilter === 'all'
            ? undefined
            : assignmentFilter,
      priority: priorityFilter === 'all' ? undefined : priorityFilter,
      sourceType: sourceFilter === 'all' ? undefined : sourceFilter,
      due: dueFilter === 'all' ? undefined : dueFilter,
      q: this.searchQuery().trim() || undefined,
    };
  }

  private async loadItems(): Promise<void> {
    this.error.set(null);

    const response = await firstValueFrom(
      this.workQueueService.list(this.buildListParams()),
    );

    this.items.set(response.data ?? []);
    this.nextCursor.set(response.nextCursor ?? null);
  }

  private async runItemAction(
    item: WorkQueueItem,
    action: () => Promise<void>,
  ): Promise<void> {
    if (this.workingItemId()) return;

    this.workingItemId.set(item.id);
    this.snoozeMenuItemId.set(null);

    try {
      await action();
      await this.refresh();
    } catch (error) {
      console.error('Work queue action failed.', error);
      this.toast.error('Action failed', 'The work queue item could not be updated.');
    } finally {
      this.workingItemId.set(null);
    }
  }

  private async snoozeUntil(item: WorkQueueItem, until: Date): Promise<void> {
    await this.runItemAction(item, async () => {
      await firstValueFrom(
        this.workQueueService.snooze(item.id, until.toISOString()),
      );
      this.toast.success('Item snoozed', `Hidden until ${this.formatDateTime(until.toISOString())}.`);
    });
  }

  private emptyTaskDraft(): TaskDraft {
    return {
      title: '',
      description: '',
      category: 'Manual task',
      priority: 'normal',
      assignedToUserId: '',
      dueAt: '',
    };
  }

  private toDateTimeLocal(value: string | null): string {
    if (!value) return '';
    const date = new Date(value);
    const offset = date.getTimezoneOffset() * 60_000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
  }
}
