import { Customer } from './customer.model';

export type CustomerWorkspaceTone =
  | 'neutral'
  | 'info'
  | 'success'
  | 'warning'
  | 'danger';

export type CustomerWorkspaceTimelineType =
  | 'customer'
  | 'repair'
  | 'quote'
  | 'order'
  | 'communication';

export type CustomerWorkspaceHealthKey =
  | 'new'
  | 'active'
  | 'returning'
  | 'loyal'
  | 'needs_attention';

export interface CustomerWorkspaceStats {
  totalRepairs: number;
  openRepairs: number;
  completedRepairs: number;
  totalOrders: number;
  totalQuotes: number;
  activeQuotes: number;
  totalDevices: number;
  lifetimeValueCents: number;
  averageOrderValueCents: number;
  outstandingBalanceCents: number;
  lastActivityAt: string | null;
}

export interface CustomerWorkspaceHealth {
  key: CustomerWorkspaceHealthKey;
  label: string;
  description: string;
  tone: CustomerWorkspaceTone;
}

export interface CustomerWorkspaceDeviceSummary {
  id: string;
  displayName: string | null;
  nickname: string | null;
  brand: string | null;
  model: string | null;
}

export interface CustomerWorkspaceAppointmentSummary {
  id: string;
  startAt: string;
  endAt: string | null;
  status: string;
}

export interface CustomerWorkspaceRepairSummary {
  id: string;
  status: string;
  problemSummary: string;
  serviceMode: string;
  assignedTo: string | null;
  createdAt: string;
  updatedAt: string;
  device: CustomerWorkspaceDeviceSummary | null;
  appointment: CustomerWorkspaceAppointmentSummary | null;
}

export interface CustomerWorkspaceUpcomingAppointment {
  repairId: string;
  problemSummary: string;
  deviceLabel: string;
  assignedTo: string | null;
  appointment: CustomerWorkspaceAppointmentSummary;
}

export interface CustomerWorkspaceQuoteSummary {
  id: string;
  status: string;
  customerMessage: string | null;
  estimatedTotalCents: number | null;
  depositRequired: boolean;
  depositAmountCents: number | null;
  depositPaidAt: string | null;
  deviceLabel: string;
  repairLabel: string;
  repairId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerWorkspaceOrderSummary {
  id: string;
  orderNumber: string;
  repairId: string | null;
  paymentStatus: string;
  fulfillmentStatus: string;
  totalCents: number;
  paidCents: number;
  refundedCents: number;
  balanceCents: number;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerWorkspaceTimelineItem {
  id: string;
  type: CustomerWorkspaceTimelineType;
  title: string;
  detail: string | null;
  occurredAt: string;
  status: string | null;
  route: string | null;
  tone: CustomerWorkspaceTone;
}

export interface CustomerWorkspaceOpenItem {
  id: string;
  type: 'balance' | 'repair' | 'quote';
  title: string;
  detail: string;
  amountCents: number | null;
  occurredAt: string | null;
  route: string | null;
  tone: CustomerWorkspaceTone;
}

export interface CustomerWorkspace {
  customer: Customer;
  stats: CustomerWorkspaceStats;
  health: CustomerWorkspaceHealth;
  nextAppointment: CustomerWorkspaceUpcomingAppointment | null;
  openItems: CustomerWorkspaceOpenItem[];
  recentRepairs: CustomerWorkspaceRepairSummary[];
  recentQuotes: CustomerWorkspaceQuoteSummary[];
  recentOrders: CustomerWorkspaceOrderSummary[];
  timeline: CustomerWorkspaceTimelineItem[];
}
