import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { AppConfigService } from '../app-config/app-config.service';
import {
  SystemHealthAction,
  SystemHealthActionResponse,
  SystemHealthReport,
} from './model';

@Injectable({ providedIn: 'root' })
export class SystemHealthService {
  private readonly config = inject(AppConfigService);
  private readonly http = inject(HttpClient);

  private get baseUrl(): string {
    return `${this.config.config.apiBase}/system-health`;
  }

  scan(): Observable<SystemHealthReport> {
    return this.http.get<SystemHealthReport>(this.baseUrl);
  }

  runAction(action: SystemHealthAction, targetId: string): Observable<SystemHealthActionResponse> {
    return this.http.post<SystemHealthActionResponse>(
      `${this.baseUrl}/actions/${encodeURIComponent(action.key)}`,
      { targetId },
    );
  }
}
