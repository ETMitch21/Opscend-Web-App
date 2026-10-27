export type OpscendAppSettingOption = { value: string; label: string };

export type OpscendAppSettingField = {
  type: 'text' | 'secret' | 'number' | 'select' | 'segmented' | 'toggle' | 'collection';
  path?: string;
  secretKey?: string;
  label?: string;
  help?: string;
  placeholder?: string;
  required?: boolean;
  min?: number;
  max?: number;
  step?: number;
  prefix?: string;
  suffix?: string;
  options?: OpscendAppSettingOption[];
  visibleWhen?: { path: string; equals: string | number | boolean | null };
  columns?: OpscendAppSettingField[];
  itemKeyPath?: string;
  itemLabelPath?: string;
};

export type OpscendAppSettingsSection = {
  id: string;
  title: string;
  description?: string;
  fields: OpscendAppSettingField[];
};

export type OpscendAppManifest = {
  manifestVersion: string;
  key: string;
  runtime?: { protocolVersion?: string };
  permissions: string[];
  extensions: Array<{ point: string; action?: string; [key: string]: unknown }>;
  actions?: Record<string, { public?: boolean; secretKeys?: string[]; [key: string]: unknown }>;
  events: string[];
  capabilities: string[];
  settings?: {
    defaults?: Record<string, unknown>;
    secretKeys?: string[];
    sections?: OpscendAppSettingsSection[];
  };
};

export interface OpscendAppInstallation {
  id: string;
  status: string;
  grantedScopes: string[];
  settings: Record<string, any>;
  installedAt: string;
  updatedAt: string;
  disabledAt: string | null;
  setupState: 'ready' | 'needs_setup' | 'disabled' | 'not_installed';
  runtimeStatus: 'online' | 'unreachable' | 'unknown' | 'not_configured' | string;
  secretStatus: Record<string, boolean>;
}

export interface OpscendApp {
  key: string;
  name: string;
  description: string;
  version: string;
  developer: string;
  category: string;
  icon: string | null;
  homepageUrl: string | null;
  privacyUrl: string | null;
  isOfficial: boolean;
  manifest: OpscendAppManifest;
  installed: boolean;
  installation: OpscendAppInstallation | null;
}

export interface PublicAppExtensionOption {
  value: string;
  label: string;
  description?: string;
  badge?: string;
}

export interface PublicAppExtension {
  appKey: string;
  appName: string;
  id: string;
  type: 'choice_action' | string;
  title: string;
  description?: string;
  badge?: string;
  footnote?: string;
  completed?: {
    label: string;
    detail?: string;
    amountCents?: number;
  } | null;
  options?: PublicAppExtensionOption[];
  action?: {
    key: string;
    presentation?: 'popup' | 'inline' | string;
    buttonLabel?: string;
  };
}

export interface PublicAppActionStart {
  presentation: 'popup' | 'inline' | string;
  url?: string;
  message?: string;
}

export interface PublicAppQuoteState {
  quoteId: string;
  laborCents: number | null;
  tripFeeCents: number | null;
  estimatedSubtotalCents: number | null;
  estimatedTotalCents: number | null;
  depositAmountCents: number | null;
  adjustment: {
    source: string;
    key: string;
    label: string;
    discountCents: number;
    metadata?: Record<string, unknown>;
  } | null;
}
