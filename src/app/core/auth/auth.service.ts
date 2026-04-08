import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { BehaviorSubject, firstValueFrom, Observable, tap, shareReplay, finalize } from "rxjs";
import { environment } from "../../../environments/environment";

type LoginResponse = { accessToken: string };

export interface CurrentUser {
  id: string;
  shopId: string;
  role: string;
  name: string;
  email: string;
}

@Injectable({ providedIn: "root" })
export class AuthService {
  private readonly tokenKey = "px_access_token";

  private accessTokenSubject = new BehaviorSubject<string | null>(this.getStoredToken());
  accessToken$ = this.accessTokenSubject.asObservable();

  private currentUserSubject = new BehaviorSubject<CurrentUser | null>(null);
  currentUser$ = this.currentUserSubject.asObservable();

  private refreshInFlight$: Observable<LoginResponse> | null = null;

  constructor(private http: HttpClient) {}

  getAccessToken(): string | null {
    return this.accessTokenSubject.value;
  }

  getCurrentUser(): CurrentUser | null {
    return this.currentUserSubject.value;
  }

  getCurrentUserId(): string | null {
    return this.currentUserSubject.value?.id ?? null;
  }

  private getStoredToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  private setStoredToken(token: string | null) {
    if (token) localStorage.setItem(this.tokenKey, token);
    else localStorage.removeItem(this.tokenKey);
  }

  me() {
    return this.http.get<CurrentUser>(`${environment.apiBase}/auth/me`).pipe(
      tap((user) => this.currentUserSubject.next(user))
    );
  }

  async loadMe(): Promise<CurrentUser | null> {
    const token = this.getAccessToken();

    if (!token) {
      this.currentUserSubject.next(null);
      return null;
    }

    try {
      return await firstValueFrom(this.me());
    } catch (error) {
      console.error("Failed to load current user", error);
      this.currentUserSubject.next(null);
      return null;
    }
  }

  login(email: string, password: string) {
    return this.http
      .post<LoginResponse>(
        `${environment.apiBase}/auth/login`,
        { email, password },
        { withCredentials: true }
      )
      .pipe(
        tap((res) => {
          this.setStoredToken(res.accessToken);
          this.accessTokenSubject.next(res.accessToken);
        })
      );
  }

  async loginAndLoadUser(email: string, password: string): Promise<CurrentUser | null> {
    await firstValueFrom(this.login(email, password));
    return await this.loadMe();
  }

  logout() {
    this.setStoredToken(null);
    this.accessTokenSubject.next(null);
    this.currentUserSubject.next(null);

    return this.http.post(`${environment.apiBase}/auth/logout`, {}, { withCredentials: true });
  }

  clearLocalSession() {
    this.setStoredToken(null);
    this.accessTokenSubject.next(null);
    this.currentUserSubject.next(null);
  }

  refresh(): Observable<LoginResponse> {
    if (this.refreshInFlight$) return this.refreshInFlight$;

    this.refreshInFlight$ = this.http
      .post<LoginResponse>(
        `${environment.apiBase}/auth/refresh`,
        {},
        { withCredentials: true }
      )
      .pipe(
        tap((res) => {
          this.setStoredToken(res.accessToken);
          this.accessTokenSubject.next(res.accessToken);
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

  setCurrentUser(user: CurrentUser | null): void {
    this.currentUserSubject.next(user);
  }
}