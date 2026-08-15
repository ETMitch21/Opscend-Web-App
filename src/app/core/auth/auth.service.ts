import { inject, Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import {
  BehaviorSubject,
  finalize,
  firstValueFrom,
  Observable,
  shareReplay,
  tap,
  catchError,
  switchMap,
  timeout,
} from "rxjs";
import { AppConfigService } from "../app-config/app-config.service";
import { TenantService } from "../tenant/tenant.service";
import {
  SESSION_LAST_ACTIVITY_KEY,
  SESSION_MANUAL_LOCK_KEY,
  SESSION_SUPPRESS_RESTORE_KEY,
} from "./session-timeout.constants";

type LoginResponse = { accessToken: string };
type AuthStatus = "unknown" | "hydrating" | "authenticated" | "anonymous";
export type SessionEndReason = "manual" | "idle" | "expired";

export interface AccessibleLocation {
  shopId: string;
  name: string;
  legalName: string | null;
  slug: string;
  status: string;
  role: string;
  isCurrent: boolean;
  address: {
    line1: string | null;
    line2: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    country: string | null;
  } | null;
}

export interface CurrentUser {
  id: string;
  shopId: string;
  role: string;
  permissions: string[];
  name: string;
  email: string;
  organization: {
    id: string;
    name: string;
  } | null;
  locations: AccessibleLocation[];
}

export interface CreateLocationInput {
  name: string;
  legalName?: string;
  slug: string;
  timezone?: string;
  phone?: string;
  email?: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
}

@Injectable({ providedIn: "root" })
export class AuthService {
  private readonly appConfig = inject(AppConfigService);
  private readonly tenant = inject(TenantService);

  private readonly tokenKey = "px_access_token";

  private get apiBase(): string {
    return this.appConfig.config.apiBase;
  }

  private accessTokenSubject = new BehaviorSubject<string | null>(this.getStoredToken());
  accessToken$ = this.accessTokenSubject.asObservable();

  private currentUserSubject = new BehaviorSubject<CurrentUser | null>(null);
  currentUser$ = this.currentUserSubject.asObservable();

  private authStatusSubject = new BehaviorSubject<AuthStatus>("unknown");
  authStatus$ = this.authStatusSubject.asObservable();

  private refreshInFlight$: Observable<LoginResponse> | null = null;
  private loadMePromise: Promise<CurrentUser | null> | null = null;
  private bootstrapPromise: Promise<void> | null = null;

  constructor(private http: HttpClient) { }

  signup(data: {
    shopName: string;
    slug: string;
    ownerName: string;
    ownerEmail: string;
    password: string;
  }) {
    return this.http
      .post<{ accessToken: string; shopSlug: string }>(
        `${this.apiBase}/auth/signup-shop`,
        data,
        { withCredentials: true }
      )
      .pipe(
        tap((res) => {
          this.markFreshSessionActivity();
          this.setStoredToken(res.accessToken);
          this.accessTokenSubject.next(res.accessToken);
          this.authStatusSubject.next("authenticated");
        })
      );
  }

  getAccessToken(): string | null {
    return this.accessTokenSubject.value;
  }

  getCurrentUser(): CurrentUser | null {
    return this.currentUserSubject.value;
  }

  getCurrentUserId(): string | null {
    return this.currentUserSubject.value?.id ?? null;
  }

  getPermissions(): string[] {
    return [...(this.currentUserSubject.value?.permissions ?? [])];
  }

  hasPermission(permission: string): boolean {
    const permissions = this.currentUserSubject.value?.permissions ?? [];
    if (permissions.includes('*')) return true;
    if (permissions.includes(permission)) return true;

    const [resource] = permission.split(':');
    return Boolean(resource && permissions.includes(`${resource}:*`));
  }

  hasEveryPermission(permissions: readonly string[]): boolean {
    return permissions.every((permission) => this.hasPermission(permission));
  }

  hasAnyPermission(permissions: readonly string[]): boolean {
    return permissions.some((permission) => this.hasPermission(permission));
  }

  getAuthStats(): AuthStatus {
    return this.authStatusSubject.value;
  }

  isAuthenticated(): boolean {
    return this.authStatusSubject.value === "authenticated";
  }

  private getStoredToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  private setStoredToken(token: string | null) {
    if (token) {
      localStorage.setItem(this.tokenKey, token);
    } else {
      localStorage.removeItem(this.tokenKey);
    }
  }

  me() {
    return this.http.get<CurrentUser>(`${this.apiBase}/auth/me`).pipe(
      tap((user) => {
        const currentLocation = user.locations?.find((location) => location.isCurrent);
        if (currentLocation?.slug) {
          this.tenant.setShopSlug(currentLocation.slug);
        }
        this.currentUserSubject.next(user);
      })
    );
  }

  async loadMe(): Promise<CurrentUser | null> {
    if (this.loadMePromise) return this.loadMePromise;

    this.loadMePromise = this.performLoadMe();

    try {
      return await this.loadMePromise;
    } finally {
      this.loadMePromise = null;
    }
  }

  private async performLoadMe(): Promise<CurrentUser | null> {
    const token = this.getAccessToken();

    if (!token) {
      this.currentUserSubject.next(null);
      this.authStatusSubject.next("anonymous");
      return null;
    }

    try {
      const user = await firstValueFrom(this.me());
      this.authStatusSubject.next("authenticated");
      return user;
    } catch (error) {
      this.currentUserSubject.next(null);
      return null;
    }
  }

  login(email: string, password: string) {
    return this.http
      .post<LoginResponse>(
        `${this.apiBase}/auth/login`,
        { email, password },
        { withCredentials: true }
      )
      .pipe(
        tap((res) => {
          this.markFreshSessionActivity();
          this.setStoredToken(res.accessToken);
          this.accessTokenSubject.next(res.accessToken);
          this.authStatusSubject.next("authenticated");
        })
      );
  }

  async loginAndLoadUser(email: string, password: string): Promise<CurrentUser | null> {
    await firstValueFrom(this.login(email, password));
    return await this.loadMe();
  }

  switchLocation(shopId: string): Observable<{ accessToken: string; location: AccessibleLocation }> {
    return this.http
      .post<{ accessToken: string; location: AccessibleLocation }>(
        `${this.apiBase}/auth/locations/${encodeURIComponent(shopId)}/switch`,
        {},
        { withCredentials: true }
      )
      .pipe(
        tap((response) => {
          this.markFreshSessionActivity();
          this.setStoredToken(response.accessToken);
          this.accessTokenSubject.next(response.accessToken);
          this.tenant.setShopSlug(response.location.slug);
          this.currentUserSubject.next(null);
          this.authStatusSubject.next("authenticated");
        })
      );
  }

  unlock(password: string): Observable<CurrentUser> {
    return this.http
      .post<LoginResponse>(
        `${this.apiBase}/auth/unlock`,
        { password },
        { withCredentials: true }
      )
      .pipe(
        tap((res) => {
          this.setStoredToken(res.accessToken);
          this.accessTokenSubject.next(res.accessToken);
          this.authStatusSubject.next("authenticated");
        }),
        switchMap(() => this.me()),
        tap(() => this.authStatusSubject.next("authenticated"))
      );
  }

  createLocation(input: CreateLocationInput): Observable<{ location: AccessibleLocation }> {
    return this.http.post<{ location: AccessibleLocation }>(
      `${this.apiBase}/auth/locations`,
      input,
      { withCredentials: true }
    );
  }

  requestPasswordReset(email: string) {
    return this.http.post<void>(`${this.apiBase}/auth/password/forgot`, { email });
  }

  resetPassword(token: string, password: string) {
    return this.http.post<void>(`${this.apiBase}/auth/password/reset`, { token, password });
  }

  logout() {
    return this.http
      .post(`${this.apiBase}/auth/logout`, {}, { withCredentials: true })
      .pipe(
        tap(() => this.clearLocalSession()),
        catchError((err) => {
          this.clearLocalSession();
          throw err;
        })
      );
  }

  logoutAndRedirect(reason: SessionEndReason = "manual"): void {
    if (typeof window === "undefined") {
      this.clearLocalSession();
      return;
    }

    const returnUrl = reason === "manual" ? null : this.currentReturnUrl();

    this.http
      .post(`${this.apiBase}/auth/logout`, {}, { withCredentials: true })
      .pipe(
        timeout(3000),
        finalize(() => this.endSessionAndRedirect(reason, returnUrl))
      )
      .subscribe({
        next: () => undefined,
        error: () => undefined,
      });
  }

  endSessionAndRedirect(
    reason: SessionEndReason = "expired",
    returnUrl: string | null = this.currentReturnUrl()
  ): void {
    this.suppressSessionRestore();
    this.clearLocalSession();

    if (typeof window === "undefined") return;

    const params = new URLSearchParams();
    if (reason !== "manual") {
      params.set("reason", reason === "idle" ? "idle" : "session-expired");
    }
    if (returnUrl && returnUrl !== "/login") {
      params.set("returnUrl", returnUrl);
    }

    const query = params.toString();
    window.location.replace(`/login${query ? `?${query}` : ""}`);
  }

  clearLocalSession() {
    if (typeof window !== "undefined") {
      localStorage.removeItem(SESSION_MANUAL_LOCK_KEY);
    }
    this.setStoredToken(null);
    this.accessTokenSubject.next(null);
    this.currentUserSubject.next(null);
    this.authStatusSubject.next("anonymous");

    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem("px_current_user");
    localStorage.removeItem("px_shop");
    localStorage.removeItem(SESSION_LAST_ACTIVITY_KEY);
    this.tenant.resetToHost();

    this.refreshInFlight$ = null;
    this.loadMePromise = null;
  }

  private markFreshSessionActivity(): void {
    if (typeof window === "undefined") return;
    localStorage.removeItem(SESSION_SUPPRESS_RESTORE_KEY);
    localStorage.setItem(SESSION_LAST_ACTIVITY_KEY, String(Date.now()));
  }

  private suppressSessionRestore(): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(SESSION_SUPPRESS_RESTORE_KEY, "1");
  }

  private shouldSuppressSessionRestore(): boolean {
    if (typeof window === "undefined") return false;

    return localStorage.getItem(SESSION_SUPPRESS_RESTORE_KEY) === "1";
  }

  private currentReturnUrl(): string | null {
    if (typeof window === "undefined") return null;

    const path = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    return path.startsWith("/login") ? null : path;
  }

  refresh(): Observable<LoginResponse> {
    if (this.refreshInFlight$) return this.refreshInFlight$;

    this.refreshInFlight$ = this.http
      .post<LoginResponse>(
        `${this.apiBase}/auth/refresh`,
        {},
        { withCredentials: true }
      )
      .pipe(
        tap((res) => {
          this.setStoredToken(res.accessToken);
          this.accessTokenSubject.next(res.accessToken);
          this.authStatusSubject.next("authenticated");
        }),
        shareReplay(1),
        finalize(() => {
          this.refreshInFlight$ = null;
        })
      );

    return this.refreshInFlight$;
  }

  async refreshAndLoadUser(): Promise<CurrentUser | null> {
    await firstValueFrom(this.refresh());
    return await this.loadMe();
  }

  async bootstrap(): Promise<void> {
    if (this.bootstrapPromise) return this.bootstrapPromise;

    this.bootstrapPromise = (async () => {
      this.authStatusSubject.next("hydrating");

      if (this.shouldSuppressSessionRestore()) {
        this.clearLocalSession();
        return;
      }

      try {
        await firstValueFrom(this.refresh());
        await this.loadMe();
        return;
      } catch (error) {
        const storedToken = this.getStoredToken();

        if (storedToken) {
          const user = await this.loadMe();
          if (user) {
            this.authStatusSubject.next("authenticated");
            return;
          }
        }

        this.clearLocalSession();
      }
    })();

    try {
      await this.bootstrapPromise;
    } finally {
      this.bootstrapPromise = null;
    }
  }

  setCurrentUser(user: CurrentUser | null): void {
    this.currentUserSubject.next(user);
  }

  acceptInvite(token: string, password: string) {
    return this.http.post<void>(
      `${this.apiBase}/authInvite/accept`,
      { token, password },
      { withCredentials: true }
    );
  }
}