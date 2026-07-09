import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  ArrowLeft,
  BatteryCharging,
  CalendarDays,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Cpu,
  Gamepad2,
  Home,
  Laptop,
  Loader2,
  LucideAngularModule,
  Mail,
  MapPin,
  Monitor,
  PackageCheck,
  Phone,
  Plug,
  Search,
  SearchX,
  ShieldCheck,
  Smartphone,
  Store,
  Tablet,
  User,
  Watch,
  Wrench,
} from 'lucide-angular';
import { debounceTime, distinctUntilChanged, firstValueFrom } from 'rxjs';

import { PublicBookingService } from '../../../core/public-booking/service';
import {
  PublicAvailabilitySlot,
  PublicBookingSettings,
  PublicDeviceModelOption,
  PublicRepairNeed,
  PublicRepairQuote,
  PublicScheduleResponse,
  PublicQuoteRequestResponse,
} from '../../../core/public-booking/model';

type BookingStep =
  | 'category'
  | 'brand'
  | 'model'
  | 'repair'
  | 'location'
  | 'quote'
  | 'quoteRequest'
  | 'schedule'
  | 'confirm';

type PublicCalendarDay = {
  dateKey: string;
  dayNumber: number;
  inCurrentMonth: boolean;
  isAvailable: boolean;
  isSelected: boolean;
  isToday: boolean;
};

const PAGE_SIZE = 50;
const LOCAL_DISPLAY_INCREMENT = 5;

const TECHSPECS_CATEGORY_ORDER = [
  'Smartphones',
  'Tablets',
  'Smartwatches',
  'Laptops',
  'Desktops',
  'Displays',
  'GPUs',
];

const TECHSPECS_CATEGORY_KEYS = new Set(
  TECHSPECS_CATEGORY_ORDER.map((category) =>
    category.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  )
);

const PUBLIC_POPULAR_BRANDS_BY_CATEGORY: Record<string, string[]> = {
  smartphones: [
    'Apple',
    'Samsung',
    'Google',
    'Motorola',
    'OnePlus',
    'LG',
    'Sony',
    'Nokia',
    'TCL',
    'Alcatel',
    'ZTE',
    'Asus',
  ],
  tablets: ['Apple', 'Samsung', 'Amazon', 'Lenovo', 'Microsoft', 'Google'],
  smartwatches: ['Apple', 'Samsung', 'Google', 'Garmin', 'Fitbit', 'Fossil'],
  laptops: ['Apple', 'Dell', 'HP', 'Lenovo', 'Microsoft', 'Asus', 'Acer'],
  default: ['Apple', 'Samsung', 'Google', 'Motorola', 'OnePlus'],
};


@Component({
  selector: 'app-public-booking-page',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, ReactiveFormsModule],
  templateUrl: './public-booking.html',
})
export class PublicBooking {
  private readonly route = inject(ActivatedRoute);
  private readonly bookingService = inject(PublicBookingService);

  readonly icons = {
    ArrowLeft,
    BatteryCharging,
    CalendarDays,
    Camera,
    Check,
    CheckCircle2,
    ChevronRight,
    Clock3,
    Cpu,
    Gamepad2,
    Home,
    Laptop,
    Loader2,
    Mail,
    MapPin,
    Monitor,
    PackageCheck,
    Phone,
    Plug,
    Search,
    SearchX,
    ShieldCheck,
    Smartphone,
    Store,
    Tablet,
    User,
    Watch,
    Wrench,
  };

  readonly isBusy = computed(() => {
    return (
      this.categoriesLoading() ||
      this.brandsLoading() ||
      this.modelsLoading() ||
      this.quoting() ||
      this.availabilityLoading() ||
      this.scheduling() ||
      this.quoteRequestSubmitting()
    );
  });

  readonly busyMessage = computed(() => {
    if (this.brandsLoading()) return 'Loading brands...';
    if (this.modelsLoading()) return 'Loading models...';
    if (this.quoting()) return 'Building your quote...';
    if (this.availabilityLoading()) return 'Checking appointment times...';
    if (this.scheduling()) return 'Scheduling your repair...';
    if (this.quoteRequestSubmitting()) return 'Sending your request...';
    if (this.categoriesLoading()) return 'Loading options...';

    return 'Working...';
  });

  readonly shopSlug = signal<string | null>(null);


  shopName(): string {
    return this.settings()?.shop?.name?.trim() || 'Shop';
  }

  shopLogoUrl(): string | null {
    const value = this.settings()?.shop?.logoUrl?.trim();

    return value || null;
  }

  shopInitials(): string {
    const name = this.shopName();
    const initials = name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');

    return initials || 'S';
  }

  brandColor(): string {
    return this.normalizeHexColor(this.settings()?.shop?.primaryColor) ?? '#030712';
  }

  brandSoftColor(): string {
    return this.mixHexColors(this.brandColor(), '#000000', 0.14);
  }

  brandTintColor(): string {
    return this.mixHexColors(this.brandColor(), '#ffffff', 0.92);
  }

  brandTintStrongColor(): string {
    return this.mixHexColors(this.brandColor(), '#ffffff', 0.82);
  }

