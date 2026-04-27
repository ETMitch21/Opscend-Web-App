import { CommonModule } from '@angular/common';
import { Component, HostListener, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, firstValueFrom, Subscription } from 'rxjs';
import {
  BookOpenIcon,
  CalendarClockIcon,
  CircleUserRoundIcon,
  LayoutDashboard,
  LogOutIcon,
  LucideAngularModule,
  LucideIconData,
  MenuIcon,
  SearchIcon,
  UsersIcon,
  UserIcon,
  WrenchIcon,
  BoxIcon,
  BlocksIcon,
  BellIcon,
  XIcon
} from 'lucide-angular';
import { AuthService } from '../../core/auth/auth.service';
import { ManageDevicesModalComponent } from '../modals/manage-devices-modal-component/manage-devices-modal-component';
import { GlobalSearchResponse, SearchItem, SearchService } from '../../core/search/search-service';
import { InternalNotificationService } from '../../core/internal-notifications/internal-notification.service';
import type {
  InternalNotification,
  InternalNotificationEvent,
} from '../../core/internal-notifications/internal-notification.types';

type NavItem = {
  label: string;
  route: string;
  icon: LucideIconData;
};

type SearchSection = {
  key: 'customers' | 'repairs' | 'appointments';
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
    ManageDevicesModalComponent
  ],
  templateUrl: './app-shell-component.html',
  styleUrl: './app-shell-component.scss',
})
export class AppShellComponent implements OnInit, OnDestroy {
  private auth = inject(AuthService);
  private router = inject(Router);
  private searchService = inject(SearchService);
  private internalNotificationService = inject(InternalNotificationService);

  readonly bookOpenIcon = BookOpenIcon;
  readonly MenuIcon = MenuIcon;
  readonly xIcon = XIcon;
  readonly circleUserRoundIcon = CircleUserRoundIcon;
  readonly logoutIcon = LogOutIcon;
  readonly searchIcon = SearchIcon;
  readonly wrenchIcon = WrenchIcon;
  readonly usersIcon = UsersIcon;
  readonly userIcon = UserIcon;
  readonly boxesIcon = BoxIcon;
  readonly blocksIcon = BlocksIcon;
  readonly calendarClockIcon = CalendarClockIcon;
  readonly bellIcon = BellIcon;

  private readonly notificationPollMs = 15_000;
  private routerEventsSubscription: Subscription | null = null;

  layoutDashboardIcon: LucideIconData = LayoutDashboard;

  public sidebarOpen = signal(false);
  public profileMenuOpen = signal(false);

  public notificationMenuOpen = signal(false);
  public notificationsLoading = signal(false);
  public notifications = signal<InternalNotification[]>([]);
  public unreadNotificationCount = signal(0);

  private notificationRefreshTimer: ReturnType<typeof setInterval> | null = null;

  public searchQuery = signal('');
  public searchOpen = signal(false);
  public searchLoading = signal(false);
  public searchTouched = signal(false);

  public searchResults = signal<GlobalSearchResponse>({
    customers: [],
    repairs: [],
    appointments: [],
  });

  public activeSearchIndex = signal(-1);

  public navItems: NavItem[] = [
    { label: 'Dashboard', route: '/dashboard', icon: this.layoutDashboardIcon },
    { label: 'Products', route: '/products', icon: this.boxesIcon },
    { label: 'Customers', route: '/customers', icon: this.usersIcon },
    { label: 'Repairs', route: '/repairs', icon: this.wrenchIcon }
  ];

  private searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private lastRequestedQuery = '';
  private lastCompletedQuery = '';
  private requestSequence = 0;

  async ngOnInit(): Promise<void> {
    if (this.auth.getAccessToken() && !this.auth.getCurrentUser()) {
      await this.auth.loadMe();
    }

    if (this.auth.getAccessToken()) {
      await this.loadInternalNotifications();
      this.startNotificationPolling();
    }

    this.routerEventsSubscription = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(() => {
        if (this.auth.getAccessToken()) {
          void this.refreshNotificationsInBackground();
        }
      });
  }

  ngOnDestroy(): void {
    if (this.notificationRefreshTimer) {
      clearInterval(this.notificationRefreshTimer);
      this.notificationRefreshTimer = null;
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

  openSidebar(): void {
    this.sidebarOpen.set(true);
  }

  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  toggleProfileMenu(event?: MouseEvent): void {
    event?.stopPropagation();
    this.notificationMenuOpen.set(false);
    this.profileMenuOpen.update(open => !open);
  }

  closeProfileMenu(): void {
    this.profileMenuOpen.set(false);
  }

  goToShopNotifications(): void {
    this.closeProfileMenu();
    this.router.navigate(['/settings/shop/notifications']);
  }

  goToMyAvailability(): void {
    this.closeProfileMenu();
    this.router.navigate(['/settings/profile/my-availability']);
  }

  goToShopAvailability(): void {
    this.closeProfileMenu();
    this.router.navigate(['/settings/shop/availability']);
  }

  goToShopSettings(): void {
    this.closeProfileMenu();
    this.router.navigate(['/settings/shop/general']);
  }

  goToShopIntegrations(): void {
    this.closeProfileMenu();
    this.router.navigate(['/settings/integrations']);
  }

  goToShopUsers(): void {
    this.closeProfileMenu();
    this.router.navigate(['/settings/shop/users']);
  }

  goToMyProfile(): void {
    this.closeProfileMenu();
    this.router.navigate(['/settings/profile/my-profile']);
  }

  logout(): void {
    console.log('Component logout called');
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
    this.profileMenuOpen.set(false);
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

    if (notification.repairId) {
      this.router.navigate(['/repairs/detail', notification.repairId]);
    }
  }

  prettyInternalNotificationEvent(event: InternalNotificationEvent): string {
    switch (event) {
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
    this.searchOpen.set(false);
    this.activeSearchIndex.set(-1);
    this.clearResultsOnly();
    this.lastRequestedQuery = '';
  }

  clearResultsOnly(): void {
    this.searchResults.set({
      customers: [],
      repairs: [],
      appointments: [],
    });
  }

  resetSearchUi(): void {
    this.searchLoading.set(false);
    this.searchOpen.set(false);
    this.activeSearchIndex.set(-1);
    this.clearResultsOnly();
    this.lastRequestedQuery = '';
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

    this.searchService.search(trimmedQuery, 5).subscribe({
      next: (results) => {
        if (currentRequestId !== this.requestSequence) {
          return;
        }

        if (this.searchQuery().trim() !== trimmedQuery) {
          return;
        }

        this.searchResults.set(results);
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
        this.searchLoading.set(false);
        this.searchOpen.set(true);
        this.activeSearchIndex.set(-1);
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
      results.appointments.length
    );
  }

  searchSections(): SearchSection[] {
    const results = this.searchResults();

    const sections: SearchSection[] = [
      { key: 'customers', label: 'Customers', items: results.customers },
      { key: 'repairs', label: 'Repairs', items: results.repairs },
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
      default:
        return '';
    }
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

  @HostListener('document:click')
  onDocumentClick(): void {
    this.closeProfileMenu();
    this.closeNotificationMenu();
    this.closeSearchDropdown();
  }
  @HostListener('document:visibilitychange')
  onVisibilityChange(): void {
    if (document.visibilityState === 'visible') {
      void this.refreshNotificationsInBackground();
    }
  }
}