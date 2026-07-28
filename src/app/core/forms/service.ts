import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { AppConfigService } from '../app-config/app-config.service';
import {
  FormAssignment,
  FormAssignmentPayload,
  FormsBootstrapResponse,
  FormTemplate,
  FormTemplatePayload,
  PublicFormResponse,
} from './model';

@Injectable({ providedIn: 'root' })
export class FormsService {
  private readonly appConfig = inject(AppConfigService);
  private readonly http = inject(HttpClient);

  private get baseUrl(): string {
    return `${this.appConfig.config.apiBase}/forms`;
  }

  bootstrap(): Observable<FormsBootstrapResponse> {
    return this.http.get<FormsBootstrapResponse>(`${this.baseUrl}/bootstrap`);
  }

  createTemplate(payload: FormTemplatePayload): Observable<{ data: FormTemplate }> {
    return this.http.post<{ data: FormTemplate }>(`${this.baseUrl}/templates`, payload);
  }

  updateTemplate(id: string, payload: Partial<FormTemplatePayload>): Observable<{ data: FormTemplate }> {
    return this.http.patch<{ data: FormTemplate }>(`${this.baseUrl}/templates/${encodeURIComponent(id)}`, payload);
  }

  duplicateTemplate(id: string): Observable<{ data: FormTemplate }> {
    return this.http.post<{ data: FormTemplate }>(`${this.baseUrl}/templates/${encodeURIComponent(id)}/duplicate`, {});
  }

  archiveTemplate(id: string): Observable<{ ok: true }> {
    return this.http.delete<{ ok: true }>(`${this.baseUrl}/templates/${encodeURIComponent(id)}`);
  }

  createAssignment(payload: FormAssignmentPayload): Observable<{ data: FormAssignment }> {
    return this.http.post<{ data: FormAssignment }>(`${this.baseUrl}/assignments`, payload);
  }

  updateAssignment(id: string, payload: Record<string, unknown>): Observable<{ data: FormAssignment }> {
    return this.http.patch<{ data: FormAssignment }>(`${this.baseUrl}/assignments/${encodeURIComponent(id)}`, payload);
  }

  resendAssignment(id: string): Observable<{ data: FormAssignment }> {
    return this.http.post<{ data: FormAssignment }>(`${this.baseUrl}/assignments/${encodeURIComponent(id)}/send`, {});
  }

  submitStaffAssignment(id: string, responses: Record<string, unknown>): Observable<{ data: FormAssignment }> {
    return this.http.post<{ data: FormAssignment }>(`${this.baseUrl}/assignments/${encodeURIComponent(id)}/submit`, { responses });
  }

  listAssignments(filters: { status?: string; audience?: string; search?: string; repairId?: string; assignedToUserId?: string; limit?: number } = {}): Observable<{ data: FormAssignment[] }> {
    let params = new HttpParams();
    if (filters.status) params = params.set('status', filters.status);
    if (filters.audience) params = params.set('audience', filters.audience);
    if (filters.search) params = params.set('search', filters.search);
    if (filters.repairId) params = params.set('repairId', filters.repairId);
    if (filters.assignedToUserId) params = params.set('assignedToUserId', filters.assignedToUserId);
    if (filters.limit) params = params.set('limit', String(filters.limit));
    return this.http.get<{ data: FormAssignment[] }>(`${this.baseUrl}/assignments`, { params });
  }

  getPublicForm(token: string): Observable<PublicFormResponse> {
    return this.http.get<PublicFormResponse>(`${this.baseUrl}/public/${encodeURIComponent(token)}`);
  }

  submitPublicForm(token: string, responses: Record<string, unknown>): Observable<{ ok: true; submittedAt: string }> {
    return this.http.post<{ ok: true; submittedAt: string }>(`${this.baseUrl}/public/${encodeURIComponent(token)}/submit`, { responses });
  }
}
