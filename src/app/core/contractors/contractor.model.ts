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
  serviceIds: string[];
}

export interface UpdateContractorRequest {
  tier?: ContractorTier;
  isActive?: boolean;
}

export interface AddContractorCapabilityRequest {
  serviceId: string;
}