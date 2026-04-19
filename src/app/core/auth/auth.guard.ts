import { Injectable } from "@angular/core";
import { CanActivate, Router, UrlTree } from "@angular/router";
import { AuthService } from "./auth.service";

@Injectable({ providedIn: "root" })
export class AuthGuard implements CanActivate {
  constructor(private auth: AuthService, private router: Router) {}

  async canActivate(): Promise<boolean | UrlTree> {
    await this.auth.bootstrap();

    if (!this.auth.isAuthenticated()) {
      return this.router.createUrlTree(["/login"], {
        queryParams: { returnUrl: window.location.pathname },
      });
    }

    return true;
  }
}