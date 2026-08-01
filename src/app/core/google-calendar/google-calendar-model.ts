export interface GoogleCalendarUserOption {
  id: string;
  name: string;
  email: string | null;
  role: string;
  status: string;
}

export interface GoogleCalendarMapping {
  id: string;
  userId: string;
  userName: string;
  userEmail: string | null;
  userRole: string;
  calendarId: string;
  calendarSummary: string;
  calendarPrimary: boolean;
  enabled: boolean;
  syncAppointments: boolean;
  blockBusyTime: boolean;
  lastIncrementalSyncAt: string | null;
  watchExpiresAt: string | null;
  lastError: string | null;
}

export interface GoogleCalendarStatusResponse {
  ok: true;
  connected: boolean;
  provider: 'google-calendar';
  accountEmail: string | null;
  connectedAt: string | null;
  lastSyncAt: string | null;
  lastError: string | null;
  settings: {
    syncEnabled: boolean;
    pushAppointments: boolean;
    pullAppointmentChanges: boolean;
    blockBusyTime: boolean;
  };
  mappings: GoogleCalendarMapping[];
  users: GoogleCalendarUserOption[];
}

export interface GoogleCalendarChoice {
  id: string;
  summary: string;
  description?: string;
  primary?: boolean;
  accessRole?: string;
  backgroundColor?: string;
  foregroundColor?: string;
  selected?: boolean;
}

export interface GoogleCalendarChoicesResponse {
  ok: true;
  calendars: GoogleCalendarChoice[];
}

export interface GoogleCalendarConnectResponse {
  ok: true;
  url: string;
}

export interface GoogleCalendarSettingsPayload {
  syncEnabled?: boolean;
  pushAppointments?: boolean;
  pullAppointmentChanges?: boolean;
  blockBusyTime?: boolean;
}

export interface GoogleCalendarMappingPayload {
  calendarId: string;
  enabled?: boolean;
  syncAppointments?: boolean;
  blockBusyTime?: boolean;
}
