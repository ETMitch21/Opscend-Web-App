import { DOCUMENT } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { PublicBookingService } from '../../../core/public-booking/service';
import {
  PublicBookingSettings,
  PublicDeviceModelOption,
} from '../../../core/public-booking/model';

const PAGE_SIZE = 50;
const MAX_PAGES = 8;

@Component({
  selector: 'app-public-booking-launcher',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './public-booking-launcher.html',
})
export class PublicBookingLauncher implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly bookingService = inject(PublicBookingService);
  private readonly document = inject(DOCUMENT);

  readonly loading = signal(true);
  readonly modelsLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly settings = signal<PublicBookingSettings | null>(null);
  readonly shopSlug = signal<string | null>(null);
  readonly category = signal<string | null>(null);
  readonly brands = signal<string[]>([]);
  readonly models = signal<PublicDeviceModelOption[]>([]);

  readonly brandControl = new FormControl('', { nonNullable: true });
  readonly modelControl = new FormControl('', { nonNullable: true });

  private previousHtmlBackground = '';
  private previousBodyBackground = '';
  private previousAppRootBackground = '';
  private previousAppRootMinHeight = '';

  async ngOnInit(): Promise<void> {
    this.makeEmbedBackgroundTransparent();

    const slug = this.route.snapshot.paramMap.get('shopSlug')?.trim();
    if (!slug) {
      this.loading.set(false);
      this.error.set('Quote tool unavailable.');
      return;
    }

    this.shopSlug.set(slug);
    this.brandControl.valueChanges.subscribe((brand) => {
      void this.onBrandChanged(brand);
    });

    try {
      const [settings, categoriesPage] = await Promise.all([
        firstValueFrom(this.bookingService.getSettings(slug)),
        firstValueFrom(this.bookingService.listCategories(slug, 0, PAGE_SIZE)),
      ]);

      this.settings.set(settings);
      if (!settings.enabled || !settings.embedEnabled) {
        this.error.set('Online quotes are currently unavailable.');
        return;
      }

      const categories = categoriesPage.items ?? [];
      const requestedCategory =
        this.route.snapshot.queryParamMap.get('category')?.trim() || 'Smartphones';
      const selectedCategory =
        categories.find(
          (item) => item.localeCompare(requestedCategory, undefined, { sensitivity: 'accent' }) === 0
        ) ?? categories[0] ?? null;

      if (!selectedCategory) {
        this.error.set('No devices are currently available for online quotes.');
        return;
      }

      this.category.set(selectedCategory);
      await this.loadAllBrands(slug, selectedCategory);

      if (!this.brands().length) {
        this.error.set('No makes are currently available for online quotes.');
      }
    } catch (error) {
      console.error(error);
      this.error.set('Could not load repair options.');
    } finally {
      this.loading.set(false);
    }
  }

  ngOnDestroy(): void {
    this.restoreEmbedBackground();
  }

  brandColor(): string {
    const value = this.settings()?.shop?.primaryColor?.trim();
    return /^#[0-9a-f]{6}$/i.test(value ?? '') ? value! : '#e96f2d';
  }

  brandContrastColor(): string {
    const hex = this.brandColor().slice(1);
    const r = Number.parseInt(hex.slice(0, 2), 16);
    const g = Number.parseInt(hex.slice(2, 4), 16);
    const b = Number.parseInt(hex.slice(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.66 ? '#111827' : '#ffffff';
  }

  async submit(): Promise<void> {
    const slug = this.shopSlug();
    const category = this.category();
    const brand = this.brandControl.value;
    const model = this.models().find(
      (item) => item.techspecsProductId === this.modelControl.value
    );

    if (!slug || !category || !brand || !model) return;

    const bookingUrl = new URL(
      `/book/${encodeURIComponent(slug)}`,
      window.location.origin
    );
    bookingUrl.searchParams.set('category', category);
    bookingUrl.searchParams.set('brand', brand);
    bookingUrl.searchParams.set('modelId', model.techspecsProductId);
    bookingUrl.searchParams.set('model', model.model);

    const navigationTarget =
      this.route.snapshot.queryParamMap.get('target')?.trim().toLowerCase() || 'top';

    if (navigationTarget === 'self') {
      window.location.assign(bookingUrl.toString());
      return;
    }

    // The launcher is intentionally tiny and should never turn into the full
    // booking flow inside its iframe. Using window.top.location.assign() from a
    // cross-origin embed can be rejected by the browser because it requires
    // reading the parent Location object. A _top navigation is the browser-safe
    // frame-busting path and keeps the customer's click as the user activation.
    const destination = bookingUrl.toString();
    const topWindow = window.open(destination, '_top');

    if (topWindow) return;

    // If the host page sandboxed the iframe and blocked top navigation, open the
    // quote as a separate page rather than ever rendering it inside the 58px
    // launcher frame.
    const newWindow = window.open(destination, '_blank', 'noopener,noreferrer');
    if (!newWindow) {
      this.error.set('Open the full quote tool to continue.');
    }
  }

  private async onBrandChanged(brand: string): Promise<void> {
    this.modelControl.setValue('', { emitEvent: false });
    this.models.set([]);
    this.error.set(null);

    const slug = this.shopSlug();
    const category = this.category();
    if (!slug || !category || !brand) return;

    this.modelsLoading.set(true);
    try {
      const firstPage = await firstValueFrom(
        this.bookingService.listModels(slug, {
          category,
          brand,
          page: 0,
          size: PAGE_SIZE,
          keepCasing: true,
        })
      );

      const allModels = [...(firstPage.items ?? [])];
      const pagesToLoad = Math.min(firstPage.totalPages ?? 1, MAX_PAGES);

      for (let page = 1; page < pagesToLoad; page += 1) {
        const response = await firstValueFrom(
          this.bookingService.listModels(slug, {
            category,
            brand,
            page,
            size: PAGE_SIZE,
            keepCasing: true,
          })
        );
        allModels.push(...(response.items ?? []));
      }

      const seen = new Set<string>();
      this.models.set(
        allModels
          .filter((model) => {
            if (seen.has(model.techspecsProductId)) return false;
            seen.add(model.techspecsProductId);
            return true;
          })
          .sort((a, b) =>
            a.model.localeCompare(b.model, undefined, {
              numeric: true,
              sensitivity: 'base',
            })
          )
      );
    } catch (error) {
      console.error(error);
      this.error.set('Could not load models for that make.');
    } finally {
      this.modelsLoading.set(false);
    }
  }

  private async loadAllBrands(slug: string, category: string): Promise<void> {
    const firstPage = await firstValueFrom(
      this.bookingService.listBrands(slug, category, 0, PAGE_SIZE)
    );
    const allBrands = [...(firstPage.items ?? [])];
    const pagesToLoad = Math.min(firstPage.totalPages ?? 1, MAX_PAGES);

    for (let page = 1; page < pagesToLoad; page += 1) {
      const response = await firstValueFrom(
        this.bookingService.listBrands(slug, category, page, PAGE_SIZE)
      );
      allBrands.push(...(response.items ?? []));
    }

    this.brands.set(
      [...new Set(allBrands)].sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: 'base' })
      )
    );
  }

  private makeEmbedBackgroundTransparent(): void {
    const html = this.document.documentElement;
    const body = this.document.body;
    const appRoot = this.document.querySelector('app-root') as HTMLElement | null;

    this.previousHtmlBackground = html.style.background;
    this.previousBodyBackground = body.style.background;
    html.style.background = 'transparent';
    body.style.background = 'transparent';

    if (appRoot) {
      this.previousAppRootBackground = appRoot.style.background;
      this.previousAppRootMinHeight = appRoot.style.minHeight;
      appRoot.style.background = 'transparent';
      appRoot.style.minHeight = '0';
    }
  }

  private restoreEmbedBackground(): void {
    const html = this.document.documentElement;
    const body = this.document.body;
    const appRoot = this.document.querySelector('app-root') as HTMLElement | null;

    html.style.background = this.previousHtmlBackground;
    body.style.background = this.previousBodyBackground;

    if (appRoot) {
      appRoot.style.background = this.previousAppRootBackground;
      appRoot.style.minHeight = this.previousAppRootMinHeight;
    }
  }
}
