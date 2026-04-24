import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, switchMap } from 'rxjs';

import {
  RepairListResponse,
  RepairListParams,
  CreateRepairDto,
  UpdateRepairDto,
  CreateRepairNoteDto,
  CreateRepairOrderDto,
  RepairAttachment,
  RepairStatus,
  RepairNote,
  Repair,
  Order,
  AttachmentInitDto,
  AttachmentInitResponse,
  AttachmentCompleteDto,
  AttachmentListResponse,
  AttachmentDownloadResponse,
  PublicRepairTrackingResponse,
  RepairPublicShortLinkResponse
} from './repair.model';
import { AppConfigService } from '../app-config/app-config.service';


@Injectable({
  providedIn: 'root',
})
export class RepairsService {
  private readonly appConfig = inject(AppConfigService);
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${this.apiBase}/repairs`;

  private get apiBase(): string {
    return this.appConfig.config.apiBase;
  }

  createRepair(payload: CreateRepairDto): Observable<Repair> {
    return this.http.post<Repair>(this.baseUrl, payload);
  }

  listRepairs(params?: RepairListParams): Observable<RepairListResponse> {
    let httpParams = new HttpParams();

    if (params?.limit != null) {
      httpParams = httpParams.set('limit', String(params.limit));
    }

    if (params?.cursor) {
      httpParams = httpParams.set('cursor', params.cursor);
    }

    if (params?.status) {
      httpParams = httpParams.set('status', params.status);
    }

    if (params?.serviceMode) {
      httpParams = httpParams.set('serviceMode', params.serviceMode);
    }

    if (params?.customerId) {
      httpParams = httpParams.set('customerId', params.customerId);
    }

    if (params?.customerDeviceId) {
      httpParams = httpParams.set('customerDeviceId', params.customerDeviceId);
    }

    if (params?.orderId) {
      httpParams = httpParams.set('orderId', params.orderId);
    }

    return this.http.get<RepairListResponse>(this.baseUrl, {
      params: httpParams,
    });
  }

  getRepair(id: string): Observable<Repair> {
    return this.http.get<Repair>(`${this.baseUrl}/${id}`);
  }

  updateRepair(id: string, payload: UpdateRepairDto): Observable<Repair> {
    return this.http.patch<Repair>(`${this.baseUrl}/${id}`, payload);
  }

  updateRepairStatus(id: string, status: RepairStatus): Observable<Repair> {
    return this.updateRepair(id, { status });
  }

  updateRepairTrackingEnabled(id: string, enabled: boolean): Observable<Repair> {
    return this.updateRepair(id, { publicTrackingEnabled: enabled });
  }

  regeneratePublicTrackingToken(id: string): Observable<Repair> {
    return this.http.post<Repair>(
      `${this.baseUrl}/${id}/public-tracking/regenerate`,
      {}
    );
  }

  createPublicShortTrackingLink(id: string): Observable<RepairPublicShortLinkResponse> {
    return this.http.post<RepairPublicShortLinkResponse>(
      `${this.baseUrl}/${id}/public-tracking/short-link`,
      {}
    );
  }

  getPublicRepairTracking(token: string): Observable<PublicRepairTrackingResponse> {
    return this.http.get<PublicRepairTrackingResponse>(
      `${this.apiBase}/public/repairs/track/${encodeURIComponent(token)}`
    );
  }

  assignRepair(id: string, assignedTo: string | null): Observable<Repair> {
    return this.updateRepair(id, { assignedTo });
  }

  linkOrder(id: string, orderId: string | null): Observable<Repair> {
    return this.updateRepair(id, { orderId });
  }

  createNote(repairId: string, payload: CreateRepairNoteDto): Observable<RepairNote> {
    return this.http.post<RepairNote>(`${this.baseUrl}/${repairId}/notes`, payload);
  }

  createOrderFromRepair(repairId: string, payload: CreateRepairOrderDto): Observable<Order> {
    return this.http.post<Order>(`${this.baseUrl}/${repairId}/create-order`, payload);
  }

  initAttachmentUpload(
    repairId: string,
    payload: AttachmentInitDto
  ): Observable<AttachmentInitResponse> {
    return this.http.post<AttachmentInitResponse>(
      `${this.baseUrl}/${repairId}/attachments/init`,
      payload
    );
  }

  completeAttachmentUpload(
    repairId: string,
    payload: AttachmentCompleteDto
  ): Observable<RepairAttachment> {
    return this.http.post<RepairAttachment>(
      `${this.baseUrl}/${repairId}/attachments/complete`,
      payload
    );
  }

  listAttachments(repairId: string): Observable<AttachmentListResponse> {
    return this.http.get<AttachmentListResponse>(
      `${this.baseUrl}/${repairId}/attachments`
    );
  }

  getAttachmentDownloadUrl(
    repairId: string,
    attachmentId: string
  ): Observable<AttachmentDownloadResponse> {
    return this.http.get<AttachmentDownloadResponse>(
      `${this.baseUrl}/${repairId}/attachments/${attachmentId}/download`
    );
  }

  deleteAttachment(repairId: string, attachmentId: string): Observable<null> {
    return this.http.delete<null>(
      `${this.baseUrl}/${repairId}/attachments/${attachmentId}`
    );
  }

  uploadAttachment(repairId: string, file: File): Observable<RepairAttachment> {
    return this.initAttachmentUpload(repairId, {
      filename: file.name,
      mimeType: file.type || undefined,
      sizeBytes: file.size,
    }).pipe(
      switchMap((init) =>
        this.http.put(init.uploadUrl, file, {
          headers: file.type ? { 'Content-Type': file.type } : undefined,
          responseType: 'text',
        }).pipe(
          switchMap(() =>
            this.completeAttachmentUpload(repairId, {
              storageKey: init.storageKey,
              filename: file.name,
              mimeType: file.type || null,
              sizeBytes: file.size,
            })
          )
        )
      )
    );
  }
}