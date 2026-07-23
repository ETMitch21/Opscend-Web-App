import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { AppConfigService } from '../app-config/app-config.service';
import type {
  AnalyticsOverviewResponse,
  AnalyticsRange,
} from './model';

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly appConfig = inject(AppConfigService);
  private readonly http = inject(HttpClient);

  getOverview(
    range: AnalyticsRange = '30d',
  ): Observable<AnalyticsOverviewResponse> {
    const params = new HttpParams().set('range', range);
    return this.http.get<AnalyticsOverviewResponse>(
      `${this.appConfig.config.apiBase}/analytics/overview`,
      { params },
    );
  }
}
