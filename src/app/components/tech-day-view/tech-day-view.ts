import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AppointmentsStore } from '../../core/appointments/appointments.store';
import { UsersStore } from '../../core/users/users-store';
import { AuthService } from '../../core/auth/auth.service';
import type { AppointmentListItem } from '../../core/appointments/appointments.model';
import type { User } from '../../core/users/users.model';

type TechDayRow = {
  user: User;
  appointments: AppointmentListItem[];
};

@Component({
  selector: 'app-tech-day-view',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tech-day-view.html',
})
export class TechDayView implements OnInit {
  private readonly appointmentsStore = inject(AppointmentsStore);
  private readonly usersStore = inject(UsersStore);
  private readonly authService = inject(AuthService);

  readonly selectedDate = signal(this.formatDateInput(new Date()));
  readonly showAllAppointments = signal(false);

  readonly currentUserId = computed(() => this.authService.getCurrentUserId());

  readonly loading = computed(() => {
    return this.appointmentsStore.listLoading() || this.usersStore.loading();
  });

  readonly error = computed(() => {
    return this.appointmentsStore.error() || this.usersStore.error();
  });

  readonly assignableUsers = computed(() => this.usersStore.assignableUsers());

  readonly visibleUsers = computed(() => {
    if (this.showAllAppointments()) {
      return this.assignableUsers();
    }

    const currentUserId = this.currentUserId();
    if (!currentUserId) return [];

    const currentUser = this.usersStore.getById(currentUserId);
    return currentUser ? [currentUser] : [];
  });

  readonly appointmentsForSelectedDate = computed(() => {
    const selectedDate = this.selectedDate();

    return this.appointmentsStore
      .appointments()
      .filter((item) => this.toDateKey(item.appointment.startAt) === selectedDate)
      .sort(
        (a, b) =>
          new Date(a.appointment.startAt).getTime() -
          new Date(b.appointment.startAt).getTime()
      );
  });

  readonly visibleAppointments = computed(() => {
    if (this.showAllAppointments()) {
      return this.appointmentsForSelectedDate();
    }

    const currentUserId = this.currentUserId();
    if (!currentUserId) return [];

    return this.appointmentsForSelectedDate().filter(
      (item) => item.appointment.assignedUserId === currentUserId
    );
  });

  readonly rows = computed<TechDayRow[]>(() => {
    const appointments = this.visibleAppointments();

    return this.visibleUsers()
      .map((user) => ({
        user,
        appointments: appointments.filter(
          (item) => item.appointment.assignedUserId === user.id
        ),
      }))
      .sort((a, b) => {
        const countDiff = a.appointments.length - b.appointments.length;
        if (countDiff !== 0) return countDiff;

        return a.user.name.localeCompare(b.user.name);
      });
  });

  readonly unassignedAppointments = computed(() => {
    if (!this.showAllAppointments()) {
      return [];
    }

    return this.appointmentsForSelectedDate().filter(
      (item) => !item.appointment.assignedUserId
    );
  });

  readonly cardTitle = computed(() => {
    return this.showAllAppointments() ? 'Technician Day View' : 'My Day View';
  });

  readonly cardSubtitle = computed(() => {
    return this.showAllAppointments()
      ? 'See each technician’s workload for the selected day.'
      : 'See your appointments for the selected day.';
  });

  readonly emptyStateMessage = computed(() => {
    return this.showAllAppointments()
      ? 'No technician appointments scheduled.'
      : 'You have no appointments scheduled.';
  });

  async ngOnInit(): Promise<void> {
    await this.loadData();
  }

  async onDateChange(date: string): Promise<void> {
    this.selectedDate.set(date);
    await this.loadAppointments();
  }

  async goToToday(): Promise<void> {
    this.selectedDate.set(this.formatDateInput(new Date()));
    await this.loadAppointments();
  }

  toggleAppointmentScope(): void {
    this.showAllAppointments.update((value) => !value);
  }

  async previousDay(): Promise<void> {
    const date = new Date(`${this.selectedDate()}T12:00:00`);
    date.setDate(date.getDate() - 1);
    this.selectedDate.set(this.formatDateInput(date));
    await this.loadAppointments();
  }

  async nextDay(): Promise<void> {
    const date = new Date(`${this.selectedDate()}T12:00:00`);
    date.setDate(date.getDate() + 1);
    this.selectedDate.set(this.formatDateInput(date));
    await this.loadAppointments();
  }

  appointmentCountLabel(count: number): string {
    return count === 1 ? '1 appointment' : `${count} appointments`;
  }

  formatSelectedDateHeading(): string {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }).format(new Date(`${this.selectedDate()}T12:00:00`));
  }

  formatTimeRange(startAt: string, endAt: string): string {
    const start = new Date(startAt);
    const end = new Date(endAt);

    const time = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });

    return `${time.format(start)} – ${time.format(end)}`;
  }

  trackUser(_: number, row: TechDayRow): string {
    return row.user.id;
  }

  trackAppointment(_: number, item: AppointmentListItem): string {
    return item.appointment.id;
  }

  private async loadData(): Promise<void> {
    if (!this.usersStore.loaded()) {
      await this.usersStore.load({ limit: 100 });
    }

    if (!this.authService.getCurrentUser() && this.authService.getAccessToken()) {
      await this.authService.loadMe();
    }

    await this.loadAppointments();
  }

  private async loadAppointments(): Promise<void> {
    const from = new Date(`${this.selectedDate()}T00:00:00`);
    const to = new Date(`${this.selectedDate()}T23:59:59.999`);

    await this.appointmentsStore.loadAppointments({
      from: from.toISOString(),
      to: to.toISOString(),
    });
  }

  private toDateKey(value: string): string {
    const date = new Date(value);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  private formatDateInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }
}