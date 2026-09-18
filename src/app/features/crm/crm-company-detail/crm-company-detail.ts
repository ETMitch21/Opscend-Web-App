import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  ArrowLeft,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  Check,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  Mail,
  MessageSquareText,
  Phone,
  Plus,
  Save,
  Target,
  UserRound,
  UsersRound,
  Video,
  X,
  LoaderCircle,
  LayoutDashboard,
  History,
  LucideAngularModule,
} from 'lucide-angular';
import { firstValueFrom } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { BusinessSettingsService } from '../../../core/business-settings/service';
import type {
  CrmActivity,
  CrmActivityType,
  CrmCompanyDetail,
  CrmOpportunity,
  CrmOpportunityStage,
  CrmOwner, CrmPipelineStage, CrmAttachment, CrmProposal,
} from '../../../core/crm/model';
import { CrmService } from '../../../core/crm/service';
import { ToastService } from '../../../core/toast/toast-service';

@Component({
  selector: 'app-crm-company-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './crm-company-detail.html',
  styleUrl: './crm-company-detail.scss',
})
export class CrmCompanyDetailComponent implements OnInit {
  private readonly crm = inject(CrmService);
  private readonly auth = inject(AuthService);
  private readonly businessSettings = inject(BusinessSettingsService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly backIcon = ArrowLeft;
  readonly crmIcon = BriefcaseBusiness;
  readonly buildingIcon = Building2;
  readonly targetIcon = Target;
  readonly moneyIcon = CircleDollarSign;
  readonly usersIcon = UsersRound;
  readonly userIcon = UserRound;
  readonly followIcon = CalendarClock;
  readonly noteIcon = MessageSquareText;
  readonly phoneIcon = Phone;
  readonly emailIcon = Mail;
  readonly meetingIcon = Video;
  readonly taskIcon = ClipboardCheck;
  readonly plusIcon = Plus;
  readonly saveIcon = Save;
  readonly checkIcon = Check;
  readonly chevronIcon = ChevronRight;
  readonly closeIcon = X;
  readonly loadingIcon = LoaderCircle;
  readonly overviewIcon = LayoutDashboard;
  readonly historyIcon = History;

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly converting = signal(false);
  readonly businessAccountsEnabled = signal(false);
  readonly company = signal<CrmCompanyDetail | null>(null);
  readonly owners = signal<CrmOwner[]>([]);
  readonly opportunityOpen = signal(false);
  readonly contactOpen = signal(false);
  readonly activityOpen = signal(false);
  readonly activityEditOpen = signal(false);
  readonly editingActivity = signal<CrmActivity | null>(null);
  readonly closeOpen = signal(false);
  readonly closingOpportunity = signal<CrmOpportunity | null>(null);
  readonly closeStage = signal<'won' | 'lost'>('won');
  readonly section = signal<'overview' | 'opportunities' | 'contacts' | 'activity' | 'sales' | 'business'>('overview');
  readonly pipelineStages = signal<CrmPipelineStage[]>([]);
  readonly attachments = signal<CrmAttachment[]>([]);
  readonly proposals = signal<CrmProposal[]>([]);
  proposalForm = { title:'', opportunityId:'', validUntil:'', intro:'', terms:'', lines:[{description:'',quantity:1,unitAmount:0,billingType:'one_time' as 'one_time'|'monthly'}] };
  calculatorForm = { devices:10, monthlyPerDevice:59, setupFee:99, expectedRepairsPerYear:12, averageRepairRevenue:85, averageRepairCost:35 };

  get stages(): { key: CrmOpportunityStage; label: string }[] {
    const rows=this.pipelineStages().filter((s)=>s.isActive).sort((a,b)=>a.position-b.position);
    return rows.length ? rows.map((s)=>({key:s.key,label:s.label})) : [
      {key:'lead',label:'Lead'},{key:'contacted',label:'Contacted'},{key:'qualified',label:'Qualified'},
      {key:'proposal',label:'Proposal'},{key:'negotiation',label:'Closing'},{key:'won',label:'Won'},{key:'lost',label:'Lost'}
    ];
  }


  readonly wonReasons = [
    ['relationship', 'Relationship / trust'], ['service_fit', 'Service capability / fit'],
    ['speed', 'Speed / availability'], ['price', 'Price / value'],
    ['referral', 'Referral / recommendation'], ['competitor_switch', 'Switched from competitor'], ['other', 'Other'],
  ] as const;
  readonly lostReasons = [
    ['price', 'Price'], ['competitor', 'Went with competitor'], ['timing', 'Timing / not ready'],
    ['budget', 'Budget unavailable'], ['no_response', 'No response'], ['not_interested', 'Not interested'],
    ['project_cancelled', 'Project cancelled'], ['poor_fit', 'Not a fit'], ['other', 'Other'],
  ] as const;

  detailForm = this.blankDetailForm();
  opportunityForm = this.blankOpportunityForm();
  contactForm = this.blankContactForm();
  activityForm = this.blankActivityForm('note');
  closeReason = '';
  closeReasonNote = '';

  get canWrite(): boolean { return this.auth.hasPermission('crm:write'); }
  get canAssign(): boolean { return this.auth.hasPermission('crm:assign'); }
  get canConvert(): boolean { return this.auth.hasPermission('crm:convert') && this.businessAccountsEnabled(); }
  get canViewBusiness(): boolean { return this.auth.hasPermission('businessAccounts:read') && this.businessAccountsEnabled(); }

  async ngOnInit(): Promise<void> {
    await Promise.all([this.load(), this.loadBusinessFeatureState(), this.loadSalesTools()]);
    if (this.canAssign) {
      try { this.owners.set(await firstValueFrom(this.crm.owners())); } catch { this.owners.set([]); }
    }
  }


  async loadSalesTools(): Promise<void> {
    const id=this.route.snapshot.paramMap.get('id'); if(!id)return;
    try { const [stages,attachments,proposals]=await Promise.all([firstValueFrom(this.crm.stages()),firstValueFrom(this.crm.attachments(id)),firstValueFrom(this.crm.proposals(id))]); this.pipelineStages.set(stages.data);this.attachments.set(attachments.data);this.proposals.set(proposals.data); } catch(error){ console.error(error); }
  }

  openCommunications(channel: 'email' | 'sms', contactId?: string | null): void {
    const c = this.company();
    const contact = contactId ? c?.contacts.find((item) => item.id === contactId) : c?.primaryContact ?? c?.contacts?.[0];
    if (!contact) { this.toast.error('Add a contact before starting a conversation.'); return; }
    if (channel === 'email' && !contact.email) { this.toast.error(`${contact.name} does not have an email address.`); return; }
    if (channel === 'sms' && !contact.phone) { this.toast.error(`${contact.name} does not have a phone number.`); return; }
    void this.router.navigate(['/communications'], { queryParams: { crmContactId: contact.id, channel, crm: '1' } });
  }
  async uploadAttachment(event:Event):Promise<void>{const c=this.company();const input=event.target as HTMLInputElement;const file=input.files?.[0];if(!c||!file)return;try{const init:any=await firstValueFrom(this.crm.attachmentInit(c.id,{filename:file.name,mimeType:file.type||'application/octet-stream',sizeBytes:file.size}));const put=await fetch(init.uploadUrl,{method:'PUT',headers:{'Content-Type':file.type||'application/octet-stream'},body:file});if(!put.ok)throw new Error('Upload failed');await firstValueFrom(this.crm.attachmentComplete(c.id,{filename:file.name,mimeType:file.type||'application/octet-stream',sizeBytes:file.size,storageKey:init.storageKey}));this.toast.success('Attachment uploaded.');await this.loadSalesTools();}catch(e:any){this.toast.error(e?.message||'Could not upload attachment.');}finally{input.value='';}}
  async removeAttachment(a:CrmAttachment):Promise<void>{const c=this.company();if(!c||!confirm(`Delete ${a.filename}?`))return;try{await firstValueFrom(this.crm.deleteAttachment(c.id,a.id));await this.loadSalesTools();}catch{this.toast.error('Could not delete attachment.');}}
  addProposalLine():void{this.proposalForm.lines.push({description:'',quantity:1,unitAmount:0,billingType:'one_time'});}
  removeProposalLine(i:number):void{this.proposalForm.lines.splice(i,1);}
  async createProposal():Promise<void>{const c=this.company();if(!c||!this.proposalForm.title.trim())return;try{await firstValueFrom(this.crm.createProposal(c.id,{title:this.proposalForm.title.trim(),opportunityId:this.proposalForm.opportunityId||null,validUntil:this.proposalForm.validUntil?new Date(`${this.proposalForm.validUntil}T23:59:59`).toISOString():null,intro:this.clean(this.proposalForm.intro),terms:this.clean(this.proposalForm.terms),lines:this.proposalForm.lines.filter(x=>x.description.trim()).map((x,i)=>({description:x.description.trim(),quantity:Math.max(1,Math.round(x.quantity||1)),unitAmountCents:Math.max(0,Math.round((x.unitAmount||0)*100)),billingType:x.billingType,sortOrder:i}))}));this.toast.success('Proposal created.');this.proposalForm={title:'',opportunityId:'',validUntil:'',intro:'',terms:'',lines:[{description:'',quantity:1,unitAmount:0,billingType:'one_time'}]};await this.loadSalesTools();}catch(e:any){this.toast.error(e?.error?.error||'Could not create proposal.');}}
  async setProposalStatus(p:CrmProposal,status:'draft'|'sent'|'accepted'|'declined'|'expired'):Promise<void>{const c=this.company();if(!c)return;try{await firstValueFrom(this.crm.updateProposal(c.id,p.id,{status}));await this.loadSalesTools();}catch{this.toast.error('Could not update proposal.');}}
  calculatorMrr():number{return Math.round((this.calculatorForm.devices||0)*(this.calculatorForm.monthlyPerDevice||0)*100);}
  calculatorArr():number{return this.calculatorMrr()*12;}
  calculatorRepairMargin():number{return Math.round((this.calculatorForm.expectedRepairsPerYear||0)*((this.calculatorForm.averageRepairRevenue||0)-(this.calculatorForm.averageRepairCost||0))*100);}
  calculatorSetup():number{return Math.round((this.calculatorForm.setupFee||0)*100);}
  async applyCalculatorById(id:string):Promise<void>{const opportunity=this.activeOpportunities().find(o=>o.id===id);if(opportunity)await this.applyCalculatorToOpportunity(opportunity);}
  async applyCalculatorToOpportunity(opportunity:CrmOpportunity):Promise<void>{const c=this.company();if(!c)return;try{await firstValueFrom(this.crm.updateOpportunity(c.id,opportunity.id,{monthlyValueCents:this.calculatorMrr(),oneTimeValueCents:this.calculatorSetup(),estimatedDeviceCount:Math.round(this.calculatorForm.devices||0),calculatorSnapshot:{...this.calculatorForm,annualRecurringCents:this.calculatorArr(),annualRepairMarginCents:this.calculatorRepairMargin()}}));this.toast.success('Fleet estimate applied to opportunity.');await this.load();}catch{this.toast.error('Could not apply calculator.');}}

  private async loadBusinessFeatureState(): Promise<void> {
    try {
      const state = await firstValueFrom(this.businessSettings.getFeatures());
      this.businessAccountsEnabled.set(state.settings.businessAccountsEnabled);
    } catch {
      this.businessAccountsEnabled.set(false);
    }
  }

  async load(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      void this.router.navigate(['/crm']);
      return;
    }
    this.loading.set(true);
    try {
      const company = await firstValueFrom(this.crm.company(id));
      this.company.set(company);
      this.detailForm = {
        website: company.website ?? '',
        industry: company.industry ?? '',
        source: company.source ?? '',
        sourceDetail: company.sourceDetail ?? '',
        renewalDate: company.renewalAt ? company.renewalAt.slice(0,10) : '',
        accountHealth: company.accountHealth ?? '',
        accountHealthNote: company.accountHealthNote ?? '',
        estimatedDeviceCount: company.estimatedDeviceCount,
        ownerUserId: company.ownerUserId ?? '',
        notes: company.notes ?? '',
      };
    } catch (error) {
      console.error(error);
      this.toast.error('Could not load this CRM company.');
      void this.router.navigate(['/crm']);
    } finally {
      this.loading.set(false);
    }
  }

