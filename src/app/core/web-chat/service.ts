import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { AppConfigService } from '../app-config/app-config.service';
import type { WebChatSettings, WebChatSettingsPatch } from './model';

@Injectable({ providedIn: 'root' })
export class WebChatService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(AppConfigService);

  private get base(): string {
    return `${this.config.config.apiBase}/web-chat/settings`;
  }

  getSettings() {
    return this.http.get<WebChatSettings>(this.base);
  }

  updateSettings(payload: WebChatSettingsPatch) {
    return this.http.patch<WebChatSettings>(this.base, payload);
  }
}
