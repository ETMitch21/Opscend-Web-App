import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  Building2,
  Check,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  FileSignature,
  FileText,
  Laptop,
  LoaderCircle,
  LockKeyhole,
  Mail,
  Plus,
  ShieldCheck,
  Smartphone,
  Trash2,
  Users,
  WalletCards,
  LucideAngularModule,
} from 'lucide-angular';

import { BusinessEnrollmentService } from '../../../core/business-enrollment/service';
import type { PublicBusinessEnrollment, PublicBusinessEnrollmentCatalogBrand, PublicBusinessEnrollmentCatalogCategory, PublicBusinessEnrollmentCatalogModel, PublicBusinessEnrollmentDeviceInput } from '../../../core/business-enrollment/model';

type Step = 'review' | 'agreement' | 'company' | 'fleet' | 'billing' | 'complete';
type EnrollmentDeviceRow = PublicBusinessEnrollmentDeviceInput & { categoryId: string; brandId: string };


@Component({
  selector: 'app-business-enrollment',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './business-enrollment.html',
  styleUrl: './business-enrollment.scss',
})
export class BusinessEnrollment implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(BusinessEnrollmentService);

  readonly icons = { Building2, Check, CheckCircle2, ChevronRight, CreditCard, FileSignature, FileText, Laptop, LoaderCircle, LockKeyhole, Mail, Plus, ShieldCheck, Smartphone, Trash2, Users, WalletCards };
  readonly token = signal('');
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly data = signal<PublicBusinessEnrollment | null>(null);
  readonly step = signal<Step>('review');

  signerName = '';
  signerTitle = '';
  signerEmail = '';
  signature = '';
  accepted = false;

  contactName = '';
  contactTitle = '';
  contactEmail = '';
  contactPhone = '';
  billingEmail = '';
  billingPhone = '';

  expectedDeviceCount = 0;
  addDevicesLater = false;
  fleetNotes = '';
  deviceRows: EnrollmentDeviceRow[] = [];
  readonly catalogCategories = signal<PublicBusinessEnrollmentCatalogCategory[]>([]);
  readonly catalogBrandsByCategory = signal<Record<string, PublicBusinessEnrollmentCatalogBrand[]>>({});
  readonly catalogModelsByBrand = signal<Record<string, PublicBusinessEnrollmentCatalogModel[]>>({});
  readonly catalogLoading = signal(false);

  readonly brandColor = computed(() => {
    const value = this.data()?.shop.primaryColor?.trim();
    return value && /^#[0-9a-f]{6}$/i.test(value) ? value : '#f58549';
  });

  readonly steps = computed(() => {
    const d = this.data();
    return [
      { key: 'review' as Step, label: 'Plan', done: Boolean(d) },
      { key: 'agreement' as Step, label: 'Agreement', done: Boolean(d?.state.agreementSigned) },
      { key: 'company' as Step, label: 'Company', done: Boolean(d?.state.contactConfirmed) },
      { key: 'fleet' as Step, label: 'Fleet', done: Boolean(d?.state.fleetConfirmed) },
      { key: 'billing' as Step, label: 'Billing', done: Boolean(!d?.enrollment.billingManagedByStripe || d?.enrollment.paymentSetupStatus === 'completed') },
      { key: 'complete' as Step, label: 'Ready', done: d?.state.stage === 'active' },
    ];
  });

  async ngOnInit(): Promise<void> {
    const token = this.route.snapshot.paramMap.get('token')?.trim() ?? '';
    this.token.set(token);
    if (!token) {
      this.error.set('This enrollment link is incomplete.');
      this.loading.set(false);
      return;
    }
    await this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const data = await firstValueFrom(this.api.get(this.token()));
      this.apply(data);
      const billingReturn = this.route.snapshot.queryParamMap.get('billing');
      if (billingReturn === 'success') this.step.set('complete');
    } catch (error: any) {
      this.error.set(error?.error?.message || 'This fleet enrollment could not be opened.');
    } finally {
      this.loading.set(false);
    }
  }

  private apply(data: PublicBusinessEnrollment): void {
    this.data.set(data);
    const contact = data.state.confirmedContact as any;
    const signer = data.state.signer;
    this.signerName = signer?.name || this.signerName || '';
    this.signerTitle = signer?.title || this.signerTitle || '';
    this.signerEmail = signer?.email || this.signerEmail || data.account.billingEmail || '';
    this.signature = signer?.signature || this.signature || '';
    this.accepted = data.state.agreementSigned || this.accepted;

    this.contactName = String(contact?.name || this.contactName || signer?.name || '');
    this.contactTitle = String(contact?.title || this.contactTitle || signer?.title || '');
    this.contactEmail = String(contact?.email || this.contactEmail || signer?.email || data.account.billingEmail || '');
    this.contactPhone = String(contact?.phone || this.contactPhone || data.account.billingPhone || '');
    this.billingEmail = String(contact?.billingEmail || this.billingEmail || data.account.billingEmail || this.contactEmail || '');
    this.billingPhone = String(contact?.billingPhone || this.billingPhone || data.account.billingPhone || this.contactPhone || '');

    const fleet = data.state.confirmedFleet as any;
    this.expectedDeviceCount = Number(fleet?.expectedDeviceCount ?? data.enrollment.coveredDeviceCount ?? data.enrollment.billableDeviceCount ?? 0);
    this.addDevicesLater = Boolean(fleet?.addDevicesLater ?? (this.expectedDeviceCount === 0));
    this.fleetNotes = String(fleet?.notes || '');
    if (Array.isArray(fleet?.devices)) {
      this.deviceRows = fleet.devices.map((row: any) => this.normalizeDeviceRow(row));
    } else if (!this.addDevicesLater && !data.state.fleetConfirmed) {
      this.resizeDeviceRows(Math.max(1, this.expectedDeviceCount || 1));
    }

    if (data.state.stage === 'active') this.step.set('complete');
    else if (!data.state.agreementSigned) this.step.set('review');
    else if (!data.state.contactConfirmed) this.step.set('company');
    else if (!data.state.fleetConfirmed) this.step.set('fleet');
    else if (data.enrollment.billingManagedByStripe && data.enrollment.paymentSetupStatus !== 'completed') this.step.set('billing');
    else this.step.set('complete');

    if (!this.addDevicesLater && !data.state.fleetConfirmed) void this.ensureCatalogCategories();
  }

  setStep(step: Step): void {
    if (!this.canOpen(step)) return;
    this.step.set(step);
    if (step === 'fleet' && !this.addDevicesLater && !this.data()?.state.fleetConfirmed) void this.ensureCatalogCategories();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  canOpen(step: Step): boolean {
    const d = this.data();
    if (!d) return false;
    if (step === 'review' || step === 'agreement') return true;
    if (step === 'company') return d.state.agreementSigned;
    if (step === 'fleet') return d.state.agreementSigned && d.state.contactConfirmed;
    if (step === 'billing') return d.state.agreementSigned && d.state.contactConfirmed && d.state.fleetConfirmed;
    return d.state.agreementSigned && d.state.contactConfirmed && d.state.fleetConfirmed;
  }

  nextFromReview(): void { this.setStep(this.data()?.state.agreementSigned ? 'company' : 'agreement'); }

  async signAgreement(): Promise<void> {
    if (this.saving()) return;
    if (!this.signerName.trim() || !this.signerTitle.trim() || !this.signerEmail.trim() || !this.signature.trim() || !this.accepted) {
      this.error.set('Complete the signer information, signature, and agreement confirmation.');
      return;
    }
    this.saving.set(true); this.error.set(null);
    try {
      const data = await firstValueFrom(this.api.sign(this.token(), {
        signerName: this.signerName.trim(), signerTitle: this.signerTitle.trim(), signerEmail: this.signerEmail.trim(), signature: this.signature.trim(), accepted: true,
      }));
      this.apply(data); this.step.set('company');
    } catch (error: any) { this.error.set(error?.error?.message || 'The agreement could not be signed.'); }
    finally { this.saving.set(false); }
  }

  async saveCompany(): Promise<void> {
    if (this.saving()) return;
    if (!this.contactName.trim() || !this.contactEmail.trim()) { this.error.set('Enter the authorized contact name and email.'); return; }
    this.saving.set(true); this.error.set(null);
    try {
      const data = await firstValueFrom(this.api.confirmContact(this.token(), {
        name: this.contactName.trim(), title: this.clean(this.contactTitle), email: this.contactEmail.trim(), phone: this.clean(this.contactPhone), billingEmail: this.clean(this.billingEmail), billingPhone: this.clean(this.billingPhone),
      }));
      this.apply(data); this.step.set('fleet');
    } catch (error: any) { this.error.set(error?.error?.message || 'Company details could not be saved.'); }
    finally { this.saving.set(false); }
  }

  onAddDevicesLaterChange(value: boolean): void {
    this.addDevicesLater = value;
    if (!value) {
      const count = Math.max(1, Math.trunc(Number(this.expectedDeviceCount) || 0));
      this.expectedDeviceCount = count;
      this.resizeDeviceRows(count);
      void this.ensureCatalogCategories();
    }
  }

  onExpectedDeviceCountChange(value: unknown): void {
    const count = Math.max(0, Math.trunc(Number(value) || 0));
    this.expectedDeviceCount = count;
    if (!this.addDevicesLater) this.resizeDeviceRows(Math.max(1, count || 1));
  }

  addDeviceRow(): void {
    if (this.data()?.state.fleetConfirmed) return;
    this.deviceRows = [...this.deviceRows, this.blankDeviceRow()];
    this.expectedDeviceCount = this.deviceRows.length;
    void this.ensureCatalogCategories();
  }

  removeDeviceRow(index: number): void {
    if (this.data()?.state.fleetConfirmed || this.deviceRows.length <= 1) return;
    this.deviceRows = this.deviceRows.filter((_, rowIndex) => rowIndex !== index);
    this.expectedDeviceCount = this.deviceRows.length;
  }

  private resizeDeviceRows(count: number): void {
    const target = Math.min(500, Math.max(1, count));
    const next = this.deviceRows.slice(0, target);
    while (next.length < target) next.push(this.blankDeviceRow());
    this.deviceRows = next;
  }

  private blankDeviceRow(): EnrollmentDeviceRow {
    return { catalogRef: '', categoryId: '', brandId: '', displayName: '', assignedToName: null, assignedToEmail: null, department: null, assetTag: null, serial: null, imei: null };
  }

  private normalizeDeviceRow(row: any): EnrollmentDeviceRow {
    return {
      catalogRef: String(row?.catalogRef || ''),
      categoryId: String(row?.categoryId || ''),
      brandId: String(row?.brandId || ''),
      displayName: String(row?.displayName || [row?.brand, row?.model].filter(Boolean).join(' ') || ''),
      category: this.clean(String(row?.category || '')),
      brand: this.clean(String(row?.brand || '')),
      model: this.clean(String(row?.model || '')),
      assignedToName: this.clean(String(row?.assignedToName || '')),
      assignedToEmail: this.clean(String(row?.assignedToEmail || '')),
      department: this.clean(String(row?.department || '')),
      assetTag: this.clean(String(row?.assetTag || '')),
      serial: this.clean(String(row?.serial || '')),
      imei: this.clean(String(row?.imei || '')),
    };
  }

  brandsFor(row: EnrollmentDeviceRow): PublicBusinessEnrollmentCatalogBrand[] {
    return row.categoryId ? (this.catalogBrandsByCategory()[row.categoryId] ?? []) : [];
  }

  modelsFor(row: EnrollmentDeviceRow): PublicBusinessEnrollmentCatalogModel[] {
    return row.brandId ? (this.catalogModelsByBrand()[row.brandId] ?? []) : [];
  }

  private async ensureCatalogCategories(): Promise<void> {
    if (this.catalogCategories().length || this.catalogLoading()) return;
    this.catalogLoading.set(true);
    try {
      const response = await firstValueFrom(this.api.listDeviceCatalogCategories(this.token()));
      this.catalogCategories.set(response.data);
    } catch (error: any) {
      this.error.set(error?.error?.message || 'The shop device catalog could not be loaded.');
    } finally {
      this.catalogLoading.set(false);
    }
  }

  async onEnrollmentDeviceCategoryChange(row: EnrollmentDeviceRow, categoryId: string): Promise<void> {
    row.categoryId = categoryId;
    row.brandId = '';
    row.catalogRef = '';
    row.displayName = '';
    if (!categoryId || this.catalogBrandsByCategory()[categoryId]) return;
    this.catalogLoading.set(true);
    try {
      const response = await firstValueFrom(this.api.listDeviceCatalogBrands(this.token(), categoryId));
      this.catalogBrandsByCategory.set({ ...this.catalogBrandsByCategory(), [categoryId]: response.data });
    } catch (error: any) {
      this.error.set(error?.error?.message || 'Device brands could not be loaded.');
    } finally {
      this.catalogLoading.set(false);
    }
  }

  async onEnrollmentDeviceBrandChange(row: EnrollmentDeviceRow, brandId: string): Promise<void> {
    row.brandId = brandId;
    row.catalogRef = '';
    row.displayName = '';
    if (!brandId || this.catalogModelsByBrand()[brandId]) return;
    this.catalogLoading.set(true);
    try {
      const response = await firstValueFrom(this.api.listDeviceCatalogModels(this.token(), brandId));
      this.catalogModelsByBrand.set({ ...this.catalogModelsByBrand(), [brandId]: response.data });
    } catch (error: any) {
      this.error.set(error?.error?.message || 'Device models could not be loaded.');
    } finally {
      this.catalogLoading.set(false);
    }
  }

  onEnrollmentDeviceModelChange(row: EnrollmentDeviceRow, catalogRef: string): void {
    row.catalogRef = catalogRef;
    const model = this.modelsFor(row).find((item) => item.id === catalogRef);
    row.displayName = model ? `${model.brandName} ${model.name}`.trim() : '';
    row.category = model?.categoryName ?? null;
    row.brand = model?.brandName ?? null;
    row.model = model?.name ?? null;
  }

  async saveFleet(): Promise<void> {
    if (this.saving()) return;
    let count = Math.max(0, Math.trunc(Number(this.expectedDeviceCount) || 0));
    if (!this.addDevicesLater) {
      const invalid = this.deviceRows.findIndex((row) => !String(row.catalogRef || '').trim());
      if (invalid >= 0) { this.error.set(`Choose the category, brand, and model for device ${invalid + 1}.`); return; }
      count = this.deviceRows.length;
      this.expectedDeviceCount = count;
    }
    if (!this.addDevicesLater && count < 1) { this.error.set('Add at least one device, or choose to add devices later.'); return; }
    this.saving.set(true); this.error.set(null);
    try {
      const devices = this.addDevicesLater ? [] : this.deviceRows.map((row) => ({
        catalogRef: String(row.catalogRef || '').trim(),
        assignedToName: this.clean(String(row.assignedToName || '')),
        assignedToEmail: this.clean(String(row.assignedToEmail || '')),
        department: this.clean(String(row.department || '')),
        assetTag: this.clean(String(row.assetTag || '')),
        serial: this.clean(String(row.serial || '')),
        imei: this.clean(String(row.imei || '')),
      }));
      const data = await firstValueFrom(this.api.confirmFleet(this.token(), { expectedDeviceCount: count, addDevicesLater: this.addDevicesLater, notes: this.clean(this.fleetNotes), devices }));
      this.apply(data);
      this.step.set(data.enrollment.billingManagedByStripe && data.enrollment.paymentSetupStatus !== 'completed' ? 'billing' : 'complete');
    } catch (error: any) { this.error.set(error?.error?.message || 'Fleet details could not be saved.'); }
    finally { this.saving.set(false); }
  }

  async finishWithoutStripe(): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true); this.error.set(null);
    try {
      const data = await firstValueFrom(this.api.complete(this.token()));
      this.apply(data); this.step.set('complete');
    } catch (error: any) { this.error.set(error?.error?.message || 'Enrollment could not be activated.'); }
    finally { this.saving.set(false); }
  }

  continueToBilling(): void {
    const url = this.data()?.enrollment.stripeCheckoutUrl;
    if (!url) { this.error.set('Secure billing setup is not ready yet. Contact the shop for help.'); return; }
    window.location.assign(url);
  }

  openAgreement(): void {
    const url = this.api.agreementUrl(this.token());
    window.open(url, '_blank', 'noopener');
  }

  openPortal(): void {
    const url = this.data()?.portalUrl || this.data()?.links.portal;
    if (url) window.location.assign(url);
  }

  money(cents: number): string {
    const currency = this.data()?.enrollment.currency || 'usd';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format((cents || 0) / 100);
  }

  date(value: string | null): string {
    if (!value) return '—';
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
  }

  percent(bps: number): string { return `${Math.round((bps || 0) / 100)}%`; }
  private clean(value: string): string | null { const next = value.trim(); return next || null; }
}
