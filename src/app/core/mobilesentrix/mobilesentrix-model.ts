
export interface MobileSentrixStatusResponse {
    ok: boolean;
    connected: boolean;
    provider: "mobilesentrix";
    connectedAt: string | null;
    updatedAt: string | null;
}

export interface MobileSentrixConnectResponse {
    ok: boolean;
    url: string;
}

export interface MobileSentrixDisconnectResponse {
    ok: boolean;
    disconnected: boolean;
}