  back(): void { void this.router.navigate(['/crm']); }

  openBusinessAccount(): void {
    const id = this.company()?.businessAccountId;
    if (id) void this.router.navigate(['/business-accounts', id]);
  }

  async saveDetails(): Promise<void> {
    const company = this.company();
    if (!company || !this.canWrite) return;
    this.saving.set(true);
    try {
      await firstValueFrom(this.crm.updateCompany(company.id, {
        website: this.clean(this.detailForm.website),
        industry: this.clean(this.detailForm.industry),
        source: this.clean(this.detailForm.source),
        sourceDetail: this.clean(this.detailForm.sourceDetail),
        renewalAt: this.detailForm.renewalDate ? new Date(`${this.detailForm.renewalDate}T12:00:00`).toISOString() : null,
        accountHealth: this.clean(this.detailForm.accountHealth),
        accountHealthNote: this.clean(this.detailForm.accountHealthNote),
        lastHealthReviewAt: this.detailForm.accountHealth ? new Date().toISOString() : null,
        estimatedDeviceCount: this.detailForm.estimatedDeviceCount === null ? null : Math.max(0, Math.round(Number(this.detailForm.estimatedDeviceCount))),
        ...(this.canAssign ? { ownerUserId: this.detailForm.ownerUserId || null } : {}),
        notes: this.clean(this.detailForm.notes),
      }));
      this.toast.success('Company details saved.');
      await this.load();
    } catch (error: any) {
      console.error(error);
      this.toast.error(error?.error?.error || 'Could not save company details.');
    } finally {
      this.saving.set(false);
    }
  }

