export type AppointmentStatus =
  | 'scheduled'
  | 'canceled'
  | 'completed'
  | 'no_show';

export interface Appointment {
  id: string;
  shopId: string;
  repairId: string;
  candidateType: 'internal' | 'contractor';
  assignedUserId: string | null;
  contractorId: string | null;
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
  serviceMode: string | null;
  deviceDisplayName: string | null;
}

export interface AppointmentListItem {
  appointment: Appointment;
  repair: AppointmentRepairContext;
  travelToNextMinutes: number | null;
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
  startAt: string;
  endAt: string;

  candidateType?: 'internal' | 'contractor' | null;
  assignedUserId?: string | null;
  contractorId?: string | null;
}


export interface UpdateAppointmentStatusDto {
  status: Extract<AppointmentStatus, 'completed' | 'no_show'>;
}

export interface AppointmentResponse {
  appointment: Appointment;
}