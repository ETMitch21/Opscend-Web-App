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
  ManagedDeviceCatalogModel,
  TechSpecsService,
} from '../../../core/techspecs/techspecs.service';
import {
  PricingOption,
  PricingOptionBulkAction,
  RepairType,
} from '../../../core/repair-pricing/model';
import { RepairPricingService } from '../../../core/repair-pricing/service';
import { ToastService } from '../../../core/toast/toast-service';
import { SettingsLayoutComponent } from '../settings-layout/settings-layout';

type StatusFilter = 'all' | 'active' | 'inactive';
type VisibilityFilter = 'all' | 'public' | 'internal';

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
  readonly bulkSaving = signal(false);
  readonly error = signal<string | null>(null);

  readonly options = signal<PricingOption[]>([]);
  readonly repairTypes = signal<RepairType[]>([]);
  readonly modelSuggestions = signal<ManagedDeviceCatalogModel[]>([]);

  readonly pricingSearch = signal('');
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

  private readonly pricingSearch$ = new Subject<string>();
  private readonly modelSearch$ = new Subject<string>();
  private readonly subscriptions = new Subscription();
  private routeFingerprint = '';

  async ngOnInit(): Promise<void> {
    this.bindSearchStreams();

    try {
      const typesResponse = await firstValueFrom(this.pricingApi.listRepairTypes());
      this.repairTypes.set(this.sortRepairTypes(typesResponse.data ?? []));

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

  newOption(): void {
    void this.router.navigate(['/settings/shop/repair-pricing/new'], {
      queryParams: {
        model: this.selectedModel()?.id ?? null,
        type: this.selectedRepairType()?.id ?? null,
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
            this.modelLoading.set(true);
            return this.catalogApi
              .searchManagedModels({
                includeInactive: false,
                search,
                limit: 50,
              })
              .pipe(
                catchError((error) => {
                  console.error(error);
                  return of({ data: [] as ManagedDeviceCatalogModel[] });
                }),
                finalize(() => this.modelLoading.set(false)),
              );
          }),
        )
        .subscribe((response) => {
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

  private async applyRouteState(params: import('@angular/router').ParamMap): Promise<void> {
    const q = params.get('q') ?? '';
    const modelId = params.get('model') ?? '';
    const repairTypeId = params.get('type') ?? '';
    const status = this.parseStatus(params.get('status'));
    const visibility = this.parseVisibility(params.get('visibility'));
    const fingerprint = [q, modelId, repairTypeId, status, visibility].join('|');
    if (fingerprint === this.routeFingerprint) return;
    this.routeFingerprint = fingerprint;

    this.pricingSearch.set(q);
    this.statusFilter.set(status);
    this.visibilityFilter.set(visibility);
    this.selectedRepairType.set(
      this.repairTypes().find((type) => type.id === repairTypeId) ?? null,
    );

    if (modelId && this.selectedModel()?.id !== modelId) {
      try {
        const model = await firstValueFrom(this.catalogApi.getManagedModel(modelId));
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

    this.selectedOptionIds.set(new Set());
    this.pricingSearch$.next(q);
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

  private sortRepairTypes(rows: RepairType[]): RepairType[] {
    return [...rows].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label),
    );
  }
}
