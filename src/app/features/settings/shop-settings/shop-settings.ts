import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { AppConfigService } from '../../../core/app-config/app-config.service';
import { SettingsLayoutComponent } from '../settings-layout/settings-layout';

interface ShopResponse {
  id: string;
  name: string;
  legalName: string | null;
  slug: string;
  timezone: string;
  phone: string | null;
  email: string | null;
  locale: { language: string; currency: string; country: string };
  address: {
    line1: string | null; line2: string | null; city: string | null; state: string | null;
    postalCode: string | null; country: string | null;
  } | null;
  branding: { logoUrl: string | null; primaryColor: string | null };
}

@Component({
  selector: 'app-shop-settings-page',
  standalone: true,
  imports: [SettingsLayoutComponent, CommonModule, FormsModule],
  templateUrl: './shop-settings.html',
})
export class ShopSettings implements OnInit {
  private readonly appConfig = inject(AppConfigService);
  private readonly http = inject(HttpClient);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly shopId = signal<string | null>(null);

  name = '';
  legalName = '';
  slug = '';
  timezone = 'America/Chicago';
  phone = '';
  email = '';
  addressLine1 = '';
  addressLine2 = '';
  addressCity = '';
  addressState = 'MO';
  addressPostalCode = '';
  addressCountry = 'US';
  logoUrl = '';
  primaryColor = '';
  localeLanguage = 'en';
  localeCurrency = 'USD';
  localeCountry = 'US';

  readonly timezones = [
    { label: 'Central (Chicago)', value: 'America/Chicago' },
    { label: 'Eastern (New York)', value: 'America/New_York' },
    { label: 'Mountain (Denver)', value: 'America/Denver' },
    { label: 'Pacific (Los Angeles)', value: 'America/Los_Angeles' },
  ];

  readonly states = [
    { label: 'Alabama', value: 'AL' }, { label: 'Alaska', value: 'AK' },
    { label: 'Arizona', value: 'AZ' }, { label: 'Arkansas', value: 'AR' },
    { label: 'California', value: 'CA' }, { label: 'Colorado', value: 'CO' },
    { label: 'Connecticut', value: 'CT' }, { label: 'Delaware', value: 'DE' },
    { label: 'Florida', value: 'FL' }, { label: 'Georgia', value: 'GA' },
    { label: 'Hawaii', value: 'HI' }, { label: 'Idaho', value: 'ID' },
    { label: 'Illinois', value: 'IL' }, { label: 'Indiana', value: 'IN' },
    { label: 'Iowa', value: 'IA' }, { label: 'Kansas', value: 'KS' },
    { label: 'Kentucky', value: 'KY' }, { label: 'Louisiana', value: 'LA' },
    { label: 'Maine', value: 'ME' }, { label: 'Maryland', value: 'MD' },
    { label: 'Massachusetts', value: 'MA' }, { label: 'Michigan', value: 'MI' },
    { label: 'Minnesota', value: 'MN' }, { label: 'Mississippi', value: 'MS' },
    { label: 'Missouri', value: 'MO' }, { label: 'Montana', value: 'MT' },
    { label: 'Nebraska', value: 'NE' }, { label: 'Nevada', value: 'NV' },
    { label: 'New Hampshire', value: 'NH' }, { label: 'New Jersey', value: 'NJ' },
    { label: 'New Mexico', value: 'NM' }, { label: 'New York', value: 'NY' },
    { label: 'North Carolina', value: 'NC' }, { label: 'North Dakota', value: 'ND' },
    { label: 'Ohio', value: 'OH' }, { label: 'Oklahoma', value: 'OK' },
    { label: 'Oregon', value: 'OR' }, { label: 'Pennsylvania', value: 'PA' },
    { label: 'Rhode Island', value: 'RI' }, { label: 'South Carolina', value: 'SC' },
    { label: 'South Dakota', value: 'SD' }, { label: 'Tennessee', value: 'TN' },
    { label: 'Texas', value: 'TX' }, { label: 'Utah', value: 'UT' },
    { label: 'Vermont', value: 'VT' }, { label: 'Virginia', value: 'VA' },
    { label: 'Washington', value: 'WA' }, { label: 'West Virginia', value: 'WV' },
    { label: 'Wisconsin', value: 'WI' }, { label: 'Wyoming', value: 'WY' },
    { label: 'District of Columbia', value: 'DC' }, { label: 'Puerto Rico', value: 'PR' },
  ];

  readonly countries = [
    { label: 'United States', value: 'US' },
    { label: 'Canada', value: 'CA' },
  ];

  private get apiBase(): string { return this.appConfig.config.apiBase; }

  ngOnInit(): void { void this.load(); }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const response = await firstValueFrom(this.http.get<{ data: ShopResponse[] }>(`${this.apiBase}/shops`));
      const shop = response.data?.[0];
      if (!shop) throw new Error('shop_not_found');
      this.shopId.set(shop.id);
      this.name = shop.name ?? '';
      this.legalName = shop.legalName ?? '';
      this.slug = shop.slug ?? '';
      this.timezone = shop.timezone ?? 'America/Chicago';
      this.phone = shop.phone ?? '';
      this.email = shop.email ?? '';
      this.addressLine1 = shop.address?.line1 ?? '';
      this.addressLine2 = shop.address?.line2 ?? '';
      this.addressCity = shop.address?.city ?? '';
      this.addressState = shop.address?.state ?? 'MO';
      this.addressPostalCode = shop.address?.postalCode ?? '';
      this.addressCountry = shop.address?.country ?? 'US';
      this.logoUrl = shop.branding?.logoUrl ?? '';
      this.primaryColor = shop.branding?.primaryColor ?? '';
      this.localeLanguage = shop.locale?.language ?? 'en';
      this.localeCurrency = shop.locale?.currency ?? 'USD';
      this.localeCountry = shop.locale?.country ?? 'US';
    } catch (error) {
      console.error(error);
      this.error.set('General shop settings could not be loaded.');
    } finally {
      this.loading.set(false);
    }
  }

  async save(): Promise<void> {
    const shopId = this.shopId();
    if (!shopId) return;
    if (!this.name.trim()) { this.error.set('Shop name is required.'); return; }
    if (!this.timezone.trim()) { this.error.set('Timezone is required.'); return; }
    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);
    try {
      await firstValueFrom(this.http.patch(`${this.apiBase}/shops/${shopId}`, {
        name: this.name.trim(),
        legalName: this.legalName.trim() || null,
        timezone: this.timezone.trim(),
        phone: this.phone.trim() || null,
        email: this.email.trim() || null,
        address: {
          line1: this.addressLine1.trim() || null,
          line2: this.addressLine2.trim() || null,
          city: this.addressCity.trim() || null,
          state: this.addressState.trim() || null,
          postalCode: this.addressPostalCode.trim() || null,
          country: this.addressCountry.trim() || null,
        },
        branding: { logoUrl: this.logoUrl.trim() || null, primaryColor: this.primaryColor.trim() || null },
        locale: {
          language: this.localeLanguage.trim() || 'en',
          currency: this.localeCurrency.trim() || 'USD',
          country: this.localeCountry.trim() || 'US',
        },
      }));
      this.success.set('General settings updated.');
      await this.load();
    } catch (error) {
      console.error(error);
      this.error.set('General shop settings could not be saved.');
    } finally {
      this.saving.set(false);
    }
  }
}
