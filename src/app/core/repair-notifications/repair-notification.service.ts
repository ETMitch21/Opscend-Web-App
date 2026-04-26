import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

import type {
    RepairNotificationListResponse,
} from './repair-notification.types';
import { AppConfigService } from '../app-config/app-config.service';

@Injectable({
    providedIn: 'root',
})
export class RepairNotificationService {
    private readonly http = inject(HttpClient);
    private readonly appConfig = inject(AppConfigService);

    private readonly baseUrl = `${this.apiBase}/repair-notifications/repairs`;

    private get apiBase(): string {
        return this.appConfig.config.apiBase;
    }

    listForRepair(repairId: string) {
        return this.http.get<RepairNotificationListResponse>(
            `${this.baseUrl}/${encodeURIComponent(repairId)}`
        );
    }
}