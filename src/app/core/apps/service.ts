import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { AppConfigService } from '../app-config/app-config.service';
import {
  OpscendApp,
  PublicAppActionStart,
  PublicAppExtension,
  PublicAppQuoteState,
} from './model';

@Injectable({ providedIn: 'root' })
export class AppsService {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);

  private get base(): string {
    return `${this.appConfig.config.apiBase}/apps`;
  }

  list(): Observable<{ data: OpscendApp[] }> {
    return this.http.get<{ data: OpscendApp[] }>(this.base);
  }

  install(key: string): Observable<{ data: OpscendApp }> {
    return this.http.post<{ data: OpscendApp }>(`${this.base}/${encodeURIComponent(key)}/install`, {});
  }

  disable(key: string): Observable<{ data: OpscendApp }> {
    return this.http.delete<{ data: OpscendApp }>(`${this.base}/${encodeURIComponent(key)}/install`);
  }

  saveSettings(key: string, settings: Record<string, unknown>): Observable<{ data: OpscendApp }> {
    return this.http.patch<{ data: OpscendApp }>(`${this.base}/${encodeURIComponent(key)}/settings`, { settings });
  }

  saveSecret(key: string, secretKey: string, value: string): Observable<void> {
    return this.http.put<void>(`${this.base}/${encodeURIComponent(key)}/secrets/${encodeURIComponent(secretKey)}`, { value });
  }

  publicExtensions(shopSlug: string, point: string, quoteId?: string): Observable<{ data: PublicAppExtension[] }> {
    let params = new HttpParams().set('point', point);
    if (quoteId) params = params.set('quoteId', quoteId);
    return this.http.get<{ data: PublicAppExtension[] }>(
      `${this.appConfig.config.apiBase}/public/shops/${encodeURIComponent(shopSlug)}/apps/extensions`,
      { params },
    );
  }

  startPublicAction(shopSlug: string, appKey: string, actionKey: string, payload: { quoteId?: string; input?: unknown }): Observable<PublicAppActionStart> {
    return this.http.post<PublicAppActionStart>(
      `${this.appConfig.config.apiBase}/public/shops/${encodeURIComponent(shopSlug)}/apps/${encodeURIComponent(appKey)}/actions/${encodeURIComponent(actionKey)}`,
      payload,
    );
  }

  publicQuoteState(shopSlug: string, quoteId: string): Observable<PublicAppQuoteState> {
    const params = new HttpParams().set('quoteId', quoteId);
    return this.http.get<PublicAppQuoteState>(
      `${this.appConfig.config.apiBase}/public/shops/${encodeURIComponent(shopSlug)}/apps/quote-state`,
      { params },
    );
  }
}