  startOpportunity(): void {
    const company = this.company();
    this.opportunityForm = this.blankOpportunityForm();
    this.opportunityForm.title = company ? `${company.name} Opportunity` : '';
    this.opportunityForm.estimatedDeviceCount = company?.estimatedDeviceCount ?? null;
    this.opportunityOpen.set(true);
  }

  async addOpportunity(): Promise<void> {
    const company = this.company();
    if (!company || !this.opportunityForm.title.trim()) {
      this.toast.error('Opportunity name is required.');
      return;
    }
    this.saving.set(true);
    try {
      await firstValueFrom(this.crm.addOpportunity(company.id, {
        title: this.opportunityForm.title.trim(),
        stage: this.opportunityForm.stage,
        estimatedDeviceCount: this.opportunityForm.estimatedDeviceCount,
        monthlyValueCents: this.moneyToCents(this.opportunityForm.monthlyValue),
        oneTimeValueCents: this.moneyToCents(this.opportunityForm.oneTimeValue),
        probability: this.opportunityForm.probability,
        expectedCloseAt: this.dateToIso(this.opportunityForm.expectedCloseDate),
        ownerUserId: this.canAssign ? (this.opportunityForm.ownerUserId || company.ownerUserId || null) : undefined,
        notes: this.clean(this.opportunityForm.notes),
      }));
      this.opportunityOpen.set(false);
      this.toast.success('Opportunity added.');
      await this.load();
    } catch (error: any) {
      console.error(error);
      this.toast.error(error?.error?.error || 'Could not add opportunity.');
    } finally { this.saving.set(false); }
  }

