import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  Building2,
  ChevronRight,
  CircleDollarSign,
  Laptop,
  LoaderCircle,
  Plus,
  Search,
  ShieldCheck,
  UsersRound,
  X,
  LucideAngularModule,
} from 'lucide-angular';
import { firstValueFrom } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { BusinessAccountsService } from '../../core/business-accounts/service';
import type {
  BusinessAccountCreateInput,
  BusinessAccountStatus,
  BusinessAccountSummary,
  BusinessBillingTerms,
  BusinessPlanStatus,
} from '../../core/business-accounts/model';
import { ToastService } from '../../core/toast/toast-service';

@Component({
  selector: 'app-business-accounts',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, LucideAngularModule],
  templateUrl: './business-accounts.html',
  styleUrl: './business-accounts.scss',
})
export class BusinessAccounts implements OnInit {
  private readonly service = inject(BusinessAccountsService);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly buildingIcon = Building2;
  readonly plusIcon = Plus;
  readonly searchIcon = Search;
  readonly chevronIcon = ChevronRight;
  readonly usersIcon = UsersRound;
  readonly deviceIcon = Laptop;
  readonly moneyIcon = CircleDollarSign;
  readonly shieldIcon = ShieldCheck;
  readonly closeIcon = X;
  readonly loadingIcon = LoaderCircle;

  readonly accounts = signal<BusinessAccountSummary[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly createOpen = signal(false);
  readonly error = signal<string | null>(null);

  search = '';
  status: BusinessAccountStatus | '' = '';

  form = this.blankForm();

  get canWrite(): boolean {
    return this.auth.hasPermission('businessAccounts:write');
  }

  get activeAccounts(): number {
    return this.accounts().filter((account) => account.status === 'active').length;
  }

  get managedDevices(): number {
    return this.accounts().reduce((total, account) => total + account.stats.activeDevices, 0);
  }

  get openRepairs(): number {
    return this.accounts().reduce((total, account) => total + account.stats.openRepairs, 0);
  }

  get outstandingCents(): number {
    return this.accounts().reduce((total, account) => total + account.stats.outstandingBalanceCents, 0);
  }

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const response = await firstValueFrom(this.service.list({ search: this.search, status: this.status, limit: 100 }));
      this.accounts.set(response.data);
    } catch (error) {
      console.error(error);
      this.error.set('Business accounts could not be loaded.');
    } finally {
      this.loading.set(false);
    }
  }

  async applyFilters(): Promise<void> {
    await this.load();
  }

  clearFilters(): void {
    this.search = '';
    this.status = '';
    void this.load();
  }

  openCreate(): void {
    this.form = this.blankForm();
    this.createOpen.set(true);
  }

  closeCreate(): void {
    if (!this.saving()) this.createOpen.set(false);
  }

  async createAccount(): Promise<void> {
    if (!this.form.name.trim() || !this.form.contactName.trim()) {
      this.toast.error('Company name and a primary contact are required.');
      return;
    }

    this.saving.set(true);
    try {
      const payload: BusinessAccountCreateInput = {
        name: this.form.name.trim(),
        legalName: this.clean(this.form.legalName),
        billingEmail: this.clean(this.form.billingEmail),
        billingPhone: this.clean(this.form.billingPhone),
        billingTerms: this.form.billingTerms,
        purchaseOrderRequired: this.form.purchaseOrderRequired,
        taxExempt: this.form.taxExempt,
        taxExemptId: this.clean(this.form.taxExemptId),
        planName: this.clean(this.form.planName),
        planStatus: this.form.planName.trim() ? this.form.planStatus : 'none',
        planMonthlyFeeCents: this.dollarsToCents(this.form.planMonthlyFee),
        planLaborCents: this.dollarsToCents(this.form.planLabor),
        standardLaborCents: this.dollarsToCents(this.form.standardLabor),
        coveredDeviceLimit: this.numberOrNull(this.form.coveredDeviceLimit),
        partsDiscountBps: this.percentToBps(this.form.partsDiscountPercent),
        serviceDiscountBps: this.percentToBps(this.form.serviceDiscountPercent),
        notes: this.clean(this.form.notes),
        primaryContact: {
          name: this.form.contactName.trim(),
          title: this.clean(this.form.contactTitle),
          email: this.clean(this.form.contactEmail),
          phone: this.clean(this.form.contactPhone),
        },
      };

      const created = await firstValueFrom(this.service.create(payload));
      this.createOpen.set(false);
      this.toast.success(`${created.name} is ready to manage.`);
      await this.router.navigate(['/business-accounts', created.id]);
    } catch (error: any) {
      console.error(error);
      this.toast.error(error?.error?.message || 'Could not create this business account.');
    } finally {
      this.saving.set(false);
    }
  }

  money(cents: number | null | undefined): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((cents ?? 0) / 100);
  }

  statusLabel(status: BusinessAccountStatus): string {
    return status === 'active' ? 'Active' : status === 'paused' ? 'Paused' : 'Closed';
  }

  planLabel(account: BusinessAccountSummary): string {
    if (!account.planName || account.planStatus === 'none') return 'No service plan';
    return account.planName;
  }

  billingTermsLabel(value: BusinessBillingTerms): string {
    const labels: Record<BusinessBillingTerms, string> = {
      due_on_receipt: 'Due on receipt',
      net_15: 'Net 15',
      net_30: 'Net 30',
      net_45: 'Net 45',
      net_60: 'Net 60',
    };
    return labels[value];
  }

  private blankForm(): {
    name: string; legalName: string; billingEmail: string; billingPhone: string;
    billingTerms: BusinessBillingTerms; purchaseOrderRequired: boolean; taxExempt: boolean; taxExemptId: string;
    planName: string; planStatus: BusinessPlanStatus; planMonthlyFee: number | null; planLabor: number | null;
    standardLabor: number | null; coveredDeviceLimit: number | null; partsDiscountPercent: number | null;
    serviceDiscountPercent: number | null; notes: string; contactName: string; contactTitle: string;
    contactEmail: string; contactPhone: string;
  } {
    return {
      name: '', legalName: '', billingEmail: '', billingPhone: '', billingTerms: 'due_on_receipt',
      purchaseOrderRequired: false, taxExempt: false, taxExemptId: '', planName: '', planStatus: 'active',
      planMonthlyFee: null, planLabor: null, standardLabor: null, coveredDeviceLimit: null,
      partsDiscountPercent: null, serviceDiscountPercent: null, notes: '', contactName: '', contactTitle: '',
      contactEmail: '', contactPhone: '',
    };
  }

  private clean(value: string): string | null {
    return value.trim() || null;
  }
  private dollarsToCents(value: number | null): number | null {
    return value === null || value === undefined || !Number.isFinite(Number(value)) ? null : Math.round(Number(value) * 100);
  }
  private numberOrNull(value: number | null): number | null {
    return value === null || value === undefined || !Number.isFinite(Number(value)) ? null : Math.max(0, Math.round(Number(value)));
  }
  private percentToBps(value: number | null): number {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) return 0;
    return Math.max(0, Math.min(10000, Math.round(Number(value) * 100)));
  }
}
