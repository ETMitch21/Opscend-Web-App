import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';
import { CheckIcon, LucideAngularModule } from 'lucide-angular';

import { GoogleCalendarService } from '../../../core/google-calendar/google-calendar-service';
import {
  GoogleCalendarChoice,
  GoogleCalendarMapping,
  GoogleCalendarStatusResponse,
} from '../../../core/google-calendar/google-calendar-model';
import { MobileSentrixService } from '../../../core/mobilesentrix/mobilesentrix-service';
import { MobileSentrixStatusResponse } from '../../../core/mobilesentrix/mobilesentrix-model';
import { StripeService } from '../../../core/stripe/stripe-service';
import { StripeStatusResponse } from '../../../core/stripe/stripe-model';
import { ToastService } from '../../../core/toast/toast-service';
import { SettingsLayoutComponent } from '../settings-layout/settings-layout';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-shop-integrations',
  imports: [SettingsLayoutComponent, CommonModule, LucideAngularModule],
  templateUrl: './shop-integrations.html',
  styleUrl: './shop-integrations.scss',
})
export class ShopIntegrations {
  private readonly mobilesentrix = inject(MobileSentrixService);
  private readonly stripe = inject(StripeService);
  private readonly googleCalendar = inject(GoogleCalendarService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);

  readonly canManageIntegrations = () => this.auth.hasPermission('shops:write');

  checkmarkIcon = CheckIcon;

  status: MobileSentrixStatusResponse | null = null;
  stripeStatus: StripeStatusResponse | null = null;
  googleStatus: GoogleCalendarStatusResponse | null = null;
  googleCalendars: GoogleCalendarChoice[] = [];

  loadingStatus = true;
  loadingStripeStatus = true;
  loadingGoogleStatus = true;
  loadingGoogleCalendars = false;

  connecting = false;
  disconnecting = false;

  stripeConnecting = false;
  stripeDisconnecting = false;
  stripeOpeningDashboard = false;

  googleConnecting = false;
  googleDisconnecting = false;
  googleSyncing = false;
  googleSettingsSaving = false;
  googleMappingsOpen = false;
  readonly savingGoogleMappings = new Set<string>();

  ngOnInit(): void {
    this.handleCallbackQueryState();
    this.loadStatus();
    this.loadStripeStatus();
    void this.loadGoogleStatus();
  }

  loadStatus(): void {
    this.loadingStatus = true;

    this.mobilesentrix
      .getStatus()
      .pipe(finalize(() => (this.loadingStatus = false)))
      .subscribe({
        next: (res) => {
          this.status = res;
        },
        error: () => {
          this.status = null;
          this.toast.error("We couldn't load the MobileSentrix connection status.");
        },
      });
  }

  loadStripeStatus(): void {
    this.loadingStripeStatus = true;

    this.stripe
      .getStatus()
      .pipe(finalize(() => (this.loadingStripeStatus = false)))
      .subscribe({
        next: (res) => {
          this.stripeStatus = res;
        },
        error: () => {
          this.stripeStatus = null;
          this.toast.error("We couldn't load the Stripe connection status.");
        },
      });
  }

  async loadGoogleStatus(): Promise<void> {
    this.loadingGoogleStatus = true;

    try {
      this.googleStatus = await this.googleCalendar.getStatus();
      if (this.googleStatus.connected) {
        await this.loadGoogleCalendars();
      } else {
        this.googleCalendars = [];
      }
    } catch {
      this.googleStatus = null;
      this.googleCalendars = [];
      this.toast.error("We couldn't load the Google Calendar connection status.");
    } finally {
      this.loadingGoogleStatus = false;
    }
  }

  async loadGoogleCalendars(): Promise<void> {
    if (!this.isGoogleConnected || this.loadingGoogleCalendars) return;

    this.loadingGoogleCalendars = true;
    try {
      const response = await this.googleCalendar.getCalendars();
      this.googleCalendars = response.calendars ?? [];
    } catch {
      this.googleCalendars = [];
      this.toast.error("We couldn't load calendars from Google.");
    } finally {
      this.loadingGoogleCalendars = false;
    }
  }

  onConnect(): void {
    if (!this.canManageIntegrations()) return;
    if (this.connecting || this.isConnected) return;

    this.connecting = true;
    this.mobilesentrix.connect();
  }

  onDisconnect(): void {
    if (!this.canManageIntegrations()) return;
    if (this.disconnecting) return;

    this.toast.confirm('Disconnect MobileSentrix from your shop?', () => {
      this.disconnecting = true;

      this.mobilesentrix
        .disconnect()
        .pipe(finalize(() => (this.disconnecting = false)))
        .subscribe({
          next: () => {
            this.toast.success('MobileSentrix disconnected');
            this.loadStatus();
          },
          error: () => {
            this.toast.error("We couldn't disconnect MobileSentrix, please try again.");
          },
        });
    });
  }

