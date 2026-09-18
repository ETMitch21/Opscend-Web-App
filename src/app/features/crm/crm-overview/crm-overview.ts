import { CommonModule } from '@angular/common';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  CircleDollarSign,
  GripVertical,
  LayoutDashboard,
  LoaderCircle,
  Plus,
  Search,
  Target,
  TrendingUp,
  UsersRound,
  X,
  LucideAngularModule,
} from 'lucide-angular';
import { firstValueFrom } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import type { CrmOpportunity, CrmOpportunityStage, CrmOwner, CrmOverview, CrmPipelineStage, CrmInsights } from '../../../core/crm/model';
import { CrmService } from '../../../core/crm/service';
import { ToastService } from '../../../core/toast/toast-service';

@Component({
  selector: 'app-crm-overview',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule, LucideAngularModule],
  templateUrl: './crm-overview.html',
  styleUrl: './crm-overview.scss',
})
export class CrmOverviewComponent implements OnInit {
  private readonly crm = inject(CrmService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly crmIcon = BriefcaseBusiness;
  readonly pipelineIcon = Target;
  readonly companyIcon = Building2;
  readonly moneyIcon = CircleDollarSign;
  readonly followUpIcon = CalendarClock;
  readonly usersIcon = UsersRound;
  readonly dashboardIcon = LayoutDashboard;
  readonly reportsIcon = BarChart3;
  readonly trendIcon = TrendingUp;
  readonly dragIcon = GripVertical;
  readonly plusIcon = Plus;
  readonly searchIcon = Search;
  readonly closeIcon = X;
  readonly arrowIcon = ArrowRight;
  readonly loadingIcon = LoaderCircle;

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly draggedOpportunityId = signal<string | null>(null);
  readonly dragOverStage = signal<CrmOpportunityStage | null>(null);
  readonly overview = signal<CrmOverview | null>(null);
  readonly owners = signal<CrmOwner[]>([]);
  readonly tab = signal<'pipeline' | 'companies' | 'reports' | 'admin'>('pipeline');
  readonly pipelineStages = signal<CrmPipelineStage[]>([]);
  readonly insights = signal<CrmInsights | null>(null);
  readonly period = signal(new Date().toISOString().slice(0, 7));
  stageForm = { key:'', label:'', probability:30, position:50, color:'' };
  goalForm: Record<string,{monthly:number;oneTime:number;opportunities:number;followUps:number}> = {};
  importing = signal(false);
  readonly createOpen = signal(false);
  readonly closeOpen = signal(false);
  readonly closingOpportunity = signal<CrmOpportunity | null>(null);
  readonly closeStage = signal<'won' | 'lost'>('won');

  search = '';
  form = this.blankForm();
  closeReason = '';
  closeReasonNote = '';

  get stages(): { key: CrmOpportunityStage; label: string; hint: string }[] {
    const rows = this.pipelineStages().filter((s) => s.isActive && s.kind === 'open');
    if (rows.length) return rows.map((s) => ({ key: s.key, label: s.label, hint: `${s.probability}% probability` }));
    return [
      {key:'lead',label:'Lead',hint:'10% probability'},{key:'contacted',label:'Contacted',hint:'20% probability'},
      {key:'qualified',label:'Qualified',hint:'40% probability'},{key:'proposal',label:'Proposal',hint:'65% probability'},
      {key:'negotiation',label:'Closing',hint:'85% probability'},
    ];
  }

  get stageDropListIds(): string[] { return this.stages.map((stage) => `crm-stage-${stage.key}`); }

  readonly wonReasons = [
    ['relationship', 'Relationship / trust'],
    ['service_fit', 'Service capability / fit'],
    ['speed', 'Speed / availability'],
    ['price', 'Price / value'],
    ['referral', 'Referral / recommendation'],
    ['competitor_switch', 'Switched from competitor'],
    ['other', 'Other'],
  ] as const;

  readonly lostReasons = [
    ['price', 'Price'],
    ['competitor', 'Went with competitor'],
    ['timing', 'Timing / not ready'],
    ['budget', 'Budget unavailable'],
    ['no_response', 'No response'],
    ['not_interested', 'Not interested'],
    ['project_cancelled', 'Project cancelled'],
    ['poor_fit', 'Not a fit'],
    ['other', 'Other'],
  ] as const;

  get canWrite(): boolean { return this.auth.hasPermission('crm:write'); }
  get canAssign(): boolean { return this.auth.hasPermission('crm:assign'); }
  get canManage(): boolean { return this.auth.hasPermission('crm:manage'); }

  get filteredCompanies() {
    const companies = this.overview()?.companies ?? [];
    const query = this.search.trim().toLowerCase();
    if (!query) return companies;
    return companies.filter((company) => [
      company.name,
      company.primaryContact?.name,
      company.primaryContact?.email,
      company.industry,
      company.source,
    ].some((value) => value?.toLowerCase().includes(query)));
  }

  async ngOnInit(): Promise<void> {
    await Promise.all([this.load(), this.loadExtras()]);
    if (this.canAssign) {
      try { this.owners.set(await firstValueFrom(this.crm.owners())); } catch { this.owners.set([]); }
    }
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.overview.set(await firstValueFrom(this.crm.overview()));
    } catch (error) {
      console.error(error);
      this.toast.error('CRM could not be loaded.');
    } finally {
      this.loading.set(false);
    }
  }

