import { CommonModule } from '@angular/common';
import {
  Component,
  HostListener,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import {
  CheckIcon,
  ChevronRightIcon,
  DollarSignIcon,
  GripVerticalIcon,
  LayersIcon,
  LucideAngularModule,
  PackageIcon,
  PlusIcon,
  SearchIcon,
  ToolboxIcon,
  WrenchIcon,
  XIcon,
} from 'lucide-angular';

import {
  ManagedDeviceCatalogBrand,
  ManagedDeviceCatalogCategory,
  ManagedDeviceCatalogModel,
  TechSpecsService,
} from '../../../core/techspecs/techspecs.service';
import {
  PricingOption,
  PricingOptionBulkAction,
  PricingOptionDepositMode,
  PricingOptionInput,
  RepairType,
  RepairTypeInput,
} from '../../../core/repair-pricing/model';
import { RepairPricingService } from '../../../core/repair-pricing/service';
import { ServicesService } from '../../../core/services/service';
import { Service } from '../../../core/services/model';
import { ProductsService } from '../../../core/products/products-service';
import { Product } from '../../../core/products/products-model';
import { ToastService } from '../../../core/toast/toast-service';

type PricingTab = 'pricing' | 'types';
type PriceAdjustmentMode =
  | 'set_price'
  | 'increase_fixed'
  | 'decrease_fixed'
  | 'increase_percent'
  | 'decrease_percent';

@Component({
  selector: 'app-repair-pricing',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, LucideAngularModule],
  templateUrl: './repair-pricing.html',
})
export class RepairPricingSettings implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly pricingApi = inject(RepairPricingService);
  private readonly catalogApi = inject(TechSpecsService);
  private readonly servicesApi = inject(ServicesService);
  private readonly productsApi = inject(ProductsService);
  private readonly toast = inject(ToastService);

  readonly icons = {
    Check: CheckIcon,
    ChevronRight: ChevronRightIcon,
    DollarSign: DollarSignIcon,
    Grip: GripVerticalIcon,
    Layers: LayersIcon,
    Package: PackageIcon,
    Plus: PlusIcon,
    Search: SearchIcon,
    Toolbox: ToolboxIcon,
    Wrench: WrenchIcon,
    X: XIcon,
  };

  readonly activeTab = signal<PricingTab>('pricing');
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly repairTypes = signal<RepairType[]>([]);
  readonly categories = signal<ManagedDeviceCatalogCategory[]>([]);
  readonly brands = signal<ManagedDeviceCatalogBrand[]>([]);
  readonly models = signal<ManagedDeviceCatalogModel[]>([]);
  readonly options = signal<PricingOption[]>([]);
  readonly services = signal<Service[]>([]);
  readonly products = signal<Product[]>([]);

  readonly selectedCategoryId = signal<string>('');
  readonly selectedBrandId = signal<string>('');
  readonly modelSearch = signal('');
  readonly selectedModelIds = signal<Set<string>>(new Set());
  readonly selectedOptionIds = signal<Set<string>>(new Set());

  readonly typeEditorOpen = signal(false);
  readonly optionEditorOpen = signal(false);
  readonly editingRepairTypeId = signal<string | null>(null);
  readonly editingOptionId = signal<string | null>(null);

  readonly draggedRepairTypeId = signal<string | null>(null);
  readonly draggedOptionId = signal<string | null>(null);

  readonly bulkAdjustmentMode = signal<PriceAdjustmentMode>('set_price');
  readonly bulkAdjustmentValue = signal<number | null>(null);
  readonly bulkServiceId = signal<string>('');
  readonly bulkProductId = signal<string>('');
  readonly bulkProductSupplierId = signal<string>('');

  readonly serviceLinkSearch = signal('');
  readonly productLinkSearch = signal('');
  readonly supplierLinkSearch = signal('');
  readonly serviceLinkOpen = signal(false);
  readonly productLinkOpen = signal(false);
  readonly supplierLinkOpen = signal(false);

  readonly repairTypeForm = this.fb.group({
    label: ['', [Validators.required, Validators.maxLength(120)]],
    code: [
      '',
      [
        Validators.required,
        Validators.maxLength(80),
        Validators.pattern(/^[a-z0-9_]+$/),
      ],
    ],
    description: ['', Validators.maxLength(1000)],
    supplierSearchTermsText: [''],
    defaultLaborDollars: [null as number | null, Validators.min(0)],
    defaultDurationMins: [60 as number | null, Validators.min(5)],
    isActive: [true],
    requiresManualReview: [false],
  });

  readonly optionForm = this.fb.group({
    repairNeedId: ['', Validators.required],
    variantName: [
      'Standard',
      [Validators.required, Validators.maxLength(120)],
    ],
    description: ['', Validators.maxLength(1000)],
    fixedPriceDollars: [null as number | null, Validators.min(0)],
    useDynamicPricing: [false],
    depositMode: ['none' as PricingOptionDepositMode],
    depositAmountDollars: [null as number | null, Validators.min(0.01)],
    laborDollars: [null as number | null, Validators.min(0)],
    durationMins: [null as number | null, Validators.min(5)],
    serviceId: [''],
    productId: [''],
    productSupplierId: [''],
    isActive: [true],
    isPublic: [false],
    allowInstantConfirmation: [true],
    requiresManualReview: [false],
    overwriteExisting: [true],
  });

  readonly activeRepairTypes = computed(() =>
    this.repairTypes().filter((type) => type.isActive),
  );

  readonly visibleModels = computed(() => {
    const search = this.normalize(this.modelSearch());
    const rows = this.models().filter((model) => model.isActive);

    if (!search) return rows;

    return rows.filter((model) =>
      this.normalize(
        `${model.name} ${model.releaseYear ?? ''} ${model.slug}`,
      ).includes(search),
    );
  });

  readonly selectedModels = computed(() => {
    const selected = this.selectedModelIds();
    return this.models().filter((model) => selected.has(model.id));
  });

  readonly singleSelectedModel = computed(() => {
    const models = this.selectedModels();
    return models.length === 1 ? models[0] : null;
  });

  readonly allVisibleModelsSelected = computed(() => {
    const visible = this.visibleModels();
    const selected = this.selectedModelIds();
    return visible.length > 0 && visible.every((model) => selected.has(model.id));
  });

  readonly someVisibleModelsSelected = computed(() => {
    const visible = this.visibleModels();
    const selected = this.selectedModelIds();
    const count = visible.filter((model) => selected.has(model.id)).length;
    return count > 0 && count < visible.length;
  });

  readonly groupedOptions = computed(() => {
    const groups = this.activeRepairTypes()
      .map((repairType) => ({
        repairType,
        options: this.options()
          .filter((option) => option.repairNeedId === repairType.id)
          .sort(
            (a, b) =>
              a.sortOrder - b.sortOrder ||
              a.variantName.localeCompare(b.variantName),
          ),
      }))
      .filter((group) => group.options.length > 0);

    const inactiveTypeOptions = this.options().filter(
      (option) =>
        !groups.some((group) => group.repairType.id === option.repairNeedId),
    );

    if (inactiveTypeOptions.length) {
      const typeMap = new Map<string, RepairType>(
        this.repairTypes().map((repairType) => [repairType.id, repairType]),
      );

      for (const option of inactiveTypeOptions) {
        const repairType = typeMap.get(option.repairNeedId);
        if (!repairType) continue;

        const existing = groups.find(
          (group) => group.repairType.id === repairType.id,
        );
        if (existing) {
          existing.options.push(option);
        } else {
          groups.push({ repairType, options: [option] });
        }
      }
    }

    return groups;
  });

  readonly selectedOptions = computed(() => {
    const selected = this.selectedOptionIds();
    return this.options().filter((option) => selected.has(option.id));
  });

  readonly selectedService = computed(() => {
    const serviceId = this.optionForm.controls.serviceId.value;
    return this.services().find((service) => service.id === serviceId) ?? null;
  });

  readonly selectedProduct = computed(() => {
    const productId = this.optionForm.controls.productId.value;
    return this.products().find((product) => product.id === productId) ?? null;
  });

  readonly optionSupplierLinks = computed(() =>
    this.supplierLinksForProduct(this.selectedProduct()),
  );

  readonly selectedSupplierLink = computed(() => {
    const supplierId = this.optionForm.controls.productSupplierId.value;
    return (
      this.optionSupplierLinks().find((link) => link.id === supplierId) ?? null
    );
  });

  readonly selectedDepositProductCostCents = computed(() => {
    const supplierCost = Number(
      this.selectedSupplierLink()?.lastKnownCostCents ?? NaN,
    );
    if (Number.isFinite(supplierCost) && supplierCost > 0) {
      return Math.round(supplierCost);
    }

    const product = this.selectedProduct() as
      | (Product & { cost?: number | null; costCents?: number | null })
      | null;
    const productCost = Number(product?.costCents ?? product?.cost ?? NaN);
    if (Number.isFinite(productCost) && productCost > 0) {
      return Math.round(productCost);
    }

    const productId = this.optionForm.controls.productId.value;
    const editingOption = this.options().find(
      (option) => option.id === this.editingOptionId(),
    );

    if (editingOption?.productId === productId) {
      const savedCost = Number(
        editingOption.productSupplier?.lastKnownCostCents ??
          editingOption.product?.costCents ??
          NaN,
      );
      if (Number.isFinite(savedCost) && savedCost > 0) {
        return Math.round(savedCost);
      }
    }

    return null;
  });

  readonly filteredServiceLinks = computed(() => {
    const search = this.normalize(this.serviceLinkSearch());
    const rows = this.services();

    if (!search) return rows.slice(0, 50);

    return rows
      .filter((service) =>
        this.normalize(this.serviceLabel(service)).includes(search),
      )
      .slice(0, 50);
  });

  readonly filteredProductLinks = computed(() => {
    const search = this.normalize(this.productLinkSearch());
    const rows = this.products();

    if (!search) return rows.slice(0, 50);

    return rows
      .filter((product) =>
        this.normalize(this.productLabel(product)).includes(search),
      )
      .slice(0, 50);
  });

  readonly filteredSupplierLinks = computed(() => {
    const search = this.normalize(this.supplierLinkSearch());
    const rows = this.optionSupplierLinks();

    if (!search) return rows.slice(0, 50);

    return rows
      .filter((link) =>
        this.normalize(this.supplierLinkLabel(link)).includes(search),
      )
      .slice(0, 50);
  });

  readonly bulkProductSupplierLinks = computed(() => {
    const product =
      this.products().find((item) => item.id === this.bulkProductId()) ?? null;
    return this.supplierLinksForProduct(product);
  });

  async ngOnInit(): Promise<void> {
    await this.loadInitialData();
  }

  setTab(tab: PricingTab): void {
    this.activeTab.set(tab);
    this.error.set(null);
  }

  optionEditorTitle(): string {
    if (this.editingOptionId()) return 'Edit Pricing Option';
    const count = this.selectedModels().length;
    return count > 1 ? `Apply to ${count} Models` : 'New Pricing Option';
  }

  private async loadInitialData(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const [repairTypes, categories, services, products] = await Promise.all([
        firstValueFrom(this.pricingApi.listRepairTypes()),
        firstValueFrom(this.catalogApi.listManagedCategories(true)),
        firstValueFrom(this.servicesApi.listActive(200)),
        firstValueFrom(
          this.productsApi.list({
            limit: 200,
            status: 'active',
            includeDeleted: false,
          }),
        ),
      ]);

      this.repairTypes.set(this.sortRepairTypes(repairTypes.data ?? []));
      this.categories.set(
        (categories.data ?? [])
          .filter((category) => category.isActive)
          .sort(
            (a, b) =>
              a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
          ),
      );
      this.services.set(services ?? []);
      this.products.set(products.data ?? []);

      const firstCategory = this.categories()[0] ?? null;
      if (firstCategory) {
        this.selectedCategoryId.set(firstCategory.id);
        await this.loadBrands(firstCategory.id);
      }
    } catch (error) {
      console.error(error);
      this.error.set('Repair pricing could not be loaded.');
    } finally {
      this.loading.set(false);
    }
  }

  async onCategoryChange(value: string): Promise<void> {
    this.selectedCategoryId.set(value);
    this.selectedBrandId.set('');
    this.brands.set([]);
    this.models.set([]);
    this.clearModelSelection();

    if (value) await this.loadBrands(value);
  }

  async onBrandChange(value: string): Promise<void> {
    this.selectedBrandId.set(value);
    this.models.set([]);
    this.clearModelSelection();

    if (value) await this.loadModels(value);
  }

  private async loadBrands(categoryId: string): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.catalogApi.listManagedBrands(categoryId, true),
      );
      const rows = (response.data ?? [])
        .filter((brand) => brand.isActive)
        .sort(
          (a, b) =>
            a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
        );

      this.brands.set(rows);
      const firstBrand = rows[0] ?? null;
      if (firstBrand) {
        this.selectedBrandId.set(firstBrand.id);
        await this.loadModels(firstBrand.id);
      }
    } catch (error) {
      console.error(error);
      this.error.set('Catalog brands could not be loaded.');
    }
  }

  private async loadModels(brandId: string): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.catalogApi.listManagedModels(brandId, true),
      );
      this.models.set(
        (response.data ?? [])
          .filter((model) => model.isActive)
          .sort((a, b) => {
            const year = (b.releaseYear ?? 0) - (a.releaseYear ?? 0);
            if (year !== 0) return year;
            return a.name.localeCompare(b.name, undefined, { numeric: true });
          }),
      );
    } catch (error) {
      console.error(error);
      this.error.set('Catalog models could not be loaded.');
    }
  }

  onModelSearch(value: string): void {
    this.modelSearch.set(value);
  }

  async toggleModel(modelId: string): Promise<void> {
    const next = new Set(this.selectedModelIds());
    if (next.has(modelId)) next.delete(modelId);
    else next.add(modelId);

    this.selectedModelIds.set(next);
    this.selectedOptionIds.set(new Set());
    this.optionEditorOpen.set(false);
    this.editingOptionId.set(null);

    await this.refreshOptionsForSelection();
  }

  async toggleAllVisibleModels(): Promise<void> {
    const next = new Set(this.selectedModelIds());
    const visible = this.visibleModels();
    const allSelected = visible.every((model) => next.has(model.id));

    for (const model of visible) {
      if (allSelected) next.delete(model.id);
      else next.add(model.id);
    }

    this.selectedModelIds.set(next);
    this.selectedOptionIds.set(new Set());
    this.optionEditorOpen.set(false);
    this.editingOptionId.set(null);
    await this.refreshOptionsForSelection();
  }

  async selectOnlyModel(modelId: string): Promise<void> {
    this.selectedModelIds.set(new Set([modelId]));
    this.selectedOptionIds.set(new Set());
    this.optionEditorOpen.set(false);
    this.editingOptionId.set(null);
    await this.refreshOptionsForSelection();
  }

  clearModelSelection(): void {
    this.selectedModelIds.set(new Set());
    this.selectedOptionIds.set(new Set());
    this.options.set([]);
    this.optionEditorOpen.set(false);
    this.editingOptionId.set(null);
  }

  private async refreshOptionsForSelection(): Promise<void> {
    const model = this.singleSelectedModel();
    if (!model) {
      this.options.set([]);
      return;
    }

    await this.loadOptions(model.id);
  }

  private async loadOptions(modelId: string): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.pricingApi.listOptions({
          modelId,
          includeInactive: true,
          includePrivate: true,
        }),
      );
      this.options.set(response.data ?? []);
    } catch (error) {
      console.error(error);
      this.error.set('Pricing options could not be loaded.');
    }
  }

  openNewRepairType(): void {
    this.editingRepairTypeId.set(null);
    this.repairTypeForm.reset({
      label: '',
      code: '',
      description: '',
      supplierSearchTermsText: '',
      defaultLaborDollars: null,
      defaultDurationMins: 60,
      isActive: true,
      requiresManualReview: false,
    });
    this.typeEditorOpen.set(true);
  }

  editRepairType(repairType: RepairType): void {
    this.editingRepairTypeId.set(repairType.id);
    this.repairTypeForm.reset({
      label: repairType.label,
      code: repairType.code,
      description: repairType.description ?? '',
      supplierSearchTermsText: repairType.supplierSearchTerms.join(', '),
      defaultLaborDollars: this.centsToDollars(repairType.defaultLaborCents),
      defaultDurationMins: repairType.defaultDurationMins ?? 60,
      isActive: repairType.isActive,
      requiresManualReview: repairType.requiresManualReview,
    });
    this.typeEditorOpen.set(true);
  }

  closeRepairTypeEditor(): void {
    this.typeEditorOpen.set(false);
    this.editingRepairTypeId.set(null);
  }

  onRepairTypeLabelInput(value: string): void {
    if (this.editingRepairTypeId()) return;
    const currentCode = this.repairTypeForm.controls.code.value ?? '';
    if (currentCode.trim()) return;
    this.repairTypeForm.controls.code.setValue(this.slugCode(value));
  }

  async saveRepairType(): Promise<void> {
    if (this.repairTypeForm.invalid) {
      this.repairTypeForm.markAllAsTouched();
      return;
    }

    const raw = this.repairTypeForm.getRawValue();
    const payload: RepairTypeInput = {
      label: String(raw.label ?? '').trim(),
      code: String(raw.code ?? '').trim(),
      description: this.nullable(raw.description),
      supplierSearchTerms: this.commaList(raw.supplierSearchTermsText),
      defaultLaborCents: this.optionalDollarsToCents(
        raw.defaultLaborDollars,
      ),
      defaultDurationMins:
        raw.defaultDurationMins == null
          ? null
          : Number(raw.defaultDurationMins),
      isActive: Boolean(raw.isActive),
      requiresManualReview: Boolean(raw.requiresManualReview),
      sortOrder: this.editingRepairTypeId()
        ? undefined
        : this.nextRepairTypeSortOrder(),
    };

    this.saving.set(true);
    try {
      const editingId = this.editingRepairTypeId();
      const saved = editingId
        ? await firstValueFrom(
            this.pricingApi.updateRepairType(editingId, payload),
          )
        : await firstValueFrom(this.pricingApi.createRepairType(payload));

      this.repairTypes.set(
        this.sortRepairTypes(
          editingId
            ? this.repairTypes().map((item) =>
                item.id === saved.id ? saved : item,
              )
            : [...this.repairTypes(), saved],
        ),
      );
      this.closeRepairTypeEditor();
      this.toast.success(
        editingId ? 'Repair type updated' : 'Repair type created',
        `${saved.label} is ready to use in repair pricing.`,
      );
    } catch (error) {
      console.error(error);
      this.toast.error(
        'Repair type not saved',
        'Check the code and details, then try again.',
      );
    } finally {
      this.saving.set(false);
    }
  }

  async deactivateRepairType(repairType: RepairType): Promise<void> {
    if (
      !window.confirm(
        `Deactivate “${repairType.label}”? Its device pricing options will also become inactive.`,
      )
    ) {
      return;
    }

    this.saving.set(true);
    try {
      const updated = await firstValueFrom(
        this.pricingApi.deactivateRepairType(repairType.id),
      );
      this.repairTypes.set(
        this.sortRepairTypes(
          this.repairTypes().map((item) =>
            item.id === updated.id ? updated : item,
          ),
        ),
      );
      await this.refreshOptionsForSelection();
    } catch (error) {
      console.error(error);
      this.toast.error(
        'Repair type not deactivated',
        'Please try again.',
      );
    } finally {
      this.saving.set(false);
    }
  }

  onRepairTypeDragStart(event: DragEvent, id: string): void {
    this.draggedRepairTypeId.set(id);
    event.dataTransfer?.setData('text/plain', id);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  async onRepairTypeDrop(event: DragEvent, targetId: string): Promise<void> {
    event.preventDefault();
    const sourceId = this.draggedRepairTypeId();
    this.draggedRepairTypeId.set(null);
    if (!sourceId || sourceId === targetId) return;

    const reordered = this.moveById(this.repairTypes(), sourceId, targetId).map(
      (item, index) => ({ ...item, sortOrder: index * 10 }),
    );
    this.repairTypes.set(reordered);

    try {
      await firstValueFrom(
        this.pricingApi.reorderRepairTypes(reordered.map((item) => item.id)),
      );
    } catch (error) {
      console.error(error);
      this.toast.error(
        'Order not saved',
        'The repair type order could not be updated.',
      );
      const refreshed = await firstValueFrom(
        this.pricingApi.listRepairTypes(),
      );
      this.repairTypes.set(this.sortRepairTypes(refreshed.data ?? []));
    }
  }

  openNewOption(): void {
    if (!this.selectedModels().length) return;

    this.editingOptionId.set(null);
    this.optionForm.reset({
      repairNeedId: this.activeRepairTypes()[0]?.id ?? '',
      variantName: 'Standard',
      description: '',
      fixedPriceDollars: null,
      useDynamicPricing: false,
      depositMode: 'none',
      depositAmountDollars: null,
      laborDollars: null,
      durationMins: null,
      serviceId: '',
      productId: '',
      productSupplierId: '',
      isActive: true,
      isPublic: false,
      allowInstantConfirmation: true,
      requiresManualReview: false,
      overwriteExisting: true,
    });
    this.resetOptionLinkTypeaheads();
    this.optionEditorOpen.set(true);
  }

  editOption(option: PricingOption): void {
    this.editingOptionId.set(option.id);
    this.optionForm.reset({
      repairNeedId: option.repairNeedId,
      variantName: option.variantName,
      description: option.description ?? '',
      fixedPriceDollars: this.centsToDollars(option.fixedPriceCents),
      useDynamicPricing: option.useDynamicPricing,
      depositMode: option.depositMode ?? 'none',
      depositAmountDollars: this.centsToDollars(option.depositAmountCents),
      laborDollars: this.centsToDollars(option.laborCents),
      durationMins: option.durationMins,
      serviceId: option.serviceId ?? '',
      productId: option.productId ?? '',
      productSupplierId: option.productSupplierId ?? '',
      isActive: option.isActive,
      isPublic: option.isPublic,
      allowInstantConfirmation: option.allowInstantConfirmation,
      requiresManualReview: option.requiresManualReview,
      overwriteExisting: true,
    });
    this.syncOptionLinkTypeaheads(option);
    this.optionEditorOpen.set(true);
  }

  closeOptionEditor(): void {
    this.optionEditorOpen.set(false);
    this.editingOptionId.set(null);
    this.closeLinkTypeaheads();
  }

  setDepositMode(mode: PricingOptionDepositMode): void {
    if (
      mode === 'product_cost' &&
      this.selectedDepositProductCostCents() == null
    ) {
      this.toast.error(
        'Product cost unavailable',
        'Link a product with a recorded cost, or enter a custom deposit amount.',
      );
      return;
    }

    this.optionForm.controls.depositMode.setValue(mode);

    if (mode !== 'custom') {
      this.optionForm.controls.depositAmountDollars.setValue(null);
    }
  }

  onServiceLinkInput(value: string): void {
    this.serviceLinkSearch.set(value);
    this.serviceLinkOpen.set(true);

    const selected = this.selectedService();
    if (!selected || this.serviceLabel(selected) !== value) {
      this.optionForm.controls.serviceId.setValue('');
    }
  }

  openServiceLinkTypeahead(): void {
    this.productLinkOpen.set(false);
    this.supplierLinkOpen.set(false);
    this.serviceLinkOpen.set(true);
  }

  selectServiceLink(service: Service): void {
    this.optionForm.controls.serviceId.setValue(service.id);
    this.serviceLinkSearch.set(this.serviceLabel(service));
    this.serviceLinkOpen.set(false);
  }

  clearServiceLink(): void {
    this.optionForm.controls.serviceId.setValue('');
    this.serviceLinkSearch.set('');
    this.serviceLinkOpen.set(false);
  }

  onProductLinkInput(value: string): void {
    this.productLinkSearch.set(value);
    this.productLinkOpen.set(true);

    const selected = this.selectedProduct();
    if (!selected || this.productLabel(selected) !== value) {
      this.optionForm.controls.productId.setValue('');
      this.optionForm.controls.productSupplierId.setValue('');
      if (this.optionForm.controls.depositMode.value === 'product_cost') {
        this.optionForm.controls.depositMode.setValue('none');
      }
      this.supplierLinkSearch.set('');
      this.supplierLinkOpen.set(false);
    }
  }

  openProductLinkTypeahead(): void {
    this.serviceLinkOpen.set(false);
    this.supplierLinkOpen.set(false);
    this.productLinkOpen.set(true);
  }

  selectProductLink(product: Product): void {
    this.optionForm.controls.productId.setValue(product.id);
    this.optionForm.controls.productSupplierId.setValue('');
    this.productLinkSearch.set(this.productLabel(product));
    this.supplierLinkSearch.set('');
    if (
      this.optionForm.controls.depositMode.value === 'product_cost' &&
      this.selectedDepositProductCostCents() == null
    ) {
      this.optionForm.controls.depositMode.setValue('none');
    }
    this.productLinkOpen.set(false);
    this.supplierLinkOpen.set(false);
  }

  clearProductLink(): void {
    this.optionForm.controls.productId.setValue('');
    this.optionForm.controls.productSupplierId.setValue('');
    if (this.optionForm.controls.depositMode.value === 'product_cost') {
      this.optionForm.controls.depositMode.setValue('none');
    }
    this.productLinkSearch.set('');
    this.supplierLinkSearch.set('');
    this.productLinkOpen.set(false);
    this.supplierLinkOpen.set(false);
  }

  onSupplierLinkInput(value: string): void {
    if (!this.selectedProduct()) return;

    this.supplierLinkSearch.set(value);
    this.supplierLinkOpen.set(true);

    const selected = this.selectedSupplierLink();
    if (!selected || this.supplierLinkLabel(selected) !== value) {
      this.optionForm.controls.productSupplierId.setValue('');
    }
  }

  openSupplierLinkTypeahead(): void {
    if (!this.selectedProduct()) return;

    this.serviceLinkOpen.set(false);
    this.productLinkOpen.set(false);
    this.supplierLinkOpen.set(true);
  }

  selectSupplierLink(link: any): void {
    this.optionForm.controls.productSupplierId.setValue(link.id);
    this.supplierLinkSearch.set(this.supplierLinkLabel(link));
    this.supplierLinkOpen.set(false);
  }

  clearSupplierLink(): void {
    this.optionForm.controls.productSupplierId.setValue('');
    this.supplierLinkSearch.set('');
    this.supplierLinkOpen.set(false);
  }

  @HostListener('document:click')
  closeLinkTypeaheads(): void {
    this.serviceLinkOpen.set(false);
    this.productLinkOpen.set(false);
    this.supplierLinkOpen.set(false);
  }

  async saveOption(): Promise<void> {
    if (this.optionForm.invalid || !this.selectedModels().length) {
      this.optionForm.markAllAsTouched();
      return;
    }

    const raw = this.optionForm.getRawValue();
    const fixedPriceCents = this.optionalDollarsToCents(
      raw.fixedPriceDollars,
    );

    if (!raw.useDynamicPricing && fixedPriceCents == null) {
      this.toast.error(
        'Price required',
        'Enter a fixed price or enable dynamic pricing.',
      );
      return;
    }

    const depositMode = (raw.depositMode ?? 'none') as PricingOptionDepositMode;
    const customDepositAmountCents = this.optionalDollarsToCents(
      raw.depositAmountDollars,
    );

    if (
      depositMode === 'product_cost' &&
      this.selectedDepositProductCostCents() == null
    ) {
      this.toast.error(
        'Product cost unavailable',
        'Link a product with a recorded cost, or choose a custom deposit amount.',
      );
      return;
    }

    if (depositMode === 'custom' && customDepositAmountCents == null) {
      this.toast.error(
        'Deposit amount required',
        'Enter the custom deposit amount for this pricing option.',
      );
      return;
    }

    const common = {
      repairNeedId: String(raw.repairNeedId ?? ''),
      variantName: String(raw.variantName ?? '').trim(),
      description: this.nullable(raw.description),
      isActive: Boolean(raw.isActive),
      isPublic: Boolean(raw.isPublic),
      serviceId: this.nullable(raw.serviceId),
      productId: this.nullable(raw.productId),
      productSupplierId: this.nullable(raw.productSupplierId),
      fixedPriceCents,
      useDynamicPricing: Boolean(raw.useDynamicPricing),
      depositMode,
      depositAmountCents:
        depositMode === 'custom' ? customDepositAmountCents : null,
      laborCents: this.optionalDollarsToCents(raw.laborDollars),
      durationMins:
        raw.durationMins == null ? null : Number(raw.durationMins),
      allowInstantConfirmation: Boolean(raw.allowInstantConfirmation),
      requiresManualReview: Boolean(raw.requiresManualReview),
    };

    this.saving.set(true);
    try {
      const editingId = this.editingOptionId();
      const models = this.selectedModels();

      if (editingId) {
        const current = this.options().find((item) => item.id === editingId);
        if (!current?.deviceCatalogModelId) return;

        const payload: PricingOptionInput = {
          ...common,
          deviceCatalogModelId: current.deviceCatalogModelId,
          sortOrder: current.sortOrder,
        };
        const saved = await firstValueFrom(
          this.pricingApi.updateOption(editingId, payload),
        );
        this.options.set(
          this.options().map((item) =>
            item.id === saved.id ? saved : item,
          ),
        );
      } else if (models.length === 1) {
        const payload: PricingOptionInput = {
          ...common,
          deviceCatalogModelId: models[0].id,
          sortOrder: this.nextOptionSortOrder(common.repairNeedId),
        };
        const saved = await firstValueFrom(
          this.pricingApi.createOption(payload),
        );
        this.options.set([...this.options(), saved]);
      } else {
        const result = await firstValueFrom(
          this.pricingApi.bulkAssign({
            ...common,
            modelIds: models.map((model) => model.id),
            overwriteExisting: Boolean(raw.overwriteExisting),
          }),
        );
        this.toast.success(
          'Bulk pricing applied',
          `${result.createdCount} created, ${result.updatedCount} updated, and ${result.skippedCount} skipped.`,
        );
      }

      this.closeOptionEditor();
      await this.refreshOptionsForSelection();
    } catch (error) {
      console.error(error);
      this.toast.error(
        'Pricing option not saved',
        'Review the selected repair type, price, and optional links.',
      );
    } finally {
      this.saving.set(false);
    }
  }

  async deactivateOption(option: PricingOption): Promise<void> {
    if (!window.confirm(`Deactivate “${option.variantName}”?`)) return;

    try {
      const updated = await firstValueFrom(
        this.pricingApi.deactivateOption(option.id),
      );
      this.options.set(
        this.options().map((item) =>
          item.id === updated.id ? updated : item,
        ),
      );
      this.selectedOptionIds.update((current) => {
        const next = new Set(current);
        next.delete(option.id);
        return next;
      });
    } catch (error) {
      console.error(error);
      this.toast.error('Option not deactivated', 'Please try again.');
    }
  }

  toggleOptionSelection(optionId: string): void {
    this.selectedOptionIds.update((current) => {
      const next = new Set(current);
      if (next.has(optionId)) next.delete(optionId);
      else next.add(optionId);
      return next;
    });
  }

  clearOptionSelection(): void {
    this.selectedOptionIds.set(new Set());
  }

  async runBulkStatusAction(action: PricingOptionBulkAction): Promise<void> {
    await this.runBulkAction(action, {});
  }

  async applyBulkPriceAdjustment(): Promise<void> {
    const value = this.bulkAdjustmentValue();
    if (value == null || value < 0) {
      this.toast.error('Value required', 'Enter an amount to apply.');
      return;
    }

    const mode = this.bulkAdjustmentMode();
    const amount = mode.includes('percent')
      ? value
      : Math.round(value * 100);

    await this.runBulkAction(mode, { amount });
  }

  async applyBulkService(): Promise<void> {
    await this.runBulkAction('set_service', {
      serviceId: this.bulkServiceId() || null,
    });
  }

  async applyBulkProduct(): Promise<void> {
    await this.runBulkAction('set_product', {
      productId: this.bulkProductId() || null,
    });
  }

  async applyBulkProductSupplier(): Promise<void> {
    await this.runBulkAction('set_product_supplier', {
      productSupplierId: this.bulkProductSupplierId() || null,
    });
  }

  private async runBulkAction(
    action: PricingOptionBulkAction,
    extra: {
      amount?: number;
      serviceId?: string | null;
      productId?: string | null;
      productSupplierId?: string | null;
    },
  ): Promise<void> {
    const ids = [...this.selectedOptionIds()];
    if (!ids.length) return;

    this.saving.set(true);
    try {
      const result = await firstValueFrom(
        this.pricingApi.bulkAction({ ids, action, ...extra }),
      );
      await this.refreshOptionsForSelection();
      this.clearOptionSelection();
      this.toast.success(
        'Bulk update complete',
        `${result.updatedCount} pricing option${result.updatedCount === 1 ? '' : 's'} updated.`,
      );
    } catch (error) {
      console.error(error);
      this.toast.error('Bulk update failed', 'Please try again.');
    } finally {
      this.saving.set(false);
    }
  }

  onOptionDragStart(event: DragEvent, option: PricingOption): void {
    this.draggedOptionId.set(option.id);
    event.dataTransfer?.setData('text/plain', option.id);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  async onOptionDrop(
    event: DragEvent,
    target: PricingOption,
  ): Promise<void> {
    event.preventDefault();
    const sourceId = this.draggedOptionId();
    this.draggedOptionId.set(null);
    if (!sourceId || sourceId === target.id) return;

    const source = this.options().find((option) => option.id === sourceId);
    if (!source || source.repairNeedId !== target.repairNeedId) return;

    const group = this.options()
      .filter((option) => option.repairNeedId === target.repairNeedId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const reordered = this.moveById(group, sourceId, target.id).map(
      (option, index) => ({ ...option, sortOrder: index * 10 }),
    );
    const orderMap = new Map(reordered.map((option) => [option.id, option]));
    this.options.set(
      this.options().map((option) => orderMap.get(option.id) ?? option),
    );

    try {
      await firstValueFrom(
        this.pricingApi.reorderOptions(reordered.map((option) => option.id)),
      );
    } catch (error) {
      console.error(error);
      this.toast.error('Order not saved', 'The option order could not be updated.');
      const model = this.singleSelectedModel();
      if (model) await this.loadOptions(model.id);
    }
  }

  optionPriceLabel(option: PricingOption): string {
    if (option.useDynamicPricing) {
      return option.fixedPriceCents != null
        ? `Dynamic · fallback ${this.money(option.fixedPriceCents)}`
        : 'Dynamic pricing';
    }

    return option.fixedPriceCents == null
      ? 'Price not set'
      : this.money(option.fixedPriceCents);
  }

  optionDepositLabel(option: PricingOption): string {
    if (option.depositMode === 'custom') {
      return option.depositAmountCents == null
        ? 'Custom deposit'
        : `Deposit ${this.money(option.depositAmountCents)}`;
    }

    if (option.depositMode === 'product_cost') {
      const cost =
        option.productSupplier?.lastKnownCostCents ??
        option.product?.costCents ??
        null;
      return cost == null
        ? 'Deposit: product cost'
        : `Deposit ${this.money(cost)}`;
    }

    return 'No deposit';
  }

  optionLinksLabel(option: PricingOption): string {
    const links = [
      option.service?.name ? `Service: ${option.service.name}` : null,
      option.product?.name ? `Product: ${option.product.name}` : null,
      option.productSupplier?.supplierSku
        ? `Supplier SKU: ${option.productSupplier.supplierSku}`
        : null,
    ].filter(Boolean);

    return links.length ? links.join(' · ') : 'No product or service linked';
  }

  private resetOptionLinkTypeaheads(): void {
    this.serviceLinkSearch.set('');
    this.productLinkSearch.set('');
    this.supplierLinkSearch.set('');
    this.closeLinkTypeaheads();
  }

  private syncOptionLinkTypeaheads(option: PricingOption): void {
    const service =
      this.services().find((item) => item.id === option.serviceId) ?? null;
    const product =
      this.products().find((item) => item.id === option.productId) ?? null;
    const supplierLink =
      this.supplierLinksForProduct(product).find(
        (item) => item.id === option.productSupplierId,
      ) ?? null;

    this.serviceLinkSearch.set(
      service ? this.serviceLabel(service) : option.service?.name ?? '',
    );
    this.productLinkSearch.set(
      product ? this.productLabel(product) : option.product?.name ?? '',
    );
    this.supplierLinkSearch.set(
      supplierLink
        ? this.supplierLinkLabel(supplierLink)
        : option.productSupplier?.supplierSku ?? '',
    );
    this.closeLinkTypeaheads();
  }

  productLabel(product: Product): string {
    const sku = product.sku ? ` · ${product.sku}` : '';
    return `${product.name}${sku}`;
  }

  serviceLabel(service: Service): string {
    const duration = service.duration ? ` · ${service.duration} min` : '';
    return `${service.name} · ${this.money(service.price)}${duration}`;
  }

  supplierLinkLabel(link: any): string {
    const supplier = link.supplierName || 'Supplier';
    const cost =
      link.lastKnownCostCents == null
        ? ''
        : ` · ${this.money(link.lastKnownCostCents)}`;
    return `${supplier} · ${link.supplierSku}${cost}`;
  }

  money(cents: number | null | undefined): string {
    if (cents == null) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  }

  private supplierLinksForProduct(product: Product | null): any[] {
    if (!product) return [];
    const links = (product as Product & { supplierLinks?: any[] })
      .supplierLinks;
    return Array.isArray(links) ? links : [];
  }

  private sortRepairTypes(rows: RepairType[]): RepairType[] {
    return [...rows].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label),
    );
  }

  private nextRepairTypeSortOrder(): number {
    return (
      this.repairTypes().reduce(
        (maximum, repairType) => Math.max(maximum, repairType.sortOrder),
        -10,
      ) + 10
    );
  }

  private nextOptionSortOrder(repairNeedId: string): number {
    return (
      this.options()
        .filter((option) => option.repairNeedId === repairNeedId)
        .reduce(
          (maximum, option) => Math.max(maximum, option.sortOrder),
          -10,
        ) + 10
    );
  }

  private moveById<T extends { id: string }>(
    rows: T[],
    sourceId: string,
    targetId: string,
  ): T[] {
    const next = [...rows];
    const sourceIndex = next.findIndex((item) => item.id === sourceId);
    const targetIndex = next.findIndex((item) => item.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0) return next;
    const [moved] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, moved);
    return next;
  }

  private slugCode(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  private normalize(value: unknown): string {
    return String(value ?? '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ');
  }

  private commaList(value: string | null | undefined): string[] {
    return String(value ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private nullable(value: string | null | undefined): string | null {
    const trimmed = String(value ?? '').trim();
    return trimmed || null;
  }

  private optionalDollarsToCents(
    value: number | string | null | undefined,
  ): number | null {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? Math.round(number * 100) : null;
  }

  private centsToDollars(value: number | null | undefined): number | null {
    return value == null ? null : value / 100;
  }
}
