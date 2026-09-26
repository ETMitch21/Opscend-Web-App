import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AppConfigService } from '../../../core/app-config/app-config.service';
import { SettingsLayoutComponent } from '../settings-layout/settings-layout';

type ServiceAreaMode = 'radius' | 'zip_codes' | 'custom';

interface ShopServiceAreaZip {
  id: string;
  shopId: string;
  postalCode: string;
  createdAt: string;
}

interface ShopResponse {
  id: string;
  settings: {
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
  selector: 'app-shop-scheduling-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, SettingsLayoutComponent],
  templateUrl: './shop-scheduling.html',
})
export class ShopSchedulingSettings implements OnInit {
  private readonly appConfig = inject(AppConfigService);
  private readonly http = inject(HttpClient);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly shopId = signal<string | null>(null);

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

  private get apiBase(): string {
    return this.appConfig.config.apiBase;
  }

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const response = await firstValueFrom(
        this.http.get<{ data: ShopResponse[] }>(`${this.apiBase}/shops`),
      );
      const shop = response.data?.[0];
      if (!shop) throw new Error('shop_not_found');

      this.shopId.set(shop.id);
      const onsite = shop.settings?.onsite;
      this.onsiteEnabled = Boolean(onsite?.enabled);
      this.onsiteTripFeeEnabled = Boolean(onsite?.tripFeeEnabled);
      this.onsiteDefaultTripFeeDollars = this.centsToDollars(onsite?.defaultTripFeeCents);
      this.onsiteServiceAreaMode = onsite?.serviceAreaMode ?? 'radius';
      this.onsiteServiceAreaMiles = onsite?.serviceAreaMiles ?? null;
      this.onsiteServiceAreaNotes = onsite?.serviceAreaNotes ?? '';
      this.serviceAreaZips = [...(onsite?.zipCodes ?? [])].sort((a, b) =>
        a.postalCode.localeCompare(b.postalCode),
      );
      this.serviceAreaZipInput = '';
    } catch (error) {
      console.error(error);
      this.error.set('Scheduling settings could not be loaded.');
    } finally {
      this.loading.set(false);
    }
  }

  addServiceAreaZip(): void {
    const postalCode = this.normalizeZip(this.serviceAreaZipInput);
    if (!postalCode) return;
    if (this.serviceAreaZips.some((zip) => this.normalizeZip(zip.postalCode) === postalCode)) {
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
    if (this.onsiteEnabled) return;
    this.onsiteTripFeeEnabled = false;
    this.onsiteDefaultTripFeeDollars = null;
  }

  onOnsiteTripFeeEnabledChange(): void {
    if (!this.onsiteTripFeeEnabled) this.onsiteDefaultTripFeeDollars = null;
  }

  onServiceAreaModeChange(): void {
    if (this.onsiteServiceAreaMode !== 'radius') this.onsiteServiceAreaMiles = null;
  }

  async save(): Promise<void> {
    const shopId = this.shopId();
    if (!shopId) return;

    this.error.set(null);
    this.success.set(null);

    if (this.onsiteEnabled && this.onsiteTripFeeEnabled) {
      if (this.onsiteDefaultTripFeeDollars != null && this.onsiteDefaultTripFeeDollars < 0) {
        this.error.set('Default trip fee must be 0 or greater.');
        return;
      }
    }
    if (this.onsiteEnabled && this.onsiteServiceAreaMode === 'radius') {
      if (this.onsiteServiceAreaMiles != null && this.onsiteServiceAreaMiles < 0) {
        this.error.set('Service area miles must be 0 or greater.');
        return;
      }
    }
    if (this.onsiteEnabled && this.onsiteServiceAreaMode === 'zip_codes' && this.serviceAreaZips.length === 0) {
      this.error.set('Add at least one ZIP code for a ZIP code service area.');
      return;
    }

    this.saving.set(true);
    try {
      await firstValueFrom(
        this.http.patch(`${this.apiBase}/shops/${shopId}`, {
          settings: {
            onsite: {
              enabled: this.onsiteEnabled,
              tripFeeEnabled: this.onsiteEnabled && this.onsiteTripFeeEnabled,
              defaultTripFeeCents:
                this.onsiteEnabled && this.onsiteTripFeeEnabled
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
        }),
      );

      const currentZipResponse = await firstValueFrom(
        this.http.get<{ data: ShopServiceAreaZip[] }>(
          `${this.apiBase}/shops/${shopId}/settings/onsite/service-area/zips`,
        ),
      );
      const currentZips = currentZipResponse.data ?? [];

      const desiredPostalCodes = new Set(
        this.onsiteEnabled && this.onsiteServiceAreaMode === 'zip_codes'
          ? this.serviceAreaZips.map((zip) => this.normalizeZip(zip.postalCode))
          : [],
      );

      for (const zip of currentZips) {
        if (!desiredPostalCodes.has(this.normalizeZip(zip.postalCode))) {
          await firstValueFrom(
            this.http.delete(
              `${this.apiBase}/shops/${shopId}/settings/onsite/service-area/zips/${zip.id}`,
            ),
          );
        }
      }

      const currentPostalCodes = new Set(
        currentZips.map((zip) => this.normalizeZip(zip.postalCode)),
      );
      for (const postalCode of desiredPostalCodes) {
        if (!currentPostalCodes.has(postalCode)) {
          await firstValueFrom(
            this.http.post(
              `${this.apiBase}/shops/${shopId}/settings/onsite/service-area/zips`,
              { postalCode },
            ),
          );
        }
      }

      this.success.set('Scheduling settings updated.');
      await this.load();
    } catch (error) {
      console.error(error);
      this.error.set('Scheduling settings could not be saved.');
    } finally {
      this.saving.set(false);
    }
  }

  private centsToDollars(value: number | null | undefined): number | null {
    return value == null ? null : value / 100;
  }

  private dollarsToCents(value: number | null | undefined): number | null {
    if (value == null || Number.isNaN(Number(value))) return null;
    return Math.round(Number(value) * 100);
  }

  private normalizeZip(value: string): string {
    return value.trim().toUpperCase();
  }
}
