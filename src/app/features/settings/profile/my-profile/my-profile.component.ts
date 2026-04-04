import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { UsersStore } from '../../../../core/users/users-store';
import { AuthService } from '../../../../core/auth/auth.service';
import { ToastService } from '../../../../core/toast/toast-service';

@Component({
  selector: 'app-profile-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './my-profile.component.html',
})
export class MyProfileComponent implements OnInit {
  private fb = inject(FormBuilder);
  private usersStore = inject(UsersStore);
  private auth = inject(AuthService);
  private toastService = inject(ToastService);

  readonly loading = signal(true);
  readonly saving = signal(false);

  readonly profile = computed(() => this.usersStore.currentUser());

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    phone: ['', [Validators.maxLength(30)]],
    notes: ['', [Validators.maxLength(5000)]],
  });

  ngOnInit(): void {
    this.loadProfile();
  }

  async loadProfile(): Promise<void> {
    this.loading.set(true);

    try {
      const profile = await this.usersStore.loadMe();

      this.form.patchValue({
        name: profile.name ?? '',
        phone: profile.phone ?? '',
        notes: profile.notes ?? '',
      });
    } catch {
      this.toastService.error('Unable to load your profile right now.');
    } finally {
      this.loading.set(false);
    }
  }

  async save(): Promise<void> {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);

    try {
      const raw = this.form.getRawValue();

      const updated = await this.usersStore.updateMe({
        name: raw.name.trim(),
        phone: raw.phone.trim() ? raw.phone.trim() : null,
        notes: raw.notes.trim() ? raw.notes.trim() : null,
      });

      this.toastService.success('Profile updated.');

      const currentAuthUser = this.auth.getCurrentUser();
      if (currentAuthUser) {
        this.auth.setCurrentUser({
          ...currentAuthUser,
          name: updated.name,
          email: updated.email ?? '',
        });
      }
    } catch {
      this.toastService.error('Unable to save your profile right now.');
    } finally {
      this.saving.set(false);
    }
  }
}