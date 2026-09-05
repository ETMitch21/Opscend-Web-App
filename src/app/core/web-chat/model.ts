export interface WebChatShopSummary {
  name: string;
  slug: string;
  logoUrl: string | null;
  phone: string | null;
  email: string | null;
  bookingUrl: string | null;
}

export interface WebChatSettings {
  enabled: boolean;
  assistantEnabled: boolean;
  assistantName: string;
  greeting: string;
  offlineMessage: string | null;
  handoffEnabled: boolean;
  requireContact: boolean;
  allowAttachments: boolean;
  primaryColor: string;
  position: 'left' | 'right';
  allowedOrigins: string[];
  originAllowed?: boolean;
  shop: WebChatShopSummary;
  embedScript?: string;
  scriptUrl?: string;
}

export interface WebChatSettingsPatch {
  enabled?: boolean;
  assistantEnabled?: boolean;
  assistantName?: string | null;
  greeting?: string | null;
  offlineMessage?: string | null;
  handoffEnabled?: boolean;
  requireContact?: boolean;
  allowAttachments?: boolean;
  primaryColor?: string | null;
  position?: 'left' | 'right';
  allowedOrigins?: string[];
}
