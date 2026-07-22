import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { AppConfigService } from '../app-config/app-config.service';
import {
  CommunicationConversationListParams,
  CommunicationConversationListResponse,
  CommunicationConversationResponse,
  CustomerCommunicationSummaryResponse,
  CommunicationMessageCreate,
  CommunicationMessageResponse,
} from './model';

@Injectable({ providedIn: 'root' })
export class CommunicationService {
  private readonly appConfig = inject(AppConfigService);
  private readonly http = inject(HttpClient);

  private get baseUrl(): string {
    return `${this.appConfig.config.apiBase}/communications`;
  }

  listConversations(
    params: CommunicationConversationListParams = {},
  ): Observable<CommunicationConversationListResponse> {
    let httpParams = new HttpParams();

    if (params.limit !== undefined) httpParams = httpParams.set('limit', String(params.limit));
    if (params.cursor) httpParams = httpParams.set('cursor', params.cursor);
    if (params.q) httpParams = httpParams.set('q', params.q);
    if (params.status) httpParams = httpParams.set('status', params.status);

    return this.http.get<CommunicationConversationListResponse>(
      `${this.baseUrl}/conversations`,
      { params: httpParams },
    );
  }

  getConversation(id: string): Observable<CommunicationConversationResponse> {
    return this.http.get<CommunicationConversationResponse>(
      `${this.baseUrl}/conversations/${encodeURIComponent(id)}`,
    );
  }

  getCustomerSummary(customerId: string): Observable<CustomerCommunicationSummaryResponse> {
    return this.http.get<CustomerCommunicationSummaryResponse>(
      `${this.baseUrl}/customers/${encodeURIComponent(customerId)}/summary`,
    );
  }

  ensureQuoteConversation(quoteId: string): Observable<CommunicationConversationResponse> {
    return this.http.post<CommunicationConversationResponse>(
      `${this.baseUrl}/conversations/quote/${encodeURIComponent(quoteId)}`,
      {},
    );
  }

  ensureRepairConversation(repairId: string): Observable<CommunicationConversationResponse> {
    return this.http.post<CommunicationConversationResponse>(
      `${this.baseUrl}/conversations/repair/${encodeURIComponent(repairId)}`,
      {},
    );
  }

  ensureCustomerConversation(customerId: string): Observable<CommunicationConversationResponse> {
    return this.http.post<CommunicationConversationResponse>(
      `${this.baseUrl}/conversations/customer/${encodeURIComponent(customerId)}`,
      {},
    );
  }

  addInternalNote(
    id: string,
    body: string,
  ): Observable<CommunicationConversationResponse> {
    return this.http.post<CommunicationConversationResponse>(
      `${this.baseUrl}/conversations/${encodeURIComponent(id)}/notes`,
      { body },
    );
  }

  markConversationRead(id: string): Observable<CommunicationConversationResponse> {
    return this.http.post<CommunicationConversationResponse>(
      `${this.baseUrl}/conversations/${encodeURIComponent(id)}/read`,
      {},
    );
  }

  archiveConversation(id: string): Observable<CommunicationConversationResponse> {
    return this.http.post<CommunicationConversationResponse>(
      `${this.baseUrl}/conversations/${encodeURIComponent(id)}/archive`,
      {},
    );
  }

  reopenConversation(id: string): Observable<CommunicationConversationResponse> {
    return this.http.post<CommunicationConversationResponse>(
      `${this.baseUrl}/conversations/${encodeURIComponent(id)}/reopen`,
      {},
    );
  }

  deleteConversation(id: string): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(
      `${this.baseUrl}/conversations/${encodeURIComponent(id)}`,
    );
  }

  sendEmailMessage(
    id: string,
    payload: CommunicationMessageCreate,
  ): Observable<CommunicationMessageResponse> {
    return this.http.post<CommunicationMessageResponse>(
      `${this.baseUrl}/conversations/${encodeURIComponent(id)}/messages/email`,
      payload,
    );
  }

  sendSmsMessage(
    id: string,
    payload: CommunicationMessageCreate,
  ): Observable<CommunicationMessageResponse> {
    return this.http.post<CommunicationMessageResponse>(
      `${this.baseUrl}/conversations/${encodeURIComponent(id)}/messages/sms`,
      payload,
    );
  }
}