  async loadExtras(): Promise<void> {
    try {
      const [stages, insights] = await Promise.all([
        firstValueFrom(this.crm.stages()), firstValueFrom(this.crm.insights(this.period())),
      ]);
      this.pipelineStages.set(stages.data); this.insights.set(insights);
      for (const row of insights.leaderboard) { const g=row.goal; this.goalForm[row.userId || '']={ monthly:(g?.wonMonthlyGoalCents||0)/100, oneTime:(g?.wonOneTimeGoalCents||0)/100, opportunities:g?.opportunitiesGoal||0, followUps:g?.followUpsGoal||0 }; }
    } catch (error) { console.error(error); }
  }

  async addStage(): Promise<void> {
    if (!this.stageForm.key.trim() || !this.stageForm.label.trim()) return;
    try { await firstValueFrom(this.crm.createStage({ ...this.stageForm, key:this.stageForm.key.trim().toLowerCase().replace(/[^a-z0-9_-]+/g,'-'), isActive:true } as any)); this.stageForm={key:'',label:'',probability:30,position:50,color:''}; await this.loadExtras(); this.toast.success('Pipeline stage added.'); } catch(e:any){ this.toast.error(e?.error?.error || 'Could not add stage.'); }
  }
  async updateStage(row: CrmPipelineStage): Promise<void> { try { await firstValueFrom(this.crm.updateStage(row.id,{label:row.label,position:row.position,probability:row.probability,color:row.color,isActive:row.isActive})); await this.loadExtras(); } catch { this.toast.error('Could not save stage.'); } }
  async deleteStage(row: CrmPipelineStage): Promise<void> { if(!confirm(`Delete ${row.label}?`))return; try{await firstValueFrom(this.crm.deleteStage(row.id));await this.loadExtras();}catch(e:any){this.toast.error(e?.error?.error==='stage_in_use'?'Move deals out of this stage first.':'Could not delete stage.');} }



