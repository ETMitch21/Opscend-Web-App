import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AppConfigService } from '../app-config/app-config.service';
import type { BusinessBillingOverview, BusinessEnrollmentBillingChangePolicy, BusinessEnrollmentPaymentSetupMethod, BusinessPlan, BusinessPlanEnrollment, BusinessPlanInput } from './model';

@Injectable({ providedIn: 'root' })
export class BusinessPlansService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(AppConfigService);
  private get plansUrl() { return `${this.config.config.apiBase}/business-plans`; }
  private accountsUrl(id: string) { return `${this.config.config.apiBase}/business-accounts/${encodeURIComponent(id)}`; }

  list(): Observable<{ data: BusinessPlan[] }> { return this.http.get<{ data: BusinessPlan[] }>(this.plansUrl); }
  create(payload: BusinessPlanInput): Observable<BusinessPlan> { return this.http.post<BusinessPlan>(this.plansUrl, payload); }
  update(id: string, payload: Partial<BusinessPlanInput>): Observable<BusinessPlan> { return this.http.patch<BusinessPlan>(`${this.plansUrl}/${encodeURIComponent(id)}`, payload); }
  billing(accountId: string): Observable<BusinessBillingOverview> { return this.http.get<BusinessBillingOverview>(`${this.accountsUrl(accountId)}/billing`); }
  enroll(accountId: string, payload: { planId: string; billingManagedByStripe: boolean; billingChangePolicy: BusinessEnrollmentBillingChangePolicy; paymentSetupMethod?: BusinessEnrollmentPaymentSetupMethod; paymentSetupContactId?: string | null; startsAt?: string | null; contractTermMonths?: number | null }): Observable<{ enrollment: BusinessPlanEnrollment; checkoutUrl: string | null }> {
    return this.http.post<{ enrollment: BusinessPlanEnrollment; checkoutUrl: string | null }>(`${this.accountsUrl(accountId)}/enrollments`, payload);
  }
  resendSetupEmail(accountId: string): Observable<BusinessPlanEnrollment> { return this.http.post<BusinessPlanEnrollment>(`${this.accountsUrl(accountId)}/billing/setup-email/resend`, {}); }
  portal(accountId: string): Observable<{ url: string }> { return this.http.post<{ url: string }>(`${this.accountsUrl(accountId)}/billing/portal`, {}); }
  applyDeviceCount(accountId: string): Observable<BusinessPlanEnrollment> { return this.http.post<BusinessPlanEnrollment>(`${this.accountsUrl(accountId)}/billing/apply-device-count`, {}); }
  cancel(accountId: string): Observable<BusinessPlanEnrollment> { return this.http.post<BusinessPlanEnrollment>(`${this.accountsUrl(accountId)}/billing/cancel`, {}); }
  resume(accountId: string): Observable<BusinessPlanEnrollment> { return this.http.post<BusinessPlanEnrollment>(`${this.accountsUrl(accountId)}/billing/resume`, {}); }
}
