import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';

import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class OwnerGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly router: Router,
  ) {}

  async canActivate(): Promise<boolean | UrlTree> {
    await this.auth.bootstrap();

    if (!this.auth.isAuthenticated()) {
      return this.router.createUrlTree(['/login'], {
        queryParams: { returnUrl: window.location.pathname },
      });
    }

    if (String(this.auth.getCurrentUser()?.role ?? '').toLowerCase() !== 'owner') {
      return this.router.createUrlTree(['/dashboard']);
    }

    return true;
  }
}
