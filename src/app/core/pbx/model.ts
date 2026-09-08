export type PbxRoutingMode = 'ai_first' | 'ring_group_first';
export type PbxAfterHoursRoutingMode = 'voicemail' | 'ai';

export interface PbxRingGroupMember {
  userId: string;
  name: string;
  email: string | null;
  enabled: boolean;
  sortOrder: number;
}

export interface PbxRingGroup {
  id: string;
  name: string;
  enabled: boolean;
  isDefault: boolean;
  strategy: string;
  timeoutSeconds: number;
  sortOrder: number;
  members: PbxRingGroupMember[];
  createdAt: string;
  updatedAt: string;
}

export interface PbxSelectableUser {
  id: string;
  name: string;
  email: string | null;
  role: string;
}

export interface PbxSettings {
  shopId: string;
  enabled: boolean;
  routingMode: PbxRoutingMode;
  afterHoursRoutingMode: PbxAfterHoursRoutingMode;
  greetingEnabled: boolean;
  greeting: string | null;
  ringTimeoutSeconds: number;
  voicemailEnabled: boolean;
  voicemailTranscriptionEnabled: boolean;
  voicemailGreeting: string | null;
  voicemailMaxSeconds: number;
  holdMusicUrl: string | null;
  groups: PbxRingGroup[];
  users: PbxSelectableUser[];
  inboundWebhookUrl: string | null;
  holdMusicWebhookUrl: string | null;
  unreadVoicemailCount: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export type PbxSettingsPatch = Partial<Pick<
  PbxSettings,
  | 'enabled'
  | 'routingMode'
  | 'afterHoursRoutingMode'
  | 'greetingEnabled'
  | 'greeting'
  | 'ringTimeoutSeconds'
  | 'voicemailEnabled'
  | 'voicemailTranscriptionEnabled'
  | 'voicemailGreeting'
  | 'voicemailMaxSeconds'
  | 'holdMusicUrl'
>>;

export interface PbxRingGroupInput {
  name: string;
  enabled?: boolean;
  isDefault?: boolean;
  strategy?: string;
  timeoutSeconds?: number;
  sortOrder?: number;
  userIds?: string[];
}

export type PbxRingGroupPatch = Partial<PbxRingGroupInput>;

export interface PbxVoicemail {
  id: string;
  callSid: string | null;
  recordingSid: string | null;
  callerPhone: string | null;
  calledPhone: string | null;
  customerId: string | null;
  displayName: string | null;
  durationSeconds: number | null;
  transcription: string | null;
  status: string;
  heardAt: string | null;
  createdAt: string;
}
