import { CommonModule } from '@angular/common';
import {
  Component,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { firstValueFrom, Subscription } from 'rxjs';
import { AvailabilityStore } from '../../../core/availability/availability-store';
import { SchedulingModalService } from '../../../core/scheduling/schedulingModal-service';
import {
  SchedulingRequest,
  SchedulingSelection,
  CalendarDay,
} from '../../../core/scheduling/scheduling.types';
import { UsersStore } from '../../../core/users/users-store';
import { AvailabilityService } from '../../../core/availability/availability-service';
import { AvailabilitySlot } from '../../../core/availability/availability-model';
import { AppointmentsStore } from '../../../core/appointments/appointments.store';

@Component({
  selector: 'app-scheduling-picker',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './scheduling-picker-modal.html',
  styleUrl: './scheduling-picker-modal.scss',
})
export class SchedulingPickerModalComponent implements OnInit, OnDestroy {
  private readonly schedulingModalService = inject(SchedulingModalService);
  private readonly availabilityStore = inject(AvailabilityStore);
  private readonly usersStore = inject(UsersStore);
  private readonly availabilityService = inject(AvailabilityService);
  private readonly appointmentsStore = inject(AppointmentsStore);

  private readonly subscription = new Subscription();

  readonly displayMode = input<'modal' | 'inline'>('modal');
  readonly showHeader = input(true);
  readonly inlineRequest = input<SchedulingRequest | null>(null);

  readonly selectionChange = output<SchedulingSelection>();

  readonly isOpen = signal(false);
  readonly modalRequest = signal<SchedulingRequest | null>(null);
  readonly selectedStartAt = signal<string | null>(null);
  readonly selectedDate = signal<string | null>(null);
  readonly visibleMonth = signal(this.startOfMonth(new Date()));
  readonly lastRequestKey = signal<string | null>(null);

  readonly unionSlots = signal<AvailabilitySlot[]>([]);
  readonly slotUserMap = signal<Record<string, string[]>>({});
  readonly selectedAssignedUserId = signal<string | null>(null);
  readonly manuallySelectedAssignedUserId = signal<string | null>(null);

  readonly slots = this.availabilityStore.slots;
  readonly loading = this.availabilityStore.listLoading;
  readonly error = this.availabilityStore.error;

  readonly confirmedSelection = signal<SchedulingSelection | null>(null);
  readonly inlineCollapsed = signal(false);

  readonly appointmentCountsByUserId = computed(() => {
    const counts: Record<string, number> = {};

    for (const item of this.appointmentsStore.appointments()) {
      const assignedUserId = item.appointment.assignedUserId;
      const status = item.appointment.status;

      if (!assignedUserId) continue;
      if (status === 'canceled') continue;

      counts[assignedUserId] = (counts[assignedUserId] ?? 0) + 1;
    }

    return counts;
  });

  readonly activeRequest = computed(() => {
    return this.displayMode() === 'inline'
      ? this.inlineRequest()
      : this.modalRequest();
  });

  readonly appointmentCountsByUserIdForSelectedDate = computed(() => {
    const counts: Record<string, number> = {};
    const selectedDate = this.selectedDate();

    if (!selectedDate) {
      return counts;
    }

    for (const item of this.appointmentsStore.appointments()) {
      const assignedUserId = item.appointment.assignedUserId;
      const status = item.appointment.status;

      if (!assignedUserId) continue;
      if (status === 'canceled') continue;

      const appointmentDate = this.toDateKey(item.appointment.startAt);

      if (appointmentDate !== selectedDate) continue;

      counts[assignedUserId] = (counts[assignedUserId] ?? 0) + 1;
    }

    return counts;
  });

  readonly isUsingSuggestedTechnician = computed(() => {
    const requestAssignedUserId = this.activeRequest()?.assignedUserId ?? null;

    if (requestAssignedUserId) {
      return false;
    }

    if (!this.selectedAssignedUserId()) {
      return false;
    }

    return !this.manuallySelectedAssignedUserId();
  });

  readonly displaySlots = computed(() => {
    const request = this.activeRequest();

    if (request?.assignedUserId) {
      return this.availabilityStore.slots();
    }

    return this.unionSlots();
  });

  readonly selectedSlot = computed(() => {
    const selectedStartAt = this.selectedStartAt();
    if (!selectedStartAt) return null;

    return this.displaySlots().find((slot) => slot.startAt === selectedStartAt) ?? null;
  });

  readonly availableUsersForSelectedSlot = computed(() => {
    const requestAssignedUserId = this.activeRequest()?.assignedUserId ?? null;

    if (requestAssignedUserId) {
      const user = this.usersStore.getById(requestAssignedUserId);
      return user ? [user] : [];
    }

    const slot = this.selectedSlot();
    if (!slot) return [];

    const availableIds = new Set(
      this.availableUserIdsForSlot(slot.startAt, slot.endAt)
    );

    return this.usersStore
      .assignableUsers()
      .filter((user) => availableIds.has(user.id));
  });

  readonly canConfirm = computed(() => {
    const slot = this.selectedSlot();
    if (!slot) return false;

    const requestAssignedUserId = this.activeRequest()?.assignedUserId ?? null;
    if (requestAssignedUserId) return true;

    return !!this.selectedAssignedUserId();
  });

  readonly title = computed(() => {
    return this.activeRequest()?.title ?? 'Schedule';
  });

  readonly subtitle = computed(() => {
    return this.activeRequest()?.subtitle ?? 'Choose an available time slot.';
  });

  readonly shouldRender = computed(() => {
    if (this.displayMode() === 'modal') {
      return this.isOpen();
    }

    return !this.inlineCollapsed();
  });

  readonly slotsByDate = computed(() => {
    const grouped: Record<string, { startAt: string; endAt: string }[]> = {};

    for (const slot of this.displaySlots()) {
      const dateKey = this.toDateKey(slot.startAt);

      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }

      grouped[dateKey].push(slot);
    }

    return Object.entries(grouped)
      .map(([date, slots]) => ({
        date,
        slots: [...slots].sort(
          (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
        ),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  });

  readonly availableDates = computed(() => {
    return this.slotsByDate()
      .map((group) => {
        const validSlots = group.slots.filter((slot) => !this.isPastSlot(slot.startAt));

        return {
          date: group.date,
          count: validSlots.length,
        };
      })
      .filter((group) => group.count > 0);
  });

  readonly selectedDateSlots = computed(() => {
    const date = this.selectedDate();
    if (!date) return [];

    const group = this.slotsByDate().find((item) => item.date === date);
    if (!group) return [];

    return group.slots.filter((slot) => !this.isPastSlot(slot.startAt));
  });

  readonly availableDateSet = computed(() => {
    return new Set(this.availableDates().map((item) => item.date));
  });

  readonly visibleMonthLabel = computed(() => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      year: 'numeric',
    }).format(this.visibleMonth());
  });

  readonly calendarDays = computed((): CalendarDay[] => {
    const monthStart = this.visibleMonth();
    const gridStart = new Date(monthStart);
    const dayOfWeek = gridStart.getDay();

    gridStart.setDate(gridStart.getDate() - dayOfWeek);

    const days: CalendarDay[] = [];
    const availableDates = this.availableDateSet();
    const selectedDate = this.selectedDate();
    const todayKey = this.toDateKey(new Date().toISOString());

    for (let i = 0; i < 42; i++) {
      const current = new Date(gridStart);
      current.setDate(gridStart.getDate() + i);

      const dateKey = this.toDateKey(current.toISOString());

      days.push({
        dateKey,
        dayNumber: current.getDate(),
        inCurrentMonth: current.getMonth() === monthStart.getMonth(),
        isAvailable: availableDates.has(dateKey),
        isSelected: selectedDate === dateKey,
        isToday: dateKey === todayKey,
        isPastDate: dateKey < todayKey,
      });
    }

    return days;
  });

  constructor() {
    effect(async () => {
      if (this.displayMode() !== 'inline') return;

      const request = this.inlineRequest();
      const visibleMonth = this.visibleMonth();

      if (!request) {
        this.selectedStartAt.set(null);
        this.selectedDate.set(null);
        this.lastRequestKey.set(null);
        this.confirmedSelection.set(null);
        this.inlineCollapsed.set(false);
        this.unionSlots.set([]);
        this.slotUserMap.set({});
        this.selectedAssignedUserId.set(null);
        this.manuallySelectedAssignedUserId.set(null);
        this.availabilityStore.clearSlots();
        return;
      }

      const monthRequest = this.buildMonthBoundRequest(request, visibleMonth);

      const requestKey = JSON.stringify({
        from: monthRequest.from,
        to: monthRequest.to,
        durationMinutes: monthRequest.durationMinutes,
        repairId: monthRequest.repairId,
        assignedUserId: monthRequest.assignedUserId ?? null,
        slotMinutes: monthRequest.slotMinutes,
      });

      if (this.lastRequestKey() === requestKey) {
        return;
      }

      this.confirmedSelection.set(null);
      this.inlineCollapsed.set(false);
      this.selectedAssignedUserId.set(request.assignedUserId ?? null);

      await this.loadSlots(monthRequest, false);
      this.lastRequestKey.set(requestKey);
    });
  }

  ngOnInit(): void {
    this.subscription.add(
      this.schedulingModalService.context.subscribe(async (context) => {
        if (this.displayMode() === 'inline') return;

        this.isOpen.set(context.isOpen);
        this.modalRequest.set(context.request);
        this.selectedStartAt.set(null);
        this.lastRequestKey.set(null);
        this.selectedAssignedUserId.set(null);

        if (context.request) {
          const initialMonth = this.startOfMonth(new Date(context.request.from));
          this.visibleMonth.set(initialMonth);

          const monthRequest = this.buildMonthBoundRequest(
            context.request,
            initialMonth
          );

          const requestKey = JSON.stringify({
            from: monthRequest.from,
            to: monthRequest.to,
            durationMinutes: monthRequest.durationMinutes,
            repairId: monthRequest.repairId,
            assignedUserId: monthRequest.assignedUserId ?? null,
            slotMinutes: monthRequest.slotMinutes,
          });

          this.selectedAssignedUserId.set(context.request.assignedUserId ?? null);

          await this.loadSlots(monthRequest, false);
          this.lastRequestKey.set(requestKey);
        } else {
          this.selectedDate.set(null);
          this.unionSlots.set([]);
          this.slotUserMap.set({});
          this.selectedAssignedUserId.set(null);
          this.manuallySelectedAssignedUserId.set(null);
          this.availabilityStore.clearSlots();
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  async loadSlots(
    request: SchedulingRequest,
    syncVisibleMonthFromSelection = false
  ): Promise<void> {
    const previousSelectedDate = this.selectedDate();

    await this.loadAppointmentWorkload(request);

    if (request.assignedUserId) {
      this.unionSlots.set([]);
      this.slotUserMap.set({});

      await this.availabilityStore.loadSlots({
        from: request.from,
        to: request.to,
        durationMinutes: request.durationMinutes,
        repairId: request.repairId,
        assignedUserId: request.assignedUserId,
        slotMinutes: request.slotMinutes,
      });
    } else {
      await this.loadUnionSlots(request);
      this.availabilityStore.clearSlots();
    }

    const availableDates = this.availableDates().map((item) => item.date);

    if (previousSelectedDate && availableDates.includes(previousSelectedDate)) {
      this.selectedDate.set(previousSelectedDate);
    } else {
      this.selectedDate.set(availableDates[0] ?? null);
    }

    if (syncVisibleMonthFromSelection && this.selectedDate()) {
      const selected = new Date(`${this.selectedDate()}T12:00:00`);
      this.visibleMonth.set(this.startOfMonth(selected));
    }

    this.selectedStartAt.set(null);
  }

  buildMonthBoundRequest(
    request: SchedulingRequest,
    month: Date
  ): SchedulingRequest {
    const start = new Date(
      month.getFullYear(),
      month.getMonth(),
      1,
      0,
      0,
      0,
      0
    );

    const end = new Date(
      month.getFullYear(),
      month.getMonth() + 1,
      0,
      23,
      59,
      59,
      999
    );

    return {
      ...request,
      from: start.toISOString(),
      to: end.toISOString(),
    };
  }

  selectSlot(startAt: string): void {
    if (this.isPastSlot(startAt)) return;

    this.selectedStartAt.set(startAt);

    const requestAssignedUserId = this.activeRequest()?.assignedUserId ?? null;
    if (requestAssignedUserId) {
      this.selectedAssignedUserId.set(requestAssignedUserId);
      return;
    }

    const slot = this.displaySlots().find((item) => item.startAt === startAt);
    if (!slot) {
      this.selectedAssignedUserId.set(null);
      this.clearManualAssignmentSelection();
      return;
    }

    const availableIds = this.availableUserIdsForSlot(slot.startAt, slot.endAt);
    const currentSelectedUserId = this.selectedAssignedUserId();

    if (currentSelectedUserId && !availableIds.includes(currentSelectedUserId)) {
      this.selectedAssignedUserId.set(null);
      this.clearManualAssignmentSelection();
    }

    this.autoSelectBestAvailableUserForSlot(slot.startAt, slot.endAt);
  }

  selectDate(date: string): void {
    this.selectedDate.set(date);
    this.selectedStartAt.set(null);

    const requestAssignedUserId = this.activeRequest()?.assignedUserId ?? null;
    if (!requestAssignedUserId) {
      this.selectedAssignedUserId.set(null);
      this.clearManualAssignmentSelection();
    }

    const selected = new Date(`${date}T12:00:00`);
    const selectedMonth = this.startOfMonth(selected);

    if (selectedMonth.getTime() !== this.visibleMonth().getTime()) {
      this.visibleMonth.set(selectedMonth);
    }
  }

  confirm(): void {
    const slot = this.selectedSlot();
    if (!slot) return;

    const requestAssignedUserId = this.activeRequest()?.assignedUserId ?? null;
    const chosenAssignedUserId = requestAssignedUserId ?? this.selectedAssignedUserId() ?? null;
    const chosenAssignedUserName =
      chosenAssignedUserId
        ? this.usersStore.getById(chosenAssignedUserId)?.name ?? null
        : null;

    const selection: SchedulingSelection = {
      startAt: slot.startAt,
      endAt: slot.endAt,
      assignedUserId: chosenAssignedUserId,
      assignedTo: chosenAssignedUserName,
    };

    if (this.displayMode() === 'inline') {
      this.confirmedSelection.set(selection);
      this.inlineCollapsed.set(true);
      this.selectionChange.emit(selection);
      return;
    }

    this.schedulingModalService.confirm(selection);
  }

  expandInlineEditor(): void {
    if (this.displayMode() !== 'inline') return;
    this.inlineCollapsed.set(false);
  }

  close(): void {
    if (this.displayMode() === 'modal') {
      this.schedulingModalService.close();
    }
  }

  previousMonth(): void {
    const current = this.visibleMonth();
    const previous = new Date(current);
    previous.setMonth(previous.getMonth() - 1);
    this.visibleMonth.set(this.startOfMonth(previous));
  }

  nextMonth(): void {
    const current = this.visibleMonth();
    const next = new Date(current);
    next.setMonth(next.getMonth() + 1);
    this.visibleMonth.set(this.startOfMonth(next));
  }

  selectAssignedUser(userId: string | null): void {
    this.selectedAssignedUserId.set(userId);
    this.manuallySelectedAssignedUserId.set(userId);
  }

  availableUserIdsForSlot(startAt: string, endAt: string): string[] {
    return this.slotUserMap()[`${startAt}__${endAt}`] ?? [];
  }

  isAssignedUserSelected(userId: string): boolean {
    return this.selectedAssignedUserId() === userId;
  }

  trackBySlot(_: number, slot: { startAt: string }): string {
    return slot.startAt;
  }

  formatDateLabel(value: string): string {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(new Date(value));
  }

  formatTimeLabel(value: string): string {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value));
  }

  formatCalendarDateLabel(dateKey: string): string {
    const date = new Date(`${dateKey}T12:00:00`);

    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(date);
  }

  formatCalendarDateSubLabel(dateKey: string): string {
    const date = new Date(`${dateKey}T12:00:00`);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric'
    }).format(date);
  }

  isSelected(startAt: string): boolean {
    return this.selectedStartAt() === startAt;
  }

  isSelectedDate(date: string): boolean {
    return this.selectedDate() === date;
  }

  isPastSlot(startAt: string): boolean {
    return new Date(startAt).getTime() <= Date.now();
  }

  toDateKey(value: string): string {
    const date = new Date(value);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  startOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  private async loadUnionSlots(request: SchedulingRequest): Promise<void> {
    if (!this.usersStore.loaded()) {
      await this.usersStore.load();
    }

    const assignableUsers = this.usersStore.assignableUsers();

    if (!assignableUsers.length) {
      this.unionSlots.set([]);
      this.slotUserMap.set({});
      return;
    }

    const results = await Promise.all(
      assignableUsers.map(async (user) => {
        const response = await firstValueFrom(
          this.availabilityService.listSlots({
            from: request.from,
            to: request.to,
            durationMinutes: request.durationMinutes,
            repairId: request.repairId,
            assignedUserId: user.id,
            slotMinutes: request.slotMinutes,
          })
        );

        return {
          userId: user.id,
          slots: response.data,
        };
      })
    );

    const merged = new Map<
      string,
      { startAt: string; endAt: string; userIds: Set<string> }
    >();

    for (const result of results) {
      for (const slot of result.slots) {
        const key = `${slot.startAt}__${slot.endAt}`;

        if (!merged.has(key)) {
          merged.set(key, {
            startAt: slot.startAt,
            endAt: slot.endAt,
            userIds: new Set<string>(),
          });
        }

        merged.get(key)!.userIds.add(result.userId);
      }
    }

    const unionSlots = Array.from(merged.values())
      .map((item) => ({
        startAt: item.startAt,
        endAt: item.endAt,
      }))
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

    const slotUserMap: Record<string, string[]> = {};

    for (const [key, value] of merged.entries()) {
      slotUserMap[key] = Array.from(value.userIds);
    }

    this.unionSlots.set(unionSlots);
    this.slotUserMap.set(slotUserMap);
  }

  selectedAssignedUserName(): string | null {
    const requestAssignedUserId = this.activeRequest()?.assignedUserId ?? null;
    const effectiveUserId = requestAssignedUserId ?? this.selectedAssignedUserId();

    if (!effectiveUserId) return null;

    return this.usersStore.getById(effectiveUserId)?.name ?? null;
  }

  private autoSelectBestAvailableUserForSlot(startAt: string, endAt: string): void {
    const requestAssignedUserId = this.activeRequest()?.assignedUserId ?? null;
    if (requestAssignedUserId) {
      this.selectedAssignedUserId.set(requestAssignedUserId);
      return;
    }

    if (this.manuallySelectedAssignedUserId()) {
      return;
    }

    const availableIds = this.availableUserIdsForSlot(startAt, endAt);
    if (!availableIds.length) {
      this.selectedAssignedUserId.set(null);
      return;
    }

    if (availableIds.length === 1) {
      this.selectedAssignedUserId.set(availableIds[0] ?? null);
      return;
    }

    const dayCounts = this.appointmentCountsByUserIdForSelectedDate();
    const totalCounts = this.appointmentCountsByUserId();

    const bestUserId = [...availableIds].sort((a, b) => {
      const dayCountDiff = (dayCounts[a] ?? 0) - (dayCounts[b] ?? 0);
      if (dayCountDiff !== 0) {
        return dayCountDiff;
      }

      const totalCountDiff = (totalCounts[a] ?? 0) - (totalCounts[b] ?? 0);
      if (totalCountDiff !== 0) {
        return totalCountDiff;
      }

      const aName = this.usersStore.getNameById(a) ?? '';
      const bName = this.usersStore.getNameById(b) ?? '';

      return aName.localeCompare(bName);
    })[0] ?? null;

    this.selectedAssignedUserId.set(bestUserId);
  }

  private async loadAppointmentWorkload(request: SchedulingRequest): Promise<void> {
    await this.appointmentsStore.loadAppointments({
      from: request.from,
      to: request.to,
    });
  }

  appointmentCountForUser(userId: string): number {
  return this.appointmentCountsByUserIdForSelectedDate()[userId] ?? 0;
}

  private clearManualAssignmentSelection(): void {
    this.manuallySelectedAssignedUserId.set(null);
  }
}