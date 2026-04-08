import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';

type DayKey = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';
type OverrideMode = 'available' | 'unavailable';

interface AvailabilityRuleDto {
  id: string;
  shopId: string;
  userId: string | null;
  dayOfWeek: DayKey;
  startMin: number;
  endMin: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AvailabilityRulesResponse {
  data: AvailabilityRuleDto[];
}

interface AvailabilityOverrideDto {
  id: string;
  shopId: string;
  userId: string | null;
  mode: OverrideMode;
  startAt: string;
  endAt: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AvailabilityOverridesResponse {
  data: AvailabilityOverrideDto[];
}

interface DayRow {
  dayOfWeek: DayKey;
  label: string;
  ruleId: string | null;
  open: boolean;
  startMin: number;
  endMin: number;
  hasExtraRules: boolean;
}

@Component({
  selector: 'app-shop-availability-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './shop-availability.html',
})
export class ShopAvailability implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly apiBase = `${environment.apiBase}/availability`;

  readonly loading = signal(false);
  readonly listLoading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);

  readonly days = signal<DayRow[]>([
    this.createDefaultDay('sun', 'Sunday'),
    this.createDefaultDay('mon', 'Monday'),
    this.createDefaultDay('tue', 'Tuesday'),
    this.createDefaultDay('wed', 'Wednesday'),
    this.createDefaultDay('thu', 'Thursday'),
    this.createDefaultDay('fri', 'Friday'),
    this.createDefaultDay('sat', 'Saturday'),
  ]);

  readonly overrides = signal<AvailabilityOverrideDto[]>([]);
  readonly hasExtraRules = computed(() => this.days().some((d) => d.hasExtraRules));
  readonly overrideDrawerOpen = signal(false);

  overrideMode: OverrideMode = 'unavailable';
  overrideStartDate = '';
  overrideStartTime = '09:00';
  overrideEndDate = '';
  overrideEndTime = '18:00';
  overrideNote = '';

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    this.success.set(null);

