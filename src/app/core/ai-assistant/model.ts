import type { RepairStatus } from '../repairs/repair.model';
import type { WorkQueuePriority } from '../work-queue/model';
import type { SearchItemType } from '../search/search-service';

export type AiContextRef = {
  type: SearchItemType;
  id: string;
  title?: string | null;
  route?: string | null;
};

export type AiSource = {
  type: string;
  id: string;
  title: string;
  route: string | null;
  excerpt: string | null;
};

export type AiActionType =
  | 'create_work_queue_item'
  | 'update_repair_status'
  | 'draft_customer_message'
  | 'open_record';

export type AiActionStatus = 'pending' | 'completed' | 'dismissed' | 'failed';

export type AiActionPayload = {
  repairId?: string | null;
  status?: RepairStatus | null;
  title?: string | null;
  description?: string | null;
  priority?: WorkQueuePriority | null;
  assignedToUserId?: string | null;
  dueAt?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  route?: string | null;
  channel?: 'sms' | 'email' | null;
  draft?: string | null;
};

export type AiSuggestedAction = {
  id: string;
  type: AiActionType;
  title: string;
  description: string | null;
  payload: AiActionPayload;
  status: AiActionStatus;
  result: Record<string, unknown> | null;
  error: string | null;
  resolvedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type AiMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources: AiSource[];
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  estimatedCostMicros: number | null;
  createdAt: string | null;
  actions: AiSuggestedAction[];
};

export type AiConversationSummary = {
  id: string;
  title: string;
  contextType: string | null;
  contextId: string | null;
  archivedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  messageCount: number;
};

export type AiConversation = AiConversationSummary & {
  messages: AiMessage[];
};

export type AiStatus = {
  configured: boolean;
  model: string;
  dailyRequestLimit: number;
  maxPromptCharacters: number;
  costTrackingConfigured: boolean;
  usageToday: {
    requestCount: number;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    estimatedCostMicros: number;
  };
};

export type AiUsageDay = {
  date: string;
  requestCount: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostMicros: number;
};
