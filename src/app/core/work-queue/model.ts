
export type WorkQueuePriority = 'low' | 'normal' | 'high' | 'urgent';

export type WorkQueueStatus =
  | 'open'
  | 'in_progress'
  | 'snoozed'
  | 'completed'
  | 'dismissed'
  | 'resolved';

export type WorkQueueSourceType =
  | 'manual'
  | 'repair'
  | 'quote'
  | 'order'
  | 'appointment'
  | 'communication';

export interface WorkQueueAssignee {
  id: string;
  name: string;
  email: string | null;
  role: string;
}

export interface WorkQueueItem {
  id: string;
  shopId: string;
  sourceType: WorkQueueSourceType;
  sourceKey: string;
  sourceId: string | null;
  automatic: boolean;
  kind: string;
  category: string;
  title: string;
  description: string | null;
  priority: WorkQueuePriority;
  status: WorkQueueStatus;
  customerId: string | null;
  customerName: string | null;
  route: string | null;
  metadata: Record<string, unknown> | null;
  assignedToUserId: string | null;
  assignedTo: WorkQueueAssignee | null;
  createdByUserId: string | null;
  dueAt: string | null;
  snoozedUntil: string | null;
  sourceUpdatedAt: string | null;
  lastSeenAt: string | null;
  resolvedAt: string | null;
  resolvedByUserId: string | null;
  resolutionNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkQueueListResponse {
  data: WorkQueueItem[];
  nextCursor: string | null;
}

export interface WorkQueueSummaryCounts {
  open: number;
  urgent: number;
  overdue: number;
  dueToday: number;
  unassigned: number;
  snoozed: number;
  attention: number;
}

export interface WorkQueueSummary {
  counts: WorkQueueSummaryCounts;
  preview: WorkQueueItem[];
  generatedAt: string;
}

export interface WorkQueueSummaryResponse {
  data: WorkQueueSummary;
}

export interface WorkQueueAssigneeListResponse {
  data: WorkQueueAssignee[];
}

export interface WorkQueueListParams {
  limit?: number;
  cursor?: string | null;
  status?:
    | 'active'
    | 'open'
    | 'in_progress'
    | 'snoozed'
    | 'completed'
    | 'dismissed'
    | 'resolved'
    | 'closed'
    | 'all';
  priority?: WorkQueuePriority;
  sourceType?: WorkQueueSourceType;
  assignedToUserId?: string;
  due?: 'overdue' | 'today';
  q?: string;
}

export interface CreateWorkQueueItemPayload {
  title: string;
  description?: string | null;
  category?: string;
  priority?: WorkQueuePriority;
  assignedToUserId?: string | null;
  dueAt?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  route?: string | null;
}

export interface PatchWorkQueueItemPayload {
  title?: string;
  description?: string | null;
  category?: string;
  priority?: WorkQueuePriority;
  assignedToUserId?: string | null;
  dueAt?: string | null;
  status?: 'open' | 'in_progress';
  customerId?: string | null;
  customerName?: string | null;
  route?: string | null;
}

export interface ResolveWorkQueueItemPayload {
  resolutionNote?: string | null;
}
