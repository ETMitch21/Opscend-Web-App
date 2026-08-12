import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { AppConfigService } from '../app-config/app-config.service';
import {
  QuickQuoteAttributeRequirement,
  QuickQuoteCandidate,
  QuickQuotePreview,
  QuickQuoteRememberResponse,
  QuickQuoteSettings,
} from './model';

@Injectable({ providedIn: 'root' })
export class QuickQuoteService {
  private readonly config = inject(AppConfigService);
  private readonly http = inject(HttpClient);

  private get baseUrl(): string {
    return `${this.config.config.apiBase}/quick-quote`;
  }

  getSettings(): Observable<QuickQuoteSettings> {
    return this.http.get<QuickQuoteSettings>(`${this.baseUrl}/settings`);
  }

  updateSettings(
    payload: Partial<Omit<QuickQuoteSettings, 'rememberedMatchCount'>>,
  ): Observable<QuickQuoteSettings> {
    return this.http.patch<QuickQuoteSettings>(`${this.baseUrl}/settings`, payload);
  }

  requirements(payload: {
    deviceCatalogModelId: string;
    repairNeedId: string;
  }): Observable<{ requirements: QuickQuoteAttributeRequirement[] }> {
    return this.http.post<{ requirements: QuickQuoteAttributeRequirement[] }>(
      `${this.baseUrl}/requirements`,
      payload,
    );
  }

  preview(payload: {
    deviceCatalogModelId: string;
    repairNeedId: string;
    attributes?: Record<string, string>;
  }): Observable<QuickQuotePreview> {
    return this.http.post<QuickQuotePreview>(`${this.baseUrl}/preview`, payload);
  }

  remember(payload: {
    deviceCatalogModelId: string;
    repairNeedId: string;
    candidate: QuickQuoteCandidate;
    variantName?: string;
    attributes?: Record<string, string>;
  }): Observable<QuickQuoteRememberResponse> {
    return this.http.post<QuickQuoteRememberResponse>(
      `${this.baseUrl}/remember`,
      payload,
    );
  }
}
