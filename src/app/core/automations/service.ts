import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { AppConfigService } from '../app-config/app-config.service';
import {
  AutomationBootstrapResponse,
  AutomationExecutionListResponse,
  AutomationExecutionResponse,
  AutomationRulePayload,
  AutomationRuleResponse,
} from './model';

@Injectable({ providedIn: 'root' })
export class AutomationService {
  private readonly appConfig = inject(AppConfigService);
  private readonly http = inject(HttpClient);

  private get baseUrl(): string {
    return `${this.appConfig.config.apiBase}/automations`;
  }

  bootstrap(): Observable<AutomationBootstrapResponse> {
    return this.http.get<AutomationBootstrapResponse>(`${this.baseUrl}/bootstrap`);
  }

  create(payload: AutomationRulePayload): Observable<AutomationRuleResponse> {
    return this.http.post<AutomationRuleResponse>(this.baseUrl, payload);
  }

  createFromTemplate(key: string): Observable<AutomationRuleResponse> {
    return this.http.post<AutomationRuleResponse>(
      `${this.baseUrl}/templates/${encodeURIComponent(key)}`,
      {},
    );
  }

  update(id: string, payload: Partial<AutomationRulePayload>): Observable<AutomationRuleResponse> {
    return this.http.patch<AutomationRuleResponse>(
      `${this.baseUrl}/${encodeURIComponent(id)}`,
      payload,
    );
  }

  enable(id: string): Observable<AutomationRuleResponse> {
    return this.http.post<AutomationRuleResponse>(
      `${this.baseUrl}/${encodeURIComponent(id)}/enable`,
      {},
    );
  }

  disable(id: string): Observable<AutomationRuleResponse> {
    return this.http.post<AutomationRuleResponse>(
      `${this.baseUrl}/${encodeURIComponent(id)}/disable`,
      {},
    );
  }

  duplicate(id: string): Observable<AutomationRuleResponse> {
    return this.http.post<AutomationRuleResponse>(
      `${this.baseUrl}/${encodeURIComponent(id)}/duplicate`,
      {},
    );
  }

  test(id: string): Observable<AutomationExecutionResponse> {
    return this.http.post<AutomationExecutionResponse>(
      `${this.baseUrl}/${encodeURIComponent(id)}/test`,
      {},
    );
  }

  archive(id: string): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.baseUrl}/${encodeURIComponent(id)}`);
  }

  listExecutions(params: {
    limit?: number;
    ruleId?: string;
    status?: string;
  } = {}): Observable<AutomationExecutionListResponse> {
    let httpParams = new HttpParams();
    if (params.limit) httpParams = httpParams.set('limit', String(params.limit));
    if (params.ruleId) httpParams = httpParams.set('ruleId', params.ruleId);
    if (params.status) httpParams = httpParams.set('status', params.status);
    return this.http.get<AutomationExecutionListResponse>(`${this.baseUrl}/executions`, {
      params: httpParams,
    });
  }
}