  brandRingColor(): string {
    const rgb = this.hexToRgb(this.brandColor());

    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.22)`;
  }

  brandContrastColor(): string {
    const rgb = this.hexToRgb(this.brandColor());
    const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;

    return luminance > 0.66 ? '#030712' : '#ffffff';
  }

  shopAddressLines(): string[] {
    const shop = this.settings()?.shop;

    if (!shop) return [];

    const line1 = [shop.addressLine1, shop.addressLine2]
      .filter(Boolean)
      .join(', ');

    const line2 = [
      shop.addressCity,
      shop.addressState,
      shop.addressPostalCode,
    ]
      .filter(Boolean)
      .join(', ');

    return [line1, line2].filter(Boolean);
  }

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly categoriesLoading = signal(false);
  readonly brandsLoading = signal(false);
  readonly modelsLoading = signal(false);
  readonly quoting = signal(false);
  readonly availabilityLoading = signal(false);
  readonly scheduling = signal(false);
  readonly quoteRequestSubmitting = signal(false);

  readonly settings = signal<PublicBookingSettings | null>(null);

  readonly categories = signal<string[]>([]);
  readonly categoryPage = signal(0);
  readonly categoryTotalPages = signal(1);

  readonly brands = signal<string[]>([]);
  readonly brandPage = signal(0);
  readonly brandTotalPages = signal(1);

  readonly models = signal<PublicDeviceModelOption[]>([]);
  readonly modelPage = signal(0);
  readonly modelTotalPages = signal(1);

  readonly repairNeeds = signal<PublicRepairNeed[]>([]);

  readonly selectedCategory = signal<string | null>(null);
  readonly selectedBrand = signal<string | null>(null);
  readonly selectedModel = signal<PublicDeviceModelOption | null>(null);
  readonly selectedRepairNeed = signal<PublicRepairNeed | null>(null);
  readonly serviceMode = signal<'on_site' | 'in_shop'>('on_site');

  readonly quote = signal<PublicRepairQuote | null>(null);
  readonly slots = signal<PublicAvailabilitySlot[]>([]);
  readonly selectedSlotKey = signal<string | null>(null);
  readonly selectedDate = signal<string | null>(null);
  readonly visibleMonth = signal(this.startOfMonth(new Date()));
  readonly confirmation = signal<PublicScheduleResponse | PublicQuoteRequestResponse | null>(null);

  readonly activeStep = signal<BookingStep>('category');

  readonly scheduleForm = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    phone: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    line1: new FormControl('', {
      nonNullable: true,
    }),
    line2: new FormControl('', {
      nonNullable: true,
    }),
    city: new FormControl('', {
      nonNullable: true,
    }),
    state: new FormControl('MO', {
      nonNullable: true,
    }),
    postalCode: new FormControl('', {
      nonNullable: true,
    }),
    notes: new FormControl('', {
      nonNullable: true,
    }),
  });

  readonly brandSearch = new FormControl('', {
    nonNullable: true,
  });

  readonly modelSearch = new FormControl('', {
    nonNullable: true,
  });

  readonly brandSearchTerm = signal('');
  readonly modelSearchTerm = signal('');

  readonly brandVisibleCount = signal(LOCAL_DISPLAY_INCREMENT);
  readonly modelVisibleCount = signal(LOCAL_DISPLAY_INCREMENT);

  readonly selectedSlot = computed(() => {
    const key = this.selectedSlotKey();

    if (!key) return null;

    return this.slots().find((slot) => this.slotKey(slot) === key) ?? null;
  });

  readonly groupedSlots = computed(() => {
    const groups = new Map<string, PublicAvailabilitySlot[]>();

    for (const slot of this.slots()) {
      const key = this.dateLabel(slot.startAt);

      if (!groups.has(key)) {
        groups.set(key, []);
      }

      groups.get(key)?.push(slot);
    }

    return Array.from(groups.entries()).map(([label, slots]) => ({
      label,
      slots,
    }));
  });

  readonly slotsByDate = computed(() => {
    const grouped: Record<string, PublicAvailabilitySlot[]> = {};

    for (const slot of this.slots()) {
      const dateKey = this.toDateKey(slot.startAt);

      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }

      grouped[dateKey].push(slot);
    }

    return Object.entries(grouped)
      .map(([date, slots]) => ({
        date,
        slots: [...slots].sort(
          (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
        ),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  });

  readonly availableDates = computed(() => {
    return this.slotsByDate()
      .map((group) => {
        const validSlots = group.slots.filter((slot) => !this.isPastSlot(slot.startAt));

        return {
          date: group.date,
          count: validSlots.length,
        };
      })
      .filter((group) => group.count > 0);
  });

  readonly availableDateSet = computed(() => {
    return new Set(this.availableDates().map((item) => item.date));
  });

  readonly selectedDateSlots = computed(() => {
    const date = this.selectedDate();

    if (!date) return [];

    const group = this.slotsByDate().find((item) => item.date === date);

    if (!group) return [];

    return group.slots.filter((slot) => !this.isPastSlot(slot.startAt));
  });

  readonly visibleMonthLabel = computed(() => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      year: 'numeric',
    }).format(this.visibleMonth());
  });

  readonly calendarDays = computed((): PublicCalendarDay[] => {
    const month = this.visibleMonth();
    const firstDay = this.startOfMonth(month);
    const start = new Date(firstDay);
    start.setDate(firstDay.getDate() - firstDay.getDay());

    const todayKey = this.toDateKey(new Date());
    const selected = this.selectedDate();
    const availableDates = this.availableDateSet();
    const days: PublicCalendarDay[] = [];

    for (let index = 0; index < 42; index += 1) {
      const date = new Date(start);
      date.setDate(start.getDate() + index);

      const dateKey = this.toDateKey(date);

      days.push({
        dateKey,
        dayNumber: date.getDate(),
        inCurrentMonth: date.getMonth() === month.getMonth(),
        isAvailable: availableDates.has(dateKey),
        isSelected: selected === dateKey,
        isToday: todayKey === dateKey,
      });
    }

    return days;
  });

  readonly appointmentSummary = computed(() => {
    const slot = this.selectedSlot();

    if (!slot) return null;

    return `${this.dateLabel(slot.startAt)} at ${this.timeLabel(slot.startAt)}`;
  });

  readonly canLoadMoreCategories = computed(
    () => this.categoryPage() + 1 < this.categoryTotalPages()
  );

  readonly visibleCategories = computed(() => {
    const seen = new Set<string>();

    return this.categories()
      .filter((category) => this.isSupportedTechSpecsCategory(category))
      .sort((a, b) => {
        const aIndex = this.techSpecsCategorySortIndex(a);
        const bIndex = this.techSpecsCategorySortIndex(b);

        if (aIndex !== bIndex) return aIndex - bIndex;

        return a.localeCompare(b);
      })
      .filter((category) => {
        const key = this.normalizeSearch(category);

        if (seen.has(key)) return false;

        seen.add(key);
        return true;
      });
  });

  readonly canLoadMoreBrands = computed(
    () => this.brandPage() + 1 < this.brandTotalPages()
  );

  readonly canLoadMoreModels = computed(
    () => this.modelPage() + 1 < this.modelTotalPages()
  );

  readonly filteredBrands = computed(() => {
    const search = this.normalizeSearch(this.brandSearchTerm());

    if (!search) return this.popularBrandsForSelectedCategory();

    return this.publicBrandCandidates()
      .filter((brand) => this.normalizeSearch(brand).includes(search))
      .sort((a, b) => {
        const aIndex = this.publicBrandSortIndex(a);
        const bIndex = this.publicBrandSortIndex(b);

        if (aIndex !== bIndex) return aIndex - bIndex;

        return a.localeCompare(b, undefined, {
          numeric: true,
          sensitivity: 'base',
        });
      });
  });

  readonly visibleBrands = computed(() =>
    this.filteredBrands().slice(0, this.brandVisibleCount())
  );

  readonly filteredModels = computed(() => {
    const search = this.normalizeSearch(this.modelSearchTerm());

    if (!search) return this.models();

    return this.models().filter((model) =>
      this.normalizeSearch(model.model).includes(search)
    );
  });

  readonly visibleModels = computed(() =>
    this.filteredModels().slice(0, this.modelVisibleCount())
  );

  readonly canShowMoreBrands = computed(() => {
    const hasMoreLocalBrands = this.brandVisibleCount() < this.filteredBrands().length;
    const search = this.normalizeSearch(this.brandSearchTerm());

    return hasMoreLocalBrands || (!!search && this.canLoadMoreBrands());
  });

  readonly canShowMoreModels = computed(() => {
    return (
      this.modelVisibleCount() < this.filteredModels().length ||
      this.canLoadMoreModels()
    );
  });

  readonly stepNumber = computed(() => {
    switch (this.activeStep()) {
      case 'category':
        return 1;
      case 'brand':
        return 2;
      case 'model':
        return 3;
      case 'repair':
        return 4;
      case 'location':
        return 5;
      case 'quote':
      case 'quoteRequest':
        return 6;
      case 'schedule':
        return 7;
      case 'confirm':
        return 8;
      default:
        return 1;
    }
  });

  stepLabel(): string {
    switch (this.activeStep()) {
      case 'category':
        return 'Device';
      case 'brand':
        return 'Brand';
      case 'model':
        return 'Model';
      case 'repair':
        return 'Repair';
      case 'location':
        return 'Location';
      case 'quote':
        return 'Quote';
      case 'quoteRequest':
        return 'Request';
      case 'schedule':
        return 'Details';
      case 'confirm':
        return 'Complete';
      default:
        return 'In progress';
    }
  }

  readonly progressPercent = computed(() => `${(this.stepNumber() / 8) * 100}%`);

  async ngOnInit(): Promise<void> {
    const slug = this.route.snapshot.paramMap.get('shopSlug');

    if (!slug) {
      this.loading.set(false);
      this.error.set('booking_not_found');
      return;
    }

    this.shopSlug.set(slug);
    this.syncAddressValidators();
    this.bindSearchControls();

    await this.loadInitialData();
  }

  async loadInitialData(): Promise<void> {
    const slug = this.shopSlug();

    if (!slug) return;

    this.loading.set(true);
    this.error.set(null);

    try {
      const [settings, categories, repairNeeds] = await Promise.all([
        firstValueFrom(this.bookingService.getSettings(slug)),
        firstValueFrom(this.bookingService.listCategories(slug, 0, PAGE_SIZE)),
        firstValueFrom(this.bookingService.listRepairNeeds(slug)),
      ]);

      this.settings.set(settings);
      this.categories.set(categories.items ?? []);
      this.categoryPage.set(categories.page ?? 0);
      this.categoryTotalPages.set(categories.totalPages ?? 1);
      this.repairNeeds.set(repairNeeds.data ?? []);

      if (!settings.enabled) {
        this.error.set('booking_disabled');
        return;
      }

      this.activeStep.set('category');
    } catch (error) {
      console.error(error);
      this.error.set('booking_load_failed');
    } finally {
      this.loading.set(false);
    }
  }

  async loadMoreCategories(): Promise<void> {
    const slug = this.shopSlug();

    if (!slug || !this.canLoadMoreCategories()) return;

    this.categoriesLoading.set(true);
    this.error.set(null);

    try {
      const nextPage = this.categoryPage() + 1;

      const response = await firstValueFrom(
        this.bookingService.listCategories(slug, nextPage, PAGE_SIZE)
      );

      this.categories.set([...this.categories(), ...(response.items ?? [])]);
      this.categoryPage.set(response.page ?? nextPage);
      this.categoryTotalPages.set(
        response.totalPages ?? this.categoryTotalPages()
      );
    } catch (error) {
      console.error(error);
      this.error.set('categories_load_failed');
    } finally {
      this.categoriesLoading.set(false);
    }
  }

  async chooseCategory(category: string): Promise<void> {
    this.selectedCategory.set(category);
    this.selectedBrand.set(null);
    this.selectedModel.set(null);
    this.selectedRepairNeed.set(null);
    this.quote.set(null);
    this.slots.set([]);
    this.selectedSlotKey.set(null);
    this.confirmation.set(null);

    this.brandSearch.setValue('', { emitEvent: false });
    this.modelSearch.setValue('', { emitEvent: false });
    this.brandSearchTerm.set('');
    this.modelSearchTerm.set('');

    this.brandVisibleCount.set(LOCAL_DISPLAY_INCREMENT);
    this.modelVisibleCount.set(LOCAL_DISPLAY_INCREMENT);

    this.brands.set([]);
    this.brandPage.set(0);
    this.brandTotalPages.set(1);

    await this.loadBrands(0);
    this.activeStep.set('brand');
  }

  async loadBrands(page: number): Promise<void> {
    const slug = this.shopSlug();
    const category = this.selectedCategory();

    if (!slug || !category) return;

    this.brandsLoading.set(true);
    this.error.set(null);

    try {
      const response = await firstValueFrom(
        this.bookingService.listBrands(slug, category, page, PAGE_SIZE)
      );

      this.brands.set(
        page === 0
          ? response.items ?? []
          : [...this.brands(), ...(response.items ?? [])]
      );
      this.brandPage.set(response.page ?? page);
      this.brandTotalPages.set(response.totalPages ?? 1);
    } catch (error) {
      console.error(error);
      this.error.set('brands_load_failed');
    } finally {
      this.brandsLoading.set(false);
    }
  }

  async loadMoreBrands(): Promise<void> {
    if (!this.canLoadMoreBrands()) return;

    await this.loadBrands(this.brandPage() + 1);
  }

  async showMoreBrands(): Promise<void> {
    if (this.brandVisibleCount() < this.filteredBrands().length) {
      this.brandVisibleCount.update((value) => value + LOCAL_DISPLAY_INCREMENT);
      return;
    }

    const search = this.normalizeSearch(this.brandSearchTerm());

    if (search && this.canLoadMoreBrands()) {
      await this.loadMoreBrands();
      this.brandVisibleCount.update((value) => value + LOCAL_DISPLAY_INCREMENT);
    }
  }

  async chooseBrand(brand: string): Promise<void> {
    this.selectedBrand.set(brand);
    this.selectedModel.set(null);
    this.selectedRepairNeed.set(null);
    this.quote.set(null);
    this.slots.set([]);
    this.selectedSlotKey.set(null);
    this.confirmation.set(null);

    this.modelSearch.setValue('', { emitEvent: false });
    this.modelSearchTerm.set('');
    this.modelVisibleCount.set(LOCAL_DISPLAY_INCREMENT);

    this.models.set([]);
    this.modelPage.set(0);
    this.modelTotalPages.set(1);

    await this.loadModels(0);
    this.activeStep.set('model');
  }

  async loadModels(page: number): Promise<void> {
    const slug = this.shopSlug();
    const category = this.selectedCategory();
    const brand = this.selectedBrand();

    if (!slug || !category || !brand) return;

    this.modelsLoading.set(true);
    this.error.set(null);

    try {
      const response = await firstValueFrom(
        this.bookingService.listModels(slug, {
          category,
          brand,
          page,
          size: PAGE_SIZE,
          keepCasing: true,
        })
      );

      this.models.set(
        page === 0
          ? response.items ?? []
          : [...this.models(), ...(response.items ?? [])]
      );
      this.modelPage.set(response.page ?? page);
      this.modelTotalPages.set(response.totalPages ?? 1);
    } catch (error) {
      console.error(error);
      this.error.set('models_load_failed');
    } finally {
      this.modelsLoading.set(false);
    }
  }

  async loadMoreModels(): Promise<void> {
    if (!this.canLoadMoreModels()) return;

    await this.loadModels(this.modelPage() + 1);
  }

  async showMoreModels(): Promise<void> {
    if (this.modelVisibleCount() < this.filteredModels().length) {
      this.modelVisibleCount.update((value) => value + LOCAL_DISPLAY_INCREMENT);
      return;
    }

    if (this.canLoadMoreModels()) {
      await this.loadMoreModels();
      this.modelVisibleCount.update((value) => value + LOCAL_DISPLAY_INCREMENT);
    }
  }

  chooseModel(model: PublicDeviceModelOption): void {
    this.selectedModel.set(model);
    this.selectedRepairNeed.set(null);
    this.quote.set(null);
    this.slots.set([]);
    this.selectedSlotKey.set(null);
    this.confirmation.set(null);
    this.activeStep.set('repair');
  }

  chooseRepairNeed(need: PublicRepairNeed): void {
    this.selectedRepairNeed.set(need);
    this.error.set(null);
  }

  goToLocation(): void {
    if (!this.selectedRepairNeed()) {
      this.error.set('repair_need_required');
      return;
    }

    this.error.set(null);
    this.activeStep.set('location');
  }

  setServiceMode(mode: 'on_site' | 'in_shop'): void {
    this.serviceMode.set(mode);
    this.syncAddressValidators();
    this.error.set(null);
  }

  async continueFromLocation(): Promise<void> {
    this.syncAddressValidators();

    if (this.serviceMode() === 'on_site') {
      const addressControls = [
        this.scheduleForm.controls.line1,
        this.scheduleForm.controls.city,
        this.scheduleForm.controls.state,
        this.scheduleForm.controls.postalCode,
      ];

      const addressInvalid = addressControls.some((control) => control.invalid);

      if (addressInvalid) {
        for (const control of addressControls) {
          control.markAsTouched();
        }

        this.error.set('service_address_required');
        return;
      }
    }

    this.error.set(null);
    await this.createQuote();
  }

  async createQuote(): Promise<void> {
    const slug = this.shopSlug();
    const category = this.selectedCategory();
    const brand = this.selectedBrand();
    const model = this.selectedModel();
    const repairNeed = this.selectedRepairNeed();

    if (!slug || !category || !brand || !model || !repairNeed) {
      this.error.set('repair_selection_missing');
      return;
    }

    this.quoting.set(true);
    this.error.set(null);
    this.quote.set(null);
    this.slots.set([]);
    this.selectedSlotKey.set(null);
    this.confirmation.set(null);

    try {
      const quote = await firstValueFrom(
        this.bookingService.createQuote(slug, {
          category,
          brand: model.brand,
          model: model.model,
          techspecsProductId: model.techspecsProductId,
          repairNeedId: repairNeed.id,
          serviceMode: this.serviceMode(),
        })
      );

      this.quote.set(quote);

      if (this.canScheduleQuote(quote)) {
        this.activeStep.set('quote');
        await this.loadAvailability();
      } else {
        this.activeStep.set('quoteRequest');
      }
    } catch (error) {
      console.error(error);
      this.error.set('quote_failed');
    } finally {
      this.quoting.set(false);
    }
  }

  async loadAvailability(): Promise<void> {
    const slug = this.shopSlug();
    const quote = this.quote();

    if (!slug || !quote) return;

    this.availabilityLoading.set(true);
    this.error.set(null);

    try {
      const response = await firstValueFrom(
        this.bookingService.getAvailability(slug, {
          quoteId: quote.quoteId,
          days: 14,
          slotMinutes: quote.durationMins,
        })
      );

      this.slots.set(response.data ?? []);
      this.initializeSelectedDate();
    } catch (error) {
      console.error(error);
      this.error.set('availability_failed');
    } finally {
      this.availabilityLoading.set(false);
    }
  }

  canScheduleQuote(quote: PublicRepairQuote | null | undefined): boolean {
    return Boolean(
      quote &&
        quote.canSchedule === true &&
        quote.confidence === 'template_confirmed' &&
        quote.requiresManualReview === false &&
        quote.estimatedTotalCents !== null &&
        quote.estimatedTotalCents > 0
    );
  }

  async submitQuoteRequest(): Promise<void> {
    const slug = this.shopSlug();
    const quote = this.quote();

    if (!slug || !quote) {
      this.error.set('quote_request_missing');
      return;
    }

    const contactControls = [
      this.scheduleForm.controls.name,
      this.scheduleForm.controls.email,
      this.scheduleForm.controls.phone,
    ];

    for (const control of contactControls) {
      control.markAsTouched();
    }

    if (contactControls.some((control) => control.invalid)) {
      this.error.set('contact_required');
      return;
    }

    this.quoteRequestSubmitting.set(true);
    this.error.set(null);

    try {
      const response = await firstValueFrom(
        this.bookingService.submitQuoteRequest(slug, {
          quoteId: quote.quoteId,
          customer: {
            name: this.scheduleForm.controls.name.value,
            email: this.scheduleForm.controls.email.value,
            phone: this.scheduleForm.controls.phone.value,
          },
          address:
            this.serviceMode() === 'on_site'
              ? {
                  label: 'Service address',
                  line1: this.scheduleForm.controls.line1.value,
                  line2: this.scheduleForm.controls.line2.value,
                  city: this.scheduleForm.controls.city.value,
                  state: this.scheduleForm.controls.state.value,
                  postalCode: this.scheduleForm.controls.postalCode.value,
                  country: 'US',
                }
              : undefined,
          notes: this.scheduleForm.controls.notes.value,
        })
      );

      this.confirmation.set(response);
      this.activeStep.set('confirm');
    } catch (error) {
      console.error(error);
      this.error.set('quote_request_failed');
    } finally {
      this.quoteRequestSubmitting.set(false);
    }
  }

  selectSlot(slot: PublicAvailabilitySlot): void {
    this.selectedSlotKey.set(this.slotKey(slot));
    this.selectedDate.set(this.toDateKey(slot.startAt));
    this.error.set(null);
  }

  selectDate(dateKey: string): void {
    if (!this.availableDateSet().has(dateKey)) return;

    this.selectedDate.set(dateKey);

    const selectedSlot = this.selectedSlot();

    if (selectedSlot && this.toDateKey(selectedSlot.startAt) !== dateKey) {
      this.selectedSlotKey.set(null);
    }
  }

  previousMonth(): void {
    const next = new Date(this.visibleMonth());
    next.setMonth(next.getMonth() - 1);
    this.visibleMonth.set(this.startOfMonth(next));
  }

  nextMonth(): void {
    const next = new Date(this.visibleMonth());
    next.setMonth(next.getMonth() + 1);
    this.visibleMonth.set(this.startOfMonth(next));
  }

  selectedDateLabel(): string {
    const selectedDate = this.selectedDate();

    if (!selectedDate) return 'Select a date';

    return this.formatCalendarDateLabel(selectedDate);
  }


  goBack(): void {
    this.error.set(null);

    switch (this.activeStep()) {
      case 'brand':
        this.activeStep.set('category');
        return;
      case 'model':
        this.activeStep.set('brand');
        return;
      case 'repair':
        this.activeStep.set('model');
        return;
      case 'location':
        this.activeStep.set('repair');
        return;
      case 'quote':
      case 'quoteRequest':
        this.activeStep.set('location');
        return;
      case 'schedule':
        this.activeStep.set('quote');
        return;
      default:
        return;
    }
  }

  goToSchedule(): void {
    if (!this.selectedSlot()) {
      this.error.set('slot_required');
      return;
    }

    this.error.set(null);
    this.activeStep.set('schedule');
  }

  async scheduleRepair(): Promise<void> {
    const slug = this.shopSlug();
    const quote = this.quote();
    const slot = this.selectedSlot();

    if (!slug || !quote || !slot) {
      this.error.set('schedule_missing_data');
      return;
    }

    if (this.scheduleForm.invalid) {
      this.scheduleForm.markAllAsTouched();
      return;
    }

    this.scheduling.set(true);
    this.error.set(null);

    try {
      const response = await firstValueFrom(
        this.bookingService.schedule(slug, {
          quoteId: quote.quoteId,

          startAt: slot.startAt,
          endAt: slot.endAt,

          candidateType: slot.candidateType as any,
          assignedUserId: slot.assignedUserId,
          contractorId: slot.contractorId,

          customer: {
            name: this.scheduleForm.controls.name.value,
            email: this.scheduleForm.controls.email.value,
            phone: this.scheduleForm.controls.phone.value,
          },

          address:
            this.serviceMode() === 'on_site'
              ? {
                label: 'Service address',
                line1: this.scheduleForm.controls.line1.value,
                line2: this.scheduleForm.controls.line2.value,
                city: this.scheduleForm.controls.city.value,
                state: this.scheduleForm.controls.state.value,
                postalCode: this.scheduleForm.controls.postalCode.value,
                country: 'US',
              }
              : undefined,

          notes: this.scheduleForm.controls.notes.value,
        })
      );

      this.confirmation.set(response);
      this.activeStep.set('confirm');
    } catch (error) {
      console.error(error);
      this.error.set('schedule_failed');
    } finally {
      this.scheduling.set(false);
    }
  }

  private initializeSelectedDate(): void {
    const firstAvailableDate = this.availableDates()[0]?.date ?? null;

    this.selectedSlotKey.set(null);
    this.selectedDate.set(firstAvailableDate);

    if (firstAvailableDate) {
      this.visibleMonth.set(this.startOfMonth(new Date(`${firstAvailableDate}T00:00:00`)));
    } else {
      this.visibleMonth.set(this.startOfMonth(new Date()));
    }
  }

  isPastSlot(value: string): boolean {
    return new Date(value).getTime() < Date.now();
  }

  formatCalendarDateLabel(dateKey: string): string {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }).format(new Date(`${dateKey}T00:00:00`));
  }

  toDateKey(value: string | Date): string {
    const date = value instanceof Date ? value : new Date(value);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  private startOfMonth(value: Date): Date {
    return new Date(value.getFullYear(), value.getMonth(), 1);
  }

  slotKey(slot: PublicAvailabilitySlot): string {
    return [
      slot.startAt,
      slot.endAt,
      slot.candidateType,
      slot.assignedUserId ?? '',
      slot.contractorId ?? '',
    ].join('|');
  }

  selectionSummary(): string {
    return [
      this.selectedCategory(),
      this.selectedBrand(),
      this.selectedModel()?.model,
      this.selectedRepairNeed()?.label,
      this.locationSummary(),
    ]
      .filter(Boolean)
      .join(' · ');
  }

  locationSummary(): string | null {
    if (!this.selectedRepairNeed()) return null;

    if (this.serviceMode() === 'in_shop') {
      return 'Meetup / in-shop';
    }

    const city = this.scheduleForm.controls.city.value;
    const state = this.scheduleForm.controls.state.value;

    if (city && state) return `On-site in ${city}, ${state}`;

    return 'On-site';
  }

  serviceModeTitle(): string {
    return this.serviceMode() === 'on_site' ? 'On-site repair' : 'Meetup / in-shop';
  }

  addressSummary(): string {
    const line1 = this.scheduleForm.controls.line1.value;
    const line2 = this.scheduleForm.controls.line2.value;
    const city = this.scheduleForm.controls.city.value;
    const state = this.scheduleForm.controls.state.value;
    const postalCode = this.scheduleForm.controls.postalCode.value;

    return [
      [line1, line2].filter(Boolean).join(', '),
      [city, state].filter(Boolean).join(', '),
      postalCode,
    ]
      .filter(Boolean)
      .join(' · ');
  }

  quoteToneClass(quote: PublicRepairQuote): string {
    if (quote.requiresManualReview || quote.confidence === 'manual_review') {
      return 'border-amber-200 bg-amber-50';
    }

    if (quote.confidence === 'template_confirmed') {
      return 'border-emerald-200 bg-emerald-50';
    }

    return 'border-orange-200 bg-orange-50';
  }

  quoteIconClass(quote: PublicRepairQuote): string {
    if (quote.requiresManualReview || quote.confidence === 'manual_review') {
      return 'text-amber-600';
    }

    if (quote.confidence === 'template_confirmed') {
      return 'text-emerald-600';
    }

    return 'text-orange-600';
  }

  quoteEyebrow(quote: PublicRepairQuote): string {
    if (quote.requiresManualReview || quote.confidence === 'manual_review') {
      return 'Manual Review';
    }

    if (quote.confidence === 'template_confirmed') {
      return 'Confirmed Pricing';
    }

    return 'Estimated Pricing';
  }

  confirmationTitle(): string {
    const quote = this.quote();

    if (this.canScheduleQuote(quote)) {
      return 'Your repair is scheduled.';
    }

    return 'Your quote request was received.';
  }

  confirmationNextSteps(): string {
    const quote = this.quote();

    if (this.canScheduleQuote(quote)) {
      return 'The shop will contact you if anything changes before your appointment.';
    }

    return 'The shop will review pricing and part availability, then contact you with a quote very soon. For immediate service, call the shop directly.';
  }

  categoryIcon(category: string): any {
    const value = this.normalizeSearch(category);

    if (value === 'smartphones') return Smartphone;
    if (value === 'tablets') return Tablet;
    if (value === 'smartwatches') return Watch;
    if (value === 'laptops') return Laptop;
    if (value === 'desktops') return Monitor;
    if (value === 'displays') return Monitor;
    if (value === 'gpus') return Cpu;

    return Smartphone;
  }

  categorySubtitle(category: string): string {
    const value = this.normalizeSearch(category);

    switch (value) {
      case 'smartphones':
        return 'iPhone, Samsung, Pixel, and more';
      case 'tablets':
        return 'iPad and tablet repairs';
      case 'smartwatches':
        return 'Apple Watch and wearable repairs';
      case 'laptops':
        return 'MacBook, Windows, and Chromebook repairs';
      case 'desktops':
        return 'Desktop computer repair options';
      case 'displays':
        return 'Monitors and display devices';
      case 'gpus':
        return 'Graphics card diagnostics and repair';
      default:
        return 'Choose brand and model next';
    }
  }

  repairIcon(need: PublicRepairNeed): any {
    const value = this.normalizeSearch(need.label);

    if (value.includes('battery')) return BatteryCharging;
    if (value.includes('charge') || value.includes('port')) return Plug;
    if (value.includes('camera')) return Camera;
    if (value.includes('diagnostic') || value.includes('not sure')) return Search;

    return Wrench;
  }

  brandInitial(brand: string): string {
    return brand.trim().slice(0, 1).toUpperCase() || '?';
  }

  money(cents: number | null | undefined): string {
    if (cents === null || cents === undefined) return 'Pending review';

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  }

  dateLabel(value: string): string {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    }).format(new Date(value));
  }

  timeLabel(value: string): string {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value));
  }

  errorTitle(): string {
    switch (this.error()) {
      case 'booking_disabled':
        return 'Online booking is unavailable';
      case 'booking_not_found':
        return 'Booking page not found';
      default:
        return 'Something went wrong';
    }
  }

  errorMessage(): string {
    switch (this.error()) {
      case 'booking_disabled':
        return 'This shop is not currently accepting online repair bookings.';
      case 'booking_not_found':
        return 'This booking link may be invalid, expired, disabled, or no longer available.';
      case 'categories_load_failed':
        return 'Unable to load more categories right now.';
      case 'brands_load_failed':
        return 'Unable to load device brands right now.';
      case 'models_load_failed':
        return 'Unable to load device models right now.';
      case 'repair_need_required':
        return 'Please choose what needs fixed before continuing.';
      case 'service_address_required':
        return 'Please enter the service address for an on-site repair.';
      case 'repair_selection_missing':
        return 'Please finish selecting your repair before continuing.';
      case 'quote_failed':
        return 'Unable to create a quote for this repair. It may require manual review.';
      case 'contact_required':
        return 'Please enter your name, email, and phone number before sending your request.';
      case 'quote_request_missing':
        return 'The quote request is missing required information.';
      case 'quote_request_failed':
        return 'Unable to send this quote request right now.';
      case 'availability_failed':
        return 'Unable to load available appointment times right now.';
      case 'slot_required':
        return 'Please select an appointment time before continuing.';
      case 'schedule_failed':
        return 'Unable to schedule this repair right now.';
      default:
        return 'Please refresh the page or try again shortly.';
    }
  }

  private syncAddressValidators(): void {
    const controls = [
      this.scheduleForm.controls.line1,
      this.scheduleForm.controls.city,
      this.scheduleForm.controls.state,
      this.scheduleForm.controls.postalCode,
    ];

    for (const control of controls) {
      if (this.serviceMode() === 'on_site') {
        control.addValidators(Validators.required);
      } else {
        control.clearValidators();
      }

      control.updateValueAndValidity({ emitEvent: false });
    }
  }

  private bindSearchControls(): void {
    this.brandSearch.valueChanges
      .pipe(debounceTime(250), distinctUntilChanged())
      .subscribe((value) => {
        this.brandSearchTerm.set(value);
        this.brandVisibleCount.set(LOCAL_DISPLAY_INCREMENT);
      });

    this.modelSearch.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe((value) => {
        this.modelSearchTerm.set(value);
        this.modelVisibleCount.set(LOCAL_DISPLAY_INCREMENT);
      });
  }


  private normalizeHexColor(value: string | null | undefined): string | null {
    const trimmed = String(value ?? '').trim();

    if (!trimmed) return null;

    const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;

    if (/^#[0-9a-fA-F]{3}$/.test(withHash)) {
      const [, r, g, b] = withHash;

      return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
    }

    if (/^#[0-9a-fA-F]{6}$/.test(withHash)) {
      return withHash.toUpperCase();
    }

    return null;
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const normalized = this.normalizeHexColor(hex) ?? '#030712';

    return {
      r: Number.parseInt(normalized.slice(1, 3), 16),
      g: Number.parseInt(normalized.slice(3, 5), 16),
      b: Number.parseInt(normalized.slice(5, 7), 16),
    };
  }

  private mixHexColors(source: string, target: string, targetWeight: number): string {
    const from = this.hexToRgb(source);
    const to = this.hexToRgb(target);
    const weight = Math.min(1, Math.max(0, targetWeight));
    const mix = (a: number, b: number) => Math.round(a * (1 - weight) + b * weight);

    return `#${[mix(from.r, to.r), mix(from.g, to.g), mix(from.b, to.b)]
      .map((channel) => channel.toString(16).padStart(2, '0'))
      .join('')}`.toUpperCase();
  }


  private popularBrandsForSelectedCategory(): string[] {
    const category = this.normalizeSearch(this.selectedCategory());
    const brands =
      PUBLIC_POPULAR_BRANDS_BY_CATEGORY[category] ??
      PUBLIC_POPULAR_BRANDS_BY_CATEGORY['default'];

    return this.dedupeBrands(brands);
  }

  private publicBrandCandidates(): string[] {
    return this.dedupeBrands([
      ...this.popularBrandsForSelectedCategory(),
      ...this.brands().filter((brand) => this.isPublicCatalogBrandCandidate(brand)),
    ]);
  }

  private publicBrandSortIndex(brand: string): number {
    const brandKey = this.normalizeSearch(brand);
    const popularBrands = this.popularBrandsForSelectedCategory();
    const index = popularBrands.findIndex(
      (option) => this.normalizeSearch(option) === brandKey
    );

    return index === -1 ? 999 : index;
  }

  private isPublicCatalogBrandCandidate(brand: string): boolean {
    const trimmed = String(brand ?? '').trim();
    const key = this.normalizeSearch(trimmed);

    if (!trimmed || key.length < 2) return false;
    if (!/[a-z]/i.test(trimmed)) return false;
    if (/^\d/.test(trimmed)) return false;
    if (trimmed.length > 40) return false;

    return true;
  }

  private dedupeBrands(brands: string[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];

    for (const brand of brands) {
      const trimmed = String(brand ?? '').trim();
      const key = this.normalizeSearch(trimmed);

      if (!trimmed || seen.has(key)) continue;

      seen.add(key);
      out.push(trimmed);
    }

    return out;
  }

  private isSupportedTechSpecsCategory(category: string): boolean {
    return TECHSPECS_CATEGORY_KEYS.has(this.normalizeSearch(category));
  }

  private techSpecsCategorySortIndex(category: string): number {
    const key = this.normalizeSearch(category);

    const index = TECHSPECS_CATEGORY_ORDER.findIndex(
      (option) => this.normalizeSearch(option) === key
    );

    return index === -1 ? 999 : index;
  }

  private normalizeSearch(value: string | null | undefined): string {
    return String(value ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
