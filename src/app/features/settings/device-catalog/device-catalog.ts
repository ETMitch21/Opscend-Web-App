import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import {
  Boxes,
  ChevronRight,
  Database,
  Download,
  Loader2,
  LucideAngularModule,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Smartphone,
  X,
} from 'lucide-angular';

import {
  DeviceCatalogBrandInput,
  DeviceCatalogBulkAction,
  DeviceCatalogBulkEntity,
  DeviceCatalogCategoryInput,
  DeviceCatalogModelInput,
  DeviceCatalogSyncStatus,
  ManagedDeviceCatalogBrand,
  ManagedDeviceCatalogCategory,
  ManagedDeviceCatalogModel,
  TechSpecsService,
} from '../../../core/techspecs/techspecs.service';
import { ToastService } from '../../../core/toast/toast-service';

type EditorType = 'category' | 'brand' | 'model';

@Component({
  selector: 'app-device-catalog-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './device-catalog.html',
})
export class DeviceCatalogSettings implements OnInit {
  private readonly catalogService = inject(TechSpecsService);
  private readonly toast = inject(ToastService);

  readonly icons = {
    Boxes,
    ChevronRight,
    Database,
    Download,
    Loader2,
    Pencil,
    Plus,
    RefreshCw,
    Search,
    Smartphone,
    X,
  };

  readonly loadingCategories = signal(false);
  readonly loadingBrands = signal(false);
  readonly loadingModels = signal(false);
  readonly saving = signal(false);
  readonly importing = signal(false);
  readonly loadingSyncStatus = signal(false);
  readonly error = signal<string | null>(null);
  readonly syncStatus = signal<DeviceCatalogSyncStatus | null>(null);

  readonly categories = signal<ManagedDeviceCatalogCategory[]>([]);
  readonly brands = signal<ManagedDeviceCatalogBrand[]>([]);
  readonly models = signal<ManagedDeviceCatalogModel[]>([]);

  readonly selectedCategoryId = signal<string | null>(null);
  readonly selectedBrandId = signal<string | null>(null);
  readonly modelSearch = signal('');

  readonly selectedCategoryIds = signal<Set<string>>(new Set());
  readonly selectedBrandIds = signal<Set<string>>(new Set());
  readonly selectedModelIds = signal<Set<string>>(new Set());
  readonly bulkBusyEntity = signal<DeviceCatalogBulkEntity | null>(null);

  readonly editorType = signal<EditorType | null>(null);
  readonly editingId = signal<string | null>(null);

  categoryName = '';
  categorySortOrder = 0;
  categoryIsActive = true;
  categoryIsPublic = true;

  brandName = '';
  brandSortOrder = 0;
  brandIsActive = true;
  brandIsPublic = true;

  modelName = '';
  modelReleaseYear: number | null = null;
  modelSortOrder = 0;
  modelIsActive = true;
  modelIsPublic = true;
  modelExternalProvider = '';
  modelExternalProductId = '';

  readonly selectedCategory = computed(() =>
    this.categories().find((item) => item.id === this.selectedCategoryId()) ?? null
  );

  readonly selectedBrand = computed(() =>
    this.brands().find((item) => item.id === this.selectedBrandId()) ?? null
  );

  readonly filteredModels = computed(() => {
    const search = this.modelSearch().trim().toLowerCase();
    if (!search) return this.models();

    const tokens = search.split(/\s+/).filter(Boolean);
    return this.models().filter((model) => {
      const value = `${model.name} ${model.releaseYear ?? ''}`.toLowerCase();
      return tokens.every((token) => value.includes(token));
    });
  });

  readonly selectedCategoryCount = computed(() => this.selectedCategoryIds().size);
  readonly selectedBrandCount = computed(() => this.selectedBrandIds().size);
  readonly selectedModelCount = computed(() => this.selectedModelIds().size);

