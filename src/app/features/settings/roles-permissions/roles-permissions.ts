import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { CheckIcon, LockKeyholeIcon, PlusIcon, ShieldCheckIcon, Trash2Icon, UsersIcon } from 'lucide-angular';
import { LucideAngularModule } from 'lucide-angular';

import { AuthService } from '../../../core/auth/auth.service';
import {
  PermissionDefinition,
  RolesService,
  ShopRole,
} from '../../../core/roles/roles.service';
import { SettingsLayoutComponent } from '../settings-layout/settings-layout';

@Component({
  selector: 'app-roles-permissions',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, SettingsLayoutComponent],
  templateUrl: './roles-permissions.html',
  styleUrl: './roles-permissions.scss',
})
export class RolesPermissions {
  private readonly rolesService = inject(RolesService);
  private readonly auth = inject(AuthService);

  readonly icons = {
    Check: CheckIcon,
    Lock: LockKeyholeIcon,
    Plus: PlusIcon,
    Shield: ShieldCheckIcon,
    Trash: Trash2Icon,
    Users: UsersIcon,
  };

  readonly roles = signal<ShopRole[]>([]);
  readonly permissions = signal<PermissionDefinition[]>([]);
  readonly selectedRoleKey = signal<string>('');
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly creating = signal(false);
  readonly deleting = signal(false);
  readonly error = signal('');
  readonly success = signal('');
  readonly search = signal('');

  readonly draftName = signal('');
  readonly draftDescription = signal('');
  readonly draftPermissions = signal<Set<string>>(new Set());

  readonly showCreate = signal(false);
  readonly newRoleName = signal('');
  readonly newRoleKey = signal('');
  readonly newRoleDescription = signal('');

  readonly canWrite = computed(() => this.auth.hasPermission('roles:write'));
  readonly selectedRole = computed(() =>
    this.roles().find((role) => role.key === this.selectedRoleKey()) ?? null,
  );
  readonly ownerSelected = computed(() => this.selectedRole()?.key === 'owner');

  readonly permissionGroups = computed(() => {
    const query = this.search().trim().toLowerCase();
    const byGroup = new Map<string, PermissionDefinition[]>();

    for (const permission of this.permissions()) {
      const haystack = `${permission.label} ${permission.description} ${permission.group} ${permission.key}`.toLowerCase();
      if (query && !haystack.includes(query)) continue;
      const rows = byGroup.get(permission.group) ?? [];
      rows.push(permission);
      byGroup.set(permission.group, rows);
    }

    return [...byGroup.entries()].map(([group, items]) => ({ group, items }));
  });

  constructor() {
    void this.load();
  }

  async load(preferredRoleKey?: string): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const response = await firstValueFrom(this.rolesService.list());
      this.roles.set(response.roles);
      this.permissions.set(response.permissions);

      const nextKey = preferredRoleKey && response.roles.some((role) => role.key === preferredRoleKey)
        ? preferredRoleKey
        : this.selectedRoleKey() && response.roles.some((role) => role.key === this.selectedRoleKey())
          ? this.selectedRoleKey()
          : response.roles[0]?.key ?? '';
      this.selectRole(nextKey);
    } catch (error: any) {
      this.error.set(error?.error?.error || 'Roles and permissions could not be loaded.');
    } finally {
      this.loading.set(false);
    }
  }

  selectRole(key: string): void {
    this.selectedRoleKey.set(key);
    const role = this.roles().find((item) => item.key === key);
    if (!role) return;
    this.draftName.set(role.name);
    this.draftDescription.set(role.description ?? '');
    this.draftPermissions.set(new Set(role.permissions));
    this.success.set('');
    this.error.set('');
  }

  permissionChecked(key: string): boolean {
    return this.ownerSelected() || this.draftPermissions().has('*') || this.draftPermissions().has(key);
  }

  togglePermission(key: string, checked: boolean): void {
    if (!this.canWrite() || this.ownerSelected()) return;
    const next = new Set(this.draftPermissions());
    if (checked) next.add(key);
    else next.delete(key);
    next.delete('*');
    this.draftPermissions.set(next);
  }

  groupChecked(items: PermissionDefinition[]): boolean {
    return items.length > 0 && items.every((item) => this.permissionChecked(item.key));
  }

  toggleGroup(items: PermissionDefinition[], checked: boolean): void {
    if (!this.canWrite() || this.ownerSelected()) return;
    const next = new Set(this.draftPermissions());
    for (const item of items) {
      if (checked) next.add(item.key);
      else next.delete(item.key);
    }
    next.delete('*');
    this.draftPermissions.set(next);
  }

  async save(): Promise<void> {
    const role = this.selectedRole();
    if (!role || !this.canWrite()) return;

    this.saving.set(true);
    this.error.set('');
    this.success.set('');
    try {
      const updated = await firstValueFrom(this.rolesService.update(role.key, {
        name: this.draftName().trim(),
        description: this.draftDescription().trim() || null,
        ...(role.key === 'owner' ? {} : { permissions: [...this.draftPermissions()] }),
      }));
      this.roles.update((roles) => roles.map((item) => item.key === updated.key ? updated : item));
      this.selectRole(updated.key);

      // If an administrator changes the role they are currently using, refresh
      // /auth/me so navigation and action visibility match the API immediately.
      if (String(this.auth.getCurrentUser()?.role ?? '').toLowerCase() === updated.key) {
        await this.auth.loadMe();
      }

      this.success.set('Permissions saved. Changes apply to users in this role immediately.');
    } catch (error: any) {
      this.error.set(error?.error?.error || 'The role could not be saved.');
    } finally {
      this.saving.set(false);
    }
  }

  openCreate(): void {
    this.showCreate.set(true);
    this.newRoleName.set('');
    this.newRoleKey.set('');
    this.newRoleDescription.set('');
    this.error.set('');
  }

  updateNewRoleName(value: string): void {
    this.newRoleName.set(value);
    if (!this.newRoleKey()) {
      this.newRoleKey.set(this.slugify(value));
    }
  }

  async createRole(): Promise<void> {
    if (!this.canWrite()) return;
    const name = this.newRoleName().trim();
    const key = this.slugify(this.newRoleKey());
    if (!name || !key) {
      this.error.set('Enter a role name and role key.');
      return;
    }

    this.creating.set(true);
    this.error.set('');
    try {
      const created = await firstValueFrom(this.rolesService.create({
        key,
        name,
        description: this.newRoleDescription().trim() || null,
        permissions: [],
      }));
      this.showCreate.set(false);
      await this.load(created.key);
      this.success.set('Role created. Choose the access it should have, then save.');
    } catch (error: any) {
      const code = error?.error?.error;
      this.error.set(code === 'role_key_taken' || code === 'role_key_reserved'
        ? 'That role key is already in use.'
        : 'The role could not be created.');
    } finally {
      this.creating.set(false);
    }
  }

  async deleteSelected(): Promise<void> {
    const role = this.selectedRole();
    if (!role || role.isSystem || role.userCount > 0 || !this.canWrite()) return;
    if (!window.confirm(`Delete the “${role.name}” role?`)) return;

    this.deleting.set(true);
    this.error.set('');
    try {
      await firstValueFrom(this.rolesService.remove(role.key));
      this.selectedRoleKey.set('');
      await this.load();
      this.success.set('Role deleted.');
    } catch (error: any) {
      this.error.set(error?.error?.error === 'role_in_use'
        ? 'Move all users out of this role before deleting it.'
        : 'The role could not be deleted.');
    } finally {
      this.deleting.set(false);
    }
  }

  private slugify(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32);
  }
}