  async saveGoal(userId:string):Promise<void>{const f=this.goalForm[userId];if(!f)return;try{await firstValueFrom(this.crm.saveGoal(userId,{period:this.period(),wonMonthlyGoalCents:Math.round((f.monthly||0)*100),wonOneTimeGoalCents:Math.round((f.oneTime||0)*100),opportunitiesGoal:Math.round(f.opportunities||0),followUpsGoal:Math.round(f.followUps||0)}));await this.loadExtras();this.toast.success('Goal saved.');}catch{this.toast.error('Could not save goal.');}}
  async changePeriod(value:string):Promise<void>{this.period.set(value);await this.loadExtras();}
  async importCsv(event:Event):Promise<void>{const input=event.target as HTMLInputElement;const file=input.files?.[0];if(!file)return;this.importing.set(true);try{const text=await file.text();const lines=text.split(/\r?\n/).filter(Boolean);if(lines.length<2)throw new Error('CSV is empty');const headers=this.parseCsvLine(lines[0]).map(h=>h.trim().toLowerCase());const rows=lines.slice(1).map(line=>{const values=this.parseCsvLine(line);const get=(...names:string[])=>{const i=headers.findIndex(h=>names.includes(h));return i>=0?(values[i]||'').trim():''};return{companyName:get('company','company name','companyname','name'),contactName:get('contact','contact name','contactname'),contactEmail:get('email','contact email'),contactPhone:get('phone','contact phone'),industry:get('industry'),source:get('source','lead source'),opportunityTitle:get('opportunity','opportunity title'),stage:get('stage')||'lead',monthlyValueCents:Math.round(Number(get('monthly value','monthly','mrr')||0)*100),oneTimeValueCents:Math.round(Number(get('one-time value','one time value','one-time','one time')||0)*100)}}).filter(r=>r.companyName);const result=await firstValueFrom(this.crm.importCompanies(rows));this.toast.success(`Imported ${result.created} companies${result.failed?`; ${result.failed} failed`:''}.`);await Promise.all([this.load(),this.loadExtras()]);}catch(e:any){this.toast.error(e?.message||'CSV import failed.');}finally{this.importing.set(false);input.value='';}}
  private parseCsvLine(line:string):string[]{const out:string[]=[];let cur='';let q=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(q&&line[i+1]==='"'){cur+='"';i++;}else q=!q;}else if(c===','&&!q){out.push(cur);cur='';}else cur+=c;}out.push(cur);return out;}


  followUpCompanies(): CrmOverview['companies'] {
    return [...(this.overview()?.companies ?? [])]
      .filter((company) => !!company.nextFollowUpAt && company.status !== 'lost')
      .sort((a, b) => new Date(a.nextFollowUpAt!).getTime() - new Date(b.nextFollowUpAt!).getTime())
      .slice(0, 6);
  }

  overdueFollowUps(): number {
    const now = new Date();
    return this.followUpCompanies().filter((company) => new Date(company.nextFollowUpAt!).getTime() < new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()).length;
  }

  staleOpportunities(): CrmOpportunity[] {
    const cutoff = Date.now() - 14 * 86_400_000;
    return [...(this.overview()?.pipeline ?? [])]
      .filter((opportunity) => new Date(opportunity.lastActivityAt ?? opportunity.updatedAt).getTime() < cutoff)
      .sort((a, b) => new Date(a.lastActivityAt ?? a.updatedAt).getTime() - new Date(b.lastActivityAt ?? b.updatedAt).getTime())
      .slice(0, 6);
  }

  noNextActionOpportunities(): CrmOpportunity[] {
    const data = this.overview();
    if (!data) return [];
    return data.pipeline.filter((opportunity) => !opportunity.nextFollowUpAt).slice(0, 6);
  }

  staleWithNextAction(): CrmOpportunity[] {
    const noNextIds = new Set(this.noNextActionOpportunities().map((opportunity) => opportunity.id));
    return this.staleOpportunities().filter((opportunity) => !noNextIds.has(opportunity.id)).slice(0, 3);
  }

  closeReasonLabel(reason: string): string {
    const all = [...this.wonReasons, ...this.lostReasons] as readonly (readonly [string, string])[];
    return all.find(([key]) => key === reason)?.[1] ?? reason.replace(/_/g, ' ');
  }

  daysSince(value: string): number {
    return Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000));
  }

  pipelineFor(stage: CrmOpportunityStage): CrmOpportunity[] {
    return (this.overview()?.pipeline ?? []).filter((item) => item.stage === stage);
  }

  stageMonthly(stage: CrmOpportunityStage): number {
    return this.pipelineFor(stage).reduce((sum, item) => sum + (item.monthlyValueCents ?? 0), 0);
  }

  stageOneTime(stage: CrmOpportunityStage): number {
    return this.pipelineFor(stage).reduce((sum, item) => sum + (item.oneTimeValueCents ?? 0), 0);
  }

  stageWeightedMonthly(stage: CrmOpportunityStage): number {
    return this.pipelineFor(stage).reduce((sum, item) => sum + Math.round((item.monthlyValueCents ?? 0) * item.probability / 100), 0);
  }

  stageWeightedOneTime(stage: CrmOpportunityStage): number {
    return this.pipelineFor(stage).reduce((sum, item) => sum + Math.round((item.oneTimeValueCents ?? 0) * item.probability / 100), 0);
  }

  stageProbability(stage: CrmOpportunityStage): number { const found=this.pipelineStages().find(s=>s.key===stage); return found?.probability ?? (stage==='won'?100:stage==='lost'?0:10); }

  percent(value: number): string {
    return `${Math.round(value * 10) / 10}%`;
  }

  stageLabel(stage: CrmOpportunityStage): string { return this.pipelineStages().find(s=>s.key===stage)?.label ?? ({won:'Won',lost:'Lost'} as any)[stage] ?? stage; }

  openCreate(): void {
    this.form = this.blankForm();
    this.createOpen.set(true);
  }

  closeCreate(): void {
    if (!this.saving()) this.createOpen.set(false);
  }

  async createProspect(): Promise<void> {
    if (!this.form.companyName.trim()) {
      this.toast.error('Company name is required.');
      return;
    }
    if (this.form.contactEmail && !this.form.contactName.trim()) {
      this.toast.error('Add the contact name or remove the contact email.');
      return;
    }

    this.saving.set(true);
    try {
      const monthlyValueCents = this.form.monthlyValue === null || this.form.monthlyValue === undefined
        ? null
        : Math.max(0, Math.round(Number(this.form.monthlyValue) * 100));
      const oneTimeValueCents = this.form.oneTimeValue === null || this.form.oneTimeValue === undefined
        ? null
        : Math.max(0, Math.round(Number(this.form.oneTimeValue) * 100));
      const estimatedDevices = this.form.estimatedDevices === null || this.form.estimatedDevices === undefined
        ? null
        : Math.max(0, Math.round(Number(this.form.estimatedDevices)));

      const created = await firstValueFrom(this.crm.createCompany({
        name: this.form.companyName.trim(),
        website: this.clean(this.form.website),
        industry: this.clean(this.form.industry),
        source: this.clean(this.form.source),
        estimatedDeviceCount: estimatedDevices,
        ownerUserId: this.canAssign ? (this.form.ownerUserId || null) : undefined,
        notes: this.clean(this.form.notes),
        ...(this.form.contactName.trim() ? {
          primaryContact: {
            name: this.form.contactName.trim(),
            title: this.clean(this.form.contactTitle),
            email: this.clean(this.form.contactEmail),
            phone: this.clean(this.form.contactPhone),
            isPrimary: true,
          },
        } : {}),
        initialOpportunity: {
          title: this.form.opportunityTitle.trim() || `${this.form.companyName.trim()} Opportunity`,
          stage: 'lead',
          estimatedDeviceCount: estimatedDevices,
          monthlyValueCents,
          oneTimeValueCents,
          ownerUserId: this.canAssign ? (this.form.ownerUserId || null) : undefined,
        },
      }));
      this.createOpen.set(false);
      this.toast.success(`${created.name} was added to CRM.`);
      await this.router.navigate(['/crm', created.id]);
    } catch (error: any) {
      console.error(error);
      this.toast.error(error?.error?.message || error?.error?.error || 'Could not create this prospect.');
    } finally {
      this.saving.set(false);
    }
  }

  async changeStage(opportunity: CrmOpportunity, stage: CrmOpportunityStage): Promise<void> {
    if (!this.canWrite || opportunity.stage === stage) return;
    if (stage === 'won' || stage === 'lost') {
      this.openCloseDeal(opportunity, stage);
      return;
    }
    await this.commitStage(opportunity, stage);
  }

  private async commitStage(
    opportunity: CrmOpportunity,
    stage: CrmOpportunityStage,
    close?: { closeReason: string; closeReasonNote?: string | null },
  ): Promise<void> {
    const previous = opportunity.stage;
    opportunity.stage = stage;
    this.overview.update((current) => current ? ({ ...current, pipeline: [...current.pipeline] }) : current);
    try {
      await firstValueFrom(this.crm.updateOpportunity(opportunity.companyId, opportunity.id, {
        stage,
        probability: this.stageProbability(stage),
        ...(close ?? {}),
      }));
      if (stage === 'won' || stage === 'lost') {
        this.toast.success(stage === 'won' ? 'Opportunity marked won.' : 'Opportunity marked lost.');
        await this.load();
      } else if (['contacted', 'qualified', 'proposal', 'negotiation'].includes(stage)) {
        this.toast.success(`Moved to ${this.stageLabel(stage)}. A follow-up is scheduled automatically when no open follow-up exists.`);
        await this.load();
      }
    } catch (error: any) {
      console.error(error);
      opportunity.stage = previous;
      this.overview.update((current) => current ? ({ ...current, pipeline: [...current.pipeline] }) : current);
      this.toast.error(error?.error?.error === 'crm_close_reason_required' ? 'Choose a close reason first.' : 'Could not move this opportunity.');
      throw error;
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

  closeReasonOptions() {
    return this.closeStage() === 'won' ? this.wonReasons : this.lostReasons;
  }

  async confirmCloseDeal(): Promise<void> {
    const opportunity = this.closingOpportunity();
    if (!opportunity || !this.closeReason) {
      this.toast.error('Choose a reason before closing the opportunity.');
      return;
    }
    this.saving.set(true);
    try {
      await this.commitStage(opportunity, this.closeStage(), { closeReason: this.closeReason, closeReasonNote: this.clean(this.closeReasonNote) });
      this.closeOpen.set(false);
      this.closingOpportunity.set(null);
    } catch {
      // commitStage already restored the card and surfaced the error.
    } finally {
      this.saving.set(false);
    }
  }

  onOpportunityDragStart(opportunity: CrmOpportunity): void {
    if (!this.canWrite) return;
    this.draggedOpportunityId.set(opportunity.id);
    this.dragOverStage.set(opportunity.stage);
  }

  onOpportunityDragEnd(): void {
    this.draggedOpportunityId.set(null);
    this.dragOverStage.set(null);
  }

  onStageDragEnter(stage: CrmOpportunityStage): void {
    if (!this.canWrite || !this.draggedOpportunityId()) return;
    this.dragOverStage.set(stage);
  }

  async onOpportunityDrop(event: CdkDragDrop<CrmOpportunity[]>, stage: CrmOpportunityStage): Promise<void> {
    if (!this.canWrite) return;

    const opportunity = event.item.data as CrmOpportunity;
    this.dragOverStage.set(null);
    this.draggedOpportunityId.set(null);

    if (!opportunity || opportunity.stage === stage) return;
    await this.changeStage(opportunity, stage);
  }

  openCompany(id: string): void {
    void this.router.navigate(['/crm', id]);
  }

  money(cents: number | null | undefined): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format((cents ?? 0) / 100);
  }

  shortDate(value: string | null): string {
    if (!value) return '—';
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(value));
  }

  relativeFollowUp(value: string | null): string {
    if (!value) return 'No follow-up';
    const date = new Date(value);
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const target = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const days = Math.round((target - start) / 86_400_000);
    if (days < 0) return `${Math.abs(days)}d overdue`;
    if (days === 0) return 'Due today';
    if (days === 1) return 'Tomorrow';
    return `In ${days} days`;
  }

  ownerInitials(name: string | null | undefined): string {
    if (!name) return '—';
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  }

  private clean(value: string): string | null {
    return value.trim() || null;
  }

  private blankForm() {
    return {
      companyName: '',
      website: '',
      industry: '',
      source: '',
      estimatedDevices: null as number | null,
      monthlyValue: null as number | null,
      oneTimeValue: null as number | null,
      opportunityTitle: '',
      ownerUserId: '',
      contactName: '',
      contactTitle: '',
      contactEmail: '',
      contactPhone: '',
      notes: '',
    };
  }
}
