import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { AppConfigService } from '../app-config/app-config.service';
import type {
  CrmActivity,
  CrmActivityInput,
  CrmCompanyCreateInput,
  CrmCompanyDetail,
  CrmCompanyPatchInput,
  CrmCompanyStatus,
  CrmCompanySummary,
  CrmContact,
  CrmContactInput,
  CrmOpportunity,
  CrmOpportunityInput,
  CrmOwner,
  CrmOverview,
  CrmPipelineStage, CrmAttachment, CrmProposal, CrmProposalLine, CrmRepGoal, CrmInsights,
} from './model';

@Injectable({ providedIn: 'root' })
export class CrmService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(AppConfigService);

  private get baseUrl(): string {
    return `${this.config.config.apiBase}/crm`;
  }

  overview(): Observable<CrmOverview> {
    return this.http.get<CrmOverview>(`${this.baseUrl}/overview`);
  }

  owners(): Observable<CrmOwner[]> {
    return this.http.get<CrmOwner[]>(`${this.baseUrl}/owners`);
  }

  companies(input: { search?: string; status?: CrmCompanyStatus | ''; ownerUserId?: string; limit?: number } = {}): Observable<{ data: CrmCompanySummary[] }> {
    let params = new HttpParams().set('limit', String(input.limit ?? 100));
    if (input.search?.trim()) params = params.set('search', input.search.trim());
    if (input.status) params = params.set('status', input.status);
    if (input.ownerUserId) params = params.set('ownerUserId', input.ownerUserId);
    return this.http.get<{ data: CrmCompanySummary[] }>(`${this.baseUrl}/companies`, { params });
  }

  company(id: string): Observable<CrmCompanyDetail> {
    return this.http.get<CrmCompanyDetail>(`${this.baseUrl}/companies/${encodeURIComponent(id)}`);
  }

  createCompany(input: CrmCompanyCreateInput): Observable<CrmCompanyDetail> {
    return this.http.post<CrmCompanyDetail>(`${this.baseUrl}/companies`, input);
  }

  updateCompany(id: string, input: CrmCompanyPatchInput): Observable<CrmCompanySummary> {
    return this.http.patch<CrmCompanySummary>(`${this.baseUrl}/companies/${encodeURIComponent(id)}`, input);
  }

  addContact(companyId: string, input: CrmContactInput): Observable<CrmContact> {
    return this.http.post<CrmContact>(`${this.baseUrl}/companies/${encodeURIComponent(companyId)}/contacts`, input);
  }

  updateContact(companyId: string, contactId: string, input: Partial<CrmContactInput>): Observable<CrmContact> {
    return this.http.patch<CrmContact>(`${this.baseUrl}/companies/${encodeURIComponent(companyId)}/contacts/${encodeURIComponent(contactId)}`, input);
  }

  addOpportunity(companyId: string, input: CrmOpportunityInput): Observable<CrmOpportunity> {
    return this.http.post<CrmOpportunity>(`${this.baseUrl}/companies/${encodeURIComponent(companyId)}/opportunities`, input);
  }

  updateOpportunity(companyId: string, opportunityId: string, input: Partial<CrmOpportunityInput>): Observable<CrmOpportunity> {
    return this.http.patch<CrmOpportunity>(`${this.baseUrl}/companies/${encodeURIComponent(companyId)}/opportunities/${encodeURIComponent(opportunityId)}`, input);
  }

  addActivity(companyId: string, input: CrmActivityInput): Observable<CrmActivity> {
    return this.http.post<CrmActivity>(`${this.baseUrl}/companies/${encodeURIComponent(companyId)}/activities`, input);
  }

  updateActivity(companyId: string, activityId: string, input: Partial<CrmActivityInput>): Observable<CrmActivity> {
    return this.http.patch<CrmActivity>(`${this.baseUrl}/companies/${encodeURIComponent(companyId)}/activities/${encodeURIComponent(activityId)}`, input);
  }

  stages(): Observable<{ data: CrmPipelineStage[] }> { return this.http.get<{data:CrmPipelineStage[]}>(`${this.baseUrl}/settings/stages`); }
  createStage(input: Partial<CrmPipelineStage>): Observable<CrmPipelineStage> { return this.http.post<CrmPipelineStage>(`${this.baseUrl}/settings/stages`, input); }
  updateStage(id:string,input:Partial<CrmPipelineStage>):Observable<CrmPipelineStage>{ return this.http.patch<CrmPipelineStage>(`${this.baseUrl}/settings/stages/${encodeURIComponent(id)}`,input); }
  deleteStage(id:string):Observable<{ok:boolean}>{ return this.http.delete<{ok:boolean}>(`${this.baseUrl}/settings/stages/${encodeURIComponent(id)}`); }
  importCompanies(rows:any[]):Observable<{created:number;failed:number;errors:any[]}>{ return this.http.post<any>(`${this.baseUrl}/companies/import`,{rows}); }
  attachments(companyId:string):Observable<{data:CrmAttachment[]}>{ return this.http.get<{data:CrmAttachment[]}>(`${this.baseUrl}/companies/${encodeURIComponent(companyId)}/attachments`); }
  attachmentInit(companyId:string,input:any):Observable<any>{ return this.http.post(`${this.baseUrl}/companies/${encodeURIComponent(companyId)}/attachments/init`,input); }
  attachmentComplete(companyId:string,input:any):Observable<CrmAttachment>{ return this.http.post<CrmAttachment>(`${this.baseUrl}/companies/${encodeURIComponent(companyId)}/attachments/complete`,input); }
  deleteAttachment(companyId:string,id:string):Observable<{ok:boolean}>{ return this.http.delete<{ok:boolean}>(`${this.baseUrl}/companies/${encodeURIComponent(companyId)}/attachments/${encodeURIComponent(id)}`); }
  proposals(companyId:string):Observable<{data:CrmProposal[]}>{ return this.http.get<{data:CrmProposal[]}>(`${this.baseUrl}/companies/${encodeURIComponent(companyId)}/proposals`); }
  createProposal(companyId:string,input:any):Observable<CrmProposal>{ return this.http.post<CrmProposal>(`${this.baseUrl}/companies/${encodeURIComponent(companyId)}/proposals`,input); }
  updateProposal(companyId:string,id:string,input:any):Observable<CrmProposal>{ return this.http.patch<CrmProposal>(`${this.baseUrl}/companies/${encodeURIComponent(companyId)}/proposals/${encodeURIComponent(id)}`,input); }
  goals(period:string):Observable<{data:CrmRepGoal[]}>{ return this.http.get<{data:CrmRepGoal[]}>(`${this.baseUrl}/goals`,{params:new HttpParams().set('period',period)}); }
  saveGoal(userId:string,input:any):Observable<CrmRepGoal>{ return this.http.put<CrmRepGoal>(`${this.baseUrl}/goals/${encodeURIComponent(userId)}`,input); }
  insights(period:string):Observable<CrmInsights>{ return this.http.get<CrmInsights>(`${this.baseUrl}/insights`,{params:new HttpParams().set('period',period)}); }

  convert(companyId: string): Observable<{ crmCompanyId: string; businessAccountId: string; customerId: string }> {
    return this.http.post<{ crmCompanyId: string; businessAccountId: string; customerId: string }>(
      `${this.baseUrl}/companies/${encodeURIComponent(companyId)}/convert`,
      {},
    );
  }
}
