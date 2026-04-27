export type InternalNotificationEvent =
    | 'repair_assigned'
    | 'repair_unassigned'
    | 'repair_reassigned'
    | 'appointment_scheduled'
    | 'appointment_rescheduled'
    | 'appointment_canceled';

export type InternalNotificationChannel = 'email' | 'in_app';

export type InternalNotificationStatus = 'queued' | 'sent' | 'failed' | 'skipped';

export type InternalNotification = {
    id: string;

    shopId: string;
    repairId: string | null;
    appointmentId: string | null;
    recipientUserId: string | null;

    event: InternalNotificationEvent;
    channel: InternalNotificationChannel;

    recipientEmail: string | null;

    subject: string | null;
    body: string | null;

    status: InternalNotificationStatus;

    providerMessageId: string | null;
    errorMessage: string | null;

    readAt: string | null;
    sentAt: string | null;
    failedAt: string | null;
    createdAt: string;
};

export type InternalNotificationListResponse = {
    data: InternalNotification[];
};

export type InternalNotificationUnreadCountResponse = {
    unreadCount: number;
};

export type InternalNotificationReadAllResponse = {
    updatedCount: number;
};