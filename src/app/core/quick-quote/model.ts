export interface QuickQuoteSettings {
  enabled: boolean;
  autoRememberApprovedMatches: boolean;
  autoCreatePricingTemplates: boolean;
  rememberedTemplatePublic: boolean;
  minimumMatchScore: number;
  minimumScoreMargin: number;
  rememberedMatchCount: number;
}

export interface QuickQuoteCandidate {
  supplierProvider: 'mobilesentrix';
  supplierSku: string | null;
  supplierProductId: string | null;
  supplierName: string;
  supplierUrl: string | null;
  costCents: number | null;
  inStock: boolean | null;
  availableQty: number | null;
  score: number;
  matchedPreferredTerms: string[];
  matchedRequiredTerms: string[];
  reasons: string[];
}

export interface QuickQuotePreview {
  source: 'template' | 'remembered' | 'supplier' | 'none';
  confidence: 'approved' | 'high' | 'review' | 'no_match';
  device: {
    id: string;
    name: string;
    brandName: string;
    categoryName: string;
  };
  repairNeed: {
    id: string;
    label: string;
    code: string;
  };
  pricingTemplateId: string | null;
  variantName: string | null;
  matchedPart: QuickQuoteCandidate | null;
  candidates: QuickQuoteCandidate[];
  partCostCents: number | null;
  laborCents: number | null;
  estimatedTotalCents: number | null;
  depositAmountCents: number | null;
  depositRequired: boolean;
  depositConfigurationError: 'missing_product_cost' | 'missing_custom_amount' | null;
  canStartRepair: boolean;
  shouldRemember: boolean;
  warning: string | null;
}

export interface QuickQuoteRememberResponse {
  pricingTemplateId: string;
  memoryId: string;
}
