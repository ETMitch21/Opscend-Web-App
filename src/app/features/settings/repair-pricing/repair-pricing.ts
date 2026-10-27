import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductsService } from '../../../core/products/products-service';
import { MobileSentrixService } from '../../../core/mobilesentrix/mobilesentrix-service';
import { MobileSentrixSearchResult } from '../../../core/mobilesentrix/mobilesentrix-model';
import { mapMobileSentrixItems } from '../../../core/mobilesentrix/mobilesentrix-search-mapper';
import { ServicesService } from '../../../core/services/service';
import { Product } from '../../../core/products/products-model';
import { Service } from '../../../core/services/model';
import { RevoGrid, Editor, type Editors } from '@revolist/angular-datagrid';
import { PricingSelectEditorComponent } from './pricing-select-editor';
import { PricingGridLookups } from './pricing-grid-lookups';
import {
  Component,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
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
  RefreshCwIcon,
  Layers3Icon,
  PackageSearchIcon,
  GaugeIcon,
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
  PricingOptionInput,
  PricingOptionBulkAction,
  PricingNotOffered,
  PricingOverview,
  PricingRule,
  PricingRuleScope,
  SupplierPricingHealthRow,
  RepairType,
} from '../../../core/repair-pricing/model';
import { RepairPricingService } from '../../../core/repair-pricing/service';
import { ToastService } from '../../../core/toast/toast-service';
import { SettingsLayoutComponent } from '../settings-layout/settings-layout';
import { RepairTypesDrawer } from './repair-types-drawer/repair-types-drawer';

type StatusFilter = 'all' | 'active' | 'inactive';
type VisibilityFilter = 'all' | 'public' | 'internal';
type PricingViewMode = 'sheet' | 'overview' | 'rules' | 'suppliers' | 'setup' | 'list';
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

interface GridPriceFields {
  manualPartCostCents?: number | null;
  laborCents?: number | null;
  fixedPriceCents?: number | null;
  useDynamicPricing?: boolean;
  isPublic?: boolean;
  isActive?: boolean;
}
interface GridPricePatch extends GridPriceFields { id: string; expectedUpdatedAt: string; }

@Component({
  selector: 'app-repair-pricing',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    LucideAngularModule,
    SettingsLayoutComponent,
    RepairTypesDrawer,
    RevoGrid,
  ],
  templateUrl: './repair-pricing.html',
})
type CsvImportAction = 'skip' | 'create' | 'update' | 'error';
interface CsvPriceImportItem {
  line: number;
  label: string;
  action: CsvImportAction;
  message: string;
  payload: Partial<PricingOptionInput> | null;
  sourceId: string;
}

function pricingCsvCents(input: string): number | null {
  const raw = input.trim();
  if (!raw) return null;
  if (!/^(?:\d+)(?:\.\d{1,2})?$/.test(raw) || Number(raw) > 1_000_000) throw new Error(`Invalid dollar amount: ${raw}`);
  return Math.round(Number(raw) * 100);
}

// RFC-4180-style quoted CSV including embedded commas, line breaks, and escaped quotes.
function parsePricingCsv(content: string): Array<Record<string, string>> {
  const input = content.replace(/^\uFEFF/, '');
  const records: string[][] = [];
  let record: string[] = [], cell = '', quoted = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (c === '"') {
      if (quoted && input[i + 1] === '"') { cell += '"'; i++; }
      else if (quoted || !cell) quoted = !quoted;
      else throw new Error('Invalid quotation in CSV.');
    } else if (c === ',' && !quoted) { record.push(cell); cell = ''; }
    else if ((c === '\n' || c === '\r') && !quoted) {
      record.push(cell); cell = '';
      if (record.some(value => value.trim())) records.push(record);
      record = [];
      if (c === '\r' && input[i + 1] === '\n') i++;
    } else cell += c;
  }
  if (quoted) throw new Error('Unclosed quote in CSV.');
  record.push(cell);
  if (record.some(value => value.trim())) records.push(record);
  if (!records.length) throw new Error('The CSV is empty.');
  const headers = records.shift()!.map(s => s.trim());
  const required = ['Pricing ID','Device ID','Repair ID','Device','Repair','Option','Labor','Fixed selling price','Mode','Visibility','Status','Updated At'];
  if (required.some(name => !headers.includes(name))) throw new Error('This CSV is missing required columns. Export a fresh CSV from Opscend first.');
  if (new Set(headers).size !== headers.length) throw new Error('Duplicate CSV column names.');
  return records.map((values, i) => {
    if (values.length !== headers.length) throw new Error(`Line ${i + 2}: expected ${headers.length} columns, found ${values.length}.`);
    return Object.fromEntries(headers.map((name, idx) => [name, values[idx]]));
  });
}

