import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { AppConfigService } from '../app-config/app-config.service';
import { TechnicianDashboardResponse } from './model';

@Injectable({ providedIn: 'root' })
export class TechnicianDashboardService {
  private readonly appConfig = inject(AppConfigService);
  private readonly http = inject(HttpClient);

  private get baseUrl(): string {
    return `${this.appConfig.config.apiBase}/technician-dashboard`;
  }

  load(userId?: string | null, date?: string | null): Observable<TechnicianDashboardResponse> {
    let params = new HttpParams();
    if (userId) params = params.set('userId', userId);
    if (date) params = params.set('date', date);
    return this.http.get<TechnicianDashboardResponse>(this.baseUrl, { params });
  }
}
