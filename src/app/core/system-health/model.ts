export type SystemHealthSeverity = 'critical' | 'warning';
export type SystemHealthCategoryKey = 'financial' | 'inventory' | 'relationships' | 'automations';

export interface SystemHealthAction {
  key:
    | 'void-order'
    | 'recalculate-order-balance'
    | 'release-order-reservations'
    | 'retry-stuck-automation-action';
  label: string;
  description: string;
  requiredPermission: string;
  destructive: boolean;
  confirmation: string;
}

export interface SystemHealthIssue {
  id: string;
  code: string;
  category: SystemHealthCategoryKey;
  severity: SystemHealthSeverity;
  title: string;
  summary: string;
  entityType: 'order' | 'repair' | 'inventory' | 'automation';
  entityId: string;
  entityLabel: string;
  route: string | null;
  details: Array<{
    label: string;
    value: string;
  }>;
  action: SystemHealthAction | null;
}

export interface SystemHealthCategory {
  key: SystemHealthCategoryKey;
  label: string;
  issueCount: number;
  criticalCount: number;
  warningCount: number;
}

export interface SystemHealthReport {
  generatedAt: string;
  status: 'healthy' | 'attention' | 'critical';
  summary: {
    total: number;
    critical: number;
    warning: number;
  };
  categories: SystemHealthCategory[];
  issues: SystemHealthIssue[];
}

export interface SystemHealthActionResponse {
  ok: true;
  message: string;
}
