import { CommonModule } from '@angular/common';
import { Component, Input, OnDestroy, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { ArrowLeftIcon, LucideAngularModule } from 'lucide-angular';
import { filter, Subscription } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import {
  SettingsNavItem,
  visibleSettingsGroups,
} from '../settings-navigation';

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

  @Input() pageTitle = '';
  @Input() pageDescription = '';
  @Input() backRoute = '';
  @Input() backLabel = '';

  protected readonly icons = {
    ArrowLeft: ArrowLeftIcon,
  };

  protected readonly activeUrl = signal(this.cleanUrl(this.router.url));

  constructor() {
    this.routerSubscription = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => this.activeUrl.set(this.cleanUrl(event.urlAfterRedirects)));
  }

  ngOnDestroy(): void {
    this.routerSubscription.unsubscribe();
  }

  protected resolvedTitle(): string {
    if (this.pageTitle.trim()) return this.pageTitle.trim();

    const active = this.activeUrl();
    if (active === '/settings/shop/repair-pricing/new') return 'New pricing option';
    if (active === '/settings/shop/repair-pricing/types') return 'Repair types';
    if (active.startsWith('/settings/shop/repair-pricing/')) return 'Edit pricing option';

    return this.currentItem()?.label ?? 'Settings';
  }

  protected resolvedDescription(): string {
    if (this.pageDescription.trim()) return this.pageDescription.trim();

    const active = this.activeUrl();
    if (active === '/settings/shop/repair-pricing/new') {
      return 'Create a model-specific repair option with pricing, parts, deposits, and booking behavior.';
    }
    if (active === '/settings/shop/repair-pricing/types') {
      return 'Manage the shared repair defaults inherited by model-specific pricing options.';
    }
    if (active.startsWith('/settings/shop/repair-pricing/')) {
      return 'Update what customers see, what the repair uses, and what is due when they book.';
    }

    return this.currentItem()?.description ?? '';
  }

  protected resolvedBackRoute(): string {
    if (this.backRoute.trim()) return this.backRoute.trim();

    const active = this.activeUrl();
    if (
      active === '/settings/shop/repair-pricing/new' ||
      active === '/settings/shop/repair-pricing/types' ||
      active.startsWith('/settings/shop/repair-pricing/')
    ) {
      return '/settings/shop/repair-pricing';
    }

    return '/settings';
  }

  protected resolvedBackLabel(): string {
    if (this.backLabel.trim()) return this.backLabel.trim();

    const active = this.activeUrl();
    if (
      active === '/settings/shop/repair-pricing/new' ||
      active === '/settings/shop/repair-pricing/types' ||
      active.startsWith('/settings/shop/repair-pricing/')
    ) {
      return 'Repair pricing';
    }

    return 'Settings';
  }

  private currentItem(): SettingsNavItem | null {
    const active = this.activeUrl();
    const groups = visibleSettingsGroups(this.auth.getCurrentUser()?.role, this.auth.getCurrentUser()?.permissions ?? []);

    return (
      groups
        .flatMap((group) => group.items)
        .find((item) => active === item.route || active.startsWith(`${item.route}/`)) ?? null
    );
  }

  private cleanUrl(url: string): string {
    return url.split('?')[0]!.split('#')[0]!;
  }
}
