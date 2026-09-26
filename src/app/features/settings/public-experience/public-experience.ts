import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AppConfigService } from '../../../core/app-config/app-config.service';
import { BusinessSettingsService } from '../../../core/business-settings/service';
import type { BusinessFeatureState } from '../../../core/business-settings/model';
import { SettingsLayoutComponent } from '../settings-layout/settings-layout';

type PublicExperienceSection = 'quote' | 'booking' | 'portal' | 'upsells' | 'intake' | 'recovery';

type PublicUpsellSetting = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number | null;
  active: boolean;
  displayOrder: number;
  categories: string[];
  brands: string[];
  models: string[];
  repairNeeds: string[];
  serviceModes: Array<'in_shop' | 'on_site'>;
};

type PublicUpsellEditor = {
  id: string;
  name: string;
  description: string;
  priceDollars: number | null;
  active: boolean;
  displayOrder: number;
  categories: string;
  brands: string;
  models: string;
  repairNeeds: string;
  inShop: boolean;
  onSite: boolean;
};

interface BookingPaymentSettings {
  adminDepositEnforcement: 'required' | 'allow_override' | 'disabled';
  fullPrepaymentEnabled: boolean;
  fullPrepaymentDiscountPercent: number;
  publicFunnel: {
    requireContactBeforePrice: boolean;
    marketingSmsOptInEnabled: boolean;
    marketingEmailOptInEnabled: boolean;
    transactionalDisclosure: string | null;
    marketingSmsDisclosure: string | null;
    marketingEmailDisclosure: string | null;
    abandonedRecoveryEnabled: boolean;
    abandonedRecoveryDelayMins: number;
    abandonedRecoverySecondEnabled: boolean;
    abandonedRecoverySecondDelayHours: number;
    persistentResumeEnabled: boolean;
    showNextAvailabilityWithPrice: boolean;
    enhancedQuoteResults: boolean;
    selfServiceRescheduleEnabled: boolean;
    preRepairIntakeEnabled: boolean;
    appointmentPrepEnabled: boolean;
    availabilityTeaserEnabled: boolean;
    quoteAwareChatEnabled: boolean;
    smartUpsellsEnabled: boolean;
    upsells: PublicUpsellSetting[];
    tradeInFeatureEnabled: boolean;
    tradeInUrl: string | null;
    businessLeadPromptEnabled: boolean;
    passwordlessPortalEnabled: boolean;
  };
}

interface PublicExperienceShop {
  id: string;
  settings: {
    booking: { enabled: boolean };
    customerExperience: { publicRepairTrackingEnabled: boolean };
  };
}