  readonly allCategoriesSelected = computed(() => {
    const items = this.categories();
    const selected = this.selectedCategoryIds();
    return items.length > 0 && items.every((item) => selected.has(item.id));
  });

  readonly someCategoriesSelected = computed(() => {
    const items = this.categories();
    const selected = this.selectedCategoryIds();
    return items.some((item) => selected.has(item.id));
  });

  readonly allBrandsSelected = computed(() => {
    const items = this.brands();
    const selected = this.selectedBrandIds();
    return items.length > 0 && items.every((item) => selected.has(item.id));
  });

  readonly someBrandsSelected = computed(() => {
    const items = this.brands();
    const selected = this.selectedBrandIds();
    return items.some((item) => selected.has(item.id));
  });

  readonly allVisibleModelsSelected = computed(() => {
    const items = this.filteredModels();
    const selected = this.selectedModelIds();
    return items.length > 0 && items.every((item) => selected.has(item.id));
  });

  readonly someVisibleModelsSelected = computed(() => {
    const items = this.filteredModels();
    const selected = this.selectedModelIds();
    return items.some((item) => selected.has(item.id));
  });

  readonly syncButtonLabel = computed(() => {
    if (this.importing()) return 'Updating...';

    const status = this.syncStatus();
    if (!status || status.lastSyncedRevision === 0) return 'Import Opscend Catalog';
    if (status.updateAvailable) return 'Update Catalog';
    return 'Catalog Up to Date';
  });

  readonly editorTitle = computed(() => {
    const editing = Boolean(this.editingId());

    switch (this.editorType()) {
      case 'category':
        return editing ? 'Edit category' : 'Add category';
      case 'brand':
        return editing ? 'Edit brand' : 'Add brand';
      case 'model':
        return editing ? 'Edit model' : 'Add model';
      default:
        return '';
    }
  });

  async ngOnInit(): Promise<void> {
    await Promise.all([this.loadSyncStatus(), this.loadCategories()]);
  }

  async loadSyncStatus(): Promise<void> {
    this.loadingSyncStatus.set(true);

    try {
      const status = await firstValueFrom(
        this.catalogService.getCatalogSyncStatus()
      );
      this.syncStatus.set(status);
    } catch (error) {
      console.error('Failed to load catalog sync status.', error);
      this.syncStatus.set(null);
    } finally {
      this.loadingSyncStatus.set(false);
    }
  }

  async loadCategories(preferredId?: string | null): Promise<void> {
    this.loadingCategories.set(true);
    this.error.set(null);

    try {
      const response = await firstValueFrom(
        this.catalogService.listManagedCategories(true)
      );
      const items = response.data ?? [];
      this.categories.set(items);
      this.selectedCategoryIds.set(
        this.pruneSelection(this.selectedCategoryIds(), items.map((item) => item.id))
      );

      const nextCategoryId =
        preferredId && items.some((item) => item.id === preferredId)
          ? preferredId
          : this.selectedCategoryId() &&
              items.some((item) => item.id === this.selectedCategoryId())
            ? this.selectedCategoryId()
            : items[0]?.id ?? null;

      this.selectedCategoryId.set(nextCategoryId);

      if (nextCategoryId) {
        await this.loadBrands(nextCategoryId);
      } else {
        this.brands.set([]);
        this.models.set([]);
        this.selectedBrandId.set(null);
      }
    } catch (error) {
      console.error('Failed to load catalog categories.', error);
      this.error.set('Could not load the internal device catalog.');
    } finally {
      this.loadingCategories.set(false);
    }
  }

  async selectCategory(category: ManagedDeviceCatalogCategory): Promise<void> {
    if (this.selectedCategoryId() === category.id) return;
    this.selectedCategoryId.set(category.id);
    this.selectedBrandId.set(null);
    this.selectedBrandIds.set(new Set());
    this.selectedModelIds.set(new Set());
    this.models.set([]);
    this.modelSearch.set('');
    await this.loadBrands(category.id);
  }