  async changeStage(opportunity: CrmOpportunity, stage: CrmOpportunityStage): Promise<void> {
    if (!this.canWrite || stage === opportunity.stage) return;
    if (stage === 'won' || stage === 'lost') {
      this.openCloseDeal(opportunity, stage);
      return;
    }
    try {
      const probability=this.pipelineStages().find(s=>s.key===stage)?.probability;
      await firstValueFrom(this.crm.updateOpportunity(opportunity.companyId, opportunity.id, { stage, ...(probability !== undefined ? { probability } : {}) }));
      if (['contacted', 'qualified', 'proposal', 'negotiation'].includes(stage)) {
        this.toast.success(`Moved to ${this.stageLabel(stage)}. A follow-up is scheduled automatically when none is open.`);
      }
      await this.load();
    } catch (error) {
      console.error(error);
      this.toast.error('Could not update opportunity stage.');
    }
  }

  openCloseDeal(opportunity: CrmOpportunity, stage: 'won' | 'lost'): void {
    this.closingOpportunity.set(opportunity);
    this.closeStage.set(stage);
    this.closeReason = '';
    this.closeReasonNote = '';
    this.closeOpen.set(true);
  }

  closeCloseDeal(): void {
    if (this.saving()) return;
    this.closeOpen.set(false);
    this.closingOpportunity.set(null);
  }

  closeReasonOptions() { return this.closeStage() === 'won' ? this.wonReasons : this.lostReasons; }

  closeReasonLabel(reason: string | null): string {
    if (!reason) return 'Not specified';
    const all = [...this.wonReasons, ...this.lostReasons] as readonly (readonly [string, string])[];
    return all.find(([key]) => key === reason)?.[1] ?? reason.replace(/_/g, ' ');
  }

