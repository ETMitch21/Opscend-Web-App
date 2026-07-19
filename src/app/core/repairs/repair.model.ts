export type RepairStatus =
  | 'intake'
  | 'scheduled'
  | 'needs_reassignment'
  | 'customer_verified'
  | 'diagnosing'
  | 'awaiting_approval'
  | 'awaiting_parts'
  | 'in_repair'
  | 'documentation_pending'
  | 'qc'
  | 'ready'
  | 'picked_up'
  | 'canceled';

export type RepairMessageRole =
  | 'contractor'
  | 'customer'
  | 'admin'
  | 'system';

export type RepairMessageVisibility =
  | 'customer_contractor'
  | 'customer_shop'
  | 'contractor_shop'
  | 'internal';

export type RepairNoteVisibility = 'internal' | 'customer';
export type RepairEventType = 'status_change' | 'system' | string;
export type RepairUnlockType = 'none' | 'pin' | 'pattern';
export type RepairServiceMode = 'in_shop' | 'on_site';

export type RepairDispatchType = 'internal' | 'contractor' | 'unassigned';

export interface RepairContractorSummary {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  active?: boolean;
}

export interface RepairEvent {
  id: string;
  type: RepairEventType;
  fromStatus: RepairStatus | null;
  toStatus: RepairStatus | null;
  message: string | null;
  createdAt: string;
  createdBy: string;
}

export interface RepairNote {
  id: string;
  visibility: RepairNoteVisibility;
  body: string;
  createdAt: string;
  createdBy: string;
}

export type RepairAttachmentType =
  | 'pre_repair_photo'
  | 'post_repair_photo'
  | 'other';

export interface RepairAttachment {
  id: string;
  storageKey: string;
  filename: string;
  mimeType: string | null;
  sizeBytes: number | null;
  type?: RepairAttachmentType;
  createdAt: string;
  createdBy: string;
}

export interface RepairDocumentation {
  id: string;
  repairId: string;

  imei: string | null;
  deviceModel: string | null;
  batteryHealth: number | null;

  preChecklist: unknown | null;
  postChecklist: unknown | null;

  preSignatureUrl: string | null;
  postSignatureUrl: string | null;

  notes: string | null;

  createdAt: string;
  updatedAt: string;
}


export interface RepairAppointment {
  id: string;
  startAt: string;
  endAt?: string;
  endsAt?: string;

  technicianUserId?: string | null;
  assignedUserId?: string | null;
  contractorId?: string | null;
  candidateType?: 'internal' | 'contractor' | null;

  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type RepairSourceQuoteStatus =
  | 'draft'
  | 'quote_requested'
  | 'quoted'
  | 'sent'
  | 'accepted'
  | 'declined'
  | 'deposit_pending'
  | 'deposit_paid'
  | 'scheduled'
  | 'converted'
  | 'expired'
  | 'canceled'
  | string;

export interface RepairSourceQuote {
  id: string;
  status: RepairSourceQuoteStatus;
  repairNeed: {
    id: string;
    label: string;
    code: string;
  } | null;
  deviceLabel: string;
  serviceMode: RepairServiceMode;
  estimatedTotalCents: number | null;
  depositRequired: boolean;
  depositAmountCents: number | null;
  depositPaidAt: string | null;
  depositPaidAmountCents: number | null;
  depositPaidCurrency: string | null;
  publicApprovalToken: string | null;
  quoteSentAt: string | null;
  acceptedAt: string | null;
  convertedAt: string | null;
  customerMessage: string | null;
  internalNotes: string | null;
}

export interface RepairCommunicationConversationSummary {
  id: string;
  subject: string | null;
  status: string;
  unreadForShopCount: number;
  lastMessageAt: string | null;
}

export interface Repair {
  id: string;
  shopId: string;
  customerId: string;
  customerDeviceId: string;
  orderId: string | null;

  customer?: any;
  customerDevice?: any;

  sourceQuote?: RepairSourceQuote | null;
  communicationConversation?: RepairCommunicationConversationSummary | null;

  status: RepairStatus;

  publicTrackingToken: string | null;
  publicTrackingEnabled: boolean;

  publicShortUrl: string | null;
  publicShortLinkId: string | null;
  publicShortCreatedAt: string | null;

  problemSummary: string;
  intakeNotes: string | null;
  conditionNotes: string | null;

  passcodeProvided: boolean;
  unlockType: RepairUnlockType;
  pinCode: string | null;
  patternCode: string | null;

  accessories: string[];
  assignedTo: string | null;

  serviceId: string | null;
  repairNeedId?: string | null;
  pricingTemplateId?: string | null;
  dispatchType: RepairDispatchType;
  contractorId?: string | null;
  contractor?: RepairContractorSummary | null;

  serviceMode: RepairServiceMode;
  serviceAddressId: string | null;
  serviceAddressLabel: string | null;
  serviceAddressLine1: string | null;
  serviceAddressLine2: string | null;
  serviceAddressCity: string | null;
  serviceAddressState: string | null;
  serviceAddressPostalCode: string | null;
  serviceAddressCountry: string | null;
  serviceAddressNotes: string | null;
  tripFeeApplied: boolean;
  tripFeeCents: number | null;

  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string | null;

