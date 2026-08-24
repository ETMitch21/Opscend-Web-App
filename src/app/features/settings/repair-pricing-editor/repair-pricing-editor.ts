import { CommonModule } from '@angular/common';
import {
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  AlertCircleIcon,
  CheckIcon,
  CopyIcon,
  DollarSignIcon,
  EyeIcon,
  InfoIcon,
  PlusIcon,
  SearchIcon,
  LoaderCircleIcon,
  LucideAngularModule,
  PackageIcon,
  SaveIcon,
  SmartphoneIcon,
  Trash2Icon,
  WrenchIcon,
} from 'lucide-angular';
import {
  Subject,
  Subscription,
  catchError,
  debounceTime,
  distinctUntilChanged,
  finalize,
  firstValueFrom,
  of,
  switchMap,
} from 'rxjs';

import { BookingAdminService } from '../../../core/booking/service';
import { BookingSettings } from '../../../core/booking/model';
import { Product, ProductSupplierLink } from '../../../core/products/products-model';
import { ProductsService } from '../../../core/products/products-service';
import { MobileSentrixService } from '../../../core/mobilesentrix/mobilesentrix-service';
import { MobileSentrixSearchResult } from '../../../core/mobilesentrix/mobilesentrix-model';
import { mapMobileSentrixItems } from '../../../core/mobilesentrix/mobilesentrix-search-mapper';
import {
  PricingOption,
  PricingOptionDepositMode,
  PricingOptionInput,
  RepairType,
} from '../../../core/repair-pricing/model';
import { RepairPricingService } from '../../../core/repair-pricing/service';
import { Service } from '../../../core/services/model';
import { ServicesService } from '../../../core/services/service';
import {
  ManagedDeviceCatalogModel,
  TechSpecsService,
} from '../../../core/techspecs/techspecs.service';
import { ToastService } from '../../../core/toast/toast-service';
import {
  TypeaheadComponent,
  TypeaheadItem,
} from '../../../core/ui/typeahead/typeahead';
import { SettingsLayoutComponent } from '../settings-layout/settings-layout';

type PriceMode = 'fixed' | 'dynamic';

type DepositPreview = {
  mode: Exclude<PricingOptionDepositMode, 'inherit'>;
  amountCents: number | null;
  productCostCents: number | null;
  shippingCents: number;
  processingFeeCents: number;
  instantPayoutFeeCents: number;
  inheritedFrom: 'option' | 'repair_type' | 'shop';
  error: 'missing_product_cost' | 'missing_custom_amount' | null;
};

