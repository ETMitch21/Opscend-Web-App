import { CommonModule } from '@angular/common';
import { Component, computed, ElementRef, HostListener, inject, OnDestroy, OnInit, signal, ViewChild } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, firstValueFrom, Subscription } from 'rxjs';
import {
  BookOpenIcon,
  CalendarClockIcon,
  CircleUserRoundIcon,
  LayoutDashboard,
  BarChart3,
  LogOutIcon,
  LucideAngularModule,
  LucideIconData,
  MenuIcon,
  SearchIcon,
  UsersIcon,
  WrenchIcon,
  WalletCardsIcon,
  BoxIcon,
  BlocksIcon,
  BellIcon,
  XIcon,
  ToolboxIcon,
  PackageIcon,
  ShoppingCartIcon,
  ChevronDownIcon,
  HandshakeIcon,
  MessageSquareQuote,
  InboxIcon,
  SmartphoneIcon,
  ListTodo,
  AlertTriangle,
  Zap,
  ClipboardList,
  Gauge,
  Bot,
  MapPinIcon,
  CheckIcon,
  LoaderCircleIcon,
} from 'lucide-angular';
import { AccessibleLocation, AuthService } from '../../core/auth/auth.service';
import { ManageDevicesModalComponent } from '../modals/manage-devices-modal-component/manage-devices-modal-component';
import { GlobalSearchResponse, SearchItem, SearchService } from '../../core/search/search-service';
import { InternalNotificationService } from '../../core/internal-notifications/internal-notification.service';
import type {
  InternalNotification,
  InternalNotificationEvent,
} from '../../core/internal-notifications/internal-notification.types';
import { BookingAdminService } from '../../core/booking/service';
import { CommunicationService } from '../../core/communications/service';
import { ToastService } from '../../core/toast/toast-service';
import { WorkQueueService } from '../../core/work-queue/service';
import type { WorkQueueItem, WorkQueueSummary } from '../../core/work-queue/model';
import { AiAssistant } from '../../features/ai-assistant/ai-assistant';

type NavItem = {
  label: string;
  route?: string;
  icon: LucideIconData;
  badgeCount?: () => number;
  ownerOnly?: boolean;
  children?: {
    label: string;
    route: string;
    icon: LucideIconData;
  }[];
};

type SecondaryNavItem = {
  label: string;
  route: string;
  icon: LucideIconData;
  description: string;
  ownerOnly?: boolean;
};

type SecondaryNavGroup = {
  label: string;
  items: SecondaryNavItem[];
};

type SearchSection = {
  key:
    | 'customers'
    | 'repairs'
    | 'devices'
    | 'quotes'
    | 'orders'
    | 'conversations'
    | 'forms'
    | 'knowledgeArticles'
    | 'products'
    | 'purchaseOrders'
    | 'appointments';
  label: string;
  items: SearchItem[];
};

type FlatSearchRow =
  | {
    kind: 'item';
    sectionKey: SearchSection['key'];
    sectionLabel: string;
    item: SearchItem;
  };

@Component({
  selector: 'app-shell',
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    LucideAngularModule,
    ManageDevicesModalComponent,
    AiAssistant,
  ],
  templateUrl: './app-shell-component.html',
  styleUrl: './app-shell-component.scss',
})
export class AppShellComponent implements OnInit, OnDestroy {
  @ViewChild('globalSearchInput') private globalSearchInput?: ElementRef<HTMLInputElement>;

  private auth = inject(AuthService);
  private router = inject(Router);
  private searchService = inject(SearchService);
  private internalNotificationService = inject(InternalNotificationService);
  private bookingAdminService = inject(BookingAdminService);
  private communicationService = inject(CommunicationService);
  private toast = inject(ToastService);
  private workQueueService = inject(WorkQueueService);
  private readonly currentUser = toSignal(this.auth.currentUser$, {
    initialValue: this.auth.getCurrentUser(),
  });

  readonly bookOpenIcon = BookOpenIcon;
  readonly MenuIcon = MenuIcon;
  readonly xIcon = XIcon;
  readonly circleUserRoundIcon = CircleUserRoundIcon;
  readonly logoutIcon = LogOutIcon;
  readonly searchIcon = SearchIcon;
  readonly wrenchIcon = WrenchIcon;
  readonly usersIcon = UsersIcon;
  readonly boxesIcon = BoxIcon;
  readonly blocksIcon = BlocksIcon;
  readonly calendarClockIcon = CalendarClockIcon;
  readonly bellIcon = BellIcon;
  readonly packageIcon = PackageIcon;
  readonly shoppingCartIcon = ShoppingCartIcon;
  readonly chevronDownIcon = ChevronDownIcon;
  readonly handshakeIcon = HandshakeIcon;
  readonly messageSquareQuoteIcon = MessageSquareQuote;
  readonly inboxIcon = InboxIcon;
  readonly deviceCatalogIcon = SmartphoneIcon;
  readonly walletCardsIcon = WalletCardsIcon;
  readonly toolboxIcon = ToolboxIcon;
  readonly workQueueIcon = ListTodo;
  readonly analyticsIcon = BarChart3;
  readonly automationIcon = Zap;
  readonly formsIcon = ClipboardList;
  readonly technicianDashboardIcon = Gauge;
  readonly aiAssistantIcon = Bot;
  readonly workQueueAlertIcon = AlertTriangle;
  readonly locationIcon = MapPinIcon;
  readonly locationCheckIcon = CheckIcon;
  readonly locationLoadingIcon = LoaderCircleIcon;

