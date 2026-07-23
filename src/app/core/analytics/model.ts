export type AnalyticsRange = '7d' | '30d' | '90d' | '365d';
export type AnalyticsTrendDirection = 'up' | 'down' | 'flat';

export interface AnalyticsComparisonMetric {
  current: number;
  previous: number;
  changePercent: number | null;
  direction: AnalyticsTrendDirection;
}

export interface AnalyticsTrendPoint {
  key: string;
  label: string;
  startAt: string;
  endAt: string;
  revenueCents: number;
  repairsCreated: number;
  repairsCompleted: number;
  quotesCreated: number;
}

export interface AnalyticsFinancialBreakdownRow {
  key: string;
  label: string;
  revenueCents: number;
  transactionCount: number;
  percent: number;
}

export interface AnalyticsCountBreakdownRow {
  key: string;
  label: string;
  count: number;
  percent: number;
}

export interface AnalyticsRepairTypeRow {
  key: string;
  label: string;
  repairCount: number;
  completedCount: number;
  revenueCents: number;
}

export interface AnalyticsDeviceRow {
  key: string;
  label: string;
  brand: string | null;
  model: string | null;
  repairCount: number;
  completedCount: number;
  revenueCents: number;
}

export interface AnalyticsOverview {
  range: {
    key: AnalyticsRange;
    days: number;
    startAt: string;
    endAt: string;
    previousStartAt: string;
    previousEndAt: string;
  };
  metrics: {
    netRevenueCents: AnalyticsComparisonMetric;
    completedRepairs: AnalyticsComparisonMetric;
    averageTicketCents: AnalyticsComparisonMetric;
    quoteConversionRate: AnalyticsComparisonMetric;
    averageTurnaroundHours: AnalyticsComparisonMetric;
    newCustomers: AnalyticsComparisonMetric;
  };
  currentState: {
    openRepairs: number;
    readyForPickup: number;
    awaitingParts: number;
    outstandingBalanceCents: number;
    activeQueueItems: number;
    overdueQueueItems: number;
  };
  trends: AnalyticsTrendPoint[];
  quoteFunnel: {
    requested: number;
    sent: number;
    accepted: number;
    depositPaid: number;
    converted: number;
  };
  customerMix: {
    total: number;
    new: number;
    returning: number;
    newPercent: number;
    returningPercent: number;
  };
  paymentMethods: AnalyticsFinancialBreakdownRow[];
  orderSources: AnalyticsFinancialBreakdownRow[];
  serviceModes: AnalyticsCountBreakdownRow[];
  repairTypes: AnalyticsRepairTypeRow[];
  devices: AnalyticsDeviceRow[];
  workQueue: {
    active: number;
    overdueActive: number;
    closed: number;
    completed: number;
    dismissed: number;
    autoResolved: number;
    onTimeRate: number;
    trackedItems: number;
    totalTrackedSeconds: number;
    averageTrackedSeconds: number;
  };
  generatedAt: string;
}

export interface AnalyticsOverviewResponse {
  data: AnalyticsOverview;
}
