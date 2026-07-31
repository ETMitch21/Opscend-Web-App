import type { RepairStatus, RepairServiceMode } from '../repairs/repair.model';
import type { WorkQueuePriority, WorkQueueSourceType, WorkQueueStatus } from '../work-queue/model';

export interface TechnicianDashboardUser {
  id: string;
  name: string;
  email: string | null;
  phone?: string | null;
  role: string;
}

export interface TechnicianDashboardShop {
  id: string;
  name: string;
  timezone: string;
  currency: string;
}

export interface TechnicianDashboardSummary {
  appointmentsSelectedDate: number;
  activeRepairs: number;
  activeTasks: number;
  formsDue: number;
  blockedRepairs: number;
  unreadMessages: number;
}

export interface TechnicianDashboardAppointment {
  id: string;
  repairId: string;
  startAt: string;
  endAt: string;
  status: 'scheduled' | 'completed' | 'no_show' | 'canceled';
  candidateType: 'internal' | 'contractor' | 'unassigned';
  dateKey: string;
  isSelectedDate: boolean;
  customer: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
  } | null;
  device: {
    id: string;
    name: string;
    displayName: string;
  } | null;
  problemSummary: string;
  repairStatus: RepairStatus | null;
  serviceMode: RepairServiceMode | null;
  route: string | null;
}

export interface TechnicianDashboardBlocker {
  type: 'parts' | 'inventory' | 'payment' | 'form' | string;
  label: string;
  detail: string | null;
}

export interface TechnicianDashboardRepair {
  id: string;
  status: RepairStatus;
  problemSummary: string;
  serviceMode: RepairServiceMode;
  assignedTo: string | null;
  updatedAt: string;
  customer: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
  };
  device: {
    id: string;
    name: string;
    displayName: string;
    brand: string | null;
    model: string | null;
  };
  service: { id: string; name: string } | null;
  appointment: {
    id: string;
    startAt: string;
    endAt: string;
    status: string;
  } | null;
  order: {
    id: string;
    orderNumber: string;
    fulfillmentStatus: string;
    paymentStatus: string;
    totalCents: number;
    balanceCents: number;
  } | null;
  unreadMessages: number;
  pendingFormCount: number;
  blockers: TechnicianDashboardBlocker[];
  route: string;
}

export interface TechnicianDashboardTask {
  id: string;
  sourceType: WorkQueueSourceType;
  automatic: boolean;
  sourceId: string | null;
  title: string;
  description: string | null;
  category: string;
  priority: WorkQueuePriority;
  status: WorkQueueStatus;
  customerId: string | null;
  customerName: string | null;
  route: string;
  dueAt: string | null;
  snoozedUntil: string | null;
  timerStartedAt: string | null;
  timerAccumulatedSeconds: number;
  timerStartedByUserId: string | null;
  updatedAt: string;
}

export interface TechnicianDashboardForm {
  id: string;
  title: string;
  status: 'pending' | 'in_progress';
  audience: 'staff' | 'customer';
  dueAt: string | null;
  repairId: string | null;
  customerId: string | null;
  customerName: string | null;
  deviceName: string | null;
  requiredBeforeRepairStatus: RepairStatus | null;
  templateName: string;
  route: string;
  updatedAt: string;
}

export interface TechnicianDashboardMessage {
  id: string;
  repairId: string;
  customerName: string;
  deviceName: string;
  subject: string;
  unreadCount: number;
  lastMessageAt: string | null;
  route: string;
}

export interface TechnicianDashboardKnowledgeArticle {
  id: string;
  title: string;
  summary: string | null;
  category: string;
  pinned: boolean;
  reason: string;
  updatedAt: string;
  route: string;
}

export interface TechnicianDashboardData {
  generatedAt: string;
  selectedDate: string;
  todayDate: string;
  shop: TechnicianDashboardShop;
  viewer: {
    userId: string | null;
    role: string | null;
    canSwitchTechnician: boolean;
  };
  technician: TechnicianDashboardUser;
  technicians: TechnicianDashboardUser[];
  summary: TechnicianDashboardSummary;
  activeTimer: TechnicianDashboardTask | null;
  schedule: TechnicianDashboardAppointment[];
  repairs: TechnicianDashboardRepair[];
  tasks: TechnicianDashboardTask[];
  forms: TechnicianDashboardForm[];
  messages: TechnicianDashboardMessage[];
  knowledge: TechnicianDashboardKnowledgeArticle[];
}

export interface TechnicianDashboardResponse {
  data: TechnicianDashboardData;
}
