import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { AppConfigService } from '../app-config/app-config.service';
import {
  GoogleCalendarChoicesResponse,
  GoogleCalendarConnectResponse,
  GoogleCalendarMappingPayload,
  GoogleCalendarSettingsPayload,
  GoogleCalendarStatusResponse,
} from './google-calendar-model';

@Injectable({ providedIn: 'root' })
export class GoogleCalendarService {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);

  private get baseUrl(): string {
    return `${this.appConfig.config.apiBase}/integrations/google-calendar`;
  }

  getStatus(): Promise<GoogleCalendarStatusResponse> {
    return firstValueFrom(
      this.http.get<GoogleCalendarStatusResponse>(`${this.baseUrl}/status`),
    );
  }

  async connect(): Promise<void> {
    const response = await firstValueFrom(
      this.http.post<GoogleCalendarConnectResponse>(`${this.baseUrl}/connect`, {}),
    );

    if (!response.url) {
      throw new Error('Google Calendar did not return an authorization URL.');
    }

    window.location.href = response.url;
  }

  getCalendars(): Promise<GoogleCalendarChoicesResponse> {
    return firstValueFrom(
      this.http.get<GoogleCalendarChoicesResponse>(`${this.baseUrl}/calendars`),
    );
  }

  updateSettings(
    payload: GoogleCalendarSettingsPayload,
  ): Promise<GoogleCalendarStatusResponse> {
    return firstValueFrom(
      this.http.patch<GoogleCalendarStatusResponse>(
        `${this.baseUrl}/settings`,
        payload,
      ),
    );
  }

  saveMapping(
    userId: string,
    payload: GoogleCalendarMappingPayload,
  ): Promise<GoogleCalendarStatusResponse> {
    return firstValueFrom(
      this.http.put<GoogleCalendarStatusResponse>(
        `${this.baseUrl}/mappings/${encodeURIComponent(userId)}`,
        payload,
      ),
    );
  }

  async removeMapping(userId: string): Promise<void> {
    await firstValueFrom(
      this.http.delete<void>(
        `${this.baseUrl}/mappings/${encodeURIComponent(userId)}`,
      ),
    );
  }

  syncNow(): Promise<GoogleCalendarStatusResponse> {
    return firstValueFrom(
      this.http.post<GoogleCalendarStatusResponse>(`${this.baseUrl}/sync`, {}),
    );
  }

  async disconnect(): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.baseUrl}`));
  }
}
