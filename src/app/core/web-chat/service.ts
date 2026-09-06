import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { AppConfigService } from '../app-config/app-config.service';
import type { WebChatProactiveRule, WebChatSettings, WebChatSettingsPatch } from './model';

@Injectable({ providedIn: 'root' })
export class WebChatService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(AppConfigService);

  private get root(): string {
    return `${this.config.config.apiBase}/web-chat`;
  }

  private get base(): string {
    return `${this.root}/settings`;
  }

  getSettings() {
    return this.http.get<WebChatSettings>(this.base);
  }

  updateSettings(payload: WebChatSettingsPatch) {
    return this.http.patch<WebChatSettings>(this.base, payload);
  }

  listProactiveRules() {
    return this.http.get<{ data: WebChatProactiveRule[] }>(`${this.root}/proactive-rules`);
  }

  createProactiveRule(payload: Omit<WebChatProactiveRule, 'id' | 'sortOrder' | 'createdAt' | 'updatedAt'>) {
    return this.http.post<{ data: WebChatProactiveRule }>(`${this.root}/proactive-rules`, payload);
  }

  updateProactiveRule(id: string, payload: Partial<Omit<WebChatProactiveRule, 'id' | 'sortOrder' | 'createdAt' | 'updatedAt'>>) {
    return this.http.patch<{ data: WebChatProactiveRule }>(`${this.root}/proactive-rules/${encodeURIComponent(id)}`, payload);
  }

  deleteProactiveRule(id: string) {
    return this.http.delete<{ ok: boolean }>(`${this.root}/proactive-rules/${encodeURIComponent(id)}`);
  }
}
