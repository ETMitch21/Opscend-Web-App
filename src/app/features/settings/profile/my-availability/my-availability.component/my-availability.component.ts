import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { AvailabilityStore } from '../../../../../core/availability/availability-store';
import { AuthService } from '../../../../../core/auth/auth.service';
import type {
  AvailabilityOverrideMode,
  AvailabilityRule,
  DayOfWeek,
} from '../../../../../core/availability/availability-model';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ToastService } from '../../../../../core/toast/toast-service';

type EditableDay = {
  key: DayOfWeek;
  label: string;
  enabled: boolean;
  startTime: string;
  endTime: string;
  ruleId: string | null;
};

@Component({
  selector: 'app-my-availability',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule
  ],
  templateUrl: './my-availability.component.html',
})
export class MyAvailabilityComponent implements OnInit {
  private readonly availabilityStore = inject(AvailabilityStore);
  protected readonly authService = inject(AuthService);
  protected readonly toastService = inject(ToastService);

  protected readonly loading = signal(true);

  protected readonly listLoading = this.availabilityStore.listLoading;
  protected readonly saving = this.availabilityStore.saving;
  protected readonly overrides = this.availabilityStore.overrides;

  private readonly dayDefinitions: Array<{ key: DayOfWeek; label: string }> = [
    { key: 'mon', label: 'Monday' },
    { key: 'tue', label: 'Tuesday' },
    { key: 'wed', label: 'Wednesday' },
    { key: 'thu', label: 'Thursday' },
    { key: 'fri', label: 'Friday' },
    { key: 'sat', label: 'Saturday' },
    { key: 'sun', label: 'Sunday' },
  ];

  protected readonly days = signal<EditableDay[]>(
    this.dayDefinitions.map((day) => ({
      key: day.key,
      label: day.label,
      enabled: false,
      startTime: '09:00',
      endTime: '17:00',
      ruleId: null,
    }))
  );

  protected readonly currentUser = computed(() => this.authService.getCurrentUser());
  protected readonly currentUserId = computed(() => this.currentUser()?.id ?? null);

  protected readonly myRules = computed(() => {
    const userId = this.currentUserId();
    if (!userId) return [];

    return this.availabilityStore
      .rules()
      .filter((rule) => rule.userId === userId);
  });

  protected overrideMode: AvailabilityOverrideMode = 'unavailable';
  protected overrideNote = '';
  protected overrideStartDate = '';
  protected overrideStartTime = '';
  protected overrideEndDate = '';
  protected overrideEndTime = '';

  protected readonly overrideDrawerOpen = signal(false);
  protected readonly selectedPreset = signal<'allDayOff' | 'morningOff' | 'afternoonOff' | 'custom'>('custom');
  protected readonly presetFeedback = signal<string | null>(null);

  private presetFeedbackTimeout: number | null = null;

  async ngOnInit(): Promise<void> {
    await this.initialize();
  }

  protected trackDay(_: number, day: EditableDay): string {
    return day.key;
  }

  protected minutesFromTime(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return (hours * 60) + minutes;
  }

  protected timeFromMinutes(minutes: number): string {
    const safeMinutes = Math.max(0, Math.min(1439, minutes));
    const hours = Math.floor(safeMinutes / 60);
    const mins = safeMinutes % 60;

    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  }

  protected onDayEnabledChange(index: number, enabled: boolean): void {

    this.days.update((current) => {
      const next = [...current];
      next[index] = {
        ...next[index],
        enabled,
      };
      return next;
    });
  }

  protected onDayTimeChange(
    index: number,
    field: 'startTime' | 'endTime',
    value: string
  ): void {

    this.days.update((current) => {
      const next = [...current];
      next[index] = {
        ...next[index],
        [field]: value,
      };
      return next;
    });
  }

