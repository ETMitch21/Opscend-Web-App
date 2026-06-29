export type ContractorTier = 'starter' | 'pro' | 'diamond';

export interface ContractorUserSummary {
  id: string;
  name: string;
  email: string;
}

export interface ContractorShopSummary {
  id: string;
  name: string;
  slug?: string | null;
}

export interface ContractorCapability {
  id: string;
  serviceId: string;
  serviceName: string;
}

export interface ContractorProfile {
  id: string;
  userId: string;
  shopId: string;

  isActive: boolean;
  tier: ContractorTier;

  user: ContractorUserSummary;
  shop?: ContractorShopSummary | null;

  capabilities: ContractorCapability[];

  availableForJobs: boolean;

status: ContractorStatus;
agreementStatus: ContractorAgreementStatus;
backgroundStatus: ContractorBackgroundStatus;
payoutStatus: ContractorPayoutStatus;

approvedAt: string | null;
suspendedAt: string | null;
suspensionReason: string | null;

  createdAt: string;
  updatedAt: string;
}

export type ContractorListResponse = ContractorProfile[];

export interface ContractorListQuery {
  limit?: number;
  cursor?: string | null;
  search?: string;
  isActive?: boolean;
  tier?: ContractorTier;
}

export interface CreateContractorWithUserRequest {
  name: string;
  email: string;
  password: string;
  tier: ContractorTier;
  isActive: boolean;
  availableForJobs: boolean;
  serviceIds: string[];
}

export interface UpdateContractorRequest {
  tier?: ContractorTier;
  isActive?: boolean;
}

export interface AddContractorCapabilityRequest {
  serviceId: string;
}

export type ContractorStanding =
  | 'good'
  | 'warning'
  | 'probation'
  | 'review';

export interface ContractorMetrics {
  contractorId: string;

  acceptedJobs: number;
  completedJobs: number;
  declinedJobs: number;
  canceledJobs: number;
  noShows: number;

  cancellationRate: number;
  noShowRate: number;

  pendingPayoutCents: number;
  approvedPayoutCents: number;
  paidPayoutCents: number;

  standing: ContractorStanding;
}

export type ContractorStatus =
  | 'invited'
  | 'onboarding'
  | 'active'
  | 'suspended'
  | 'rejected'
  | 'offboarded';

export type ContractorAgreementStatus =
  | 'not_required'
  | 'pending'
  | 'accepted'
  | 'expired';

export type ContractorBackgroundStatus =
  | 'not_required'
  | 'pending'
  | 'clear'
  | 'review'
  | 'failed'
  | 'expired';

export type ContractorPayoutStatus =
  | 'not_started'
  | 'onboarding_required'
  | 'pending_verification'
  | 'enabled'
  | 'restricted'
  | 'disabled';

export interface ContractorOnboarding {
  contractorId: string;

  isActive: boolean;
  availableForJobs: boolean;

  status: ContractorStatus;
  agreementStatus: ContractorAgreementStatus;
  backgroundStatus: ContractorBackgroundStatus;
  payoutStatus: ContractorPayoutStatus;

  approvedAt: string | null;
  suspendedAt: string | null;
  suspensionReason: string | null;

  blockers: string[];
  canActivate: boolean;
}

export interface UpdateContractorOnboardingStatusRequest {
  status?: ContractorStatus;
  agreementStatus?: ContractorAgreementStatus;
  backgroundStatus?: ContractorBackgroundStatus;
  payoutStatus?: ContractorPayoutStatus;
  isActive?: boolean;
  availableForJobs?: boolean;
  suspensionReason?: string | null;
}