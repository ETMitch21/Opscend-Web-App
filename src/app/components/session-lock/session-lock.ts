import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import {
  LoaderCircleIcon,
  LockKeyholeIcon,
  LogOutIcon,
  LucideAngularModule,
} from 'lucide-angular';

import { AuthService } from '../../core/auth/auth.service';
import { SessionIdleService } from '../../core/auth/session-idle.service';

@Component({
  selector: 'app-session-lock',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, LucideAngularModule],
  templateUrl: './session-lock.html',
})
export class SessionLockComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  readonly idle = inject(SessionIdleService);

  readonly lockIcon = LockKeyholeIcon;
  readonly logoutIcon = LogOutIcon;
  readonly loadingIcon = LoaderCircleIcon;

  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly user = toSignal(this.auth.currentUser$, { initialValue: this.auth.getCurrentUser() });
  readonly displayName = computed(() => this.user()?.name?.trim() || 'Signed in user');
  readonly email = computed(() => this.user()?.email ?? '');
  readonly initials = computed(() => {
    const parts = this.displayName().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'U';
    return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('');
  });

  readonly form = this.fb.nonNullable.group({
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  async unlock(): Promise<void> {
    if (this.form.invalid || this.submitting()) return;

    this.submitting.set(true);
    this.errorMessage.set(null);

    try {
      await firstValueFrom(this.auth.unlock(this.form.controls.password.value));
      this.form.reset();
      this.idle.markUnlocked();
    } catch (error) {
      const httpError = error instanceof HttpErrorResponse ? error : null;
      const apiError = httpError?.error?.error;

      if (httpError?.status === 401 && apiError === 'session_expired') {
        this.auth.endSessionAndRedirect('expired');
        return;
      }

      this.form.controls.password.setValue('');
      this.form.controls.password.markAsTouched();
      this.errorMessage.set(
        httpError?.status === 401
          ? 'That password is not correct.'
          : 'We could not unlock your session. Try again.',
      );
    } finally {
      this.submitting.set(false);
    }
  }

  signOut(): void {
    if (this.submitting()) return;
    this.auth.logoutAndRedirect('manual');
  }

  remainingTime(): string {
    const totalSeconds = Math.max(0, Math.ceil(this.idle.logoutRemainingMs() / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }
}
