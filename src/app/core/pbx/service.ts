import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';

import { AppConfigService } from '../app-config/app-config.service';
import {
  PbxRingGroup,
  PbxRingGroupInput,
  PbxRingGroupPatch,
  PbxSettings,
  PbxSettingsPatch,
  PbxVoicemail,
} from './model';

interface DataResponse<T> { data: T; }

@Injectable({ providedIn: 'root' })
export class PbxService {
  private readonly appConfig = inject(AppConfigService);
  private readonly http = inject(HttpClient);

  private get baseUrl(): string {
    return `${this.appConfig.config.apiBase}/pbx`;
  }

  getSettings(): Observable<PbxSettings> {
    return this.http.get<DataResponse<PbxSettings>>(`${this.baseUrl}/settings`).pipe(map((r) => r.data));
  }

  updateSettings(payload: PbxSettingsPatch): Observable<PbxSettings> {
    return this.http.patch<DataResponse<PbxSettings>>(`${this.baseUrl}/settings`, payload).pipe(map((r) => r.data));
  }

  createRingGroup(payload: PbxRingGroupInput): Observable<PbxRingGroup> {
    return this.http.post<DataResponse<PbxRingGroup>>(`${this.baseUrl}/ring-groups`, payload).pipe(map((r) => r.data));
  }

  updateRingGroup(id: string, payload: PbxRingGroupPatch): Observable<PbxRingGroup> {
    return this.http.patch<DataResponse<PbxRingGroup>>(`${this.baseUrl}/ring-groups/${encodeURIComponent(id)}`, payload).pipe(map((r) => r.data));
  }

  deleteRingGroup(id: string): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.baseUrl}/ring-groups/${encodeURIComponent(id)}`);
  }

  listVoicemails(limit = 50): Observable<PbxVoicemail[]> {
    const params = new HttpParams().set('limit', String(limit));
    return this.http.get<DataResponse<PbxVoicemail[]>>(`${this.baseUrl}/voicemails`, { params }).pipe(map((r) => r.data));
  }
}
