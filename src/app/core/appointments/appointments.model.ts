export type AppointmentStatus =
  | 'scheduled'
  | 'canceled'
  | 'completed'
  | 'no_show';

export interface Appointment {
  id: string;
  shopId: string;
  repairId: string;
  assignedUserId: string | null;
  startAt: string;
  endAt: string;
  status: AppointmentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AppointmentRepairContext {
  id: string;
  status: string;
  problemSummary: string;
  customerId: string;
  customerName: string | null;
  deviceDisplayName: string | null;
}

export interface AppointmentListItem {
  appointment: Appointment;
  repair: AppointmentRepairContext;
}

export interface AppointmentListResponse {
  data: AppointmentListItem[];
}

export interface AppointmentListParams {
  from: string;
  to: string;
  assignedUserId?: string;
}

export interface UpsertAppointmentDto {
  assignedUserId?: string | null;
  startAt: string;
  endAt: string;
}

export interface AppointmentResponse {
  appointment: Appointment;
}