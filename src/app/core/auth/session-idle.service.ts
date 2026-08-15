import { Injectable, signal } from '@angular/core';
import { Subscription } from 'rxjs';

import { AuthService } from './auth.service';
import {
  SESSION_LAST_ACTIVITY_KEY,
  SESSION_MANUAL_LOCK_KEY,
  SESSION_LOCK_AFTER_MS,
  SESSION_LOGOUT_AFTER_MS,
} from './session-timeout.constants';

@Injectable({ providedIn: 'root' })
export class SessionIdleService {
  readonly locked = signal(false);
  readonly logoutRemainingMs = signal(SESSION_LOGOUT_AFTER_MS);

  readonly lockAfterMs = SESSION_LOCK_AFTER_MS;
  readonly logoutAfterMs = SESSION_LOGOUT_AFTER_MS;

  private started = false;
  private authenticated = false;
  private endingSession = false;
  private lastActivityAt = 0;
  private lastPersistedAt = 0;
  private checkTimer: ReturnType<typeof setInterval> | null = null;
  private tokenSubscription: Subscription | null = null;

  private readonly activityEvents: Array<keyof WindowEventMap> = [
    'pointerdown',
    'pointermove',
    'keydown',
    'wheel',
    'touchstart',
  ];

  constructor(private readonly auth: AuthService) {}

  start(): void {
    if (this.started || typeof window === 'undefined') return;
    this.started = true;

    for (const eventName of this.activityEvents) {
      window.addEventListener(eventName, this.handleActivity, { passive: true });
    }

    window.addEventListener('focus', this.handleWindowFocus, { passive: true });
    window.addEventListener('storage', this.handleStorage);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);

    this.tokenSubscription = this.auth.accessToken$.subscribe((token) => {
      const nextAuthenticated = Boolean(token);

      if (nextAuthenticated && !this.authenticated) {
        this.authenticated = true;
        this.endingSession = false;
        this.initializeAuthenticatedSession();
        return;
      }

      if (!nextAuthenticated && this.authenticated) {
        this.authenticated = false;
        this.resetState();
      }
    });

    this.checkTimer = setInterval(() => this.evaluateIdleState(), 1000);
  }

  stop(): void {
    if (!this.started || typeof window === 'undefined') return;

    for (const eventName of this.activityEvents) {
      window.removeEventListener(eventName, this.handleActivity);
    }

    window.removeEventListener('focus', this.handleWindowFocus);
    window.removeEventListener('storage', this.handleStorage);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);

    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }

    this.tokenSubscription?.unsubscribe();
    this.tokenSubscription = null;
    this.started = false;
  }

  lockNow(): void {
    if (!this.authenticated || this.endingSession) return;

    const now = Date.now();
    this.lastActivityAt = now;
    this.persistLastActivity(now, true);
    localStorage.setItem(SESSION_MANUAL_LOCK_KEY, String(now));
    this.locked.set(true);
    this.logoutRemainingMs.set(SESSION_LOGOUT_AFTER_MS);
  }

  markUnlocked(): void {
    if (!this.authenticated) return;

    const now = Date.now();
    this.lastActivityAt = now;
    this.persistLastActivity(now, true);
    localStorage.removeItem(SESSION_MANUAL_LOCK_KEY);
    this.locked.set(false);
    this.logoutRemainingMs.set(SESSION_LOGOUT_AFTER_MS);
  }

  private initializeAuthenticatedSession(): void {
    const storedActivity = this.readStoredActivity();
    const now = Date.now();

    this.lastActivityAt = storedActivity > 0 ? storedActivity : now;
    if (!storedActivity) {
      this.persistLastActivity(now, true);
    }

    if (localStorage.getItem(SESSION_MANUAL_LOCK_KEY)) {
      this.locked.set(true);
    }

    this.evaluateIdleState();
  }

  private readonly handleActivity = (): void => {
    if (!this.authenticated || this.locked() || this.endingSession) return;

    const now = Date.now();
    this.lastActivityAt = now;
    this.logoutRemainingMs.set(SESSION_LOGOUT_AFTER_MS);
    this.persistLastActivity(now);
  };

  private readonly handleWindowFocus = (): void => {
    if (!this.authenticated) return;
    this.evaluateIdleState();

    if (!this.locked()) {
      this.handleActivity();
    }
  };

  private readonly handleVisibilityChange = (): void => {
    if (document.visibilityState !== 'visible' || !this.authenticated) return;
    this.evaluateIdleState();
  };

  private readonly handleStorage = (event: StorageEvent): void => {
    if (event.key === SESSION_LAST_ACTIVITY_KEY && event.newValue) {
      const timestamp = Number(event.newValue);
      if (Number.isFinite(timestamp) && timestamp > this.lastActivityAt) {
        this.lastActivityAt = timestamp;
        this.evaluateIdleState();
      }
      return;
    }

    if (event.key === SESSION_MANUAL_LOCK_KEY) {
      if (event.newValue) {
        this.locked.set(true);
        return;
      }

      // Unlocks are shared across tabs after successful reauthentication.
      // Re-evaluate first so a genuinely idle tab cannot be reopened by accident.
      const idleFor = Math.max(0, Date.now() - this.lastActivityAt);
      if (idleFor < SESSION_LOCK_AFTER_MS) {
        this.locked.set(false);
      }
      this.evaluateIdleState();
      return;
    }

    // Another tab cleared the shared access token, which means the browser
    // session has ended there too. Hard-navigate this tab to the login page.
    if (event.key === 'px_access_token' && event.newValue === null && this.authenticated) {
      this.auth.endSessionAndRedirect('expired');
    }
  };

  private evaluateIdleState(): void {
    if (!this.authenticated || this.endingSession) return;

    const now = Date.now();
    const idleFor = Math.max(0, now - this.lastActivityAt);
    const remaining = Math.max(0, SESSION_LOGOUT_AFTER_MS - idleFor);
    this.logoutRemainingMs.set(remaining);

    if (idleFor >= SESSION_LOGOUT_AFTER_MS) {
      this.endingSession = true;
      this.auth.logoutAndRedirect('idle');
      return;
    }

    if (idleFor >= SESSION_LOCK_AFTER_MS) {
      this.locked.set(true);
    }
  }

  private persistLastActivity(timestamp: number, force = false): void {
    // Pointer movement can be very noisy. Keep the in-memory timestamp exact,
    // but only sync it across tabs/storage every couple of seconds.
    if (!force && timestamp - this.lastPersistedAt < 2000) return;

    this.lastPersistedAt = timestamp;
    localStorage.setItem(SESSION_LAST_ACTIVITY_KEY, String(timestamp));
  }

  private readStoredActivity(): number {
    const raw = localStorage.getItem(SESSION_LAST_ACTIVITY_KEY);
    if (!raw) return 0;

    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }

  private resetState(): void {
    this.locked.set(false);
    this.logoutRemainingMs.set(SESSION_LOGOUT_AFTER_MS);
    this.lastActivityAt = 0;
    this.lastPersistedAt = 0;
    this.endingSession = false;
  }
}