@Component({
  selector: 'app-public-experience-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, SettingsLayoutComponent],
  templateUrl: './public-experience.html',
})
export class PublicExperienceSettings implements OnInit {
  private readonly appConfig = inject(AppConfigService);
  private readonly http = inject(HttpClient);
  private readonly businessSettings = inject(BusinessSettingsService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly businessFeatures = signal<BusinessFeatureState | null>(null);
  readonly shopId = signal<string | null>(null);

  activeSection: PublicExperienceSection = 'quote';
  readonly sections: Array<{ key: PublicExperienceSection; label: string }> = [
    { key: 'quote', label: 'Quote Funnel' },
    { key: 'booking', label: 'Booking' },
    { key: 'portal', label: 'Customer Portal' },
    { key: 'upsells', label: 'Upsells' },
    { key: 'intake', label: 'Intake' },
    { key: 'recovery', label: 'Recovery' },
  ];

  bookingEnabled = false;
  publicRepairTrackingEnabled = true;
  requireContactBeforePrice = true;
  marketingSmsOptInEnabled = true;
  marketingEmailOptInEnabled = true;
  transactionalDisclosure = '';
  marketingSmsDisclosure = '';
  marketingEmailDisclosure = '';
  abandonedRecoveryEnabled = true;
  abandonedRecoveryDelayMins = 60;
  abandonedRecoverySecondEnabled = true;
  abandonedRecoverySecondDelayHours = 24;
  persistentResumeEnabled = true;
  showNextAvailabilityWithPrice = true;
  enhancedQuoteResults = true;
  selfServiceRescheduleEnabled = true;
  preRepairIntakeEnabled = true;
  appointmentPrepEnabled = true;
  availabilityTeaserEnabled = true;
  quoteAwareChatEnabled = true;
  smartUpsellsEnabled = true;
  tradeInFeatureEnabled = false;
  tradeInUrl = '';
  businessLeadPromptEnabled = true;
  passwordlessPortalEnabled = true;
  upsells: PublicUpsellEditor[] = [];

  get businessLeadCapabilityEnabled(): boolean {
    const settings = this.businessFeatures()?.settings;
    return Boolean(settings?.crmEnabled && (settings.businessAccountsEnabled || settings.fleetManagementEnabled));
  }

  private get apiBase(): string {
    return this.appConfig.config.apiBase;
  }

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [shopList, paymentSettings] = await Promise.all([
        firstValueFrom(this.http.get<{ data: PublicExperienceShop[] }>(`${this.apiBase}/shops`)),
        firstValueFrom(this.http.get<BookingPaymentSettings>(`${this.apiBase}/booking-payments/settings`)),
      ]);
      const shop = shopList.data?.[0];
      if (!shop) throw new Error('shop_not_found');
      this.shopId.set(shop.id);
      this.bookingEnabled = Boolean(shop.settings?.booking?.enabled);
      this.publicRepairTrackingEnabled = Boolean(shop.settings?.customerExperience?.publicRepairTrackingEnabled);

      const funnel = paymentSettings.publicFunnel;
      this.requireContactBeforePrice = funnel.requireContactBeforePrice ?? true;
      this.marketingSmsOptInEnabled = funnel.marketingSmsOptInEnabled ?? true;
      this.marketingEmailOptInEnabled = funnel.marketingEmailOptInEnabled ?? true;
      this.transactionalDisclosure = funnel.transactionalDisclosure ?? '';
      this.marketingSmsDisclosure = funnel.marketingSmsDisclosure ?? '';
      this.marketingEmailDisclosure = funnel.marketingEmailDisclosure ?? '';
      this.abandonedRecoveryEnabled = funnel.abandonedRecoveryEnabled ?? true;
      this.abandonedRecoveryDelayMins = funnel.abandonedRecoveryDelayMins ?? 60;
      this.abandonedRecoverySecondEnabled = funnel.abandonedRecoverySecondEnabled ?? true;
      this.abandonedRecoverySecondDelayHours = funnel.abandonedRecoverySecondDelayHours ?? 24;
      this.persistentResumeEnabled = funnel.persistentResumeEnabled ?? true;
      this.showNextAvailabilityWithPrice = funnel.showNextAvailabilityWithPrice ?? true;
      this.enhancedQuoteResults = funnel.enhancedQuoteResults ?? true;
      this.selfServiceRescheduleEnabled = funnel.selfServiceRescheduleEnabled ?? true;
      this.preRepairIntakeEnabled = funnel.preRepairIntakeEnabled ?? true;
      this.appointmentPrepEnabled = funnel.appointmentPrepEnabled ?? true;
      this.availabilityTeaserEnabled = funnel.availabilityTeaserEnabled ?? true;
      this.quoteAwareChatEnabled = funnel.quoteAwareChatEnabled ?? true;
      this.smartUpsellsEnabled = funnel.smartUpsellsEnabled ?? true;
      this.tradeInFeatureEnabled = funnel.tradeInFeatureEnabled ?? false;
      this.tradeInUrl = funnel.tradeInUrl ?? '';
      this.businessLeadPromptEnabled = funnel.businessLeadPromptEnabled ?? true;
      this.passwordlessPortalEnabled = funnel.passwordlessPortalEnabled ?? true;
      this.upsells = (funnel.upsells ?? []).map((upsell) => this.toEditor(upsell));

      try {
        this.businessFeatures.set(await firstValueFrom(this.businessSettings.getFeatures()));
      } catch {
        this.businessFeatures.set(null);
      }
    } catch (error) {
      console.error(error);
      this.error.set('Public experience settings could not be loaded.');
    } finally {
      this.loading.set(false);
    }
  }

  addUpsell(): void {
    this.upsells = [
      ...this.upsells,
      {
        id: this.newId(),
        name: '',
        description: '',
        priceDollars: null,
        active: true,
        displayOrder: this.upsells.length,
        categories: '',
        brands: '',
        models: '',
        repairNeeds: '',
        inShop: true,
        onSite: true,
      },
    ];
  }

  removeUpsell(id: string): void {
    this.upsells = this.upsells.filter((upsell) => upsell.id !== id);
  }

  moveUpsell(index: number, direction: -1 | 1): void {
    const target = index + direction;
    if (target < 0 || target >= this.upsells.length) return;
    const next = [...this.upsells];
    [next[index], next[target]] = [next[target], next[index]];
    this.upsells = next.map((upsell, order) => ({ ...upsell, displayOrder: order }));
  }

  async save(): Promise<void> {
    const shopId = this.shopId();
    if (!shopId) return;
    this.error.set(null);
    this.success.set(null);

    if (this.tradeInFeatureEnabled) {
      const value = this.tradeInUrl.trim();
      try {
        const parsed = new URL(value);
        if (!value || !['http:', 'https:'].includes(parsed.protocol)) throw new Error('invalid');
      } catch {
        this.error.set('Add a valid http or https sell / trade-in URL before enabling that public option.');
        return;
      }
    }

    for (const upsell of this.upsells) {
      if (!upsell.name.trim()) {
        this.error.set('Every upsell needs a name.');
        this.activeSection = 'upsells';
        return;
      }
      if (upsell.active && upsell.priceDollars == null) {
        this.error.set(`Add a price for the active upsell “${upsell.name}”.`);
        this.activeSection = 'upsells';
        return;
      }
      if (upsell.priceDollars != null && (!Number.isFinite(Number(upsell.priceDollars)) || Number(upsell.priceDollars) < 0)) {
        this.error.set(`The price for “${upsell.name}” must be zero or greater.`);
        this.activeSection = 'upsells';
        return;
      }
      if (!upsell.inShop && !upsell.onSite) {
        this.error.set(`Choose at least one service mode for “${upsell.name}”.`);
        this.activeSection = 'upsells';
        return;
      }
    }

    this.saving.set(true);
    try {
      await firstValueFrom(this.http.patch(`${this.apiBase}/shops/${shopId}`, {
        settings: {
          booking: { enabled: this.bookingEnabled },
          customerExperience: { publicRepairTrackingEnabled: this.publicRepairTrackingEnabled },
        },
      }));

      await firstValueFrom(this.http.patch<BookingPaymentSettings>(`${this.apiBase}/booking-payments/settings`, {
        publicFunnel: {
          requireContactBeforePrice: this.requireContactBeforePrice,
          marketingSmsOptInEnabled: this.marketingSmsOptInEnabled,
          marketingEmailOptInEnabled: this.marketingEmailOptInEnabled,
          transactionalDisclosure: this.transactionalDisclosure.trim() || null,
          marketingSmsDisclosure: this.marketingSmsDisclosure.trim() || null,
          marketingEmailDisclosure: this.marketingEmailDisclosure.trim() || null,
          abandonedRecoveryEnabled: this.abandonedRecoveryEnabled,
          abandonedRecoveryDelayMins: Math.max(5, Math.round(Number(this.abandonedRecoveryDelayMins) || 60)),
          abandonedRecoverySecondEnabled: this.abandonedRecoverySecondEnabled,
          abandonedRecoverySecondDelayHours: Math.max(1, Math.round(Number(this.abandonedRecoverySecondDelayHours) || 24)),
          persistentResumeEnabled: this.persistentResumeEnabled,
          showNextAvailabilityWithPrice: this.showNextAvailabilityWithPrice,
          enhancedQuoteResults: this.enhancedQuoteResults,
          selfServiceRescheduleEnabled: this.selfServiceRescheduleEnabled,
          preRepairIntakeEnabled: this.preRepairIntakeEnabled,
          appointmentPrepEnabled: this.appointmentPrepEnabled,
          availabilityTeaserEnabled: this.availabilityTeaserEnabled,
          quoteAwareChatEnabled: this.quoteAwareChatEnabled,
          smartUpsellsEnabled: this.smartUpsellsEnabled,
          upsells: this.upsells.map((upsell, index) => this.fromEditor(upsell, index)),
          tradeInFeatureEnabled: this.tradeInFeatureEnabled,
          tradeInUrl: this.tradeInUrl.trim() || null,
          businessLeadPromptEnabled: this.businessLeadPromptEnabled,
          passwordlessPortalEnabled: this.passwordlessPortalEnabled,
        },
      }));

      this.success.set('Public experience settings updated.');
      await this.load();
    } catch (error) {
      console.error(error);
      this.error.set('Public experience settings could not be saved.');
    } finally {
      this.saving.set(false);
    }
  }

  private toEditor(upsell: PublicUpsellSetting): PublicUpsellEditor {
    return {
      id: upsell.id,
      name: upsell.name,
      description: upsell.description ?? '',
      priceDollars: upsell.priceCents == null ? null : upsell.priceCents / 100,
      active: upsell.active,
      displayOrder: upsell.displayOrder,
      categories: upsell.categories.join(', '),
      brands: upsell.brands.join(', '),
      models: upsell.models.join(', '),
      repairNeeds: upsell.repairNeeds.join(', '),
      inShop: !upsell.serviceModes.length || upsell.serviceModes.includes('in_shop'),
      onSite: !upsell.serviceModes.length || upsell.serviceModes.includes('on_site'),
    };
  }

  private fromEditor(upsell: PublicUpsellEditor, index: number): PublicUpsellSetting {
    const serviceModes: Array<'in_shop' | 'on_site'> = [];
    if (upsell.inShop) serviceModes.push('in_shop');
    if (upsell.onSite) serviceModes.push('on_site');
    return {
      id: upsell.id,
      name: upsell.name.trim(),
      description: upsell.description.trim() || null,
      priceCents: upsell.priceDollars == null ? null : Math.round(Number(upsell.priceDollars) * 100),
      active: upsell.active,
      displayOrder: index,
      categories: this.csv(upsell.categories),
      brands: this.csv(upsell.brands),
      models: this.csv(upsell.models),
      repairNeeds: this.csv(upsell.repairNeeds),
      serviceModes: serviceModes.length === 2 ? [] : serviceModes,
    };
  }

  private csv(value: string): string[] {
    return [...new Set(value.split(',').map((item) => item.trim()).filter(Boolean))];
  }

  private newId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
    return `upsell_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }
}
