import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot, UrlTree } from '@angular/router';

import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly router: Router,
  ) {}

  async canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Promise<boolean | UrlTree> {
    await this.auth.bootstrap();

    if (!this.auth.isAuthenticated()) {
      return this.router.createUrlTree(['/login'], {
        queryParams: { returnUrl: state.url },
      });
    }

    const required = this.requiredPermissions(route);
    if (!required.length) return true;

    const mode = route.data?.['permissionMode'] === 'any' ? 'any' : 'all';
    const allowed = mode === 'any'
      ? this.auth.hasAnyPermission(required)
      : this.auth.hasEveryPermission(required);

    return allowed ? true : this.router.createUrlTree(['/settings/profile/my-profile']);
  }

  private requiredPermissions(route: ActivatedRouteSnapshot): string[] {
    const direct = route.data?.['permission'];
    const multiple = route.data?.['permissions'];

    if (typeof direct === 'string' && direct.trim()) return [direct.trim()];
    if (Array.isArray(multiple)) {
      return multiple.filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
    }
    return [];
  }
}