  protected async saveWeeklyAvailability(): Promise<void> {
    const userId = this.currentUserId();

    if (!userId) {
      this.toastService.error('Unable to determine current user.');
      return;
    }


    const days = this.days();

    for (const day of days) {
      if (!day.enabled) {
        if (day.ruleId) {
          const updated = await this.availabilityStore.updateRule(day.ruleId, {
            isActive: false,
          });

          if (!updated) {
            this.toastService.error(this.availabilityStore.error() ?? 'Failed to save availability.');
            return;
          }
        }

        continue;
      }

      if (!day.startTime || !day.endTime) {
        this.toastService.error(`${day.label} must have both a start and end time.`);
        return;
      }

      const startMin = this.minutesFromTime(day.startTime);
      const endMin = this.minutesFromTime(day.endTime);

      if (endMin <= startMin) {
        this.toastService.error(`${day.label} end time must be later than the start time.`);
        return;
      }

      if (day.ruleId) {
        const updated = await this.availabilityStore.updateRule(day.ruleId, {
          dayOfWeek: day.key,
          startMin,
          endMin,
          isActive: true,
        });

        if (!updated) {
          this.toastService.error(this.availabilityStore.error() ?? 'Failed to save availability.');
          return;
        }
      } else {
        const created = await this.availabilityStore.createRule({
          userId,
          dayOfWeek: day.key,
          startMin,
          endMin,
          isActive: true,
        });

        if (!created) {
          this.toastService.error(this.availabilityStore.error() ?? 'Failed to save availability.');
          return;
        }
      }
    }

    await this.availabilityStore.loadRules();
    this.syncDaysFromRules();

    this.toastService.success('Availability updated.');
  }

  protected setOverridePreset(
    preset: 'allDayOff' | 'morningOff' | 'afternoonOff' | 'custom'
  ): void {
    this.selectedPreset.set(preset);

    const targetDate = this.overrideStartDate || this.formatDateInput(new Date());
    const defaults = this.getDefaultHoursForDate(targetDate);

    const startMin = this.minutesFromTime(defaults.startTime);
    const endMin = this.minutesFromTime(defaults.endTime);

    const span = Math.max(endMin - startMin, 60);
    const midpoint = this.roundToQuarterHour(startMin + Math.floor(span / 2));

    this.overrideStartDate = targetDate;
    this.overrideEndDate = targetDate;

    if (preset === 'custom') {
      this.overrideMode = 'unavailable';
      this.overrideStartTime = defaults.startTime;
      this.overrideEndTime = defaults.endTime;
      this.showPresetFeedback('Custom hours loaded from your normal schedule.');
      return;
    }

    this.overrideMode = 'unavailable';

    if (preset === 'allDayOff') {
      this.overrideStartTime = defaults.startTime;
      this.overrideEndTime = defaults.endTime;
      this.showPresetFeedback('All day off applied.');
      return;
    }

    if (preset === 'morningOff') {
      this.overrideStartTime = defaults.startTime;
      this.overrideEndTime = this.timeFromMinutes(midpoint);
      this.showPresetFeedback('Morning off applied.');
      return;
    }

    this.overrideStartTime = this.timeFromMinutes(midpoint);
    this.overrideEndTime = defaults.endTime;
    this.showPresetFeedback('Afternoon off applied.');
  }

  private resetOverrideForm(): void {
    this.selectedPreset.set('custom');
    this.presetFeedback.set(null);

    this.overrideMode = 'unavailable';
    this.overrideStartDate = '';
    this.overrideStartTime = '';
    this.overrideEndDate = '';
    this.overrideEndTime = '';
    this.overrideNote = '';
  }

  private combineLocalDateAndTime(date: string, time: string): string {
    return new Date(`${date}T${time}`).toISOString();
  }

  private formatDateInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private getDefaultHoursForDate(dateString: string): { startTime: string; endTime: string } {
    const dayKey = this.dayOfWeekFromDate(dateString);
    const matchingDay = this.days().find((day) => day.key === dayKey);

    if (matchingDay?.enabled) {
      return {
        startTime: matchingDay.startTime,
        endTime: matchingDay.endTime,
      };
    }

    const matchingRule = this.pickRuleForDay(this.myRules(), dayKey);

    if (matchingRule?.isActive) {
      return {
        startTime: this.timeFromMinutes(matchingRule.startMin),
        endTime: this.timeFromMinutes(matchingRule.endMin),
      };
    }

    return {
      startTime: '09:00',
      endTime: '17:00',
    };
  }

