import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  ArrowLeft,
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  ExternalLink,
  RefreshCw,
  Edit3,
  Laptop,
  LoaderCircle,
  Mail,
  MessageSquareQuote,
  Phone,
  Plus,
  Share2,
  Copy,
  ReceiptText,
  ShieldCheck,
  Trash2,
  Wrench,
  X,
  LucideAngularModule,
} from 'lucide-angular';
import { firstValueFrom } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { BusinessAccountsService } from '../../../core/business-accounts/service';
import { BusinessPlansService } from '../../../core/business-plans/service';
import type {
  BusinessBillingOverview,
  BusinessEnrollmentBillingChangePolicy,
  BusinessEnrollmentPaymentSetupMethod,
  BusinessPlan,
} from '../../../core/business-plans/model';
import type {
  BusinessAccountContact,
  BusinessAccountDetail as BusinessAccountDetailModel,
  BusinessAccountDevice,
  BusinessAccountPatchInput,
  BusinessAccountStatus,
  BusinessBillingTerms,
  BusinessContactCreateInput,
  BusinessDeviceCreateInput,
  BusinessDeviceStatus,
  BusinessPlanStatus,
  BusinessLocation,
  BusinessOperationsOverview,
  BusinessOperationsPatchInput,
  BusinessStatement,
} from '../../../core/business-accounts/model';
import type { BusinessEnrollmentAdminState } from '../../../core/business-enrollment/model';
import { ToastService } from '../../../core/toast/toast-service';
import { TenantService } from '../../../core/tenant/tenant.service';
import {
  TechSpecsService,
  type ManagedDeviceCatalogBrand,
  type ManagedDeviceCatalogCategory,
  type ManagedDeviceCatalogModel,
} from '../../../core/techspecs/techspecs.service';

