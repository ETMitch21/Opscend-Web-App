import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import { UsersStore } from '../../../core/users/users-store';
import { AuthService } from '../../../core/auth/auth.service';
import { User } from '../../../core/users/users.model';

@Component({
  selector: 'app-shop-users-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './shop-users.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShopUsers implements OnInit {
  private fb = inject(FormBuilder);
  protected usersStore = inject(UsersStore);
  private auth = inject(AuthService);

  protected search = signal('');
  protected includeArchived = signal(false);
  protected selectedUserId = signal<string | null>(null);
  protected createExpanded = signal(false);
  protected savingSelectedUser = signal(false);
  protected creatingUser = signal(false);
  protected actioningUserId = signal<string | null>(null);
  protected pageSize = 25;

  protected currentAuthUserId = computed(() => this.auth.getCurrentUserId());

  protected users = computed(() => this.usersStore.users());
  protected loading = computed(() => this.usersStore.loading());
  protected error = computed(() => this.usersStore.error());
  protected nextCursor = computed(() => this.usersStore.nextCursor());

  protected filteredUsers = computed(() => {
  const term = this.search().trim().toLowerCase();
  const currentUserId = this.auth.getCurrentUserId();

  return this.users().filter((user) => {
    // always hide me
    if (currentUserId && user.id === currentUserId) return false;

    if (!this.includeArchived() && this.isArchived(user)) return false;

    if (!term) return true;

    const haystack = [
      user.name,
      user.email ?? '',
      user.phone ?? '',
      user.role,
      user.status,
      ...(user.tags ?? []),
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(term);
  });
});

  protected selectedUser = computed(() => {
  const id = this.selectedUserId();
  const currentUserId = this.auth.getCurrentUserId();

  if (!id) return null;
  if (currentUserId && id === currentUserId) return null;

  return this.filteredUsers().find((user) => user.id === id) ?? null;
});

  protected createForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    email: ['', [Validators.email]],
    phone: [''],
    role: ['staff', [Validators.required]],
    status: ['active', [Validators.required]],
    sendInvite: [false],
    tagsText: [''],
    notes: [''],
  });

  protected editForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    email: ['', [Validators.email]],
    phone: [''],
    role: ['staff', [Validators.required]],
    status: ['active', [Validators.required]],
    tagsText: [''],
    notes: [''],
  });

  async ngOnInit(): Promise<void> {
  // Ensure the auth user is hydrated first so self-filtering actually works
  if (!this.auth.getCurrentUserId()) {
    try {
      await this.auth.loadMe();
    } catch {
      // ignore here; normal auth flow/interceptor can handle failures
    }
  }

  await this.usersStore.load({
    limit: this.pageSize,
    includeDeleted: this.includeArchived(),
  });

  const firstUser = this.filteredUsers()[0];
  if (firstUser) {
    this.selectUser(firstUser);
  }
}

  protected async reloadUsers(): Promise<void> {
    const currentSelection = this.selectedUserId();

    await this.usersStore.load({
      limit: this.pageSize,
      includeDeleted: this.includeArchived(),
    });

    const selectedStillExists = this.filteredUsers().some(
      (user) => user.id === currentSelection
    );

    if (selectedStillExists && currentSelection) {
      const selected = this.filteredUsers().find((user) => user.id === currentSelection) ?? null;
      this.selectedUserId.set(currentSelection);
      if (selected) this.patchEditForm(selected);
      return;
    }

    const next = this.filteredUsers()[0] ?? null;
    if (next) {
      this.selectUser(next);
    } else {
      this.selectedUserId.set(null);
      this.editForm.reset({
        name: '',
        email: '',
        phone: '',
        role: 'staff',
        status: 'active',
        tagsText: '',
        notes: '',
      });
    }
  }

  protected async onArchivedToggle(): Promise<void> {
    await this.reloadUsers();
  }

  protected selectUser(user: User): void {
    if (this.isSelf(user)) return;

    this.selectedUserId.set(user.id);
    this.patchEditForm(user);
  }

  protected toggleCreate(): void {
    this.createExpanded.update((value) => !value);

    if (!this.createExpanded()) {
      this.resetCreateForm();
    }
  }

  protected async createUser(): Promise<void> {
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }

    try {
      this.creatingUser.set(true);

      const raw = this.createForm.getRawValue();
      const created = await this.usersStore.create({
        name: raw.name.trim(),
        email: this.undefinedIfBlank(raw.email),
        phone: this.undefinedIfBlank(raw.phone),
        role: raw.role,
        status: raw.status,
        sendInvite: raw.sendInvite,
        tags: this.parseTags(raw.tagsText),
        notes: this.undefinedIfBlank(raw.notes),
      });

      this.resetCreateForm();
      this.createExpanded.set(false);

      if (!this.isSelf(created)) {
        this.selectUser(created);
      } else {
        await this.reloadUsers();
      }
    } finally {
      this.creatingUser.set(false);
    }
  }

  protected async saveSelectedUser(): Promise<void> {
    const selected = this.selectedUser();
    if (!selected || this.isSelf(selected)) return;

    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }

    try {
      this.savingSelectedUser.set(true);

      const raw = this.editForm.getRawValue();
      const updated = await this.usersStore.update(selected.id, {
        name: raw.name.trim(),
        email: this.nullIfBlank(raw.email),
        phone: this.nullIfBlank(raw.phone),
        role: raw.role,
        status: raw.status,
        tags: this.parseTags(raw.tagsText),
        notes: this.nullIfBlank(raw.notes),
      });

      if (!this.isSelf(updated)) {
        this.patchEditForm(updated);
      } else {
        await this.reloadUsers();
      }
    } finally {
      this.savingSelectedUser.set(false);
    }
  }

  protected async archiveSelectedUser(): Promise<void> {
    const selected = this.selectedUser();
    if (!selected || this.isSelf(selected)) return;

    const confirmed = window.confirm(`Archive ${selected.name}?`);
    if (!confirmed) return;

    try {
      this.actioningUserId.set(selected.id);
      await this.usersStore.delete(selected.id);
      await this.reloadUsers();
    } finally {
      this.actioningUserId.set(null);
    }
  }

  protected async restoreSelectedUser(): Promise<void> {
    const selected = this.selectedUser();
    if (!selected || this.isSelf(selected)) return;

    try {
      this.actioningUserId.set(selected.id);
      const restored = await this.usersStore.restore(selected.id);
      this.selectUser(restored);
    } finally {
      this.actioningUserId.set(null);
    }
  }

  protected async loadMore(): Promise<void> {
    await this.usersStore.loadMore();
  }

  protected isArchived(user: User | null | undefined): boolean {
    if (!user) return false;

    const status = (user.status ?? '').toLowerCase();
    return status === 'archived' || status === 'deleted';
  }

  protected isSelf(user: User | null | undefined): boolean {
    if (!user) return false;
    return user.id === this.currentAuthUserId();
  }

  protected initials(name: string | null | undefined): string {
    if (!name) return '?';

    return name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  }

  protected trackByUserId(_: number, user: User): string {
    return user.id;
  }

  private patchEditForm(user: User): void {
    this.editForm.patchValue({
      name: user.name ?? '',
      email: user.email ?? '',
      phone: user.phone ?? '',
      role: user.role ?? 'staff',
      status: user.status ?? 'active',
      tagsText: (user.tags ?? []).join(', '),
      notes: user.notes ?? '',
    });
  }

  private resetCreateForm(): void {
    this.createForm.reset({
      name: '',
      email: '',
      phone: '',
      role: 'staff',
      status: 'active',
      sendInvite: false,
      tagsText: '',
      notes: '',
    });
  }

  private parseTags(value: string | null | undefined): string[] {
    if (!value?.trim()) return [];

    return Array.from(
      new Set(
        value
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean)
      )
    );
  }

  private nullIfBlank(value: string | null | undefined): string | null {
    const trimmed = (value ?? '').trim();
    return trimmed ? trimmed : null;
  }

  private undefinedIfBlank(value: string | null | undefined): string | undefined {
    const trimmed = (value ?? '').trim();
    return trimmed ? trimmed : undefined;
  }
}