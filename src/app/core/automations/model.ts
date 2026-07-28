export type AutomationRuleStatus = 'draft' | 'active' | 'paused' | 'archived';

export type AutomationTriggerType =
  | 'repair_created'
  | 'repair_status_changed'
  | 'quote_created'
  | 'quote_status_changed'
  | 'appointment_scheduled'
  | 'appointment_status_changed'
  | 'appointment_approaching'
  | 'payment_received'
  | 'order_fulfilled'
  | 'order_balance_due'
  | 'inventory_low'
  | 'customer_created'
  | 'work_queue_overdue'
  | 'repair_status_stale'
  | 'form_submitted';

export type AutomationActionType =
  | 'send_email'
  | 'send_sms'
  | 'internal_notification'
  | 'create_work_queue'
  | 'add_repair_note'
  | 'assign_repair'
  | 'change_repair_status'
  | 'send_portal_link'
  | 'assign_form'
  | 'webhook';

export type AutomationConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'greater_than'
  | 'greater_than_or_equal'
  | 'less_than'
  | 'less_than_or_equal'
  | 'is_empty'
  | 'is_not_empty'
  | 'in'
  | 'not_in'
  | 'is_true'
  | 'is_false';

export interface AutomationCondition {
  field: string;
  operator: AutomationConditionOperator;
  value?: any;
}

export interface AutomationAction {
  id: string;
  ruleId: string;
  type: AutomationActionType;
  label: string | null;
  config: Record<string, any> | null;
  delayMinutes: number;
  cancelIfChanged: boolean;
  sortOrder: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AutomationActionDraft {
  id?: string;
  type: AutomationActionType;
  label?: string | null;
  config: Record<string, any>;
  delayMinutes: number;
  cancelIfChanged: boolean;
  sortOrder: number;
  enabled: boolean;
}

export interface AutomationRule {
  id: string;
  shopId: string;
  name: string;
  description: string | null;
  status: AutomationRuleStatus;
  triggerType: AutomationTriggerType;
  triggerConfig: Record<string, any> | null;
  conditionMode: 'all' | 'any';
  conditions: AutomationCondition[] | null;
  runOncePerSource: boolean;
  cooldownMinutes: number | null;
  quietHoursEnabled: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  testMode: boolean;
  consecutiveFailures: number;
  failureThreshold: number;
  disabledReason: string | null;
  lastTriggeredAt: string | null;
  lastSucceededAt: string | null;
  lastFailedAt: string | null;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  actions: AutomationAction[];
  executionCount?: number;
  successCount?: number;
  failureCount?: number;
}

export interface AutomationRulePayload {
  name: string;
  description?: string | null;
  status: AutomationRuleStatus;
  triggerType: AutomationTriggerType;
  triggerConfig: Record<string, any>;
  conditionMode: 'all' | 'any';
  conditions: AutomationCondition[];
  runOncePerSource: boolean;
  cooldownMinutes?: number | null;
  quietHoursEnabled: boolean;
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
  testMode: boolean;
  failureThreshold: number;
  actions: AutomationActionDraft[];
}

export interface AutomationTemplate {
  key: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  rule: AutomationRulePayload;
}

export interface AutomationUser {
  id: string;
  name: string;
  email: string | null;
  role: string;
}

export interface AutomationFormTemplate {
  id: string;
  name: string;
  audience: 'staff' | 'customer' | 'both';
  category: string;
  starterKey: string | null;
}

export interface AutomationSummary {
  active: number;
  paused: number;
  draft: number;
  runsToday: number;
  failuresToday: number;
  pendingActions: number;
}

export interface AutomationBootstrapResponse {
  data: {
    rules: AutomationRule[];
    templates: AutomationTemplate[];
    users: AutomationUser[];
    formTemplates: AutomationFormTemplate[];
    summary: AutomationSummary;
  };
}

export interface AutomationRuleResponse {
  data: AutomationRule;
}

export interface AutomationExecution {
  id: string;
  shopId: string;
  ruleId: string;
  ruleName: string | null;
  eventKey: string;
  triggerType: AutomationTriggerType;
  sourceType: string;
  sourceId: string;
  status: string;
  testMode: boolean;
  triggerPayload: Record<string, unknown> | null;
  conditionResults: Record<string, unknown> | null;
  actionResults: Array<Record<string, unknown>> | null;
  errorMessage: string | null;
  startedAt: string;
  finishedAt: string | null;
  createdAt: string;
}

export interface AutomationExecutionListResponse {
  data: AutomationExecution[];
  nextCursor: string | null;
}

export interface AutomationExecutionResponse {
  data: AutomationExecution;
}