  onStripeConnect(): void {
    if (!this.canManageIntegrations()) return;
    if (this.stripeConnecting || this.isStripeConnected) return;

    this.stripeConnecting = true;

    this.stripe.connect().catch(() => {
      this.toast.error("We couldn't start Stripe onboarding, please try again.");
      this.stripeConnecting = false;
    });
  }

  onStripeDisconnect(): void {
    if (!this.canManageIntegrations()) return;
    if (this.stripeDisconnecting) return;

    this.toast.confirm('Disconnect Stripe from your shop?', () => {
      this.stripeDisconnecting = true;

      this.stripe
        .disconnect()
        .pipe(finalize(() => (this.stripeDisconnecting = false)))
        .subscribe({
          next: () => {
            this.toast.success('Stripe disconnected.');
            this.loadStripeStatus();
          },
          error: () => {
            this.toast.error("We couldn't disconnect Stripe, please try again.");
          },
        });
    });
  }

  onOpenStripeDashboard(): void {
    if (!this.canManageIntegrations()) return;
    if (this.stripeOpeningDashboard || !this.isStripeConnected) return;

    this.stripeOpeningDashboard = true;

    try {
      this.stripe.openDashboard();
    } finally {
      this.stripeOpeningDashboard = false;
    }
  }

  async onGoogleConnect(): Promise<void> {
    if (!this.canManageIntegrations()) return;
    if (this.googleConnecting || this.isGoogleConnected) return;

    this.googleConnecting = true;
    try {
      await this.googleCalendar.connect();
    } catch {
      this.googleConnecting = false;
      this.toast.error("We couldn't start Google Calendar authorization.");
    }
  }

  onGoogleDisconnect(): void {
    if (!this.canManageIntegrations()) return;
    if (this.googleDisconnecting) return;

    this.toast.confirm(
      'Disconnect Google Calendar? Existing Google events will remain, but future appointments will stop syncing.',
      async () => {
        this.googleDisconnecting = true;
        try {
          await this.googleCalendar.disconnect();
          this.googleStatus = null;
          this.googleCalendars = [];
          this.googleMappingsOpen = false;
          this.toast.success('Google Calendar disconnected.');
          await this.loadGoogleStatus();
        } catch {
          this.toast.error("We couldn't disconnect Google Calendar.");
        } finally {
          this.googleDisconnecting = false;
        }
      },
    );
  }

  async onGoogleSyncNow(): Promise<void> {
    if (!this.canManageIntegrations()) return;
    if (this.googleSyncing || !this.isGoogleConnected) return;

    this.googleSyncing = true;
    try {
      this.googleStatus = await this.googleCalendar.syncNow();
      this.toast.success('Google Calendar sync completed.');
    } catch {
      this.toast.error("We couldn't complete the Google Calendar sync.");
    } finally {
      this.googleSyncing = false;
    }
  }

  toggleGoogleMappings(): void {
    this.googleMappingsOpen = !this.googleMappingsOpen;
  }

  async onGoogleSettingChange(
    key: 'syncEnabled' | 'pushAppointments' | 'pullAppointmentChanges' | 'blockBusyTime',
    value: boolean,
  ): Promise<void> {
    if (!this.canManageIntegrations()) return;
    if (!this.googleStatus || this.googleSettingsSaving) return;

    const previous = this.googleStatus.settings[key];
    this.googleStatus = {
      ...this.googleStatus,
      settings: { ...this.googleStatus.settings, [key]: value },
    };
    this.googleSettingsSaving = true;

    try {
      this.googleStatus = await this.googleCalendar.updateSettings({ [key]: value });
    } catch {
      if (this.googleStatus) {
        this.googleStatus = {
          ...this.googleStatus,
          settings: { ...this.googleStatus.settings, [key]: previous },
        };
      }
      this.toast.error("We couldn't update the Google Calendar setting.");
    } finally {
      this.googleSettingsSaving = false;
    }
  }

  async onGoogleCalendarSelected(userId: string, calendarId: string): Promise<void> {
    if (!this.canManageIntegrations()) return;
    if (!calendarId || this.savingGoogleMappings.has(userId)) return;

    const existing = this.googleMappingFor(userId);
    this.savingGoogleMappings.add(userId);

    try {
      this.googleStatus = await this.googleCalendar.saveMapping(userId, {
        calendarId,
        enabled: true,
        syncAppointments: existing?.syncAppointments ?? true,
        blockBusyTime: existing?.blockBusyTime ?? true,
      });
      this.toast.success('Technician calendar saved.');
    } catch {
      this.toast.error("We couldn't save that technician calendar.");
    } finally {
      this.savingGoogleMappings.delete(userId);
    }
  }

