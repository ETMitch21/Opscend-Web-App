import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AppsService } from '../../../core/apps/service';

/** Generic installed-app host: iframe origin and source are checked on both sides. */
@Component({
  selector: 'app-embedded-app',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="flex h-full min-h-0 flex-col overflow-hidden bg-app-bg">
      @if (error()) {
        <div class="m-6 rounded-app-md border border-app-border bg-app-surface p-5">
          <h2 class="text-lg font-semibold">Unable to open this app</h2>
          <p class="mt-2 text-sm text-app-text-muted">{{ error() }}</p>
          <a routerLink="/settings/apps" class="mt-4 inline-block cursor-pointer text-brand">Manage apps</a>
        </div>
      } @else {
        @if (frameUrl()) {
          <iframe #appFrame [src]="frameUrl()" class="min-h-0 w-full flex-1 border-0 bg-app-bg" [attr.title]="title()" referrerpolicy="no-referrer" allow="clipboard-write" sandbox="allow-scripts allow-forms allow-same-origin allow-popups"></iframe>
        } @else {
          <div class="p-6 text-sm text-app-text-muted">Opening app…</div>
        }
      }
    </section>
  `,
})
export class EmbeddedApp implements OnInit, OnDestroy {
  @ViewChild('appFrame') frame?: ElementRef<HTMLIFrameElement>;
  private readonly route = inject(ActivatedRoute);
  private readonly apps = inject(AppsService);
  readonly error = signal('');
  readonly title = signal('App');
  readonly frameUrl = signal<SafeResourceUrl | null>(null);
  private readonly sanitizer = inject(DomSanitizer);
  private origin = '';
  private appKey = '';
  private launchToken = '';
  private expiry = 0;
  private subscription?: { unsubscribe(): void };
  private readonly messageHandler = (event: MessageEvent) => { void this.onMessage(event); };

  async ngOnInit(): Promise<void> {
    window.addEventListener('message', this.messageHandler);
    this.subscription = this.route.paramMap.subscribe(params => { this.appKey = params.get('key') ?? ''; void this.open(); });
  }
  ngOnDestroy(): void { window.removeEventListener('message', this.messageHandler); this.subscription?.unsubscribe(); this.launchToken = ''; }
  private async launch(): Promise<void> {
    const result = (await firstValueFrom(this.apps.launch(this.appKey))).data;
    const url = new URL(result.runtimeUrl);
    if (url.protocol !== 'https:' && !(url.hostname === 'localhost' && url.protocol === 'http:')) throw Error('App runtime requires HTTPS');
    this.origin = url.origin;
    this.launchToken = result.token;
    this.expiry = Date.now() + Math.min(result.expiresIn, 300) * 1000;
  }
  private async open(): Promise<void> {
    this.frameUrl.set(null); this.error.set(''); this.origin = ''; this.launchToken = '';
    if (!this.appKey) { this.error.set('Missing app identifier'); return; }
    try {
      const list = (await firstValueFrom(this.apps.list())).data;
      const app = list.find(item => item.key === this.appKey && item.installed && item.installation?.status === 'installed');
      if (!app) throw Error('This app is not installed or enabled for your shop.');
      this.title.set(app.name);
      await this.launch();
      this.frameUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(`${this.origin}/workspace?parentOrigin=${encodeURIComponent(window.location.origin)}`));
    } catch (error) { this.error.set(error instanceof Error ? error.message : 'The app is unavailable.'); }
  }
  async reload(): Promise<void> { await this.open(); }
  private async onMessage(event: MessageEvent): Promise<void> {
    if (!this.origin || event.origin !== this.origin || event.source !== this.frame?.nativeElement.contentWindow) return;
    if (!event.data || event.data.protocol !== 'opscend-app-v1') return;
    if (event.data.type === 'COPY_TEXT') {
      const text = event.data.text;
      const requestId = event.data.requestId;
      // Only copy this app's public request URL, never arbitrary content.
      if (typeof text !== 'string' || text.length > 2048 ||
          typeof requestId !== 'string' || requestId.length > 100) return;
      let allowed = false;
      try {
        const link = new URL(text);
        allowed = link.origin === this.origin &&
          (link.pathname.startsWith('/request/') || link.pathname.startsWith('/claim/'));
      } catch { /* Ignore invalid URLs. */ }
      if (!allowed) return;
      let ok = false;
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
          ok = true;
        }
      } catch { /* Try a traditional copy, without opening a modal. */ }
      if (!ok) {
        const el = document.createElement('textarea');
        el.value = text;
        el.setAttribute('readonly', '');
        el.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0';
        document.body.append(el);
        try { el.focus(); el.select(); ok = document.execCommand('copy') === true; } catch { /* Blocked. */ }
        finally { el.remove(); }
      }
      this.frame?.nativeElement.contentWindow?.postMessage(
        { protocol: 'opscend-app-v1', type: 'COPY_RESULT', requestId, ok }, this.origin
      );
      return;
    }
    if (event.data.type !== 'READY') return;
    try {
      if (!this.launchToken || Date.now() >= this.expiry - 30000) await this.launch();
      this.frame?.nativeElement.contentWindow?.postMessage({ protocol: 'opscend-app-v1', type: 'LAUNCH', token: this.launchToken }, this.origin);
    } catch { this.error.set('Your app session could not be refreshed. Please reload.'); }
  }
}
