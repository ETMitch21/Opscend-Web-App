import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AppConfigService } from '../app-config/app-config.service';

export interface SavedDocumentRow {
  id: string;
  kind: string;
  sourceId: string | null;
  customerId?: string | null;
  documentNumber: string;
  customerName: string | null;
  customerEmail: string | null;
  filename: string;
  createdAt: string;
  sizeBytes: number;
  deliveries: { id: string; status: string; recipient: string; createdAt: string }[];
}

export interface AutomaticReceiptRow {
  id: string; orderId: string; status: string; recipient: string | null;
  error: string | null; documentId: string | null; createdAt: string; completedAt: string | null;
}

export interface DocumentSettings {
  showLogo: boolean;
  showCustomerContact: boolean;
  hasLogo: boolean;
  footerText: string;
  ticketPolicy: string;
  quotePolicy: string;
  invoicePolicy: string;
  receiptPolicy: string;
  workOrderPolicy: string;
  autoReceiptEnabled: boolean;
  autoReceiptEmailEnabled: boolean;
  deviceLabelSize: '2x1' | '4x2';
  productLabelSize: '2x1' | '4x2';
  labelShowPrice: boolean;
  labelShowCustomer: boolean;
  labelShowQr: boolean;
  labelCopies: number;
}

export interface ScheduledReport {
  id: string; kind: 'sales' | 'inventory'; frequency: 'daily' | 'weekly' | 'monthly';
  hourUtc: number; recipientEmail: string; enabled: boolean; nextRunAt: string | null;
}
export interface ScheduledReportJob {
  id: string; kind: string; periodKey: string; status: string; recipientEmail: string;
  createdAt: string; documentId: string | null; error: string | null;
}

export type ProductLabelSelection = string | { productId: string; copies: number };

export type DocumentType = 'ticket' | 'receipt' | 'invoice' | 'quote' | 'work-order';

