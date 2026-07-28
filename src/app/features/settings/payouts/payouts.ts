import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  AlertCircle,
  ArrowRight,
  BadgeDollarSign,
  Building2,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Loader2,
  LucideAngularModule,
  RefreshCw,
  ShieldCheck,
  WalletCards,
} from 'lucide-angular';

import { StripeService } from '../../../core/stripe/stripe-service';
import type { StripeStatusResponse } from '../../../core/stripe/stripe-model';

type PayoutsPageState =
  | 'loading'
  | 'ready'
  | 'not_connected'
  | 'not_ready'
  | 'error';

@Component({
  selector: 'app-payouts',
  standalone: true,
  imports: [CommonModule, RouterLink, LucideAngularModule],
  templateUrl: './payouts.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Payouts implements AfterViewInit, OnDestroy {
  @ViewChild('payoutsHost', { static: true })
  private readonly payoutsHost!: ElementRef<HTMLDivElement>;

  private readonly stripeService = inject(StripeService);
  private payoutsElement: HTMLElement | null = null;

  readonly icons = {
    AlertCircle,
    ArrowRight,
    BadgeDollarSign,
    Building2,
    CheckCircle2,
    Clock3,
    ExternalLink,
    Loader2,
    RefreshCw,
    ShieldCheck,
    WalletCards,
  };

  readonly state = signal<PayoutsPageState>('loading');
  readonly status = signal<StripeStatusResponse | null>(null);
  readonly errorMessage = signal<string | null>(null);

  ngAfterViewInit(): void {
    void this.loadPayouts();
  }

  ngOnDestroy(): void {
    this.unmountPayouts();
  }

  async retry(): Promise<void> {
    await this.loadPayouts();
  }

  private async loadPayouts(): Promise<void> {
    this.state.set('loading');
    this.errorMessage.set(null);
    this.unmountPayouts();

    try {
      const status = await firstValueFrom(this.stripeService.getStatus());
      this.status.set(status);

      if (!status.connected || !status.accountId) {
        this.state.set('not_connected');
        return;
      }

      if (!status.payoutsEnabled) {
        this.state.set('not_ready');
        return;
      }

      const connectInstance = this.stripeService.getConnectInstance(
        status.accountId,
      );
      const payoutsElement = connectInstance.create('payouts');

      this.payoutsHost.nativeElement.replaceChildren(payoutsElement);
      this.payoutsElement = payoutsElement;
      this.state.set('ready');
    } catch (error) {
      console.error('Unable to load Stripe payouts.', error);
      this.errorMessage.set(this.resolveErrorMessage(error));
      this.state.set('error');
    }
  }

  private unmountPayouts(): void {
    this.payoutsElement?.remove();
    this.payoutsElement = null;
    this.payoutsHost?.nativeElement.replaceChildren();
  }

  private resolveErrorMessage(error: unknown): string {
    if (typeof error === 'object' && error !== null && 'error' in error) {
      const nested = (error as { error?: { error?: unknown; message?: unknown } }).error;
      if (typeof nested?.error === 'string') return nested.error;
      if (typeof nested?.message === 'string') return nested.message;
    }

    return error instanceof Error && error.message
      ? error.message
      : 'Stripe payouts could not be loaded. Please try again.';
  }
}
