import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ArrowRightIcon, LucideAngularModule } from "lucide-angular";
import { RouterModule } from '@angular/router';
import { AppConfigService } from '../../../core/app-config/app-config.service';

type FulfillmentStatus = 'unfulfilled' | 'fulfilled';

interface ShopResponse {
  id: string;
  name: string;
  legalName: string | null;
  slug: string;
  status: string;
  timezone: string;
  phone: string | null;
  email: string | null;
  owner: string;
  locale: {
    language: string;
    currency: string;
    country: string;
  };
  address: {
    line1: string | null;
    line2: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    country: string | null;
    geo?: {
      lat: number | null;
      lng: number | null;
    } | null;
  } | null;
  branding: {
    logoUrl: string | null;
    primaryColor: string | null;
  };
  settings: {
    booking: {
      enabled: boolean;
    };
    pos: {
      orders: {
        prefix: string | null;
        startNumber: number | null;
        padding: number | null;
        defaultFulfillmentStatus: FulfillmentStatus | null;
      };
    };
  };
}

@Component({
  selector: 'app-shop-settings-page',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, RouterModule],
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

  readonly arrowRight = ArrowRightIcon;

  readonly timezones = [
    { label: 'Central (Chicago)', value: 'America/Chicago' },
    { label: 'Eastern (New York)', value: 'America/New_York' },
    { label: 'Mountain (Denver)', value: 'America/Denver' },
    { label: 'Pacific (Los Angeles)', value: 'America/Los_Angeles' },
  ];

  readonly states = [
    { label: 'Alabama', value: 'AL' },
    { label: 'Alaska', value: 'AK' },
    { label: 'Arizona', value: 'AZ' },
    { label: 'Arkansas', value: 'AR' },
    { label: 'California', value: 'CA' },
    { label: 'Colorado', value: 'CO' },
    { label: 'Connecticut', value: 'CT' },
    { label: 'Delaware', value: 'DE' },
    { label: 'Florida', value: 'FL' },
    { label: 'Georgia', value: 'GA' },
    { label: 'Hawaii', value: 'HI' },
    { label: 'Idaho', value: 'ID' },
    { label: 'Illinois', value: 'IL' },
    { label: 'Indiana', value: 'IN' },
    { label: 'Iowa', value: 'IA' },
    { label: 'Kansas', value: 'KS' },
    { label: 'Kentucky', value: 'KY' },
    { label: 'Louisiana', value: 'LA' },
    { label: 'Maine', value: 'ME' },
    { label: 'Maryland', value: 'MD' },
    { label: 'Massachusetts', value: 'MA' },
    { label: 'Michigan', value: 'MI' },
    { label: 'Minnesota', value: 'MN' },
    { label: 'Mississippi', value: 'MS' },
    { label: 'Missouri', value: 'MO' },
    { label: 'Montana', value: 'MT' },
    { label: 'Nebraska', value: 'NE' },
    { label: 'Nevada', value: 'NV' },
    { label: 'New Hampshire', value: 'NH' },
    { label: 'New Jersey', value: 'NJ' },
    { label: 'New Mexico', value: 'NM' },
    { label: 'New York', value: 'NY' },
    { label: 'North Carolina', value: 'NC' },
    { label: 'North Dakota', value: 'ND' },
    { label: 'Ohio', value: 'OH' },
    { label: 'Oklahoma', value: 'OK' },
    { label: 'Oregon', value: 'OR' },
    { label: 'Pennsylvania', value: 'PA' },
    { label: 'Rhode Island', value: 'RI' },
    { label: 'South Carolina', value: 'SC' },
    { label: 'South Dakota', value: 'SD' },
    { label: 'Tennessee', value: 'TN' },
    { label: 'Texas', value: 'TX' },
    { label: 'Utah', value: 'UT' },
    { label: 'Vermont', value: 'VT' },
    { label: 'Virginia', value: 'VA' },
    { label: 'Washington', value: 'WA' },
    { label: 'West Virginia', value: 'WV' },
    { label: 'Wisconsin', value: 'WI' },
    { label: 'Wyoming', value: 'WY' },

    // DC + Territories
    { label: 'District of Columbia', value: 'DC' },
    { label: 'Puerto Rico', value: 'PR' },
  ];

  readonly countries = [
    { label: 'United States', value: 'US' },
  ];

  name = '';
  legalName = '';
  phone = '';
  email = '';

  slug = '';
  timezone = 'America/Chicago';

  addressLine1 = '';
  addressLine2 = '';
  addressCity = '';
  addressState = '';
  addressPostalCode = '';
  addressCountry = '';

  logoUrl = '';
  primaryColor = '';

  localeLanguage = 'en';
  localeCurrency = 'USD';
  localeCountry = 'US';

  bookingEnabled = false;
  orderPrefix = '';
  orderStartNumber: number | null = 1;
  orderPadding: number | null = 4;
  defaultFulfillmentStatus: FulfillmentStatus = 'unfulfilled';

  ngOnInit(): void {
    void this.load();
  }

  private get apiBase(): string {
    return this.appConfig.config.apiBase;
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    this.success.set(null);

    try {
      const listRes = await firstValueFrom(
        this.http.get<{ data: ShopResponse[]; nextCursor: string | null }>(`${this.apiBase}/shops`)
      );

      const shop = listRes?.data?.[0] ?? null;

      if (!shop) {
        this.error.set('Could not find your shop.');
        return;
      }

      this.shopId.set(shop.id);

      this.name = shop.name ?? '';
      this.legalName = shop.legalName ?? '';
      this.phone = shop.phone ?? '';
      this.email = shop.email ?? '';

      this.slug = shop.slug ?? '';
      this.timezone = shop.timezone ?? 'America/Chicago';

      this.addressLine1 = shop.address?.line1 ?? '';
      this.addressLine2 = shop.address?.line2 ?? '';
      this.addressCity = shop.address?.city ?? '';
      this.addressState = shop.address?.state ?? '';
      this.addressPostalCode = shop.address?.postalCode ?? '';
      this.addressCountry = shop.address?.country ?? '';

      this.logoUrl = shop.branding?.logoUrl ?? '';
      this.primaryColor = shop.branding?.primaryColor ?? '';

      this.localeLanguage = shop.locale?.language ?? 'en';
      this.localeCurrency = shop.locale?.currency ?? 'USD';
      this.localeCountry = shop.locale?.country ?? 'US';

      this.bookingEnabled = !!shop.settings?.booking?.enabled;
      this.orderPrefix = shop.settings?.pos?.orders?.prefix ?? '';
      this.orderStartNumber = shop.settings?.pos?.orders?.startNumber ?? 1;
      this.orderPadding = shop.settings?.pos?.orders?.padding ?? 4;
      this.defaultFulfillmentStatus =
        shop.settings?.pos?.orders?.defaultFulfillmentStatus ?? 'unfulfilled';
    } catch (err) {
      console.error(err);
      this.error.set('Could not load shop settings.');
    } finally {
      this.loading.set(false);
    }
  }

  async save(): Promise<void> {
    const shopId = this.shopId();

    if (!shopId) {
      this.error.set('Shop not loaded.');
      return;
    }

    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);

    try {
      if (!this.name.trim()) {
        this.error.set('Shop name is required.');
        this.saving.set(false);
        return;
      }

      if (!this.timezone.trim()) {
        this.error.set('Timezone is required.');
        this.saving.set(false);
        return;
      }

      if (this.orderStartNumber !== null && this.orderStartNumber < 1) {
        this.error.set('Order start number must be 1 or greater.');
        this.saving.set(false);
        return;
      }

      if (this.orderPadding !== null && this.orderPadding < 1) {
        this.error.set('Order padding must be 1 or greater.');
        this.saving.set(false);
        return;
      }

      await firstValueFrom(
        this.http.patch(`${this.apiBase}/shops/${shopId}`, {
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
          branding: {
            logoUrl: this.logoUrl.trim() || null,
            primaryColor: this.primaryColor.trim() || null,
          },
          locale: {
            language: this.localeLanguage.trim() || 'en',
            currency: this.localeCurrency.trim() || 'USD',
            country: this.localeCountry.trim() || 'US',
          },
          settings: {
            booking: {
              enabled: this.bookingEnabled,
            },
            pos: {
              orders: {
                prefix: this.orderPrefix.trim() || null,
                startNumber: this.orderStartNumber,
                padding: this.orderPadding,
                defaultFulfillmentStatus: this.defaultFulfillmentStatus,
              },
            },
          },
        })
      );

      this.success.set('Shop settings updated.');
      await this.load();
    } catch (err: any) {
      console.error(err);

      if (err?.error?.error === 'start_number_locked') {
        this.error.set('Order start number can’t be changed after orders already exist.');
      } else {
        this.error.set('Could not save shop settings.');
      }
    } finally {
      this.saving.set(false);
    }
  }
}