@Injectable({ providedIn: 'root' })
export class DocumentsService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(AppConfigService);
  readonly preview = signal<{ url: string; filename: string; title: string; kind: string; savedId?: string; sourceId?: string; loading: boolean; error?: string } | null>(null);
  private previewRequest = 0;
  readonly labelSelection = signal<{ kind: 'repair' | 'product' | 'batch'; id?: string; items?: ProductLabelSelection[]; size: '2x1' | '4x2'; copies: number; showPrice: boolean } | null>(null);

  closePreview(): void {
    this.labelSelection.set(null);
    this.previewRequest++;
    const current = this.preview();
    this.preview.set(null);
    if (current?.url) URL.revokeObjectURL(current.url);
  }

  private async showPreview(path: string, filename: string, title: string, kind: string, savedId?: string, sourceId?: string): Promise<void> {
    this.closePreview();
    const requestId = this.previewRequest;
    this.preview.set({ url: '', filename, title, kind, savedId, sourceId, loading: true });
    try {
      // Auth + shop context come from the existing HttpClient interceptors.
      const pdf = await firstValueFrom(this.http.get(`${this.config.config.apiBase}${path}`, { responseType: 'blob' }));
      if (requestId !== this.previewRequest) return;
      if (!pdf.size || pdf.type && pdf.type !== 'application/pdf' && pdf.type !== 'application/octet-stream') throw new Error('Unexpected PDF response');
      this.preview.set({ url: URL.createObjectURL(pdf), filename, title, kind, savedId, sourceId, loading: false });
    } catch {
      if (requestId === this.previewRequest) this.preview.set({ url: '', filename, title, kind, savedId, sourceId, loading: false, error: 'Could not load this PDF. Check your permissions and try again.' });
    }
  }

  async previewLabel(kind: 'repair' | 'product', id: string, options?: { size?: '2x1' | '4x2'; copies?: number; showPrice?: boolean }): Promise<void> {
    const params = new URLSearchParams();
    if (options?.size) params.set('size', options.size);
    if (options?.copies != null) params.set('copies', String(options.copies));
    if (kind === 'product' && options?.showPrice != null) params.set('price', options.showPrice ? 'yes' : 'no');
    let defaults: DocumentSettings | null = null;
    if (!options) { try { defaults = await this.getSettings(); } catch {} }
    const job = { kind, id,
      size: options?.size ?? (kind === 'repair' ? defaults?.deviceLabelSize ?? '4x2' : defaults?.productLabelSize ?? '2x1') as '2x1' | '4x2',
      copies: options?.copies ?? defaults?.labelCopies ?? 1,
      showPrice: options?.showPrice ?? defaults?.labelShowPrice ?? true };
    params.set('size', job.size);
    params.set('copies', String(job.copies));
    if (kind === 'product') params.set('price', job.showPrice ? 'yes' : 'no');
    const pending = this.showPreview(`/documents/labels/${kind}/${encodeURIComponent(id)}.pdf?${params.toString()}`,
      `${kind}-label-${id}.pdf`, kind === 'repair' ? 'Device label' : 'Inventory label', 'label');
    this.labelSelection.set(job);
    await pending;
  }

  async previewProductLabelBatch(productIds: ProductLabelSelection[], options?: { size?: '2x1' | '4x2'; copies?: number; showPrice?: boolean }): Promise<void> {
    let defaults: DocumentSettings | null = null;
    if (!options) { try { defaults = await this.getSettings(); } catch {} }
    this.closePreview();
    const job = { kind: 'batch' as const, items: productIds,
      size: options?.size ?? defaults?.productLabelSize ?? '2x1' as '2x1' | '4x2',
      copies: options?.copies ?? defaults?.labelCopies ?? 1,
      showPrice: options?.showPrice ?? defaults?.labelShowPrice ?? true };
    this.labelSelection.set(job);
    const requestId = this.previewRequest;
    this.preview.set({ url: '', filename: 'inventory-labels-batch.pdf', title: 'Inventory labels', kind: 'label', loading: true });
    try {
      const pdf = await firstValueFrom(this.http.post(`${this.config.config.apiBase}/documents/labels/products/batch.pdf`,
        { ...(productIds.length && typeof productIds[0] === 'string' ? { productIds } : { items: productIds }),
          size: job.size, copies: job.copies, showPrice: job.showPrice }, { responseType: 'blob' }));
      if (requestId !== this.previewRequest) return;
      if (!pdf.size || (pdf.type && !['application/pdf', 'application/octet-stream'].includes(pdf.type))) throw new Error('Invalid PDF');
      this.preview.set({ url: URL.createObjectURL(pdf), filename: 'inventory-labels-batch.pdf', title: 'Inventory labels', kind: 'label', loading: false });
    } catch {
      if (requestId === this.previewRequest) this.preview.set({ url: '', filename: 'inventory-labels-batch.pdf', title: 'Inventory labels', kind: 'label', loading: false, error: 'Unable to generate inventory labels.' });
    }
  }

  async previewSavedId(id: string, title = 'Signed document'): Promise<void> {
    await this.showPreview(`/documents/archive/${encodeURIComponent(id)}.pdf`, `signed-document-${id}.pdf`, title, 'signed-ticket', id);
  }

  async previewSaved(row: SavedDocumentRow): Promise<void> {
    await this.showPreview(`/documents/archive/${encodeURIComponent(row.id)}.pdf`, row.filename, row.documentNumber, row.kind, row.id, undefined);
  }

  async updateLabelPreview(size: '2x1' | '4x2', copies: number, showPrice: boolean): Promise<void> {
    const selected = this.labelSelection();
    if (!selected) return;
    if (selected.kind === 'batch' && selected.items) {
      await this.previewProductLabelBatch(selected.items, { size, copies, showPrice });
    } else if ((selected.kind === 'repair' || selected.kind === 'product') && selected.id) {
      await this.previewLabel(selected.kind, selected.id, { size, copies, showPrice });
    }
  }

  async previewLive(kind: DocumentType, id: string): Promise<void> {
    await this.showPreview(`/documents/${kind}/${encodeURIComponent(id)}.pdf`, `${kind}-${id}.pdf`, kind.replace('-', ' '), kind, undefined, id);
  }

  downloadPreview(): void {
    const data = this.preview();
    if (!data?.url) return;
    const anchor = document.createElement('a');
    anchor.href = data.url;
    anchor.download = data.filename;
    anchor.click();
  }

  async emailSaved(id: string): Promise<string> {
    const result = await firstValueFrom(this.http.post<{ ok: boolean; recipient: string }>(
      `${this.config.config.apiBase}/documents/archive/${encodeURIComponent(id)}/email`, {}));
    return result.recipient;
  }

  async emailPreview(): Promise<string> {
    const item = this.preview();
    if (!item) throw new Error('No document selected');
    if (item.savedId) return this.emailSaved(item.savedId);
    if (item.sourceId && ['ticket', 'receipt', 'invoice', 'quote'].includes(item.kind)) return this.email(item.kind as DocumentType, item.sourceId);
    throw new Error('This document cannot be emailed.');
  }

  async savePreview(): Promise<void> {
    const item = this.preview();
    if (!item?.sourceId || !['ticket','receipt','invoice','quote','work-order'].includes(item.kind)) throw new Error('This document is already saved.');
    await this.archive(item.kind as DocumentType, item.sourceId);
  }


  async createSignature(kind: 'quote' | 'ticket', id: string): Promise<{ token: string; id: string; expiresAt: string }> {
    return firstValueFrom(this.http.post<{ token: string; id: string; expiresAt: string }>(
      `${this.config.config.apiBase}/documents/signatures/${kind}/${encodeURIComponent(id)}`, {}));
  }
  async signatureHistory(kind: 'quote' | 'ticket', id: string): Promise<{ requests: Array<{ id: string; status: string; signedAt: string | null; signerName: string | null; signedDocumentId: string | null }> }> {
    return firstValueFrom(this.http.get<any>(`${this.config.config.apiBase}/documents/signatures/${kind}/${encodeURIComponent(id)}`));
  }
  async revokeSignature(id: string): Promise<void> {
    await firstValueFrom(this.http.post(`${this.config.config.apiBase}/documents/signatures/${encodeURIComponent(id)}/revoke`, {}));
  }
  async publicSignature(token: string): Promise<any> {
    return firstValueFrom(this.http.get(`${this.config.config.apiBase}/public/documents/sign/${encodeURIComponent(token)}`));
  }
  async publicSignatureContinue(token: string): Promise<{ path: string; alreadyScheduled: boolean }> {
    return firstValueFrom(this.http.get<{ path: string; alreadyScheduled: boolean }>(
      `${this.config.config.apiBase}/public/documents/sign/${encodeURIComponent(token)}/continue`));
  }

  async signPublic(token: string, signerName: string): Promise<void> {
    await firstValueFrom(this.http.post(`${this.config.config.apiBase}/public/documents/sign/${encodeURIComponent(token)}`, { signerName, consent: true }));
  }
  async publicSignaturePdf(token: string): Promise<Blob> {
    return firstValueFrom(this.http.get(`${this.config.config.apiBase}/public/documents/sign/${encodeURIComponent(token)}/pdf`, { responseType: 'blob' }));
  }

  async scheduledReports(): Promise<{ schedules: ScheduledReport[]; jobs: ScheduledReportJob[] }> {
    return firstValueFrom(this.http.get<{ schedules: ScheduledReport[]; jobs: ScheduledReportJob[] }>(
      `${this.config.config.apiBase}/documents/schedules`));
  }

  async saveReportSchedule(kind: 'sales' | 'inventory', values: Pick<ScheduledReport, 'enabled' | 'frequency' | 'hourUtc' | 'recipientEmail'>): Promise<void> {
    await firstValueFrom(this.http.put(`${this.config.config.apiBase}/documents/schedules/${kind}`, values));
  }

  async getSettings(): Promise<DocumentSettings> {
    return firstValueFrom(this.http.get<DocumentSettings>(`${this.config.config.apiBase}/documents/settings`));
  }

  async updateSettings(values: Omit<DocumentSettings, 'hasLogo'>): Promise<void> {
    await firstValueFrom(this.http.patch(`${this.config.config.apiBase}/documents/settings`, values));
  }

  async uploadLogo(file: File): Promise<void> {
    if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 350_000) {
      throw new Error('Use a PNG or JPEG smaller than 350 KB.');
    }
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Unable to read image.'));
      reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
      reader.readAsDataURL(file);
    });
    await firstValueFrom(this.http.post(`${this.config.config.apiBase}/documents/settings/logo`, { mimeType: file.type, base64 }));
  }

  async removeLogo(): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.config.config.apiBase}/documents/settings/logo`));
  }

  async automaticReceipts(): Promise<AutomaticReceiptRow[]> {
    const result = await firstValueFrom(this.http.get<{ jobs: AutomaticReceiptRow[] }>(
      `${this.config.config.apiBase}/documents/automation/jobs`));
    return result.jobs;
  }

  async listArchive(kind?: string, cursor?: string, filters?: { customerId?: string; q?: string; from?: string; to?: string }): Promise<{ data: SavedDocumentRow[]; nextCursor: string | null }> {
    const params = new URLSearchParams({ limit: '40' });
    if (kind) params.set('kind', kind);
    if (cursor) params.set('cursor', cursor);
    if (filters?.customerId) params.set('customerId', filters.customerId);
    if (filters?.q?.trim()) params.set('q', filters.q.trim());
    if (filters?.from) params.set('from', filters.from);
    if (filters?.to) params.set('to', filters.to);
    return firstValueFrom(this.http.get<{ data: SavedDocumentRow[]; nextCursor: string | null }>(
      `${this.config.config.apiBase}/documents/archive?${params.toString()}`));
  }

  async downloadSaved(row: SavedDocumentRow): Promise<void> {
    const pdf = await firstValueFrom(this.http.get(
      `${this.config.config.apiBase}/documents/archive/${encodeURIComponent(row.id)}.pdf`,
      { responseType: 'blob' }));
    this.saveBlob(pdf, row.filename);
  }

  async archive(type: DocumentType, id: string): Promise<void> {
    await firstValueFrom(this.http.post(
      `${this.config.config.apiBase}/documents/${type}/${encodeURIComponent(id)}/archive`, {}));
  }

  async email(type: DocumentType, id: string): Promise<string> {
    const result = await firstValueFrom(this.http.post<{ ok: boolean; recipient: string }>(
      `${this.config.config.apiBase}/documents/${type}/${encodeURIComponent(id)}/email`, {}));
    return result.recipient;
  }

  async archiveReport(type: 'sales' | 'inventory', from?: string, to?: string): Promise<void> {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const query = params.toString();
    await firstValueFrom(this.http.post(
      `${this.config.config.apiBase}/documents/reports/${type}/archive${query ? '?' + query : ''}`, {}));
  }

  async report(type: 'sales' | 'inventory', from?: string, to?: string): Promise<void> {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const query = params.toString();
    const pdf = await firstValueFrom(this.http.get(`${this.config.config.apiBase}/documents/reports/${type}.pdf${query ? '?' + query : ''}`, { responseType: 'blob' }));
    this.saveBlob(pdf, `${type}-report.pdf`);
  }

  private saveBlob(pdf: Blob, filename: string): void {
    const url = URL.createObjectURL(pdf);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  async open(type: DocumentType, id: string): Promise<void> {
    // Use HttpClient so the existing auth and tenant interceptors apply.
    // Opening a bearer-authenticated endpoint directly in a new tab would fail.
    const pdf = await firstValueFrom(this.http.get(`${this.config.config.apiBase}/documents/${type}/${encodeURIComponent(id)}.pdf`, { responseType: 'blob' }));
    this.saveBlob(pdf, `${type}-${id}.pdf`);
  }
}
