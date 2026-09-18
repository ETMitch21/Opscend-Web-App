export type CrmCompanyStatus = 'prospect' | 'customer' | 'inactive' | 'lost';
export type CrmOpportunityStage = string;
export type CrmActivityType = 'note' | 'call' | 'email' | 'sms' | 'meeting' | 'task';

export interface CrmOwner {
  id: string;
  name: string;
  email: string | null;
  role: string;
}

export interface CrmContact {
  id: string;
  companyId: string;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CrmOpportunity {
  id: string;
  companyId: string;
  companyName?: string;
  title: string;
  stage: CrmOpportunityStage;
  estimatedDeviceCount: number | null;
  monthlyValueCents: number | null;
  oneTimeValueCents: number | null;
  probability: number;
  expectedCloseAt: string | null;
  ownerUserId: string | null;
  owner: CrmOwner | null;
  notes: string | null;
  closeReason: string | null;
  closeReasonNote: string | null;
  closedAt: string | null;
  calculatorSnapshot?: Record<string, unknown> | null;
  lastActivityAt: string | null;
  nextFollowUpAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CrmActivity {
  id: string;
  companyId: string;
  opportunityId: string | null;
  type: CrmActivityType;
  subject: string;
  body: string | null;
  occurredAt: string;
  dueAt: string | null;
  completedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CrmCompanySummary {
  id: string;
  name: string;
  legalName: string | null;
  status: CrmCompanyStatus;
  website: string | null;
  phone: string | null;
  email: string | null;
  industry: string | null;
  employeeCount: number | null;
  estimatedDeviceCount: number | null;
  source: string | null;
  sourceDetail?: string | null;
  renewalAt?: string | null;
  accountHealth?: string | null;
  accountHealthNote?: string | null;
  lastHealthReviewAt?: string | null;
  ownerUserId: string | null;
  owner: CrmOwner | null;
  businessAccountId: string | null;
  lastContactAt: string | null;
  nextFollowUpAt: string | null;
  notes: string | null;
  tags: string[];
  primaryContact: CrmContact | null;
  openOpportunityCount: number;
  openMonthlyValueCents: number;
  openOneTimeValueCents: number;
  createdAt: string;
  updatedAt: string;
}

export interface CrmCompanyDetail extends CrmCompanySummary {
  contacts: CrmContact[];
  opportunities: CrmOpportunity[];
  activities: CrmActivity[];
}

export interface CrmOverview {
  stats: {
    prospects: number;
    openOpportunities: number;
    openMonthlyValueCents: number;
    openOneTimeValueCents: number;
    weightedMonthlyValueCents: number;
    weightedOneTimeValueCents: number;
    followUpsDue: number;
    wonThisMonth: number;
    lostThisMonth: number;
    winRate: number;
  };
  reporting: {
    wonMonthlyValueCents: number;
    wonOneTimeValueCents: number;
    averageWonMonthlyValueCents: number;
    averageWonOneTimeValueCents: number;
    stageBreakdown: Array<{
      stage: CrmOpportunityStage;
      count: number;
      monthlyValueCents: number;
      oneTimeValueCents: number;
      weightedMonthlyValueCents: number;
      weightedOneTimeValueCents: number;
    }>;
    ownerPerformance: Array<{
      ownerUserId: string | null;
      ownerName: string;
      openCount: number;
      wonCount: number;
      lostCount: number;
      weightedMonthlyValueCents: number;
      weightedOneTimeValueCents: number;
      wonMonthlyValueCents: number;
      wonOneTimeValueCents: number;
    }>;
    closeReasonBreakdown: Array<{
      stage: 'won' | 'lost';
      reason: string;
      count: number;
      monthlyValueCents: number;
      oneTimeValueCents: number;
    }>;
  };
  pipeline: CrmOpportunity[];
  companies: CrmCompanySummary[];
}

export interface CrmContactInput {
  name: string;
  title?: string | null;
  email?: string | null;
  phone?: string | null;
  isPrimary?: boolean;
  notes?: string | null;
}

export interface CrmOpportunityInput {
  title: string;
  stage?: CrmOpportunityStage;
  estimatedDeviceCount?: number | null;
  monthlyValueCents?: number | null;
  oneTimeValueCents?: number | null;
  probability?: number;
  expectedCloseAt?: string | null;
  ownerUserId?: string | null;
  notes?: string | null;
  closeReason?: string | null;
  closeReasonNote?: string | null;
  calculatorSnapshot?: Record<string, unknown> | null;
}

export interface CrmCompanyCreateInput {
  name: string;
  legalName?: string | null;
  status?: CrmCompanyStatus;
  website?: string | null;
  phone?: string | null;
  email?: string | null;
  industry?: string | null;
  employeeCount?: number | null;
  estimatedDeviceCount?: number | null;
  source?: string | null;
  sourceDetail?: string | null;
  renewalAt?: string | null;
  accountHealth?: string | null;
  accountHealthNote?: string | null;
  lastHealthReviewAt?: string | null;
  ownerUserId?: string | null;
  notes?: string | null;
  tags?: string[];
  primaryContact?: CrmContactInput;
  initialOpportunity?: CrmOpportunityInput;
}

export type CrmCompanyPatchInput = Partial<Omit<CrmCompanyCreateInput, 'primaryContact' | 'initialOpportunity'>> & {
  lastContactAt?: string | null;
  nextFollowUpAt?: string | null;
};

export interface CrmActivityInput {
  type: CrmActivityType;
  subject: string;
  body?: string | null;
  opportunityId?: string | null;
  occurredAt?: string;
  dueAt?: string | null;
  completedAt?: string | null;
}

export interface CrmPipelineStage { id:string; shopId:string; key:string; label:string; position:number; probability:number; color:string|null; kind:'open'|'won'|'lost'|string; isActive:boolean; }
export interface CrmAttachment { id:string; companyId:string; opportunityId:string|null; filename:string; mimeType:string|null; sizeBytes:number|null; url?:string; createdAt:string; }
export interface CrmProposalLine { id?:string; description:string; quantity:number; unitAmountCents:number; billingType:'one_time'|'monthly'; sortOrder?:number; }
export interface CrmProposal { id:string; companyId:string; opportunityId:string|null; title:string; status:'draft'|'sent'|'accepted'|'declined'|'expired'; validUntil:string|null; intro:string|null; terms:string|null; monthlyTotalCents:number; oneTimeTotalCents:number; acceptedAt:string|null; declinedAt:string|null; createdAt:string; updatedAt:string; lines:CrmProposalLine[]; }
export interface CrmRepGoal { id:string; userId:string; period:string; wonOneTimeGoalCents:number; wonMonthlyGoalCents:number; opportunitiesGoal:number; followUpsGoal:number; user:{id:string;name:string;email:string|null}; }
export interface CrmInsights { period:string; sourcePerformance:Array<{source:string;companies:number;won:number;wonMonthlyValueCents:number;wonOneTimeValueCents:number}>; leaderboard:Array<{userId:string|null;name:string;goal:CrmRepGoal|null;wonCount:number;wonMonthlyValueCents:number;wonOneTimeValueCents:number;followUpsCompleted:number}>; renewals:Array<{id:string;name:string;source:string|null;renewalAt:string|null;accountHealth:string|null;ownerUserId:string|null;owner:{name:string}|null}>; atRisk:Array<{id:string;name:string;accountHealth:string|null}>; }
