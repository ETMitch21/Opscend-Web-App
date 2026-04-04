export interface SchedulingRequest {
  title?: string;
  subtitle?: string;
  from: string;
  to: string;
  durationMinutes?: number;
  repairId?: string;
  assignedUserId?: string | null;
  slotMinutes?: number;
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