  private readonly notificationPollMs = 15_000;
  private readonly communicationPollMs = 5_000;
  private readonly workQueuePollMs = 20_000;
  private routerEventsSubscription: Subscription | null = null;

  layoutDashboardIcon: LucideIconData = LayoutDashboard;

  public newQuoteRequestCount = signal(0);
  public sidebarOpen = signal(false);
  public openNavSections = signal<Record<string, boolean>>({
    Products: false,
  });
  public moreMenuOpen = signal(false);
  public profileMenuOpen = signal(false);
  public locationMenuOpen = signal(false);
  public switchingLocationId = signal<string | null>(null);
  public availableLocations = computed(() => this.currentUser()?.locations ?? []);
  public currentLocation = computed(() =>
    this.availableLocations().find((location) => location.isCurrent) ?? null,
  );
  public showLocationSelector = computed(() => this.availableLocations().length > 1);
  public canManageLocations = computed(() => String(this.currentUser()?.role ?? '').toLowerCase() === 'owner');
  public aiAssistantDrawerOpen = signal(false);

  public notificationMenuOpen = signal(false);
  public notificationsLoading = signal(false);
  public notifications = signal<InternalNotification[]>([]);
  public unreadNotificationCount = signal(0);
  public unreadCommunicationCount = signal(0);
  public workQueueMenuOpen = signal(false);
  public workQueueLoading = signal(false);
  public workQueueSummary = signal<WorkQueueSummary | null>(null);

  private notificationRefreshTimer: ReturnType<typeof setInterval> | null = null;
  private communicationRefreshTimer: ReturnType<typeof setInterval> | null = null;
  private workQueueRefreshTimer: ReturnType<typeof setInterval> | null = null;
  private hasLoadedCommunicationCount = false;
  private lastUnreadCommunicationCount = 0;
  private lastUnreadToastKey: string | null = null;

  public searchQuery = signal('');
  public searchOpen = signal(false);
  public searchLoading = signal(false);
  public searchTouched = signal(false);
  public searchFailed = signal(false);

  public searchResults = signal<GlobalSearchResponse>({
    customers: [],
    repairs: [],
    devices: [],
    quotes: [],
    orders: [],
    conversations: [],
    forms: [],
    knowledgeArticles: [],
    products: [],
    purchaseOrders: [],
    appointments: [],
  });

  public activeSearchIndex = signal(-1);

  public navItems: NavItem[] = [
    { label: 'Dashboard', route: '/dashboard', icon: this.layoutDashboardIcon },
    { label: 'Repairs', route: '/repairs', icon: this.wrenchIcon },
    {
      label: 'Quotes',
      route: '/quote-requests',
      icon: this.messageSquareQuoteIcon,
      badgeCount: () => this.newQuoteRequestCount(),
    },
    { label: 'Customers', route: '/customers', icon: this.usersIcon },
    { label: 'Services', route: '/services', icon: this.toolboxIcon },
    {
      label: 'Products',
      icon: this.boxesIcon,
      children: [
        { label: 'All Products', route: '/products/overview', icon: this.boxesIcon },
        { label: 'Inventory', route: '/products/inventory', icon: this.packageIcon },
        {
          label: 'Purchase Orders',
          route: '/products/inventory/purchase-orders',
          icon: this.shoppingCartIcon,
        },
        {
          label: 'Suppliers',
          route: '/products/inventory/suppliers',
          icon: this.blocksIcon,
        },
      ],
    },
  ];

  public secondaryNavGroups: SecondaryNavGroup[] = [
    {
      label: 'Insights',
      items: [
        {
          label: 'Technician Dashboard',
          route: '/technician-dashboard',
          icon: this.technicianDashboardIcon,
          description: 'Assigned work and technician performance.',
        },
        {
          label: 'Analytics',
          route: '/analytics',
          icon: this.analyticsIcon,
          description: 'Trends, reporting, and business performance.',
        },
      ],
    },
    {
      label: 'Tools',
      items: [
        {
          label: 'Automations',
          route: '/automations',
          icon: this.automationIcon,
          description: 'Rules and actions that keep work moving.',
        },
        {
          label: 'Forms',
          route: '/forms',
          icon: this.formsIcon,
          description: 'Reusable forms, checklists, and submissions.',
        },
        {
          label: 'Knowledge Base',
          route: '/knowledge-base',
          icon: this.bookOpenIcon,
          description: 'Internal articles and shop documentation.',
        },
      ],
    },
    {
      label: 'Team',
      items: [
        {
          label: 'Contractors',
          route: '/contractors',
          icon: this.handshakeIcon,
          description: 'Manage contractor access and assignments.',
        },
        {
          label: 'Contractor Payouts',
          route: '/contractor-payouts',
          icon: this.walletCardsIcon,
          description: 'Review and manage contractor payments.',
        },
      ],
    },
  ];

