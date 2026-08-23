export interface BusinessFeatureSettings {
  businessAccountsEnabled: boolean;
  fleetManagementEnabled: boolean;
  defaultAgreementTemplateId: string | null;
}

export interface BusinessFeatureBlockers {
  activeFleetAgreements: number;
  activeBusinessContracts: number;
  canDisableFleet: boolean;
  canDisableBusinessAccounts: boolean;
}

export interface BusinessFeatureState {
  settings: BusinessFeatureSettings;
  blockers: BusinessFeatureBlockers;
}

export interface BusinessAgreementSection {
  id: string;
  title: string;
  body: string;
}

export interface BusinessAgreementTemplate {
  id: string;
  name: string;
  description: string | null;
  title: string;
  introduction: string;
  sections: BusinessAgreementSection[];
  signatureStatement: string;
  isActive: boolean;
  isBuiltin: boolean;
  version: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface BusinessAgreementVariable {
  key: string;
  label: string;
  example: string;
}

export interface BusinessPlanAgreementBinding {
  planId: string;
  templateId: string | null;
  updatedAt: string | null;
}

export interface BusinessAgreementTemplateInput {
  name: string;
  description?: string | null;
  title: string;
  introduction?: string | null;
  sections: BusinessAgreementSection[];
  signatureStatement: string;
  isActive?: boolean;
}

export interface RenderedBusinessAgreement {
  templateId: string;
  templateVersion: number;
  templateName: string;
  title: string;
  introduction: string;
  sections: BusinessAgreementSection[];
  signatureStatement: string;
}
