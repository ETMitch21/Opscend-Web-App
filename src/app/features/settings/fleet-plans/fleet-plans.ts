import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  BadgeDollarSign,
  Check,
  Edit3,
  LoaderCircle,
  Plus,
  Smartphone,
  Users,
  X,
  LucideAngularModule,
} from 'lucide-angular';
import { firstValueFrom } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import type {
  BusinessPlan,
  BusinessPlanBillingInterval,
  BusinessPlanEntitlement,
  BusinessPlanInput,
  BusinessPlanPricingModel,
} from '../../../core/business-plans/model';
import { BusinessPlansService } from '../../../core/business-plans/service';
import { BusinessSettingsService } from '../../../core/business-settings/service';
import { ToastService } from '../../../core/toast/toast-service';
import { SettingsLayoutComponent } from '../settings-layout/settings-layout';

@Component({
  selector: 'app-fleet-plans',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, SettingsLayoutComponent],
  templateUrl: './fleet-plans.html',
  styleUrl: './fleet-plans.scss',
})
export class FleetPlansSettings implements OnInit {
  private readonly plansApi = inject(BusinessPlansService);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);
  private readonly businessSettings = inject(BusinessSettingsService);

  readonly icons = { BadgeDollarSign, Check, Edit3, LoaderCircle, Plus, Smartphone, Users, X };
  readonly plans = signal<BusinessPlan[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly editorOpen = signal(false);
  readonly fleetEnabled = signal(true);
  editingId: string | null = null;
  form = this.blankForm();

  get canWrite(): boolean { return this.auth.hasPermission('businessAccounts:write'); }

  async ngOnInit(): Promise<void> { await this.load(); }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const features = await firstValueFrom(this.businessSettings.getFeatures());
      this.fleetEnabled.set(features.settings.fleetManagementEnabled);
      if (!features.settings.fleetManagementEnabled) {
        this.plans.set([]);
        return;
      }
      const response = await firstValueFrom(this.plansApi.list());
      this.plans.set(response.data ?? []);
    } catch (error) {
      console.error(error);
      this.toast.error('Fleet plans could not be loaded.');
    } finally {
      this.loading.set(false);
    }
  }

  openEditor(plan?: BusinessPlan): void {
    if (!this.fleetEnabled()) return;
    this.editingId = plan?.id ?? null;
    this.form = plan ? {
      name: plan.name,
      description: plan.description ?? '',
      isActive: plan.isActive,
      pricingModel: plan.pricingModel,
      baseRecurringFee: this.toDollars(plan.baseRecurringFeeCents),
      perDeviceFee: this.toDollars(plan.perDeviceFeeCents),
      setupFee: this.toDollars(plan.setupFeeCents),
      minimumDeviceCount: plan.minimumDeviceCount,
      maximumDeviceCount: plan.maximumDeviceCount,
      planLabor: this.toNullableDollars(plan.planLaborCents),
      standardLabor: this.toNullableDollars(plan.standardLaborCents),
      partsDiscountPercent: plan.partsDiscountBps / 100,
      serviceDiscountPercent: plan.serviceDiscountBps / 100,
      benefitsText: (plan.benefits ?? []).join('\n'),
      entitlements: (plan.entitlements ?? []).map((e) => ({ ...e })),
      billingInterval: plan.billingInterval,
      billingIntervalCount: plan.billingIntervalCount,
      defaultContractTermMonths: plan.defaultContractTermMonths,
    } : this.blankForm();
    this.editorOpen.set(true);
  }

  closeEditor(): void {
    if (this.saving()) return;
    this.editorOpen.set(false);
    this.editingId = null;
  }

  async save(): Promise<void> {
    if (!this.form.name.trim()) { this.toast.error('Plan name is required.'); return; }
    if ((this.form.pricingModel === 'per_device' || this.form.pricingModel === 'flat_plus_device') && Number(this.form.perDeviceFee) <= 0) {
      this.toast.error('Enter a per-device price for this plan.'); return;
    }
    if ((this.form.pricingModel === 'flat' || this.form.pricingModel === 'flat_plus_device') && Number(this.form.baseRecurringFee) <= 0) {
      this.toast.error('Enter a recurring base price for this plan.'); return;
    }
    this.saving.set(true);
    try {
      const payload: BusinessPlanInput = {
        name: this.form.name.trim(),
        description: this.clean(this.form.description),
        isActive: this.form.isActive,
        pricingModel: this.form.pricingModel,
        baseRecurringFeeCents: this.toCents(this.form.baseRecurringFee),
        perDeviceFeeCents: this.toCents(this.form.perDeviceFee),
        setupFeeCents: this.toCents(this.form.setupFee),
        minimumDeviceCount: Math.max(0, Math.trunc(Number(this.form.minimumDeviceCount) || 0)),
        maximumDeviceCount: this.positiveIntOrNull(this.form.maximumDeviceCount),
        planLaborCents: this.nullableCents(this.form.planLabor),
        standardLaborCents: this.nullableCents(this.form.standardLabor),
        partsDiscountBps: this.percentToBps(this.form.partsDiscountPercent),
        serviceDiscountBps: this.percentToBps(this.form.serviceDiscountPercent),
        benefits: this.form.benefitsText.split('\n').map((row) => row.trim()).filter(Boolean),
        entitlements: this.form.entitlements.filter((e) => e.name.trim()).map((e, index) => ({ name: e.name.trim(), description: this.clean(e.description ?? ''), allowanceQuantity: this.positiveIntOrNull(e.allowanceQuantity ?? null), unitLabel: e.unitLabel.trim() || 'uses', resetPolicy: e.resetPolicy, sortOrder: index, isActive: e.isActive ?? true })),
        billingInterval: this.form.billingInterval,
        billingIntervalCount: Math.max(1, Math.trunc(Number(this.form.billingIntervalCount) || 1)),
        defaultContractTermMonths: this.positiveIntOrNull(this.form.defaultContractTermMonths),
      };
      if (this.editingId) await firstValueFrom(this.plansApi.update(this.editingId, payload));
      else await firstValueFrom(this.plansApi.create(payload));
      this.toast.success(this.editingId ? 'Fleet plan updated.' : 'Fleet plan created.');
      this.closeEditor();
      await this.load();
    } catch (error: any) {
      console.error(error);
      this.toast.error(error?.error?.message || 'Fleet plan could not be saved.');
    } finally {
      this.saving.set(false);
    }
  }

  async toggleActive(plan: BusinessPlan): Promise<void> {
    if (!this.canWrite) return;
    try {
      await firstValueFrom(this.plansApi.update(plan.id, { isActive: !plan.isActive }));
      this.toast.success(plan.isActive ? 'Plan deactivated.' : 'Plan activated.');
      await this.load();
    } catch (error: any) {
      this.toast.error(error?.error?.message || 'Plan status could not be changed.');
    }
  }

  addEntitlement(): void { this.form.entitlements.push({ name: '', description: '', allowanceQuantity: 1, unitLabel: 'uses', resetPolicy: 'billing_period', isActive: true }); }
  removeEntitlement(index: number): void { this.form.entitlements.splice(index, 1); }

  recurringLabel(plan: BusinessPlan): string {
    const interval = plan.billingIntervalCount === 1 ? plan.billingInterval : `${plan.billingIntervalCount} ${plan.billingInterval}s`;
    if (plan.pricingModel === 'flat') return `${this.money(plan.baseRecurringFeeCents)} / ${interval}`;
    if (plan.pricingModel === 'flat_plus_device') return `${this.money(plan.baseRecurringFeeCents)} + ${this.money(plan.perDeviceFeeCents)}/device / ${interval}`;
    return `${this.money(plan.perDeviceFeeCents)} / device / ${interval}`;
  }

  pricingModelLabel(value: BusinessPlanPricingModel): string {
    return value === 'per_device' ? 'Per device' : value === 'flat_plus_device' ? 'Base + per device' : 'Flat recurring';
  }
  money(cents: number): string { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100); }

  private blankForm(): {
    name: string; description: string; isActive: boolean; pricingModel: BusinessPlanPricingModel;
    baseRecurringFee: number; perDeviceFee: number; setupFee: number; minimumDeviceCount: number; maximumDeviceCount: number | null;
    planLabor: number | null; standardLabor: number | null; partsDiscountPercent: number; serviceDiscountPercent: number; benefitsText: string; entitlements: BusinessPlanEntitlement[];
    billingInterval: BusinessPlanBillingInterval; billingIntervalCount: number; defaultContractTermMonths: number | null;
  } {
    return { name: '', description: '', isActive: true, pricingModel: 'per_device', baseRecurringFee: 0, perDeviceFee: 0, setupFee: 0, minimumDeviceCount: 1, maximumDeviceCount: null, planLabor: null, standardLabor: null, partsDiscountPercent: 0, serviceDiscountPercent: 0, benefitsText: '', entitlements: [], billingInterval: 'month', billingIntervalCount: 1, defaultContractTermMonths: 12 };
  }
  private clean(value: string): string | null { return value.trim() || null; }
  private toDollars(cents: number): number { return cents / 100; }
  private toNullableDollars(cents: number | null): number | null { return cents === null ? null : cents / 100; }
  private toCents(value: number | null): number { return Math.max(0, Math.round((Number(value) || 0) * 100)); }
  private nullableCents(value: number | null): number | null { return value === null || value === undefined || value === ('' as any) ? null : this.toCents(value); }
  private positiveIntOrNull(value: number | null): number | null { const n = Math.trunc(Number(value)); return Number.isFinite(n) && n > 0 ? n : null; }
  private percentToBps(value: number): number { return Math.max(0, Math.min(10000, Math.round((Number(value) || 0) * 100))); }
}
