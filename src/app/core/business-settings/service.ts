import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { AppConfigService } from '../app-config/app-config.service';
import type {
  BusinessAgreementTemplate,
  BusinessAgreementTemplateInput,
  BusinessAgreementVariable,
  BusinessFeatureSettings,
  BusinessFeatureState,
  BusinessPlanAgreementBinding,
  RenderedBusinessAgreement,
} from './model';

@Injectable({ providedIn: 'root' })
export class BusinessSettingsService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(AppConfigService);

  private get base(): string { return `${this.config.config.apiBase}/business-settings`; }

  getFeatures() {
    return this.http.get<BusinessFeatureState>(`${this.base}/features`);
  }

  updateFeatures(payload: Partial<BusinessFeatureSettings>) {
    return this.http.patch<BusinessFeatureState>(`${this.base}/features`, payload);
  }

  listVariables() {
    return this.http.get<{ data: BusinessAgreementVariable[] }>(`${this.base}/agreement-variables`);
  }

  listTemplates(includeInactive = true) {
    const params = new HttpParams().set('includeInactive', String(includeInactive));
    return this.http.get<{ data: BusinessAgreementTemplate[] }>(`${this.base}/agreement-templates`, { params });
  }

  createTemplate(payload: BusinessAgreementTemplateInput) {
    return this.http.post<BusinessAgreementTemplate>(`${this.base}/agreement-templates`, payload);
  }

  updateTemplate(id: string, payload: BusinessAgreementTemplateInput) {
    return this.http.patch<BusinessAgreementTemplate>(`${this.base}/agreement-templates/${encodeURIComponent(id)}`, payload);
  }

  duplicateTemplate(id: string, name?: string | null) {
    return this.http.post<BusinessAgreementTemplate>(`${this.base}/agreement-templates/${encodeURIComponent(id)}/duplicate`, { name: name ?? null });
  }

  listPlanBindings() {
    return this.http.get<{ data: BusinessPlanAgreementBinding[] }>(`${this.base}/plan-bindings`);
  }

  setPlanBinding(planId: string, templateId: string | null) {
    return this.http.put<BusinessPlanAgreementBinding>(`${this.base}/plan-bindings/${encodeURIComponent(planId)}`, { templateId });
  }

  preview(payload: { template?: BusinessAgreementTemplateInput; templateId?: string | null; planId?: string | null; businessAccountId?: string | null }) {
    return this.http.post<{ rendered: RenderedBusinessAgreement; snapshot: Record<string, unknown> }>(`${this.base}/agreement-preview`, payload);
  }
}
