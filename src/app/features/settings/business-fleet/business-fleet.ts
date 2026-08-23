import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  Building2,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  FileSignature,
  LoaderCircle,
  Plus,
  Save,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
  LucideAngularModule,
} from 'lucide-angular';
import { firstValueFrom } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import type { BusinessPlan } from '../../../core/business-plans/model';
import { BusinessPlansService } from '../../../core/business-plans/service';
import type {
  BusinessAgreementSection,
  BusinessAgreementTemplate,
  BusinessAgreementTemplateInput,
  BusinessAgreementVariable,
  BusinessFeatureState,
  BusinessPlanAgreementBinding,
  RenderedBusinessAgreement,
} from '../../../core/business-settings/model';
import { BusinessSettingsService } from '../../../core/business-settings/service';
import { ToastService } from '../../../core/toast/toast-service';
import { SettingsLayoutComponent } from '../settings-layout/settings-layout';

@Component({
  selector: 'app-business-fleet-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, SettingsLayoutComponent],
  templateUrl: './business-fleet.html',
  styleUrl: './business-fleet.scss',
})
export class BusinessFleetSettings implements OnInit {
  private readonly api = inject(BusinessSettingsService);
  private readonly plansApi = inject(BusinessPlansService);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);

  readonly icons = { Building2, Check, ChevronDown, ChevronUp, Copy, FileSignature, LoaderCircle, Plus, Save, Settings2, ShieldCheck, Sparkles, Trash2, X };
  readonly loading = signal(true);
  readonly savingFeatures = signal(false);
  readonly savingTemplate = signal(false);
  readonly previewing = signal(false);
  readonly featureState = signal<BusinessFeatureState | null>(null);
  readonly templates = signal<BusinessAgreementTemplate[]>([]);
  readonly variables = signal<BusinessAgreementVariable[]>([]);
  readonly plans = signal<BusinessPlan[]>([]);
  readonly bindings = signal<BusinessPlanAgreementBinding[]>([]);
  readonly editorOpen = signal(false);
  readonly editorStep = signal<AgreementEditorStep>('details');
  readonly variablesOpen = signal(false);
  readonly preview = signal<RenderedBusinessAgreement | null>(null);

  editingId: string | null = null;
  form = this.blankTemplate();

  get canWrite(): boolean {
    return this.auth.hasPermission('businessAccounts:write') || this.auth.hasPermission('shops:write');
  }

  blockingAgreementCount(state: BusinessFeatureState): number {
    return Math.max(state.blockers.activeBusinessContracts, state.blockers.activeFleetAgreements);
  }

  async ngOnInit(): Promise<void> {
    await this.loadAll();
  }

  async loadAll(): Promise<void> {
    this.loading.set(true);
    try {
      const [features, templates, variables, bindings] = await Promise.all([
        firstValueFrom(this.api.getFeatures()),
        firstValueFrom(this.api.listTemplates(true)),
        firstValueFrom(this.api.listVariables()),
        firstValueFrom(this.api.listPlanBindings()),
      ]);
      this.featureState.set(features);
      this.templates.set(templates.data ?? []);
      this.variables.set(variables.data ?? []);
      this.bindings.set(bindings.data ?? []);
      await this.loadPlansIfEnabled();
    } catch (error) {
      console.error(error);
      this.toast.error('Business & Fleet settings could not be loaded.');
    } finally {
      this.loading.set(false);
    }
  }

  async loadPlansIfEnabled(): Promise<void> {
    if (!this.featureState()?.settings.fleetManagementEnabled) {
      this.plans.set([]);
      return;
    }
    try {
      const response = await firstValueFrom(this.plansApi.list());
      this.plans.set(response.data ?? []);
    } catch (error) {
      console.error(error);
      this.plans.set([]);
    }
  }

  async setFleetEnabled(enabled: boolean): Promise<void> {
    if (!this.canWrite || !this.featureState()) return;
    await this.updateFeatures({ fleetManagementEnabled: enabled });
  }

  async setBusinessEnabled(enabled: boolean): Promise<void> {
    if (!this.canWrite || !this.featureState()) return;
    await this.updateFeatures({ businessAccountsEnabled: enabled });
  }

  async setDefaultTemplate(templateId: string): Promise<void> {
    await this.updateFeatures({ defaultAgreementTemplateId: templateId || null });
  }

  private async updateFeatures(payload: Record<string, unknown>): Promise<void> {
    this.savingFeatures.set(true);
    try {
      const state = await firstValueFrom(this.api.updateFeatures(payload));
      this.featureState.set(state);
      this.toast.success('Business settings updated.');
      await this.loadPlansIfEnabled();
    } catch (error: any) {
      console.error(error);
      this.toast.error(error?.error?.message || 'That setting cannot be changed right now.');
      try { this.featureState.set(await firstValueFrom(this.api.getFeatures())); } catch { /* keep last state */ }
    } finally {
      this.savingFeatures.set(false);
    }
  }

  activeTemplates(): BusinessAgreementTemplate[] {
    return this.templates().filter((template) => template.isActive);
  }

  templateName(id: string | null | undefined): string {
    if (!id) return 'Shop default';
    return this.templates().find((template) => template.id === id)?.name ?? 'Unavailable template';
  }

  defaultTemplateName(id: string | null | undefined): string {
    if (!id) return 'Standard Fleet Service Agreement';
    return this.templates().find((template) => template.id === id)?.name ?? 'Standard Fleet Service Agreement';
  }

  variableToken(variable: BusinessAgreementVariable): string { return `{{${variable.key}}}`; }

  async copyVariable(variable: BusinessAgreementVariable): Promise<void> {
    const token = this.variableToken(variable);
    try {
      await navigator.clipboard.writeText(token);
      this.toast.success(`${variable.label} variable copied.`);
    } catch {
      this.toast.error(`Copy ${token} and paste it where you want it in the agreement.`);
    }
  }

  bindingFor(planId: string): string {
    return this.bindings().find((binding) => binding.planId === planId)?.templateId ?? '';
  }

  async setPlanTemplate(planId: string, templateId: string): Promise<void> {
    if (!this.canWrite) return;
    try {
      const binding = await firstValueFrom(this.api.setPlanBinding(planId, templateId || null));
      this.bindings.update((rows) => [binding, ...rows.filter((row) => row.planId !== planId)]);
      this.toast.success('Agreement assignment updated.');
    } catch (error: any) {
      this.toast.error(error?.error?.message || 'Agreement assignment could not be saved.');
    }
  }

  openEditor(template?: BusinessAgreementTemplate): void {
    this.editingId = template?.isBuiltin ? null : (template?.id ?? null);
    this.form = template ? {
      name: template.isBuiltin ? `${template.name} Copy` : template.name,
      description: template.description ?? '',
      title: template.title,
      introduction: template.introduction,
      sections: template.sections.map((section) => ({ ...section, id: template.isBuiltin ? cryptoRandom() : section.id })),
      signatureStatement: template.signatureStatement,
      isActive: true,
    } : this.blankTemplate();
    this.preview.set(null);
    this.editorStep.set('details');
    this.variablesOpen.set(false);
    this.editorOpen.set(true);
    void this.refreshPreview();
  }

  closeEditor(): void {
    if (this.savingTemplate()) return;
    this.editorOpen.set(false);
    this.editorStep.set('details');
    this.variablesOpen.set(false);
    this.editingId = null;
    this.preview.set(null);
  }


  setEditorStep(step: AgreementEditorStep): void {
    this.editorStep.set(step);
    if (step === 'preview') void this.refreshPreview();
  }

  addSection(): void {
    this.form.sections.push({ id: cryptoRandom(), title: 'New section', body: '' });
  }

  removeSection(index: number): void {
    if (this.form.sections.length <= 1) {
      this.toast.error('An agreement needs at least one section.');
      return;
    }
    this.form.sections.splice(index, 1);
  }

  moveSection(index: number, direction: -1 | 1): void {
    const target = index + direction;
    if (target < 0 || target >= this.form.sections.length) return;
    const [section] = this.form.sections.splice(index, 1);
    this.form.sections.splice(target, 0, section!);
  }

  insertVariable(target: 'title' | 'introduction' | 'signature' | 'section', variable: BusinessAgreementVariable, sectionIndex?: number): void {
    const token = `{{${variable.key}}}`;
    if (target === 'title') this.form.title += token;
    else if (target === 'introduction') this.form.introduction += token;
    else if (target === 'signature') this.form.signatureStatement += token;
    else if (target === 'section' && sectionIndex !== undefined) this.form.sections[sectionIndex]!.body += token;
  }

  async refreshPreview(): Promise<void> {
    if (!this.form.name.trim() || !this.form.title.trim() || !this.form.sections.length) return;
    this.previewing.set(true);
    try {
      const response = await firstValueFrom(this.api.preview({ template: this.templatePayload() }));
      this.preview.set(response.rendered);
    } catch (error) {
      console.error(error);
    } finally {
      this.previewing.set(false);
    }
  }

  async saveTemplate(): Promise<void> {
    if (!this.form.name.trim() || !this.form.title.trim() || !this.form.signatureStatement.trim()) {
      this.toast.error('Template name, agreement title, and signature statement are required.');
      return;
    }
    if (this.form.sections.some((section) => !section.title.trim())) {
      this.toast.error('Every agreement section needs a title.');
      return;
    }
    this.savingTemplate.set(true);
    try {
      const payload = this.templatePayload();
      const saved = this.editingId
        ? await firstValueFrom(this.api.updateTemplate(this.editingId, payload))
        : await firstValueFrom(this.api.createTemplate(payload));
      this.toast.success(this.editingId ? `Agreement saved as version ${saved.version}.` : 'Agreement template created.');
      this.closeEditor();
      const response = await firstValueFrom(this.api.listTemplates(true));
      this.templates.set(response.data ?? []);
    } catch (error: any) {
      this.toast.error(error?.error?.message || 'Agreement template could not be saved.');
    } finally {
      this.savingTemplate.set(false);
    }
  }

  async duplicate(template: BusinessAgreementTemplate): Promise<void> {
    if (!this.canWrite) return;
    try {
      const copy = await firstValueFrom(this.api.duplicateTemplate(template.id));
      this.toast.success('Agreement duplicated.');
      const response = await firstValueFrom(this.api.listTemplates(true));
      this.templates.set(response.data ?? []);
      this.openEditor(copy);
    } catch (error: any) {
      this.toast.error(error?.error?.message || 'Agreement could not be duplicated.');
    }
  }

  async toggleTemplate(template: BusinessAgreementTemplate): Promise<void> {
    if (!this.canWrite || template.isBuiltin) return;
    try {
      const saved = await firstValueFrom(this.api.updateTemplate(template.id, {
        name: template.name,
        description: template.description,
        title: template.title,
        introduction: template.introduction,
        sections: template.sections,
        signatureStatement: template.signatureStatement,
        isActive: !template.isActive,
      }));
      this.templates.update((rows) => rows.map((row) => row.id === saved.id ? saved : row));
      this.toast.success(saved.isActive ? 'Agreement activated.' : 'Agreement deactivated.');
    } catch (error: any) {
      this.toast.error(error?.error?.message || 'Agreement status could not be changed.');
    }
  }

  private templatePayload(): BusinessAgreementTemplateInput {
    return {
      name: this.form.name.trim(),
      description: this.form.description.trim() || null,
      title: this.form.title.trim(),
      introduction: this.form.introduction,
      sections: this.form.sections.map((section) => ({ id: section.id, title: section.title.trim(), body: section.body })),
      signatureStatement: this.form.signatureStatement.trim(),
      isActive: this.form.isActive,
    };
  }

  private blankTemplate(): BusinessAgreementTemplateInput & { description: string; introduction: string } {
    return {
      name: '',
      description: '',
      title: 'Business Service Agreement',
      introduction: 'This agreement is between {{shop_name}} and {{legal_name}} for the {{plan_name}} plan.',
      sections: [
        { id: cryptoRandom(), title: 'Services and pricing', body: 'Plan: {{plan_name}}\nRecurring service: {{recurring_fee}}\nPayment terms: {{billing_terms}}' },
        { id: cryptoRandom(), title: 'Agreement term', body: 'This agreement begins {{effective_date}} and has a term of {{contract_term}}.' },
      ],
      signatureStatement: 'I am authorized to sign for {{business_name}} and agree to the terms above.',
      isActive: true,
    };
  }
}

type AgreementEditorStep = 'details' | 'terms' | 'acceptance' | 'preview';

function cryptoRandom(): string {
  try { return globalThis.crypto?.randomUUID?.() ?? `section-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }
  catch { return `section-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }
}
