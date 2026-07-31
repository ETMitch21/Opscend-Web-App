import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { AppConfigService } from '../app-config/app-config.service';
import type {
  AiContextRef,
  AiConversation,
  AiConversationSummary,
  AiMessage,
  AiStatus,
  AiSuggestedAction,
  AiUsageDay,
} from './model';

@Injectable({ providedIn: 'root' })
export class AiAssistantService {
  private readonly appConfig = inject(AppConfigService);
  private readonly http = inject(HttpClient);

  private get baseUrl(): string {
    return `${this.appConfig.config.apiBase}/ai-assistant`;
  }

  getStatus(): Observable<AiStatus> {
    return this.http.get<AiStatus>(`${this.baseUrl}/status`);
  }

  getUsage(days = 30): Observable<{ data: AiUsageDay[] }> {
    return this.http.get<{ data: AiUsageDay[] }>(`${this.baseUrl}/usage`, {
      params: new HttpParams().set('days', String(days)),
    });
  }

  listConversations(limit = 40): Observable<{ data: AiConversationSummary[] }> {
    return this.http.get<{ data: AiConversationSummary[] }>(`${this.baseUrl}/conversations`, {
      params: new HttpParams().set('limit', String(limit)),
    });
  }

  createConversation(payload: {
    title?: string;
    context?: AiContextRef;
  } = {}): Observable<{ data: AiConversation }> {
    return this.http.post<{ data: AiConversation }>(`${this.baseUrl}/conversations`, payload);
  }

  getConversation(id: string): Observable<{ data: AiConversation }> {
    return this.http.get<{ data: AiConversation }>(
      `${this.baseUrl}/conversations/${encodeURIComponent(id)}`,
    );
  }

  archiveConversation(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/conversations/${encodeURIComponent(id)}`);
  }

  sendMessage(
    conversationId: string,
    content: string,
    contexts: AiContextRef[],
  ): Observable<{ data: AiMessage }> {
    return this.http.post<{ data: AiMessage }>(
      `${this.baseUrl}/conversations/${encodeURIComponent(conversationId)}/messages`,
      { content, contexts },
    );
  }

  resolveAction(
    actionId: string,
    payload: {
      status: 'completed' | 'dismissed' | 'failed';
      result?: Record<string, unknown> | null;
      error?: string | null;
    },
  ): Observable<{ data: AiSuggestedAction }> {
    return this.http.patch<{ data: AiSuggestedAction }>(
      `${this.baseUrl}/actions/${encodeURIComponent(actionId)}`,
      payload,
    );
  }
}
