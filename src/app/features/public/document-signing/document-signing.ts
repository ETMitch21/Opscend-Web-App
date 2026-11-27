import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { DocumentsService } from '../../../core/documents/documents.service';

@Component({
  selector: 'app-document-signing',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <main class="min-h-screen bg-[#f5f5f7] px-4 py-6 text-slate-900" [style.--customer-brand]="brandColor()">
      <div class="mx-auto max-w-3xl space-y-5">
        <header class="rounded-[1.75rem] bg-white p-6 shadow-sm border border-slate-200">
          <div class="flex items-center gap-3">
            @if (details()?.shopLogoUrl) { <img [src]="details()?.shopLogoUrl" alt="Shop logo" class="h-11 w-11 object-contain rounded-xl" /> }
            <div class="text-xs uppercase tracking-wider font-semibold text-slate-500">Secure customer approval</div>
          </div>
          <h1 class="mt-2 text-2xl font-semibold">{{ details()?.shopName || 'Document review' }}</h1>
          <p class="mt-2 text-sm text-slate-600">Review, sign, and continue to your repair booking. Only a few steps.</p>
          @if (details()?.kind === 'quote') {
            <nav aria-label="Booking progress" class="mt-5 grid grid-cols-3 gap-2 text-xs font-semibold">
              <div class="rounded-lg px-3 py-2 text-center text-white" [style.background]="brandColor()">1 · Sign</div>
              <div class="rounded-lg bg-slate-100 px-3 py-2 text-center text-slate-500">2 · Confirm & pay</div>
              <div class="rounded-lg bg-slate-100 px-3 py-2 text-center text-slate-500">3 · Schedule</div>
            </nav>
          }
        </header>
        @if (busy()) { <div role="status" class="rounded-xl bg-white p-5">Loading document…</div> }
        @if (error()) { <div role="alert" class="rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">{{ error() }}</div> }
        @if (details(); as item) {
          <section class="rounded-2xl bg-white p-5 shadow-sm border border-slate-200 space-y-4">
            <div class="flex flex-wrap justify-between gap-3 items-center">
              <div><p class="text-xs text-slate-500 uppercase">{{ item.kind === 'quote' ? 'Estimate' : 'Repair authorization' }}</p><h2 class="text-xl font-semibold">{{ item.documentNumber }}</h2></div>
              <span class="rounded-full px-3 py-1 text-sm bg-slate-100">{{ item.status }}</span>
            </div>
            @if (pdfUrl()) { <iframe title="Document to review" [src]="pdfUrl()" class="w-full h-[400px] sm:h-[540px] rounded-xl border border-slate-200"></iframe> }
            <button type="button" (click)="download()" class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium">Download PDF</button>
          </section>
          @if (item.status === 'pending') {
            <form (ngSubmit)="sign()" class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
              <h2 class="text-xl font-semibold">Electronic signature</h2>
              <p class="text-sm text-slate-700">{{ item.consentText }}</p>
              <label class="block text-sm font-medium" for="signer">Your full legal name</label>
              <input id="signer" name="signer" required minlength="2" maxlength="160" autocomplete="name" [(ngModel)]="signerName"
                class="w-full rounded-lg border border-slate-300 px-3 py-3" placeholder="Type your full name" />
              <label class="flex items-start gap-3 text-sm"><input type="checkbox" name="consent" required [(ngModel)]="consent" class="mt-1" />
                <span>I agree to use an electronic signature, confirm that I am authorized to accept these terms, and understand that typing my name and selecting Sign constitutes my electronic signature.</span></label>
              <button type="submit" [disabled]="submitting() || !consent || signerName.trim().length < 2"
                class="w-full sm:w-auto rounded-xl px-6 py-3 text-white font-semibold disabled:opacity-50" [style.background]="brandColor()">{{ submitting() ? 'Saving your signature…' : (item.kind === 'quote' ? 'Sign & continue' : 'Sign authorization') }}</button>
              <p class="text-xs text-slate-500">The signed version is retained by the shop with a UTC timestamp and audit record. Signing does not take payment.</p>
            </form>
          } @else if (item.status === 'signed') {
            <div role="status" class="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-900">
              <h2 class="text-lg font-semibold">Document signed</h2>
              <p>Your signed PDF is shown above. You can download a copy for your records.</p>
              @if (continuationAvailable()) {
                <div class="mt-5 border-t border-emerald-200 pt-5">
                  <p class="mb-3 text-sm">Next: confirm your estimate, pay a deposit if required, and choose an appointment time.</p>
                  <button type="button" (click)="continueToBooking()" [disabled]="continuing()"
                    class="rounded-xl px-5 py-3 text-sm font-semibold text-white disabled:opacity-50" [style.background]="brandColor()">
                    {{ continuing() ? 'Opening your quote…' : 'Continue to your quote' }}
                  </button>
                </div>
              }
            </div>
          } @else {
            <div class="rounded-xl border border-slate-200 bg-white p-5">This invitation is no longer available. Contact the business for a new link.</div>
          }
        }
      </div>
    </main>
  `,
})
export class DocumentSigning implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly documents = inject(DocumentsService);
  private readonly sanitizer = inject(DomSanitizer);
  private token = '';
  private objectUrl = '';
  readonly details = signal<any | null>(null);
  readonly pdfUrl = signal<SafeResourceUrl | null>(null);
  readonly busy = signal(true);
  readonly submitting = signal(false);
  readonly error = signal('');
  readonly continuationAvailable = signal(false);
  readonly continuing = signal(false);
  readonly brandColor = signal('#111827');
  signerName = '';
  consent = false;

  async ngOnInit(): Promise<void> {
    this.token = this.route.snapshot.paramMap.get('token') || '';
    await this.load();
  }
  private async load(): Promise<void> {
    this.busy.set(true); this.error.set('');
    try {
      const detail = await this.documents.publicSignature(this.token);
      this.details.set(detail);
      const color = detail.shopColor;
      this.brandColor.set(typeof color === 'string' && /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#111827');
      this.continuationAvailable.set(detail.status === 'signed' && detail.kind === 'quote');
      if (detail.status === 'pending' || detail.status === 'signed') {
        const blob = await this.documents.publicSignaturePdf(this.token);
        if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
        this.objectUrl = URL.createObjectURL(blob);
        // Only an app-created blob URL is trusted here, not a user-supplied URL.
        this.pdfUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.objectUrl));
      }
    } catch { this.error.set('This signing invitation could not be opened. It may be expired or revoked.'); }
    finally { this.busy.set(false); }
  }
  async sign(): Promise<void> {
    if (this.submitting() || !this.consent || this.signerName.trim().length < 2) return;
    this.submitting.set(true); this.error.set('');
    try {
      await this.documents.signPublic(this.token, this.signerName.trim());
      // A successful quote signature transitions directly into the existing quote workflow.
      // Repair authorizations stay on this page with a signed document to download.
      if (this.details()?.kind === 'quote') {
        await this.continueToBooking(true);
      } else {
        await this.load();
      }
    }
    catch { this.error.set('Unable to sign. This invitation may have expired or already been used.'); }
    finally { this.submitting.set(false); }
  }
  async continueToBooking(justSigned = false): Promise<void> {
    if (this.continuing() || (!justSigned && !this.continuationAvailable())) return;
    this.continuing.set(true); this.error.set('');
    try {
      const next = await this.documents.publicSignatureContinue(this.token);
      if (!next.path.startsWith('/quote/')) throw new Error('Invalid continuation');
      await this.router.navigateByUrl(next.path);
    } catch {
      this.error.set('Your signature was saved, but booking could not be opened. Use Continue below to retry or contact the shop.');
      await this.load();
    }
    finally { this.continuing.set(false); }
  }

  download(): void {
    if (!this.objectUrl) return;
    const a = document.createElement('a'); a.href = this.objectUrl; a.download = 'signed-document.pdf'; a.click();
  }
  ngOnDestroy(): void { if (this.objectUrl) URL.revokeObjectURL(this.objectUrl); }
}
