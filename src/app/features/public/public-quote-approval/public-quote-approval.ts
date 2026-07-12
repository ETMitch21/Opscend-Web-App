import { CommonModule, DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  CheckCircle2,
  Clock3,
  CreditCard,
  Home,
  Loader2,
  LucideAngularModule,
  Mail,
  Phone,
  ShieldCheck,
  Store,
  Wrench,
  XCircle,
} from 'lucide-angular';

import { PublicBookingService } from '../../../core/public-booking/service';
import { PublicQuoteApproval as PublicQuoteApprovalModel } from '../../../core/public-booking/model';

@Component({
  selector: 'app-public-quote-approval',
  standalone: true,
  imports: [CommonModule, DatePipe, LucideAngularModule],
  templateUrl: './public-quote-approval.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicQuoteApproval implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly publicBookingApi = inject(PublicBookingService);
  private depositSuccessRefreshAttempts = 0;

  readonly icons = {
    CheckCircle2,
    Clock3,
    CreditCard,
    Home,
    Loader2,
    Mail,
    Phone,
    ShieldCheck,
    Store,
    Wrench,
    XCircle,
  };

  readonly loading = signal(true);
  readonly actioning = signal<'accept' | 'decline' | 'deposit' | null>(null);
  readonly quote = signal<PublicQuoteApprovalModel | null>(null);
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);

  readonly token = computed(() => this.route.snapshot.paramMap.get('token') ?? '');

  readonly brandColor = computed(() => {
    const raw = this.quote()?.shop.primaryColor?.trim();
    return raw && /^#[0-9a-f]{6}$/i.test(raw) ? raw : '#111827';
  });

  readonly brandTintColor = computed(() => `${this.brandColor()}14`);
  readonly brandRingColor = computed(() => `${this.brandColor()}2e`);

  readonly brandContrastColor = computed(() => {
    const hex = this.brandColor().replace('#', '');
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.62 ? '#111827' : '#ffffff';
  });

  ngOnInit(): void {
    void this.loadQuote();
  }

  async loadQuote(): Promise<void> {
    const token = this.token();

    if (!token) {
      this.error.set('This quote link is missing or invalid.');
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      const quote = await firstValueFrom(this.publicBookingApi.getPublicQuote(token));
      this.quote.set(quote);
      this.applyDepositReturnNotice(quote);
    } catch {
      this.error.set('We could not find this quote. The link may be expired or invalid.');
    } finally {
      this.loading.set(false);
    }
  }

  async acceptQuote(): Promise<void> {
    const quote = this.quote();
    const token = this.token();

    if (!quote || !token || !this.canAccept(quote)) return;

    this.actioning.set('accept');
    this.error.set(null);
    this.notice.set(null);

    try {
      const response = await firstValueFrom(this.publicBookingApi.acceptPublicQuote(token));
      this.quote.set(response.data);
      this.notice.set(
        response.data.depositRequired && !response.data.depositPaidAt
          ? 'Quote accepted. Please pay the deposit to continue.'
          : 'Quote accepted. The shop will follow up with next steps.'
      );
    } catch {
      this.error.set('We could not accept this quote. Please contact the shop for help.');
    } finally {
      this.actioning.set(null);
    }
  }

  async declineQuote(): Promise<void> {
    const quote = this.quote();
    const token = this.token();

    if (!quote || !token || !this.canDecline(quote)) return;

    this.actioning.set('decline');
    this.error.set(null);
    this.notice.set(null);

    try {
      const response = await firstValueFrom(this.publicBookingApi.declinePublicQuote(token));
      this.quote.set(response.data);
      this.notice.set('Quote declined. Thanks for letting the shop know.');
    } catch {
      this.error.set('We could not decline this quote. Please contact the shop for help.');
    } finally {
      this.actioning.set(null);
    }
  }

  async payDeposit(): Promise<void> {
    const quote = this.quote();
    const token = this.token();

    if (!quote || !token || !this.canPayDeposit(quote)) return;

    this.actioning.set('deposit');
    this.error.set(null);
    this.notice.set(null);

    try {
      const response = await firstValueFrom(
        this.publicBookingApi.createPublicQuoteDepositCheckout(token)
      );

      window.location.href = response.url;
    } catch {
      this.error.set('We could not start the deposit payment. Please contact the shop for help.');
      this.actioning.set(null);
    }
  }

  private applyDepositReturnNotice(quote: PublicQuoteApprovalModel): void {
    const depositResult = this.route.snapshot.queryParamMap.get('deposit');

    if (depositResult === 'success') {
      if (this.isDepositPaid(quote)) {
        this.notice.set('Deposit paid. The shop has been notified and will follow up with next steps.');
        return;
      }

      this.notice.set('Deposit payment submitted. This page will update automatically once payment is confirmed.');
      this.scheduleDepositStatusRefresh();
    }

    if (depositResult === 'cancel') {
      this.notice.set('Deposit payment was canceled. You can restart payment when you are ready.');
    }
  }

  private scheduleDepositStatusRefresh(): void {
    if (this.depositSuccessRefreshAttempts >= 6) return;

    this.depositSuccessRefreshAttempts += 1;

    window.setTimeout(() => {
      void this.refreshDepositStatusAfterReturn();
    }, 2500);
  }

  private async refreshDepositStatusAfterReturn(): Promise<void> {
    const token = this.token();
    if (!token) return;

    try {
      const quote = await firstValueFrom(this.publicBookingApi.getPublicQuote(token));
      this.quote.set(quote);

      if (this.isDepositPaid(quote)) {
        this.notice.set('Deposit paid. The shop has been notified and will follow up with next steps.');
        return;
      }

      this.scheduleDepositStatusRefresh();
    } catch {
      // Keep the current quote displayed. The customer can refresh or contact the shop if needed.
    }
  }

  canPayDeposit(quote: PublicQuoteApprovalModel): boolean {
    return Boolean(
      quote.depositRequired &&
      !quote.depositPaidAt &&
      quote.depositAmountCents &&
      quote.depositAmountCents > 0 &&
      ['accepted', 'deposit_pending'].includes(String(quote.status))
    );
  }

  isDepositPaid(quote: PublicQuoteApprovalModel): boolean {
    return Boolean(quote.depositPaidAt || quote.status === 'deposit_paid');
  }

  depositDisplayAmount(quote: PublicQuoteApprovalModel): string {
    return this.money(quote.depositPaidAmountCents ?? quote.depositAmountCents);
  }

  canAccept(quote: PublicQuoteApprovalModel): boolean {
    return ![
      'accepted',
      'deposit_pending',
      'deposit_paid',
      'declined',
      'expired',
      'canceled',
      'scheduled',
      'converted',
    ].includes(String(quote.status));
  }

  canDecline(quote: PublicQuoteApprovalModel): boolean {
    return ![
      'accepted',
      'deposit_pending',
      'deposit_paid',
      'declined',
      'expired',
      'canceled',
      'scheduled',
      'converted',
    ].includes(String(quote.status));
  }

  isAcceptedStatus(status: string): boolean {
    return ['accepted', 'deposit_pending', 'deposit_paid', 'scheduled', 'converted'].includes(status);
  }

  isDeclinedStatus(status: string): boolean {
    return status === 'declined';
  }

  isClosedStatus(status: string): boolean {
    return ['expired', 'canceled'].includes(status);
  }

  statusLabel(status: string): string {
    const labels: Record<string, string> = {
      draft: 'Draft',
      quote_requested: 'Requested',
      quoted: 'Quoted',
      sent: 'Sent',
      accepted: 'Accepted',
      declined: 'Declined',
      deposit_pending: 'Deposit pending',
      deposit_paid: 'Deposit paid',
      scheduled: 'Scheduled',
      converted: 'Converted',
      expired: 'Expired',
      canceled: 'Canceled',
    };

    return labels[status] ?? status;
  }

  deviceLabel(quote: PublicQuoteApprovalModel): string {
    return [quote.brand, quote.model].filter(Boolean).join(' ') || quote.category || 'Device';
  }

  serviceModeLabel(mode: string): string {
    return mode === 'on_site' ? 'On-site service' : 'In-shop / meetup';
  }

  money(cents: number | null | undefined): string {
    if (cents === null || cents === undefined) return '—';

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  }

  shopInitials(name: string | null | undefined): string {
    const parts = String(name ?? 'Shop')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2);

    return (parts.map((part) => part[0]?.toUpperCase()).join('') || 'S').slice(0, 2);
  }

  shopAddressLines(quote: PublicQuoteApprovalModel): string[] {
    const shop = quote.shop;
    const cityLine = [shop.addressCity, shop.addressState, shop.addressPostalCode]
      .filter(Boolean)
      .join(', ')
      .replace(', ', ', ');

    return [shop.addressLine1, shop.addressLine2, cityLine, shop.addressCountry]
      .filter((line): line is string => Boolean(line));
  }

  requestAddressLines(quote: PublicQuoteApprovalModel): string[] {
    const address = quote.request.address;

    if (!address) return [];

    const cityLine = [address.city, address.state, address.postalCode]
      .filter(Boolean)
      .join(', ')
      .replace(', ', ', ');

    return [address.line1, address.line2, cityLine, address.country]
      .filter((line): line is string => Boolean(line));
  }
}

