import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AppointmentsService } from './appointments-service';
import type {
  Appointment,
  AppointmentListItem,
  AppointmentListParams,
  UpsertAppointmentDto,
} from './appointments.model';

@Injectable({
  providedIn: 'root',
})
export class AppointmentsStore {
  private readonly appointmentsService = inject(AppointmentsService);

  private readonly _appointments = signal<AppointmentListItem[]>([]);
  private readonly _selectedAppointment = signal<Appointment | null>(null);

  private readonly _listLoading = signal(false);
  private readonly _saving = signal(false);

  private readonly _error = signal<string | null>(null);

  readonly appointments = this._appointments.asReadonly();
  readonly selectedAppointment = this._selectedAppointment.asReadonly();

  readonly listLoading = this._listLoading.asReadonly();
  readonly saving = this._saving.asReadonly();
  readonly error = this._error.asReadonly();

  readonly hasAppointments = computed(() => this._appointments().length > 0);

  clearError(): void {
    this._error.set(null);
    this._errorCode.set(null);
  }

  reset(): void {
    this._appointments.set([]);
    this._selectedAppointment.set(null);
    this._error.set(null);
  }

  clearSelectedAppointment(): void {
    this._selectedAppointment.set(null);
  }

  async loadAppointments(params: AppointmentListParams): Promise<AppointmentListItem[]> {
    this._listLoading.set(true);
    this._error.set(null);

    try {
      const response = await firstValueFrom(
        this.appointmentsService.listAppointments(params)
      );

      this._appointments.set(response.data);
      return response.data;
    } catch (error) {
      this.handleError(error, 'Failed to load appointments.');
      return [];
    } finally {
      this._listLoading.set(false);
    }
  }

  async upsertAppointment(
    repairId: string,
    payload: UpsertAppointmentDto
  ): Promise<Appointment | null> {
    this._saving.set(true);
    this._error.set(null);

    try {
      const response = await firstValueFrom(
        this.appointmentsService.upsertAppointment(repairId, payload)
      );

      const appointment = response.appointment;
      this._selectedAppointment.set(appointment);
      this.patchAppointmentInList(appointment);

      return appointment;
    } catch (error) {
      this.handleError(error, 'Failed to save appointment.');
      return null;
    } finally {
      this._saving.set(false);
    }
  }

  async scheduleAppointment(
    repairId: string,
    startAt: string,
    endAt: string,
    assignedUserId?: string | null
  ): Promise<Appointment | null> {
    return this.upsertAppointment(repairId, {
      startAt,
      endAt,
      assignedUserId,
    });
  }

  async rescheduleAppointment(
    repairId: string,
    startAt: string,
    endAt: string,
    assignedUserId?: string | null
  ): Promise<Appointment | null> {
    return this.upsertAppointment(repairId, {
      startAt,
      endAt,
      assignedUserId,
    });
  }

  async cancelAppointment(repairId: string): Promise<boolean> {
    this._saving.set(true);
    this._error.set(null);

    try {
      await firstValueFrom(this.appointmentsService.cancelAppointment(repairId));

      if (this._selectedAppointment()?.repairId === repairId) {
        this._selectedAppointment.update((appointment) =>
          appointment
            ? {
              ...appointment,
              status: 'canceled',
            }
            : appointment
        );
      }

      this._appointments.update((items) =>
        items.map((item) =>
          item.appointment.repairId === repairId
            ? {
              ...item,
              appointment: {
                ...item.appointment,
                status: 'canceled',
              },
            }
            : item
        )
      );

      return true;
    } catch (error) {
      this.handleError(error, 'Failed to cancel appointment.');
      return false;
    } finally {
      this._saving.set(false);
    }
  }

  private patchAppointmentInList(appointment: Appointment): void {
    this._appointments.update((items) => {
      const index = items.findIndex(
        (item) => item.appointment.id === appointment.id
      );

      if (index === -1) {
        return items;
      }

      return items.map((item) =>
        item.appointment.id === appointment.id
          ? {
            ...item,
            appointment,
          }
          : item
      );
    });
  }

  private readonly _errorCode = signal<string | null>(null);
  readonly errorCode = this._errorCode.asReadonly();

  private handleError(error: unknown, fallbackMessage: string): void {
    console.error(error);

    let message = fallbackMessage;
    let code: string | null = null;

    if (
      typeof error === 'object' &&
      error !== null &&
      'error' in error
    ) {
      const err = (error as any).error;

      if (typeof err === 'string') {
        message = err;
      }

      if (typeof err === 'object' && err !== null) {
        if (typeof err.message === 'string') {
          message = err.message;
        }

        if (typeof err.code === 'string') {
          code = err.code;
        }
      }
    }

    this._error.set(message);
    this._errorCode.set(code);
  }
}