  async onGoogleMappingToggle(
    userId: string,
    key: 'syncAppointments' | 'blockBusyTime',
    value: boolean,
  ): Promise<void> {
    if (!this.canManageIntegrations()) return;
    const mapping = this.googleMappingFor(userId);
    if (!mapping || this.savingGoogleMappings.has(userId)) return;

    this.savingGoogleMappings.add(userId);
    try {
      this.googleStatus = await this.googleCalendar.saveMapping(userId, {
        calendarId: mapping.calendarId,
        enabled: mapping.enabled,
        syncAppointments: key === 'syncAppointments' ? value : mapping.syncAppointments,
        blockBusyTime: key === 'blockBusyTime' ? value : mapping.blockBusyTime,
      });
    } catch {
      this.toast.error("We couldn't update that technician calendar.");
    } finally {
      this.savingGoogleMappings.delete(userId);
    }
  }

  onRemoveGoogleMapping(userId: string): void {
    if (!this.canManageIntegrations()) return;
    const mapping = this.googleMappingFor(userId);
    if (!mapping || this.savingGoogleMappings.has(userId)) return;

    this.toast.confirm(`Stop syncing ${mapping.userName}'s Google calendar?`, async () => {
      this.savingGoogleMappings.add(userId);
      try {
        await this.googleCalendar.removeMapping(userId);
        await this.loadGoogleStatus();
        this.toast.success('Technician calendar removed.');
      } catch {
        this.toast.error("We couldn't remove that technician calendar.");
      } finally {
        this.savingGoogleMappings.delete(userId);
      }
    });
  }

  googleMappingFor(userId: string): GoogleCalendarMapping | null {
    return this.googleStatus?.mappings.find((mapping) => mapping.userId === userId) ?? null;
  }

  googleCalendarValueFor(userId: string): string {
    return this.googleMappingFor(userId)?.calendarId ?? '';
  }

  isSavingGoogleMapping(userId: string): boolean {
    return this.savingGoogleMappings.has(userId);
  }

  get isConnected(): boolean {
    return !!this.status?.connected;
  }

  get isStripeConnected(): boolean {
    return !!this.stripeStatus?.connected;
  }

  get isGoogleConnected(): boolean {
    return !!this.googleStatus?.connected;
  }

  private handleCallbackQueryState(): void {
    const params = this.route.snapshot.queryParamMap;

    const msState = params.get('mobilesentrix');
    const stripeState = params.get('stripe');
    const googleState = params.get('googleCalendar');
    const reason = params.get('reason');
    const code = params.get('code');

    if (msState === 'success') {
      this.toast.success('MobileSentrix connected successfully.');
      this.clearIntegrationQueryParams();
      return;
    }

    if (msState === 'error') {
      this.toast.error(this.buildErrorMessage(reason, code));
      this.clearIntegrationQueryParams();
      return;
    }

    if (stripeState === 'success') {
      this.toast.success('Stripe connected successfully.');
      this.clearIntegrationQueryParams();
      return;
    }

    if (stripeState === 'error') {
      this.toast.error(this.buildStripeErrorMessage(reason, code));
      this.clearIntegrationQueryParams();
      return;
    }

    if (googleState === 'success') {
      this.googleMappingsOpen = true;
      this.toast.success('Google Calendar connected successfully.');
      this.clearIntegrationQueryParams();
      return;
    }

    if (googleState === 'error') {
      this.toast.error(this.buildGoogleErrorMessage(reason));
      this.clearIntegrationQueryParams();
    }
  }

  private buildErrorMessage(reason: string | null, code: string | null): string {
    switch (reason) {
      case 'missing_callback_params':
        return 'MobileSentrix did not return the callback values we expected.';
      case 'missing_shop':
        return "We couldn't determine which shop this MobileSentrix connection belongs to.";
      case 'oauth_failed':
        return code
          ? `MobileSentrix authorization failed. Error code: ${code}.`
          : 'MobileSentrix authorization failed.';
      case 'callback_failed':
        return "We couldn't complete the MobileSentrix callback.";
      default:
        return 'Something went wrong while connecting MobileSentrix.';
    }
  }

  private buildStripeErrorMessage(reason: string | null, code: string | null): string {
    switch (reason) {
      case 'missing_shop':
        return "We couldn't determine which shop this Stripe connection belongs to.";
      case 'account_link_failed':
        return "We couldn't create the Stripe onboarding link.";
      case 'dashboard_link_failed':
        return "We couldn't open the Stripe dashboard link.";
      case 'callback_failed':
        return "We couldn't complete the Stripe connection flow.";
      default:
        return code
          ? `Something went wrong while connecting Stripe. Error code: ${code}.`
          : 'Something went wrong while connecting Stripe.';
    }
  }

  private buildGoogleErrorMessage(reason: string | null): string {
    switch (reason) {
      case 'access_denied':
        return 'Google Calendar authorization was canceled.';
      case 'missing_callback_params':
        return 'Google did not return the authorization values Opscend expected.';
      case 'callback_failed':
        return "We couldn't complete the Google Calendar connection.";
      default:
        return 'Something went wrong while connecting Google Calendar.';
    }
  }

  private clearIntegrationQueryParams(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        mobilesentrix: null,
        stripe: null,
        googleCalendar: null,
        reason: null,
        code: null,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
