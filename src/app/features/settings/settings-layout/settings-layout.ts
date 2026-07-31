import { CommonModule } from '@angular/common';
import { Component, inject, OnDestroy, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import {
  BellIcon,
  BlocksIcon,
  Building2,
  CalendarClockIcon,
  CalendarCog,
  DollarSignIcon,
  LucideAngularModule,
  LucideIconData,
  SmartphoneIcon,
  UserIcon,
  UsersIcon,
  WalletCardsIcon,
} from 'lucide-angular';

import { AuthService } from '../../../core/auth/auth.service';

type SettingsNavItem = {
  label: string;
  description: string;
  route: string;
  icon: LucideIconData;
  ownerOnly?: boolean;
};

type SettingsNavGroup = {
  label: string;
  description: string;
  items: SettingsNavItem[];
};

@Component({
  selector: 'app-settings-layout',
  standalone: true,
  imports: [CommonModule, RouterLink, LucideAngularModule],
  templateUrl: './settings-layout.html',
})
export class SettingsLayoutComponent implements OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly routerSubscription: Subscription;

  protected readonly activeUrl = signal(this.cleanUrl(this.router.url));

  private readonly groups: SettingsNavGroup[] = [
    {
      label: 'Business',
      description: 'Shop identity, team, hours, and communication',
      items: [
        {
          label: 'General',
          description: 'Core business details, operating defaults, and customer-facing capabilities.',
          route: '/settings/shop/general',
          icon: Building2,
        },
        {
          label: 'Team',
          description: 'Staff access, roles, invitations, and archived accounts.',
          route: '/settings/shop/users',
          icon: UsersIcon,
        },
        {
          label: 'Shop hours',
          description: 'Weekly operating hours and date-specific exceptions.',
          route: '/settings/shop/availability',
          icon: CalendarClockIcon,
        },
        {
          label: 'Notifications',
          description: 'Automated repair emails, sender details, and customer update templates.',
          route: '/settings/shop/notifications',
          icon: BellIcon,
        },
      ],
    },
    {
      label: 'Booking',
      description: 'Public booking, repair pricing, and supported devices',
      items: [
        {
          label: 'Public booking',
          description: 'Quote flow, scheduling rules, fallback pricing, and website embed settings.',
          route: '/settings/shop/shop-bookings',
          icon: CalendarCog,
        },
        {
          label: 'Repair pricing',
          description: 'Repair types, model-specific options, deposits, and booking behavior.',
          route: '/settings/shop/repair-pricing',
          icon: DollarSignIcon,
        },
        {
          label: 'Device catalog',
          description: 'Categories, brands, models, publishing, and master catalog updates.',
          route: '/settings/shop/device-catalog',
          icon: SmartphoneIcon,
        },
      ],
    },
    {
      label: 'Connections',
      description: 'Payments, payouts, and connected providers',
      items: [
        {
          label: 'Integrations',
          description: 'Supplier, payment, and external service connections used by your shop.',
          route: '/settings/integrations',
          icon: BlocksIcon,
        },
        {
          label: 'Payouts',
          description: 'Stripe balances, payout destinations, schedules, and instant payouts.',
          route: '/settings/shop/payouts',
          icon: WalletCardsIcon,
          ownerOnly: true,
        },
      ],
    },
    {
      label: 'Account',
      description: 'Your profile and personal working hours',
      items: [
        {
          label: 'Profile',
          description: 'Your personal details and internal team profile.',
          route: '/settings/profile/my-profile',
          icon: UserIcon,
        },
        {
          label: 'My hours',
          description: 'Your recurring working hours and personal schedule exceptions.',
          route: '/settings/profile/my-availability',
          icon: CalendarClockIcon,
        },
      ],
    },
  ];

  constructor() {
    this.routerSubscription = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => this.activeUrl.set(this.cleanUrl(event.urlAfterRedirects)));
  }

  ngOnDestroy(): void {
    this.routerSubscription.unsubscribe();
  }

  protected get visibleGroups(): SettingsNavGroup[] {
    const role = String(this.auth.getCurrentUser()?.role ?? '').toLowerCase();

    return this.groups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => !item.ownerOnly || role === 'owner'),
      }))
      .filter((group) => group.items.length > 0);
  }

  protected currentGroup(): SettingsNavGroup {
    return (
      this.visibleGroups.find((group) =>
        group.items.some((item) => this.isItemActive(item.route)),
      ) ?? this.visibleGroups[0]!
    );
  }

  protected currentItem(): SettingsNavItem {
    const group = this.currentGroup();
    return group.items.find((item) => this.isItemActive(item.route)) ?? group.items[0]!;
  }

  protected groupRoute(group: SettingsNavGroup): string {
    return group.items[0]?.route ?? '/settings/shop/general';
  }

  protected isGroupActive(group: SettingsNavGroup): boolean {
    return group.items.some((item) => this.isItemActive(item.route));
  }

  protected isItemActive(route: string): boolean {
    return this.activeUrl() === route;
  }

  private cleanUrl(url: string): string {
    return url.split('?')[0]!.split('#')[0]!;
  }
}