  private dayOfWeekFromDate(dateString: string): DayOfWeek {
    const date = new Date(`${dateString}T12:00:00`);
    const dayIndex = date.getDay();

    const map: DayOfWeek[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    return map[dayIndex];
  }

  private roundToQuarterHour(minutes: number): number {
    return Math.round(minutes / 15) * 15;
  }

  private showPresetFeedback(message: string): void {
    this.presetFeedback.set(message);

    if (this.presetFeedbackTimeout) {
      window.clearTimeout(this.presetFeedbackTimeout);
    }

    this.presetFeedbackTimeout = window.setTimeout(() => {
      this.presetFeedback.set(null);
      this.presetFeedbackTimeout = null;
    }, 1800);
  }

  protected async addOverride(): Promise<void> {
    const userId = this.currentUserId();

    if (!userId) {
      this.toastService.error('Unable to determine current user.');
      return;
    }

    if (
      !this.overrideStartDate ||
      !this.overrideStartTime ||
      !this.overrideEndDate ||
      !this.overrideEndTime
    ) {
      this.toastService.error('Start and end date/time are required.');
      return;
    }

    if (this.overrideStartDate !== this.overrideEndDate) {
      this.toastService.error('Overrides must start and end on the same date.');
      return;
    }

    const hasExistingOverrideForDate = this.overrides().some((override) => {
      return this.getLocalDateFromIso(override.startAt) === this.overrideStartDate;
    });

    if (hasExistingOverrideForDate) {
      this.toastService.error('You already have an override for that date. Remove it before adding another.');
      return;
    }

    const startAt = this.combineLocalDateAndTime(this.overrideStartDate, this.overrideStartTime);
    const endAt = this.combineLocalDateAndTime(this.overrideEndDate, this.overrideEndTime);

    if (new Date(endAt).getTime() <= new Date(startAt).getTime()) {
      this.toastService.error('Override end must be later than the start.');
      return;
    }

    const created = await this.availabilityStore.createOverride({
      userId,
      mode: this.overrideMode,
      startAt,
      endAt,
      note: this.overrideNote.trim() || undefined,
    });

    if (!created) {
      this.toastService.error(this.availabilityStore.error() ?? 'Failed to create override.');
      return;
    }

    await this.reloadOverrides();

    this.toastService.success('Exception saved.');
    this.closeOverrideDrawer();
  }

  protected async removeOverride(id: string): Promise<void> {

    const deleted = await this.availabilityStore.deleteOverride(id);

    if (!deleted) {
      this.toastService.error(this.availabilityStore.error() ?? 'Failed to remove override.');
      return;
    }

    this.toastService.success('Override removed.');
  }

  protected formatOverrideMode(mode: AvailabilityOverrideMode): string {
    return mode === 'available' ? 'Available' : 'Unavailable';
  }

  protected formatOverrideDateTime(value: string): string {
    return new Date(value).toLocaleString();
  }

  private async initialize(): Promise<void> {
    this.loading.set(true);

    try {
      let user = this.authService.getCurrentUser();

      if (!user && this.authService.getAccessToken()) {
        user = await this.authService.loadMe();
      }

      if (!user) {
        this.toastService.error('Unable to load current user.');
        return;
      }

      await this.availabilityStore.loadRules();
      this.syncDaysFromRules();
      await this.reloadOverrides();
    } catch (error) {
      console.error(error);
      this.toastService.error('Failed to load availability.');
    } finally {
      this.loading.set(false);
    }
  }

  protected openOverrideDrawer(): void {

    this.resetOverrideForm();

    const today = this.formatDateInput(new Date());
    const defaults = this.getDefaultHoursForDate(today);

    this.overrideStartDate = today;
    this.overrideEndDate = today;
    this.overrideStartTime = defaults.startTime;
    this.overrideEndTime = defaults.endTime;

    this.overrideDrawerOpen.set(true);
  }

  protected closeOverrideDrawer(): void {
    this.overrideDrawerOpen.set(false);
    this.resetOverrideForm();
  }

  private syncDaysFromRules(): void {
    const rules = this.myRules();

    this.days.set(
      this.dayDefinitions.map((day) => {
        const matchingRule = this.pickRuleForDay(rules, day.key);

        return {
          key: day.key,
          label: day.label,
          enabled: matchingRule?.isActive ?? false,
          startTime: matchingRule ? this.timeFromMinutes(matchingRule.startMin) : '09:00',
          endTime: matchingRule ? this.timeFromMinutes(matchingRule.endMin) : '17:00',
          ruleId: matchingRule?.id ?? null,
        };
      })
    );
  }

  private pickRuleForDay(rules: AvailabilityRule[], day: DayOfWeek): AvailabilityRule | null {
    const dayRules = rules.filter((rule) => rule.dayOfWeek === day);

    if (!dayRules.length) {
      return null;
    }

    return dayRules.find((rule) => rule.isActive) ?? dayRules[0] ?? null;
  }

  private async reloadOverrides(): Promise<void> {
    const userId = this.currentUserId();

    if (!userId) return;

    const from = new Date();
    const to = new Date();
    to.setDate(to.getDate() + 90);

    await this.availabilityStore.loadOverrides({
      from: from.toISOString(),
      to: to.toISOString(),
      userId,
    });
  }

  protected formatOverrideRange(startAt: string, endAt: string): string {
    const start = new Date(startAt);
    const end = new Date(endAt);

    const sameDay =
      start.getFullYear() === end.getFullYear() &&
      start.getMonth() === end.getMonth() &&
      start.getDate() === end.getDate();

    const dateFormatter = new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
    });

