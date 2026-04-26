export type RepairNotificationEvent =
    | 'repair_created'
    | 'repair_scheduled'
    | 'repair_status_changed'
    | 'repair_awaiting_approval'
    | 'repair_awaiting_parts'
    | 'repair_ready'
    | 'repair_completed'
    | 'repair_canceled';

export type NotificationChannel = 'email' | 'sms';

export type NotificationDeliveryStatus = 'queued' | 'sent' | 'failed' | 'skipped';

export type RepairNotification = {
    id: string;

    shopId: string;
    repairId: string;
    customerId: string | null;
    templateId: string | null;

    event: RepairNotificationEvent;
    channel: NotificationChannel;

    recipientEmail: string | null;
    recipientPhone: string | null;

    subject: string | null;
    body: string | null;

    status: NotificationDeliveryStatus;

    providerMessageId: string | null;
    errorMessage: string | null;

    sentAt: string | null;
    failedAt: string | null;
    createdAt: string;
};

export type RepairNotificationListResponse = {
    data: RepairNotification[];
};