@Component({
  selector: 'app-repair-pricing-editor',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    LucideAngularModule,
    SettingsLayoutComponent,
    TypeaheadComponent,
  ],
  templateUrl: './repair-pricing-editor.html',
})
export class RepairPricingEditor implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly pricingApi = inject(RepairPricingService);
  private readonly bookingApi = inject(BookingAdminService);
  private readonly catalogApi = inject(TechSpecsService);
  private readonly servicesApi = inject(ServicesService);
  private readonly productsApi = inject(ProductsService);
  private readonly mobileSentrixApi = inject(MobileSentrixService);
  private readonly toast = inject(ToastService);

  readonly icons = {
    Alert: AlertCircleIcon,
    Check: CheckIcon,
    Copy: CopyIcon,
    Dollar: DollarSignIcon,
    Eye: EyeIcon,
    Info: InfoIcon,
    Loader: LoaderCircleIcon,
    Package: PackageIcon,
    Plus: PlusIcon,
    Search: SearchIcon,
    Save: SaveIcon,
    Smartphone: SmartphoneIcon,
    Trash: Trash2Icon,
    Wrench: WrenchIcon,
  };

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly deactivating = signal(false);
  readonly error = signal<string | null>(null);
  readonly connectedSupplierSearchAvailable = signal(false);
  readonly connectedSupplierSearchOpen = signal(false);
  readonly connectedSupplierSearchQuery = signal('');
  readonly connectedSupplierSearchResults = signal<MobileSentrixSearchResult[]>([]);
  readonly connectedSupplierSearchLoading = signal(false);
  readonly supplierImportingId = signal<string | null>(null);
  readonly productSearchQuery = signal('');

  readonly bookingSettings = signal<BookingSettings | null>(null);
  readonly repairTypes = signal<RepairType[]>([]);
  readonly sourceOption = signal<PricingOption | null>(null);

  readonly selectedModel = signal<ManagedDeviceCatalogModel | null>(null);
  readonly selectedRepairType = signal<RepairType | null>(null);
  readonly selectedService = signal<Service | null>(null);
  readonly selectedProduct = signal<Product | null>(null);
  readonly selectedSupplier = signal<ProductSupplierLink | null>(null);

  readonly modelSuggestions = signal<ManagedDeviceCatalogModel[]>([]);
  readonly serviceSuggestions = signal<Service[]>([]);
  readonly productSuggestions = signal<Product[]>([]);

  readonly modelLoading = signal(false);
  readonly serviceLoading = signal(false);
  readonly productLoading = signal(false);
  readonly supplierLoading = signal(false);

  readonly form = this.fb.group({
    deviceCatalogModelId: ['', Validators.required],
    repairNeedId: ['', Validators.required],
    variantName: ['Standard', [Validators.required, Validators.maxLength(120)]],
    description: ['', Validators.maxLength(1000)],
    priceMode: ['fixed' as PriceMode, Validators.required],
    fixedPriceDollars: [null as number | null, Validators.min(0)],
    laborDollars: [null as number | null, Validators.min(0)],
    durationMins: [null as number | null, Validators.min(5)],
    serviceId: [''],
    productId: [''],
    productSupplierId: [''],
    requiresProduct: [true],
    depositMode: ['inherit' as PricingOptionDepositMode, Validators.required],
    depositAmountDollars: [null as number | null, Validators.min(0.01)],
    depositShippingDollars: [null as number | null, Validators.min(0)],
    depositIncludeProcessingFees: [true],
    depositIncludeInstantPayoutFee: [false],
    isActive: [true],
    isPublic: [false],
    allowInstantConfirmation: [true],
    requiresManualReview: [false],
  });

  readonly formValue = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  readonly optionId = this.route.snapshot.paramMap.get('id');
  readonly copyId = this.route.snapshot.queryParamMap.get('copy');
  readonly isEditing = computed(() => Boolean(this.optionId));
  readonly isCopying = computed(() => !this.optionId && Boolean(this.copyId));
  readonly isSetupWorkflow = computed(
    () => this.route.snapshot.queryParamMap.get('view') === 'setup',
  );

  readonly pageTitle = computed(() => {
    if (this.isEditing()) return 'Edit pricing option';
    if (this.isCopying()) return 'Duplicate pricing option';
    return 'New pricing option';
  });

  readonly modelItems = computed<TypeaheadItem[]>(() =>
    this.modelSuggestions().map((model) => this.modelToItem(model)),
  );

  readonly selectedModelItem = computed<TypeaheadItem | null>(() => {
    const model = this.selectedModel();
    return model ? this.modelToItem(model) : null;
  });

  readonly repairTypeItems = computed<TypeaheadItem[]>(() =>
    this.repairTypes()
      .filter((type) => type.isActive || type.id === this.selectedRepairType()?.id)
      .map((type) => this.repairTypeToItem(type)),
  );

  readonly selectedRepairTypeItem = computed<TypeaheadItem | null>(() => {
    const type = this.selectedRepairType();
    return type ? this.repairTypeToItem(type) : null;
  });

  readonly serviceItems = computed<TypeaheadItem[]>(() =>
    this.serviceSuggestions().map((service) => ({
      id: service.id,
      label: service.name,
      description: [service.code, service.duration ? `${service.duration} min` : null]
        .filter(Boolean)
        .join(' · '),
      meta: this.money(service.price),
    })),
  );

  readonly selectedServiceItem = computed<TypeaheadItem | null>(() => {
    const service = this.selectedService();
    if (!service) return null;
    return {
      id: service.id,
      label: service.name,
      description: [service.code, service.duration ? `${service.duration} min` : null]
        .filter(Boolean)
        .join(' · '),
      meta: this.money(service.price),
    };
  });

  readonly productItems = computed<TypeaheadItem[]>(() =>
    this.productSuggestions().map((product) => ({
      id: product.id,
      label: product.name,
      description: product.sku ? `SKU ${product.sku}` : 'No internal SKU',
      meta: this.productCostLabel(product),
    })),
  );

  readonly selectedProductItem = computed<TypeaheadItem | null>(() => {
    const product = this.selectedProduct();
    if (!product) return null;
    return {
      id: product.id,
      label: product.name,
      description: product.sku ? `SKU ${product.sku}` : 'No internal SKU',
      meta: this.productCostLabel(product),
    };
  });

  readonly supplierItems = computed<TypeaheadItem[]>(() =>
    this.supplierLinks().map((link) => ({
      id: link.id,
      label: link.supplierName || 'Supplier',
      description: `SKU ${link.supplierSku}${link.isPreferred ? ' · Preferred' : ''}`,
      meta:
        link.lastKnownCostCents == null
          ? 'No cost'
          : this.money(link.lastKnownCostCents),
    })),
  );

  readonly selectedSupplierItem = computed<TypeaheadItem | null>(() => {
    const link = this.selectedSupplier();
    if (!link) return null;
    return {
      id: link.id,
      label: link.supplierName || 'Supplier',
      description: `SKU ${link.supplierSku}${link.isPreferred ? ' · Preferred' : ''}`,
      meta:
        link.lastKnownCostCents == null
          ? 'No cost'
          : this.money(link.lastKnownCostCents),
    };
  });

  readonly supplierLinks = computed(() => this.selectedProduct()?.supplierLinks ?? []);

  readonly supplierStatusText = computed(() => {
    if (this.supplierLoading()) return 'Loading supplier links…';

    const product = this.selectedProduct();
    if (!product) return 'Choose a product first.';

    const supplier = this.selectedSupplier();
    if (supplier) {
      const cost = supplier.lastKnownCostCents;
      return [
        `Using ${supplier.supplierName || 'supplier'} SKU ${supplier.supplierSku}`,
        cost == null ? 'no recorded supplier cost' : `${this.money(cost)} cost`,
      ].join(' · ');
    }

    const links = this.supplierLinks();
    if (links.length > 0) {
      return 'Choose which supplier SKU should drive this option’s part cost.';
    }

    if (product.cost != null) {
      return `No supplier links are attached. Using the product cost of ${this.money(product.cost)}.`;
    }

    return 'No supplier links or product cost are available for this product.';
  });

  readonly productCostCents = computed<number | null>(() => {
    if (!this.formValue().requiresProduct) return null;
    const supplierCost = this.selectedSupplier()?.lastKnownCostCents;
    if (supplierCost != null && supplierCost > 0) return supplierCost;

    const preferred = this.supplierLinks().find(
      (link) => link.isPreferred && (link.lastKnownCostCents ?? 0) > 0,
    );
    if (preferred?.lastKnownCostCents != null) return preferred.lastKnownCostCents;

    const productCost = this.selectedProduct()?.cost;
    return productCost != null && productCost > 0 ? productCost : null;
  });

  readonly effectiveLaborCents = computed(() => {
    const override = this.dollarsToCents(this.formValue().laborDollars);
    if (override != null) return override;
    const repairTypeLabor = this.selectedRepairType()?.defaultLaborCents;
    if (repairTypeLabor != null) return repairTypeLabor;
    return this.bookingSettings()?.defaultLaborCents ?? 0;
  });

  readonly effectiveDurationMins = computed(() => {
    const override = Number(this.formValue().durationMins ?? 0);
    if (override > 0) return override;
    const serviceDuration = this.selectedService()?.duration;
    if (serviceDuration != null && serviceDuration > 0) return serviceDuration;
    const typeDuration = this.selectedRepairType()?.defaultDurationMins;
    if (typeDuration != null && typeDuration > 0) return typeDuration;
    return this.bookingSettings()?.defaultDurationMins ?? 60;
  });

  readonly estimatedPriceCents = computed<number | null>(() => {
    const value = this.formValue();
    if (value.priceMode === 'fixed') {
      return this.dollarsToCents(value.fixedPriceDollars);
    }

    const cost = this.productCostCents();
    const settings = this.bookingSettings();
    if (cost == null || !settings) return null;

    const multiplier = Number(settings.defaultMarkupMultiplier ?? 1.8);
    const raw = cost * multiplier + this.effectiveLaborCents();
    let retail = this.roundRetailCents(raw, settings.roundingMode);

    if (settings.minimumRetailCents != null) {
      retail = Math.max(retail, settings.minimumRetailCents);
    }
    if (settings.maximumRetailCents != null) {
      retail = Math.min(retail, settings.maximumRetailCents);
    }
    return retail;
  });

  readonly depositPreview = computed<DepositPreview>(() =>
    this.calculateDepositPreview(),
  );

  readonly dynamicFormula = computed(() => {
    const settings = this.bookingSettings();
    if (!settings) return 'Loading pricing settings…';
    return `${this.money(this.productCostCents())} × ${Number(settings.defaultMarkupMultiplier).toFixed(2)} + ${this.money(this.effectiveLaborCents())} labor`;
  });

  readonly customerSubtitle = computed(() => {
    const model = this.selectedModel()?.name || 'Device model';
    const repair = this.selectedRepairType()?.label || 'Repair type';
    return `${model} · ${repair}`;
  });

  private readonly modelSearch$ = new Subject<string>();
  private readonly serviceSearch$ = new Subject<string>();
  private readonly productSearch$ = new Subject<string>();
  private readonly subscriptions = new Subscription();
  private modelSearchVersion = 0;
  private serviceSearchVersion = 0;
  private productSearchVersion = 0;
  private productHydrationVersion = 0;

  async ngOnInit(): Promise<void> {
    this.bindSearchStreams();

    try {
      const [settings, repairTypesResponse, mobileSentrixStatus] = await Promise.all([
        firstValueFrom(this.bookingApi.getSettings()),
        firstValueFrom(this.pricingApi.listRepairTypes()),
        firstValueFrom(this.mobileSentrixApi.getStatus()).catch(() => null),
      ]);

      this.bookingSettings.set(settings);
      this.connectedSupplierSearchAvailable.set(Boolean(mobileSentrixStatus?.connected));
      this.repairTypes.set(
        [...(repairTypesResponse.data ?? [])].sort(
          (a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label),
        ),
      );

      const sourceId = this.optionId || this.copyId;
      if (sourceId) {
        const option = await firstValueFrom(this.pricingApi.getOption(sourceId));
        this.sourceOption.set(option);
        await this.populateFromOption(option, Boolean(this.copyId && !this.optionId));
      } else {
        await this.populateNewDefaults();
      }

      this.modelSearch$.next('');
      this.serviceSearch$.next('');
      this.productSearch$.next('');
      this.form.markAsPristine();
    } catch (error) {
      console.error(error);
      this.error.set('This pricing option could not be loaded.');
    } finally {
      this.loading.set(false);
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.modelSearch$.complete();
    this.serviceSearch$.complete();
    this.productSearch$.complete();
  }

  @HostListener('window:beforeunload', ['$event'])
  protectUnsavedChanges(event: BeforeUnloadEvent): void {
    if (this.form.dirty && !this.saving()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyboardShortcut(event: KeyboardEvent): void {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      void this.save();
    }
  }

  onModelSearch(value: string): void {
    this.modelSearch$.next(value);
  }

  onServiceSearch(value: string): void {
    this.serviceSearch$.next(value);
  }

  onProductSearch(value: string): void {
    this.productSearchQuery.set(value);
    this.productSearch$.next(value);
  }

  onModelSelected(item: TypeaheadItem | null): void {
    const model = item
      ? this.modelSuggestions().find((row) => row.id === item.id) ?? null
      : null;
    this.selectedModel.set(model);
    this.form.controls.deviceCatalogModelId.setValue(model?.id ?? '');
    this.form.controls.deviceCatalogModelId.markAsDirty();
  }

  onRepairTypeSelected(item: TypeaheadItem | null): void {
    const type = item
      ? this.repairTypes().find((row) => row.id === item.id) ?? null
      : null;
    this.selectedRepairType.set(type);
    this.form.controls.repairNeedId.setValue(type?.id ?? '');
    this.form.controls.repairNeedId.markAsDirty();
  }

  onServiceSelected(item: TypeaheadItem | null): void {
    const service = item
      ? this.serviceSuggestions().find((row) => row.id === item.id) ?? null
      : null;
    this.selectedService.set(service);
    this.form.controls.serviceId.setValue(service?.id ?? '');
    this.form.controls.serviceId.markAsDirty();

    if (service?.duration && !this.form.controls.durationMins.value) {
      this.form.controls.durationMins.setValue(service.duration);
    }
  }

  setProductRequired(required: boolean): void {
    if (Boolean(this.form.controls.requiresProduct.value) === required) return;

    this.form.controls.requiresProduct.setValue(required);
    this.form.controls.requiresProduct.markAsDirty();

    if (required) return;

    ++this.productHydrationVersion;
    this.applyProductSelection(null);
    this.form.controls.productId.markAsDirty();
    this.form.controls.productSupplierId.markAsDirty();
    this.connectedSupplierSearchOpen.set(false);
    this.connectedSupplierSearchResults.set([]);

    if (this.form.controls.priceMode.value === 'dynamic') {
      this.form.controls.priceMode.setValue('fixed');
      this.form.controls.priceMode.markAsDirty();
    }

    const depositMode = this.form.controls.depositMode.value;
    if (
      depositMode === 'inherit' ||
      depositMode === 'product_cost' ||
      depositMode === 'cost_recovery'
    ) {
      this.form.controls.depositMode.setValue('none');
      this.form.controls.depositMode.markAsDirty();
    }
  }

  async openConnectedSupplierSearch(): Promise<void> {
    if (!this.connectedSupplierSearchAvailable() || !this.form.controls.requiresProduct.value) {
      return;
    }

    this.connectedSupplierSearchOpen.set(true);
    if (!this.connectedSupplierSearchQuery().trim()) {
      const query =
        this.productSearchQuery().trim() ||
        [this.selectedModel()?.name, this.selectedRepairType()?.label]
          .filter(Boolean)
          .join(' ');
      this.connectedSupplierSearchQuery.set(query);
    }

    if (this.connectedSupplierSearchQuery().trim().length >= 2) {
      await this.searchConnectedSuppliers();
    }
  }

  closeConnectedSupplierSearch(): void {
    this.connectedSupplierSearchOpen.set(false);
  }

  onConnectedSupplierSearchInput(event: Event): void {
    this.connectedSupplierSearchQuery.set((event.target as HTMLInputElement).value);
  }

  async searchConnectedSuppliers(): Promise<void> {
    const query = this.connectedSupplierSearchQuery().trim();
    if (query.length < 2 || this.connectedSupplierSearchLoading()) return;

    this.connectedSupplierSearchLoading.set(true);
    try {
      const response = await firstValueFrom(
        this.mobileSentrixApi.search({ q: query, maxResults: 12 }),
      );
      this.connectedSupplierSearchResults.set(
        mapMobileSentrixItems(response.items ?? []),
      );
      if (response.warning) {
        this.toast.info('Supplier search', response.warning);
      }
    } catch (error) {
      console.error('Unable to search connected suppliers', error);
      this.connectedSupplierSearchResults.set([]);
      this.toast.error(
        'Supplier search unavailable',
        'Opscend could not search your connected supplier right now.',
      );
    } finally {
      this.connectedSupplierSearchLoading.set(false);
    }
  }

  async importSupplierProduct(result: MobileSentrixSearchResult): Promise<void> {
    if (this.supplierImportingId() || !result.sku) return;

    this.supplierImportingId.set(result.id);
    try {
      const created = await firstValueFrom(
        this.productsApi.create({
          name: result.title,
          sku: null,
          priceCents: result.costCents ?? 0,
          costCents: result.costCents,
          tags: ['supplier-import', 'pricing-setup'],
          supplierLink: {
            provider: 'mobilesentrix',
            supplierName: 'MobileSentrix',
            supplierSku: result.sku,
            supplierProductId: result.id,
            supplierProductName: result.title,
            supplierUrl: result.link,
            lastKnownCostCents: result.costCents,
            lastKnownInStock: result.inStock,
            isPreferred: true,
          },
        }),
      );

      this.productSuggestions.update((rows) => [
        created,
        ...rows.filter((row) => row.id !== created.id),
      ]);
      this.applyProductSelection(created);
      this.form.controls.productId.markAsDirty();
      this.form.controls.productSupplierId.markAsDirty();
      this.connectedSupplierSearchOpen.set(false);
      this.toast.success('Product added', 'The supplier product is now linked to this pricing option.');
    } catch (error: any) {
      if (error?.status === 409 || error?.error?.error === 'duplicate_supplier_sku') {
        const existing = await this.findExistingProductForSupplierSku(result.sku);
        if (existing) {
          this.productSuggestions.update((rows) => [
            existing,
            ...rows.filter((row) => row.id !== existing.id),
          ]);
          this.applyProductSelection(existing);
          this.form.controls.productId.markAsDirty();
          this.form.controls.productSupplierId.markAsDirty();
          this.connectedSupplierSearchOpen.set(false);
          this.toast.success('Existing product selected');
          return;
        }
      }

      console.error('Unable to add supplier product', error);
      this.toast.error(
        'Product could not be added',
        'The supplier product was not added to Opscend.',
      );
    } finally {
      this.supplierImportingId.set(null);
    }
  }

  private async findExistingProductForSupplierSku(sku: string): Promise<Product | null> {
    try {
      const rows = await firstValueFrom(this.productsApi.search(sku, 25));
      const match =
        rows.find((product) =>
          product.supplierLinks?.some((link) => link.supplierSku === sku),
        ) ?? rows[0] ?? null;
      return match ? await firstValueFrom(this.productsApi.getById(match.id)) : null;
    } catch {
      return null;
    }
  }

  async onProductSelected(item: TypeaheadItem | null): Promise<void> {
    const requestVersion = ++this.productHydrationVersion;
    const product = item
      ? this.productSuggestions().find((row) => row.id === item.id) ?? null
      : null;

    this.applyProductSelection(product);
    this.form.controls.productId.markAsDirty();
    this.form.controls.productSupplierId.markAsDirty();

    if (!product) {
      this.supplierLoading.set(false);
      return;
    }

    // Search responses can be intentionally compact. Hydrate the selected product so
    // supplier links always come from the full product record before pricing is saved.
    this.supplierLoading.set(true);
    try {
      const hydrated = await firstValueFrom(this.productsApi.getById(product.id));
      if (
        requestVersion !== this.productHydrationVersion ||
        this.form.controls.productId.value !== product.id
      ) {
        return;
      }

      const selectedSupplierId = this.selectedSupplier()?.id ?? null;
      this.productSuggestions.update((rows) => [
        hydrated,
        ...rows.filter((row) => row.id !== hydrated.id),
      ]);
      this.applyProductSelection(hydrated, selectedSupplierId);
    } catch (error) {
      console.error('Unable to load supplier links for selected product', error);
      if (requestVersion === this.productHydrationVersion) {
        this.toast.error(
          'Supplier links unavailable',
          'The product was selected, but its supplier links could not be refreshed.',
        );
      }
    } finally {
      if (requestVersion === this.productHydrationVersion) {
        this.supplierLoading.set(false);
      }
    }
  }

  onSupplierSelected(item: TypeaheadItem | null): void {
    const supplier = item
      ? this.supplierLinks().find((row) => row.id === item.id) ?? null
      : null;
    this.selectedSupplier.set(supplier);
    this.form.controls.productSupplierId.setValue(supplier?.id ?? '');
    this.form.controls.productSupplierId.markAsDirty();
  }

  private applyProductSelection(
    product: Product | null,
    selectedSupplierId: string | null = null,
  ): void {
    this.selectedProduct.set(product);
    this.form.controls.productId.setValue(product?.id ?? '');

    const links = product?.supplierLinks ?? [];
    const supplier =
      (selectedSupplierId
        ? links.find((link) => link.id === selectedSupplierId) ?? null
        : null) ??
      links.find((link) => link.isPreferred) ??
      (links.length === 1 ? links[0] ?? null : null);

    this.selectedSupplier.set(supplier);
    this.form.controls.productSupplierId.setValue(supplier?.id ?? '');
  }

  setPriceMode(mode: PriceMode): void {
    if (mode === 'dynamic' && !this.form.controls.requiresProduct.value) {
      this.toast.info(
        'Dynamic pricing needs a product',
        'Turn product required back on to price from supplier or part cost.',
      );
      return;
    }
    this.form.controls.priceMode.setValue(mode);
    this.form.controls.priceMode.markAsDirty();
  }

  setToggle(
    control:
      | 'isActive'
      | 'isPublic'
      | 'allowInstantConfirmation'
      | 'requiresManualReview'
      | 'depositIncludeProcessingFees'
      | 'depositIncludeInstantPayoutFee',
  ): void {
    const current = Boolean(this.form.controls[control].value);
    this.form.controls[control].setValue(!current);
    this.form.controls[control].markAsDirty();
  }

  async save(advanceAfterSave = false): Promise<void> {
    if (this.saving()) return;

    this.form.markAllAsTouched();
    if (this.form.invalid || !this.selectedModel() || !this.selectedRepairType()) {
      this.toast.error('Complete the required fields', 'Choose a device model, repair type, and option name.');
      return;
    }

    const raw = this.form.getRawValue();
    const fixedPriceCents = this.dollarsToCents(raw.fixedPriceDollars);
    if (raw.priceMode === 'fixed' && fixedPriceCents == null) {
      this.toast.error('Fixed price required');
      return;
    }

    if (raw.requiresProduct && raw.priceMode === 'dynamic' && this.productCostCents() == null) {
      this.toast.error(
        'Part cost required',
        'Dynamic pricing needs a linked product or supplier with a recorded cost.',
      );
      return;
    }

    const deposit = this.depositPreview();
    if (deposit.error) {
      this.toast.error(
        'Deposit rule needs attention',
        deposit.error === 'missing_product_cost'
          ? 'Link a product with a recorded cost or choose another deposit rule.'
          : 'Enter a fixed deposit amount.',
      );
      return;
    }

    const depositMode = raw.depositMode as PricingOptionDepositMode;
    const payload: PricingOptionInput = {
      deviceCatalogModelId: this.selectedModel()!.id,
      repairNeedId: this.selectedRepairType()!.id,
      variantName: String(raw.variantName ?? '').trim(),
      description: this.nullable(raw.description),
      isActive: Boolean(raw.isActive),
      isPublic: Boolean(raw.isPublic),
      serviceId: this.nullable(raw.serviceId),
      productId: raw.requiresProduct ? this.nullable(raw.productId) : null,
      productSupplierId:
        raw.requiresProduct ? this.nullable(raw.productSupplierId) : null,
      requiresProduct: Boolean(raw.requiresProduct),
      fixedPriceCents: raw.priceMode === 'fixed' ? fixedPriceCents : null,
      useDynamicPricing: Boolean(raw.requiresProduct) && raw.priceMode === 'dynamic',
      depositMode,
      depositAmountCents:
        depositMode === 'custom'
          ? this.dollarsToCents(raw.depositAmountDollars)
          : null,
      depositShippingCents:
        depositMode === 'cost_recovery'
          ? this.dollarsToCents(raw.depositShippingDollars)
          : null,
      depositIncludeProcessingFees:
        depositMode === 'cost_recovery'
          ? Boolean(raw.depositIncludeProcessingFees)
          : null,
      depositIncludeInstantPayoutFee:
        depositMode === 'cost_recovery'
          ? Boolean(raw.depositIncludeInstantPayoutFee)
          : null,
      laborCents: this.dollarsToCents(raw.laborDollars),
      durationMins:
        raw.durationMins == null ? null : Math.max(5, Math.round(Number(raw.durationMins))),
      allowInstantConfirmation: Boolean(raw.allowInstantConfirmation),
      requiresManualReview: Boolean(raw.requiresManualReview),
    };

    this.saving.set(true);
    try {
      if (this.optionId) {
        await firstValueFrom(this.pricingApi.updateOption(this.optionId, payload));
        this.toast.success('Pricing option saved');
      } else {
        await firstValueFrom(this.pricingApi.createOption(payload));
        this.toast.success('Pricing option created');
      }
      this.form.markAsPristine();
      await this.goBack(advanceAfterSave);
    } catch (error: any) {
      console.error(error);
      const apiError = error?.error?.error;
      if (apiError === 'pricing_option_already_exists') {
        this.toast.error(
          'Pricing option already exists',
          'Use another option name for this model and repair type.',
        );
      } else {
        this.toast.error('Save failed', 'The pricing option was not saved.');
      }
    } finally {
      this.saving.set(false);
    }
  }

  cancel(): void {
    if (this.form.dirty) {
      this.toast.confirm(
        'Discard unsaved changes?',
        () => void this.goBack(),
        'Your changes to this pricing option will be lost.',
        'Discard',
      );
      return;
    }
    void this.goBack();
  }

  duplicate(): void {
    if (!this.optionId) return;
    void this.router.navigate(['/settings/shop/repair-pricing/new'], {
      queryParams: {
        copy: this.optionId,
        ...this.returnQueryParams(),
      },
    });
  }

  deactivate(): void {
    if (!this.optionId || this.deactivating()) return;
    this.toast.confirm(
      'Deactivate this pricing option?',
      () => void this.confirmDeactivate(),
      'It will no longer appear in public booking.',
      'Deactivate',
    );
  }

  money(cents: number | null | undefined): string {
    if (cents == null) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
    }).format(cents / 100);
  }

  depositModeLabel(): string {
    const preview = this.depositPreview();
    switch (preview.mode) {
      case 'none':
        return 'No deposit';
      case 'product_cost':
        return 'Part cost';
      case 'cost_recovery':
        return 'Cost recovery';
      case 'custom':
        return 'Fixed amount';
    }
  }

  depositInheritanceLabel(): string {
    const layer = this.depositPreview().inheritedFrom;
    if (layer === 'repair_type') return 'Inherited from repair type';
    if (layer === 'shop') return 'Inherited from shop default';
    return 'Configured for this option';
  }

  pricingModeDescription(): string {
    if (!this.formValue().requiresProduct) {
      return 'This is a service-only option, so pricing does not depend on a part cost.';
    }
    return this.formValue().priceMode === 'dynamic'
      ? 'Part cost, markup, labor, and shop rounding are calculated at booking.'
      : 'The customer sees the same fixed amount every time.';
  }

  private bindSearchStreams(): void {
    this.subscriptions.add(
      this.modelSearch$
        .pipe(
          debounceTime(220),
          distinctUntilChanged(),
          switchMap((search) => {
            const requestVersion = ++this.modelSearchVersion;
            this.modelLoading.set(true);
            return this.catalogApi
              .searchManagedModels({ includeInactive: false, search, limit: 50 })
              .pipe(
                catchError((error) => {
                  console.error('Unable to search device models', error);
                  return of(null);
                }),
                finalize(() => {
                  if (requestVersion === this.modelSearchVersion) {
                    this.modelLoading.set(false);
                  }
                }),
              );
          }),
        )
        .subscribe((response) => {
          if (!response) return;
          const selected = this.selectedModel();
          const rows = response.data ?? [];
          this.modelSuggestions.set(
            selected && !rows.some((row) => row.id === selected.id)
              ? [selected, ...rows]
              : rows,
          );
        }),
    );

    this.subscriptions.add(
      this.serviceSearch$
        .pipe(
          debounceTime(220),
          distinctUntilChanged(),
          switchMap((search) => {
            const requestVersion = ++this.serviceSearchVersion;
            this.serviceLoading.set(true);
            return this.servicesApi.search(search, 25).pipe(
              catchError((error) => {
                console.error('Unable to search services', error);
                return of(null);
              }),
              finalize(() => {
                if (requestVersion === this.serviceSearchVersion) {
                  this.serviceLoading.set(false);
                }
              }),
            );
          }),
        )
        .subscribe((rows) => {
          if (!rows) return;
          const selected = this.selectedService();
          this.serviceSuggestions.set(
            selected && !rows.some((row) => row.id === selected.id)
              ? [selected, ...rows]
              : rows,
          );
        }),
    );

    this.subscriptions.add(
      this.productSearch$
        .pipe(
          debounceTime(220),
          distinctUntilChanged(),
          switchMap((search) => {
            const requestVersion = ++this.productSearchVersion;
            this.productLoading.set(true);
            return this.productsApi.search(search, 25).pipe(
              catchError((error) => {
                console.error('Unable to search products', error);
                // Never leave an older, unrelated result set visible when the
                // current server-side search fails. An empty result is safer
                // than allowing a stale product to be selected.
                return of([] as Product[]);
              }),
              finalize(() => {
                if (requestVersion === this.productSearchVersion) {
                  this.productLoading.set(false);
                }
              }),
            );
          }),
        )
        .subscribe((rows) => {
          if (!rows) return;
          const selected = this.selectedProduct();
          this.productSuggestions.set(
            selected && !rows.some((row) => row.id === selected.id)
              ? [selected, ...rows]
              : rows,
          );
        }),
    );
  }

  private async populateNewDefaults(): Promise<void> {
    const query = this.route.snapshot.queryParamMap;
    const modelId = query.get('model');
    const typeId = query.get('type');

    if (modelId) {
      const model = await firstValueFrom(this.catalogApi.getManagedModel(modelId));
      this.selectedModel.set(model);
      this.modelSuggestions.set([model]);
      this.form.controls.deviceCatalogModelId.setValue(model.id);
    }

    const type =
      this.repairTypes().find((row) => row.id === typeId) ??
      this.repairTypes().find((row) => row.isActive) ??
      null;
    this.selectedRepairType.set(type);
    this.form.controls.repairNeedId.setValue(type?.id ?? '');

    const settings = this.bookingSettings();
    this.form.patchValue({
      priceMode: 'fixed',
      depositMode: 'inherit',
      depositShippingDollars:
        settings?.defaultDepositShippingCents != null
          ? settings.defaultDepositShippingCents / 100
          : 5,
      depositIncludeProcessingFees:
        settings?.defaultDepositIncludeProcessingFees ?? true,
      depositIncludeInstantPayoutFee:
        settings?.defaultDepositIncludeInstantPayoutFee ?? false,
      requiresProduct: true,
      isActive: true,
      isPublic: false,
      allowInstantConfirmation: true,
      requiresManualReview: false,
    });
  }

  private async populateFromOption(option: PricingOption, copying: boolean): Promise<void> {
    const [model, service, product] = await Promise.all([
      option.deviceCatalogModelId
        ? firstValueFrom(this.catalogApi.getManagedModel(option.deviceCatalogModelId))
        : Promise.resolve(null),
      option.serviceId
        ? firstValueFrom(this.servicesApi.getById(option.serviceId)).catch(() => null)
        : Promise.resolve(null),
      option.productId
        ? firstValueFrom(this.productsApi.getById(option.productId)).catch(() => null)
        : Promise.resolve(null),
    ]);

    const repairType =
      this.repairTypes().find((row) => row.id === option.repairNeedId) ?? null;
    const supplierLinks = product?.supplierLinks ?? [];
    const supplier =
      supplierLinks.find((row) => row.id === option.productSupplierId) ??
      supplierLinks.find((row) => row.isPreferred) ??
      (supplierLinks.length === 1 ? supplierLinks[0] ?? null : null);

    this.selectedModel.set(model);
    this.selectedRepairType.set(repairType);
    this.selectedService.set(service);
    this.selectedProduct.set(product);
    this.selectedSupplier.set(supplier);

    if (model) this.modelSuggestions.set([model]);
    if (service) this.serviceSuggestions.set([service]);
    if (product) this.productSuggestions.set([product]);

    const settings = this.bookingSettings();
    this.form.reset({
      deviceCatalogModelId: model?.id ?? '',
      repairNeedId: repairType?.id ?? '',
      variantName: copying ? `${option.variantName} Copy` : option.variantName,
      description: option.description ?? '',
      priceMode: option.useDynamicPricing ? 'dynamic' : 'fixed',
      fixedPriceDollars:
        option.fixedPriceCents == null ? null : option.fixedPriceCents / 100,
      laborDollars: option.laborCents == null ? null : option.laborCents / 100,
      durationMins: option.durationMins,
      serviceId: service?.id ?? '',
      productId: product?.id ?? '',
      productSupplierId: supplier?.id ?? '',
      requiresProduct: option.requiresProduct ?? true,
      depositMode: option.depositMode ?? 'inherit',
      depositAmountDollars:
        option.depositAmountCents == null ? null : option.depositAmountCents / 100,
      depositShippingDollars:
        option.depositShippingCents == null
          ? (repairType?.depositShippingCents ?? settings?.defaultDepositShippingCents ?? 500) / 100
          : option.depositShippingCents / 100,
      depositIncludeProcessingFees:
        option.depositIncludeProcessingFees ??
        repairType?.depositIncludeProcessingFees ??
        settings?.defaultDepositIncludeProcessingFees ??
        true,
      depositIncludeInstantPayoutFee:
        option.depositIncludeInstantPayoutFee ??
        repairType?.depositIncludeInstantPayoutFee ??
        settings?.defaultDepositIncludeInstantPayoutFee ??
        false,
      isActive: copying ? true : option.isActive,
      isPublic: copying ? false : option.isPublic,
      allowInstantConfirmation: option.allowInstantConfirmation,
      requiresManualReview: option.requiresManualReview,
    });
  }

  private calculateDepositPreview(): DepositPreview {
    const value = this.formValue();
    const settings = this.bookingSettings();
    const repairType = this.selectedRepairType();
    const configuredMode = value.depositMode as PricingOptionDepositMode;

    let mode: Exclude<PricingOptionDepositMode, 'inherit'>;
    let inheritedFrom: DepositPreview['inheritedFrom'];

    if (configuredMode !== 'inherit') {
      mode = configuredMode;
      inheritedFrom = 'option';
    } else if (repairType && repairType.depositMode !== 'inherit') {
      mode = repairType.depositMode;
      inheritedFrom = 'repair_type';
    } else {
      mode = settings?.defaultDepositMode ?? 'none';
      inheritedFrom = 'shop';
    }

    const productCostCents = this.productCostCents();
    const result: DepositPreview = {
      mode,
      amountCents: null,
      productCostCents,
      shippingCents: 0,
      processingFeeCents: 0,
      instantPayoutFeeCents: 0,
      inheritedFrom,
      error: null,
    };

    if (!value.requiresProduct && (mode === 'product_cost' || mode === 'cost_recovery')) {
      result.mode = 'none';
      result.inheritedFrom = 'option';
      return result;
    }

    if (mode === 'none') return result;

    if (mode === 'custom') {
      const amount =
        inheritedFrom === 'option'
          ? this.dollarsToCents(value.depositAmountDollars)
          : inheritedFrom === 'repair_type'
            ? repairType?.depositAmountCents ?? null
            : settings?.defaultDepositAmountCents ?? null;
      result.amountCents = amount;
      result.error = amount != null && amount > 0 ? null : 'missing_custom_amount';
      return result;
    }

    if (productCostCents == null || productCostCents <= 0) {
      result.error = 'missing_product_cost';
      return result;
    }

    if (mode === 'product_cost') {
      result.amountCents = productCostCents;
      return result;
    }

    const shippingCents =
      inheritedFrom === 'option'
        ? this.dollarsToCents(value.depositShippingDollars) ??
          repairType?.depositShippingCents ??
          settings?.defaultDepositShippingCents ??
          500
        : inheritedFrom === 'repair_type'
          ? repairType?.depositShippingCents ??
            settings?.defaultDepositShippingCents ??
            500
          : settings?.defaultDepositShippingCents ?? 500;

    const includeProcessing =
      inheritedFrom === 'option'
        ? Boolean(value.depositIncludeProcessingFees)
        : inheritedFrom === 'repair_type'
          ? repairType?.depositIncludeProcessingFees ??
            settings?.defaultDepositIncludeProcessingFees ??
            true
          : settings?.defaultDepositIncludeProcessingFees ?? true;

    const includeInstant =
      inheritedFrom === 'option'
        ? Boolean(value.depositIncludeInstantPayoutFee)
        : inheritedFrom === 'repair_type'
          ? repairType?.depositIncludeInstantPayoutFee ??
            settings?.defaultDepositIncludeInstantPayoutFee ??
            false
          : settings?.defaultDepositIncludeInstantPayoutFee ?? false;

    const netCents = productCostCents + shippingCents;
    const processingBps = includeProcessing
      ? settings?.depositProcessingFeeBps ?? 290
      : 0;
    const processingFixed = includeProcessing
      ? settings?.depositProcessingFeeFixedCents ?? 30
      : 0;
    const instantBps = includeInstant
      ? settings?.depositInstantPayoutFeeBps ?? 100
      : 0;
    const totalBps = processingBps + instantBps;
    const denominator = Math.max(1, 10_000 - totalBps);
    const amountCents = Math.ceil(((netCents + processingFixed) * 10_000) / denominator);
    const totalFees = Math.max(0, amountCents - netCents);
    const processingFeeCents = includeProcessing
      ? Math.min(
          totalFees,
          Math.ceil((amountCents * processingBps) / 10_000) + processingFixed,
        )
      : 0;

    result.shippingCents = shippingCents;
    result.amountCents = amountCents;
    result.processingFeeCents = processingFeeCents;
    result.instantPayoutFeeCents = includeInstant
      ? Math.max(0, totalFees - processingFeeCents)
      : 0;
    return result;
  }

  private roundRetailCents(
    value: number,
    mode: BookingSettings['roundingMode'],
  ): number {
    if (!Number.isFinite(value)) return 0;
    if (mode === 'none') return Math.max(0, Math.round(value));
    const dollars = value / 100;
    if (mode === 'nearest_dollar') return Math.max(0, Math.round(dollars) * 100);
    const roundedUpToNextTen = Math.ceil(dollars / 10) * 10;
    return Math.round(Math.max(9, roundedUpToNextTen - 1) * 100);
  }

  private async confirmDeactivate(): Promise<void> {
    if (!this.optionId) return;
    this.deactivating.set(true);
    try {
      await firstValueFrom(this.pricingApi.deactivateOption(this.optionId));
      this.form.markAsPristine();
      this.toast.success('Pricing option deactivated');
      await this.goBack();
    } catch (error) {
      console.error(error);
      this.toast.error('Deactivate failed');
    } finally {
      this.deactivating.set(false);
    }
  }

  private async goBack(advanceAfterSave = false): Promise<void> {
    await this.router.navigate(['/settings/shop/repair-pricing'], {
      queryParams: {
        ...this.returnQueryParams(),
        model: this.isSetupWorkflow()
          ? null
          : this.selectedModel()?.id ?? this.returnQueryParams()['model'] ?? null,
        type: this.isSetupWorkflow()
          ? null
          : this.selectedRepairType()?.id ?? this.returnQueryParams()['type'] ?? null,
        advance:
          advanceAfterSave && this.isSetupWorkflow() ? '1' : null,
      },
    });
  }

  private returnQueryParams(): Record<string, string | null> {
    const params = this.route.snapshot.queryParamMap;
    return {
      q: params.get('q'),
      model: params.get('model'),
      type: params.get('type'),
      status: params.get('status'),
      visibility: params.get('visibility'),
      view: params.get('view'),
      category: params.get('category'),
      brand: params.get('brand'),
      setup: params.get('setup'),
    };
  }

  private modelToItem(model: ManagedDeviceCatalogModel): TypeaheadItem {
    return {
      id: model.id,
      label: model.name,
      description: `${model.categoryName} · ${model.brandName}`,
      meta: model.releaseYear ? String(model.releaseYear) : null,
    };
  }

  private repairTypeToItem(type: RepairType): TypeaheadItem {
    return {
      id: type.id,
      label: type.label,
      description: type.description || type.code,
      meta:
        type.defaultLaborCents == null
          ? 'Default labor'
          : `${this.money(type.defaultLaborCents)} labor`,
    };
  }

  private productCostLabel(product: Product): string {
    const preferred = product.supplierLinks?.find((link) => link.isPreferred);
    const cost = preferred?.lastKnownCostCents ?? product.cost;
    return cost == null ? 'No cost' : `${this.money(cost)} cost`;
  }

  private dollarsToCents(value: number | string | null | undefined): number | null {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? Math.round(number * 100) : null;
  }

  private nullable(value: string | null | undefined): string | null {
    const normalized = String(value ?? '').trim();
    return normalized || null;
  }
}
