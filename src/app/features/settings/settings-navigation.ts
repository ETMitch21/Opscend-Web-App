import {
  AlertCircleIcon,
  BellIcon,
  BlocksIcon,
  Building2,
  MapPinIcon,
  PhoneCallIcon,
  CalendarClockIcon,
  CalendarCog,
  DollarSignIcon,
  DownloadIcon,
  LucideIconData,
  SmartphoneIcon,
  UserIcon,
  UsersIcon,
  WalletCardsIcon,
  ShieldCheckIcon,
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
    label: 'Business',
    description: 'Manage your shop identity, team, hours, and customer communication.',
    items: [
      {
        label: 'General',
        description: 'Business details, customer-facing information, and operating defaults.',
        route: '/settings/shop/general',
        icon: Building2,
        permission: 'shops:read',
        keywords: ['shop', 'business', 'identity', 'contact', 'address', 'branding'],
      },
      {
        label: 'Locations',
        description: 'Add operating locations and switch between each location workspace.',
        route: '/settings/shop/locations',
        icon: MapPinIcon,
        permission: 'shops:create',
        keywords: ['multi-location', 'branches', 'stores', 'offices', 'workspace'],
      },
      {
        label: 'Team',
        description: 'Staff access, roles, invitations, and archived team members.',
        route: '/settings/shop/users',
        icon: UsersIcon,
        permission: 'users:read',
        keywords: ['users', 'employees', 'staff', 'roles', 'permissions', 'invite'],
      },
      {
        label: 'Roles & permissions',
        description: 'Choose exactly what each shop role can view and manage.',
        route: '/settings/shop/roles-permissions',
        icon: ShieldCheckIcon,
        permission: 'roles:read',
        keywords: ['roles', 'permissions', 'access', 'security', 'rbac'],
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
        label: 'Notifications',
        description: 'Automated repair updates, sender details, and customer templates.',
        route: '/settings/shop/notifications',
        icon: BellIcon,
        permission: 'notifications:read',
        keywords: ['email', 'sms', 'alerts', 'messages', 'templates'],
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
        description: 'Check orders, balances, inventory, linked records, and automation processing for integrity issues.',
        route: '/settings/shop/system-health',
        icon: AlertCircleIcon,
        permission: 'systemHealth:read',
        keywords: ['health', 'integrity', 'issues', 'diagnostics', 'orders', 'balances', 'inventory', 'automations'],
      },
    ],
  },
  {
    label: 'Booking',
    description: 'Control the customer booking experience, pricing, and supported devices.',
    items: [
      {
        label: 'Public booking',
        description: 'Quote flow, scheduling rules, fallback pricing, and website embed.',
        route: '/settings/shop/shop-bookings',
        icon: CalendarCog,
        permission: 'booking:read',
        keywords: ['appointments', 'quotes', 'schedule', 'embed', 'website', 'booking'],
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
    ],
  },
  {
    label: 'Connections',
    description: 'Connect the services used for sourcing, payments, and payouts.',
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
        label: 'AI phone agent',
        description: 'Answer calls, create exact quotes, capture review requests, and transfer callers.',
        route: '/settings/shop/voice-agent',
        icon: PhoneCallIcon,
        permission: 'voiceAgent:read',
        keywords: ['phone', 'calls', 'twilio', 'openai', 'voice', 'quotes', 'agent'],
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
    return Boolean(resource && granted.has(`${resource}:*`));
  };

  return SETTINGS_GROUPS
    .map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        hasPermission(item.permission),
      ),
    }))
    .filter((group) => group.items.length > 0);
}
