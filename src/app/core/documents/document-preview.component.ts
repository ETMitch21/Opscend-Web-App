import { CommonModule } from '@angular/common';
import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { DocumentsService } from './documents.service';

@Component({
  selector: 'app-document-preview',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (documents.preview(); as preview) {
      <div class="fixed inset-0 z-[1000] flex flex-col bg-slate-950/80" role="dialog" aria-modal="true" aria-label="Document preview">
        <div class="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 shadow-sm sm:px-6">
          <div class="min-w-0 flex-1">
            <p class="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Document preview · {{ preview.kind.replace('-', ' ') }}</p>
            <h2 class="truncate text-base font-semibold text-slate-900">{{ preview.title }}</h2>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <button type="button" (click)="print()" [disabled]="!preview.url" class="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">Print</button>
            <button type="button" (click)="documents.downloadPreview()" [disabled]="!preview.url" class="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">Download</button>
            @if (['ticket', 'receipt', 'invoice', 'quote'].includes(preview.kind) && (preview.savedId || preview.sourceId)) {
              <button type="button" (click)="email()" [disabled]="!preview.url || sending()" class="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">{{ sending() ? 'Sending…' : 'Email customer' }}</button>
            }
            @if (preview.sourceId) {
              <button type="button" (click)="save()" [disabled]="!preview.url || saving()" class="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">{{ saving() ? 'Saving…' : 'Save copy' }}</button>
            }
            <button type="button" (click)="documents.closePreview()" class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Close <span aria-hidden="true">×</span></button>
          </div>
        </div>
        @if (documents.labelSelection(); as label) {
          <div class="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 sm:px-6">
            <label class="flex items-center gap-2">Label size
              <select #labelSize [value]="label.size" class="rounded-lg border border-slate-300 px-2 py-1" (change)="changeLabel(labelSize.value, labelCopies.value, labelPrice.checked)">
                <option value="2x1">2 × 1 in</option><option value="4x2">4 × 2 in</option>
              </select>
            </label>
            <label class="flex items-center gap-2" [class.hidden]="label.kind === 'batch' && isQuantityBatch(label.items)">Copies per product
              <input #labelCopies type="number" min="1" max="10" [value]="label.copies" class="w-16 rounded-lg border border-slate-300 px-2 py-1" (change)="changeLabel(labelSize.value, labelCopies.value, labelPrice.checked)" />
            </label>
            <label class="flex items-center gap-2" [class.hidden]="label.kind === 'repair'"><input #labelPrice type="checkbox" [checked]="label.showPrice" (change)="changeLabel(labelSize.value, labelCopies.value, labelPrice.checked)" /> Show price</label>
            <span class="text-xs text-slate-500">Print at Actual Size (100%). Supported SKUs include Code 39 barcodes.</span>
          </div>
        }
        @if (message()) { <div role="status" class="bg-white px-5 py-2 text-sm text-slate-700">{{ message() }}</div> }
        @if (preview.loading) {
          <div class="flex flex-1 items-center justify-center text-sm text-white" role="status">Loading PDF…</div>
        } @else if (preview.error) {
          <div class="flex flex-1 items-center justify-center p-6 text-center text-sm text-white" role="alert">{{ preview.error }}</div>
        } @else if (preview.url) {
          <div class="min-h-0 flex-1 p-2 sm:p-5">
            <iframe #pdfFrame title="PDF document" [src]="trustedPreviewUrl()" class="h-full w-full rounded-xl border-0 bg-white shadow-xl" (load)="frameLoaded(pdfFrame)"></iframe>
          </div>
        }
      </div>
    }
  `,
})
export class DocumentPreviewComponent {
  readonly documents = inject(DocumentsService);
  private readonly sanitizer = inject(DomSanitizer);
  readonly message = signal('');
  readonly sending = signal(false);
  readonly saving = signal(false);
  private frame: HTMLIFrameElement | null = null;
  // Cache the sanitized URL: creating a new SafeResourceUrl during change detection
  // causes Angular to reload the PDF iframe repeatedly (visible flashing).
  readonly trustedPreviewUrl = computed(() => {
    const url = this.documents.preview()?.url;
    return url ? this.sanitizer.bypassSecurityTrustResourceUrl(url) : null;
  });
  frameLoaded(frame: HTMLIFrameElement): void { this.frame = frame; }
  isQuantityBatch(items: unknown[] | undefined): boolean { return !!items?.length && typeof items[0] === 'object'; }
  async changeLabel(size: string, copies: string, price: boolean): Promise<void> {
    if (size !== '2x1' && size !== '4x2') return;
    const number = Number(copies);
    if (!Number.isInteger(number) || number < 1 || number > 10) { this.message.set('Choose between 1 and 10 copies.'); return; }
    this.message.set('');
    await this.documents.updateLabelPreview(size, number, price);
  }
  @HostListener('document:keydown.escape') onEscape(): void { if (this.documents.preview()) this.documents.closePreview(); }
  print(): void {
    try { this.frame?.contentWindow?.focus(); this.frame?.contentWindow?.print(); }
    catch { this.message.set('Your browser blocked printing this preview. Download the PDF to print it.'); }
  }
  async email(): Promise<void> {
    if (!window.confirm('Email this PDF to the customer email saved on the document?')) return;
    this.sending.set(true); this.message.set('');
    try { this.message.set(`Sent to ${await this.documents.emailPreview()}`); }
    catch { this.message.set('Unable to email this document. Check its customer email and your permissions.'); }
    finally { this.sending.set(false); }
  }
  async save(): Promise<void> {
    this.saving.set(true); this.message.set('');
    try { await this.documents.savePreview(); this.message.set('PDF saved to the Document Library.'); }
    catch { this.message.set('Unable to save the PDF.'); }
    finally { this.saving.set(false); }
  }
}
