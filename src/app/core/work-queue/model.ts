
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
  timerStartedAt: string | null;
  timerAccumulatedSeconds: number;
  timerStartedByUserId: string | null;
  timerStartedBy: WorkQueueAssignee | null;
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


export interface WorkQueueHistoryEntry {
  id: string;
  shopId: string;
  workQueueItemId: string;
  sourceKey: string;
  sourceType: WorkQueueSourceType;
  sourceId: string | null;
  automatic: boolean;
  kind: string;
  category: string;
  title: string;
  priority: WorkQueuePriority;
  outcome: WorkQueueStatus;
  customerId: string | null;
  customerName: string | null;
  route: string | null;
  assignedToUserId: string | null;
  assignedToName: string | null;
  dueAt: string | null;
  closedAt: string;
  elapsedSeconds: number;
  wasLate: boolean | null;
  resolutionNote: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export type WorkQueueReportRange = '7d' | '30d' | '90d' | '365d';

export interface WorkQueueReportDailyPoint {
  date: string;
  closed: number;
  completed: number;
  late: number;
}

export interface WorkQueueReportWorkloadRow {
  assigneeId: string | null;
  assigneeName: string;
  active: number;
  overdue: number;
  closed: number;
  trackedSeconds: number;
}

export interface WorkQueueReportSourceRow {
  sourceType: WorkQueueSourceType;
  active: number;
  closed: number;
}

export interface WorkQueueReportTotals {
  active: number;
  overdueActive: number;
  closed: number;
  completed: number;
  dismissed: number;
  autoResolved: number;
  dueDatedClosed: number;
  completedOnTime: number;
  completedLate: number;
  onTimeRate: number;
  trackedItems: number;
  totalTrackedSeconds: number;
  averageTrackedSeconds: number;
}

export interface WorkQueueReport {
  range: {
    key: WorkQueueReportRange;
    days: number;
    startAt: string;
    endAt: string;
  };
  totals: WorkQueueReportTotals;
  daily: WorkQueueReportDailyPoint[];
  workload: WorkQueueReportWorkloadRow[];
  sources: WorkQueueReportSourceRow[];
  recent: WorkQueueHistoryEntry[];
  generatedAt: string;
}

export interface WorkQueueReportResponse {
  data: WorkQueueReport;
}
