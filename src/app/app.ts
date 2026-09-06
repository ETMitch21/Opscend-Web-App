import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { NgxSonnerToaster } from 'ngx-sonner';
import { AuthService } from './core/auth/auth.service';
import { AppShellComponent } from "./components/app-shell-component/app-shell-component";
import { SessionLockComponent } from './components/session-lock/session-lock';
import { SessionIdleService } from './core/auth/session-idle.service';
import { filter, Subscription, switchMap } from 'rxjs';
import { ShopContextService } from './core/shop/shop-context.store';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NgxSonnerToaster, AppShellComponent, SessionLockComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit, OnDestroy {
  shopContext = inject(ShopContextService);
  private auth = inject(AuthService);
  private router = inject(Router);
  public readonly sessionIdle = inject(SessionIdleService);
  private routerSubscription: Subscription | null = null;

  public userIsLoggedIn: boolean = false;
  public standalonePublicRoute: boolean = false;

  protected readonly toastOptions = {
    unstyled: true,
    classes: {
      toast:
        'flex flex-between items-center gap-3 group rounded-app-lg border border-app-border bg-app-surface shadow-app-md px-4 py-3 w-full text-app-text',
      title: 'text-sm font-medium text-app-text',
      description: 'mt-1 text-sm text-app-text-muted',
      actionButton:
        'inline-flex h-10 items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white',
      cancelButton:
        'inline-flex h-10 items-center justify-center rounded-xl bg-zinc-100 px-4 text-sm font-medium text-zinc-900',
      closeButton:
        'rounded-full border border-app-border bg-app-surface text-app-text',
      success:
        'border-green-200',
      error:
        'border-red-200',
      warning:
        'border-amber-200',
      info:
        'border-app-border',
    }
  }

  ngOnInit(): void {
    this.updateStandalonePublicRoute(this.router.url);

    this.routerSubscription = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => this.updateStandalonePublicRoute(event.urlAfterRedirects));

    this.auth.bootstrap().then(() => {
      this.sessionIdle.start();

      this.auth.accessToken$.subscribe((token: string | null) => {
        this.userIsLoggedIn = !!token;
      });

      this.auth.currentUser$
        .pipe(
          filter((user) => !!user),
          switchMap(() => this.shopContext.load())
        )
        .subscribe();
    });
  }

  ngOnDestroy(): void {
    this.sessionIdle.stop();
    this.routerSubscription?.unsubscribe();
    this.routerSubscription = null;
  }

  private updateStandalonePublicRoute(url: string): void {
    const path = String(url || '').split('?')[0] || '';
    this.standalonePublicRoute =
      path === '/portal' ||
      path.startsWith('/portal/');
  }
}
