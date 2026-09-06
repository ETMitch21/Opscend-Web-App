export type CommunicationChannel =
  | 'email'
  | 'sms'
  | 'web_chat'
  | 'note'
  | 'system'
  | 'call'
  | 'voice'
  | 'repair_message'
  | 'contractor_message'
  | string;
export type CommunicationDirection = 'inbound' | 'outbound' | 'internal' | 'system' | string;
export type CommunicationMessageStatus =
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'failed'
  | 'received'
  | 'bounced'
  | 'complained'
  | 'rejected'
  | 'delayed'
  | 'opened'
  | 'clicked'
  | string;
export type CommunicationConversationStatus = 'open' | 'archived' | string;

export interface CommunicationAttachment {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number | null;
  url: string;
  thumbnailUrl: string | null;
}

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
  attachments: CommunicationAttachment[];
}


export interface CommunicationTimelineItem {
  id: string;
  type: 'message' | 'internal_note' | 'repair_note' | 'quote_event' | 'repair_event' | string;
  sourceId?: string | null;
  channel?: CommunicationChannel | null;
  direction?: CommunicationDirection | null;
  status?: string | null;
  title: string;
  body?: string | null;
  subject?: string | null;
  actorLabel?: string | null;
  occurredAt: string;
  readAt?: string | null;
  attachments?: CommunicationAttachment[];
  tone?: 'inbound' | 'outbound' | 'note' | 'system' | 'success' | 'danger' | 'info' | string | null;
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
  repairId?: string | null;
  updatedAt?: string | null;
}

export interface CommunicationConversationRepairSummary {
  id: string;
  status: string;
  problemSummary: string;
  customerDeviceId?: string | null;
  deviceLabel?: string | null;
  updatedAt?: string | null;
}

export interface CommunicationConversationCustomerProfile {
  id: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
}

export interface CommunicationConversationDeviceSummary {
  id: string;
  displayName: string | null;
  brand: string | null;
  model: string | null;
  nickname: string | null;
  updatedAt: string | null;
}


export interface CommunicationWebChatContext {
  state: string;
  visitorId: string | null;
  origin: string | null;
  pageUrl: string | null;
  pageTitle: string | null;
  referrer: string | null;
  lastSeenAt: string | null;
  startedAt: string | null;
  visitorTyping?: boolean;
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
  smsEnabled: boolean;
  smsUnavailableReason: string | null;
  webChatEnabled: boolean;
  webChatState: string | null;
  webChatContext: CommunicationWebChatContext | null;
  lastMessagePreview: string | null;
  lastMessageChannel: CommunicationChannel | null;
  lastMessageDirection: CommunicationDirection | null;
  quote: CommunicationConversationQuoteSummary | null;
  repair: CommunicationConversationRepairSummary | null;
  customerProfile: CommunicationConversationCustomerProfile | null;
  relatedQuotes: CommunicationConversationQuoteSummary[];
  relatedRepairs: CommunicationConversationRepairSummary[];
  relatedDevices: CommunicationConversationDeviceSummary[];
  messages?: CommunicationMessage[];
  timeline?: CommunicationTimelineItem[];
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

export type CommunicationQuickReplyChannel = 'sms' | 'email' | 'web_chat';

export interface CommunicationQuickReply {
  id: string;
  title: string;
  body: string;
  channels: CommunicationQuickReplyChannel[];
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CommunicationQuickRepliesResponse {
  data: CommunicationQuickReply[];
}

export interface CommunicationQuickReplyResponse {
  data: CommunicationQuickReply;
}

export interface CommunicationQuickReplyCreate {
  title: string;
  body: string;
  channels?: CommunicationQuickReplyChannel[];
  isActive?: boolean;
}

export interface CommunicationQuickReplyUpdate {
  title?: string;
  body?: string;
  channels?: CommunicationQuickReplyChannel[];
  isActive?: boolean;
}

export interface CommunicationMessageCreate {
  subject?: string;
  body: string;
  attachmentIds?: string[];
}

export interface CommunicationAttachmentUploadInit {
  uploadUrl: string;
  storageKey: string;
  expiresInSeconds: number;
}

export interface CommunicationAttachmentResponse {
  data: CommunicationAttachment;
}

export interface CommunicationConversationListParams {
  limit?: number;
  cursor?: string | null;
  q?: string;
  status?: 'open' | 'archived' | 'all';
}

export interface CustomerCommunicationActivityItem {
  id: string;
  conversationId: string;
  channel: CommunicationChannel;
  direction: CommunicationDirection;
  status: CommunicationMessageStatus;
  subject: string | null;
  preview: string;
  occurredAt: string;
  errorMessage: string | null;
}

export interface CustomerCommunicationDeliveryWarning {
  id: string;
  conversationId: string;
  channel: CommunicationChannel;
  status: CommunicationMessageStatus;
  errorMessage: string | null;
  occurredAt: string;
}

export interface CustomerCommunicationSummary {
  customerId: string;
  hasConversation: boolean;
  conversationId: string | null;
  conversationStatus: CommunicationConversationStatus | null;
  unreadCount: number;
  lastMessageAt: string | null;
  lastInboundAt: string | null;
  lastOutboundAt: string | null;
  lastMessagePreview: string | null;
  lastMessageChannel: CommunicationChannel | null;
  lastMessageDirection: CommunicationDirection | null;
  lastMessageStatus: CommunicationMessageStatus | null;
  deliveryWarningCount: number;
  latestDeliveryWarning: CustomerCommunicationDeliveryWarning | null;
  recentActivity: CustomerCommunicationActivityItem[];
}

export interface CustomerCommunicationSummaryResponse {
  data: CustomerCommunicationSummary;
}
