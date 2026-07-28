export type KnowledgeArticleStatus = 'draft' | 'published' | 'archived';
export type KnowledgeVisibility = 'internal' | 'customer_portal' | 'public';

export interface KnowledgeCategory {
  id: string;
  shopId: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  articleCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeAttachment {
  id: string;
  articleId: string;
  filename: string;
  mimeType: string | null;
  sizeBytes: number | null;
  createdByUserId: string | null;
  createdAt: string;
}

export interface KnowledgeServiceLink {
  id: string;
  name: string;
  code: string | null;
}

export interface KnowledgeDeviceModelLink {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  releaseYear: number | null;
}

export interface KnowledgeArticle {
  id: string;
  shopId: string;
  categoryId: string | null;
  title: string;
  slug: string;
  summary: string | null;
  body: string;
  status: KnowledgeArticleStatus;
  visibility: KnowledgeVisibility;
  tags: string[];
  pinned: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdByUserId: string | null;
  updatedByUserId: string | null;
  createdByUser: { id: string; name: string } | null;
  updatedByUser: { id: string; name: string } | null;
  category: KnowledgeCategory | null;
  attachments: KnowledgeAttachment[];
  services: KnowledgeServiceLink[];
  deviceModels: KnowledgeDeviceModelLink[];
  repairIds: string[];
  workQueueItemIds: string[];
}

export interface KnowledgeServiceOption {
  id: string;
  name: string;
  code: string | null;
}

export interface KnowledgeDeviceModelOption {
  id: string;
  name: string;
  brand: string;
  category: string;
  releaseYear: number | null;
}

export interface KnowledgeBootstrapResponse {
  categories: KnowledgeCategory[];
  services: KnowledgeServiceOption[];
  deviceModels: KnowledgeDeviceModelOption[];
}

export interface KnowledgeArticlePayload {
  title: string;
  summary: string | null;
  body: string;
  categoryId: string | null;
  status: KnowledgeArticleStatus;
  visibility: KnowledgeVisibility;
  tags: string[];
  pinned: boolean;
  serviceIds: string[];
  deviceModelIds: string[];
  repairId?: string | null;
  workQueueItemId?: string | null;
}

export interface KnowledgeContext {
  type: 'repair' | 'work_queue';
  id: string;
  title: string;
  subtitle: string | null;
  route: string;
  repairId: string | null;
}

export interface KnowledgeContextResponse {
  context: KnowledgeContext;
  repair: {
    id: string;
    status: string;
    problemSummary: string;
    service: { id: string; name: string } | null;
    customer: { id: string; name: string } | null;
    device: {
      id: string;
      displayName: string;
      nickname: string | null;
      brand: string | null;
      model: string | null;
      catalogRef: string | null;
    } | null;
  } | null;
  linkedArticles: KnowledgeArticle[];
  suggestedArticles: KnowledgeArticle[];
}
