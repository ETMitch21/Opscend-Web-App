import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ArrowRightIcon, LucideAngularModule } from "lucide-angular";
import { RouterModule } from '@angular/router';
import { AppConfigService } from '../../../core/app-config/app-config.service';

type FulfillmentStatus = 'unfulfilled' | 'fulfilled';
type ServiceAreaMode = 'radius' | 'zip_codes' | 'custom';

interface ShopServiceAreaZip {
  id: string;
  shopId: string;
  postalCode: string;
  createdAt: string;
}

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
    customerExperience: {
      publicRepairTrackingEnabled: boolean;
    };
    pos: {
      orders: {
        prefix: string | null;
        startNumber: number | null;
        padding: number | null;
        defaultFulfillmentStatus: FulfillmentStatus | null;
      };
    };
    onsite: {
      enabled: boolean;
      tripFeeEnabled: boolean;
      defaultTripFeeCents: number | null;
      serviceAreaMode: ServiceAreaMode;
      serviceAreaMiles: number | null;
      serviceAreaNotes: string | null;
      zipCodes: ShopServiceAreaZip[];
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
  publicRepairTrackingEnabled = false;
  orderPrefix = '';
  orderStartNumber: number | null = 1;
  orderPadding: number | null = 4;
  defaultFulfillmentStatus: FulfillmentStatus = 'unfulfilled';
  onsiteEnabled = false;
  onsiteTripFeeEnabled = false;
  onsiteDefaultTripFeeDollars: number | null = null;
  onsiteServiceAreaMode: ServiceAreaMode = 'radius';
  onsiteServiceAreaMiles: number | null = null;
  onsiteServiceAreaNotes = '';

  serviceAreaZipInput = '';
  serviceAreaZips: ShopServiceAreaZip[] = [];

  readonly serviceAreaModes: Array<{ label: string; value: ServiceAreaMode }> = [
    { label: 'Radius', value: 'radius' },
    { label: 'ZIP Codes', value: 'zip_codes' },
    { label: 'Custom', value: 'custom' },
  ];

  private centsToDollars(value: number | null | undefined): number | null {
    if (value == null) return null;
    return value / 100;
  }

  private dollarsToCents(value: number | null | undefined): number | null {
    if (value == null || Number.isNaN(Number(value))) return null;
    return Math.round(Number(value) * 100);
  }

  private normalizeZip(value: string): string {
    return value.trim().toUpperCase();
  }

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
      this.publicRepairTrackingEnabled =
        !!shop.settings?.customerExperience?.publicRepairTrackingEnabled;
      this.orderPrefix = shop.settings?.pos?.orders?.prefix ?? '';
      this.orderStartNumber = shop.settings?.pos?.orders?.startNumber ?? 1;
      this.orderPadding = shop.settings?.pos?.orders?.padding ?? 4;
      this.defaultFulfillmentStatus =
        shop.settings?.pos?.orders?.defaultFulfillmentStatus ?? 'unfulfilled';
      this.onsiteEnabled = !!shop.settings?.onsite?.enabled;
      this.onsiteTripFeeEnabled = !!shop.settings?.onsite?.tripFeeEnabled;
      this.onsiteDefaultTripFeeDollars = this.centsToDollars(
        shop.settings?.onsite?.defaultTripFeeCents ?? null
      );
      this.onsiteServiceAreaMode = shop.settings?.onsite?.serviceAreaMode ?? 'radius';
      this.onsiteServiceAreaMiles = shop.settings?.onsite?.serviceAreaMiles ?? null;
      this.onsiteServiceAreaNotes = shop.settings?.onsite?.serviceAreaNotes ?? '';
      this.serviceAreaZips = [...(shop.settings?.onsite?.zipCodes ?? [])].sort((a, b) =>
        a.postalCode.localeCompare(b.postalCode)
      );
      this.serviceAreaZipInput = '';
    } catch (err) {
      console.error(err);
      this.error.set('Could not load shop settings.');
    } finally {
      this.loading.set(false);
    }
  }

  addServiceAreaZip(): void {
    const postalCode = this.normalizeZip(this.serviceAreaZipInput);
    if (!postalCode) return;

    const exists = this.serviceAreaZips.some((zip) => zip.postalCode === postalCode);
    if (exists) {
      this.serviceAreaZipInput = '';
      return;
    }

    this.serviceAreaZips = [
      ...this.serviceAreaZips,
      {
        id: `temp:${postalCode}`,
        shopId: this.shopId() ?? '',
        postalCode,
        createdAt: new Date().toISOString(),
      },
    ].sort((a, b) => a.postalCode.localeCompare(b.postalCode));

    this.serviceAreaZipInput = '';
  }

  removeServiceAreaZip(id: string): void {
    this.serviceAreaZips = this.serviceAreaZips.filter((zip) => zip.id !== id);
  }

  onServiceAreaZipKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      this.addServiceAreaZip();
    }
  }

  onOnsiteEnabledChange(): void {
    if (!this.onsiteEnabled) {
      this.onsiteTripFeeEnabled = false;
      this.onsiteDefaultTripFeeDollars = null;
      this.onsiteServiceAreaMode = 'radius';
      this.onsiteServiceAreaMiles = null;
      this.onsiteServiceAreaNotes = '';
      this.serviceAreaZipInput = '';
      this.serviceAreaZips = [];
    }
  }

  onOnsiteTripFeeEnabledChange(): void {
    if (!this.onsiteTripFeeEnabled) {
      this.onsiteDefaultTripFeeDollars = null;
    }
  }

  onServiceAreaModeChange(): void {
    if (this.onsiteServiceAreaMode !== 'radius') {
      this.onsiteServiceAreaMiles = null;
    }

    if (this.onsiteServiceAreaMode !== 'zip_codes') {
      this.serviceAreaZipInput = '';
      this.serviceAreaZips = [];
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

      if (this.onsiteEnabled) {
        if (this.onsiteTripFeeEnabled) {
          if (
            this.onsiteDefaultTripFeeDollars !== null &&
            this.onsiteDefaultTripFeeDollars < 0
          ) {
            this.error.set('Default trip fee must be 0 or greater.');
            this.saving.set(false);
            return;
          }
        }

        if (this.onsiteServiceAreaMode === 'radius') {
          if (this.onsiteServiceAreaMiles !== null && this.onsiteServiceAreaMiles < 0) {
            this.error.set('Service area miles must be 0 or greater.');
            this.saving.set(false);
            return;
          }
        }

        if (this.onsiteServiceAreaMode === 'zip_codes' && this.serviceAreaZips.length === 0) {
          this.error.set('Add at least one ZIP code for ZIP code service areas.');
          this.saving.set(false);
          return;
        }
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
            customerExperience: {
              publicRepairTrackingEnabled: this.publicRepairTrackingEnabled,
            },
            pos: {
              orders: {
                prefix: this.orderPrefix.trim() || null,
                startNumber: this.orderStartNumber,
                padding: this.orderPadding,
                defaultFulfillmentStatus: this.defaultFulfillmentStatus,
              },
            },
            onsite: {
              enabled: this.onsiteEnabled,
              tripFeeEnabled: this.onsiteTripFeeEnabled,
              defaultTripFeeCents: this.onsiteTripFeeEnabled
                ? this.dollarsToCents(this.onsiteDefaultTripFeeDollars)
                : null,
              serviceAreaMode: this.onsiteEnabled ? this.onsiteServiceAreaMode : 'radius',
              serviceAreaMiles:
                this.onsiteEnabled && this.onsiteServiceAreaMode === 'radius'
                  ? this.onsiteServiceAreaMiles
                  : null,
              serviceAreaNotes:
                this.onsiteEnabled ? this.onsiteServiceAreaNotes.trim() || null : null,
            },
          },
        })
      );

      if (this.onsiteEnabled) {
        const existingZipIds = new Set(
          this.serviceAreaZips
            .filter((zip) => !zip.id.startsWith('temp:'))
            .map((zip) => zip.id)
        );

        const currentZipRes = await firstValueFrom(
          this.http.get<{ data: ShopServiceAreaZip[] }>(
            `${this.apiBase}/shops/${shopId}/settings/onsite/service-area/zips`
          )
        );

        const currentZips = currentZipRes.data ?? [];

        for (const zip of currentZips) {
          if (!existingZipIds.has(zip.id)) {
            await firstValueFrom(
              this.http.delete(
                `${this.apiBase}/shops/${shopId}/settings/onsite/service-area/zips/${zip.id}`
              )
            );
          }
        }

        const currentPostalCodes = new Set(
          currentZips.map((zip) => this.normalizeZip(zip.postalCode))
        );

        for (const zip of this.serviceAreaZips) {
          const postalCode = this.normalizeZip(zip.postalCode);
          if (!currentPostalCodes.has(postalCode)) {
            await firstValueFrom(
              this.http.post(
                `${this.apiBase}/shops/${shopId}/settings/onsite/service-area/zips`,
                { postalCode }
              )
            );
          }
        }
      } else {
        const currentZipRes = await firstValueFrom(
          this.http.get<{ data: ShopServiceAreaZip[] }>(
            `${this.apiBase}/shops/${shopId}/settings/onsite/service-area/zips`
          )
        );

        for (const zip of currentZipRes.data ?? []) {
          await firstValueFrom(
            this.http.delete(
              `${this.apiBase}/shops/${shopId}/settings/onsite/service-area/zips/${zip.id}`
            )
          );
        }
      }

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