@Component({
  selector: 'app-business-account-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, LucideAngularModule],
  templateUrl: './business-account-detail.html',
  styleUrl: './business-account-detail.scss',
})
export class BusinessAccountDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(BusinessAccountsService);
  private readonly plansApi = inject(BusinessPlansService);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);
  private readonly tenant = inject(TenantService);
  private readonly deviceCatalog = inject(TechSpecsService);

  readonly backIcon = ArrowLeft;
  readonly editIcon = Edit3;
  readonly plusIcon = Plus;
  readonly wrenchIcon = Wrench;
  readonly deviceIcon = Laptop;
  readonly moneyIcon = CircleDollarSign;
  readonly cardIcon = CreditCard;
  readonly externalIcon = ExternalLink;
  readonly refreshIcon = RefreshCw;
  readonly shieldIcon = ShieldCheck;
  readonly receiptIcon = ReceiptText;
  readonly mailIcon = Mail;
  readonly quoteIcon = MessageSquareQuote;
  readonly phoneIcon = Phone;
  readonly shareIcon = Share2;
  readonly copyIcon = Copy;
  readonly closeIcon = X;
  readonly trashIcon = Trash2;
  readonly chevronIcon = ChevronRight;
  readonly loaderIcon = LoaderCircle;

  readonly account = signal<BusinessAccountDetailModel | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly editor = signal<'account' | 'contact' | 'device' | 'enrollment' | 'operations' | 'portal' | 'location' | 'credit' | 'statementPayment' | 'bulk' | null>(null);
  readonly billing = signal<BusinessBillingOverview | null>(null);
  readonly availablePlans = signal<BusinessPlan[]>([]);
  readonly plansError = signal<string | null>(null);
  readonly billingLoading = signal(false);
  readonly operations = signal<BusinessOperationsOverview | null>(null);
  readonly enrollmentState = signal<BusinessEnrollmentAdminState | null>(null);
  readonly enrollmentLoading = signal(false);
  readonly enrollmentCopied = signal(false);
  readonly operationsLoading = signal(false);
  readonly selectedDeviceIds = signal<string[]>([]);
  readonly catalogCategories = signal<ManagedDeviceCatalogCategory[]>([]);
  readonly catalogBrands = signal<ManagedDeviceCatalogBrand[]>([]);
  readonly catalogModels = signal<ManagedDeviceCatalogModel[]>([]);
  readonly loadingCatalog = signal(false);
  readonly loadingCatalogBrands = signal(false);
  readonly loadingCatalogModels = signal(false);

  selectedCatalogCategoryId = '';
  selectedCatalogBrandId = '';
  editingContactId: string | null = null;
  editingDeviceId: string | null = null;
  editingLocationId: string | null = null;
  editingStatementId: string | null = null;
  portalContactId = '';
  readonly portalCopied = signal(false);
  accountForm = this.blankAccountForm();
  contactForm = this.blankContactForm();
  deviceForm = this.blankDeviceForm();
  enrollmentForm = this.blankEnrollmentForm();
  operationsForm = this.blankOperationsForm();
  locationForm = this.blankLocationForm();
  creditForm = this.blankCreditForm();
  statementPaymentForm = this.blankStatementPaymentForm();
  bulkForm = this.blankBulkForm();

  get canWrite(): boolean { return this.auth.hasPermission('businessAccounts:write'); }

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      await this.router.navigate(['/business-accounts']);
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    try {
      this.account.set(await firstValueFrom(this.service.get(id)));
      await Promise.all([this.loadBilling(id), this.loadOperations(id), this.loadEnrollmentState(id)]);
    } catch (error) {
      console.error(error);
      this.error.set('This business account could not be loaded.');
    } finally {
      this.loading.set(false);
    }
  }

  async loadBilling(accountId?: string): Promise<void> {
    const id = accountId ?? this.account()?.id;
    if (!id) return;

    this.billingLoading.set(true);
    this.plansError.set(null);

    // Fleet plans and billing state are intentionally loaded independently.
    // A Stripe/billing problem must never make the plan picker look empty.
    const billingRequest = firstValueFrom(this.plansApi.billing(id))
      .then((billing) => this.billing.set(billing))
      .catch((error) => {
        console.error('Could not load fleet billing.', error);
        this.billing.set(null);
      });

    const plansRequest = firstValueFrom(this.plansApi.list())
      .then((plans) => {
        this.availablePlans.set((plans.data ?? []).filter((plan) => plan.isActive));
      })
      .catch((error) => {
        console.error('Could not load fleet plans.', error);
        this.availablePlans.set([]);
        this.plansError.set('Fleet plans could not be loaded. Refresh the page or try again in a moment.');
      });

    try {
      await Promise.all([billingRequest, plansRequest]);
    } finally {
      this.billingLoading.set(false);
    }
  }

  async loadEnrollmentState(accountId?: string): Promise<void> {
    const id = accountId ?? this.account()?.id;
    if (!id) return;
    this.enrollmentLoading.set(true);
    try {
      this.enrollmentState.set(await firstValueFrom(this.service.getEnrollment(id)));
    } catch (error) {
      console.error('Could not load fleet enrollment state.', error);
      this.enrollmentState.set(null);
    } finally {
      this.enrollmentLoading.set(false);
    }
  }

  enrollmentStageLabel(stage: string | null | undefined): string {
    switch (stage) {
      case 'sent': return 'Waiting on customer';
      case 'agreement_signed': return 'Agreement signed';
      case 'company_setup': return 'Company setup';
      case 'billing_setup': return 'Billing setup';
      case 'active': return 'Active';
      case 'canceled': return 'Canceled';
      default: return 'Draft';
    }
  }

  enrollmentEventLabel(action: string): string {
    const labels: Record<string, string> = {
      'business_enrollment.invite_sent': 'Enrollment sent',
      'business_enrollment.agreement_signed': 'Agreement signed',
      'business_enrollment.contact_confirmed': 'Company contact confirmed',
      'business_enrollment.fleet_confirmed': 'Fleet setup confirmed',
      'business_enrollment.activated': 'Account activated',
      'business_enrollment.portal_invite_sent': 'Portal invitation sent',
    };
    return labels[action] ?? action.replace(/^business_enrollment\./, '').replaceAll('_', ' ');
  }

  async copyEnrollmentLink(): Promise<void> {
    const url = this.enrollmentState()?.url;
    if (!url) { this.toast.error('Create a fleet enrollment first.'); return; }
    try {
      await navigator.clipboard.writeText(url);
      this.enrollmentCopied.set(true);
      this.toast.success('Enrollment link copied.');
      window.setTimeout(() => this.enrollmentCopied.set(false), 1800);
    } catch { this.toast.error('Could not copy the enrollment link.'); }
  }

  openEnrollmentLink(): void {
    const url = this.enrollmentState()?.url;
    if (!url) return;
    const opened = window.open(url, '_blank');
    if (opened) opened.opener = null;
  }

  openSignedAgreement(): void {
    const url = this.operations()?.settings?.contractDocumentUrl;
    if (!url) { this.toast.error('The signed agreement is not available yet.'); return; }
    const opened = window.open(url, '_blank');
    if (opened) opened.opener = null;
  }

  async sendEnrollmentInvite(): Promise<void> {
    const account = this.account();
    if (!account || this.saving()) return;
    this.saving.set(true);
    try {
      const result = await firstValueFrom(this.service.sendEnrollment(account.id));
      this.toast.success('Enrollment sent', `${result.sentTo.name} will receive the secure enrollment link at ${result.sentTo.email}.`);
      await this.loadEnrollmentState(account.id);
    } catch (error: any) {
      this.toast.error(error?.error?.message || 'Enrollment could not be sent.');
    } finally { this.saving.set(false); }
  }

  async loadOperations(accountId?: string): Promise<void> {
    const id = accountId ?? this.account()?.id;
    if (!id) return;
    this.operationsLoading.set(true);
    try {
      this.operations.set(await firstValueFrom(this.service.getOperations(id)));
    } catch (error) {
      console.error('Could not load business operations.', error);
      this.operations.set(null);
    } finally {
      this.operationsLoading.set(false);
    }
  }

  portalUrl(): string {
    const slug = this.tenant.getShopSlug();
    if (!slug || typeof window === 'undefined') return '';
    return new URL(`/portal/${encodeURIComponent(slug)}`, window.location.origin).toString();
  }

  portalShareContacts(): BusinessAccountContact[] {
    return [...(this.account()?.contacts ?? [])]
      .filter((contact) => Boolean(contact.email?.trim()))
      .sort((left, right) => Number(right.isBilling) - Number(left.isBilling) || Number(right.isPrimary) - Number(left.isPrimary) || left.name.localeCompare(right.name));
  }

  openPortalShare(): void {
    if (!this.operations()?.settings.portalEnabled) {
      this.toast.error('Enable the business customer portal before sharing access.');
      return;
    }
    const contacts = this.portalShareContacts();
    this.portalContactId = contacts[0]?.id ?? '';
    this.portalCopied.set(false);
    this.editor.set('portal');
  }

  async copyPortalLink(): Promise<void> {
    const url = this.portalUrl();
    if (!url) { this.toast.error('The shop portal URL is not available yet.'); return; }
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const input = document.createElement('textarea');
        input.value = url;
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        input.remove();
      }
      this.portalCopied.set(true);
      this.toast.success('Portal link copied.');
      window.setTimeout(() => this.portalCopied.set(false), 1800);
    } catch {
      this.toast.error('Could not copy the portal link.');
    }
  }

  openPortal(): void {
    const url = this.portalUrl();
    if (!url) { this.toast.error('The shop portal URL is not available yet.'); return; }
    const opened = window.open(url, '_blank');
    if (opened) opened.opener = null;
  }

  async sendPortalAccess(): Promise<void> {
    const account = this.account();
    if (!account || !this.portalContactId || this.saving()) return;
    this.saving.set(true);
    try {
      const response = await firstValueFrom(this.service.sharePortal(account.id, this.portalContactId));
      this.toast.success('Portal access sent', `${response.sentTo.name} will receive instructions at ${response.sentTo.email}.`);
      this.editor.set(null);
    } catch (error: any) {
      console.error(error);
      this.toast.error(error?.error?.message || 'Portal access could not be sent.');
    } finally {
      this.saving.set(false);
    }
  }

  openOperationsEditor(): void {
    const ops = this.operations();
    if (!ops || !this.canWrite) return;
    const s = ops.settings;
    this.operationsForm = {
      billingMode: s.billingMode,
      statementBillingDay: s.statementBillingDay,
      authorizationThreshold: this.centsToDollars(s.authorizationThresholdCents),
      purchaseOrderThreshold: this.centsToDollars(s.purchaseOrderThresholdCents),
      requireAuthorizedContact: s.requireAuthorizedContact,
      portalEnabled: s.portalEnabled,
      accountManagerUserId: s.accountManagerUserId ?? '',
      contractSignedAt: this.dateInput(s.contractSignedAt),
      contractStartsAt: this.dateInput(s.contractStartsAt),
      contractEndsAt: this.dateInput(s.contractEndsAt),
      contractAutoRenew: s.contractAutoRenew,
      cancellationNoticeDays: s.cancellationNoticeDays,
      contractDocumentUrl: s.contractDocumentUrl ?? '',
      slaResponseMinutes: s.slaResponseMinutes,
      slaTurnaroundHours: s.slaTurnaroundHours,
      priorityLevel: s.priorityLevel,
      preferredPartQuality: s.preferredPartQuality ?? '',
      dataWipeRequiresApproval: s.dataWipeRequiresApproval,
      maxRepairSpend: this.centsToDollars(s.maxRepairSpendCents),
      replaceInsteadThresholdPercent: s.replaceInsteadThresholdPercent,
    };
    this.editor.set('operations');
  }

  async saveOperations(): Promise<void> {
    const account = this.account(); if (!account) return;
    this.saving.set(true);
    try {
      const payload: BusinessOperationsPatchInput = {
        billingMode: this.operationsForm.billingMode,
        statementBillingDay: Math.max(1, Math.min(28, Math.trunc(Number(this.operationsForm.statementBillingDay) || 1))),
        authorizationThresholdCents: this.dollarsToCents(this.operationsForm.authorizationThreshold),
        purchaseOrderThresholdCents: this.dollarsToCents(this.operationsForm.purchaseOrderThreshold),
        requireAuthorizedContact: this.operationsForm.requireAuthorizedContact,
        portalEnabled: this.operationsForm.portalEnabled,
        accountManagerUserId: this.operationsForm.accountManagerUserId || null,
        contractSignedAt: this.toIsoDate(this.operationsForm.contractSignedAt),
        contractStartsAt: this.toIsoDate(this.operationsForm.contractStartsAt),
        contractEndsAt: this.toIsoDate(this.operationsForm.contractEndsAt),
        contractAutoRenew: this.operationsForm.contractAutoRenew,
        cancellationNoticeDays: this.nonNegativeIntOrNull(this.operationsForm.cancellationNoticeDays),
        contractDocumentUrl: this.clean(this.operationsForm.contractDocumentUrl),
        slaResponseMinutes: this.positiveIntOrNull(this.operationsForm.slaResponseMinutes),
        slaTurnaroundHours: this.positiveIntOrNull(this.operationsForm.slaTurnaroundHours),
        priorityLevel: Math.max(0, Math.min(10, Math.trunc(Number(this.operationsForm.priorityLevel) || 0))),
        preferredPartQuality: this.clean(this.operationsForm.preferredPartQuality),
        dataWipeRequiresApproval: this.operationsForm.dataWipeRequiresApproval,
        maxRepairSpendCents: this.dollarsToCents(this.operationsForm.maxRepairSpend),
        replaceInsteadThresholdPercent: this.positiveIntOrNull(this.operationsForm.replaceInsteadThresholdPercent),
      };
      await firstValueFrom(this.service.updateOperations(account.id, payload));
      this.editor.set(null); this.toast.success('Business service rules updated.'); await this.loadOperations(account.id);
    } catch (error: any) { this.toast.error(error?.error?.message || 'Could not update business service rules.'); }
    finally { this.saving.set(false); }
  }

  openLocationEditor(location?: BusinessLocation): void {
    if (!this.canWrite) return;
    this.editingLocationId = location?.id ?? null;
    this.locationForm = location ? {
      name: location.name, code: location.code ?? '', addressLine1: location.addressLine1 ?? '', addressLine2: location.addressLine2 ?? '', city: location.city ?? '', state: location.state ?? '', postalCode: location.postalCode ?? '', country: location.country ?? 'US', isDefault: location.isDefault, isBilling: location.isBilling, isActive: location.isActive, notes: location.notes ?? '',
    } : this.blankLocationForm();
    this.editor.set('location');
  }

  async saveLocation(): Promise<void> {
    const account = this.account(); if (!account || !this.locationForm.name.trim()) return;
    this.saving.set(true);
    const payload = { name: this.locationForm.name.trim(), code: this.clean(this.locationForm.code), addressLine1: this.clean(this.locationForm.addressLine1), addressLine2: this.clean(this.locationForm.addressLine2), city: this.clean(this.locationForm.city), state: this.clean(this.locationForm.state), postalCode: this.clean(this.locationForm.postalCode), country: this.clean(this.locationForm.country), isDefault: this.locationForm.isDefault, isBilling: this.locationForm.isBilling, isActive: this.locationForm.isActive, notes: this.clean(this.locationForm.notes) };
    try {
      if (this.editingLocationId) await firstValueFrom(this.service.updateLocation(account.id, this.editingLocationId, payload));
      else await firstValueFrom(this.service.addLocation(account.id, payload));
      this.editor.set(null); this.editingLocationId = null; this.toast.success('Business location saved.'); await this.loadOperations(account.id);
    } catch (error: any) { this.toast.error(error?.error?.message || 'Could not save this location.'); }
    finally { this.saving.set(false); }
  }

  openCreditEditor(): void { if (this.canWrite) { this.creditForm = this.blankCreditForm(); this.editor.set('credit'); } }
  async saveCredit(): Promise<void> {
    const account=this.account(); const cents=this.dollarsToCents(this.creditForm.amount); if(!account || !cents || cents<=0){this.toast.error('Enter a credit amount.');return;} this.saving.set(true);
    try { await firstValueFrom(this.service.addCredit(account.id,{amountCents:cents,note:this.clean(this.creditForm.note),reference:this.clean(this.creditForm.reference)})); this.editor.set(null); this.toast.success('Account credit added.'); await this.loadOperations(account.id); }
    catch(error:any){this.toast.error(error?.error?.message||'Could not add account credit.');} finally{this.saving.set(false);}
  }

  async prepareStatement(): Promise<void> { const account=this.account(); if(!account)return; this.saving.set(true); try{const st=await firstValueFrom(this.service.prepareStatement(account.id));this.toast.success(`${st.number || 'Statement'} prepared for review.`);await this.loadOperations(account.id);}catch(error:any){this.toast.error(error?.error?.message||'Could not prepare a statement.');}finally{this.saving.set(false);} }
  async finalizeStatement(statement: BusinessStatement): Promise<void> { const account=this.account(); if(!account||!window.confirm(`Finalize ${statement.number || 'this statement'}? This may create a Stripe invoice.`))return;this.saving.set(true);try{await firstValueFrom(this.service.finalizeStatement(account.id,statement.id));this.toast.success('Statement finalized.');await this.loadOperations(account.id);}catch(error:any){this.toast.error(error?.error?.message||'Could not finalize this statement.');}finally{this.saving.set(false);} }
  openStatementPayment(statement: BusinessStatement): void { if(!this.canWrite)return; this.editingStatementId=statement.id; this.statementPaymentForm={amount:statement.balanceCents/100,reference:'',note:''}; this.editor.set('statementPayment'); }
  async saveStatementPayment(): Promise<void> {
    const account=this.account(); const statementId=this.editingStatementId; const amountCents=this.dollarsToCents(this.statementPaymentForm.amount);
    if(!account||!statementId||!amountCents||amountCents<=0){this.toast.error('Enter a payment amount.');return;}
    this.saving.set(true);
    try { await firstValueFrom(this.service.recordStatementPayment(account.id,statementId,{amountCents,reference:this.clean(this.statementPaymentForm.reference),note:this.clean(this.statementPaymentForm.note)})); this.editor.set(null);this.editingStatementId=null;this.toast.success('Statement payment recorded.');await this.loadOperations(account.id); }
    catch(error:any){this.toast.error(error?.error?.message||'Could not record this statement payment.');} finally{this.saving.set(false);}
  }
  async voidStatement(statement: BusinessStatement): Promise<void> { const account=this.account();if(!account||!window.confirm(`Void ${statement.number || 'this statement'}?`))return;try{await firstValueFrom(this.service.voidStatement(account.id,statement.id));this.toast.success('Statement voided.');await this.loadOperations(account.id);}catch(error:any){this.toast.error(error?.error?.message||'Could not void this statement.');} }
  async useEntitlement(id:string): Promise<void> { const account=this.account();if(!account)return;try{await firstValueFrom(this.service.useEntitlement(account.id,id,{quantity:1}));this.toast.success('Plan benefit usage recorded.');await this.loadOperations(account.id);}catch(error:any){this.toast.error(error?.error?.message||'Could not record plan benefit usage.');} }

  toggleDeviceSelection(deviceId:string):void { const set=new Set(this.selectedDeviceIds()); set.has(deviceId)?set.delete(deviceId):set.add(deviceId); this.selectedDeviceIds.set([...set]); }
  deviceSelected(deviceId:string):boolean { return this.selectedDeviceIds().includes(deviceId); }
  clearDeviceSelection():void { this.selectedDeviceIds.set([]); }
  openBulkEditor():void { if(!this.canWrite||!this.selectedDeviceIds().length)return;this.bulkForm=this.blankBulkForm();this.editor.set('bulk'); }
  async saveBulkDevices(): Promise<void> {
    const account=this.account(); const ids=this.selectedDeviceIds(); if(!account||!ids.length)return;
    const patch: Record<string, unknown> = {};
    if(this.bulkForm.fleetStatus) patch['fleetStatus']=this.bulkForm.fleetStatus;
    if(this.bulkForm.coverageMode==='covered') patch['isPlanCovered']=true;
    if(this.bulkForm.coverageMode==='not_covered') patch['isPlanCovered']=false;
    if(this.bulkForm.departmentMode==='set') patch['department']=this.clean(this.bulkForm.department);
    if(this.bulkForm.locationMode==='set') patch['businessLocationId']=this.bulkForm.businessLocationId||null;
    if(this.bulkForm.replacementMode==='set') patch['replacementTargetDate']=this.toIsoDate(this.bulkForm.replacementTargetDate);
    if(!Object.keys(patch).length){this.toast.error('Choose at least one fleet change.');return;}
    this.saving.set(true); try{const result=await firstValueFrom(this.service.bulkUpdateDevices(account.id,ids,patch));this.toast.success(`${result.updated} devices updated.`);this.editor.set(null);this.clearDeviceSelection();await this.load();}catch(error:any){this.toast.error(error?.error?.message||'Could not update the selected devices.');}finally{this.saving.set(false);}
  }

  async onFleetCsvSelected(event: Event): Promise<void> {
    const input=event.target as HTMLInputElement; const file=input.files?.[0]; input.value=''; if(!file)return; const account=this.account(); if(!account)return;
    try {
      const text=await file.text(); const rows=this.parseCsv(text); if(!rows.length){this.toast.error('The CSV does not contain any device rows.');return;}
      const result=await firstValueFrom(this.service.importDevices(account.id,rows)); this.toast.success(`${result.created} fleet devices imported.`); await this.load();
    } catch(error:any){this.toast.error(error?.error?.message||error?.message||'Could not import fleet devices.');}
  }

  private parseCsv(text:string): Record<string, unknown>[] {
    const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/).filter((line)=>line.trim()); if(lines.length<2)return[];
    const parse=(line:string)=>{const out:string[]=[];let value='',quoted=false;for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){if(quoted&&line[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}else if(ch===','&&!quoted){out.push(value.trim());value='';}else value+=ch;}out.push(value.trim());return out;};
    const headers=parse(lines[0]).map((h)=>h.trim());
    return lines.slice(1).map((line)=>{const values=parse(line);const row:Record<string,unknown>={};headers.forEach((h,i)=>{let v:any=values[i]??'';if(h==='isPlanCovered'&&v!=='')v=['true','yes','1','covered'].includes(String(v).toLowerCase());row[h]=v||null;});return row;}).filter((row)=>Object.values(row).some((v)=>v!==null&&v!==''));
  }


  openEnrollmentEditor(): void {
    if (!this.canWrite) return;
    const billing = this.billing();
    this.enrollmentForm = this.blankEnrollmentForm();
    this.enrollmentForm.billingManagedByStripe = Boolean(billing?.stripeReady);
    const preferredContact = this.billingContactsWithEmail()[0] ?? null;
    this.enrollmentForm.paymentSetupContactId = preferredContact?.id ?? '';
    this.editor.set('enrollment');
  }

  selectedEnrollmentPlan(): BusinessPlan | null {
    return this.availablePlans().find((plan) => plan.id === this.enrollmentForm.planId) ?? null;
  }

  billingContactsWithEmail(): BusinessAccountContact[] {
    return [...(this.account()?.contacts ?? [])]
      .filter((contact) => Boolean(contact.email?.trim()))
      .sort((left, right) => Number(right.isBilling) - Number(left.isBilling) || Number(right.isPrimary) - Number(left.isPrimary) || left.name.localeCompare(right.name));
  }

  selectedPaymentSetupContact(): BusinessAccountContact | null {
    const id = this.enrollmentForm.paymentSetupContactId;
    return this.account()?.contacts?.find((contact) => contact.id === id) ?? null;
  }

  paymentSetupContactLabel(enrollment: NonNullable<BusinessBillingOverview['enrollment']>): string {
    if (enrollment.paymentSetupContactName && enrollment.paymentSetupContactEmail) return `${enrollment.paymentSetupContactName} · ${enrollment.paymentSetupContactEmail}`;
    const contact = this.account()?.contacts?.find((item) => item.id === enrollment.paymentSetupContactId);
    if (contact?.email) return `${contact.name} · ${contact.email}`;
    return 'billing contact';
  }

  async enrollInPlan(): Promise<void> {
    const account = this.account();
    if (!account || !this.enrollmentForm.planId) { this.toast.error('Choose a fleet plan.'); return; }
    if (this.enrollmentForm.billingManagedByStripe && !this.billing()?.stripeReady) {
      this.toast.error('Stripe must be connected and ready before enabling subscription billing.'); return;
    }
    if (this.enrollmentForm.billingManagedByStripe && this.enrollmentForm.paymentSetupMethod === 'email_checkout') {
      const contact = this.selectedPaymentSetupContact();
      if (!contact?.email) { this.toast.error('Choose a billing contact with an email address.'); return; }
    }
    this.saving.set(true);
    try {
      const response = await firstValueFrom(this.plansApi.enroll(account.id, {
        planId: this.enrollmentForm.planId,
        billingManagedByStripe: this.enrollmentForm.billingManagedByStripe,
        billingChangePolicy: this.enrollmentForm.billingChangePolicy,
        paymentSetupMethod: this.enrollmentForm.billingManagedByStripe ? this.enrollmentForm.paymentSetupMethod : undefined,
        paymentSetupContactId: this.enrollmentForm.billingManagedByStripe ? (this.enrollmentForm.paymentSetupContactId || null) : null,
        contractTermMonths: this.positiveIntOrNull(this.enrollmentForm.contractTermMonths),
      }));
      this.editor.set(null);
      if (!this.enrollmentForm.billingManagedByStripe) {
        this.toast.success('Fleet enrollment created', 'The customer can now review and sign the agreement before activation.');
      } else if (this.enrollmentForm.paymentSetupMethod === 'email_checkout') {
        const contact = this.selectedPaymentSetupContact();
        this.toast.success('Enrollment sent', contact?.email ? `${contact.name} will receive the agreement and billing setup at ${contact.email}.` : 'The customer enrollment link was sent.');
      } else {
        this.toast.success('Enrollment created', 'The agreement must be signed before Opscend Tech can complete Stripe M2 billing.');
      }
      await this.load();
    } catch (error: any) {
      console.error(error);
      this.toast.error(error?.error?.message || 'Could not enroll this business.');
      await this.loadBilling(account.id);
    } finally { this.saving.set(false); }
  }

  async resendPaymentSetupEmail(): Promise<void> {
    const account = this.account(); if (!account || this.saving()) return;
    this.saving.set(true);
    try {
      const enrollment = await firstValueFrom(this.plansApi.resendSetupEmail(account.id));
      this.toast.success('Payment setup resent', `A new secure Stripe setup email was sent to ${this.paymentSetupContactLabel(enrollment)}.`);
      await this.loadBilling(account.id);
    } catch (error: any) { this.toast.error(error?.error?.message || 'Payment setup email could not be resent.'); }
    finally { this.saving.set(false); }
  }

  async openBillingPortal(): Promise<void> {
    const account = this.account(); if (!account) return;
    try {
      const response = await firstValueFrom(this.plansApi.portal(account.id));
      window.location.assign(response.url);
    } catch (error: any) { this.toast.error(error?.error?.message || 'Stripe billing portal could not be opened.'); }
  }

  async applyPendingDeviceCount(): Promise<void> {
    const account = this.account(); if (!account) return;
    this.saving.set(true);
    try { await firstValueFrom(this.plansApi.applyDeviceCount(account.id)); this.toast.success('Fleet billing device count updated.'); await this.loadBilling(account.id); }
    catch (error: any) { this.toast.error(error?.error?.message || 'Device count could not be applied.'); }
    finally { this.saving.set(false); }
  }

  async cancelFleetPlan(): Promise<void> {
    const account = this.account(); if (!account) return;
    const enrollment = this.billing()?.enrollment; if (!enrollment) return;
    const message = enrollment.billingManagedByStripe ? 'Cancel this subscription at the end of the current billing period?' : 'Cancel this fleet plan?';
    if (!window.confirm(message)) return;
    try { await firstValueFrom(this.plansApi.cancel(account.id)); this.toast.success(enrollment.billingManagedByStripe ? 'Plan will cancel at period end.' : 'Fleet plan canceled.'); await this.load(); }
    catch (error: any) { this.toast.error(error?.error?.message || 'Fleet plan could not be canceled.'); }
  }

  async resumeFleetPlan(): Promise<void> {
    const account = this.account(); if (!account) return;
    try { await firstValueFrom(this.plansApi.resume(account.id)); this.toast.success('Fleet plan will continue.'); await this.load(); }
    catch (error: any) { this.toast.error(error?.error?.message || 'Fleet plan could not be resumed.'); }
  }

  openAccountEditor(): void {
    const account = this.account();
    if (!account) return;
    this.accountForm = {
      name: account.name,
      legalName: account.legalName ?? '',
      status: account.status,
      billingEmail: account.billingEmail ?? '',
      billingPhone: account.billingPhone ?? '',
      billingTerms: account.billingTerms,
      purchaseOrderRequired: account.purchaseOrderRequired,
      creditLimit: this.centsToDollars(account.creditLimitCents),
      taxExempt: account.taxExempt,
      taxExemptId: account.taxExemptId ?? '',
      planName: account.planName ?? '',
      planStatus: account.planStatus,
      planMonthlyFee: this.centsToDollars(account.planMonthlyFeeCents),
      planLabor: this.centsToDollars(account.planLaborCents),
      standardLabor: this.centsToDollars(account.standardLaborCents),
      coveredDeviceLimit: account.coveredDeviceLimit,
      partsDiscountPercent: account.partsDiscountBps / 100,
      serviceDiscountPercent: account.serviceDiscountBps / 100,
      planStartsAt: this.dateInput(account.planStartsAt),
      planEndsAt: this.dateInput(account.planEndsAt),
      notes: account.notes ?? '',
    };
    this.editor.set('account');
  }

  openContactEditor(contact?: BusinessAccountContact): void {
    this.editingContactId = contact?.id ?? null;
    this.contactForm = contact ? {
      name: contact.name,
      title: contact.title ?? '',
      email: contact.email ?? '',
      phone: contact.phone ?? '',
      isPrimary: contact.isPrimary,
      isBilling: contact.isBilling,
      canAuthorizeRepairs: contact.canAuthorizeRepairs,
      receivesUpdates: contact.receivesUpdates,
      notes: contact.notes ?? '',
    } : this.blankContactForm();
    this.editor.set('contact');
  }

  openDeviceEditor(device?: BusinessAccountDevice): void {
    this.editingDeviceId = device?.id ?? null;
    this.selectedCatalogCategoryId = '';
    this.selectedCatalogBrandId = '';
    this.catalogBrands.set([]);
    this.catalogModels.set([]);
    this.deviceForm = device ? {
      catalogRef: device.catalogRef ?? '',
      nickname: device.nickname ?? '',
      assetTag: device.assetTag ?? '',
      serial: device.serial ?? '',
      imei: device.imei ?? '',
      assignedToName: device.assignedToName ?? '',
      assignedToEmail: device.assignedToEmail ?? '',
      department: device.department ?? '',
      fleetStatus: device.fleetStatus,
      isPlanCovered: device.isPlanCovered,
      businessLocationId: device.businessLocationId ?? '',
      purchaseDate: this.dateInput(device.purchaseDate), warrantyExpiresAt: this.dateInput(device.warrantyExpiresAt), carrier: device.carrier ?? '', linePhone: device.linePhone ?? '', replacementTargetDate: this.dateInput(device.replacementTargetDate), retiredAt: this.dateInput(device.retiredAt), retirementReason: device.retirementReason ?? '',
      notes: device.notes ?? '',
    } : this.blankDeviceForm();
    this.editor.set('device');
    void this.prepareDeviceCatalog(device);
  }

  async onCatalogCategoryChange(): Promise<void> {
    this.selectedCatalogBrandId = '';
    this.deviceForm.catalogRef = '';
    this.catalogBrands.set([]);
    this.catalogModels.set([]);
    if (!this.selectedCatalogCategoryId) return;
    await this.loadCatalogBrands(this.selectedCatalogCategoryId);
  }

  async onCatalogBrandChange(): Promise<void> {
    this.deviceForm.catalogRef = '';
    this.catalogModels.set([]);
    if (!this.selectedCatalogBrandId) return;
    await this.loadCatalogModels(this.selectedCatalogBrandId);
  }

  selectedCatalogModel(): ManagedDeviceCatalogModel | null {
    const id = this.deviceForm.catalogRef;
    return this.catalogModels().find((row) => row.id === id) ?? null;
  }

  private async prepareDeviceCatalog(device?: BusinessAccountDevice): Promise<void> {
    this.loadingCatalog.set(true);
    try {
      const categories = await firstValueFrom(this.deviceCatalog.listManagedCategories(false));
      this.catalogCategories.set(categories.data ?? []);

      if (!device?.catalogRef) return;
      try {
        const model = await firstValueFrom(this.deviceCatalog.getManagedModel(device.catalogRef));
        this.selectedCatalogCategoryId = model.categoryId;
        this.selectedCatalogBrandId = model.brandId;
        await this.loadCatalogBrands(model.categoryId);
        await this.loadCatalogModels(model.brandId);
        this.deviceForm.catalogRef = model.id;
      } catch (error) {
        console.warn('Existing fleet device catalog link could not be loaded.', error);
      }
    } catch (error) {
      console.error(error);
      this.toast.error('The device library could not be loaded.');
    } finally {
      this.loadingCatalog.set(false);
    }
  }

  private async loadCatalogBrands(categoryId: string): Promise<void> {
    this.loadingCatalogBrands.set(true);
    try {
      const response = await firstValueFrom(this.deviceCatalog.listManagedBrands(categoryId, false));
      this.catalogBrands.set(response.data ?? []);
    } catch (error) {
      console.error(error);
      this.catalogBrands.set([]);
      this.toast.error('Device brands could not be loaded.');
    } finally {
      this.loadingCatalogBrands.set(false);
    }
  }

  private async loadCatalogModels(brandId: string): Promise<void> {
    this.loadingCatalogModels.set(true);
    try {
      const response = await firstValueFrom(this.deviceCatalog.listManagedModels(brandId, false));
      this.catalogModels.set(response.data ?? []);
    } catch (error) {
      console.error(error);
      this.catalogModels.set([]);
      this.toast.error('Device models could not be loaded.');
    } finally {
      this.loadingCatalogModels.set(false);
    }
  }

  closeEditor(): void {
    if (this.saving()) return;
    this.editor.set(null);
    this.editingContactId = null;
    this.editingDeviceId = null;
    this.editingLocationId = null;
    this.editingStatementId = null;
  }

  async saveAccount(): Promise<void> {
    const account = this.account();
    if (!account || !this.accountForm.name.trim()) return;
    this.saving.set(true);
    try {
      const payload: BusinessAccountPatchInput = {
        name: this.accountForm.name.trim(),
        legalName: this.clean(this.accountForm.legalName),
        status: this.accountForm.status,
        billingEmail: this.clean(this.accountForm.billingEmail),
        billingPhone: this.clean(this.accountForm.billingPhone),
        billingTerms: this.accountForm.billingTerms,
        purchaseOrderRequired: this.accountForm.purchaseOrderRequired,
        creditLimitCents: this.dollarsToCents(this.accountForm.creditLimit),
        taxExempt: this.accountForm.taxExempt,
        taxExemptId: this.clean(this.accountForm.taxExemptId),
        notes: this.clean(this.accountForm.notes),
      };
      this.account.set(await firstValueFrom(this.service.update(account.id, payload)));
      this.editor.set(null);
      this.toast.success('Business account updated.');
    } catch (error: any) {
      console.error(error);
      this.toast.error(error?.error?.message || 'Could not update this account.');
    } finally { this.saving.set(false); }
  }

  async saveContact(): Promise<void> {
    const account = this.account();
    if (!account || !this.contactForm.name.trim()) {
      this.toast.error('Contact name is required.');
      return;
    }
    this.saving.set(true);
    try {
      const payload: BusinessContactCreateInput = {
        name: this.contactForm.name.trim(), title: this.clean(this.contactForm.title),
        email: this.clean(this.contactForm.email), phone: this.clean(this.contactForm.phone),
        isPrimary: this.contactForm.isPrimary, isBilling: this.contactForm.isBilling,
        canAuthorizeRepairs: this.contactForm.canAuthorizeRepairs, receivesUpdates: this.contactForm.receivesUpdates,
        notes: this.clean(this.contactForm.notes),
      };
      if (this.editingContactId) await firstValueFrom(this.service.updateContact(account.id, this.editingContactId, payload));
      else await firstValueFrom(this.service.addContact(account.id, payload));
      this.editor.set(null);
      this.toast.success(this.editingContactId ? 'Contact updated.' : 'Contact added.');
      this.editingContactId = null;
      await this.load();
    } catch (error: any) {
      console.error(error); this.toast.error(error?.error?.message || 'Could not save this contact.');
    } finally { this.saving.set(false); }
  }

  async removeContact(contact: BusinessAccountContact): Promise<void> {
    const account = this.account(); if (!account) return;
    if (!window.confirm(`Remove ${contact.name} from this business account?`)) return;
    try {
      await firstValueFrom(this.service.deleteContact(account.id, contact.id));
      this.toast.success('Contact removed.'); await this.load();
    } catch (error: any) { this.toast.error(error?.error?.message || 'Could not remove this contact.'); }
  }

  async saveDevice(): Promise<void> {
    const account = this.account();
    if (!account || !this.deviceForm.catalogRef) {
      this.toast.error('Choose a device model from the device library.'); return;
    }
    this.saving.set(true);
    try {
      const payload: BusinessDeviceCreateInput = {
        catalogRef: this.deviceForm.catalogRef,
        nickname: this.clean(this.deviceForm.nickname),
        assetTag: this.clean(this.deviceForm.assetTag), serial: this.clean(this.deviceForm.serial),
        imei: this.clean(this.deviceForm.imei), assignedToName: this.clean(this.deviceForm.assignedToName),
        assignedToEmail: this.clean(this.deviceForm.assignedToEmail), department: this.clean(this.deviceForm.department),
        fleetStatus: this.deviceForm.fleetStatus, isPlanCovered: this.deviceForm.isPlanCovered,
        businessLocationId: this.deviceForm.businessLocationId || null, purchaseDate: this.toIsoDate(this.deviceForm.purchaseDate), warrantyExpiresAt: this.toIsoDate(this.deviceForm.warrantyExpiresAt), carrier: this.clean(this.deviceForm.carrier), linePhone: this.clean(this.deviceForm.linePhone), replacementTargetDate: this.toIsoDate(this.deviceForm.replacementTargetDate), retiredAt: this.toIsoDate(this.deviceForm.retiredAt), retirementReason: this.clean(this.deviceForm.retirementReason), notes: this.clean(this.deviceForm.notes),
      };
      if (this.editingDeviceId) await firstValueFrom(this.service.updateDevice(account.id, this.editingDeviceId, payload));
      else await firstValueFrom(this.service.addDevice(account.id, payload));
      this.editor.set(null); this.toast.success(this.editingDeviceId ? 'Device updated.' : 'Device added.');
      this.editingDeviceId = null; await this.load();
    } catch (error: any) { console.error(error); this.toast.error(error?.error?.message || 'Could not save this device.'); }
    finally { this.saving.set(false); }
  }

  async archiveDevice(device: BusinessAccountDevice): Promise<void> {
    const account = this.account(); if (!account) return;
    if (!window.confirm(`Archive ${this.deviceLabel(device)}? Its repair history will be preserved.`)) return;
    try { await firstValueFrom(this.service.archiveDevice(account.id, device.id)); this.toast.success('Device archived.'); await this.load(); }
    catch (error: any) { this.toast.error(error?.error?.message || 'Could not archive this device.'); }
  }

  startRepair(device?: BusinessAccountDevice): void {
    const account = this.account(); if (!account) return;
    void this.router.navigate(['/repairs/create'], { queryParams: { customerId: account.customerId, ...(device ? { deviceId: device.id } : {}) } });
  }

  money(cents: number | null | undefined): string { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((cents ?? 0) / 100); }
  percent(bps: number): string { return `${(bps / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}%`; }
  deviceLabel(device: BusinessAccountDevice): string { return device.nickname || device.displayName || [device.brand, device.model].filter(Boolean).join(' ') || 'Device'; }
  locationName(locationId: string | null | undefined): string { return this.operations()?.locations.find((location) => location.id === locationId)?.name ?? 'Company location'; }
  accountStatusLabel(status: BusinessAccountStatus): string { return status === 'active' ? 'Active' : status === 'paused' ? 'Paused' : 'Closed'; }
  planStatusLabel(status: BusinessPlanStatus): string { return status === 'none' ? 'No plan' : status.charAt(0).toUpperCase() + status.slice(1); }
  deviceStatusLabel(status: BusinessDeviceStatus): string { return status.charAt(0).toUpperCase() + status.slice(1); }
  billingTermsLabel(value: BusinessBillingTerms): string { return ({ due_on_receipt: 'Due on receipt', net_15: 'Net 15', net_30: 'Net 30', net_45: 'Net 45', net_60: 'Net 60' } as Record<BusinessBillingTerms,string>)[value]; }
  date(value: string | null | undefined): string { if (!value) return '—'; return new Intl.DateTimeFormat('en-US', { month:'short', day:'numeric', year:'numeric' }).format(new Date(value)); }
  dateTime(value: string | null | undefined): string { if (!value) return '—'; return new Intl.DateTimeFormat('en-US', { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' }).format(new Date(value)); }

  enrollmentStatusLabel(status: string | null | undefined): string {
    if (!status) return 'Not enrolled';
    return status.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
  }
  planRecurringLabel(plan: BusinessPlan): string {
    if (plan.pricingModel === 'flat') return `${this.money(plan.baseRecurringFeeCents)} recurring`;
    if (plan.pricingModel === 'flat_plus_device') return `${this.money(plan.baseRecurringFeeCents)} + ${this.money(plan.perDeviceFeeCents)}/device`;
    return `${this.money(plan.perDeviceFeeCents)}/device`;
  }
  invoiceStatusLabel(status: string | null): string { return status ? status.replace(/_/g, ' ') : 'Unknown'; }

  private blankAccountForm() { return { name:'', legalName:'', status:'active' as BusinessAccountStatus, billingEmail:'', billingPhone:'', billingTerms:'due_on_receipt' as BusinessBillingTerms, purchaseOrderRequired:false, creditLimit:null as number|null, taxExempt:false, taxExemptId:'', planName:'', planStatus:'active' as BusinessPlanStatus, planMonthlyFee:null as number|null, planLabor:null as number|null, standardLabor:null as number|null, coveredDeviceLimit:null as number|null, partsDiscountPercent:null as number|null, serviceDiscountPercent:null as number|null, planStartsAt:'', planEndsAt:'', notes:'' }; }
  private blankContactForm() { return { name:'', title:'', email:'', phone:'', isPrimary:false, isBilling:false, canAuthorizeRepairs:true, receivesUpdates:true, notes:'' }; }
  private blankDeviceForm() { return { catalogRef:'', nickname:'', assetTag:'', serial:'', imei:'', assignedToName:'', assignedToEmail:'', department:'', fleetStatus:'active' as BusinessDeviceStatus, isPlanCovered:true, businessLocationId:'', purchaseDate:'', warrantyExpiresAt:'', carrier:'', linePhone:'', replacementTargetDate:'', retiredAt:'', retirementReason:'', notes:'' }; }
  private blankEnrollmentForm() { return { planId:'', billingManagedByStripe:false, billingChangePolicy:'next_cycle' as BusinessEnrollmentBillingChangePolicy, paymentSetupMethod:'email_checkout' as BusinessEnrollmentPaymentSetupMethod, paymentSetupContactId:'', contractTermMonths:12 as number|null }; }
  private blankOperationsForm() { return { billingMode:'per_repair' as 'per_repair'|'consolidated', statementBillingDay:1, authorizationThreshold:null as number|null, purchaseOrderThreshold:null as number|null, requireAuthorizedContact:false, portalEnabled:true, accountManagerUserId:'', contractSignedAt:'', contractStartsAt:'', contractEndsAt:'', contractAutoRenew:false, cancellationNoticeDays:null as number|null, contractDocumentUrl:'', slaResponseMinutes:null as number|null, slaTurnaroundHours:null as number|null, priorityLevel:0, preferredPartQuality:'', dataWipeRequiresApproval:false, maxRepairSpend:null as number|null, replaceInsteadThresholdPercent:null as number|null }; }
  private blankLocationForm() { return { name:'', code:'', addressLine1:'', addressLine2:'', city:'', state:'', postalCode:'', country:'US', isDefault:false, isBilling:false, isActive:true, notes:'' }; }
  private blankCreditForm() { return { amount:null as number|null, note:'', reference:'' }; }
  private blankStatementPaymentForm() { return { amount:null as number|null, note:'', reference:'' }; }
  private blankBulkForm() { return { fleetStatus:'', coverageMode:'', departmentMode:'', department:'', locationMode:'', businessLocationId:'', replacementMode:'', replacementTargetDate:'' }; }
  private positiveIntOrNull(value: number|null): number|null { const n = Math.trunc(Number(value)); return Number.isFinite(n) && n > 0 ? n : null; }
  private nonNegativeIntOrNull(value: number|null): number|null { const n=Math.trunc(Number(value)); return Number.isFinite(n) && n >= 0 ? n : null; }
  private clean(value: string): string|null { return value.trim() || null; }
  private centsToDollars(value: number|null): number|null { return value === null ? null : value / 100; }
  private dollarsToCents(value: number|null): number|null { return value === null || value === undefined || !Number.isFinite(Number(value)) ? null : Math.round(Number(value)*100); }
  private numberOrNull(value: number|null): number|null { if (value === null || value === undefined || !Number.isFinite(Number(value))) return null; const next = Math.round(Number(value)); return next > 0 ? next : null; }
  private percentToBps(value: number|null): number { return value === null || value === undefined || !Number.isFinite(Number(value)) ? 0 : Math.max(0, Math.min(10000, Math.round(Number(value)*100))); }
  private dateInput(value: string|null): string { return value ? new Date(value).toISOString().slice(0,10) : ''; }
  private toIsoDate(value: string): string|null { return value ? new Date(`${value}T00:00:00.000Z`).toISOString() : null; }
}
