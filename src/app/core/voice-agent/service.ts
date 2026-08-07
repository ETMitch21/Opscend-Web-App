import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';

import { AppConfigService } from '../app-config/app-config.service';
import {
  VoiceAgentCall,
  VoiceAgentSettings,
  VoiceAgentSettingsPatch,
} from './model';

interface DataResponse<T> {
  data: T;
}

@Injectable({ providedIn: 'root' })
export class VoiceAgentService {
  private readonly appConfig = inject(AppConfigService);
  private readonly http = inject(HttpClient);

  private get baseUrl(): string {
    return `${this.appConfig.config.apiBase}/voice-agent`;
  }

  getSettings(): Observable<VoiceAgentSettings> {
    return this.http
      .get<DataResponse<VoiceAgentSettings>>(`${this.baseUrl}/settings`)
      .pipe(map((response) => response.data));
  }

  updateSettings(payload: VoiceAgentSettingsPatch): Observable<VoiceAgentSettings> {
    return this.http
      .patch<DataResponse<VoiceAgentSettings>>(`${this.baseUrl}/settings`, payload)
      .pipe(map((response) => response.data));
  }

  listCalls(limit = 25): Observable<VoiceAgentCall[]> {
    const params = new HttpParams().set('limit', String(limit));
    return this.http
      .get<DataResponse<VoiceAgentCall[]>>(`${this.baseUrl}/calls`, { params })
      .pipe(map((response) => response.data));
  }
}
