export interface WebChatProactiveRule {
  id: string;
  name: string;
  enabled: boolean;
  pathContains: string | null;
  delaySeconds: number;
  message: string;
  tag: string | null;
  intent: string | null;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

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
  proactiveEnabled: boolean;
  csatEnabled: boolean;
  proactiveRules: WebChatProactiveRule[];
  helpEnabled: boolean;
  originAllowed?: boolean;
  shop: WebChatShopSummary;
  embedScript?: string;
  customLauncherScript?: string;
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
  proactiveEnabled?: boolean;
  csatEnabled?: boolean;
}