    try {
      await Promise.all([this.loadWeeklyHours(), this.loadOverrides()]);
    } catch (err) {
      console.error(err);
      this.error.set('Could not load shop availability.');
    } finally {
      this.loading.set(false);
    }
  }

  async loadWeeklyHours(): Promise<void> {
    const res = await firstValueFrom(
      this.http.get<AvailabilityRulesResponse>(`${this.apiBase}/rules`)
    );

    const allRules = res?.data ?? [];

    const shopRules = allRules
      .filter((r) => r.userId === null)
      .sort((a, b) => a.startMin - b.startMin);

    const nextDays = this.days().map((day) => {
      const matches = shopRules.filter((r) => r.dayOfWeek === day.dayOfWeek);

      if (!matches.length) {
        return {
          ...day,
          ruleId: null,
          open: false,
          startMin: 540,
          endMin: 1020,
          hasExtraRules: false,
        };
      }

      const primary = matches[0];

      return {
        ...day,
        ruleId: primary.id,
        open: primary.isActive,
        startMin: primary.startMin,
        endMin: primary.endMin,
        hasExtraRules: matches.length > 1,
      };
    });

    this.days.set(nextDays);
  }

  async loadOverrides(): Promise<void> {
    this.listLoading.set(true);

    try {
      const from = this.startOfToday();
      const to = this.addDays(from, 90);

      const res = await firstValueFrom(
        this.http.get<AvailabilityOverridesResponse>(`${this.apiBase}/overrides`, {
          params: {
            from: from.toISOString(),
            to: to.toISOString(),
          },
        })
      );

      const rows = (res?.data ?? [])
        .filter((o) => o.userId === null)
        .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

      this.overrides.set(rows);
    } finally {
      this.listLoading.set(false);
    }
  }

  async save(): Promise<void> {
    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);

    try {
      const current = this.days();

      for (const day of current) {
        if (day.open && day.endMin <= day.startMin) {
          this.error.set(`${day.label}: closing time must be after opening time.`);
          this.saving.set(false);
          return;
        }
      }

      for (const day of current) {
        if (day.ruleId) {
          await firstValueFrom(
            this.http.patch(`${this.apiBase}/rules/${day.ruleId}`, {
              startMin: day.startMin,
              endMin: day.endMin,
              isActive: day.open,
            })
          );
        } else if (day.open) {
          await firstValueFrom(
            this.http.post(`${this.apiBase}/rules`, {
              dayOfWeek: day.dayOfWeek,
              startMin: day.startMin,
              endMin: day.endMin,
              isActive: true,
            })
          );
        }
      }

      await this.loadWeeklyHours();
      this.success.set('Shop hours updated.');
    } catch (err) {
      console.error(err);
      this.error.set('Could not save shop hours.');
    } finally {
      this.saving.set(false);
    }
  }

  setOpen(dayOfWeek: DayKey, open: boolean): void {
    this.days.update((days) =>
      days.map((d) =>
        d.dayOfWeek === dayOfWeek
          ? {
              ...d,
              open,
            }
          : d
      )
    );
  }

  setStart(dayOfWeek: DayKey, value: string): void {
    const mins = this.timeToMinutes(value);
    this.days.update((days) =>
      days.map((d) =>
        d.dayOfWeek === dayOfWeek
          ? {
              ...d,
              startMin: mins,
            }
          : d
      )
    );
  }

  setEnd(dayOfWeek: DayKey, value: string): void {
    const mins = this.timeToMinutes(value);
    this.days.update((days) =>
      days.map((d) =>
        d.dayOfWeek === dayOfWeek
          ? {
              ...d,
              endMin: mins,
            }
          : d
      )
    );
  }

  copyMondayToWeekdays(): void {
    const monday = this.days().find((d) => d.dayOfWeek === 'mon');
    if (!monday) return;

    this.days.update((days) =>
      days.map((d) => {
        if (d.dayOfWeek === 'sat' || d.dayOfWeek === 'sun' || d.dayOfWeek === 'mon') {
          return d;
        }

        return {
          ...d,
          open: monday.open,
          startMin: monday.startMin,
          endMin: monday.endMin,
        };
      })
    );
  }

  openOverrideDrawer(): void {
    this.error.set(null);
    this.success.set(null);
    this.overrideMode = 'unavailable';

    const today = this.startOfToday();
    const date = this.toDateInputValue(today);

    this.overrideStartDate = date;
    this.overrideEndDate = date;
    this.overrideStartTime = '09:00';
    this.overrideEndTime = '18:00';
    this.overrideNote = '';
    this.overrideDrawerOpen.set(true);
  }

  closeOverrideDrawer(): void {
    this.overrideDrawerOpen.set(false);
  }

  onOverrideModeChange(mode: OverrideMode): void {
    this.overrideMode = mode;
  }

  async addOverride(): Promise<void> {
    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);

    try {
      if (!this.overrideStartDate || !this.overrideEndDate || !this.overrideStartTime || !this.overrideEndTime) {
        this.error.set('Please complete the start and end date and time.');
        this.saving.set(false);
        return;
      }

      const startAt = this.combineLocalDateTime(this.overrideStartDate, this.overrideStartTime);
      const endAt = this.combineLocalDateTime(this.overrideEndDate, this.overrideEndTime);

      if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
        this.error.set('Please enter a valid date and time range.');
        this.saving.set(false);
        return;
      }

      if (endAt.getTime() <= startAt.getTime()) {
        this.error.set('End time must be after start time.');
        this.saving.set(false);
        return;
      }

      await firstValueFrom(
        this.http.post(`${this.apiBase}/overrides`, {
          mode: this.overrideMode,
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
          note: this.overrideNote.trim() || undefined,
        })
      );

      await this.loadOverrides();
      this.closeOverrideDrawer();
      this.success.set('Shop exception saved.');
    } catch (err: any) {
      console.error(err);

      const apiError = err?.error?.error;
      if (apiError === 'override_exists_for_date') {
        this.error.set('An override already exists for that date.');
      } else {
        this.error.set('Could not save shop exception.');
      }
    } finally {
      this.saving.set(false);
    }
  }

  async removeOverride(id: string): Promise<void> {
    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);

    try {
      await firstValueFrom(this.http.delete(`${this.apiBase}/overrides/${id}`));
      await this.loadOverrides();
      this.success.set('Shop exception removed.');
    } catch (err) {
      console.error(err);
      this.error.set('Could not remove shop exception.');
    } finally {
      this.saving.set(false);
    }
  }

  hasOverrideForSelectedDate(): boolean {
    if (!this.overrideStartDate) return false;

    return this.overrides().some(
      (override) => this.toDateInputValue(new Date(override.startAt)) === this.overrideStartDate
    );
  }

  formatOverrideRange(startAt: string, endAt: string): string {
    const start = new Date(startAt);
    const end = new Date(endAt);

    const sameDay = this.toDateInputValue(start) === this.toDateInputValue(end);

    const dateFormatter = new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    const timeFormatter = new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });

    if (sameDay) {
      return `${dateFormatter.format(start)} • ${timeFormatter.format(start)} - ${timeFormatter.format(end)}`;
    }

    return `${dateFormatter.format(start)} ${timeFormatter.format(start)} - ${dateFormatter.format(end)} ${timeFormatter.format(end)}`;
  }

  formatOverrideMeta(mode: OverrideMode): string {
    return mode === 'available' ? 'Marked available' : 'Marked unavailable';
  }

  minutesToTime(value: number): string {
    const h = Math.floor(value / 60);
    const m = value % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  trackByDay(_: number, row: DayRow): string {
    return row.dayOfWeek;
  }

  private createDefaultDay(dayOfWeek: DayKey, label: string): DayRow {
    return {
      dayOfWeek,
      label,
      ruleId: null,
      open: false,
      startMin: 540,
      endMin: 1020,
      hasExtraRules: false,
    };
  }

  private timeToMinutes(value: string): number {
    const [h, m] = value.split(':').map(Number);
    return h * 60 + m;
  }

  private startOfToday(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  private addDays(date: Date, days: number): Date {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  }

  private toDateInputValue(date: Date): string {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  private combineLocalDateTime(date: string, time: string): Date {
    return new Date(`${date}T${time}:00`);
  }
}