  async loadBrands(categoryId: string, preferredId?: string | null): Promise<void> {
    this.loadingBrands.set(true);
    this.error.set(null);

    try {
      const response = await firstValueFrom(
        this.catalogService.listManagedBrands(categoryId, true)
      );
      const items = response.data ?? [];
      this.brands.set(items);
      this.selectedBrandIds.set(
        this.pruneSelection(this.selectedBrandIds(), items.map((item) => item.id))
      );
      this.selectedModelIds.set(new Set());

      const nextBrandId =
        preferredId && items.some((item) => item.id === preferredId)
          ? preferredId
          : this.selectedBrandId() &&
              items.some((item) => item.id === this.selectedBrandId())
            ? this.selectedBrandId()
            : items[0]?.id ?? null;

      this.selectedBrandId.set(nextBrandId);

      if (nextBrandId) {
        await this.loadModels(nextBrandId);
      } else {
        this.models.set([]);
      }
    } catch (error) {
      console.error('Failed to load catalog brands.', error);
      this.error.set('Could not load catalog brands.');
    } finally {
      this.loadingBrands.set(false);
    }
  }

  async selectBrand(brand: ManagedDeviceCatalogBrand): Promise<void> {
    if (this.selectedBrandId() === brand.id) return;
    this.selectedBrandId.set(brand.id);
    this.selectedModelIds.set(new Set());
    this.modelSearch.set('');
    await this.loadModels(brand.id);
  }

  async loadModels(brandId: string): Promise<void> {
    this.loadingModels.set(true);
    this.error.set(null);

    try {
      const response = await firstValueFrom(
        this.catalogService.listManagedModels(brandId, true)
      );
      const items = response.data ?? [];
      this.models.set(items);
      this.selectedModelIds.set(
        this.pruneSelection(this.selectedModelIds(), items.map((item) => item.id))
      );
    } catch (error) {
      console.error('Failed to load catalog models.', error);
      this.error.set('Could not load catalog models.');
    } finally {
      this.loadingModels.set(false);
    }
  }

  isCategorySelected(id: string): boolean {
    return this.selectedCategoryIds().has(id);
  }

  isBrandSelected(id: string): boolean {
    return this.selectedBrandIds().has(id);
  }

  isModelSelected(id: string): boolean {
    return this.selectedModelIds().has(id);
  }

  toggleCategorySelection(id: string, selected: boolean): void {
    this.selectedCategoryIds.set(
      this.toggleSelection(this.selectedCategoryIds(), id, selected)
    );
  }

  toggleBrandSelection(id: string, selected: boolean): void {
    this.selectedBrandIds.set(
      this.toggleSelection(this.selectedBrandIds(), id, selected)
    );
  }

  toggleModelSelection(id: string, selected: boolean): void {
    this.selectedModelIds.set(
      this.toggleSelection(this.selectedModelIds(), id, selected)
    );
  }

  toggleAllCategories(): void {
    this.selectedCategoryIds.set(
      this.toggleAllSelection(
        this.selectedCategoryIds(),
        this.categories().map((item) => item.id),
        this.allCategoriesSelected()
      )
    );
  }

  toggleAllBrands(): void {
    this.selectedBrandIds.set(
      this.toggleAllSelection(
        this.selectedBrandIds(),
        this.brands().map((item) => item.id),
        this.allBrandsSelected()
      )
    );
  }

  toggleAllVisibleModels(): void {
    this.selectedModelIds.set(
      this.toggleAllSelection(
        this.selectedModelIds(),
        this.filteredModels().map((item) => item.id),
        this.allVisibleModelsSelected()
      )
    );
  }

  clearBulkSelection(entity: DeviceCatalogBulkEntity): void {
    if (entity === 'category') this.selectedCategoryIds.set(new Set());
    if (entity === 'brand') this.selectedBrandIds.set(new Set());
    if (entity === 'model') this.selectedModelIds.set(new Set());
  }