  async confirmCloseDeal(): Promise<void> {
    const opportunity = this.closingOpportunity();
    if (!opportunity || !this.closeReason) { this.toast.error('Choose a close reason first.'); return; }
    this.saving.set(true);
    try {
      await firstValueFrom(this.crm.updateOpportunity(opportunity.companyId, opportunity.id, {
        stage: this.closeStage(),
        closeReason: this.closeReason,
        closeReasonNote: this.clean(this.closeReasonNote),
      }));
      this.closeOpen.set(false);
      this.closingOpportunity.set(null);
      this.toast.success(this.closeStage() === 'won' ? 'Opportunity marked won.' : 'Opportunity marked lost.');
      await this.load();
    } catch (error: any) {
      console.error(error);
      this.toast.error(error?.error?.error === 'crm_close_reason_required' ? 'Choose a close reason first.' : 'Could not close this opportunity.');
    } finally { this.saving.set(false); }
  }

  startContact(): void {
    this.contactForm = this.blankContactForm();
    this.contactOpen.set(true);
  }

  async addContact(): Promise<void> {
    const company = this.company();
    if (!company || !this.contactForm.name.trim()) {
      this.toast.error('Contact name is required.');
      return;
    }
    this.saving.set(true);
    try {
      await firstValueFrom(this.crm.addContact(company.id, {
        name: this.contactForm.name.trim(),
        title: this.clean(this.contactForm.title),
        email: this.clean(this.contactForm.email),
        phone: this.clean(this.contactForm.phone),
        isPrimary: this.contactForm.isPrimary,
        notes: this.clean(this.contactForm.notes),
      }));
      this.contactOpen.set(false);
      this.toast.success('Contact added.');
      await this.load();
    } catch (error: any) {
      console.error(error);
      this.toast.error(error?.error?.error || 'Could not add contact.');
    } finally { this.saving.set(false); }
  }

  startActivity(type: CrmActivityType): void {
    this.activityForm = this.blankActivityForm(type);
    this.activityOpen.set(true);
  }

  async addActivity(): Promise<void> {
    const company = this.company();
    if (!company || !this.activityForm.subject.trim()) {
      this.toast.error(this.activityForm.type === 'task' ? 'Follow-up title is required.' : 'Activity subject is required.');
      return;
    }
    this.saving.set(true);
    try {
      await firstValueFrom(this.crm.addActivity(company.id, {
        type: this.activityForm.type,
        subject: this.activityForm.subject.trim(),
        body: this.clean(this.activityForm.body),
        opportunityId: this.activityForm.opportunityId || null,
        dueAt: this.activityForm.type === 'task' ? this.localDateTimeToIso(this.activityForm.dueAt) : null,
      }));
      this.activityOpen.set(false);
      this.toast.success(this.activityForm.type === 'task' ? 'Follow-up scheduled.' : 'Activity saved.');
      await this.load();
    } catch (error: any) {
      console.error(error);
      this.toast.error(error?.error?.error || 'Could not save activity.');
    } finally { this.saving.set(false); }
  }

  async completeTask(activity: CrmActivity): Promise<void> {
    const company = this.company();
    if (!company || activity.type !== 'task' || activity.completedAt) return;
    try {
      await firstValueFrom(this.crm.updateActivity(company.id, activity.id, { completedAt: new Date().toISOString() }));
      this.toast.success('Follow-up completed.');
      await this.load();
    } catch (error) {
      console.error(error);
      this.toast.error('Could not complete this follow-up.');
    }
  }

  editActivity(activity: CrmActivity): void {
    if (!this.canWrite) return;
    this.editingActivity.set(activity);
    this.activityForm = {
      type: activity.type,
      subject: activity.subject,
      body: activity.body ?? '',
      opportunityId: activity.opportunityId ?? '',
      dueAt: activity.dueAt ? this.isoToLocalDateTime(activity.dueAt) : '',
    };
    this.activityEditOpen.set(true);
  }

  closeActivityEdit(): void {
    if (!this.saving()) {
      this.activityEditOpen.set(false);
      this.editingActivity.set(null);
    }
  }

  async saveActivityEdit(): Promise<void> {
    const company = this.company();
    const activity = this.editingActivity();
    if (!company || !activity || !this.activityForm.subject.trim()) {
      this.toast.error('Activity subject is required.');
      return;
    }
    this.saving.set(true);
    try {
      await firstValueFrom(this.crm.updateActivity(company.id, activity.id, {
        subject: this.activityForm.subject.trim(),
        body: this.clean(this.activityForm.body),
        dueAt: activity.type === 'task' ? this.localDateTimeToIso(this.activityForm.dueAt) : null,
      }));
      this.activityEditOpen.set(false);
      this.editingActivity.set(null);
      this.toast.success(activity.type === 'task' ? 'Follow-up updated.' : 'Activity updated.');
      await this.load();
    } catch (error: any) {
      console.error(error);
      this.toast.error(error?.error?.error || 'Could not update activity.');
    } finally {
      this.saving.set(false);
    }
  }

