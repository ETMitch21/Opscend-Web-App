export type VoiceAgentReasoningEffort = 'low' | 'medium' | 'high';

export interface VoiceAgentConfigurationState {
  openAiApiKey: boolean;
  openAiWebhookSecret: boolean;
  openAiProjectId: boolean;
  twilioNumber: boolean;
  transferPhone: boolean;
}

export interface VoiceAgentSettings {
  shopId: string;
  enabled: boolean;
  agentName: string;
  greeting: string | null;
  instructions: string | null;
  model: string;
  voice: string;
  reasoningEffort: string;
  voicePhoneNumber: string | null;
  transferPhone: string | null;
  allowAutoQuotes: boolean;
  autoSendQuoteSms: boolean;
  allowManualQuoteRequests: boolean;
  recordTranscripts: boolean;
  smsPhoneNumber: string | null;
  smsEnabled: boolean;
  smsMessagingServiceSid: string | null;
  sipUri: string | null;
  webhookUrl: string | null;
  twilioVoiceWebhookUrl: string | null;
  configured: VoiceAgentConfigurationState;
  ready: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export type VoiceAgentSettingsPatch = Partial<
  Pick<
    VoiceAgentSettings,
    | 'enabled'
    | 'agentName'
    | 'greeting'
    | 'instructions'
    | 'model'
    | 'voice'
    | 'reasoningEffort'
    | 'voicePhoneNumber'
    | 'transferPhone'
    | 'allowAutoQuotes'
    | 'autoSendQuoteSms'
    | 'allowManualQuoteRequests'
    | 'recordTranscripts'
  >
>;

export interface VoiceAgentCallCustomer {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
}

export interface VoiceAgentCallQuote {
  id: string;
  status: string;
  estimatedTotalCents: number | null;
  brand: string | null;
  model: string | null;
  repairNeedLabel: string | null;
}

export interface VoiceAgentTranscriptEntry {
  at: string;
  role: 'customer' | 'assistant' | 'system';
  text: string;
}

export interface VoiceAgentCall {
  id: string;
  shopId: string;
  openAiCallId: string;
  providerCallId: string | null;
  callerPhone: string | null;
  calledPhone: string | null;
  customerId: string | null;
  publicRepairQuoteId: string | null;
  status: string;
  outcome: string | null;
  startedAt: string;
  answeredAt: string | null;
  endedAt: string | null;
  summary: string | null;
  lastError: string | null;
  transcript: VoiceAgentTranscriptEntry[] | null;
  metadata: unknown;
  customer: VoiceAgentCallCustomer | null;
  quote: VoiceAgentCallQuote | null;
  createdAt: string;
  updatedAt: string;
}
