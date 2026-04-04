export type DayOfWeek =
  | 'mon'
  | 'tue'
  | 'wed'
  | 'thu'
  | 'fri'
  | 'sat'
  | 'sun';

export type AvailabilityOverrideMode = 'available' | 'unavailable';

export interface AvailabilityRule {
  id: string;
  shopId: string;
  userId: string | null;
  dayOfWeek: DayOfWeek;
  startMin: number;
  endMin: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AvailabilityRulesListResponse {
  data: AvailabilityRule[];
}

export interface CreateAvailabilityRuleDto {
  userId?: string;
  dayOfWeek: DayOfWeek;
  startMin: number;
  endMin: number;
  isActive?: boolean;
}

export interface UpdateAvailabilityRuleDto {
  dayOfWeek?: DayOfWeek;
  startMin?: number;
  endMin?: number;
  isActive?: boolean;
}

export interface AvailabilityOverride {
  id: string;
  shopId: string;
  userId: string | null;
  mode: AvailabilityOverrideMode;
  startAt: string;
  endAt: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AvailabilityOverridesListParams {
  from: string;
  to: string;
  userId?: string;
}

export interface AvailabilityOverridesListResponse {
  data: AvailabilityOverride[];
}

export interface CreateAvailabilityOverrideDto {
  userId?: string;
  mode: AvailabilityOverrideMode;
  startAt: string;
  endAt: string;
  note?: string;
}

export interface AvailabilitySlot {
  startAt: string;
  endAt: string;
}

export interface AvailabilitySlotsResponse {
  data: AvailabilitySlot[];
}

export interface AvailabilitySlotsParams {
  from: string;
  to: string;
  durationMinutes?: number;
  repairId?: string;
  assignedUserId?: string;
  slotMinutes?: number;
}