    const timeFormatter = new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });

    if (sameDay && this.isUsersFullDayOverride(startAt, endAt)) {
      return `${dateFormatter.format(start)} • All day`;
    }

    if (sameDay) {
      return `${dateFormatter.format(start)} • ${timeFormatter.format(start)}–${timeFormatter.format(end)}`;
    }

    return `${dateFormatter.format(start)} ${timeFormatter.format(start)} – ${dateFormatter.format(end)} ${timeFormatter.format(end)}`;
  }

  protected formatOverrideMeta(mode: AvailabilityOverrideMode): string {
    return mode === 'available' ? 'Marked available' : 'Marked unavailable';
  }

  protected onOverrideModeChange(mode: AvailabilityOverrideMode): void {
    if (this.overrideMode === mode) return;

    this.overrideMode = mode;
    this.selectedPreset.set('custom');
    this.presetFeedback.set(null);
  }

  protected quickFillPrimaryLabel(): string {
    return this.overrideMode === 'available' ? 'All Day Available' : 'All Day Off';
  }

  protected quickFillMorningLabel(): string {
    return this.overrideMode === 'available' ? 'Morning Available' : 'Morning Off';
  }

  protected quickFillAfternoonLabel(): string {
    return this.overrideMode === 'available' ? 'Afternoon Available' : 'Afternoon Off';
  }

  private isUsersFullDayOverride(startAt: string, endAt: string): boolean {
    const start = new Date(startAt);
    const end = new Date(endAt);

    const sameDay =
      start.getFullYear() === end.getFullYear() &&
      start.getMonth() === end.getMonth() &&
      start.getDate() === end.getDate();

    if (!sameDay) {
      return false;
    }

    const dateString = this.formatDateInput(start);
    const defaults = this.getDefaultHoursForDate(dateString);

    const overrideStart = this.timeFromMinutes(start.getHours() * 60 + start.getMinutes());
    const overrideEnd = this.timeFromMinutes(end.getHours() * 60 + end.getMinutes());

    return (
      overrideStart === defaults.startTime &&
      overrideEnd === defaults.endTime
    );
  }

  private getLocalDateFromIso(value: string): string {
    const date = new Date(value);

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  protected hasOverrideForSelectedDate(): boolean {
    if (!this.overrideStartDate) return false;

    return this.overrides().some((override) => {
      return this.getLocalDateFromIso(override.startAt) === this.overrideStartDate;
    });
  }
}