  events: RepairEvent[];
  notes: RepairNote[];
  attachments: RepairAttachment[];
  documentation?: RepairDocumentation | null;
  appointment: RepairAppointment | null;
}

export interface RepairListResponse {
  data: Repair[];
  nextCursor: string | null;
}

export interface RepairListParams {
  limit?: number;
  cursor?: string;
  status?: RepairStatus;
  serviceMode?: RepairServiceMode;
  dispatchType?: RepairDispatchType;
  customerId?: string;
  customerDeviceId?: string;
  orderId?: string;
}

export interface CreateRepairDto {
  customerId: string;
  customerDeviceId: string;
  orderId?: string | null;

  problemSummary: string;
  intakeNotes?: string | null;
  conditionNotes?: string | null;

  passcodeProvided?: boolean;
  unlockType?: RepairUnlockType;
  pinCode?: string | null;
  patternCode?: string | null;

  accessories?: string[];
  assignedTo?: string | null;

  serviceId?: string | null;
  repairNeedId?: string | null;
  pricingTemplateId?: string | null;
  dispatchType?: RepairDispatchType;
  contractorId?: string | null;

  serviceMode?: RepairServiceMode;
  serviceAddressId?: string;
  tripFeeApplied?: boolean;
  tripFeeCents?: number | null;
}

export interface UpdateRepairDto {
  status?: RepairStatus;
  publicTrackingEnabled?: boolean;

  problemSummary?: string;
  intakeNotes?: string | null;
  conditionNotes?: string | null;

  passcodeProvided?: boolean;
  unlockType?: RepairUnlockType;
  pinCode?: string | null;
  patternCode?: string | null;

  accessories?: string[];
  assignedTo?: string | null;
  orderId?: string | null;

  serviceId?: string | null;
  repairNeedId?: string | null;
  pricingTemplateId?: string | null;
  dispatchType?: RepairDispatchType;
  contractorId?: string | null;

  serviceMode?: RepairServiceMode;
  serviceAddressId?: string | null;
  tripFeeApplied?: boolean;
  tripFeeCents?: number | null;
}

export interface CreateRepairNoteDto {
  visibility?: RepairNoteVisibility;
  body: string;
}

export interface OrderItemInput {
  type: string;
  name: string;
  sku?: string | null;
  quantity: number;
  unitPriceCents: number;
  notes?: string | null;
}

export interface CreateRepairOrderDto {
  items?: OrderItemInput[];
  discountCents?: number;
  tags?: string[];
  notes?: string | null;
}

export interface OrderItem {
  id: string;
  type: string;
  name: string;
  sku: string | null;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  notes: string | null;
}

export interface OrderPayment {
  id: string;
  amountCents: number;
  method: string;
  status: string;
  createdAt: string;
}

export interface Order {
  id: string;
  shopId: string;
  orderNumber: string;
  sequence: number;

  customerId: string | null;
  source: string;

  fulfillmentStatus: string;
  paymentStatus: string;

  tags: string[];
  notes: string | null;

  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  paidCents: number;
  refundedCents: number;
  balanceCents: number;

  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string | null;

  items: OrderItem[];
  payments: OrderPayment[];
}

export interface PublicRepairTrackingTimelineItem {
  key: RepairStatus;
  label: string;
  completed: boolean;
  current: boolean;
}

export interface PublicRepairTrackingResponse {
  repairId: string;
  status: RepairStatus;
  statusLabel: string;

  problemSummary: string;

  customerDevice: {
    id: string;
    displayName: string | null;
    brand?: string | null;
    model?: string | null;
  } | null;

  shop: {
    name: string;
    phone: string | null;
    email: string | null;
  };

  timeline: PublicRepairTrackingTimelineItem[];

  createdAt: string;
  updatedAt: string;
}

export interface RepairPublicShortLinkResponse {
  publicShortUrl: string;
  publicShortLinkId: string | null;
  publicShortCreatedAt: string;
}

export interface AttachmentInitDto {
  filename: string;
  mimeType?: string;
  sizeBytes?: number;
}

export interface AttachmentInitResponse {
  uploadUrl: string;
  storageKey: string;
  expiresInSeconds: number;
}

export interface AttachmentCompleteDto {
  storageKey: string;
  filename: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
}

export interface AttachmentListResponse {
  data: RepairAttachment[];
}

export interface AttachmentDownloadResponse {
  downloadUrl: string;
  expiresInSeconds: number;
}

export interface RepairMessage {
  id: string;

  shopId: string;
  repairId: string;

  senderId: string | null;

  role: RepairMessageRole;
  visibility: RepairMessageVisibility;

  message: string;

  readByCustomerAt: string | null;
  readByContractorAt: string | null;
  readByShopAt: string | null;

  hiddenAt: string | null;
  hiddenByUserId: string | null;
  hiddenReason: string | null;

  createdAt: string;
}

export interface RepairMessagesListResponse {
  messages: RepairMessage[];
}

export interface CreateRepairMessageBody {
  message: string;
  visibility?: RepairMessageVisibility;
}

export interface CreateRepairMessageResponse {
  message: RepairMessage;
}

export interface RepairMessageUnreadCountResponse {
  unreadCount: number;
}

export interface MarkRepairMessagesReadBody {
  visibility?: RepairMessageVisibility;
}

export interface MarkRepairMessagesReadResponse {
  updatedCount: number;
}