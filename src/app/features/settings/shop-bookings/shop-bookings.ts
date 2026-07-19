import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import {
  FormBuilder,
  FormControl,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { Router } from '@angular/router';

import { BookingAdminService } from '../../../core/booking/service';
import {
  BookingSettings,
  BookingSettingsPatch,
} from '../../../core/booking/model';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';
type BookingSettingsTab = 'general' | 'pricing' | 'scheduling' | 'embed';

@Component({
  selector: 'app-shop-bookings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './shop-bookings.html',
  styleUrl: './shop-bookings.scss',
})
export class ShopBookingsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly bookingApi = inject(BookingAdminService);
  private readonly router = inject(Router);

  readonly techSpecsCategoryOptions = [
    'Smartphones',
    'Desktops',
    'Displays',
    'Tablets',
    'Smartwatches',
    'GPUs',
    'Laptops',
  ];

  readonly loading = signal(true);
  readonly saveState = signal<SaveState>('idle');
  readonly error = signal<string | null>(null);
  readonly activeTab = signal<BookingSettingsTab>('general');
  readonly settings = signal<BookingSettings | null>(null);

  readonly selectedPublicCatalogCategoryCount = computed(
    () =>
      this.linesToArray(
        this.settingsForm.controls.publicCatalogCategories.value,
      ).length,
  );

  readonly publicBookingUrl = computed(() => {
    const settings = this.settings() as (BookingSettings & {
      shopSlug?: string | null;
    }) | null;
    const slug = settings?.shopSlug?.trim();
    return slug
      ? `${this.publicAppOrigin()}/book/${encodeURIComponent(slug)}`
      : '';
  });

  readonly iframeCode = computed(() => {
    const url = this.publicBookingUrl();
    return url
      ? `<iframe src="${url}" width="100%" height="850" style="border:0; border-radius:24px;" loading="lazy"></iframe>`
      : '';
  });

  readonly settingsForm = this.fb.group({
    enabled: [false],
    embedEnabled: [true],

    defaultMarkupMultiplier: [1.8, [Validators.required, Validators.min(0.01)]],
    defaultLaborDollars: [40, [Validators.required, Validators.min(0)]],
    roundingMode: ['nearest_nine', Validators.required],

    publicCatalogCategories: new FormControl('', { nonNullable: true }),

    minimumRetailDollars: [null as number | null],
    maximumRetailDollars: [null as number | null],

    sameDayEnabled: [true],
    sameDayCutoffTime: ['14:00'],
    sameDayBufferMins: [120, [Validators.required, Validators.min(0)]],

    inStockLeadDays: [0, [Validators.required, Validators.min(0)]],
    outOfStockLeadDays: [2, [Validators.required, Validators.min(0)]],
    notCarriedLeadDays: [2, [Validators.required, Validators.min(0)]],
    manualReviewLeadDays: [2, [Validators.required, Validators.min(0)]],

    defaultDurationMins: [60, [Validators.required, Validators.min(5)]],
    quoteExpirationHours: [24, [Validators.required, Validators.min(1)]],
    quoteDisclaimer: [''],
    allowedEmbedOriginsText: [''],
  });

  ngOnInit(): void {
    void this.loadSettings();
  }

  setActiveTab(tab: BookingSettingsTab): void {
    this.activeTab.set(tab);
  }

  goToRepairPricing(): void {
    void this.router.navigate(['/settings/shop/repair-pricing']);
  }

  isPublicCatalogCategorySelected(category: string): boolean {
    return this.linesToArray(
      this.settingsForm.controls.publicCatalogCategories.value,
    ).includes(category);
  }

  togglePublicCatalogCategory(category: string): void {
    const selected = new Set(
      this.linesToArray(
        this.settingsForm.controls.publicCatalogCategories.value,
      ),
    );

    if (selected.has(category)) selected.delete(category);
    else selected.add(category);

    this.settingsForm.controls.publicCatalogCategories.setValue(
      this.techSpecsCategoryOptions
        .filter((option) => selected.has(option))
        .join('\n'),
    );
  }

  private async loadSettings(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const settings = await firstValueFrom(this.bookingApi.getSettings());
      this.settings.set(settings);
      this.patchSettingsForm(settings);
    } catch (error) {
      console.error(error);
      this.error.set('Could not load public booking settings.');
    } finally {
      this.loading.set(false);
    }
  }

  saveSettings(): void {
    if (this.settingsForm.invalid) {
      this.settingsForm.markAllAsTouched();
      return;
    }

    this.saveState.set('saving');
    this.error.set(null);
    const raw = this.settingsForm.getRawValue();

    const body: BookingSettingsPatch = {
      enabled: Boolean(raw.enabled),
      embedEnabled: Boolean(raw.embedEnabled),
      defaultMarkupMultiplier: Number(raw.defaultMarkupMultiplier ?? 1.8),
      defaultLaborCents: this.dollarsToCents(raw.defaultLaborDollars),
      roundingMode: raw.roundingMode as BookingSettingsPatch['roundingMode'],
      publicCatalogCategories: this.linesToArray(raw.publicCatalogCategories),
      minimumRetailCents:
        raw.minimumRetailDollars == null
          ? null
          : this.dollarsToCents(raw.minimumRetailDollars),
      maximumRetailCents:
        raw.maximumRetailDollars == null
          ? null
          : this.dollarsToCents(raw.maximumRetailDollars),
      sameDayEnabled: Boolean(raw.sameDayEnabled),
      sameDayCutoffMin: this.timeToMinutes(raw.sameDayCutoffTime),
      sameDayBufferMins: Number(raw.sameDayBufferMins ?? 120),
      inStockLeadDays: Number(raw.inStockLeadDays ?? 0),
      outOfStockLeadDays: Number(raw.outOfStockLeadDays ?? 2),
      notCarriedLeadDays: Number(raw.notCarriedLeadDays ?? 2),
      manualReviewLeadDays: Number(raw.manualReviewLeadDays ?? 2),
      defaultDurationMins: Number(raw.defaultDurationMins ?? 60),
      quoteExpirationHours: Number(raw.quoteExpirationHours ?? 24),
      quoteDisclaimer: this.nullableTrim(raw.quoteDisclaimer),
      allowedEmbedOrigins: this.linesToArray(raw.allowedEmbedOriginsText),
    };

    this.bookingApi.updateSettings(body).subscribe({
      next: (settings) => {
        this.settings.set(settings);
        this.patchSettingsForm(settings);
        this.saveState.set('saved');
        window.setTimeout(() => {
          if (this.saveState() === 'saved') this.saveState.set('idle');
        }, 1800);
      },
      error: (error) => {
        console.error(error);
        this.saveState.set('error');
        this.error.set('Could not save booking settings.');
      },
    });
  }

  copyIframeCode(): void {
    const code = this.iframeCode();
    if (!code || typeof navigator === 'undefined' || !navigator.clipboard) return;
    navigator.clipboard.writeText(code).catch((error) => {
      console.error('Could not copy iframe code.', error);
    });
  }

  minutesToTime(value: number | null | undefined): string {
    if (value == null) return '';
    const hours = Math.floor(value / 60);
    const minutes = value % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  private patchSettingsForm(settings: BookingSettings): void {
    this.settingsForm.patchValue({
      enabled: settings.enabled,
      embedEnabled: settings.embedEnabled,
      defaultMarkupMultiplier: Number(settings.defaultMarkupMultiplier),
      defaultLaborDollars: this.centsToDollars(settings.defaultLaborCents),
      roundingMode: settings.roundingMode,
      publicCatalogCategories: (settings.publicCatalogCategories ?? []).join(
        '\n',
      ),
      minimumRetailDollars:
        settings.minimumRetailCents == null
          ? null
          : this.centsToDollars(settings.minimumRetailCents),
      maximumRetailDollars:
        settings.maximumRetailCents == null
          ? null
          : this.centsToDollars(settings.maximumRetailCents),
      sameDayEnabled: settings.sameDayEnabled,
      sameDayCutoffTime: this.minutesToTime(settings.sameDayCutoffMin),
      sameDayBufferMins: settings.sameDayBufferMins,
      inStockLeadDays: settings.inStockLeadDays,
      outOfStockLeadDays: settings.outOfStockLeadDays,
      notCarriedLeadDays: settings.notCarriedLeadDays,
      manualReviewLeadDays: settings.manualReviewLeadDays,
      defaultDurationMins: settings.defaultDurationMins,
      quoteExpirationHours: settings.quoteExpirationHours,
      quoteDisclaimer: settings.quoteDisclaimer ?? '',
      allowedEmbedOriginsText: settings.allowedEmbedOrigins.join('\n'),
    });
  }

  private publicAppOrigin(): string {
    if (typeof window === 'undefined' || !window.location?.origin) {
      return 'https://app.opscend.com';
    }
    return window.location.origin.replace(/\/$/, '');
  }

  private timeToMinutes(value: string | null | undefined): number | null {
    if (!value) return null;
    const [hoursRaw, minutesRaw] = value.split(':');
    const hours = Number(hoursRaw);
    const minutes = Number(minutesRaw);
    return Number.isFinite(hours) && Number.isFinite(minutes)
      ? hours * 60 + minutes
      : null;
  }

  private dollarsToCents(value: number | string | null | undefined): number {
    return Math.round(Number(value ?? 0) * 100);
  }

  private centsToDollars(value: number): number {
    return Math.round(value) / 100;
  }

  private nullableTrim(value: string | null | undefined): string | null {
    const trimmed = String(value ?? '').trim();
    return trimmed || null;
  }

  private linesToArray(value: string | null | undefined): string[] {
    return String(value ?? '')
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);
  }
}