  get visibleNavItems(): NavItem[] {
    const role = String(this.auth.getCurrentUser()?.role ?? '').toLowerCase();
    return this.navItems.filter((item) => !item.ownerOnly || role === 'owner');
  }

  get visibleSecondaryNavGroups(): SecondaryNavGroup[] {
    const role = String(this.auth.getCurrentUser()?.role ?? '').toLowerCase();

    return this.secondaryNavGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => !item.ownerOnly || role === 'owner'),
      }))
      .filter((group) => group.items.length > 0);
  }

  private searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private lastRequestedQuery = '';
  private lastCompletedQuery = '';
  private requestSequence = 0;

  async ngOnInit(): Promise<void> {
    if (this.auth.getAccessToken() && !this.auth.getCurrentUser()) {
      await this.auth.loadMe();
    }

    if (this.auth.getAccessToken()) {
      await Promise.all([
        this.loadInternalNotifications(),
        this.refreshNewQuoteRequestCount(),
        this.refreshUnreadCommunicationCount({ notify: false }),
        this.refreshWorkQueueSummary(),
      ]);
      this.startNotificationPolling();
      this.startCommunicationPolling();
      this.startWorkQueuePolling();
    }

    this.routerEventsSubscription = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(() => {
        this.aiAssistantDrawerOpen.set(false);
        this.moreMenuOpen.set(false);
        this.locationMenuOpen.set(false);
        if (this.auth.getAccessToken()) {
          void this.refreshNotificationsInBackground();
          void this.refreshNewQuoteRequestCount();
          void this.refreshUnreadCommunicationCount({ notify: false });
          void this.refreshWorkQueueSummary();
        }
      });
  }

  ngOnDestroy(): void {
    if (this.notificationRefreshTimer) {
      clearInterval(this.notificationRefreshTimer);
      this.notificationRefreshTimer = null;
    }

    if (this.communicationRefreshTimer) {
      clearInterval(this.communicationRefreshTimer);
      this.communicationRefreshTimer = null;
    }

    if (this.workQueueRefreshTimer) {
      clearInterval(this.workQueueRefreshTimer);
      this.workQueueRefreshTimer = null;
    }

    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = null;
    }

    if (this.routerEventsSubscription) {
      this.routerEventsSubscription.unsubscribe();
      this.routerEventsSubscription = null;
    }
  }

  openAiAssistantDrawer(event?: MouseEvent): void {
    event?.stopPropagation();
    this.moreMenuOpen.set(false);
    this.profileMenuOpen.set(false);
    this.locationMenuOpen.set(false);
    this.notificationMenuOpen.set(false);
    this.workQueueMenuOpen.set(false);
    this.closeSearchDropdown();
    this.aiAssistantDrawerOpen.set(true);
  }

  closeAiAssistantDrawer(): void {
    this.aiAssistantDrawerOpen.set(false);
  }

  expandAiAssistant(conversationId: string | null): void {
    this.aiAssistantDrawerOpen.set(false);

    if (conversationId) {
      void this.router.navigate(['/ai-assistant'], {
        queryParams: { conversationId },
      });
      return;
    }

    void this.router.navigate(['/ai-assistant']);
  }

  openSidebar(): void {
    this.closeMoreMenu();
    this.sidebarOpen.set(true);
  }

  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  async refreshNewQuoteRequestCount(): Promise<void> {
  try {
    const response = await firstValueFrom(
      this.bookingAdminService.listQuoteRequests({ limit: 100 })
    );

    const count = (response.data ?? []).filter(
      (request) => request.requestStatus === 'new'
    ).length;

    this.newQuoteRequestCount.set(count);
  } catch (error) {
    console.error('Failed to refresh quote request count.', error);
    this.newQuoteRequestCount.set(0);
  }
}

  async refreshUnreadCommunicationCount(options: { notify?: boolean } = {}): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.communicationService.listConversations({ limit: 100, status: 'open' })
      );

      const conversations = response.data ?? [];
      const count = conversations.reduce(
        (sum, conversation) => sum + (conversation.unreadForShopCount ?? 0),
        0,
      );
      const previousCount = this.lastUnreadCommunicationCount;

      this.unreadCommunicationCount.set(count);

      const shouldToast =
        Boolean(options.notify) &&
        this.hasLoadedCommunicationCount &&
        count > previousCount &&
        !this.isCommunicationsRoute();

      if (shouldToast) {
        this.showIncomingCommunicationToast(conversations, count);
      }

      this.lastUnreadCommunicationCount = count;
      this.hasLoadedCommunicationCount = true;
    } catch (error) {
      console.error('Failed to refresh inbox unread count.', error);
      this.unreadCommunicationCount.set(0);
    }
  }


  toggleLocationMenu(event?: MouseEvent): void {
    event?.stopPropagation();
    const willOpen = !this.locationMenuOpen();
    this.locationMenuOpen.set(willOpen);
    this.moreMenuOpen.set(false);
    this.profileMenuOpen.set(false);
    this.notificationMenuOpen.set(false);
    this.workQueueMenuOpen.set(false);
    this.closeSearchDropdown();
  }

  closeLocationMenu(): void {
    this.locationMenuOpen.set(false);
  }

  async switchLocation(location: AccessibleLocation): Promise<void> {
    if (location.isCurrent || this.switchingLocationId()) return;

    this.switchingLocationId.set(location.shopId);

    try {
      await firstValueFrom(this.auth.switchLocation(location.shopId));
      this.closeLocationMenu();
      await this.router.navigateByUrl('/dashboard');
      window.location.reload();
    } catch (error) {
      console.error('Failed to switch locations.', error);
      this.toast.error('Location switch failed', 'Try again in a moment.');
    } finally {
      this.switchingLocationId.set(null);
    }
  }


  toggleMoreMenu(event?: MouseEvent): void {
    event?.stopPropagation();

    const willOpen = !this.moreMenuOpen();
    this.moreMenuOpen.set(willOpen);
    this.profileMenuOpen.set(false);
    this.locationMenuOpen.set(false);
    this.notificationMenuOpen.set(false);
    this.workQueueMenuOpen.set(false);
    this.closeSearchDropdown();
  }

  closeMoreMenu(): void {
    this.moreMenuOpen.set(false);
  }

  navigateToSecondaryRoute(route: string): void {
    this.closeMoreMenu();
    this.closeSidebar();
    void this.router.navigateByUrl(route);
  }

  isMoreMenuActive(): boolean {
    return this.visibleSecondaryNavGroups.some((group) =>
      group.items.some((item) => this.isNavRouteActive(item.route)),
    );
  }

  async refreshWorkQueueSummary(): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.workQueueService.getSummary(),
      );
      this.workQueueSummary.set(response.data);
    } catch (error) {
      console.error('Failed to refresh work queue summary.', error);
    }
  }

  async toggleWorkQueueMenu(event?: MouseEvent): Promise<void> {
    event?.stopPropagation();

    const willOpen = !this.workQueueMenuOpen();
    this.workQueueMenuOpen.set(willOpen);
    this.moreMenuOpen.set(false);
    this.notificationMenuOpen.set(false);
    this.profileMenuOpen.set(false);
    this.closeSearchDropdown();

    if (!willOpen) return;

    this.workQueueLoading.set(true);
    try {
      await this.refreshWorkQueueSummary();
    } finally {
      this.workQueueLoading.set(false);
    }
  }

  closeWorkQueueMenu(): void {
    this.workQueueMenuOpen.set(false);
  }

  goToWorkQueue(event?: MouseEvent): void {
    event?.stopPropagation();
    this.closeWorkQueueMenu();
    this.closeMoreMenu();
    this.closeNotificationMenu();
    this.closeProfileMenu();
    this.closeSearchDropdown();
    this.closeSidebar();
    void this.router.navigate(['/work-queue']);
  }

  openWorkQueueItem(item: WorkQueueItem): void {
    this.closeWorkQueueMenu();
    this.closeSidebar();

    if (item.route) {
      void this.router.navigateByUrl(item.route);
      return;
    }

    void this.router.navigate(['/work-queue']);
  }

  workQueueDueLabel(item: WorkQueueItem): string {
    if (!item.dueAt) return 'No due date';

    const dueAt = new Date(item.dueAt);
    const diffMs = dueAt.getTime() - Date.now();
    const hours = Math.round(Math.abs(diffMs) / 3_600_000);

    if (diffMs < 0) {
      if (hours < 1) return 'Overdue';
      if (hours < 24) return `${hours}h overdue`;
      return `${Math.round(hours / 24)}d overdue`;
    }

    if (hours < 1) return 'Due soon';
    if (hours < 24) return `Due in ${hours}h`;

    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
    }).format(dueAt);
  }

  workQueueItemClass(item: WorkQueueItem): string {
    if (item.priority === 'urgent') {
      return 'bg-rose-50 text-rose-700';
    }

    if (item.priority === 'high') {
      return 'bg-amber-50 text-amber-700';
    }

    return 'bg-app-surface-muted text-app-text-muted';
  }

  goToCommunicationsInbox(event?: MouseEvent): void {
    event?.stopPropagation();
    this.moreMenuOpen.set(false);
    this.profileMenuOpen.set(false);
    this.locationMenuOpen.set(false);
    this.notificationMenuOpen.set(false);
    this.workQueueMenuOpen.set(false);
    this.closeSearchDropdown();
    this.closeSidebar();
    void this.router.navigate(['/communications']);
  }

  toggleProfileMenu(event?: MouseEvent): void {
    event?.stopPropagation();
    this.moreMenuOpen.set(false);
    this.locationMenuOpen.set(false);
    this.notificationMenuOpen.set(false);
    this.workQueueMenuOpen.set(false);
    this.closeSearchDropdown();
    this.profileMenuOpen.update(open => !open);
  }

  closeProfileMenu(): void {
    this.profileMenuOpen.set(false);
  }

  goToShopSettings(): void {
    this.closeProfileMenu();
    void this.router.navigate(['/settings']);
  }

  logout(): void {
    console.log('Component logout called');
    this.closeMoreMenu();
    this.closeProfileMenu();
    this.auth.logout().subscribe({
      next: () => {
        this.router.navigate(['/login']);
      },
      error: () => {
        this.router.navigate(['/login']);
      }
    });
  }

  startNotificationPolling(): void {
    if (this.notificationRefreshTimer) return;

    this.notificationRefreshTimer = setInterval(() => {
      void this.refreshNotificationsInBackground();
    }, this.notificationPollMs);
  }

  startCommunicationPolling(): void {
    if (this.communicationRefreshTimer) return;

    this.communicationRefreshTimer = setInterval(() => {
      void this.refreshUnreadCommunicationCount({ notify: true });
    }, this.communicationPollMs);
  }

  startWorkQueuePolling(): void {
    if (this.workQueueRefreshTimer) return;

    this.workQueueRefreshTimer = setInterval(() => {
      void this.refreshWorkQueueSummary();
    }, this.workQueuePollMs);
  }

  async refreshNotificationsInBackground(): Promise<void> {
    try {
      const unreadResponse = await firstValueFrom(
        this.internalNotificationService.getUnreadCount()
      );

      this.unreadNotificationCount.set(unreadResponse.unreadCount ?? 0);

      if (this.notificationMenuOpen()) {
        const notificationsResponse = await firstValueFrom(
          this.internalNotificationService.listMine()
        );

        this.notifications.set(notificationsResponse.data ?? []);
      }
    } catch (error) {
      console.error('Failed to refresh notifications in background.', error);
    }
  }

  async loadInternalNotifications(): Promise<void> {
    this.notificationsLoading.set(true);

    try {
      const [notificationsResponse, unreadResponse] = await Promise.all([
        firstValueFrom(this.internalNotificationService.listMine()),
        firstValueFrom(this.internalNotificationService.getUnreadCount()),
      ]);

      this.notifications.set(notificationsResponse.data ?? []);
      this.unreadNotificationCount.set(unreadResponse.unreadCount ?? 0);
    } catch (error) {
      console.error('Failed to load internal notifications.', error);
      this.notifications.set([]);
      this.unreadNotificationCount.set(0);
    } finally {
      this.notificationsLoading.set(false);
    }
  }

  async refreshUnreadNotificationCount(): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.internalNotificationService.getUnreadCount()
      );

      this.unreadNotificationCount.set(response.unreadCount ?? 0);
    } catch (error) {
      console.error('Failed to refresh notification count.', error);
    }
  }

  async toggleNotificationMenu(event?: MouseEvent): Promise<void> {
    event?.stopPropagation();

    const willOpen = !this.notificationMenuOpen();

    this.notificationMenuOpen.set(willOpen);
    this.moreMenuOpen.set(false);
    this.profileMenuOpen.set(false);
    this.workQueueMenuOpen.set(false);
    this.closeSearchDropdown();

    if (willOpen) {
      await this.loadInternalNotifications();
    }
  }

  closeNotificationMenu(): void {
    this.notificationMenuOpen.set(false);
  }

  async markNotificationRead(notification: InternalNotification): Promise<void> {
    if (notification.readAt) return;

    try {
      const updated = await firstValueFrom(
        this.internalNotificationService.markRead(notification.id)
      );

      this.notifications.update((items) =>
        items.map((item) => (item.id === updated.id ? updated : item))
      );

      this.unreadNotificationCount.update((count) => Math.max(0, count - 1));
    } catch (error) {
      console.error('Failed to mark notification read.', error);
    }
  }

  async markAllNotificationsRead(): Promise<void> {
    try {
      await firstValueFrom(this.internalNotificationService.markAllRead());

      const now = new Date().toISOString();

      this.notifications.update((items) =>
        items.map((item) => ({
          ...item,
          readAt: item.readAt ?? now,
        }))
      );

      this.unreadNotificationCount.set(0);
    } catch (error) {
      console.error('Failed to mark all notifications read.', error);
    }
  }

  async openNotification(notification: InternalNotification): Promise<void> {
    await this.markNotificationRead(notification);
    this.closeNotificationMenu();

    if (String(notification.event) === 'device_catalog_update_available') {
      this.router.navigate(['/settings/shop/device-catalog']);
      return;
    }

    if (notification.repairId) {
      this.router.navigate(['/repairs/detail', notification.repairId]);
      return;
    }

    if (String(notification.event) === 'form_assigned') {
      this.router.navigate(['/forms']);
    }
  }

  prettyInternalNotificationEvent(event: InternalNotificationEvent): string {
    switch (String(event)) {
      case 'device_catalog_update_available':
        return 'Device Catalog Update Available';
      case 'automation_action':
        return 'Automation Alert';
      case 'form_assigned':
        return 'Form Assigned';
      case 'repair_assigned':
        return 'Repair Assigned';
      case 'repair_unassigned':
        return 'Repair Unassigned';
      case 'repair_reassigned':
        return 'Repair Reassigned';
      case 'appointment_scheduled':
        return 'Appointment Scheduled';
      case 'appointment_rescheduled':
        return 'Appointment Rescheduled';
      case 'appointment_canceled':
        return 'Appointment Canceled';
      case 'contractor_assignment_declined':
        return 'Contractor Declined Repair';

      case 'contractor_assignment_canceled':
        return 'Contractor Canceled Repair';
      default:
        return event;
    }
  }

  formatNotificationDate(value: string | null): string {
    if (!value) return '';

    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value));
  }

  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value ?? '';
    this.searchTouched.set(true);
    this.searchQuery.set(value);
    this.searchFailed.set(false);

    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = null;
    }

    const trimmed = value.trim();

    if (trimmed.length === 0) {
      this.resetSearchUi();
      return;
    }

    this.searchOpen.set(true);
    this.activeSearchIndex.set(-1);

    if (trimmed.length < 2) {
      this.searchLoading.set(false);
      this.clearResultsOnly();
      return;
    }

    if (trimmed === this.lastCompletedQuery) {
      this.searchOpen.set(true);
      return;
    }

    this.searchLoading.set(true);

    this.searchDebounceTimer = setTimeout(() => {
      this.runSearch(trimmed);
    }, 250);
  }

  onSearchFocus(): void {
    this.moreMenuOpen.set(false);
    this.profileMenuOpen.set(false);
    this.locationMenuOpen.set(false);
    this.notificationMenuOpen.set(false);
    this.workQueueMenuOpen.set(false);
    this.searchTouched.set(true);

    if (this.searchQuery().trim().length > 0) {
      this.searchOpen.set(true);
    }
  }

  onSearchKeydown(event: KeyboardEvent): void {
    const rows = this.flatSearchRows();
    const hasRows = rows.length > 0;

    switch (event.key) {
      case 'ArrowDown': {
        if (!this.searchOpen()) {
          this.searchOpen.set(true);
        }

        if (!hasRows) {
          return;
        }

        event.preventDefault();

        const nextIndex =
          this.activeSearchIndex() < rows.length - 1
            ? this.activeSearchIndex() + 1
            : 0;

        this.activeSearchIndex.set(nextIndex);
        return;
      }

      case 'ArrowUp': {
        if (!this.searchOpen()) {
          this.searchOpen.set(true);
        }

        if (!hasRows) {
          return;
        }

        event.preventDefault();

        const nextIndex =
          this.activeSearchIndex() > 0
            ? this.activeSearchIndex() - 1
            : rows.length - 1;

        this.activeSearchIndex.set(nextIndex);
        return;
      }

      case 'Enter': {
        if (!this.searchOpen()) {
          return;
        }

        const activeIndex = this.activeSearchIndex();

        if (hasRows && activeIndex >= 0 && activeIndex < rows.length) {
          event.preventDefault();
          this.navigateFromSearch(rows[activeIndex]!.item.route);
        }

        return;
      }

      case 'Escape': {
        if (this.searchOpen()) {
          event.preventDefault();
          this.closeSearchDropdown();
        }
        return;
      }

      default:
        return;
    }
  }

  openSearchDropdown(): void {
    if (this.searchQuery().trim().length > 0) {
      this.searchOpen.set(true);
    }
  }

  closeSearchDropdown(): void {
    this.searchOpen.set(false);
    this.activeSearchIndex.set(-1);
  }

  clearSearch(): void {
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = null;
    }

    this.searchQuery.set('');
    this.searchTouched.set(false);
    this.searchLoading.set(false);
    this.searchFailed.set(false);
    this.searchOpen.set(false);
    this.activeSearchIndex.set(-1);
    this.clearResultsOnly();
    this.lastRequestedQuery = '';
    this.lastCompletedQuery = '';
  }

  clearResultsOnly(): void {
    this.searchResults.set({
      customers: [],
      repairs: [],
      devices: [],
      quotes: [],
      orders: [],
      conversations: [],
      forms: [],
      knowledgeArticles: [],
      products: [],
      purchaseOrders: [],
      appointments: [],
    });
  }

  resetSearchUi(): void {
    this.searchLoading.set(false);
    this.searchFailed.set(false);
    this.searchOpen.set(false);
    this.activeSearchIndex.set(-1);
    this.clearResultsOnly();
    this.lastRequestedQuery = '';
    this.lastCompletedQuery = '';
  }

  runSearch(trimmedQuery: string): void {
    if (trimmedQuery.length < 2) {
      this.searchLoading.set(false);
      this.clearResultsOnly();
      return;
    }

    if (trimmedQuery === this.lastRequestedQuery && trimmedQuery !== '') {
      return;
    }

    this.lastRequestedQuery = trimmedQuery;
    const currentRequestId = ++this.requestSequence;

    this.searchService.search(trimmedQuery, 4).subscribe({
      next: (results) => {
        if (currentRequestId !== this.requestSequence) {
          return;
        }

        if (this.searchQuery().trim() !== trimmedQuery) {
          return;
        }

        this.searchResults.set(results);
        this.searchFailed.set(false);
        this.searchLoading.set(false);
        this.searchOpen.set(true);
        this.activeSearchIndex.set(this.flatSearchRows().length > 0 ? 0 : -1);
        this.lastCompletedQuery = trimmedQuery;
      },
      error: () => {
        if (currentRequestId !== this.requestSequence) {
          return;
        }

        this.clearResultsOnly();
        this.searchFailed.set(true);
        this.searchLoading.set(false);
        this.searchOpen.set(true);
        this.activeSearchIndex.set(-1);
        this.lastRequestedQuery = '';
      },
    });
  }

  navigateFromSearch(route: string): void {
    this.clearSearch();
    this.router.navigateByUrl(route);
  }

  totalSearchResults(): number {
    const results = this.searchResults();

    return (
      results.customers.length +
      results.repairs.length +
      results.devices.length +
      results.quotes.length +
      results.orders.length +
      results.conversations.length +
      results.forms.length +
      results.knowledgeArticles.length +
      results.products.length +
      results.purchaseOrders.length +
      results.appointments.length
    );
  }

  searchSections(): SearchSection[] {
    const results = this.searchResults();

    const sections: SearchSection[] = [
      { key: 'customers', label: 'Customers', items: results.customers },
      { key: 'repairs', label: 'Repairs', items: results.repairs },
      { key: 'devices', label: 'Devices', items: results.devices },
      { key: 'quotes', label: 'Quotes', items: results.quotes },
      { key: 'orders', label: 'Orders', items: results.orders },
      { key: 'conversations', label: 'Inbox', items: results.conversations },
      { key: 'forms', label: 'Forms & Checklists', items: results.forms },
      { key: 'knowledgeArticles', label: 'Knowledge Base', items: results.knowledgeArticles },
      { key: 'products', label: 'Products', items: results.products },
      { key: 'purchaseOrders', label: 'Purchase Orders', items: results.purchaseOrders },
      { key: 'appointments', label: 'Appointments', items: results.appointments },
    ];

    return sections.filter(section => section.items.length > 0);
  }

  flatSearchRows(): FlatSearchRow[] {
    const rows: FlatSearchRow[] = [];

    for (const section of this.searchSections()) {
      for (const item of section.items) {
        rows.push({
          kind: 'item',
          sectionKey: section.key,
          sectionLabel: section.label,
          item,
        });
      }
    }

    return rows;
  }

  rowFlatIndex(sectionKey: SearchSection['key'], itemId: string): number {
    return this.flatSearchRows().findIndex(
      row => row.sectionKey === sectionKey && row.item.id === itemId
    );
  }

  isRowActive(sectionKey: SearchSection['key'], itemId: string): boolean {
    return this.rowFlatIndex(sectionKey, itemId) === this.activeSearchIndex();
  }

  setActiveSearchRow(sectionKey: SearchSection['key'], itemId: string): void {
    this.activeSearchIndex.set(this.rowFlatIndex(sectionKey, itemId));
  }

  showKeepTypingState(): boolean {
    const trimmed = this.searchQuery().trim();
    return this.searchTouched() && trimmed.length > 0 && trimmed.length < 2;
  }

  showEmptyState(): boolean {
    return (
      this.searchOpen() &&
      !this.searchLoading() &&
      !this.searchFailed() &&
      this.searchQuery().trim().length >= 2 &&
      this.totalSearchResults() === 0
    );
  }

  typeLabel(type: SearchItem['type']): string {
    switch (type) {
      case 'customer':
        return 'Customer';
      case 'repair':
        return 'Repair';
      case 'appointment':
        return 'Appointment';
      case 'device':
        return 'Device';
      case 'quote':
        return 'Quote';
      case 'order':
        return 'Order';
      case 'conversation':
        return 'Inbox';
      case 'form':
        return 'Form';
      case 'knowledge_article':
        return 'Article';
      case 'product':
        return 'Product';
      case 'purchase_order':
        return 'Purchase order';
      default:
        return '';
    }
  }

  searchItemIcon(type: SearchItem['type']): LucideIconData {
    switch (type) {
      case 'customer':
        return this.usersIcon;
      case 'repair':
        return this.wrenchIcon;
      case 'appointment':
        return this.calendarClockIcon;
      case 'device':
        return this.deviceCatalogIcon;
      case 'quote':
        return this.messageSquareQuoteIcon;
      case 'order':
        return this.walletCardsIcon;
      case 'conversation':
        return this.inboxIcon;
      case 'form':
        return this.formsIcon;
      case 'knowledge_article':
        return this.bookOpenIcon;
      case 'product':
        return this.boxesIcon;
      case 'purchase_order':
        return this.shoppingCartIcon;
      default:
        return this.searchIcon;
    }
  }

  showSearchErrorState(): boolean {
    return (
      this.searchOpen() &&
      !this.searchLoading() &&
      this.searchFailed() &&
      this.searchQuery().trim().length >= 2
    );
  }

  searchShortcutLabel(): string {
    if (typeof navigator === 'undefined') return 'Ctrl K';
    return /Mac|iPhone|iPad/i.test(navigator.platform) ? '⌘K' : 'Ctrl K';
  }

  toggleNavSection(label: string): void {
    this.openNavSections.update((sections) => ({
      ...sections,
      [label]: !sections[label],
    }));
  }

  isNavSectionOpen(label: string): boolean {
    const item = this.visibleNavItems.find((navItem) => navItem.label === label);
    return !!this.openNavSections()[label] || (!!item && this.isNavSectionActive(item));
  }

  isNavSectionActive(item: NavItem): boolean {
    if (!item.children?.length) return false;

    return item.children.some((child) => this.isNavRouteActive(child.route));
  }

  isCompactSidebarRoute(): boolean {
    return this.isCommunicationsRoute();
  }

  compactNavRoute(item: NavItem): string | undefined {
    return item.route ?? item.children?.[0]?.route;
  }

  compactNavActive(item: NavItem): boolean {
    return item.children?.length ? this.isNavSectionActive(item) : this.isNavRouteActive(item.route);
  }

  isNavRouteActive(route: string | undefined): boolean {
    if (!route) return false;

    const url = this.router.url.split('?')[0].split('#')[0];

    switch (route) {
      case '/products/overview':
        return (
          url === '/products' ||
          url === '/products/overview' ||
          url.startsWith('/products/detail/')
        );

      case '/products/inventory':
        return url === '/products/inventory';

      case '/products/inventory/purchase-orders':
        return (
          url === '/products/inventory/purchase-orders' ||
          url.startsWith('/products/inventory/purchase-orders/detail/')
        );

      case '/products/inventory/suppliers':
        return url === '/products/inventory/suppliers';

      default:
        return url === route || url.startsWith(`${route}/`);
    }
  }

  private isCommunicationsRoute(): boolean {
    const url = this.router.url.split('?')[0].split('#')[0];
    return url === '/communications' || url.startsWith('/communications/');
  }

  private showIncomingCommunicationToast(
    conversations: Array<{
      id: string;
      customerName: string | null;
      customerEmail: string | null;
      customerPhone: string | null;
      lastMessageAt: string | null;
      lastMessagePreview: string | null;
      lastMessageChannel: string | null;
      lastMessageDirection: string | null;
      unreadForShopCount: number;
    }>,
    unreadCount: number,
  ): void {
    const conversation =
      conversations.find(
        (item) =>
          (item.unreadForShopCount ?? 0) > 0 &&
          item.lastMessageDirection === 'inbound',
      ) ?? conversations.find((item) => (item.unreadForShopCount ?? 0) > 0);

    if (!conversation) return;

    const toastKey = `${conversation.id}:${conversation.lastMessageAt ?? ''}:${unreadCount}`;
    if (toastKey === this.lastUnreadToastKey) return;

    this.lastUnreadToastKey = toastKey;

    const channelLabel =
      conversation.lastMessageChannel === 'email'
        ? 'email'
        : conversation.lastMessageChannel === 'sms'
          ? 'text message'
          : 'message';
    const customerLabel =
      conversation.customerName ||
      conversation.customerPhone ||
      conversation.customerEmail ||
      'Customer';
    const preview = conversation.lastMessagePreview?.trim();

    this.toast.info(
      `New ${channelLabel} from ${customerLabel}`,
      preview ? preview.slice(0, 180) : 'Open Inbox to view the conversation.',
    );
  }


  get userDisplaySubtext(): string {
    const user = this.auth.getCurrentUser();

    if (!user) return '';

    return `${user.role}`;
  }

  get userDisplayName(): string {
    return this.auth.getCurrentUser()?.name ?? 'Signed in user';
  }

  get userDisplayEmail(): string {
    return this.auth.getCurrentUser()?.email ?? '';
  }

  @HostListener('document:keydown', ['$event'])
  focusGlobalSearch(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.aiAssistantDrawerOpen()) {
      event.preventDefault();
      this.closeAiAssistantDrawer();
      return;
    }

    if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'k') return;

    event.preventDefault();
    this.moreMenuOpen.set(false);
    this.profileMenuOpen.set(false);
    this.locationMenuOpen.set(false);
    this.notificationMenuOpen.set(false);
    this.workQueueMenuOpen.set(false);

    queueMicrotask(() => {
      const input = this.globalSearchInput?.nativeElement;
      input?.focus();
      input?.select();

      if (this.searchQuery().trim().length > 0) {
        this.searchOpen.set(true);
      }
    });
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.closeMoreMenu();
    this.closeProfileMenu();
    this.closeLocationMenu();
    this.closeNotificationMenu();
    this.closeWorkQueueMenu();
    this.closeSearchDropdown();
  }
  @HostListener('document:visibilitychange')
  onVisibilityChange(): void {
    if (document.visibilityState === 'visible') {
      void this.refreshNotificationsInBackground();
      void this.refreshNewQuoteRequestCount();
      void this.refreshUnreadCommunicationCount({ notify: true });
      void this.refreshWorkQueueSummary();
    }
  }
}