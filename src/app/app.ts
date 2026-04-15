import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TenantService } from './core/tenant/tenant.service';
import { NgxSonnerToaster } from 'ngx-sonner';
import { AuthService } from './core/auth/auth.service';
import { AppShellComponent } from "./components/app-shell-component/app-shell-component";
import { filter, switchMap } from 'rxjs';
import { ShopContextService } from './core/shop/shop-context.store';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NgxSonnerToaster, AppShellComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  private tenantService = inject(TenantService);
  shopContext = inject(ShopContextService);
  private auth = inject(AuthService);

  public userIsLoggedIn: boolean = false;

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
    this.auth.refresh().subscribe({
      error: () => this.auth.clearLocalSession()
    });
    this.auth.accessToken$.subscribe((token: string | null) => {
      this.userIsLoggedIn = token ? true : false;
      token ?? this.auth.loadMe()
    });
    this.auth.currentUser$
      .pipe(
        filter((user) => !!user),
        switchMap(() => this.shopContext.load())
      )
      .subscribe();
    this.tenantService.init();
  }
}
