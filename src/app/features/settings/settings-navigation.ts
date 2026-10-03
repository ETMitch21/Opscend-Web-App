import {
  AlertCircleIcon,
  BadgeDollarSign,
  BellIcon,
  BlocksIcon,
  Building2,
  CalendarClockIcon,
  CalendarCog,
  DollarSignIcon,
  DownloadIcon,
  LucideIconData,
  MapPinIcon,
  MessageCircle,
  PhoneCallIcon,
  ShieldCheckIcon,
  SmartphoneIcon,
  UserIcon,
  UsersIcon,
  WalletCardsIcon,
  Zap,
} from 'lucide-angular';

export type SettingsNavItem = {
  label: string;
  description: string;
  route: string;
  icon: LucideIconData;
  permission?: string;
  keywords?: string[];
};

export type SettingsNavGroup = {
  label: string;
  description: string;
  items: SettingsNavItem[];
};

export const SETTINGS_GROUPS: SettingsNavGroup[] = [
  {
    label: 'General',
    description: 'Core shop identity, locations, and operating information.',
    items: [
      {
        label: 'General',
        description: 'Business identity, contact information, branding, and regional defaults.',
        route: '/settings/shop/general',
        icon: Building2,
        permission: 'shops:read',
        keywords: ['shop', 'business', 'identity', 'contact', 'address', 'branding', 'timezone'],
      },
      {
        label: 'Locations',
        description: 'Manage operating locations and location workspaces.',
        route: '/settings/shop/locations',
        icon: MapPinIcon,
        permission: 'shops:create',
        keywords: ['multi-location', 'branches', 'stores', 'offices', 'workspace'],
      },
    ],
  },
  {
    label: 'Public Experience',
    description: 'Control how customers quote, book, return, and manage service online.',
    items: [
      {
        label: 'Public Experience',
        description: 'Quote funnel, customer portal, configurable upsells, intake, and recovery.',
        route: '/settings/shop/public-experience',
        icon: SmartphoneIcon,
        permission: 'booking:read',
        keywords: ['public', 'quote', 'booking', 'portal', 'upsell', 'trade-in', 'recovery', 'consent'],
      },
    ],
  },
  {
    label: 'Scheduling',
    description: 'Availability, appointment rules, lead times, and mobile service coverage.',
    items: [
      {
        label: 'Scheduling',
        description: 'On-site service, travel fees, service area, and shortcuts to appointment controls.',
        route: '/settings/shop/scheduling',
        icon: CalendarCog,
        permission: 'availability:read',
        keywords: ['schedule', 'onsite', 'on-site', 'trip fee', 'service area', 'radius', 'zip'],
      },
      {
        label: 'Shop hours',
        description: 'Weekly operating hours and date-specific closures or exceptions.',
        route: '/settings/shop/availability',
        icon: CalendarClockIcon,
        permission: 'availability:read',
        keywords: ['availability', 'schedule', 'open', 'closed', 'holiday'],
      },
      {
        label: 'Booking rules',
        description: 'Duration, same-day rules, lead times, fallback pricing, catalog, and embed behavior.',
        route: '/settings/shop/shop-bookings',
        icon: CalendarCog,
        permission: 'booking:read',
        keywords: ['appointments', 'duration', 'same day', 'lead time', 'embed', 'catalog'],
      },
    ],
  },
  {
    label: 'Communications',
    description: 'Customer messaging channels, templates, alerts, and reusable responses.',
    items: [
      {
        label: 'Communications',
        description: 'SMS channel and shop messaging configuration.',
        route: '/settings/shop/communications',
        icon: MessageCircle,
        permission: 'communications:read',
        keywords: ['sms', 'text', 'twilio', 'communications', 'messages'],
      },
      {
        label: 'Notifications',
        description: 'Automated repair updates, sender details, and customer templates.',
        route: '/settings/shop/notifications',
        icon: BellIcon,
        permission: 'notifications:read',
        keywords: ['email', 'sms', 'alerts', 'messages', 'templates'],
      },
      {
        label: 'Quick replies',
        description: 'Reusable responses for Web Chat, SMS, and email.',
        route: '/settings/shop/quick-replies',
        icon: Zap,
        permission: 'communications:write',
        keywords: ['quick replies', 'saved replies', 'macros', 'snippets'],
      },
      {
        label: 'Web Chat',
        description: 'Messenger, AI handoff, proactive messages, appearance, and embed code.',
        route: '/settings/shop/web-chat',
        icon: MessageCircle,
        permission: 'communications:read',
        keywords: ['chat', 'website', 'webflow', 'ai', 'widget', 'proactive'],
      },
    ],
  },
  {
    label: 'Payments & Pricing',
    description: 'Deposits, prepayment, order numbering, pricing, catalog, and payouts.',
    items: [
      {
        label: 'Payments',
        description: 'Deposit enforcement, full prepayment, discounts, and order defaults.',
        route: '/settings/shop/payments',
        icon: WalletCardsIcon,
        permission: 'booking:read',
        keywords: ['payments', 'deposit', 'prepay', 'discount', 'orders', 'stripe'],
      },
      {
        label: 'Repair pricing',
        description: 'Repair types, model-specific options, deposits, and booking behavior.',
        route: '/settings/shop/repair-pricing',
        icon: DollarSignIcon,
        permission: 'repairPricing:read',
        keywords: ['price', 'labor', 'parts', 'deposit', 'service', 'repair type'],
      },
      {
        label: 'Device catalog',
        description: 'Categories, brands, models, publishing, and master catalog updates.',
        route: '/settings/shop/device-catalog',
        icon: SmartphoneIcon,
        permission: 'deviceCatalog:read',
        keywords: ['devices', 'phones', 'tablets', 'models', 'brands', 'catalog'],
      },
      {
        label: 'Payouts',
        description: 'Stripe balances, payout destinations, schedules, and instant payouts.',
        route: '/settings/shop/payouts',
        icon: WalletCardsIcon,
        permission: 'payouts:write',
        keywords: ['stripe', 'bank', 'balance', 'instant', 'money'],
      },
    ],
  },
  {
    label: 'Business & Fleet',
    description: 'CRM, business accounts, fleet plans, and business service agreements.',
    items: [
      {
        label: 'CRM, Business & Fleet',
        description: 'Enable CRM, business account features, Fleet controls, and agreement templates.',
        route: '/settings/shop/business-fleet',
        icon: Building2,
        permission: 'shops:read',
        keywords: ['crm', 'sales', 'business accounts', 'fleet', 'contracts', 'agreements'],
      },
      {
        label: 'Fleet plans',
        description: 'Recurring business plans, repair rates, benefits, and enrollment terms.',
        route: '/settings/shop/fleet-plans',
        icon: BadgeDollarSign,
        permission: 'businessAccounts:read',
        keywords: ['fleet', 'plans', 'business', 'recurring', 'membership', 'rates'],
      },
    ],
  },
  {
    label: 'Phone & AI',
    description: 'Voice routing, voicemail, call handling, and the AI phone agent.',
    items: [
      {
        label: 'Phone system & AI',
        description: 'Call routing, ring groups, voicemail, hold music, and AI quoting.',
        route: '/settings/shop/voice-agent',
        icon: PhoneCallIcon,
        permission: 'voiceAgent:read',
        keywords: ['phone', 'calls', 'twilio', 'openai', 'voice', 'pbx', 'voicemail', 'ring groups'],
      },
    ],
  },
  {
    label: 'Team & Permissions',
    description: 'Staff access, roles, and permissions for this shop.',
    items: [
      {
        label: 'Team',
        description: 'Staff access, invitations, and archived team members.',
        route: '/settings/shop/users',
        icon: UsersIcon,
        permission: 'users:read',
        keywords: ['users', 'employees', 'staff', 'invite'],
      },
      {
        label: 'Roles & permissions',
        description: 'Choose exactly what each shop role can view and manage.',
        route: '/settings/shop/roles-permissions',
        icon: ShieldCheckIcon,
        permission: 'roles:read',
        keywords: ['roles', 'permissions', 'access', 'security', 'rbac'],
      },
    ],
  },
  {
    label: 'Integrations & System',
    description: 'External connections, exports, and shop diagnostics.',
    items: [
      {
        label: 'Integrations',
        description: 'Supplier, payment, and external service connections used by your shop.',
        route: '/settings/integrations',
        icon: BlocksIcon,
        permission: 'shops:read',
        keywords: ['connections', 'mobilesentrix', 'stripe', 'supplier', 'api'],
      },
      {
        label: 'Data export',
        description: 'Download a complete shop archive or export individual data sections.',
        route: '/settings/shop/data-export',
        icon: DownloadIcon,
        permission: 'dataExport:read',
        keywords: ['export', 'csv', 'download', 'backup', 'data', 'portability'],
      },
      {
        label: 'System health',
        description: 'Check linked records, balances, inventory, and automation integrity.',
        route: '/settings/shop/system-health',
        icon: AlertCircleIcon,
        permission: 'systemHealth:read',
        keywords: ['health', 'integrity', 'issues', 'diagnostics', 'orders', 'inventory'],
      },
    ],
  },
  {
    label: 'Your account',
    description: 'Manage your personal profile and recurring working availability.',
    items: [
      {
        label: 'My profile',
        description: 'Your personal details and internal team profile.',
        route: '/settings/profile/my-profile',
        icon: UserIcon,
        keywords: ['name', 'phone', 'account', 'personal'],
      },
      {
        label: 'My hours',
        description: 'Your recurring working hours and personal schedule exceptions.',
        route: '/settings/profile/my-availability',
        icon: CalendarClockIcon,
        permission: 'availability:read',
        keywords: ['availability', 'schedule', 'working hours', 'technician'],
      },
    ],
  },
];

export function visibleSettingsGroups(
  _role: string | null | undefined,
  permissions: readonly string[] = [],
): SettingsNavGroup[] {
  const granted = new Set(permissions);
  const hasPermission = (permission?: string) => {
    if (!permission) return true;
    if (granted.has('*') || granted.has(permission)) return true;
    const resource = permission.split(':')[0];
    if (resource && granted.has(`${resource}:*`)) return true;
    if (permission === 'repairPricing:read' && granted.has('booking:read')) return true;
    if (permission === 'repairPricing:write' && granted.has('booking:write')) return true;
    return false;
  };

  return SETTINGS_GROUPS
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => hasPermission(item.permission)),
    }))
    .filter((group) => group.items.length > 0);
}
