import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, switchMap } from 'rxjs';

import { AppConfigService } from '../app-config/app-config.service';
import {
  KnowledgeArticle,
  KnowledgeArticlePayload,
  KnowledgeArticleStatus,
  KnowledgeAttachment,
  KnowledgeBootstrapResponse,
  KnowledgeCategory,
  KnowledgeContextResponse,
  KnowledgeVisibility,
} from './model';

@Injectable({ providedIn: 'root' })
export class KnowledgeBaseService {
  private readonly appConfig = inject(AppConfigService);
  private readonly http = inject(HttpClient);

  private get baseUrl(): string {
    return `${this.appConfig.config.apiBase}/knowledge-base`;
  }

  bootstrap(): Observable<KnowledgeBootstrapResponse> {
    return this.http.get<KnowledgeBootstrapResponse>(`${this.baseUrl}/bootstrap`);
  }

  listArticles(filters: {
    q?: string;
    status?: KnowledgeArticleStatus;
    visibility?: KnowledgeVisibility;
    categoryId?: string;
    tag?: string;
    repairId?: string;
    workQueueItemId?: string;
    pinned?: boolean;
    limit?: number;
  } = {}): Observable<{ data: KnowledgeArticle[] }> {
    let params = new HttpParams();
    if (filters.q) params = params.set('q', filters.q);
    if (filters.status) params = params.set('status', filters.status);
    if (filters.visibility) params = params.set('visibility', filters.visibility);
    if (filters.categoryId) params = params.set('categoryId', filters.categoryId);
    if (filters.tag) params = params.set('tag', filters.tag);
    if (filters.repairId) params = params.set('repairId', filters.repairId);
    if (filters.workQueueItemId) params = params.set('workQueueItemId', filters.workQueueItemId);
    if (filters.pinned !== undefined) params = params.set('pinned', String(filters.pinned));
    if (filters.limit) params = params.set('limit', String(filters.limit));
    return this.http.get<{ data: KnowledgeArticle[] }>(`${this.baseUrl}/articles`, { params });
  }

  getArticle(id: string): Observable<KnowledgeArticle> {
    return this.http.get<KnowledgeArticle>(`${this.baseUrl}/articles/${encodeURIComponent(id)}`);
  }

  createArticle(payload: KnowledgeArticlePayload): Observable<KnowledgeArticle> {
    return this.http.post<KnowledgeArticle>(`${this.baseUrl}/articles`, payload);
  }

  updateArticle(id: string, payload: Partial<KnowledgeArticlePayload>): Observable<KnowledgeArticle> {
    return this.http.patch<KnowledgeArticle>(`${this.baseUrl}/articles/${encodeURIComponent(id)}`, payload);
  }

  deleteArticle(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/articles/${encodeURIComponent(id)}`);
  }

  createCategory(payload: {
    name: string;
    description?: string | null;
    sortOrder?: number;
    isActive?: boolean;
  }): Observable<KnowledgeCategory> {
    return this.http.post<KnowledgeCategory>(`${this.baseUrl}/categories`, payload);
  }

  updateCategory(id: string, payload: Partial<{
    name: string;
    description: string | null;
    sortOrder: number;
    isActive: boolean;
  }>): Observable<KnowledgeCategory> {
    return this.http.patch<KnowledgeCategory>(`${this.baseUrl}/categories/${encodeURIComponent(id)}`, payload);
  }

  deleteCategory(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/categories/${encodeURIComponent(id)}`);
  }

  getContext(params: { repairId?: string; workQueueItemId?: string }): Observable<KnowledgeContextResponse> {
    let query = new HttpParams();
    if (params.repairId) query = query.set('repairId', params.repairId);
    if (params.workQueueItemId) query = query.set('workQueueItemId', params.workQueueItemId);
    return this.http.get<KnowledgeContextResponse>(`${this.baseUrl}/context`, { params: query });
  }

  linkArticle(id: string, payload: { repairId?: string | null; workQueueItemId?: string | null }): Observable<KnowledgeArticle> {
    return this.http.post<KnowledgeArticle>(`${this.baseUrl}/articles/${encodeURIComponent(id)}/links`, payload);
  }

  unlinkArticle(id: string, payload: { repairId?: string | null; workQueueItemId?: string | null }): Observable<KnowledgeArticle> {
    let params = new HttpParams();
    if (payload.repairId) params = params.set('repairId', payload.repairId);
    if (payload.workQueueItemId) params = params.set('workQueueItemId', payload.workQueueItemId);
    return this.http.delete<KnowledgeArticle>(`${this.baseUrl}/articles/${encodeURIComponent(id)}/links`, { params });
  }

  uploadAttachment(articleId: string, file: File): Observable<KnowledgeAttachment> {
    const initPayload = {
      filename: file.name,
      mimeType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
    };

    return this.http.post<{ uploadUrl: string; storageKey: string }>(
      `${this.baseUrl}/articles/${encodeURIComponent(articleId)}/attachments/init`,
      initPayload,
    ).pipe(
      switchMap((init) =>
        this.http.put(init.uploadUrl, file, {
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
          responseType: 'text',
        }).pipe(
          switchMap(() =>
            this.http.post<KnowledgeAttachment>(
              `${this.baseUrl}/articles/${encodeURIComponent(articleId)}/attachments/complete`,
              { ...initPayload, storageKey: init.storageKey },
            ),
          ),
        ),
      ),
    );
  }

  getAttachmentDownloadUrl(articleId: string, attachmentId: string): Observable<{ downloadUrl: string; expiresInSeconds: number }> {
    return this.http.get<{ downloadUrl: string; expiresInSeconds: number }>(
      `${this.baseUrl}/articles/${encodeURIComponent(articleId)}/attachments/${encodeURIComponent(attachmentId)}/download`,
    );
  }

  deleteAttachment(articleId: string, attachmentId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.baseUrl}/articles/${encodeURIComponent(articleId)}/attachments/${encodeURIComponent(attachmentId)}`,
    );
  }
}