  async applyBulkAction(
    entity: DeviceCatalogBulkEntity,
    action: DeviceCatalogBulkAction
  ): Promise<void> {
    if (this.bulkBusyEntity()) return;

    const ids = this.selectionIds(entity);
    if (!ids.length) return;

    if (action === 'deactivate') {
      const entityLabel = ids.length === 1 ? entity : `${entity}s`;
      const confirmed = window.confirm(
        `Deactivate ${ids.length} selected ${entityLabel}? They will no longer appear internally or in public booking.`
      );
      if (!confirmed) return;
    }

    this.bulkBusyEntity.set(entity);

    try {
      const result = await firstValueFrom(
        this.catalogService.bulkUpdateManagedCatalog({ entity, ids, action })
      );

      this.clearBulkSelection(entity);

      if (entity === 'category') {
        await this.loadCategories(this.selectedCategoryId());
      } else if (entity === 'brand') {
        const categoryId = this.selectedCategoryId();
        if (categoryId) await this.loadBrands(categoryId, this.selectedBrandId());
      } else {
        const brandId = this.selectedBrandId();
        if (brandId) await this.loadModels(brandId);
      }

      this.toast.success(
        this.bulkActionTitle(action),
        `${result.updatedCount} ${result.updatedCount === 1 ? entity : `${entity}s`} updated.`
      );
    } catch (error) {
      console.error('Failed to apply bulk catalog action.', error);
      this.toast.error(
        'Bulk update failed',
        'The selected catalog records could not be updated.'
      );
    } finally {
      this.bulkBusyEntity.set(null);
    }
  }

  openNewCategory(): void {
    this.resetEditor();
    this.editorType.set('category');
  }

  openEditCategory(category: ManagedDeviceCatalogCategory): void {
    this.resetEditor();
    this.editorType.set('category');
    this.editingId.set(category.id);
    this.categoryName = category.name;
    this.categorySortOrder = category.sortOrder;
    this.categoryIsActive = category.isActive;
    this.categoryIsPublic = category.isPublic;
  }

  openNewBrand(): void {
    if (!this.selectedCategoryId()) return;
    this.resetEditor();
    this.editorType.set('brand');
  }

  openEditBrand(brand: ManagedDeviceCatalogBrand): void {
    this.resetEditor();
    this.editorType.set('brand');
    this.editingId.set(brand.id);
    this.brandName = brand.name;
    this.brandSortOrder = brand.sortOrder;
    this.brandIsActive = brand.isActive;
    this.brandIsPublic = brand.isPublic;
  }

  openNewModel(): void {
    if (!this.selectedBrandId()) return;
    this.resetEditor();
    this.editorType.set('model');
  }

  openEditModel(model: ManagedDeviceCatalogModel): void {
    this.resetEditor();
    this.editorType.set('model');
    this.editingId.set(model.id);
    this.modelName = model.name;
    this.modelReleaseYear = model.releaseYear;
    this.modelSortOrder = model.sortOrder;
    this.modelIsActive = model.isActive;
    this.modelIsPublic = model.isPublic;
    this.modelExternalProvider = model.externalProvider ?? '';
    this.modelExternalProductId = model.externalProductId ?? '';
  }

  closeEditor(): void {
    if (this.saving()) return;
    this.resetEditor();
  }

  async saveEditor(): Promise<void> {
    if (this.saving()) return;

    switch (this.editorType()) {
      case 'category':
        await this.saveCategory();
        return;
      case 'brand':
        await this.saveBrand();
        return;
      case 'model':
        await this.saveModel();
        return;
      default:
        return;
    }
  }

