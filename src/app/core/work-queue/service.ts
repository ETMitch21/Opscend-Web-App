
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { AppConfigService } from '../app-config/app-config.service';
import {
  CreateWorkQueueItemPayload,
  PatchWorkQueueItemPayload,
  ResolveWorkQueueItemPayload,
  WorkQueueAssigneeListResponse,
  WorkQueueItem,
  WorkQueueListParams,
  WorkQueueListResponse,
  WorkQueueSummaryResponse,
} from './model';

@Injectable({ providedIn: 'root' })
export class WorkQueueService {
  private readonly appConfig = inject(AppConfigService);
  private readonly http = inject(HttpClient);

  private get baseUrl(): string {
    return `${this.appConfig.config.apiBase}/work-queue`;
  }

  list(params: WorkQueueListParams = {}): Observable<WorkQueueListResponse> {
    let httpParams = new HttpParams();

    if (params.limit !== undefined) {
      httpParams = httpParams.set('limit', String(params.limit));
    }

    if (params.cursor) {
      httpParams = httpParams.set('cursor', params.cursor);
    }

    if (params.status) {
      httpParams = httpParams.set('status', params.status);
    }

    if (params.priority) {
      httpParams = httpParams.set('priority', params.priority);
    }

    if (params.sourceType) {
      httpParams = httpParams.set('sourceType', params.sourceType);
    }

    if (params.assignedToUserId) {
      httpParams = httpParams.set('assignedToUserId', params.assignedToUserId);
    }

    if (params.due) {
      httpParams = httpParams.set('due', params.due);
    }

    if (params.q?.trim()) {
      httpParams = httpParams.set('q', params.q.trim());
    }

    return this.http.get<WorkQueueListResponse>(this.baseUrl, {
      params: httpParams,
    });
  }

  getSummary(): Observable<WorkQueueSummaryResponse> {
    return this.http.get<WorkQueueSummaryResponse>(`${this.baseUrl}/summary`);
  }

  listAssignees(): Observable<WorkQueueAssigneeListResponse> {
    return this.http.get<WorkQueueAssigneeListResponse>(
      `${this.baseUrl}/assignees`,
    );
  }

  create(payload: CreateWorkQueueItemPayload): Observable<WorkQueueItem> {
    return this.http.post<WorkQueueItem>(this.baseUrl, payload);
  }

  update(
    id: string,
    payload: PatchWorkQueueItemPayload,
  ): Observable<WorkQueueItem> {
    return this.http.patch<WorkQueueItem>(
      `${this.baseUrl}/${encodeURIComponent(id)}`,
      payload,
    );
  }

  snooze(id: string, until: string): Observable<WorkQueueItem> {
    return this.http.post<WorkQueueItem>(
      `${this.baseUrl}/${encodeURIComponent(id)}/snooze`,
      { until },
    );
  }

  complete(
    id: string,
    payload: ResolveWorkQueueItemPayload = {},
  ): Observable<WorkQueueItem> {
    return this.http.post<WorkQueueItem>(
      `${this.baseUrl}/${encodeURIComponent(id)}/complete`,
      payload,
    );
  }

  dismiss(
    id: string,
    payload: ResolveWorkQueueItemPayload = {},
  ): Observable<WorkQueueItem> {
    return this.http.post<WorkQueueItem>(
      `${this.baseUrl}/${encodeURIComponent(id)}/dismiss`,
      payload,
    );
  }

  reopen(id: string): Observable<WorkQueueItem> {
    return this.http.post<WorkQueueItem>(
      `${this.baseUrl}/${encodeURIComponent(id)}/reopen`,
      {},
    );
  }
}
