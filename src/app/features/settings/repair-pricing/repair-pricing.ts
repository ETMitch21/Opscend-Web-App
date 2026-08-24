import { CommonModule } from '@angular/common';
import {
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  AlertCircleIcon,
  ArchiveIcon,
  CheckIcon,
  ChevronRightIcon,
  CopyIcon,
  DollarSignIcon,
  EyeIcon,
  EyeOffIcon,
  FilterIcon,
  LoaderCircleIcon,
  LucideAngularModule,
  PlusIcon,
  SearchIcon,
  SlidersHorizontalIcon,
  SmartphoneIcon,
  WrenchIcon,
  XIcon,
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

import {
  TypeaheadComponent,
  TypeaheadItem,
} from '../../../core/ui/typeahead/typeahead';
import {
  ManagedDeviceCatalogBrand,
  ManagedDeviceCatalogCategory,
  ManagedDeviceCatalogModel,
  TechSpecsService,
} from '../../../core/techspecs/techspecs.service';
import {
  PricingOption,
  PricingOptionBulkAction,
  PricingNotOffered,
  RepairType,
} from '../../../core/repair-pricing/model';
import { RepairPricingService } from '../../../core/repair-pricing/service';
import { ToastService } from '../../../core/toast/toast-service';
import { SettingsLayoutComponent } from '../settings-layout/settings-layout';

type StatusFilter = 'all' | 'active' | 'inactive';
type VisibilityFilter = 'all' | 'public' | 'internal';
type PricingViewMode = 'setup' | 'list';
type SetupFilter =
  | 'attention'
  | 'all'
  | 'ready'
  | 'not_configured'
  | 'not_offered';
type SetupStatus =
  | 'ready'
  | 'needs_service'
  | 'needs_product'
  | 'needs_price'
  | 'needs_deposit'
  | 'inactive'
  | 'not_configured'
  | 'not_offered';

interface SetupRepairRow {
  repairType: RepairType;
  options: PricingOption[];
  primaryOption: PricingOption | null;
  status: SetupStatus;
  ready: boolean;
  complete: boolean;
  optionCount: number;
  activeOptionCount: number;
  attentionCount: number;
}

interface SetupModelCard {
  model: ManagedDeviceCatalogModel;
  rows: SetupRepairRow[];
  visibleRows: SetupRepairRow[];
  readyCount: number;
  notOfferedCount: number;
  completeCount: number;
  totalCount: number;
  attentionCount: number;
  missingCount: number;
  percent: number;
}

@Component({
  selector: 'app-repair-pricing',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    LucideAngularModule,
    SettingsLayoutComponent,
    TypeaheadComponent,
  ],
  templateUrl: './repair-pricing.html',
})
export class RepairPricingSettings implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly pricingApi = inject(RepairPricingService);
  private readonly catalogApi = inject(TechSpecsService);
  private readonly toast = inject(ToastService);

  readonly icons = {
    Alert: AlertCircleIcon,
    Archive: ArchiveIcon,
    Check: CheckIcon,
    ChevronRight: ChevronRightIcon,
    Copy: CopyIcon,
    Dollar: DollarSignIcon,
    Eye: EyeIcon,
    EyeOff: EyeOffIcon,
    Filter: FilterIcon,
    Loader: LoaderCircleIcon,
    Plus: PlusIcon,
    Search: SearchIcon,
    Sliders: SlidersHorizontalIcon,
    Smartphone: SmartphoneIcon,
    Wrench: WrenchIcon,
    X: XIcon,
  };

  readonly initialLoading = signal(true);
  readonly listLoading = signal(false);
  readonly modelLoading = signal(false);
  readonly setupLoading = signal(false);
  readonly bulkSaving = signal(false);
  readonly notOfferedSavingKey = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  readonly options = signal<PricingOption[]>([]);
  readonly setupOptions = signal<PricingOption[]>([]);
  readonly notOffered = signal<PricingNotOffered[]>([]);
  readonly repairTypes = signal<RepairType[]>([]);
  readonly modelSuggestions = signal<ManagedDeviceCatalogModel[]>([]);
  readonly categories = signal<ManagedDeviceCatalogCategory[]>([]);
  readonly brands = signal<ManagedDeviceCatalogBrand[]>([]);
  readonly brandModels = signal<ManagedDeviceCatalogModel[]>([]);

  readonly pricingSearch = signal('');
  readonly viewMode = signal<PricingViewMode>('setup');
  readonly setupFilter = signal<SetupFilter>('attention');
  readonly selectedCategoryId = signal<string | null>(null);
  readonly selectedBrandId = signal<string | null>(null);
  readonly selectedModel = signal<ManagedDeviceCatalogModel | null>(null);
  readonly selectedRepairType = signal<RepairType | null>(null);
  readonly statusFilter = signal<StatusFilter>('all');
  readonly visibilityFilter = signal<VisibilityFilter>('all');
  readonly selectedOptionIds = signal<Set<string>>(new Set());

  readonly modelItems = computed<TypeaheadItem[]>(() =>
    this.modelSuggestions().map((model) => this.modelToItem(model)),
  );

  readonly selectedModelItem = computed<TypeaheadItem | null>(() => {
    const model = this.selectedModel();
    return model ? this.modelToItem(model) : null;
  });

  readonly repairTypeItems = computed<TypeaheadItem[]>(() =>
    this.repairTypes().map((type) => ({
      id: type.id,
      label: type.label,
      description: type.description || type.code,
      meta: `${type.pricingOptionCount} option${type.pricingOptionCount === 1 ? '' : 's'}`,
    })),
  );

  readonly selectedRepairTypeItem = computed<TypeaheadItem | null>(() => {
    const type = this.selectedRepairType();
    if (!type) return null;
    return {
      id: type.id,
      label: type.label,
      description: type.description || type.code,
      meta: `${type.pricingOptionCount} option${type.pricingOptionCount === 1 ? '' : 's'}`,
    };
  });

  readonly filteredOptions = computed(() => {
    const modelId = this.selectedModel()?.id ?? null;
    const repairTypeId = this.selectedRepairType()?.id ?? null;
    const status = this.statusFilter();
    const visibility = this.visibilityFilter();

    return this.options().filter((option) => {
      if (modelId && option.deviceCatalogModelId !== modelId) return false;
      if (repairTypeId && option.repairNeedId !== repairTypeId) return false;
      if (status === 'active' && !option.isActive) return false;
      if (status === 'inactive' && option.isActive) return false;
      if (visibility === 'public' && !option.isPublic) return false;
      if (visibility === 'internal' && option.isPublic) return false;
      return true;
    });
  });

  readonly activeFilterCount = computed(() =>
    [
      this.selectedModel(),
      this.selectedRepairType(),
      this.statusFilter() !== 'all',
      this.visibilityFilter() !== 'all',
    ].filter(Boolean).length,
  );

  readonly allVisibleSelected = computed(() => {
    const visible = this.filteredOptions();
    const selected = this.selectedOptionIds();
    return visible.length > 0 && visible.every((option) => selected.has(option.id));
  });

  readonly selectedCount = computed(() => this.selectedOptionIds().size);

  readonly selectedCategory = computed(
    () =>
      this.categories().find(
        (category) => category.id === this.selectedCategoryId(),
      ) ?? null,
  );

  readonly selectedBrand = computed(
    () =>
      this.brands().find((brand) => brand.id === this.selectedBrandId()) ?? null,
  );

  readonly activeRepairTypes = computed(() =>
    this.repairTypes().filter((type) => type.isActive),
  );

  readonly notOfferedKeys = computed(
    () =>
      new Set(
        this.notOffered().map(
          (row) => `${row.deviceCatalogModelId}:${row.repairNeedId}`,
        ),
      ),
  );

  readonly setupCards = computed<SetupModelCard[]>(() => {
    const repairTypes = this.activeRepairTypes();
    const options = this.setupOptions();
    const filter = this.setupFilter();

    return this.brandModels()
      .map((model) => {
        const rows = repairTypes.map((repairType) =>
          this.buildSetupRepairRow(model, repairType, options),
        );
        const visibleRows = rows.filter((row) => {
          if (filter === 'all') return true;
          if (filter === 'ready') return row.ready;
          if (filter === 'not_configured') {
            return row.status === 'not_configured';
          }
          if (filter === 'not_offered') {
            return row.status === 'not_offered';
          }
          return !row.complete;
        });
        const readyCount = rows.filter((row) => row.ready).length;
        const notOfferedCount = rows.filter(
          (row) => row.status === 'not_offered',
        ).length;
        const completeCount = rows.filter((row) => row.complete).length;
        const missingCount = rows.filter(
          (row) => row.status === 'not_configured',
        ).length;

        return {
          model,
          rows,
          visibleRows,
          readyCount,
          notOfferedCount,
          completeCount,
          totalCount: rows.length,
          attentionCount: rows.length - completeCount,
          missingCount,
          percent: rows.length
            ? Math.round((completeCount / rows.length) * 100)
            : 100,
        };
      })
      .filter((card) => card.visibleRows.length > 0);
  });

  readonly setupMetrics = computed(() => {
    const repairTypes = this.activeRepairTypes();
    const models = this.brandModels();
    const options = this.setupOptions();
    let ready = 0;
    let notOffered = 0;
    let missing = 0;

    for (const model of models) {
      for (const repairType of repairTypes) {
        const row = this.buildSetupRepairRow(model, repairType, options);
        if (row.ready) ready += 1;
        if (row.status === 'not_offered') notOffered += 1;
        if (row.status === 'not_configured') missing += 1;
      }
    }

    const total = models.length * repairTypes.length;
    const complete = ready + notOffered;
    return {
      total,
      ready,
      notOffered,
      complete,
      attention: Math.max(0, total - complete),
      missing,
      percent: total ? Math.round((complete / total) * 100) : 100,
    };
  });

  private readonly pricingSearch$ = new Subject<string>();
  private readonly modelSearch$ = new Subject<string>();
  private readonly subscriptions = new Subscription();
  private modelSearchVersion = 0;
  private setupLoadVersion = 0;
  private routeFingerprint = '';

  async ngOnInit(): Promise<void> {
    this.bindSearchStreams();

    try {
      const [typesResponse, categoriesResponse] = await Promise.all([
        firstValueFrom(this.pricingApi.listRepairTypes()),
        firstValueFrom(this.catalogApi.listManagedCategories(false)),
      ]);
      this.repairTypes.set(this.sortRepairTypes(typesResponse.data ?? []));
      this.categories.set(categoriesResponse.data ?? []);

      this.subscriptions.add(
        this.route.queryParamMap.subscribe((params) => {
          void this.applyRouteState(params);
        }),
      );

      this.modelSearch$.next('');
    } catch (error) {
      console.error(error);
      this.error.set('Repair pricing could not be loaded.');
    } finally {
      this.initialLoading.set(false);
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.pricingSearch$.complete();
    this.modelSearch$.complete();
  }

  onPricingSearch(value: string): void {
    this.pricingSearch.set(value);
    this.pricingSearch$.next(value);
    void this.updateQuery({ q: value.trim() || null });
  }

  clearPricingSearch(): void {
    this.onPricingSearch('');
  }

  onModelSearch(value: string): void {
    this.modelSearch$.next(value);
  }

  onModelSelected(item: TypeaheadItem | null): void {
    const model = item
      ? this.modelSuggestions().find((row) => row.id === item.id) ?? null
      : null;
    this.selectedModel.set(model);
    this.selectedOptionIds.set(new Set());
    void this.updateQuery({ model: model?.id ?? null });
  }

  onRepairTypeSelected(item: TypeaheadItem | null): void {
    const repairType = item
      ? this.repairTypes().find((row) => row.id === item.id) ?? null
      : null;
    this.selectedRepairType.set(repairType);
    this.selectedOptionIds.set(new Set());
    void this.updateQuery({ type: repairType?.id ?? null });
  }

  setStatusFilter(value: StatusFilter): void {
    this.statusFilter.set(value);
    this.selectedOptionIds.set(new Set());
    void this.updateQuery({ status: value === 'all' ? null : value });
  }

  setVisibilityFilter(value: VisibilityFilter): void {
    this.visibilityFilter.set(value);
    this.selectedOptionIds.set(new Set());
    void this.updateQuery({ visibility: value === 'all' ? null : value });
  }

  clearFilters(): void {
    this.selectedModel.set(null);
    this.selectedRepairType.set(null);
    this.statusFilter.set('all');
    this.visibilityFilter.set('all');
    this.selectedOptionIds.set(new Set());
    void this.updateQuery({
      model: null,
      type: null,
      status: null,
      visibility: null,
    });
  }

  setViewMode(value: PricingViewMode): void {
    if (this.viewMode() === value) return;
    this.selectedOptionIds.set(new Set());
    void this.updateQuery({ view: value });
  }

  setSetupFilter(value: SetupFilter): void {
    if (this.setupFilter() === value) return;
    void this.updateQuery({ setup: value === 'attention' ? null : value });
  }

  selectCategory(category: ManagedDeviceCatalogCategory): void {
    if (category.id === this.selectedCategoryId()) return;
    this.selectedCategoryId.set(category.id);
    this.selectedBrandId.set(null);
    this.brands.set([]);
    this.brandModels.set([]);
    this.setupOptions.set([]);
    this.notOffered.set([]);
    this.setupLoading.set(true);
    void this.updateQuery({
      view: 'setup',
      category: category.id,
      brand: null,
    });
  }

  selectBrand(brand: ManagedDeviceCatalogBrand): void {
    if (brand.id === this.selectedBrandId()) return;
    this.selectedBrandId.set(brand.id);
    this.brandModels.set([]);
    this.setupOptions.set([]);
    this.notOffered.set([]);
    this.setupLoading.set(true);
    void this.updateQuery({
      view: 'setup',
      category: brand.categoryId,
      brand: brand.id,
    });
  }

  openSetupRow(
    model: ManagedDeviceCatalogModel,
    row: SetupRepairRow,
  ): void {
    if (row.status === 'not_offered') return;

    if (row.status === 'not_configured') {
      this.newOptionFor(model, row.repairType);
      return;
    }

    if (row.options.length === 1 && row.primaryOption) {
      this.editOption(row.primaryOption);
      return;
    }

    this.selectedModel.set(model);
    this.selectedRepairType.set(row.repairType);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        ...this.returnQueryParams(),
        view: 'list',
        q: null,
        model: model.id,
        type: row.repairType.id,
        status: null,
        visibility: null,
      },
      replaceUrl: true,
    });
  }

  addSetupVariant(
    model: ManagedDeviceCatalogModel,
    row: SetupRepairRow,
    event?: Event,
  ): void {
    event?.stopPropagation();
    if (!row.repairType.quoteAttributeKeys.length) return;

    const source = row.primaryOption ?? row.options[0] ?? null;
    if (!source) {
      this.newOptionFor(model, row.repairType);
      return;
    }

    void this.router.navigate(['/settings/shop/repair-pricing/new'], {
      queryParams: {
        ...this.returnQueryParams(),
        view: 'setup',
        category: model.categoryId,
        brand: model.brandId,
        model: model.id,
        type: row.repairType.id,
        variantOf: source.id,
      },
    });
  }

  nextSetupItem(): void {
    const options = this.setupOptions();
    for (const model of this.brandModels()) {
      for (const repairType of this.activeRepairTypes()) {
        const row = this.buildSetupRepairRow(model, repairType, options);
        if (!row.complete) {
          this.openSetupRow(model, row);
          return;
        }
      }
    }
  }

  async markNotOffered(
    model: ManagedDeviceCatalogModel,
    row: SetupRepairRow,
    event?: Event,
  ): Promise<void> {
    event?.stopPropagation();
    const key = this.setupRowKey(model.id, row.repairType.id);
    if (this.notOfferedSavingKey()) return;

    this.notOfferedSavingKey.set(key);
    try {
      const response = await firstValueFrom(
        this.pricingApi.markNotOffered({
          deviceCatalogModelId: model.id,
          repairNeedId: row.repairType.id,
        }),
      );
      this.notOffered.update((current) => [
        ...current.filter((item) => item.id !== response.data.id),
        response.data,
      ]);
      await this.refreshSetupOptions();
      this.toast.success('Marked as not offered');
    } catch (error) {
      console.error(error);
      this.toast.error(
        'Could not update pricing setup',
        'This repair was not marked as not offered.',
      );
    } finally {
      this.notOfferedSavingKey.set(null);
    }
  }

  async offerRepair(
    model: ManagedDeviceCatalogModel,
    row: SetupRepairRow,
    event?: Event,
  ): Promise<void> {
    event?.stopPropagation();
    const key = this.setupRowKey(model.id, row.repairType.id);
    if (this.notOfferedSavingKey()) return;

    this.notOfferedSavingKey.set(key);
    try {
      await firstValueFrom(
        this.pricingApi.clearNotOffered({
          deviceCatalogModelId: model.id,
          repairNeedId: row.repairType.id,
        }),
      );
      this.notOffered.update((current) =>
        current.filter(
          (item) =>
            item.deviceCatalogModelId !== model.id ||
            item.repairNeedId !== row.repairType.id,
        ),
      );
      await this.refreshSetupOptions();

      const refreshedRow = this.buildSetupRepairRow(
        model,
        row.repairType,
        this.setupOptions(),
      );
      if (refreshedRow.primaryOption) {
        this.editOption(refreshedRow.primaryOption);
      } else {
        this.newOptionFor(model, row.repairType);
      }
    } catch (error) {
      console.error(error);
      this.toast.error(
        'Could not update pricing setup',
        'This repair is still marked as not offered.',
      );
    } finally {
      this.notOfferedSavingKey.set(null);
    }
  }

  isSetupRowSaving(
    model: ManagedDeviceCatalogModel,
    repairType: RepairType,
  ): boolean {
    return (
      this.notOfferedSavingKey() === this.setupRowKey(model.id, repairType.id)
    );
  }

  newOptionFor(
    model: ManagedDeviceCatalogModel,
    repairType: RepairType,
  ): void {
    void this.router.navigate(['/settings/shop/repair-pricing/new'], {
      queryParams: {
        ...this.returnQueryParams(),
        view: 'setup',
        category: model.categoryId,
        brand: model.brandId,
        model: model.id,
        type: repairType.id,
      },
    });
  }

  newOption(): void {
    void this.router.navigate(['/settings/shop/repair-pricing/new'], {
      queryParams: {
        ...this.returnQueryParams(),
        model:
          this.viewMode() === 'list' ? this.selectedModel()?.id ?? null : null,
        type:
          this.viewMode() === 'list'
            ? this.selectedRepairType()?.id ?? null
            : null,
      },
    });
  }

  editOption(option: PricingOption): void {
    void this.router.navigate(['/settings/shop/repair-pricing', option.id], {
      queryParams: this.returnQueryParams(),
    });
  }

  duplicateOption(option: PricingOption): void {
    void this.router.navigate(['/settings/shop/repair-pricing/new'], {
      queryParams: {
        copy: option.id,
        ...this.returnQueryParams(),
      },
    });
  }

  toggleOption(optionId: string): void {
    this.selectedOptionIds.update((current) => {
      const next = new Set(current);
      if (next.has(optionId)) next.delete(optionId);
      else next.add(optionId);
      return next;
    });
  }

  toggleAllVisible(): void {
    const visible = this.filteredOptions();
    if (this.allVisibleSelected()) {
      this.selectedOptionIds.set(new Set());
      return;
    }
    this.selectedOptionIds.set(new Set(visible.map((option) => option.id)));
  }

  clearSelection(): void {
    this.selectedOptionIds.set(new Set());
  }

  async runBulkAction(action: PricingOptionBulkAction): Promise<void> {
    const ids = [...this.selectedOptionIds()];
    if (!ids.length || this.bulkSaving()) return;

    this.bulkSaving.set(true);
    try {
      await firstValueFrom(this.pricingApi.bulkAction({ ids, action }));
      this.toast.success('Pricing options updated');
      this.selectedOptionIds.set(new Set());
      await this.loadOptions(this.pricingSearch());
      await this.refreshSetupOptions();
    } catch (error) {
      console.error(error);
      this.toast.error('Update failed', 'The selected pricing options were not updated.');
    } finally {
      this.bulkSaving.set(false);
    }
  }

  deactivateOption(option: PricingOption): void {
    this.toast.confirm(
      `Deactivate ${option.variantName}?`,
      () => void this.confirmDeactivate(option),
      'It will be removed from public booking but kept for reporting.',
      'Deactivate',
    );
  }

  optionPriceLabel(option: PricingOption): string {
    if (option.useDynamicPricing) return 'Dynamic';
    return option.fixedPriceCents == null ? 'Needs price' : this.money(option.fixedPriceCents);
  }

  optionDepositLabel(option: PricingOption): string {
    if (option.depositConfigurationError) return 'Needs attention';
    if (option.resolvedDepositCents != null) return this.money(option.resolvedDepositCents);
    return 'No deposit';
  }

  optionProductLabel(option: PricingOption): string {
    if (!option.requiresProduct) return 'No product needed';
    if (!option.product) return 'No product linked';
    const sku = option.productSupplier?.supplierSku || option.product.sku;
    return sku ? `${option.product.name} · ${sku}` : option.product.name;
  }

  optionServiceLabel(option: PricingOption): string {
    return option.service?.name || 'No service linked';
  }

  modelLabel(option: PricingOption): string {
    if (!option.model) return 'No model';
    return `${option.model.brandName} ${option.model.name}`;
  }

  durationLabel(option: PricingOption): string {
    return `${option.durationMins ?? 60} min`;
  }

  setupStatusLabel(status: SetupStatus): string {
    switch (status) {
      case 'ready':
        return 'Ready';
      case 'needs_service':
        return 'Needs service';
      case 'needs_product':
        return 'Needs product';
      case 'needs_price':
        return 'Needs price';
      case 'needs_deposit':
        return 'Deposit needs attention';
      case 'inactive':
        return 'Inactive';
      case 'not_configured':
        return 'Not configured';
      case 'not_offered':
        return 'Not offered';
    }
  }

  setupStatusHint(row: SetupRepairRow): string {
    if (row.status === 'not_offered') {
      return 'Intentionally excluded from this device';
    }
    if (row.status === 'not_configured') return 'Create this repair option';
    if (row.status === 'inactive') return 'Pricing exists, but it is turned off';
    if (row.attentionCount > 1) {
      return `${row.attentionCount} options need attention`;
    }
    if (row.optionCount > 1 && row.repairType.quoteAttributeKeys.length) {
      const details = row.options
        .map((option) => this.optionAttributeSummary(option))
        .filter(Boolean);
      return details.length ? details.join(' · ') : `${row.optionCount} product variants`;
    }
    if (row.optionCount > 1) return `${row.optionCount} pricing options`;
    return row.primaryOption?.variantName ?? 'Standard';
  }

  setupProductLabel(row: SetupRepairRow): string {
    if (!row.primaryOption) return 'Not linked';
    const attributeVariants = row.options.filter(
      (option) => Boolean(option.attributeSignature),
    );
    if (attributeVariants.length > 1) {
      return `${attributeVariants.length} product variants`;
    }
    if (attributeVariants.length === 1) {
      const detail = this.optionAttributeSummary(attributeVariants[0]!);
      const product = this.optionProductLabel(attributeVariants[0]!);
      return detail ? `${detail} · ${product}` : product;
    }
    return this.optionProductLabel(row.primaryOption);
  }

  optionAttributeSummary(option: PricingOption): string {
    const values = option.attributeValues ?? {};
    return Object.values(values)
      .map((value) => String(value).trim())
      .filter(Boolean)
      .join(' · ');
  }

  setupStatusClass(status: SetupStatus): string {
    if (status === 'ready') {
      return 'bg-emerald-50 text-emerald-700 ring-emerald-600/15';
    }
    if (status === 'not_configured' || status === 'not_offered') {
      return 'bg-app-surface-muted text-app-text-muted ring-app-border';
    }
    if (status === 'inactive') {
      return 'bg-slate-100 text-slate-600 ring-slate-300/60';
    }
    return 'bg-amber-50 text-amber-800 ring-amber-600/15';
  }

  money(cents: number | null | undefined): string {
    if (cents == null) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
    }).format(cents / 100);
  }

  private bindSearchStreams(): void {
    this.subscriptions.add(
      this.pricingSearch$
        .pipe(
          debounceTime(280),
          distinctUntilChanged(),
          switchMap((search) => {
            this.listLoading.set(true);
            this.error.set(null);
            return this.pricingApi
              .listOptions({
                search: search.trim() || undefined,
                includeInactive: true,
                includePrivate: true,
              })
              .pipe(
                catchError((error) => {
                  console.error(error);
                  this.error.set('Pricing options could not be loaded.');
                  return of({ data: [] as PricingOption[] });
                }),
                finalize(() => this.listLoading.set(false)),
              );
          }),
        )
        .subscribe((response) => {
          this.options.set(response.data ?? []);
          this.removeHiddenSelections();
        }),
    );

    this.subscriptions.add(
      this.modelSearch$
        .pipe(
          debounceTime(220),
          distinctUntilChanged(),
          switchMap((search) => {
            const requestVersion = ++this.modelSearchVersion;
            this.modelLoading.set(true);
            return this.catalogApi
              .searchManagedModels({
                includeInactive: false,
                search,
                limit: 50,
              })
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
  }

  private async applyRouteState(
    params: import('@angular/router').ParamMap,
  ): Promise<void> {
    const q = params.get('q') ?? '';
    const modelId = params.get('model') ?? '';
    const repairTypeId = params.get('type') ?? '';
    const status = this.parseStatus(params.get('status'));
    const visibility = this.parseVisibility(params.get('visibility'));
    const view = this.parseViewMode(params.get('view'));
    const setup = this.parseSetupFilter(params.get('setup'));
    const categoryId = params.get('category') ?? '';
    const brandId = params.get('brand') ?? '';
    const advance = params.get('advance') === '1';
    const fingerprint = [
      q,
      modelId,
      repairTypeId,
      status,
      visibility,
      view,
      setup,
      categoryId,
      brandId,
      advance ? 'advance' : '',
    ].join('|');
    if (fingerprint === this.routeFingerprint) return;
    this.routeFingerprint = fingerprint;

    this.pricingSearch.set(q);
    this.statusFilter.set(status);
    this.visibilityFilter.set(visibility);
    this.viewMode.set(view);
    this.setupFilter.set(setup);
    this.selectedRepairType.set(
      this.repairTypes().find((type) => type.id === repairTypeId) ?? null,
    );

    if (modelId && this.selectedModel()?.id !== modelId) {
      try {
        const model = await firstValueFrom(
          this.catalogApi.getManagedModel(modelId),
        );
        this.selectedModel.set(model);
        this.modelSuggestions.update((rows) =>
          rows.some((row) => row.id === model.id) ? rows : [model, ...rows],
        );
      } catch (error) {
        console.error(error);
        this.selectedModel.set(null);
      }
    } else if (!modelId) {
      this.selectedModel.set(null);
    }

    if (view === 'setup') {
      await this.loadSetupSelection(categoryId || null, brandId || null);
      if (advance) {
        if (this.setupMetrics().attention > 0) {
          this.nextSetupItem();
        } else {
          void this.updateQuery({ advance: null });
        }
      }
    }

    this.selectedOptionIds.set(new Set());
    if (view === 'list') this.pricingSearch$.next(q);
  }

  private async loadSetupSelection(
    requestedCategoryId: string | null,
    requestedBrandId: string | null,
  ): Promise<void> {
    const requestVersion = ++this.setupLoadVersion;
    const categories = this.categories();
    const category =
      categories.find((row) => row.id === requestedCategoryId) ??
      categories[0] ??
      null;

    if (!category) {
      this.selectedCategoryId.set(null);
      this.selectedBrandId.set(null);
      this.brands.set([]);
      this.brandModels.set([]);
      this.setupOptions.set([]);
      this.notOffered.set([]);
      this.setupLoading.set(false);
      return;
    }

    this.error.set(null);
    const categoryChanged = this.selectedCategoryId() !== category.id;
    this.selectedCategoryId.set(category.id);

    let brands = this.brands();
    if (categoryChanged || !brands.length) {
      this.setupLoading.set(true);
      try {
        const response = await firstValueFrom(
          this.catalogApi.listManagedBrands(category.id, false),
        );
        if (requestVersion !== this.setupLoadVersion) return;
        brands = response.data ?? [];
        this.brands.set(brands);
      } catch (error) {
        if (requestVersion !== this.setupLoadVersion) return;
        console.error(error);
        this.brands.set([]);
        this.brandModels.set([]);
        this.setupOptions.set([]);
        this.notOffered.set([]);
        this.setupLoading.set(false);
        this.error.set('Pricing setup could not load device brands.');
        return;
      }
    }

    const brand =
      brands.find((row) => row.id === requestedBrandId) ??
      brands[0] ??
      null;

    if (!brand) {
      this.selectedBrandId.set(null);
      this.brandModels.set([]);
      this.setupOptions.set([]);
      this.notOffered.set([]);
      this.setupLoading.set(false);
      return;
    }

    const brandChanged =
      categoryChanged || this.selectedBrandId() !== brand.id;
    this.selectedBrandId.set(brand.id);
    if (!brandChanged && this.brandModels().length) return;

    this.setupLoading.set(true);
    try {
      const [modelsResponse, optionsResponse, notOfferedResponse] =
        await Promise.all([
          firstValueFrom(this.catalogApi.listManagedModels(brand.id, false)),
          firstValueFrom(
            this.pricingApi.listOptions({
              brandId: brand.id,
              includeInactive: true,
              includePrivate: true,
            }),
          ),
          firstValueFrom(this.pricingApi.listNotOffered({ brandId: brand.id })),
        ]);

      if (requestVersion !== this.setupLoadVersion) return;
      this.brandModels.set(modelsResponse.data ?? []);
      this.setupOptions.set(optionsResponse.data ?? []);
      this.notOffered.set(notOfferedResponse.data ?? []);
    } catch (error) {
      if (requestVersion !== this.setupLoadVersion) return;
      console.error(error);
      this.brandModels.set([]);
      this.setupOptions.set([]);
      this.notOffered.set([]);
      this.error.set('Pricing setup could not be loaded for this brand.');
    } finally {
      if (requestVersion === this.setupLoadVersion) {
        this.setupLoading.set(false);
      }
    }
  }

  private buildSetupRepairRow(
    model: ManagedDeviceCatalogModel,
    repairType: RepairType,
    options: PricingOption[],
  ): SetupRepairRow {
    const matching = options
      .filter(
        (option) =>
          option.deviceCatalogModelId === model.id &&
          option.repairNeedId === repairType.id,
      )
      .sort(
        (a, b) =>
          a.sortOrder - b.sortOrder ||
          a.variantName.localeCompare(b.variantName),
      );

    if (
      this.notOfferedKeys().has(this.setupRowKey(model.id, repairType.id))
    ) {
      return {
        repairType,
        options: matching,
        primaryOption: matching[0] ?? null,
        status: 'not_offered',
        ready: false,
        complete: true,
        optionCount: matching.length,
        activeOptionCount: 0,
        attentionCount: 0,
      };
    }

    if (!matching.length) {
      return {
        repairType,
        options: [],
        primaryOption: null,
        status: 'not_configured',
        ready: false,
        complete: false,
        optionCount: 0,
        activeOptionCount: 0,
        attentionCount: 1,
      };
    }

    const active = matching.filter((option) => option.isActive);
    if (!active.length) {
      return {
        repairType,
        options: matching,
        primaryOption: matching[0] ?? null,
        status: 'inactive',
        ready: false,
        complete: false,
        optionCount: matching.length,
        activeOptionCount: 0,
        attentionCount: matching.length,
      };
    }

    const incomplete = active
      .map((option) => ({
        option,
        status: this.optionSetupStatus(option),
      }))
      .filter((row) => row.status !== 'ready');

    if (incomplete.length) {
      return {
        repairType,
        options: matching,
        primaryOption: incomplete[0]!.option,
        status: incomplete[0]!.status,
        ready: false,
        complete: false,
        optionCount: matching.length,
        activeOptionCount: active.length,
        attentionCount: incomplete.length,
      };
    }

    return {
      repairType,
      options: matching,
      primaryOption: active[0] ?? matching[0] ?? null,
      status: 'ready',
      ready: true,
      complete: true,
      optionCount: matching.length,
      activeOptionCount: active.length,
      attentionCount: 0,
    };
  }

  private optionSetupStatus(option: PricingOption): SetupStatus {
    if (!option.isActive) return 'inactive';
    if (!option.serviceId) return 'needs_service';
    if (option.requiresProduct && !option.productId) return 'needs_product';
    if (!option.useDynamicPricing && option.fixedPriceCents == null) {
      return 'needs_price';
    }
    if (option.depositConfigurationError) return 'needs_deposit';
    return 'ready';
  }

  private async refreshSetupOptions(): Promise<void> {
    const brandId = this.selectedBrandId();
    if (!brandId || !this.brandModels().length) return;

    try {
      const [optionsResponse, notOfferedResponse] = await Promise.all([
        firstValueFrom(
          this.pricingApi.listOptions({
            brandId,
            includeInactive: true,
            includePrivate: true,
          }),
        ),
        firstValueFrom(this.pricingApi.listNotOffered({ brandId })),
      ]);
      this.setupOptions.set(optionsResponse.data ?? []);
      this.notOffered.set(notOfferedResponse.data ?? []);
    } catch (error) {
      console.error('Unable to refresh pricing setup', error);
    }
  }

  private async loadOptions(search: string): Promise<void> {
    this.listLoading.set(true);
    try {
      const response = await firstValueFrom(
        this.pricingApi.listOptions({
          search: search.trim() || undefined,
          includeInactive: true,
          includePrivate: true,
        }),
      );
      this.options.set(response.data ?? []);
      this.removeHiddenSelections();
    } finally {
      this.listLoading.set(false);
    }
  }

  private async confirmDeactivate(option: PricingOption): Promise<void> {
    try {
      await firstValueFrom(this.pricingApi.deactivateOption(option.id));
      this.toast.success('Pricing option deactivated');
      await this.loadOptions(this.pricingSearch());
      await this.refreshSetupOptions();
    } catch (error) {
      console.error(error);
      this.toast.error('Deactivate failed');
    }
  }

  private removeHiddenSelections(): void {
    const existing = new Set(this.options().map((option) => option.id));
    this.selectedOptionIds.update(
      (selected) => new Set([...selected].filter((id) => existing.has(id))),
    );
  }

  private modelToItem(model: ManagedDeviceCatalogModel): TypeaheadItem {
    return {
      id: model.id,
      label: model.name,
      description: `${model.categoryName} · ${model.brandName}`,
      meta: model.releaseYear ? String(model.releaseYear) : null,
    };
  }

  private returnQueryParams(): Record<string, string | null> {
    return {
      q: this.pricingSearch().trim() || null,
      model: this.selectedModel()?.id ?? null,
      type: this.selectedRepairType()?.id ?? null,
      status: this.statusFilter() === 'all' ? null : this.statusFilter(),
      visibility:
        this.visibilityFilter() === 'all' ? null : this.visibilityFilter(),
      view: this.viewMode(),
      category: this.selectedCategoryId(),
      brand: this.selectedBrandId(),
      setup: this.setupFilter() === 'attention' ? null : this.setupFilter(),
    };
  }

  private async updateQuery(
    queryParams: Record<string, string | null>,
  ): Promise<void> {
    await this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private parseStatus(value: string | null): StatusFilter {
    return value === 'active' || value === 'inactive' ? value : 'all';
  }

  private parseVisibility(value: string | null): VisibilityFilter {
    return value === 'public' || value === 'internal' ? value : 'all';
  }

  private parseViewMode(value: string | null): PricingViewMode {
    return value === 'list' ? 'list' : 'setup';
  }

  private parseSetupFilter(value: string | null): SetupFilter {
    return value === 'all' ||
      value === 'ready' ||
      value === 'not_configured' ||
      value === 'not_offered'
      ? value
      : 'attention';
  }

  private setupRowKey(modelId: string, repairNeedId: string): string {
    return `${modelId}:${repairNeedId}`;
  }

  private sortRepairTypes(rows: RepairType[]): RepairType[] {
    return [...rows].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label),
    );
  }
}