export class RepairPricingSettings implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly pricingApi = inject(RepairPricingService);
  private readonly catalogApi = inject(TechSpecsService);
  private readonly toast = inject(ToastService);
  private readonly productsApi = inject(ProductsService);
  private readonly mobileSentrixApi = inject(MobileSentrixService);
  private readonly servicesApi = inject(ServicesService);
  private readonly gridLookups = inject(PricingGridLookups);
  private readonly gridChoicesSync = effect(() => { this.gridLookups.setChoices(this.gridChoices()); });

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
    Refresh: RefreshCwIcon,
    Layers: Layers3Icon,
    PackageSearch: PackageSearchIcon,
    Gauge: GaugeIcon,
    X: XIcon,
  };

  // RevoGrid handles editing/selection. Writes are queued, sent automatically,
  // and displayed optimistically until the API confirms them.
  readonly gridBusy = signal(false);
  readonly gridSaveError = signal<string | null>(null);
  readonly gridOrigin = signal<{ row: number; col: number } | null>(null);
  private readonly gridQueued = new Map<string, GridPricePatch>();
  readonly gridDrafts = signal<Record<string, GridPriceFields>>({});
  private gridFlushTimer: ReturnType<typeof setTimeout> | null = null;
  private gridFlushing = false;
  // Dropdowns are real grid cell editors, not a second form above the worksheet.
  readonly gridEditors: Editors = { pricingSelect: Editor(PricingSelectEditorComponent) };
  readonly blankCount = signal(10);
  readonly blankDrafts = signal<Record<string, Record<string, string>>>({});
  readonly blankCreating = signal<Set<string>>(new Set());
  readonly gridCatalogModels = signal<ManagedDeviceCatalogModel[]>([]);
  readonly gridColumns = [
    { prop: 'device', name: 'Device', size: 220, editor: 'pricingSelect' },
    { prop: 'repair', name: 'Repair', size: 185, editor: 'pricingSelect' },
    { prop: 'variant', name: 'Option', size: 135, editor: 'pricingSelect' },
    { prop: 'part', name: 'Part cost ($)', size: 135 },
    { prop: 'labor', name: 'Labor ($)', size: 110 },
    { prop: 'price', name: 'Selling price ($)', size: 145 },
    { prop: 'mode', name: 'Pricing mode', size: 140, editor: 'pricingSelect' },
    { prop: 'visibility', name: 'Visibility', size: 125, editor: 'pricingSelect' },
    { prop: 'status', name: 'Status', size: 110, editor: 'pricingSelect' },
    { prop: 'actions', name: 'Actions', size: 116, pin: 'colPinEnd' as const, readonly: true, filter: false, sortable: false,
      cellTemplate: (h: any, p: any) => {
        const icon = (paths: string[]) => h('svg', {
          xmlns: 'http://www.w3.org/2000/svg', width: '16', height: '16',
          viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
          'stroke-width': '1.8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
          'aria-hidden': 'true',
        }, paths.map(d => h('path', { d })));
        const button = (label: string, paths: string[], action: () => void, danger = false) =>
          h('button', {
            type: 'button', title: label, 'aria-label': label,
            onClick: (e: Event) => { e.stopPropagation(); action(); },
            style: {
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: '28px', height: '28px', borderRadius: '6px',
              border: '1px solid transparent', background: 'transparent',
              color: danger ? '#dc2626' : 'var(--app-text, #64748b)', cursor: 'pointer',
            },
          }, [icon(paths)]);
        return h('div', {
          style: { display: 'flex', gap: '3px', alignItems: 'center',
            justifyContent: 'center', height: '100%' },
        }, [
          button('Edit details', ['M12 20h9', 'M16.5 3.5a2.12 2.12 0 0 1 3 3L9 17l-4 1 1-4Z'], () => this.openGridDrawer(p.model.id)),
          button('Reset row', ['M3 12a9 9 0 1 0 3-6.7', 'M3 3v6h6'], () => { void this.resetGridRow(p.model.id); }),
          button('Delete row', ['M3 6h18', 'M8 6V4h8v2', 'M19 6l-1 14H6L5 6', 'M10 11v5', 'M14 11v5'], () => { void this.deleteGridRow(p.model.id); }, true),
        ]);
      },
    },
  ];
  readonly gridChoices = computed(() => ({
    device: this.gridCatalogModels().map(m => `${m.brandName} ${m.name}`),
    repair: this.repairTypes().filter(t => t.isActive).map(t => t.label),
    variant: [...new Set(['Standard', 'Economy', 'Premium', 'OEM', ...this.options().map(o => o.variantName)])],
    mode: ['Automatic', 'Manual'],
    visibility: ['Public', 'Private'],
    status: ['Active', 'Inactive'],
  }));
  readonly gridRows = computed(() => {
    const choices = this.gridChoices();
    const existing = this.sheetOptions().map(option => {
      const changed = this.gridDrafts()[option.id] || {};
      const labor = changed.laborCents !== undefined ? changed.laborCents : option.laborCents;
      const fixed = changed.fixedPriceCents !== undefined ? changed.fixedPriceCents : option.fixedPriceCents;
      const dynamic = changed.useDynamicPricing !== undefined ? changed.useDynamicPricing : option.useDynamicPricing;
      return {
        id: option.id,
        device: this.modelLabel(option), repair: option.repairType.label, variant: option.variantName,
        part: changed.manualPartCostCents !== undefined
          ? (changed.manualPartCostCents == null ? '' : (changed.manualPartCostCents / 100).toFixed(2))
          : option.manualPartCostCents != null ? (option.manualPartCostCents / 100).toFixed(2)
          : option.productSupplier?.lastKnownCostCents != null
          ? (option.productSupplier.lastKnownCostCents / 100).toFixed(2)
          : option.product?.costCents != null ? (option.product.costCents / 100).toFixed(2) : '', 
        labor: labor == null ? '' : (labor / 100).toFixed(2),
        price: dynamic ? '' : fixed == null ? '' : (fixed / 100).toFixed(2),
        mode: dynamic ? 'Automatic' : 'Manual',
        visibility: (changed.isPublic ?? option.isPublic) ? 'Public' : 'Private',
        status: (changed.isActive ?? option.isActive) ? 'Active' : 'Inactive', actions: '',
        _choices: choices,
      };
    });
    const empty = Array.from({ length: this.blankCount() }, (_, i) => {
      const id = `blank:${i}`;
      const draft = this.blankDrafts()[id] ?? {};
      return {
        id, device: draft['device'] || '', repair: draft['repair'] || '',
        variant: draft['variant'] || 'Standard', part: draft['part'] || '', labor: draft['labor'] || '',
        price: draft['price'] || '', mode: draft['mode'] || 'Manual',
        visibility: 'Private', status: 'Inactive', actions: '', _choices: choices,
      };
    });
    return [...existing, ...empty];
  });

  private async loadGridCatalog(): Promise<void> {
    try {
      const response = await firstValueFrom(this.catalogApi.searchManagedModels({ includeInactive: false, limit: 1000 }));
      this.gridCatalogModels.set(response.data || []);
      this.gridLookups.addModels(response.data || []);
    } catch (error) {
      console.error('Unable to load worksheet device choices', error);
      this.gridCatalogModels.set(this.modelSuggestions());
    }
  }

  private gridModelFromLabel(value: string): ManagedDeviceCatalogModel | undefined {
    return this.gridLookups.findModel(value) ?? this.gridCatalogModels().find(m => `${m.brandName} ${m.name}` === value);
  }

  private async saveBlankRow(id: string): Promise<void> {
    const draft = this.blankDrafts()[id];
    const model = this.gridModelFromLabel(draft?.['device'] || '');
    const repair = this.repairTypes().find(t => t.label === draft?.['repair'] && t.isActive);
    if (!model || !repair || this.blankCreating().has(id)) return;
    if (repair.quoteAttributeKeys.length) {
      this.toast.error('This repair needs additional quote attributes. Use New repair for its setup.');
      return;
    }
    this.blankCreating.update(v => new Set([...v, id]));
    try {
      // Avoid creating a duplicate variant for the same model and repair.
      const variantName = draft['variant']?.trim() || 'Standard';
      const duplicate = this.options().find(o => o.deviceCatalogModelId === model.id && o.repairNeedId === repair.id && o.variantName.toLowerCase() === variantName.toLowerCase());
      if (duplicate) {
        this.toast.error('That device, repair and option already exists. Edit its existing row.');
        return;
      }
      const labor = draft['labor']?.trim() ? this.gridMoney(draft['labor']) : repair.defaultLaborCents;
      const price = draft['price']?.trim() ? this.gridMoney(draft['price']) : null;
      if (labor === undefined || price === undefined) { this.toast.error('Enter a valid amount.'); return; }
      const created = await firstValueFrom(this.pricingApi.createOption({
        deviceCatalogModelId: model.id, repairNeedId: repair.id, variantName,
        laborCents: labor, fixedPriceCents: price, useDynamicPricing: false,
        durationMins: repair.defaultDurationMins, requiresProduct: false,
        isActive: false, isPublic: false,
      }));
      // Cost is saved as a per-option override after creation, never on the shared supplier product.
      let finalOption = created;
      if (draft['part']?.trim()) {
        const cents = this.gridMoney(draft['part']);
        if (cents === undefined) { this.toast.error('Invalid part cost; draft created without that cost.'); }
        else {
          const saved = await firstValueFrom(this.pricingApi.batchUpdatePrices([{ id: created.id, expectedUpdatedAt: created.updatedAt, manualPartCostCents: cents }]));
          finalOption = saved.data[0] || created;
        }
      }
      this.options.update(rows => rows.some(o => o.id === finalOption.id) ? rows : [...rows, finalOption]);
      this.blankDrafts.update(rows => { const next = { ...rows }; delete next[id]; return next; });
      this.toast.success('Private draft created');
    } catch (error) {
      console.error('Could not create pricing worksheet row', error);
      this.toast.error('Could not create repair. Check for duplicates or retry.');
    } finally {
      this.blankCreating.update(v => { const next = new Set(v); next.delete(id); return next; });
    }
  }

  private async updateExistingChoice(option: PricingOption, prop: string, value: string): Promise<void> {
    const payload: Partial<PricingOptionInput> = {};
    if (prop === 'repair') {
      const repair = this.repairTypes().find(t => t.label === value && t.isActive);
      if (!repair) { this.toast.error('Select a valid repair type'); return; }
      if (repair.quoteAttributeKeys.length) { this.toast.error('This repair requires quote attributes. Use Details to change it.'); return; }
      payload.repairNeedId = repair.id;
    } else if (prop === 'variant') {
      if (!value.trim()) return;
      payload.variantName = value.trim();
    } else return;
    const repairId = payload.repairNeedId || option.repairNeedId;
    const variantName = payload.variantName || option.variantName;
    if (this.options().some(o => o.id !== option.id && o.deviceCatalogModelId === option.deviceCatalogModelId && o.repairNeedId === repairId && o.variantName.toLowerCase() === variantName.toLowerCase())) {
      this.toast.error('This pricing option already exists for the device.'); return;
    }
    try {
      const result = await firstValueFrom(this.pricingApi.updateOption(option.id, payload));
      this.options.update(rows => rows.map(o => o.id === option.id ? result : o));
    } catch (error) {
      console.error('Could not update worksheet repair/option', error);
      this.toast.error('Could not save repair or option');
    }
  }

  private gridMoney(value: unknown): number | null | undefined {
    if (value == null || String(value).trim() === '') return null;
    const clean = String(value).trim().replace(/^\$/, '').replace(/,/g, '');
    if (!/^(?:\d+)(?:\.\d{1,2})?$/.test(clean)) return undefined;
    const cents = Math.round(Number(clean) * 100);
    return Number.isSafeInteger(cents) && cents <= 100000000 ? cents : undefined;
  }

  onGridFocus(event: CustomEvent): void {
    const detail = event.detail as { model?: { id?: string }; prop?: string; cell?: { x?: number; y?: number }; rowIndex?: number; colIndex?: number } | undefined;
    const row = detail?.model?.id
      ? this.gridRows().findIndex(option => option.id === detail.model?.id)
      : (detail?.cell?.y ?? detail?.rowIndex);
    const col = detail?.prop
      ? this.gridColumns.findIndex(column => column.prop === detail.prop)
      : (detail?.cell?.x ?? detail?.colIndex);
    if (typeof row === 'number' && row >= 0 && typeof col === 'number' && col >= 0)
      this.gridOrigin.set({ row, col });
  }

  private gridParse(prop: string, value: unknown): GridPriceFields | null {
    if (prop === 'labor' || prop === 'price' || prop === 'part') {
      const cents = this.gridMoney(value);
      if (cents === undefined) return null;
      return prop === 'labor' ? { laborCents: cents } : prop === 'part' ? { manualPartCostCents: cents } : { fixedPriceCents: cents, useDynamicPricing: false };
    }
    const normalized = String(value ?? '').trim().toLowerCase();
    if (prop === 'mode') {
      if (normalized === 'automatic' || normalized === 'auto') return { useDynamicPricing: true };
      if (normalized === 'manual') return { useDynamicPricing: false };
    }
    if (prop === 'visibility') {
      if (normalized === 'public') return { isPublic: true };
      if (normalized === 'private' || normalized === 'internal') return { isPublic: false };
    }
    if (prop === 'status') {
      if (normalized === 'active') return { isActive: true };
      if (normalized === 'inactive') return { isActive: false };
    }
    return null;
  }

  private queueGridPatch(option: PricingOption, fields: GridPriceFields): void {
    const old = this.gridQueued.get(option.id);
    this.gridQueued.set(option.id, { ...old, id: option.id, expectedUpdatedAt: option.updatedAt, ...fields });
    this.gridDrafts.update(all => ({ ...all, [option.id]: { ...all[option.id], ...fields } }));
    this.gridSaveError.set(null);
    if (this.gridFlushTimer) clearTimeout(this.gridFlushTimer);
    this.gridFlushTimer = setTimeout(() => { this.gridFlushTimer = null; void this.flushGridChanges(); }, 180);
  }

  onGridEdit(event: CustomEvent): void {
    event.preventDefault(); // Controlled optimistic update; server stays authoritative.
    const detail = event.detail as { model?: { id?: string }; prop?: string; val?: unknown };
    const id = detail.model?.id;
    if (!id || !detail.prop) return;
    if (id.startsWith('blank:')) {
      if ((detail.prop === 'repair' || detail.prop === 'variant') && String(detail.val ?? '').startsWith('__create__:')) { void this.resolveNewGridChoice(id, detail.prop, String(detail.val).slice(11)); return; }
      const choices = this.gridChoices() as Record<string, string[]>;
      const value = String(detail.val ?? '').trim();
      if (['device', 'repair', 'variant', 'mode', 'visibility', 'status'].includes(detail.prop) && !(detail.prop === 'device' ? !!this.gridModelFromLabel(value) : (choices[detail.prop] || []).includes(value))) {
        this.toast.error('Select a known value from the dropdown.'); return;
      }
      if (['device', 'repair', 'variant', 'part', 'labor', 'price'].includes(detail.prop)) {
        this.blankDrafts.update(rows => ({ ...rows, [id]: { ...rows[id], [detail.prop!]: value } }));
        // Create after choosing device + repair, allowing subsequent cells to
        // be included when a row is pasted or edited quickly.
        if (this.blankDrafts()[id]?.['device'] && this.blankDrafts()[id]?.['repair']) {
          void this.saveBlankRow(id);
        }
      }
      return;
    }
    const option = this.sheetOptions().find(row => row.id === id);
    if (!option) return;
    if (detail.prop === 'device') {
      this.toast.error('Changing the device on an existing price is not supported. Create a new row instead.'); return;
    }
    if ((detail.prop === 'repair' || detail.prop === 'variant') && String(detail.val ?? '').startsWith('__create__:')) { void this.resolveNewGridChoice(id, detail.prop, String(detail.val).slice(11)); return; }
    if (detail.prop === 'repair' || detail.prop === 'variant') {
      void this.updateExistingChoice(option, detail.prop, String(detail.val ?? ''));
      return;
    }
    const fields = this.gridParse(detail.prop, detail.val);
    if (!fields) { this.toast.error('Invalid cell value. Use a valid amount or Automatic/Manual, Public/Private, Active/Inactive.'); return; }
    if (fields.useDynamicPricing === true && !option.requiresProduct) {
      this.toast.error('Automatic pricing requires a linked part.'); return;
    }
    this.queueGridPatch(option, fields);
  }

  onGridPaste(event: CustomEvent): void {
    event.preventDefault();
    const details = event.detail as { parsed?: string[][]; raw?: string };
    const matrix = details?.parsed?.length ? details.parsed
      : String(details?.raw || '').replace(/\r/g, '').split('\n').filter(Boolean).map(line => line.split('\t'));
    const origin = this.gridOrigin();
    if (!origin || !matrix.length) { this.toast.error('Select a destination cell before pasting.'); return; }
    const pending = new Map<string, { option: PricingOption; fields: GridPriceFields }>();
    for (let y = 0; y < matrix.length; y++) {
      const gridRow = this.gridRows()[origin.row + y];
      if (!gridRow) { this.toast.error('Paste exceeds the displayed rows.'); return; }
      if (gridRow.id.startsWith('blank:')) {
        const draft = { ...(this.blankDrafts()[gridRow.id] || {}) };
        for (let x = 0; x < matrix[y].length; x++) {
          const prop = this.gridColumns[origin.col + x]?.prop;
          if (prop && ['device', 'repair', 'variant', 'part', 'labor', 'price'].includes(prop)) draft[prop] = matrix[y][x];
        }
        this.blankDrafts.update(rows => ({ ...rows, [gridRow.id]: draft }));
        if (draft['device'] && draft['repair']) void this.saveBlankRow(gridRow.id);
        continue;
      }
      const option = this.sheetOptions().find(o => o.id === gridRow.id);
      if (!option) continue;
      for (let x = 0; x < matrix[y].length; x++) {
        const prop = this.gridColumns[origin.col + x]?.prop;
        if (!['part', 'labor', 'price', 'mode', 'visibility', 'status'].includes(prop)) continue;
        const fields = this.gridParse(prop, matrix[y][x]);
        if (!fields || (fields.useDynamicPricing === true && !option.requiresProduct)) {
          this.toast.error(`Invalid value in pasted row ${y + 1}, column ${x + 1}. Nothing was saved.`);
          return;
        }
        const previous = pending.get(option.id);
        pending.set(option.id, { option, fields: { ...previous?.fields, ...fields } });
      }
    }
    if (!pending.size && !matrix.some((_, i) => this.gridRows()[origin.row + i]?.id.startsWith('blank:'))) { this.toast.error('No editable price cells found.'); return; }
    pending.forEach(({ option, fields }) => this.queueGridPatch(option, fields));
  }

  // An in-page details sheet; never navigate away from the worksheet.
  readonly repairTypesDrawerOpen = signal(false);
  async closeRepairTypesDrawer(): Promise<void> {
    this.repairTypesDrawerOpen.set(false);
    try {
      const response = await firstValueFrom(this.pricingApi.listRepairTypes());
      this.repairTypes.set(this.sortRepairTypes(response.data ?? []));
      await this.loadOptions(this.pricingSearch());
    } catch (error) {
      console.error(error);
      this.toast.error('Could not refresh repair types');
    }
  }
  readonly gridDrawerId = signal<string | null>(null);
  readonly gridDrawerBusy = signal(false);
  readonly gridDrawerProductSearch = signal('');
  readonly gridDrawerServiceSearch = signal('');
  readonly gridDrawerProducts = signal<Product[]>([]);
  readonly gridDrawerSearchBusy = signal(false);
  readonly gridDrawerSearchError = signal(false);
  readonly gridDrawerLinkedProduct = signal<Product | null>(null);
  private gridDrawerProductSearchSerial = 0;
  readonly gridDrawerServices = signal<Service[]>([]);
  readonly gridDrawerOption = computed(() => this.options().find(o => o.id === this.gridDrawerId()) ?? null);
  readonly gridDrawerForm = signal<Partial<PricingOptionInput>>({});
  readonly gridDrawerError = signal<string | null>(null);
  readonly gridDrawerTabs = [
    { id: 'repair', label: 'Repair & pricing' },
    { id: 'parts', label: 'Parts & suppliers' },
    { id: 'checkout', label: 'Checkout & customer' },
  ] as const;
  readonly gridDrawerPanel = signal<'repair' | 'parts' | 'checkout'>('repair');
  readonly gridDrawerSupplierQuery = signal('');
  readonly gridDrawerSupplierResults = signal<MobileSentrixSearchResult[]>([]);
  readonly gridDrawerSupplierBusy = signal(false);
  readonly gridDrawerSupplierError = signal<string | null>(null);
  readonly gridDrawerSupplierSource = signal<string | null>(null);
  readonly gridDrawerImporting = signal<string | null>(null);
  readonly gridDrawerAttributeKeys = computed(() =>
    this.repairTypes().find(type => type.id === this.gridDrawerOption()?.repairNeedId)?.quoteAttributeKeys ?? []
  );
  gridAttributeLabel(key: string): string {
    const names: Record<string, string> = {
      color: 'Color', storage: 'Storage capacity', carrier: 'Carrier',
      connectivity: 'Connectivity', region: 'Region',
      model_variant: 'Model variant', keyboard_layout: 'Keyboard layout',
    };
    return names[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
  updateGridDrawerAttribute(key: string, value: string): void {
    this.gridDrawerForm.update(form => ({ ...form, attributeValues: {
      ...(form.attributeValues ?? {}), [key]: value,
    } }));
  }
  async searchGridDrawerSupplier(): Promise<void> {
    const query = this.gridDrawerSupplierQuery().trim();
    if (query.length < 2 || this.gridDrawerSupplierBusy()) return;
    const optionId = this.gridDrawerId();
    this.gridDrawerSupplierBusy.set(true);
    this.gridDrawerSupplierError.set(null);
    try {
      const response = await firstValueFrom(this.mobileSentrixApi.search({ q: query, maxResults: 20 }));
      if (this.gridDrawerId() !== optionId) return;
      this.gridDrawerSupplierResults.set(mapMobileSentrixItems(response.items ?? []));
      this.gridDrawerSupplierSource.set(response.source ?? null);
      if (response.unavailable || response.requiresReconnect) {
        this.gridDrawerSupplierError.set(response.warning || 'Supplier search is unavailable. Check the supplier connection.');
      } else if (response.warning) {
        this.gridDrawerSupplierError.set(response.warning);
      }
    } catch (error) {
      console.error('Supplier lookup failed', error);
      this.gridDrawerSupplierError.set('Could not search MobileSentrix. Try again.');
      this.gridDrawerSupplierResults.set([]);
    } finally { this.gridDrawerSupplierBusy.set(false); }
  }
  async importGridDrawerSupplier(result: MobileSentrixSearchResult): Promise<void> {
    if (!result.sku || this.gridDrawerImporting()) return;
    const optionId = this.gridDrawerId();
    this.gridDrawerImporting.set(result.id);
    try {
      let product: Product;
      try {
        product = await firstValueFrom(this.productsApi.create({
          name: result.title, sku: null,
          priceCents: result.costCents ?? 0, costCents: result.costCents,
          tags: ['supplier-import', 'pricing-setup'],
          supplierLink: {
            provider: 'mobilesentrix', supplierName: 'MobileSentrix',
            supplierSku: result.sku, supplierProductId: result.id,
            supplierProductName: result.title, supplierUrl: result.link,
            lastKnownCostCents: result.costCents, lastKnownInStock: result.inStock,
            isPreferred: true,
          },
        }));
      } catch (error: any) {
        // The supplier SKU is already linked to an inventory product. Reuse that
        // record instead of creating a duplicate, but never select an unrelated hit.
        if (error?.status !== 409 && error?.error?.error !== 'duplicate_supplier_sku') throw error;
        const found = await firstValueFrom(this.productsApi.search(result.sku, 50));
        const match = found.find(p => p.supplierLinks?.some(link => link.supplierSku === result.sku));
        if (!match) throw error;
        product = await firstValueFrom(this.productsApi.getById(match.id));
      }
      if (this.gridDrawerId() !== optionId) return;
      this.gridDrawerProducts.update(products => [product, ...products.filter(p => p.id !== product.id)]);
      this.selectGridDrawerProduct(product.id);
      this.gridDrawerSupplierResults.set([]);
      this.toast.success('Supplier part selected. Save details to link it to this repair.');
    } catch (error) {
      console.error('Supplier import failed', error);
      this.gridDrawerSupplierError.set('Could not import this supplier part. Nothing was linked to the repair.');
    } finally { this.gridDrawerImporting.set(null); }
  }

  readonly gridDrawerSelectedProduct = computed(() => this.gridDrawerProducts().find(p => p.id === this.gridDrawerForm().productId) ?? (this.gridDrawerLinkedProduct()?.id === this.gridDrawerForm().productId ? this.gridDrawerLinkedProduct() : null));
  readonly gridDrawerSupplierLinks = computed(() => this.gridDrawerSelectedProduct()?.supplierLinks ?? []);
  selectGridDrawerProduct(id: string): void {
    const product = this.gridDrawerProducts().find(p => p.id === id) ?? (this.gridDrawerLinkedProduct()?.id === id ? this.gridDrawerLinkedProduct() : null);
    if (product) this.gridDrawerLinkedProduct.set(product);
    if (id) this.gridDrawerProductSearch.set('');
    this.gridDrawerForm.update(form => ({ ...form, productId: id || null,
      productSupplierId: product?.supplierLinks?.find(link => link.id === form.productSupplierId)?.id
        ?? product?.supplierLinks?.find(link => link.isPreferred)?.id
        ?? (product?.supplierLinks?.length === 1 ? product.supplierLinks[0]!.id : null),
    }));
  }

  readonly gridDrawerPartCostCents = computed(() => {
    const option = this.gridDrawerOption();
    if (!option) return null;
    if (option.manualPartCostCents !== null) return option.manualPartCostCents;
    const product = this.gridDrawerSelectedProduct();
    const supplierId = this.gridDrawerForm().productSupplierId;
    const supplier = product?.supplierLinks?.find(link => link.id === supplierId);
    return supplier?.lastKnownCostCents ?? (product?.cost == null ? null : Math.round(product.cost * 100)) ?? option.productSupplier?.lastKnownCostCents ?? option.product?.costCents ?? null;
  });
  gridDollars(cents: number | null | undefined): number { return (cents ?? 0) / 100; }
  gridCents(dollars: unknown): number { return Math.round(Number(dollars || 0) * 100); }

  openGridDrawer(id: string): void {
    if (id.startsWith('blank:')) { this.toast.error('Choose a device and repair first.'); return; }
    const option = this.options().find(row => row.id === id);
    if (!option) return;
    this.gridDrawerId.set(id);
    this.gridDrawerPanel.set('repair');
    this.gridDrawerSupplierQuery.set('');
    this.gridDrawerSupplierResults.set([]);
    this.gridDrawerSupplierError.set(null);
    this.gridDrawerError.set(null);
    this.gridDrawerLinkedProduct.set(null);
    this.gridDrawerProductSearch.set('');
    if (option.productId) void this.loadGridDrawerLinkedProduct(option.productId);
    this.gridDrawerForm.set({
      description: option.description, serviceId: option.serviceId, productId: option.productId,
      fixedPriceCents: option.fixedPriceCents, laborCents: option.laborCents, useDynamicPricing: option.useDynamicPricing,
      productSupplierId: option.productSupplierId, requiresProduct: option.requiresProduct,
      depositMode: option.depositMode, depositAmountCents: option.depositAmountCents,
      depositShippingCents: option.depositShippingCents,
      depositIncludeProcessingFees: option.depositIncludeProcessingFees,
      depositIncludeInstantPayoutFee: option.depositIncludeInstantPayoutFee,
      durationMins: option.durationMins, requiresManualReview: option.requiresManualReview,
      allowInstantConfirmation: option.allowInstantConfirmation,
      publicBadgeText: option.publicBadgeText, publicFeatured: option.publicFeatured,
      attributeValues: { ...(option.attributeValues ?? {}) },
    });
    void this.searchGridDrawerServices('');
  }
  closeGridDrawer(): void { this.gridDrawerId.set(null); this.gridDrawerPanel.set('repair'); this.gridDrawerError.set(null); }
  updateGridDrawerField<K extends keyof PricingOptionInput>(key: K, value: PricingOptionInput[K]): void {
    this.gridDrawerForm.update(v => ({ ...v, [key]: value }));
  }
  private async loadGridDrawerLinkedProduct(id: string): Promise<void> {
    try {
      const product = await firstValueFrom(this.productsApi.getById(id));
      if (this.gridDrawerId() && this.gridDrawerForm().productId === id) this.gridDrawerLinkedProduct.set(product);
    } catch { /* An unavailable product remains linked; saving does not clear its ID. */ }
  }
  async searchGridDrawerProducts(query: string): Promise<void> {
    this.gridDrawerProductSearch.set(query);
    const serial = ++this.gridDrawerProductSearchSerial;
    if (!query.trim()) {
      this.gridDrawerProducts.set([]);
      this.gridDrawerSearchBusy.set(false);
      this.gridDrawerSearchError.set(false);
      return;
    }
    this.gridDrawerSearchBusy.set(true);
    this.gridDrawerSearchError.set(false);
    try {
      const products = await firstValueFrom(this.productsApi.search(query.trim(), 40));
      if (serial === this.gridDrawerProductSearchSerial) this.gridDrawerProducts.set(products);
    } catch {
      if (serial === this.gridDrawerProductSearchSerial) {
        this.gridDrawerProducts.set([]);
        this.gridDrawerSearchError.set(true);
      }
    } finally {
      if (serial === this.gridDrawerProductSearchSerial) this.gridDrawerSearchBusy.set(false);
    }
  }
  async searchGridDrawerServices(query: string): Promise<void> {
    this.gridDrawerServiceSearch.set(query);
    try { this.gridDrawerServices.set(await firstValueFrom(this.servicesApi.search(query, 40))); }
    catch { this.gridDrawerServices.set([]); }
  }
  async saveGridDrawer(): Promise<void> {
    const missingAttributes = this.gridDrawerAttributeKeys().filter(key => !this.gridDrawerForm().attributeValues?.[key]?.trim());
    if (missingAttributes.length) { this.gridDrawerError.set('Complete the required repair attributes: ' + missingAttributes.map(key => this.gridAttributeLabel(key)).join(', ')); return; }
    const option = this.gridDrawerOption();
    if (!option || this.gridDrawerBusy()) return;
    if (this.gridQueued.has(option.id) || this.gridBusy()) { this.gridDrawerError.set('Wait for worksheet autosave to finish first.'); return; }
    this.gridDrawerBusy.set(true); this.gridDrawerError.set(null);
    try {
      const saved = await firstValueFrom(this.pricingApi.updateOption(option.id, this.gridDrawerForm()));
      this.options.update(rows => rows.map(row => row.id === saved.id ? saved : row));
      this.toast.success('Details saved');
      this.closeGridDrawer();
    } catch (error) { console.error(error); this.gridDrawerError.set('Could not save details. Check required fields and retry.'); }
    finally { this.gridDrawerBusy.set(false); }
  }

  private normalizedValue(v: string): string { return v.trim().replace(/\s+/g, ' ').toLocaleLowerCase(); }
  private async resolveNewGridChoice(id: string, prop: string, requested: string): Promise<void> {
    const name = requested.trim().replace(/\s+/g, ' ');
    if (!name || (prop !== 'repair' && prop !== 'variant')) return;
    const matchingRepair = this.repairTypes().find(r => this.normalizedValue(r.label) === this.normalizedValue(name));
    const matchingOption = this.gridChoices().variant.find(v => this.normalizedValue(v) === this.normalizedValue(name));
    if (prop === 'repair' && matchingRepair) { this.applyResolvedChoice(id, prop, matchingRepair.label); return; }
    if (prop === 'variant' && matchingOption) { this.applyResolvedChoice(id, prop, matchingOption); return; }
    const label = prop === 'repair' ? 'repair type' : 'option name';
    this.toast.confirm(`Create new ${label}?`, () => {
      void (async () => {
        try {
          let value = name;
          if (prop === 'repair') {
            // API enforces unique code; use a stable human-readable slug and reject collisions server-side.
            const existing = this.repairTypes().find(r => this.normalizedValue(r.label) === this.normalizedValue(name));
            if (existing) value = existing.label;
            else {
              const code = 'custom-' + name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 55);
              const created = await firstValueFrom(this.pricingApi.createRepairType({ label: name, code, isActive: true }));
              this.repairTypes.update(rows => [...rows, created]);
              value = created.label;
            }
          } else {
            // Option names are stored on pricing rows, not in a separate option catalog.
            this.gridLookups.addOptionName(name);
          }
          this.applyResolvedChoice(id, prop, value);
          this.toast.success(`${prop === 'repair' ? 'Repair type' : 'Option name'} ready`);
        } catch (error) {
          console.error(error); this.toast.error('Could not create the value. It may already exist. Refresh and retry.');
        }
      })();
    }, `“${name}” will be available in the pricing worksheet.`, `Create ${label}`);
  }
  private applyResolvedChoice(id: string, prop: string, value: string): void {
    if (id.startsWith('blank:')) {
      this.blankDrafts.update(rows => ({ ...rows, [id]: { ...rows[id], [prop]: value } }));
      const draft = this.blankDrafts()[id];
      if (draft?.['device'] && draft?.['repair']) void this.saveBlankRow(id);
    } else {
      const option = this.options().find(row => row.id === id);
      if (option) void this.updateExistingChoice(option, prop, value);
    }
  }

  readonly gridRowActionBusy = signal(false);
  readonly gridSelectedRowId = computed(() => {
    const index = this.gridOrigin()?.row;
    return index == null ? null : this.gridRows()[index]?.id ?? null;
  });

  clearSelectedBlankRow(): void {
    const id = this.gridSelectedRowId();
    if (!id?.startsWith('blank:')) return;
    this.blankDrafts.update(rows => { const next = { ...rows }; delete next[id]; return next; });
  }

  async resetSelectedGridRow(): Promise<void> { return this.resetGridRow(this.gridSelectedRowId()); }
  async resetGridRow(id: string | null): Promise<void> {
    if (!id) return;
    if (id.startsWith('blank:')) { this.blankDrafts.update(rows => { const next={...rows}; delete next[id]; return next; }); return; }
    this.toast.confirm('Reset this pricing row?', () => void this.performGridReset(id), 'Clears labor, price and manual part cost; makes the row inactive and private.', 'Reset row'); return;
  }
  private async performGridReset(id: string): Promise<void> {
    if (this.gridQueued.has(id) || this.gridBusy()) { this.toast.error('Wait for pending changes to save before resetting.'); return; }
    this.gridRowActionBusy.set(true);
    try {
      const updated = await firstValueFrom(this.pricingApi.resetWorksheetOption(id));
      this.options.update(rows => rows.map(row => row.id === id ? updated : row));
      this.gridDrafts.update(rows => { const next = { ...rows }; delete next[id]; return next; });
      this.toast.success('Pricing row reset');
    } catch (error) { console.error(error); this.toast.error('Could not reset this row'); }
    finally { this.gridRowActionBusy.set(false); }
  }

  async deleteSelectedGridRow(): Promise<void> { return this.deleteGridRow(this.gridSelectedRowId()); }
  async deleteGridRow(id: string | null): Promise<void> {
    if (!id) return;
    if (id.startsWith('blank:')) { this.blankDrafts.update(rows => { const next={...rows}; delete next[id]; return next; }); return; }
    this.toast.confirm('Permanently delete pricing row?', () => void this.performGridDelete(id), 'Cannot be undone. Pricing options used by quotes or repairs cannot be deleted.', 'Delete row'); return;
  }
  private async performGridDelete(id: string): Promise<void> {
    if (this.gridQueued.has(id) || this.gridBusy()) { this.toast.error('Wait for pending changes to save before deleting.'); return; }
    this.gridRowActionBusy.set(true);
    try {
      await firstValueFrom(this.pricingApi.deleteWorksheetOption(id));
      this.options.update(rows => rows.filter(row => row.id !== id));
      this.gridDrafts.update(rows => { const next = { ...rows }; delete next[id]; return next; });
      this.gridOrigin.set(null);
      this.toast.success('Pricing row deleted');
    } catch (error) { console.error(error); this.toast.error('Could not delete. If this option was used in a quote or repair, set it Inactive instead.'); }
    finally { this.gridRowActionBusy.set(false); }
  }

  private async flushGridChanges(): Promise<void> {
    if (this.gridFlushing || !this.gridQueued.size) return;
    this.gridFlushing = true;
    this.gridBusy.set(true);
    try {
      while (this.gridQueued.size) {
        const changes = [...this.gridQueued.values()].slice(0, 100);
        changes.forEach(change => this.gridQueued.delete(change.id));
        try {
          const result = await firstValueFrom(this.pricingApi.batchUpdatePrices(changes));
          const byId = new Map(result.data.map(row => [row.id, row]));
          this.options.update(options => options.map(row => byId.get(row.id) || row));
          // A user may edit a row again while its previous save is in flight.
          // Carry forward the new row version so the next save does not conflict.
          changes.forEach(change => {
            const next = this.gridQueued.get(change.id);
            const saved = byId.get(change.id);
            if (next && saved) this.gridQueued.set(change.id, { ...next, expectedUpdatedAt: saved.updatedAt });
          });
          this.gridDrafts.update(all => {
            const next = { ...all };
            changes.forEach(change => { if (!this.gridQueued.has(change.id)) delete next[change.id]; });
            return next;
          });
        } catch (error) {
          console.error('Pricing worksheet autosave failed', error);
          // Don't silently discard the edit. Keep the pending value visible and retryable.
          changes.forEach(change => { if (!this.gridQueued.has(change.id)) this.gridQueued.set(change.id, change); });
          this.gridSaveError.set('Changes could not be saved. Check your connection or reload if another user edited these prices.');
          break;
        }
      }
    } finally {
      this.gridFlushing = false;
      this.gridBusy.set(false);
    }
  }

  retryGridSave(): void { void this.flushGridChanges(); }

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
  readonly viewMode = signal<PricingViewMode>('sheet');
  readonly sheetSaving = signal<Set<string>>(new Set());
  readonly sheetErrors = signal<Record<string, string>>({});
  readonly sheetFilter = signal<'all' | 'unpriced' | 'active'>('all');
  readonly sheetDrafts = signal<Record<string, string>>({});
  readonly sheetCreating = signal<Set<string>>(new Set());
  readonly overview = signal<PricingOverview | null>(null);
  readonly pricingRules = signal<PricingRule[]>([]);
  readonly supplierHealth = signal<SupplierPricingHealthRow[]>([]);
  readonly overviewLoading = signal(false);
  readonly rulesLoading = signal(false);
  readonly supplierHealthLoading = signal(false);
  readonly supplierRefreshingId = signal<string | null>(null);
  readonly newRuleOpen = signal(false);
  readonly ruleSaving = signal(false);
  readonly ruleScope = signal<PricingRuleScope>('brand');
  readonly ruleRepairNeedId = signal<string>('');
  readonly ruleVariantName = signal('Standard');
  readonly ruleLaborDollars = signal('100');
  readonly ruleFixedPriceDollars = signal('');
  readonly ruleDynamicPricing = signal(true);
  readonly ruleFutureModels = signal(true);
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
      const [typesResponse, categoriesResponse, rulesResponse, supplierResponse] = await Promise.all([
        firstValueFrom(this.pricingApi.listRepairTypes()),
        firstValueFrom(this.catalogApi.listManagedCategories(false)),
        firstValueFrom(this.pricingApi.listRules()).catch(() => ({ data: [] as PricingRule[] })),
        firstValueFrom(this.pricingApi.listSupplierHealth()).catch(() => ({ data: [] as SupplierPricingHealthRow[] })),
      ]);

      this.repairTypes.set(this.sortRepairTypes(typesResponse.data ?? []));
      this.categories.set(categoriesResponse.data ?? []);
      this.pricingRules.set(rulesResponse.data ?? []);
      this.supplierHealth.set(supplierResponse.data ?? []);
      if (!this.ruleRepairNeedId() && this.repairTypes().length) {
        this.ruleRepairNeedId.set(this.repairTypes()[0]!.id);
      }

      // Resolve the initial route completely before the first paint. Previously the
      // overview request raced route-state hydration, which could leave the dashboard
      // looking half-loaded until another view was visited.
      await this.applyRouteState(this.route.snapshot.queryParamMap);

      this.subscriptions.add(
        this.route.queryParamMap.subscribe((params) => {
          void this.applyRouteState(params);
        }),
      );

      this.modelSearch$.next('');
      void this.loadGridCatalog();
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

  onPricingToolSelected(value: string): void {
    if (value === 'overview' || value === 'rules' || value === 'suppliers' || value === 'list' || value === 'setup') {
      this.setViewMode(value);
    }
  }

  setViewMode(value: PricingViewMode): void {
    if (this.viewMode() === value) return;
    this.selectedOptionIds.set(new Set());
    void this.updateQuery({ view: value });
    if (value === 'overview') void this.loadOverview();
    if (value === 'rules') void this.loadRules();
    if (value === 'suppliers') void this.loadSupplierHealth();
  }

  openAttentionQueue(): void {
    this.selectedOptionIds.set(new Set());
    void this.updateQuery({ view: 'setup', setup: 'attention', advance: null });
  }

  async refreshOverview(): Promise<void> {
    await Promise.all([
      this.loadOverview(),
      this.loadRules(),
      this.loadSupplierHealth(),
    ]);
  }

  async loadOverview(): Promise<void> {
    if (this.overviewLoading()) return;
    this.overviewLoading.set(true);
    try {
      this.overview.set(await firstValueFrom(this.pricingApi.getOverview({
        categoryId: this.selectedCategoryId() ?? undefined,
        brandId: this.selectedBrandId() ?? undefined,
      })));
    } catch (error) {
      console.error(error);
      this.toast.error('Could not load pricing health');
    } finally {
      this.overviewLoading.set(false);
    }
  }

  async loadRules(): Promise<void> {
    if (this.rulesLoading()) return;
    this.rulesLoading.set(true);
    try {
      const response = await firstValueFrom(this.pricingApi.listRules());
      this.pricingRules.set(response.data ?? []);
    } catch (error) {
      console.error(error);
      this.toast.error('Could not load pricing rules');
    } finally {
      this.rulesLoading.set(false);
    }
  }

  async loadSupplierHealth(): Promise<void> {
    if (this.supplierHealthLoading()) return;
    this.supplierHealthLoading.set(true);
    try {
      const response = await firstValueFrom(this.pricingApi.listSupplierHealth());
      this.supplierHealth.set(response.data ?? []);
    } catch (error) {
      console.error(error);
      this.toast.error('Could not load supplier pricing health');
    } finally {
      this.supplierHealthLoading.set(false);
    }
  }

  openNewRule(): void {
    this.newRuleOpen.set(true);
    if (!this.ruleRepairNeedId() && this.repairTypes().length) this.ruleRepairNeedId.set(this.repairTypes()[0]!.id);
  }

  closeNewRule(): void { this.newRuleOpen.set(false); }

  updateRuleScope(value: string): void { this.ruleScope.set(value as PricingRuleScope); }
  updateRuleRepairNeed(value: string): void { this.ruleRepairNeedId.set(value); }
  updateRuleVariant(value: string): void { this.ruleVariantName.set(value); }
  updateRuleLabor(value: string): void { this.ruleLaborDollars.set(value); }
  updateRuleFixedPrice(value: string): void { this.ruleFixedPriceDollars.set(value); }
  updateRuleDynamic(value: boolean): void { this.ruleDynamicPricing.set(value); }
  updateRuleFuture(value: boolean): void { this.ruleFutureModels.set(value); }

  async saveRule(): Promise<void> {
    if (this.ruleSaving() || !this.ruleRepairNeedId()) return;
    const scope = this.ruleScope();
    if (scope === 'category' && !this.selectedCategoryId()) { this.toast.error('Choose a category first'); return; }
    if (scope === 'brand' && !this.selectedBrandId()) { this.toast.error('Choose a brand in Setup first'); return; }
    const labor = Number(this.ruleLaborDollars());
    const fixed = Number(this.ruleFixedPriceDollars());
    this.ruleSaving.set(true);
    try {
      const response = await firstValueFrom(this.pricingApi.createRule({
        repairNeedId: this.ruleRepairNeedId(),
        scope,
        categoryId: scope === 'category' || scope === 'brand' ? this.selectedCategoryId() : null,
        brandId: scope === 'brand' ? this.selectedBrandId() : null,
        variantName: this.ruleVariantName().trim() || 'Standard',
        laborCents: Number.isFinite(labor) ? Math.round(labor * 100) : null,
        fixedPriceCents: !this.ruleDynamicPricing() && Number.isFinite(fixed) ? Math.round(fixed * 100) : null,
        useDynamicPricing: this.ruleDynamicPricing(),
        appliesToFutureModels: this.ruleFutureModels(),
        requiresProduct: true,
      }));
      this.toast.success(`Pricing rule saved · ${response.materialized.createdCount + response.materialized.updatedCount} options applied`);
      this.newRuleOpen.set(false);
      await Promise.all([this.loadRules(), this.loadOverview(), this.refreshSetupOptions()]);
    } catch (error) {
      console.error(error);
      this.toast.error('Could not save pricing rule');
    } finally { this.ruleSaving.set(false); }
  }

  async applyRule(rule: PricingRule): Promise<void> {
    try {
      const result = await firstValueFrom(this.pricingApi.applyRule(rule.id));
      this.toast.success(`Rule applied to ${result.createdCount + result.updatedCount} pricing options`);
      await Promise.all([this.loadOverview(), this.refreshSetupOptions()]);
    } catch (error) { console.error(error); this.toast.error('Could not apply pricing rule'); }
  }

  async refreshSupplier(row: SupplierPricingHealthRow): Promise<void> {
    if (this.supplierRefreshingId()) return;
    this.supplierRefreshingId.set(row.id);
    try {
      const result = await firstValueFrom(this.pricingApi.refreshSupplierHealth(row.id));
      this.toast.success(result.changed ? 'Supplier cost changed — pricing refreshed' : 'Supplier pricing is current');
      await Promise.all([this.loadSupplierHealth(), this.loadOverview(), this.loadOptions(this.pricingSearch())]);
    } catch (error) { console.error(error); this.toast.error('Supplier price check failed'); }
    finally { this.supplierRefreshingId.set(null); }
  }

  async toggleSupplierMonitoring(row: SupplierPricingHealthRow): Promise<void> {
    try {
      await firstValueFrom(this.pricingApi.setSupplierMonitoring(row.id, !row.priceMonitoringEnabled));
      await this.loadSupplierHealth();
    } catch (error) { console.error(error); this.toast.error('Could not update monitoring'); }
  }

  supplierCheckLabel(row: SupplierPricingHealthRow): string {
    if (row.lastPriceCheckError) return 'Check failed';
    if (!row.lastPriceCheckAt) return 'Never checked';
    return new Date(row.lastPriceCheckAt).toLocaleString();
  }

  supplierDeltaLabel(row: SupplierPricingHealthRow): string {
    if (row.costDeltaCents == null || row.costDeltaCents === 0) return 'No change';
    const sign = row.costDeltaCents > 0 ? '+' : '−';
    return `${sign}${this.money(Math.abs(row.costDeltaCents))}`;
  }

  ruleScopeLabel(rule: PricingRule): string {
    if (rule.scope === 'global') return 'All devices';
    return rule.deviceCatalogModel?.name || rule.brand?.name || rule.category?.name || rule.scope;
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

  async runBulkAction(action: PricingOptionBulkAction, amount?: number): Promise<void> {
    const ids = this.viewMode() === 'sheet'
      ? this.sheetSelectedOptions().map((row) => row.id)
      : [...this.selectedOptionIds()];
    if (!ids.length || this.bulkSaving() || this.sheetBatchRunning()) return;

    this.bulkSaving.set(true);
    try {
      await firstValueFrom(this.pricingApi.bulkAction({ ids, action, amount }));
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

  bulkSetLabor(): void {
    const raw = window.prompt('Set labor for selected pricing options (dollars):', '100');
    if (raw == null) return;
    const dollars = Number(raw);
    if (!Number.isFinite(dollars) || dollars < 0) { this.toast.error('Enter a valid labor amount'); return; }
    void this.runBulkAction('set_labor', Math.round(dollars * 100));
  }

  bulkAddLabor(): void {
    const raw = window.prompt('Add this much labor to each selected option (dollars):', '25');
    if (raw == null) return;
    const dollars = Number(raw);
    if (!Number.isFinite(dollars) || dollars < 0) { this.toast.error('Enter a valid amount'); return; }
    void this.runBulkAction('increase_labor', Math.round(dollars * 100));
  }

  bulkSetDuration(): void {
    const raw = window.prompt('Set booking duration for selected options (minutes):', '60');
    if (raw == null) return;
    const minutes = Number(raw);
    if (!Number.isFinite(minutes) || minutes < 5) { this.toast.error('Enter a valid duration'); return; }
    void this.runBulkAction('set_duration', Math.round(minutes));
  }

  deactivateOption(option: PricingOption): void {
    this.toast.confirm(
      `Deactivate ${option.variantName}?`,
      () => void this.confirmDeactivate(option),
      'It will be removed from public booking but kept for reporting.',
      'Deactivate',
    );
  }

  readonly sheetOptions = computed(() => {
    const search = this.pricingSearch().trim().toLowerCase();
    return this.filteredOptions().filter((row) => {
      if (this.sheetFilter() === 'unpriced' && (row.useDynamicPricing || row.fixedPriceCents != null)) return false;
      if (this.sheetFilter() === 'active' && !row.isActive) return false;
      if (!search) return true;
      return [this.modelLabel(row), row.repairType.label, row.variantName, row.product?.sku || '']
        .some((value) => value.toLowerCase().includes(search));
    });
  });


  // Worksheet selection uses zero-based row/column indices. A:H are the
  // presentation columns; only E (labor) and F (selling price) are writable.
  readonly sheetColumnLetters = ['A','B','C','D','E','F','G','H'];
  readonly sheetSelection = signal<{row:number; col:number; endRow:number; endCol:number} | null>(null);
  readonly sheetPendingPaste = signal<string[][] | null>(null);
  readonly sheetPasteWarning = signal('');
  readonly sheetCellName = computed(() => {
    const cell = this.sheetSelection();
    return cell ? `${this.sheetColumnLetters[cell.col]}${cell.row+1}` : '—';
  });
  readonly sheetCellDescription = computed(() => {
    const selection = this.sheetSelection();
    if (!selection) return 'Click a worksheet cell to select it';
    const row = this.sheetOptions()[selection.row];
    if (!row) return 'New repair · enter a selling price to create draft';
    return `${this.modelLabel(row)} · ${row.repairType.label} · ${this.sheetColumnLetters[selection.col]}`;
  });
  readonly sheetPasteAffected = computed(() => {
    const paste = this.sheetPendingPaste(), active = this.sheetSelection();
    if (!paste || !active) return 0;
    return paste.reduce((sum, cells, y) => sum + cells.filter((_, x) => {
      const col = active.col+x, row = active.row+y;
      return (col === 4 && row < this.sheetOptions().length || col === 5) && row < this.sheetOptions().length + this.sheetMissingRows().length;
    }).length, 0);
  });
  isWorksheetSelected(row:number,col:number):boolean {
    const s=this.sheetSelection();
    return !!s && row>=Math.min(s.row,s.endRow) && row<=Math.max(s.row,s.endRow) && col>=Math.min(s.col,s.endCol) && col<=Math.max(s.col,s.endCol);
  }
  selectWorksheetCell(row:number,col:number,event:MouseEvent):void {
    const old=this.sheetSelection();
    if (event.shiftKey && old) this.sheetSelection.set({...old,endRow:row,endCol:col});
    else this.sheetSelection.set({row,col,endRow:row,endCol:col});
  }
  selectWorksheetFocus(row:number,col:number):void {
    const old=this.sheetSelection();
    if (!old || !this.isWorksheetSelected(row,col)) this.sheetSelection.set({row,col,endRow:row,endCol:col});
  }
  private worksheetValue(row:number,col:number):string {
    const option=this.sheetOptions()[row];
    if (option) {
      switch(col) {
        case 0:return this.modelLabel(option);
        case 1:return option.repairType.label;
        case 2:return option.variantName;
        case 3:return option.productSupplier?.lastKnownCostCents != null ? (option.productSupplier.lastKnownCostCents/100).toFixed(2) : option.product?.costCents != null ? (option.product.costCents/100).toFixed(2):'';
        case 4:return this.sheetAmount(option,'laborCents');
        case 5:return this.sheetAmount(option,'fixedPriceCents');
        case 6:return option.useDynamicPricing?'Automatic':option.isActive?'Active':'Inactive';
        default:return '';
      }
    }
    const missing=this.sheetMissingRows()[row-this.sheetOptions().length];
    if (!missing) return '';
    return col===0?`${missing.model.brandName} ${missing.model.name}`:col===1?missing.type.label:col===2?'Standard':col===4?(missing.type.defaultLaborCents==null?'':(missing.type.defaultLaborCents/100).toFixed(2)):col===5?(this.sheetDrafts()[missing.key]??''):'';
  }
  private worksheetTSV():string {
    const s=this.sheetSelection(); if (!s) return '';
    const lines:string[]=[];
    for(let r=Math.min(s.row,s.endRow);r<=Math.max(s.row,s.endRow);r++) {
      const cells:string[]=[];
      for(let c=Math.min(s.col,s.endCol);c<=Math.max(s.col,s.endCol);c++) cells.push(this.worksheetValue(r,c));
      lines.push(cells.join('\t'));
    }
    return lines.join('\r\n');
  }
  onWorksheetCopy(event:ClipboardEvent):void {
    if (!this.sheetSelection()) return;
    // Normal text selection inside an editor should still use native Copy.
    const target=event.target as HTMLElement;
    if (target instanceof HTMLInputElement && target.selectionStart !== target.selectionEnd) return;
    event.preventDefault(); event.clipboardData?.setData('text/plain',this.worksheetTSV());
  }
  async copySheetSelection():Promise<void> {
    const content=this.worksheetTSV(); if(!content)return;
    try { await navigator.clipboard.writeText(content);this.toast.success('Copied worksheet cells'); }
    catch { this.toast.error('Select cells and press Ctrl+C or ⌘C.'); }
  }
  onWorksheetPaste(event:ClipboardEvent):void {
    const text=event.clipboardData?.getData('text/plain');
    if(!text || !this.sheetSelection()) return;
    event.preventDefault();
    const rows=text.replace(/\r\n/g,'\n').replace(/\r/g,'\n').replace(/\n$/,'').split('\n').map(line=>line.split('\t'));
    this.stageWorksheetPaste(rows);
  }
  private stageWorksheetPaste(rows:string[][]):void {
    const origin=this.sheetSelection(); if(!origin || !rows.length) return;
    const total=this.sheetOptions().length+this.sheetMissingRows().length;
    const invalid=rows.some((cells,y)=>cells.some((v,x)=>{
      const col=origin.col+x, row=origin.row+y;
      if(row>=total || col>=8)return true;
      if(col!==4 && col!==5)return false;
      if(col===4 && row>=this.sheetOptions().length)return false;
      return !!v.trim() && this.parsePriceCents(v) === undefined;
    }));
    this.sheetPasteWarning.set(invalid?'Paste exceeds the visible grid or contains invalid amounts. Values must be nonnegative with at most two decimal places.':'');
    // One-cell paste follows Excel's immediate workflow. Larger ranges get
    // an explicit preview because each row currently uses its own API call.
    this.sheetPendingPaste.set(rows);
    if(rows.length===1 && rows[0].length===1 && !invalid && this.sheetPasteAffected()===1) {
      void this.commitWorksheetPaste();
    }
  }
  async commitWorksheetPaste():Promise<void> {
    const rows=this.sheetPendingPaste(), origin=this.sheetSelection();
    if(!rows || !origin || this.sheetPasteWarning() || this.sheetBatchRunning() || this.bulkSaving())return;
    const count=this.sheetPasteAffected();if(!count)return;
    const originalOptions=this.sheetOptions();
    const originalMissing=this.sheetMissingRows();
    this.sheetBatchRunning.set(true);
    let saved=0,failed=0;
    try {
      for(let y=0;y<rows.length;y++) {
        const rowIndex=origin.row+y;
        const option=originalOptions[rowIndex];
        const missing=originalMissing[rowIndex-originalOptions.length];
        const patch:Partial<PricingOptionInput>={};
        let newPrice:string|undefined;
        for(let x=0;x<rows[y].length;x++) {
          const col=origin.col+x, raw=rows[y][x].trim();
          if(col===4 && option)patch.laborCents=raw===''?null:this.parsePriceCents(raw)!;
          if(col===5) {
            if(option){patch.fixedPriceCents=raw===''?null:this.parsePriceCents(raw)!;patch.useDynamicPricing=false;}
            else if(missing)newPrice=raw;
          }
        }
        if(option && Object.keys(patch).length) {
          this.sheetBatchProgress.set(`Saving ${y+1} of ${rows.length} rows…`);
          try {
            const updated=await firstValueFrom(this.pricingApi.updateOption(option.id,patch));
            this.options.update(items=>items.map(item=>item.id===option.id?{...item,...updated}:item));saved++;
            this.sheetErrors.update(e=>{const n={...e};delete n[option.id];return n;});
          }catch(error){failed++;this.sheetErrors.update(e=>({...e,[option.id]:'Paste save failed'}));console.error('Worksheet paste failed',error);}
        } else if(missing && newPrice) {
          this.sheetDrafts.update(d=>({...d,[missing.key]:newPrice}));
          await this.createSheetPrice(missing.model,missing.type);
          if(this.sheetErrors()[missing.key])failed++;else saved++;
        }
      }
      this.sheetBatchProgress.set(`${saved} rows saved${failed?`, ${failed} failed`:''}`);
      this.sheetPendingPaste.set(null);
      if(failed)this.toast.error(`${failed} worksheet rows could not be saved`);
      else this.toast.success(`${saved} worksheet rows saved`);
    }finally{this.sheetBatchRunning.set(false);}
  }
  onWorksheetKeydown(event:KeyboardEvent):void {
    if(!this.sheetSelection() || this.sheetPendingPaste())return;
    const target=event.target as HTMLElement;
    if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='c')return;
    const deltas:Record<string,[number,number]>={ArrowUp:[-1,0],ArrowDown:[1,0],ArrowLeft:[0,-1],ArrowRight:[0,1],Tab:[0,event.shiftKey?-1:1],Enter:[event.shiftKey?-1:1,0]};
    const delta=deltas[event.key];if(!delta || event.metaKey || event.ctrlKey || event.altKey)return;
    // While typing, left/right navigate within text; Tab, Enter, up/down move cells.
    if(target instanceof HTMLInputElement && (event.key==='ArrowLeft'||event.key==='ArrowRight'))return;
    const current=this.sheetSelection()!;
    const rows=this.sheetOptions().length+this.sheetMissingRows().length;
    const row=Math.min(Math.max((event.shiftKey&&event.key.startsWith('Arrow')?current.endRow:current.row)+delta[0],0),Math.max(rows-1,0));
    const col=Math.min(Math.max((event.shiftKey&&event.key.startsWith('Arrow')?current.endCol:current.col)+delta[1],0),7);
    if(target instanceof HTMLInputElement && (event.key==='Enter'||event.key==='Tab'))target.blur();
    event.preventDefault();
    if(event.shiftKey&&event.key.startsWith('Arrow'))this.sheetSelection.set({...current,endRow:row,endCol:col});
    else this.sheetSelection.set({row,col,endRow:row,endCol:col});
    const next=document.querySelector<HTMLInputElement>(`[data-sheet-row="${row}"][data-sheet-col="${col}"]`);
    if(next)next.focus();
  }

  // Phase 4: model-to-model pricing. Source must be a configured fixed-price
  // option; only exact matching variants may be updated, and never by default.
  readonly modelCopySource = signal<PricingOption | null>(null);
  readonly modelCopyModels = signal<ManagedDeviceCatalogModel[]>([]);
  readonly modelCopyExisting = signal<PricingOption[]>([]);
  readonly modelCopyNotOffered = signal<Set<string>>(new Set());
  readonly modelCopyTargets = signal<Set<string>>(new Set());
  readonly modelCopyLoading = signal(false);
  readonly modelCopyRunning = signal(false);
  readonly modelCopyOverwrite = signal(false);
  readonly modelCopyProgress = signal('');
  readonly modelCopyPrice = signal('');
  readonly modelCopyLabor = signal('');
  readonly modelCopyPreview = computed(() => {
    const source = this.modelCopySource();
    if (!source) return [];
    return this.modelCopyModels()
      .filter((model) => this.modelCopyTargets().has(model.id))
      .map((model) => {
        const matches = this.modelCopyExisting().filter((row) =>
          row.deviceCatalogModelId === model.id &&
          row.repairNeedId === source.repairNeedId &&
          row.variantName.trim().toLowerCase() === source.variantName.trim().toLowerCase() &&
          row.attributeSignature === source.attributeSignature
        );
        const otherVariant = this.modelCopyExisting().some((row) =>
          row.deviceCatalogModelId === model.id && row.repairNeedId === source.repairNeedId &&
          row.variantName.trim().toLowerCase() === source.variantName.trim().toLowerCase() &&
          row.attributeSignature !== source.attributeSignature
        );
        const blocked = this.modelCopyNotOffered().has(model.id);
        const existing = matches.length === 1 ? matches[0] : null;
        const status = blocked ? 'Not offered — skipped'
          : matches.length > 1 ? 'Ambiguous — skipped'
          : otherVariant && !existing ? 'Different attributes — skipped'
          : existing ? (this.modelCopyOverwrite() ? 'Update existing price' : 'Already configured — skipped')
          : 'Create private draft';
        return { model, existing, status, actionable: !blocked && matches.length <= 1 && !(otherVariant && !existing) && (!existing || this.modelCopyOverwrite()) };
      });
  });
  readonly modelCopyValid = computed(() =>
    this.modelCopyPreview().some((row) => row.actionable) &&
    this.parsePriceCents(this.modelCopyPrice()) != null &&
    this.parsePriceCents(this.modelCopyLabor(), true) !== undefined
  );

  private parsePriceCents(raw: string, nullable = false): number | null | undefined {
    if (nullable && raw.trim() === '') return null;
    if (!/^(?:\d+)(?:\.\d{1,2})?$/.test(raw.trim()) || Number(raw) > 1000000) return undefined;
    return Math.round(Number(raw) * 100);
  }

  async openModelCopy(option: PricingOption): Promise<void> {
    if (this.modelCopyRunning() || this.modelCopyLoading()) return;
    if (!option.model || option.fixedPriceCents == null || option.useDynamicPricing) {
      this.toast.error('Choose a manually priced repair to copy.'); return;
    }
    if (option.repairType && this.repairTypes().find((t) => t.id === option.repairNeedId)?.quoteAttributeKeys.length) {
      this.toast.error('Repairs with quote attributes require the full editor.'); return;
    }
    this.modelCopySource.set(option);
    this.modelCopyTargets.set(new Set());
    this.modelCopyOverwrite.set(false);
    this.modelCopyProgress.set('');
    this.modelCopyPrice.set(this.sheetAmount(option, 'fixedPriceCents'));
    this.modelCopyLabor.set(this.sheetAmount(option, 'laborCents'));
    this.modelCopyModels.set([]);
    this.modelCopyExisting.set([]);
    this.modelCopyLoading.set(true);
    try {
      const [models, options, exclusions] = await Promise.all([
        firstValueFrom(this.catalogApi.listManagedModels(option.model.brandId, false)),
        firstValueFrom(this.pricingApi.listOptions({ brandId: option.model.brandId, includeInactive: true, includePrivate: true })),
        firstValueFrom(this.pricingApi.listNotOffered({ brandId: option.model.brandId })),
      ]);
      this.modelCopyModels.set((models.data ?? []).filter((m) => m.id !== option.deviceCatalogModelId && m.isActive));
      this.modelCopyExisting.set(options.data ?? []);
      this.modelCopyNotOffered.set(new Set((exclusions.data ?? []).filter((r) => r.repairNeedId === option.repairNeedId).map((r) => r.deviceCatalogModelId)));
    } catch (error) {
      console.error('Could not load model pricing comparison', error);
      this.modelCopySource.set(null);
      this.toast.error('Could not load target models');
    } finally { this.modelCopyLoading.set(false); }
  }

  toggleModelCopyTarget(id: string): void {
    if (this.modelCopyRunning()) return;
    this.modelCopyTargets.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  selectAllModelCopyTargets(): void {
    if (this.modelCopyRunning()) return;
    const models = this.modelCopyModels();
    this.modelCopyTargets.set(this.modelCopyTargets().size === models.length
      ? new Set() : new Set(models.map((model) => model.id)));
  }

  closeModelCopy(): void {
    if (this.modelCopyRunning()) return;
    this.modelCopySource.set(null);
    this.modelCopyTargets.set(new Set());
  }

  async applyModelCopy(): Promise<void> {
    const source = this.modelCopySource();
    if (!source || !this.modelCopyValid() || this.modelCopyRunning() || this.bulkSaving() || this.sheetBatchRunning() || this.sheetSaving().size) return;
    const items = this.modelCopyPreview().filter((row) => row.actionable);
    const fixed = this.parsePriceCents(this.modelCopyPrice());
    const labor = this.parsePriceCents(this.modelCopyLabor(), true);
    if (fixed === undefined || fixed === null || labor === undefined) return;
    const updates = items.filter((row) => row.existing).length;
    if (!window.confirm(`Apply ${this.money(fixed)} to ${items.length} device models? ${updates} existing prices will be changed; ${items.length - updates} new entries will be PRIVATE, INACTIVE drafts. This operation cannot be undone automatically.`)) return;
    this.modelCopyRunning.set(true);
    let saved = 0, failed = 0;
    try {
      for (let i = 0; i < items.length; i++) {
        const { model, existing } = items[i];
        this.modelCopyProgress.set(`Saving ${i + 1} of ${items.length}…`);
        try {
          if (existing) {
            const updated = await firstValueFrom(this.pricingApi.updateOption(existing.id, {
              fixedPriceCents: fixed, laborCents: labor, useDynamicPricing: false,
            }));
            this.modelCopyExisting.update((rows) => rows.map((r) => r.id === existing.id ? updated : r));
          } else {
            const created = await firstValueFrom(this.pricingApi.createOption({
              deviceCatalogModelId: model.id,
              repairNeedId: source.repairNeedId,
              variantName: source.variantName,
              fixedPriceCents: fixed,
              laborCents: labor,
              useDynamicPricing: false,
              durationMins: source.durationMins,
              requiresProduct: false,
              isActive: false,
              isPublic: false,
            }));
            this.modelCopyExisting.update((rows) => [...rows, created]);
          }
          saved++;
        } catch (error) {
          console.error('Model price copy failed', model.id, error);
          failed++;
        }
      }
      this.modelCopyProgress.set(`${saved} saved; ${failed} failed`);
      if (failed) this.toast.error(`${failed} model prices failed`, 'Successful changes were saved. Review targets before retrying.');
      else { this.toast.success(`${saved} model prices saved`); this.modelCopySource.set(null); this.modelCopyTargets.set(new Set()); }
      await this.loadOptions(this.pricingSearch());
    } finally { this.modelCopyRunning.set(false); }
  }

  // Phase 3: selected spreadsheet rows and a reviewable TSV paste operation.
  readonly sheetPasteOpen = signal(false);
  readonly sheetPasteText = signal('');
  readonly sheetBatchRunning = signal(false);
  readonly sheetBatchProgress = signal('');
  readonly sheetSelectedOptions = computed(() =>
    this.sheetOptions().filter((row) => this.selectedOptionIds().has(row.id))
  );
  readonly sheetAllSelected = computed(() => {
    const rows = this.sheetOptions();
    return rows.length > 0 && rows.every((row) => this.selectedOptionIds().has(row.id));
  });
  readonly sheetPasteRows = computed(() => {
    const raw = this.sheetPasteText().trim();
    if (!raw) return [] as { laborCents?: number; fixedPriceCents: number | null; error?: string }[];
    return raw.split(/\r?\n/).map((line) => {
      const cells = line.split('\t').map((cell) => cell.trim());
      const error = cells.length < 1 || cells.length > 2 ? 'Use one or two columns' : undefined;
      const amount = (value: string) =>
        /^(?:\d+)(?:\.\d{1,2})?$/.test(value) && Number(value) <= 1000000
          ? Math.round(Number(value) * 100) : null;
      const price = amount(cells[cells.length - 1] ?? '');
      const labor = cells.length === 2 ? amount(cells[0]) : undefined;
      return {
        ...(cells.length === 2 ? { laborCents: labor ?? undefined } : {}),
        fixedPriceCents: price,
        error: error ?? (price == null ? 'Invalid selling price' : (cells.length === 2 && labor == null ? 'Invalid labor' : undefined)),
      };
    });
  });
  readonly sheetPasteValid = computed(() =>
    this.sheetPasteRows().length > 0 &&
    this.sheetPasteRows().length === this.sheetSelectedOptions().length &&
    this.sheetPasteRows().every((row) => !row.error)
  );
  toggleSheetAll(): void {
    const next = new Set(this.selectedOptionIds());
    if (this.sheetAllSelected()) this.sheetOptions().forEach((row) => next.delete(row.id));
    else this.sheetOptions().forEach((row) => next.add(row.id));
    this.selectedOptionIds.set(next);
  }
  // CSV round-trip: stable IDs prevent name/sort changes from editing the wrong repair.
  // A copied row with a different Option is interpreted as a NEW private draft.
  readonly csvImportOpen = signal(false);
  readonly csvImportBusy = signal(false);
  readonly csvImportProgress = signal('');
  readonly csvImportItems = signal<CsvPriceImportItem[]>([]);
  readonly csvImportFileName = signal('');
  readonly csvImportError = signal('');
  readonly csvImportFinished = signal(false);

  exportSheetCsv(): void {
    const escapeCsv = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const fields = ['Pricing ID', 'Device ID', 'Repair ID', 'Device', 'Repair', 'Option', 'Labor', 'Fixed selling price', 'Mode', 'Visibility', 'Status', 'Updated At'];
    const records = [fields, ...this.options().map(row => [
      row.id, row.deviceCatalogModelId ?? '', row.repairNeedId,
      this.modelLabel(row), row.repairType.label, row.variantName,
      this.sheetAmount(row, 'laborCents'), this.sheetAmount(row, 'fixedPriceCents'),
      row.useDynamicPricing ? 'Automatic' : 'Manual', row.isPublic ? 'Public' : 'Private',
      row.isActive ? 'Active' : 'Inactive', row.updatedAt,
    ])];
    const csv = records.map(record => record.map(value => escapeCsv(String(value ?? ''))).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'opscend-repair-pricing.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  closeCsvImport(): void {
    if (this.csvImportBusy()) return;
    this.csvImportOpen.set(false);
  }

  async handleCsvImport(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.csvImportOpen.set(true);
    this.csvImportFileName.set(file.name);
    this.csvImportError.set('');
    this.csvImportFinished.set(false);
    this.csvImportItems.set([]);
    try {
      if (file.size > 5_000_000) throw new Error('CSV must be smaller than 5 MB.');
      // Read current server state before comparing; do not trust stale worksheet data.
      const response = await firstValueFrom(this.pricingApi.listOptions({ includeInactive: true, includePrivate: true }));
      const existing = response.data ?? [];
      const parsed = parsePricingCsv(await file.text());
      if (!parsed.length) throw new Error('No data rows found in the CSV.');
      if (parsed.length > 5000) throw new Error('Import up to 5,000 rows at a time.');
      this.csvImportItems.set(this.previewPricingCsv(parsed, existing));
    } catch (error) {
      this.csvImportError.set(error instanceof Error ? error.message : 'Unable to read CSV.');
    }
  }

  private previewPricingCsv(rows: Array<Record<string, string>>, existing: PricingOption[]): CsvPriceImportItem[] {
    const byId = new Map(existing.map(o => [o.id, o]));
    const seen = new Set<string>();
    const planned = new Set(existing.map(o => `${o.deviceCatalogModelId ?? ''}|${o.repairNeedId}|${o.variantName.trim().toLowerCase()}`));
    return rows.map((row, index) => {
      const label = [row['Device'], row['Repair'], row['Option']].filter(Boolean).join(' · ');
      const output: CsvPriceImportItem = { line: index + 2, label, action: 'skip', message: 'Unchanged', payload: null, sourceId: '' };
      try {
        const id = (row['Pricing ID'] || '').trim();
        const source = id ? byId.get(id) : undefined;
        if (id && !source) throw new Error('Unknown Pricing ID. Export a new CSV before importing.');
        const modelId = (row['Device ID'] || '').trim() || source?.deviceCatalogModelId || '';
        const repairId = (row['Repair ID'] || '').trim() || source?.repairNeedId || '';
        const variant = (row['Option'] || '').trim();
        if (!modelId || !repairId || !variant) throw new Error('Device ID, Repair ID and Option are required.');
        if (source && row['Updated At'] !== source.updatedAt) throw new Error('This pricing row changed since export. Re-export before importing.');
        if (source && (source.deviceCatalogModelId !== modelId || source.repairNeedId !== repairId)) throw new Error('Device/Repair IDs do not match the source row.');
        if (source && (row['Device'] !== this.modelLabel(source) || row['Repair'] !== source.repairType.label)) throw new Error('Device or Repair label differs from the source.');
        if (variant.length > 120) throw new Error('Option name is too long.');
        const labor = pricingCsvCents(row['Labor']);
        const fixed = pricingCsvCents(row['Fixed selling price']);
        const mode = row['Mode'].trim().toLowerCase();
        const visibility = row['Visibility'].trim().toLowerCase();
        const status = row['Status'].trim().toLowerCase();
        if (!['automatic', 'manual'].includes(mode)) throw new Error('Mode must be Automatic or Manual.');
        if (!['public', 'private'].includes(visibility)) throw new Error('Visibility must be Public or Private.');
        if (!['active', 'inactive'].includes(status)) throw new Error('Status must be Active or Inactive.');
        const dynamic = mode === 'automatic';
        const isPublic = visibility === 'public';
        const isActive = status === 'active';
        const key = `${modelId}|${repairId}|${variant.toLowerCase()}`;
        const sameVariant = source && source.variantName.trim().toLowerCase() === variant.toLowerCase();
        if (sameVariant && source) {
          if (seen.has(source.id)) throw new Error('Duplicate existing row in CSV.');
          seen.add(source.id);
          const patch: Partial<PricingOptionInput> = {};
          if (source.laborCents !== labor) patch.laborCents = labor;
          if (source.fixedPriceCents !== fixed) patch.fixedPriceCents = fixed;
          if (source.useDynamicPricing !== dynamic) patch.useDynamicPricing = dynamic;
          if (source.isPublic !== isPublic) patch.isPublic = isPublic;
          if (source.isActive !== isActive) patch.isActive = isActive;
          if (!Object.keys(patch).length) return output;
          output.action = 'update'; output.sourceId = source.id;
          output.payload = patch;
          output.message = Object.keys(patch).join(', ');
        } else {
          const template = source ?? existing.find(o => o.deviceCatalogModelId === modelId && o.repairNeedId === repairId);
          if (!template) throw new Error('New option needs an existing repair row to copy.');
          if (planned.has(key)) throw new Error('This device, repair and option already exists (or appears twice).');
          planned.add(key);
          output.action = 'create';
          output.message = 'New inactive, private draft';
          output.sourceId = template.id;
          output.payload = {
            deviceCatalogModelId: modelId, repairNeedId: repairId, variantName: variant,
            laborCents: labor, fixedPriceCents: fixed, useDynamicPricing: dynamic,
            isActive: false, isPublic: false,
            serviceId: template.serviceId, productId: template.productId,
            productSupplierId: template.productSupplierId,
            requiresProduct: template.requiresProduct, attributeValues: template.attributeValues,
            durationMins: template.durationMins, description: template.description,
            depositMode: template.depositMode, depositAmountCents: template.depositAmountCents,
            depositShippingCents: template.depositShippingCents,
            depositIncludeProcessingFees: template.depositIncludeProcessingFees,
            depositIncludeInstantPayoutFee: template.depositIncludeInstantPayoutFee,
            requiresManualReview: template.requiresManualReview,
            allowInstantConfirmation: template.allowInstantConfirmation,
          } satisfies PricingOptionInput;
        }
      } catch (error) {
        output.action = 'error';
        output.message = error instanceof Error ? error.message : 'Invalid row';
      }
      return output;
    });
  }

  async applyCsvImport(): Promise<void> {
    if (this.csvImportBusy() || this.gridBusy()) return;
    const items = this.csvImportItems();
    const ready = items.filter(item => item.action === 'create' || item.action === 'update');
    if (!ready.length || items.some(item => item.action === 'error')) return;
    this.csvImportBusy.set(true);
    this.csvImportError.set('');
    let done = 0;
    let failed = 0;
    try {
      // Existing rows use optimistic-concurrency checking through the existing batch API.
      const updates = ready.filter(item => item.action === 'update');
      for (let i = 0; i < updates.length; i += 100) {
        const group = updates.slice(i, i + 100);
        this.csvImportProgress.set(`Updating existing prices: ${done} of ${ready.length}`);
        try {
          const serverRows = (await firstValueFrom(this.pricingApi.listOptions({ includeInactive: true, includePrivate: true }))).data ?? [];
          const serverMap = new Map(serverRows.map(row => [row.id, row]));
          const batch = group.map(item => {
            const current = serverMap.get(item.sourceId);
            if (!current) throw new Error(`Line ${item.line}: pricing option no longer exists.`);
            return { id: current.id, expectedUpdatedAt: current.updatedAt, ...(item.payload as Partial<PricingOptionInput>) };
          });
          await firstValueFrom(this.pricingApi.batchUpdatePrices(batch));
          done += group.length;
        } catch (error) {
          failed += group.length;
          this.csvImportError.set(`An update batch failed. Refresh and re-export before retrying. ${error instanceof Error ? error.message : ''}`);
          break;
        }
      }
      if (!failed) {
        for (const item of ready.filter(entry => entry.action === 'create')) {
          this.csvImportProgress.set(`Saving new options: ${done} of ${ready.length}`);
          try {
            await firstValueFrom(this.pricingApi.createOption(item.payload as PricingOptionInput));
            done++;
          } catch (error) {
            failed++;
            item.action = 'error';
            item.message = `Creation failed: ${error instanceof Error ? error.message : 'Check server validation'}`;
          }
        }
      }
      this.csvImportItems.set([...items]);
      await this.loadOptions('');
      this.csvImportFinished.set(true);
      this.csvImportProgress.set(`${done} saved, ${failed} failed, ${items.filter(x => x.action === 'skip').length} unchanged`);
      if (failed) this.toast.error(`${failed} CSV rows failed. Review the results before retrying.`);
      else this.toast.success(`${done} pricing changes imported`);
    } finally {
      this.csvImportBusy.set(false);
    }
  }

  async applySheetPaste(): Promise<void> {
    if (!this.sheetPasteValid() || this.sheetBatchRunning() || this.bulkSaving()) return;
    const selected = this.sheetSelectedOptions();
    const values = this.sheetPasteRows();
    if (selected.some((row) => this.sheetSaving().has(row.id))) {
      this.toast.error('Wait for individual price saves to finish.');
      return;
    }
    if (!window.confirm(`Apply ${values.length} pasted selling prices to the selected repairs? This changes saved prices immediately; it will not activate or publish drafts.`)) return;
    this.sheetBatchRunning.set(true);
    let completed = 0;
    let failed = 0;
    try {
      for (let i = 0; i < selected.length; i++) {
        const option = selected[i];
        const pasted = values[i];
        this.sheetBatchProgress.set(`Saving ${i + 1} of ${selected.length}…`);
        try {
          const payload: Partial<PricingOptionInput> = {
            fixedPriceCents: pasted.fixedPriceCents,
            useDynamicPricing: false,
            ...(pasted.laborCents !== undefined ? { laborCents: pasted.laborCents } : {}),
          };
          const updated = await firstValueFrom(this.pricingApi.updateOption(option.id, payload));
          this.options.update((rows) => rows.map((row) => row.id === option.id ? { ...row, ...updated } : row));
          this.sheetErrors.update((errors) => { const next = { ...errors }; delete next[option.id]; return next; });
          completed++;
        } catch (error) {
          console.error('Bulk spreadsheet save failed', option.id, error);
          this.sheetErrors.update((errors) => ({ ...errors, [option.id]: 'Bulk save failed — retry individually.' }));
          failed++;
        }
      }
      this.sheetBatchProgress.set(`${completed} saved${failed ? `, ${failed} failed` : ''}`);
      if (!failed) {
        this.sheetPasteOpen.set(false);
        this.sheetPasteText.set('');
        this.clearSelection();
        this.toast.success(`${completed} repair prices saved`);
      } else {
        this.toast.error(`${failed} price updates failed`, 'Successful rows were saved. Review highlighted rows and retry.');
      }
    } finally {
      this.sheetBatchRunning.set(false);
    }
  }

  // Show genuinely missing repairs only for a selected device. No fabricated
  // pricing rows are loaded globally across the entire catalog.
  readonly sheetMissingRows = computed(() => {
    const model = this.selectedModel();
    if (!model || this.sheetFilter() === 'active' || this.pricingSearch().trim()) return [];
    const existing = new Set(this.options()
      .filter((option) => option.deviceCatalogModelId === model.id)
      .map((option) => option.repairNeedId));
    const search = this.pricingSearch().trim().toLowerCase();
    return this.repairTypes()
      .filter((type) => type.isActive && !existing.has(type.id))
      .filter((type) => !search || [type.label, type.code, model.name, model.brandName]
        .some((value) => value.toLowerCase().includes(search)))
      .map((type) => ({ model, type, key: `${model.id}:${type.id}` }));
  });

  setSheetDraft(key: string, value: string): void {
    this.sheetDrafts.update((drafts) => ({ ...drafts, [key]: value }));
  }

  async createSheetPrice(model: ManagedDeviceCatalogModel, type: RepairType): Promise<void> {
    const key = `${model.id}:${type.id}`;
    if (this.sheetCreating().has(key)) return;
    if (!(this.sheetDrafts()[key] ?? '').trim()) return;
    const raw = (this.sheetDrafts()[key] ?? '').trim();
    if (!/^(?:\d+)(?:\.\d{1,2})?$/.test(raw) || Number(raw) > 1000000) {
      this.sheetErrors.update((errors) => ({ ...errors, [key]: 'Enter a valid price to create this repair.' }));
      return;
    }
    // Options with required quote attributes must use the full editor: it
    // collects the values needed for the API's uniqueness and quote contract.
    if (type.quoteAttributeKeys.length) {
      this.newOptionFor(model, type);
      return;
    }
    this.sheetCreating.update((set) => new Set([...set, key]));
    this.sheetErrors.update((errors) => { const next = { ...errors }; delete next[key]; return next; });
    try {
      const created = await firstValueFrom(this.pricingApi.createOption({
        deviceCatalogModelId: model.id,
        repairNeedId: type.id,
        variantName: 'Standard',
        fixedPriceCents: Math.round(Number(raw) * 100),
        laborCents: type.defaultLaborCents,
        durationMins: type.defaultDurationMins,
        requiresProduct: false,
        isActive: false,
        isPublic: false,
        useDynamicPricing: false,
      }));
      this.options.update((rows) => rows.some((row) => row.id === created.id) ? rows : [...rows, created]);
      this.sheetDrafts.update((drafts) => { const next = { ...drafts }; delete next[key]; return next; });
      this.toast.success('Price saved as a private draft. Open Details to finish setup and activate.');
    } catch (error) {
      console.error('Could not create spreadsheet pricing draft', error);
      this.sheetErrors.update((errors) => ({ ...errors, [key]: 'Could not create repair. Check for an existing option and retry.' }));
      this.toast.error('Could not add repair price');
    } finally {
      this.sheetCreating.update((set) => { const next = new Set(set); next.delete(key); return next; });
    }
  }

  sheetAmount(option: PricingOption, field: 'laborCents' | 'fixedPriceCents'): string {
    const cents = option[field];
    return cents == null ? '' : (cents / 100).toFixed(2);
  }

  async saveSheetAmount(option: PricingOption, field: 'laborCents' | 'fixedPriceCents', raw: string): Promise<void> {
    const value = raw.trim();
    if (value && (!/^(?:\d+)(?:\.\d{1,2})?$/.test(value) || !Number.isFinite(Number(value)) || Number(value) > 1000000)) {
      this.sheetErrors.update((errors) => ({ ...errors, [option.id]: 'Enter a valid dollar amount.' }));
      return;
    }
    const cents = value === '' ? null : Math.round(Number(value) * 100);
    if (option[field] === cents && !(field === 'fixedPriceCents' && option.useDynamicPricing)) return;
    if (this.sheetSaving().has(option.id) || this.sheetBatchRunning() || this.bulkSaving()) return;
    this.sheetSaving.update((set) => new Set([...set, option.id]));
    this.sheetErrors.update((errors) => { const next = { ...errors }; delete next[option.id]; return next; });
    try {
      const payload: Partial<PricingOptionInput> = { [field]: cents };
      if (field === 'fixedPriceCents') payload.useDynamicPricing = false;
      const updated = await firstValueFrom(this.pricingApi.updateOption(option.id, payload));
      this.options.update((rows) => rows.map((row) => row.id === option.id ? { ...row, ...updated } : row));
    } catch (error) {
      console.error('Could not save worksheet cell', error);
      this.sheetErrors.update((errors) => ({ ...errors, [option.id]: 'Save failed. Try again.' }));
      this.toast.error('Could not save price');
    } finally {
      this.sheetSaving.update((set) => { const next = new Set(set); next.delete(option.id); return next; });
    }
  }

  async setSheetAutomatic(option: PricingOption): Promise<void> {
    if (this.sheetSaving().has(option.id) || option.useDynamicPricing) return;
    this.sheetSaving.update((set) => new Set([...set, option.id]));
    try {
      const updated = await firstValueFrom(this.pricingApi.updateOption(option.id, { useDynamicPricing: true }));
      this.options.update((rows) => rows.map((row) => row.id === option.id ? { ...row, ...updated } : row));
      this.sheetErrors.update((errors) => { const next = { ...errors }; delete next[option.id]; return next; });
    } catch (error) {
      console.error(error);
      this.sheetErrors.update((errors) => ({ ...errors, [option.id]: 'Automatic pricing could not be enabled.' }));
    } finally {
      this.sheetSaving.update((set) => { const next = new Set(set); next.delete(option.id); return next; });
    }
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
    if (view === 'list' || view === 'sheet') this.pricingSearch$.next(q);
    if (view === 'overview') await this.loadOverview();
    if (view === 'rules') await this.loadRules();
    if (view === 'suppliers') await this.loadSupplierHealth();
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
    return 'sheet';
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
