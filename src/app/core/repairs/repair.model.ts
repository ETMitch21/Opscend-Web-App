export type RepairStatus =
    | 'intake'
    | 'scheduled'
    | 'diagnosing'
    | 'awaiting_approval'
    | 'awaiting_parts'
    | 'in_repair'
    | 'qc'
    | 'ready'
    | 'picked_up'
    | 'canceled';

export type RepairNoteVisibility = 'internal' | 'customer';

export type RepairEventType = 'status_change' | 'system' | string;

export type RepairUnlockType = 'none' | 'pin' | 'pattern';

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

export interface RepairAttachment {
    id: string;
    storageKey: string;
    filename: string;
    mimeType: string | null;
    sizeBytes: number | null;
    createdAt: string;
    createdBy: string;
}

export interface RepairAppointment {
    id: string;
    startAt: string;
    endsAt: string;
    technicianUserId: string | null;
    notes: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface Repair {
    id: string;
    shopId: string;
    customerId: string;
    customerDeviceId: string;
    orderId: string | null;

    customer?: any;
    customerDevice?: any;

    status: RepairStatus;

    problemSummary: string;
    intakeNotes: string | null;
    conditionNotes: string | null;

    passcodeProvided: boolean;
    unlockType: RepairUnlockType;
    pinCode: string | null;
    patternCode: string | null;

    accessories: string[];

    assignedTo: string | null;

    createdAt: string;
    updatedAt: string;
    createdBy: string;
    updatedBy: string | null;

    events: RepairEvent[];
    notes: RepairNote[];
    attachments: RepairAttachment[];
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
}

export interface UpdateRepairDto {
    status?: RepairStatus;

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