export type SchedulingServiceMode = 'in_shop' | 'on_site';

export interface SchedulingGeoPoint {
  lat: number;
  lng: number;
}

export interface SchedulingInlineAddress {
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  geo?: SchedulingGeoPoint | null;
}

export interface SchedulingRequest {
  title?: string;
  subtitle?: string;
  from: string;
  to: string;
  durationMinutes?: number;
  repairId?: string;
  assignedUserId?: string | null;
  slotMinutes?: number;

  serviceMode?: SchedulingServiceMode;
  serviceAddressId?: string | null;
  serviceAddress?: SchedulingInlineAddress | null;
}

export interface SchedulingSlot {
  startAt: string;
  endAt: string;
}

export interface SchedulingSelection {
  startAt: string;
  endAt: string;
  assignedUserId?: string | null;
  assignedTo?: string | null;
}

export interface SchedulingContext {
  isOpen: boolean;
  request: SchedulingRequest | null;
}

export type CalendarDay = {
  dateKey: string;
  dayNumber: number;
  inCurrentMonth: boolean;
  isAvailable: boolean;
  isSelected: boolean;
  isPastDate: boolean;
  isToday: boolean;
};