export type CommunicationChannel = 'email' | 'sms' | string;
export type CommunicationDirection = 'inbound' | 'outbound' | string;
export type CommunicationMessageStatus =
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'failed'
  | 'received'
  | string;
export type CommunicationConversationStatus = 'open' | 'archived' | string;

export interface CommunicationMessage {
  id: string;
  conversationId: string;
  shopId: string;
  channel: CommunicationChannel;
  direction: CommunicationDirection;
  status: CommunicationMessageStatus;
  subject: string | null;
  body: string;
  fromName: string | null;
  fromEmail: string | null;
  fromPhone: string | null;
  toName: string | null;
  toEmail: string | null;
  toPhone: string | null;
  provider: string | null;
  providerMessageId: string | null;
  errorMessage: string | null;
  createdByUserId: string | null;
  readAt: string | null;
  sentAt: string | null;
  receivedAt: string | null;
  failedAt: string | null;
  createdAt: string;
}

export interface CommunicationConversationQuoteSummary {
  id: string;
  status: string;
  customerMessage: string | null;
  estimatedTotalCents: number | null;
  depositRequired: boolean;
  depositAmountCents: number | null;
  depositPaidAt: string | null;
  deviceLabel: string;
  repairLabel: string;
}

export interface CommunicationConversationRepairSummary {
  id: string;
  status: string;
  problemSummary: string;
}

export interface CommunicationConversation {
  id: string;
  shopId: string;
  publicRepairQuoteId: string | null;
  repairId: string | null;
  customerId: string | null;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  subject: string | null;
  status: CommunicationConversationStatus;
  lastMessageAt: string | null;
  lastInboundAt: string | null;
  lastOutboundAt: string | null;
  unreadForShopCount: number;
  lastMessagePreview: string | null;
  lastMessageChannel: CommunicationChannel | null;
  lastMessageDirection: CommunicationDirection | null;
  quote: CommunicationConversationQuoteSummary | null;
  repair: CommunicationConversationRepairSummary | null;
  messages?: CommunicationMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface CommunicationConversationListResponse {
  data: CommunicationConversation[];
  nextCursor: string | null;
}

export interface CommunicationConversationResponse {
  data: CommunicationConversation;
}

export interface CommunicationMessageResponse {
  data: CommunicationMessage;
}

export interface CommunicationMessageCreate {
  subject?: string;
  body: string;
}

export interface CommunicationConversationListParams {
  limit?: number;
  cursor?: string | null;
  q?: string;
  status?: 'open' | 'archived' | 'all';
}