  async convertToBusiness(): Promise<void> {
    const company = this.company();
    if (!company || company.businessAccountId || !this.canConvert) return;
    const confirmed = window.confirm(`Convert ${company.name} into an active Opscend Business Account?`);
    if (!confirmed) return;
    this.converting.set(true);
    try {
      const result = await firstValueFrom(this.crm.convert(company.id));
      this.toast.success(`${company.name} is now an active business account.`);
      if (this.canViewBusiness) {
        await this.router.navigate(['/business-accounts', result.businessAccountId]);
      } else {
        await this.load();
      }
    } catch (error: any) {
      console.error(error);
      if (error?.status === 409 && error?.error?.businessAccountId) {
        this.toast.error('That customer is already linked to a business account.');
      } else {
        this.toast.error(error?.error?.message || error?.error?.error || 'Could not convert this prospect.');
      }
    } finally { this.converting.set(false); }
  }

  activeOpportunities(): CrmOpportunity[] {
    return (this.company()?.opportunities ?? []).filter((item) => !['won', 'lost'].includes(item.stage));
  }

  closedOpportunities(): CrmOpportunity[] {
    return (this.company()?.opportunities ?? []).filter((item) => ['won', 'lost'].includes(item.stage));
  }

  allOpportunities(): CrmOpportunity[] {
    return this.company()?.opportunities ?? [];
  }

  weightedMonthly(): number {
    return this.activeOpportunities().reduce((sum, item) => sum + Math.round((item.monthlyValueCents ?? 0) * item.probability / 100), 0);
  }

  weightedOneTime(): number {
    return this.activeOpportunities().reduce((sum, item) => sum + Math.round((item.oneTimeValueCents ?? 0) * item.probability / 100), 0);
  }

  recentActivities(): CrmActivity[] {
    return (this.company()?.activities ?? []).slice(0, 5);
  }

  money(cents: number | null | undefined): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format((cents ?? 0) / 100);
  }

  formatDate(value: string | null | undefined, includeTime = false): string {
    if (!value) return '—';
    const options: Intl.DateTimeFormatOptions = includeTime
      ? { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }
      : { month: 'short', day: 'numeric', year: 'numeric' };
    return new Intl.DateTimeFormat('en-US', options).format(new Date(value));
  }

  activityIcon(type: CrmActivityType) {
    return type === 'call' ? this.phoneIcon : (type === 'email' || type === 'sms') ? this.emailIcon : type === 'meeting' ? this.meetingIcon : type === 'task' ? this.taskIcon : this.noteIcon;
  }

  activityLabel(type: CrmActivityType): string {
    return type === 'call' ? 'Call' : type === 'email' ? 'Email' : type === 'sms' ? 'SMS' : type === 'meeting' ? 'Meeting' : type === 'task' ? 'Follow-up' : 'Note';
  }

  stageLabel(stage: CrmOpportunityStage): string {
    return this.stages.find((item) => item.key === stage)?.label ?? stage;
  }

  private clean(value: string): string | null { return value.trim() || null; }
  private moneyToCents(value: number | null): number | null { return value === null || value === undefined ? null : Math.max(0, Math.round(Number(value) * 100)); }
  private dateToIso(value: string): string | null { return value ? new Date(`${value}T12:00:00`).toISOString() : null; }
  private localDateTimeToIso(value: string): string | null { return value ? new Date(value).toISOString() : null; }
  private isoToLocalDateTime(value: string): string {
    const date = new Date(value);
    const pad = (part: number) => String(part).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  private blankDetailForm() { return { website: '', industry: '', source: '', sourceDetail: '', renewalDate: '', accountHealth: '', accountHealthNote: '', estimatedDeviceCount: null as number | null, ownerUserId: '', notes: '' }; }
  private blankOpportunityForm() { return { title: '', stage: 'lead' as CrmOpportunityStage, estimatedDeviceCount: null as number | null, monthlyValue: null as number | null, oneTimeValue: null as number | null, probability: 10, expectedCloseDate: '', ownerUserId: '', notes: '' }; }
  private blankContactForm() { return { name: '', title: '', email: '', phone: '', isPrimary: false, notes: '' }; }
  private blankActivityForm(type: CrmActivityType) { return { type, subject: '', body: '', opportunityId: '', dueAt: '' }; }
}