  async importExisting(): Promise<void> {
    if (this.importing()) return;

    const status = this.syncStatus();
    if (status && !status.updateAvailable && status.lastSyncedRevision > 0) {
      this.toast.info('Catalog is already up to date');
      return;
    }

    this.importing.set(true);
    this.error.set(null);

    try {
      const result = await firstValueFrom(
        this.catalogService.syncMasterCatalog()
      );

      const created =
        result.categoriesCreated + result.brandsCreated + result.modelsCreated;
      const updated =
        result.categoriesUpdated + result.brandsUpdated + result.modelsUpdated;

      this.toast.success(
        status?.lastSyncedRevision ? 'Catalog updated' : 'Catalog imported',
        `${created} new records added and ${updated} existing records refreshed from Opscend revision ${result.currentRevision}.`
      );

      await Promise.all([
        this.loadSyncStatus(),
        this.loadCategories(this.selectedCategoryId()),
      ]);
    } catch (error) {
      console.error('Failed to import the Opscend catalog.', error);
      this.toast.error(
        'Catalog update failed',
        'The private Opscend catalog could not be imported.'
      );
    } finally {
      this.importing.set(false);
    }
  }

  formatSyncDate(value: string | null | undefined): string {
    if (!value) return 'Never';

    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value));
  }

  async deactivateCurrent(): Promise<void> {
    const type = this.editorType();
    const id = this.editingId();
    if (!type || !id || this.saving()) return;

    const confirmed = window.confirm(
      `Deactivate this ${type}? It will stop appearing in new repairs and public booking.`
    );
    if (!confirmed) return;

    this.saving.set(true);

    try {
      if (type === 'category') {
        await firstValueFrom(this.catalogService.deactivateManagedCategory(id));
        this.resetEditor();
        await this.loadCategories();
      } else if (type === 'brand') {
        await firstValueFrom(this.catalogService.deactivateManagedBrand(id));
        const categoryId = this.selectedCategoryId();
        this.resetEditor();
        if (categoryId) await this.loadBrands(categoryId);
      } else {
        await firstValueFrom(this.catalogService.deactivateManagedModel(id));
        const brandId = this.selectedBrandId();
        this.resetEditor();
        if (brandId) await this.loadModels(brandId);
      }

      this.toast.success('Catalog item deactivated');
    } catch (error) {
      console.error('Failed to deactivate catalog item.', error);
      this.toast.error('Could not deactivate catalog item');
    } finally {
      this.saving.set(false);
    }
  }

  private async saveCategory(): Promise<void> {
    const name = this.categoryName.trim();
    if (!name) {
      this.toast.error('Category name is required');
      return;
    }

    const payload: DeviceCatalogCategoryInput = {
      name,
      sortOrder: Number(this.categorySortOrder || 0),
      isActive: this.categoryIsActive,
      isPublic: this.categoryIsPublic,
    };

    this.saving.set(true);

    try {
      const editingId = this.editingId();
      const saved = editingId
        ? await firstValueFrom(
            this.catalogService.updateManagedCategory(editingId, payload)
          )
        : await firstValueFrom(
            this.catalogService.createManagedCategory(payload)
          );

      this.resetEditor();
      await this.loadCategories(saved.id);
      this.toast.success(editingId ? 'Category updated' : 'Category added');
    } catch (error) {
      console.error('Failed to save category.', error);
      this.toast.error('Could not save category', 'A category with this name may already exist.');
    } finally {
      this.saving.set(false);
    }
  }

  private async saveBrand(): Promise<void> {
    const categoryId = this.selectedCategoryId();
    const name = this.brandName.trim();

    if (!categoryId || !name) {
      this.toast.error('Brand name is required');
      return;
    }

    const payload: DeviceCatalogBrandInput = {
      categoryId,
      name,
      sortOrder: Number(this.brandSortOrder || 0),
      isActive: this.brandIsActive,
      isPublic: this.brandIsPublic,
    };

    this.saving.set(true);

    try {
      const editingId = this.editingId();
      const saved = editingId
        ? await firstValueFrom(
            this.catalogService.updateManagedBrand(editingId, payload)
          )
        : await firstValueFrom(this.catalogService.createManagedBrand(payload));

      this.resetEditor();
      await this.loadBrands(categoryId, saved.id);
      this.toast.success(editingId ? 'Brand updated' : 'Brand added');
    } catch (error) {
      console.error('Failed to save brand.', error);
      this.toast.error('Could not save brand', 'A brand with this name may already exist.');
    } finally {
      this.saving.set(false);
    }
  }

  private async saveModel(): Promise<void> {
    const brandId = this.selectedBrandId();
    const name = this.modelName.trim();

    if (!brandId || !name) {
      this.toast.error('Model name is required');
      return;
    }

    const releaseYear =
      this.modelReleaseYear === null || this.modelReleaseYear === undefined
        ? null
        : Number(this.modelReleaseYear);

    const normalizedReleaseYear =
      typeof releaseYear === 'number' && Number.isFinite(releaseYear)
        ? releaseYear
        : null;

    const payload: DeviceCatalogModelInput = {
      brandId,
      name,
      releaseYear: normalizedReleaseYear,
      sortOrder: Number(this.modelSortOrder || 0),
      isActive: this.modelIsActive,
      isPublic: this.modelIsPublic,
      externalProvider: this.modelExternalProvider.trim() || null,
      externalProductId: this.modelExternalProductId.trim() || null,
    };

    this.saving.set(true);

    try {
      const editingId = this.editingId();
      if (editingId) {
        await firstValueFrom(
          this.catalogService.updateManagedModel(editingId, payload)
        );
      } else {
        await firstValueFrom(this.catalogService.createManagedModel(payload));
      }

      this.resetEditor();
      await this.loadModels(brandId);
      this.toast.success(editingId ? 'Model updated' : 'Model added');
    } catch (error) {
      console.error('Failed to save model.', error);
      this.toast.error('Could not save model', 'A model with this name may already exist for the selected brand.');
    } finally {
      this.saving.set(false);
    }
  }

  private selectionIds(entity: DeviceCatalogBulkEntity): string[] {
    if (entity === 'category') return [...this.selectedCategoryIds()];
    if (entity === 'brand') return [...this.selectedBrandIds()];
    return [...this.selectedModelIds()];
  }

  private toggleSelection(
    current: Set<string>,
    id: string,
    selected: boolean
  ): Set<string> {
    const next = new Set(current);
    if (selected) next.add(id);
    else next.delete(id);
    return next;
  }

  private toggleAllSelection(
    current: Set<string>,
    ids: string[],
    allSelected: boolean
  ): Set<string> {
    const next = new Set(current);
    for (const id of ids) {
      if (allSelected) next.delete(id);
      else next.add(id);
    }
    return next;
  }

  private pruneSelection(current: Set<string>, validIds: string[]): Set<string> {
    const valid = new Set(validIds);
    return new Set([...current].filter((id) => valid.has(id)));
  }

  private bulkActionTitle(action: DeviceCatalogBulkAction): string {
    switch (action) {
      case 'activate':
        return 'Selected records activated';
      case 'publish':
        return 'Selected records published';
      case 'make_private':
        return 'Selected records set to internal only';
      case 'deactivate':
        return 'Selected records deactivated';
    }
  }

  private resetEditor(): void {
    this.editorType.set(null);
    this.editingId.set(null);

    this.categoryName = '';
    this.categorySortOrder = 0;
    this.categoryIsActive = true;
    this.categoryIsPublic = true;

    this.brandName = '';
    this.brandSortOrder = 0;
    this.brandIsActive = true;
    this.brandIsPublic = true;

    this.modelName = '';
    this.modelReleaseYear = null;
    this.modelSortOrder = 0;
    this.modelIsActive = true;
    this.modelIsPublic = true;
    this.modelExternalProvider = '';
    this.modelExternalProductId = '';
  }
}
