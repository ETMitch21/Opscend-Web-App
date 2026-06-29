import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormControl,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { BookingAdminService } from '../../../core/booking/service';
import {
  BookingSettings,
  RepairPricingTemplate,
  RepairPricingTemplateCreate,
  ShopRepairNeed,
  ShopRepairNeedCreate,
} from '../../../core/booking/model';
import { ServicesService } from '../../../core/services/service';
import { Service } from '../../../core/services/model';
import { ProductsService } from '../../../core/products/products-service';
import { Product } from '../../../core/products/products-model';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';
type BookingSettingsTab =
  | 'general'
  | 'pricing'
  | 'scheduling'
  | 'repairNeeds'
  | 'templates'
  | 'embed';

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
  private readonly servicesApi = inject(ServicesService);
  private readonly productsApi = inject(ProductsService);

  readonly techSpecsCategoryOptions = [
    'Smartphones',
    'Desktops',
    'Displays',
    'Tablets',
    'Smartwatches',
    'GPUs',
    'Laptops',
  ];

  loading = signal(true);
  saveState = signal<SaveState>('idle');
  error = signal<string | null>(null);
  activeTab = signal<BookingSettingsTab>('general');

  settings = signal<BookingSettings | null>(null);
  repairNeeds = signal<ShopRepairNeed[]>([]);
  templates = signal<RepairPricingTemplate[]>([]);
  services = signal<Service[]>([]);
  products = signal<Product[]>([]);

  editingRepairNeedId = signal<string | null>(null);
  repairNeedBusyId = signal<string | null>(null);

  editingTemplateId = signal<string | null>(null);
  templateBusyId = signal<string | null>(null);

  activeRepairNeeds = computed(() =>
    this.repairNeeds().filter((need) => need.isActive)
  );

  inactiveRepairNeeds = computed(() =>
    this.repairNeeds().filter((need) => !need.isActive)
  );

  activeTemplates = computed(() =>
    this.templates().filter((template) => template.isActive)
  );

  inactiveTemplates = computed(() =>
    this.templates().filter((template) => !template.isActive)
  );

  selectedPublicCatalogCategoryCount = computed(
    () =>
      this.linesToArray(
        this.settingsForm.controls.publicCatalogCategories.value
      ).length
  );

  publicBookingUrl = computed(() => {
    const settings = this.settings() as (BookingSettings & {
      shopSlug?: string | null;
    }) | null;

    const slug = settings?.shopSlug?.trim();

    if (!slug) return '';

    return `${this.publicAppOrigin()}/book/${encodeURIComponent(slug)}`;
  });

  iframeCode = computed(() => {
    const url = this.publicBookingUrl();

    if (!url) return '';

    return `<iframe src="${url}" width="100%" height="850" style="border:0; border-radius:24px;" loading="lazy"></iframe>`;
  });

  setActiveTab(tab: BookingSettingsTab): void {
    this.activeTab.set(tab);
  }


  isPublicCatalogCategorySelected(category: string): boolean {
    const selected = this.linesToArray(
      this.settingsForm.controls.publicCatalogCategories.value
    );

    return selected.includes(category);
  }

  togglePublicCatalogCategory(category: string): void {
    const selected = new Set(
      this.linesToArray(this.settingsForm.controls.publicCatalogCategories.value)
    );

    if (selected.has(category)) {
      selected.delete(category);
    } else {
      selected.add(category);
    }

    const ordered = this.techSpecsCategoryOptions.filter((option) =>
      selected.has(option)
    );

    this.settingsForm.controls.publicCatalogCategories.setValue(
      ordered.join('\n')
    );
  }

  settingsForm = this.fb.group({
    enabled: [false],
    embedEnabled: [true],

    defaultMarkupMultiplier: [1.8, [Validators.required, Validators.min(0.01)]],
    defaultLaborDollars: [40, [Validators.required, Validators.min(0)]],
    roundingMode: ['nearest_nine', Validators.required],

    publicCatalogCategories: new FormControl('', {
      nonNullable: true,
    }),

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

  repairNeedForm = this.fb.group({
    label: ['', [Validators.required, Validators.maxLength(120)]],
    code: [
      '',
      [
        Validators.required,
        Validators.maxLength(80),
        Validators.pattern(/^[a-z0-9_]+$/),
      ],
    ],
    description: [''],

    isActive: [true],
    sortOrder: [0, [Validators.required, Validators.min(0)]],

    supplierSearchTermsText: [''],

    defaultLaborDollars: [null as number | null],
    defaultDurationMins: [60, [Validators.min(5)]],

    requiresManualReview: [false],
  });

  templateForm = this.fb.group({
    repairNeedId: ['', Validators.required],

    name: ['', [Validators.required, Validators.maxLength(160)]],
    isActive: [true],
    sortOrder: [0, [Validators.required, Validators.min(0)]],

    category: ['Cell Phones'],
    brand: [''],
    model: [''],
    techspecsProductId: [''],

    serviceId: [''],
    productId: [''],

    fixedPriceDollars: [null as number | null],
    useDynamicPricing: [true],

    laborDollars: [null as number | null],
    durationMins: [null as number | null],

    allowInstantConfirmation: [true],
    requiresManualReview: [false],
  });

  ngOnInit(): void {
    this.loadAll();
    this.startNewRepairNeed();
    this.startNewTemplate();
  }

  loadAll(): void {
    this.loading.set(true);
    this.error.set(null);

    Promise.all([
      firstValueFrom(this.bookingApi.getSettings()),
      firstValueFrom(this.bookingApi.listRepairNeeds()),
      firstValueFrom(this.bookingApi.listTemplates()),
      firstValueFrom(this.servicesApi.listActive(200)),
      firstValueFrom(
        this.productsApi.list({
          limit: 200,
          status: 'active',
          includeDeleted: false,
        })
      ),
    ])
      .then(([settings, repairNeeds, templates, services, products]) => {
        this.settings.set(settings);
        this.repairNeeds.set(repairNeeds.data);
        this.templates.set(templates.data);
        this.services.set(services);
        this.products.set(products.data);

        this.patchSettingsForm(settings);
      })
      .catch((err) => {
        console.error(err);
        this.error.set('Could not load public booking settings.');
      })
      .finally(() => {
        this.loading.set(false);
      });
  }

  reloadTemplates(): void {
    this.bookingApi.listTemplates().subscribe({
      next: (res) => this.templates.set(res.data),
      error: (err) => {
        console.error(err);
        this.error.set('Could not reload pricing templates.');
      },
    });
  }

  saveSettings(): void {
    if (this.settingsForm.invalid) {
      this.settingsForm.markAllAsTouched();
      return;
    }

    this.saveState.set('saving');
    this.error.set(null);

    const raw = this.settingsForm.getRawValue();

    const body = {
      enabled: Boolean(raw.enabled),
      embedEnabled: Boolean(raw.embedEnabled),

      defaultMarkupMultiplier: Number(raw.defaultMarkupMultiplier ?? 1.8),
      defaultLaborCents: this.dollarsToCents(raw.defaultLaborDollars),
      roundingMode: raw.roundingMode as any,

      publicCatalogCategories: this.linesToArray(raw.publicCatalogCategories),

      minimumRetailCents:
        raw.minimumRetailDollars === null || raw.minimumRetailDollars === undefined
          ? null
          : this.dollarsToCents(raw.minimumRetailDollars),

      maximumRetailCents:
        raw.maximumRetailDollars === null || raw.maximumRetailDollars === undefined
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
      error: (err) => {
        console.error(err);
        this.saveState.set('error');
        this.error.set('Could not save booking settings.');
      },
    });
  }

  startNewRepairNeed(): void {
    this.editingRepairNeedId.set(null);

    this.repairNeedForm.reset({
      label: '',
      code: '',
      description: '',
      isActive: true,
      sortOrder: this.getNextRepairNeedSortOrder(),
      supplierSearchTermsText: '',
      defaultLaborDollars: null,
      defaultDurationMins: 60,
      requiresManualReview: false,
    });
  }

  editRepairNeed(need: ShopRepairNeed): void {
    this.editingRepairNeedId.set(need.id);

    this.repairNeedForm.reset({
      label: need.label,
      code: need.code,
      description: need.description ?? '',
      isActive: need.isActive,
      sortOrder: need.sortOrder,
      supplierSearchTermsText: need.supplierSearchTerms.join(', '),
      defaultLaborDollars:
        need.defaultLaborCents === null
          ? null
          : this.centsToDollars(need.defaultLaborCents),
      defaultDurationMins: need.defaultDurationMins ?? 60,
      requiresManualReview: need.requiresManualReview,
    });
  }

  cancelRepairNeedEdit(): void {
    this.startNewRepairNeed();
  }

  saveRepairNeed(): void {
    if (this.repairNeedForm.invalid) {
      this.repairNeedForm.markAllAsTouched();
      return;
    }

    const raw = this.repairNeedForm.getRawValue();

    const body: ShopRepairNeedCreate = {
      label: String(raw.label ?? '').trim(),
      code: String(raw.code ?? '').trim(),
      description: this.nullableTrim(raw.description),

      isActive: Boolean(raw.isActive),
      sortOrder: Number(raw.sortOrder ?? 0),

      supplierSearchTerms: this.commaListToArray(raw.supplierSearchTermsText),

      defaultLaborCents:
        raw.defaultLaborDollars === null || raw.defaultLaborDollars === undefined
          ? null
          : this.dollarsToCents(raw.defaultLaborDollars),

      defaultDurationMins:
        raw.defaultDurationMins === null || raw.defaultDurationMins === undefined
          ? null
          : Number(raw.defaultDurationMins),

      requiresManualReview: Boolean(raw.requiresManualReview),
    };

    const editingId = this.editingRepairNeedId();

    this.repairNeedBusyId.set(editingId ?? 'new');

    const request$ = editingId
      ? this.bookingApi.updateRepairNeed(editingId, body)
      : this.bookingApi.createRepairNeed(body);

    request$.subscribe({
      next: (saved) => {
        const current = this.repairNeeds();

        if (editingId) {
          this.repairNeeds.set(
            current.map((need) => (need.id === saved.id ? saved : need))
          );
        } else {
          this.repairNeeds.set([...current, saved]);
        }

        this.startNewRepairNeed();
        this.repairNeedBusyId.set(null);
      },
      error: (err) => {
        console.error(err);
        this.error.set('Could not save repair need.');
        this.repairNeedBusyId.set(null);
      },
    });
  }

  deactivateRepairNeed(need: ShopRepairNeed): void {
    const confirmed = window.confirm(
      `Deactivate "${need.label}"? Templates for this repair need may also stop being used.`
    );

    if (!confirmed) return;

    this.repairNeedBusyId.set(need.id);

    this.bookingApi.deactivateRepairNeed(need.id).subscribe({
      next: (updated) => {
        this.repairNeeds.set(
          this.repairNeeds().map((item) =>
            item.id === updated.id ? updated : item
          )
        );

        this.repairNeedBusyId.set(null);

        if (this.editingRepairNeedId() === updated.id) {
          this.startNewRepairNeed();
        }

        this.reloadTemplates();
      },
      error: (err) => {
        console.error(err);
        this.error.set('Could not deactivate repair need.');
        this.repairNeedBusyId.set(null);
      },
    });
  }

  startNewTemplate(): void {
    this.editingTemplateId.set(null);

    const firstRepairNeed = this.activeRepairNeeds()[0] ?? null;

    this.templateForm.reset({
      repairNeedId: firstRepairNeed?.id ?? '',

      name: '',
      isActive: true,
      sortOrder: this.getNextTemplateSortOrder(),

      category: 'Cell Phones',
      brand: '',
      model: '',
      techspecsProductId: '',

      serviceId: '',
      productId: '',

      fixedPriceDollars: null,
      useDynamicPricing: true,

      laborDollars: null,
      durationMins: null,

      allowInstantConfirmation: true,
      requiresManualReview: false,
    });
  }

  editTemplate(template: RepairPricingTemplate): void {
    this.editingTemplateId.set(template.id);

    this.templateForm.reset({
      repairNeedId: template.repairNeedId,

      name: template.name,
      isActive: template.isActive,
      sortOrder: template.sortOrder,

      category: template.category ?? 'Cell Phones',
      brand: template.brand ?? '',
      model: template.model ?? '',
      techspecsProductId: template.techspecsProductId ?? '',

      serviceId: template.serviceId ?? '',
      productId: template.productId ?? '',

      fixedPriceDollars:
        template.fixedPriceCents === null
          ? null
          : this.centsToDollars(template.fixedPriceCents),

      useDynamicPricing: template.useDynamicPricing,

      laborDollars:
        template.laborCents === null
          ? null
          : this.centsToDollars(template.laborCents),

      durationMins: template.durationMins,

      allowInstantConfirmation: template.allowInstantConfirmation,
      requiresManualReview: template.requiresManualReview,
    });
  }

  cancelTemplateEdit(): void {
    this.startNewTemplate();
  }

  saveTemplate(): void {
    if (this.templateForm.invalid) {
      this.templateForm.markAllAsTouched();
      return;
    }

    const raw = this.templateForm.getRawValue();

    const body: RepairPricingTemplateCreate = {
      repairNeedId: String(raw.repairNeedId ?? '').trim(),

      name: String(raw.name ?? '').trim(),
      isActive: Boolean(raw.isActive),
      sortOrder: Number(raw.sortOrder ?? 0),

      category: this.nullableTrim(raw.category),
      brand: this.nullableTrim(raw.brand),
      model: this.nullableTrim(raw.model),
      techspecsProductId: this.nullableTrim(raw.techspecsProductId),

      serviceId: this.nullableTrim(raw.serviceId),
      productId: this.nullableTrim(raw.productId),

      fixedPriceCents:
        raw.fixedPriceDollars === null || raw.fixedPriceDollars === undefined
          ? null
          : this.dollarsToCents(raw.fixedPriceDollars),

      useDynamicPricing: Boolean(raw.useDynamicPricing),

      laborCents:
        raw.laborDollars === null || raw.laborDollars === undefined
          ? null
          : this.dollarsToCents(raw.laborDollars),

      durationMins:
        raw.durationMins === null || raw.durationMins === undefined
          ? null
          : Number(raw.durationMins),

      allowInstantConfirmation: Boolean(raw.allowInstantConfirmation),
      requiresManualReview: Boolean(raw.requiresManualReview),
    };

    const editingId = this.editingTemplateId();

    this.templateBusyId.set(editingId ?? 'new');

    const request$ = editingId
      ? this.bookingApi.updateTemplate(editingId, body)
      : this.bookingApi.createTemplate(body);

    request$.subscribe({
      next: (saved) => {
        const current = this.templates();

        if (editingId) {
          this.templates.set(
            current.map((template) =>
              template.id === saved.id ? saved : template
            )
          );
        } else {
          this.templates.set([...current, saved]);
        }

        this.startNewTemplate();
        this.templateBusyId.set(null);
      },
      error: (err) => {
        console.error(err);
        this.error.set('Could not save pricing template.');
        this.templateBusyId.set(null);
      },
    });
  }

  deactivateTemplate(template: RepairPricingTemplate): void {
    const confirmed = window.confirm(
      `Deactivate "${template.name}"? Customers will stop receiving confirmed pricing from this template.`
    );

    if (!confirmed) return;

    this.templateBusyId.set(template.id);

    this.bookingApi.deactivateTemplate(template.id).subscribe({
      next: (updated) => {
        this.templates.set(
          this.templates().map((item) =>
            item.id === updated.id ? updated : item
          )
        );

        this.templateBusyId.set(null);

        if (this.editingTemplateId() === updated.id) {
          this.startNewTemplate();
        }
      },
      error: (err) => {
        console.error(err);
        this.error.set('Could not deactivate pricing template.');
        this.templateBusyId.set(null);
      },
    });
  }

  templateStatusLabel(template: RepairPricingTemplate): string {
    if (!template.isActive) return 'Inactive';
    if (template.requiresManualReview) return 'Manual review';
    if (template.allowInstantConfirmation) return 'Instant confirm';
    return 'Estimated';
  }

  productLabel(product: Product): string {
    const sku = product.sku ? ` · ${product.sku}` : '';
    const cost =
      product.cost !== null ? ` · Cost ${this.money(product.cost)}` : '';

    return `${product.name}${sku}${cost}`;
  }

  serviceLabel(service: Service): string {
    const duration = service.duration ? ` · ${service.duration} mins` : '';

    return `${service.name} · ${this.money(service.price)}${duration}`;
  }

  money(cents: number | null | undefined): string {
    if (cents === null || cents === undefined) return '—';

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  }

  minutesToTime(value: number | null | undefined): string {
    if (value === null || value === undefined) return '';

    const hours = Math.floor(value / 60);
    const minutes = value % 60;

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(
      2,
      '0'
    )}`;
  }

  copyIframeCode(): void {
    const code = this.iframeCode();

    if (!code || typeof navigator === 'undefined' || !navigator.clipboard) {
      return;
    }

    navigator.clipboard.writeText(code).catch((err) => {
      console.error('Could not copy iframe code.', err);
    });
  }

  private publicAppOrigin(): string {
    if (typeof window === 'undefined' || !window.location?.origin) {
      return 'https://app.opscend.com';
    }

    return window.location.origin.replace(/\/$/, '');
  }

  private patchSettingsForm(settings: BookingSettings): void {
    this.settingsForm.patchValue({
      enabled: settings.enabled,
      embedEnabled: settings.embedEnabled,

      defaultMarkupMultiplier: Number(settings.defaultMarkupMultiplier),
      defaultLaborDollars: this.centsToDollars(settings.defaultLaborCents),
      roundingMode: settings.roundingMode,

      publicCatalogCategories: (
        settings.publicCatalogCategories ?? []
      ).join('\n'),

      minimumRetailDollars:
        settings.minimumRetailCents === null
          ? null
          : this.centsToDollars(settings.minimumRetailCents),

      maximumRetailDollars:
        settings.maximumRetailCents === null
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

  private timeToMinutes(value: string | null | undefined): number | null {
    if (!value) return null;

    const [hoursRaw, minutesRaw] = value.split(':');
    const hours = Number(hoursRaw);
    const minutes = Number(minutesRaw);

    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;

    return hours * 60 + minutes;
  }

  private dollarsToCents(value: number | string | null | undefined): number {
    const n = Number(value ?? 0);

    return Math.round(n * 100);
  }

  private centsToDollars(value: number): number {
    return Math.round(value) / 100;
  }

  private nullableTrim(value: string | null | undefined): string | null {
    const trimmed = String(value ?? '').trim();

    return trimmed.length ? trimmed : null;
  }

  private commaListToArray(value: string | null | undefined): string[] {
    return String(value ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private linesToArray(value: string | null | undefined): string[] {
    return String(value ?? '')
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private getNextRepairNeedSortOrder(): number {
    const max = this.repairNeeds().reduce(
      (current, need) => Math.max(current, need.sortOrder),
      0
    );

    return max + 10;
  }

  private getNextTemplateSortOrder(): number {
    const max = this.templates().reduce(
      (current, template) => Math.max(current, template.sortOrder),
      0
    );

    return max + 10;
  }
}