import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { AppConfigService } from '../app-config/app-config.service';

export interface PermissionDefinition {
  key: string;
  label: string;
  description: string;
  group: string;
}

export interface ShopRole {
  id: string;
  key: string;
  name: string;
  description: string | null;
  permissions: string[];
  isSystem: boolean;
  userCount: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface RoleOption {
  key: string;
  name: string;
  description: string | null;
}

export interface RolesResponse {
  permissions: PermissionDefinition[];
  roles: ShopRole[];
}

@Injectable({ providedIn: 'root' })
export class RolesService {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);

  private get apiBase(): string {
    return this.appConfig.config.apiBase;
  }

  list() {
    return this.http.get<RolesResponse>(`${this.apiBase}/roles`);
  }

  options() {
    return this.http.get<RoleOption[]>(`${this.apiBase}/roles/options`);
  }

  create(input: { key: string; name: string; description?: string | null; permissions: string[] }) {
    return this.http.post<ShopRole>(`${this.apiBase}/roles`, input);
  }

  update(key: string, input: { name?: string; description?: string | null; permissions?: string[] }) {
    return this.http.patch<ShopRole>(`${this.apiBase}/roles/${encodeURIComponent(key)}`, input);
  }

  remove(key: string) {
    return this.http.delete<void>(`${this.apiBase}/roles/${encodeURIComponent(key)}`);
  }
}
