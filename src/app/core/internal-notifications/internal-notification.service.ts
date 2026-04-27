import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

import { AppConfigService } from '../app-config/app-config.service';
import type {
    InternalNotification,
    InternalNotificationListResponse,
    InternalNotificationReadAllResponse,
    InternalNotificationUnreadCountResponse,
} from './internal-notification.types';

@Injectable({
    providedIn: 'root',
})
export class InternalNotificationService {
    private readonly http = inject(HttpClient);
    private readonly appConfig = inject(AppConfigService);

    private get apiBase(): string {
        return this.appConfig.config.apiBase;
    }

    listMine() {
        return this.http.get<InternalNotificationListResponse>(
            `${this.apiBase}/me/internal-notifications`
        );
    }

    getUnreadCount() {
        return this.http.get<InternalNotificationUnreadCountResponse>(
            `${this.apiBase}/me/internal-notifications/unread-count`
        );
    }

    markRead(id: string) {
        return this.http.patch<InternalNotification>(
            `${this.apiBase}/me/internal-notifications/${encodeURIComponent(id)}/read`,
            {}
        );
    }

    markAllRead() {
        return this.http.post<InternalNotificationReadAllResponse>(
            `${this.apiBase}/me/internal-notifications/read-all`,
            {}
        );
    }
}