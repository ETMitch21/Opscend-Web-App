import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ManagedDeviceCatalogModel, TechSpecsService } from '../../../core/techspecs/techspecs.service';

/** Shared by the worksheet and its Angular cell editor. Device searches are server-side. */
@Injectable({ providedIn: 'root' })
export class PricingGridLookups {
  private readonly catalog = inject(TechSpecsService);
  readonly values = signal<Record<string, string[]>>({});
  readonly models = signal<ManagedDeviceCatalogModel[]>([]);

  private customNames = new Set<string>();
  setChoices(choices: Record<string, string[]>): void {
    this.values.set({ ...choices, variant: [...new Set([...(choices['variant'] || []), ...this.customNames])] });
  }
  addOptionName(value: string): void {
    this.customNames.add(value);
    this.values.update(v => ({ ...v, variant: [...new Set([...(v['variant'] || []), value])] }));
  }
  addModels(models: ManagedDeviceCatalogModel[]): void {
    const map = new Map(this.models().map(model => [model.id, model]));
    models.forEach(model => map.set(model.id, model));
    this.models.set([...map.values()]);
  }
  label(model: ManagedDeviceCatalogModel): string { return `${model.brandName} ${model.name}`; }
  findModel(label: string): ManagedDeviceCatalogModel | undefined {
    return this.models().find(model => this.label(model) === label);
  }
  async searchDevices(search: string): Promise<string[]> {
    const response = await firstValueFrom(this.catalog.searchManagedModels({
      includeInactive: false, search: search.trim() || undefined, limit: 60,
    }));
    this.addModels(response.data ?? []);
    return [...new Set((response.data ?? []).map(model => this.label(model)))];
  }
}
