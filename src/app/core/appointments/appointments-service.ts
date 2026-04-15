import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import type {
  Appointment,
  AppointmentListParams,
  AppointmentListResponse,
  AppointmentResponse,
  UpsertAppointmentDto,
} from './appointments.model';
import { AppConfigService } from '../app-config/app-config.service';

@Injectable({
  providedIn: 'root',
})
export class AppointmentsService {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);

  private readonly baseUrl = `${this.apiBase}/appointments`;
  private readonly repairsBaseUrl = `${this.apiBase}/repairs`;

  private get apiBase(): string {
    return this.appConfig.config.apiBase;
  }

  listAppointments(params: AppointmentListParams): Observable<AppointmentListResponse> {
    let httpParams = new HttpParams()
      .set('from', params.from)
      .set('to', params.to);

    if (params.assignedUserId) {
      httpParams = httpParams.set('assignedUserId', params.assignedUserId);
    }

    return this.http.get<AppointmentListResponse>(this.baseUrl, {
      params: httpParams,
    });
  }

  upsertAppointment(
    repairId: string,
    payload: UpsertAppointmentDto
  ): Observable<AppointmentResponse> {
    const body = {
      ...payload,
      assignedUserId: payload.assignedUserId ?? undefined,
    };

    return this.http.put<AppointmentResponse>(
      `${this.repairsBaseUrl}/${repairId}/appointment`,
      body
    );
  }

  cancelAppointment(repairId: string): Observable<null> {
    return this.http.delete<null>(`${this.repairsBaseUrl}/${repairId}/appointment`);
  }

  scheduleAppointment(
    repairId: string,
    startAt: string,
    endAt: string,
    assignedUserId?: string | null
  ): Observable<AppointmentResponse> {
    return this.upsertAppointment(repairId, {
      startAt,
      endAt,
      assignedUserId,
    });
  }

  rescheduleAppointment(
    repairId: string,
    startAt: string,
    endAt: string,
    assignedUserId?: string | null
  ): Observable<AppointmentResponse> {
    return this.upsertAppointment(repairId, {
      startAt,
      endAt,
      assignedUserId,
    });
  }
}