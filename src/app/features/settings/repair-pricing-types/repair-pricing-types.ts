import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  DollarSignIcon,
  GripVerticalIcon,
  LoaderCircleIcon,
  LucideAngularModule,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
  WrenchIcon,
  XIcon,
} from 'lucide-angular';
import { firstValueFrom } from 'rxjs';

import {
  PricingOptionDepositMode,
  RepairType,
  RepairTypeInput,
} from '../../../core/repair-pricing/model';
import { RepairPricingService } from '../../../core/repair-pricing/service';
import { ToastService } from '../../../core/toast/toast-service';
import { SettingsLayoutComponent } from '../settings-layout/settings-layout';

@Component({
  selector: 'app-repair-pricing-types',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    LucideAngularModule,
    SettingsLayoutComponent,
  ],
  templateUrl: './repair-pricing-types.html',
})
export class RepairPricingTypes implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly pricingApi = inject(RepairPricingService);
  private readonly toast = inject(ToastService);

  readonly icons = {
    Dollar: DollarSignIcon,
    Grip: GripVerticalIcon,
    Loader: LoaderCircleIcon,
    Plus: PlusIcon,
    Search: SearchIcon,
    Trash: Trash2Icon,
    Wrench: WrenchIcon,
    X: XIcon,
  };

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly repairTypes = signal<RepairType[]>([]);
  readonly search = signal('');
  readonly editorOpen = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly draggedId = signal<string | null>(null);

  readonly form = this.fb.group({
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
    depositMode: ['inherit' as PricingOptionDepositMode],
    depositAmountDollars: [null as number | null, Validators.min(0.01)],
    depositShippingDollars: [null as number | null, Validators.min(0)],
    depositIncludeProcessingFees: [true],
    depositIncludeInstantPayoutFee: [false],
    isActive: [true],
    requiresManualReview: [false],
  });

  readonly editingRepairType = computed(() =>
    this.repairTypes().find((type) => type.id === this.editingId()) ?? null,
  );

  readonly filteredTypes = computed(() => {
    const query = this.normalize(this.search());
    if (!query) return this.repairTypes();
    return this.repairTypes().filter((type) =>
      this.normalize(
        `${type.label} ${type.code} ${type.description ?? ''} ${type.supplierSearchTerms.join(' ')}`,
      ).includes(query),
    );
  });

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  openNew(): void {
    this.editingId.set(null);
    this.form.reset({
      label: '',
      code: '',
      description: '',
      supplierSearchTermsText: '',
      defaultLaborDollars: null,
      defaultDurationMins: 60,
      depositMode: 'inherit',
      depositAmountDollars: null,
      depositShippingDollars: null,
      depositIncludeProcessingFees: true,
      depositIncludeInstantPayoutFee: false,
      isActive: true,
      requiresManualReview: false,
    });
    this.editorOpen.set(true);
  }

  edit(type: RepairType): void {
    this.editingId.set(type.id);
    this.form.reset({
      label: type.label,
      code: type.code,
      description: type.description ?? '',
      supplierSearchTermsText: type.supplierSearchTerms.join(', '),
      defaultLaborDollars:
        type.defaultLaborCents == null ? null : type.defaultLaborCents / 100,
      defaultDurationMins: type.defaultDurationMins,
      depositMode: type.depositMode,
      depositAmountDollars:
        type.depositAmountCents == null ? null : type.depositAmountCents / 100,
      depositShippingDollars:
        type.depositShippingCents == null ? null : type.depositShippingCents / 100,
      depositIncludeProcessingFees:
        type.depositIncludeProcessingFees ?? true,
      depositIncludeInstantPayoutFee:
        type.depositIncludeInstantPayoutFee ?? false,
      isActive: type.isActive,
      requiresManualReview: type.requiresManualReview,
    });
    this.editorOpen.set(true);
  }

  closeEditor(): void {
    this.editorOpen.set(false);
    this.editingId.set(null);
  }

  onLabelInput(): void {
    if (this.editingId() || this.form.controls.code.dirty) return;
    this.form.controls.code.setValue(this.slugCode(this.form.controls.label.value ?? ''));
  }

  toggle(
    control:
      | 'isActive'
      | 'requiresManualReview'
      | 'depositIncludeProcessingFees'
      | 'depositIncludeInstantPayoutFee',
  ): void {
    this.form.controls[control].setValue(!this.form.controls[control].value);
    this.form.controls[control].markAsDirty();
  }

  async save(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) return;

    const raw = this.form.getRawValue();
    const depositMode = (raw.depositMode ?? 'inherit') as PricingOptionDepositMode;
    const depositAmountCents = this.dollarsToCents(raw.depositAmountDollars);

    if (depositMode === 'custom' && depositAmountCents == null) {
      this.toast.error('Deposit amount required');
      return;
    }

    const payload: RepairTypeInput = {
      label: String(raw.label ?? '').trim(),
      code: String(raw.code ?? '').trim(),
      description: this.nullable(raw.description),
      supplierSearchTerms: this.commaList(raw.supplierSearchTermsText),
      defaultLaborCents: this.dollarsToCents(raw.defaultLaborDollars),
      defaultDurationMins:
        raw.defaultDurationMins == null
          ? null
          : Math.max(5, Math.round(Number(raw.defaultDurationMins))),
      depositMode,
      depositAmountCents: depositMode === 'custom' ? depositAmountCents : null,
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
      isActive: Boolean(raw.isActive),
      requiresManualReview: Boolean(raw.requiresManualReview),
    };

    this.saving.set(true);
    try {
      const editingId = this.editingId();
      if (editingId) {
        await firstValueFrom(this.pricingApi.updateRepairType(editingId, payload));
        this.toast.success('Repair type saved');
      } else {
        await firstValueFrom(this.pricingApi.createRepairType(payload));
        this.toast.success('Repair type created');
      }
      this.closeEditor();
      await this.load();
    } catch (error: any) {
      console.error(error);
      const apiError = error?.error?.error;
      this.toast.error(
        apiError === 'repair_type_code_already_exists'
          ? 'Repair type code already exists'
          : 'Repair type was not saved',
      );
    } finally {
      this.saving.set(false);
    }
  }

  deactivate(type: RepairType): void {
    this.toast.confirm(
      `Deactivate ${type.label}?`,
      () => void this.confirmDeactivate(type),
      'Existing pricing remains available for reporting.',
      'Deactivate',
    );
  }

  onDragStart(event: DragEvent, type: RepairType): void {
    this.draggedId.set(type.id);
    event.dataTransfer?.setData('text/plain', type.id);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  async onDrop(event: DragEvent, target: RepairType): Promise<void> {
    event.preventDefault();
    const sourceId = this.draggedId() || event.dataTransfer?.getData('text/plain');
    this.draggedId.set(null);
    if (!sourceId || sourceId === target.id || this.search().trim()) return;

    const rows = [...this.repairTypes()];
    const sourceIndex = rows.findIndex((row) => row.id === sourceId);
    const targetIndex = rows.findIndex((row) => row.id === target.id);
    if (sourceIndex < 0 || targetIndex < 0) return;

    const [moved] = rows.splice(sourceIndex, 1);
    rows.splice(targetIndex, 0, moved);
    this.repairTypes.set(rows);

    try {
      await firstValueFrom(
        this.pricingApi.reorderRepairTypes(rows.map((row) => row.id)),
      );
    } catch (error) {
      console.error(error);
      this.toast.error('Repair type order was not saved');
      await this.load();
    }
  }

  depositLabel(type: RepairType): string {
    switch (type.depositMode) {
      case 'none':
        return 'No deposit';
      case 'product_cost':
        return 'Part cost';
      case 'cost_recovery':
        return 'Cost recovery';
      case 'custom':
        return type.depositAmountCents == null
          ? 'Fixed amount'
          : this.money(type.depositAmountCents);
      default:
        return 'Shop default';
    }
  }

  money(cents: number | null | undefined): string {
    if (cents == null) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
    }).format(cents / 100);
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const response = await firstValueFrom(this.pricingApi.listRepairTypes());
      this.repairTypes.set(
        [...(response.data ?? [])].sort(
          (a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label),
        ),
      );
    } catch (error) {
      console.error(error);
      this.error.set('Repair types could not be loaded.');
    } finally {
      this.loading.set(false);
    }
  }

  private async confirmDeactivate(type: RepairType): Promise<void> {
    try {
      await firstValueFrom(this.pricingApi.deactivateRepairType(type.id));
      this.toast.success('Repair type deactivated');
      this.closeEditor();
      await this.load();
    } catch (error) {
      console.error(error);
      this.toast.error('Repair type was not deactivated');
    }
  }

  private normalize(value: unknown): string {
    return String(value ?? '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ');
  }

  private slugCode(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  private commaList(value: string | null | undefined): string[] {
    return String(value ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
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
