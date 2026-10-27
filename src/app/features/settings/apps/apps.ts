import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  BlocksIcon,
  CheckCircle2Icon,
  LoaderCircleIcon,
  LockKeyholeIcon,
  PowerIcon,
  SaveIcon,
  ShieldCheckIcon,
} from 'lucide-angular';
import { LucideAngularModule } from 'lucide-angular';
import { firstValueFrom } from 'rxjs';

import { OpscendApp, OpscendAppSettingField, OpscendAppSettingsSection } from '../../../core/apps/model';
import { AppsService } from '../../../core/apps/service';
import { AuthService } from '../../../core/auth/auth.service';
import { ToastService } from '../../../core/toast/toast-service';
import { SettingsLayoutComponent } from '../settings-layout/settings-layout';

@Component({
  selector: 'app-opscend-apps-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, SettingsLayoutComponent],
  templateUrl: './apps.html',
})
export class OpscendAppsSettings implements OnInit {
  private readonly appsApi = inject(AppsService);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);

  readonly icons = {
    Apps: BlocksIcon,
    Check: CheckCircle2Icon,
    Loader: LoaderCircleIcon,
    Lock: LockKeyholeIcon,
    Power: PowerIcon,
    Save: SaveIcon,
    Shield: ShieldCheckIcon,
  };

  readonly loading = signal(true);
  readonly working = signal(false);
  readonly apps = signal<OpscendApp[]>([]);
  readonly selectedKey = signal<string | null>(null);
  readonly directoryQuery = signal('');
  readonly secretDrafts = signal<Record<string, string>>({});
  readonly error = signal<string | null>(null);

  readonly canManage = computed(() => this.auth.hasPermission('apps:write'));
  readonly selectedApp = computed(() => this.apps().find((app) => app.key === this.selectedKey()) ?? null);
  readonly filteredApps = computed(() => {
    const query = this.directoryQuery().trim().toLowerCase();
    if (!query) return this.apps();
    return this.apps().filter((app) => [app.name, app.description, app.developer, app.category]
      .some((value) => String(value ?? '').toLowerCase().includes(query)));
  });
  readonly installedApps = computed(() => this.filteredApps().filter((app) => Boolean(app.installation)));
  readonly availableApps = computed(() => this.filteredApps().filter((app) => !app.installation));
  readonly installedCount = computed(() => this.apps().filter((app) => app.installed).length);
  readonly readyCount = computed(() => this.installedApps().filter((app) => app.installation?.setupState === 'ready').length);

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const response = await firstValueFrom(this.appsApi.list());
      this.apps.set(response.data);
      if (!this.selectedKey() && response.data.length) {
        const preferred = response.data.find((app) => app.installed)
          ?? response.data.find((app) => Boolean(app.installation))
          ?? response.data[0];
        this.selectedKey.set(preferred.key);
      }
    } catch (error) {
      console.error('Unable to load Opscend apps.', error);
      this.error.set('Apps could not be loaded.');
    } finally {
      this.loading.set(false);
    }
  }

  select(app: OpscendApp): void {
    this.selectedKey.set(app.key);
    this.secretDrafts.set({});
  }

  async install(app: OpscendApp): Promise<void> {
    if (!this.canManage() || this.working()) return;
    const reEnabling = app.installation?.status === 'disabled';
    this.working.set(true);
    try {
      await firstValueFrom(this.appsApi.install(app.key));
      this.toast.success(reEnabling ? `${app.name} enabled.` : `${app.name} installed.`);
      this.selectedKey.set(app.key);
      await this.load();
    } catch (error) {
      console.error('Unable to install app.', error);
      this.toast.error('The app could not be installed.');
    } finally {
      this.working.set(false);
    }
  }

  async disable(app: OpscendApp): Promise<void> {
    if (!this.canManage() || this.working()) return;
    this.working.set(true);
    try {
      await firstValueFrom(this.appsApi.disable(app.key));
      this.toast.success(`${app.name} disabled.`);
      await this.load();
    } catch (error) {
      console.error('Unable to disable app.', error);
      this.toast.error('The app could not be disabled.');
    } finally {
      this.working.set(false);
    }
  }

  appSettings(app: OpscendApp): Record<string, any> {
    return app.installation?.settings ?? {};
  }

  settingsSections(app: OpscendApp): OpscendAppSettingsSection[] {
    return app.manifest.settings?.sections ?? [];
  }

  fieldVisible(field: OpscendAppSettingField, root: Record<string, any>): boolean {
    if (!field.visibleWhen) return true;
    return this.valueAt(root, field.visibleWhen.path) === field.visibleWhen.equals;
  }

  valueAt(root: any, path: string): any {
    if (!path) return undefined;
    return path.split('.').reduce((current, key) => current == null ? undefined : current[key], root);
  }

  setValue(root: Record<string, any>, path: string, value: any): void {
    if (!path) return;
    const parts = path.split('.');
    let target: any = root;
    for (const part of parts.slice(0, -1)) {
      if (!target[part] || typeof target[part] !== 'object' || Array.isArray(target[part])) target[part] = {};
      target = target[part];
    }
    target[parts[parts.length - 1]] = value;
  }

  collectionItems(root: Record<string, any>, field: OpscendAppSettingField): Record<string, any>[] {
    const value = this.valueAt(root, field.path ?? '');
    return Array.isArray(value) ? value : [];
  }

  collectionKey(item: Record<string, any>, field: OpscendAppSettingField, index: number): string {
    const value = field.itemKeyPath ? this.valueAt(item, field.itemKeyPath) : null;
    return String(value ?? index);
  }

  collectionLabel(item: Record<string, any>, field: OpscendAppSettingField, index: number): string {
    const value = field.itemLabelPath ? this.valueAt(item, field.itemLabelPath) : null;
    return String(value ?? `Item ${index + 1}`);
  }

  secretValue(secretKey: string): string {
    return this.secretDrafts()[secretKey] ?? '';
  }

  setSecretValue(secretKey: string, value: string): void {
    this.secretDrafts.update((current) => ({ ...current, [secretKey]: value }));
  }

  secretSaved(app: OpscendApp, secretKey: string): boolean {
    return Boolean(app.installation?.secretStatus?.[secretKey]);
  }

  appStatusLabel(app: OpscendApp): string {
    switch (app.installation?.setupState) {
      case 'ready': return 'Ready';
      case 'needs_setup': return app.installation?.runtimeStatus === 'unreachable' ? 'App offline' : 'Setup required';
      case 'disabled': return 'Disabled';
      default: return 'Available';
    }
  }

  permissionLabel(permission: string): string {
    const labels: Record<string, string> = {
      'quotes:read': 'View quotes',
      'quotes:write': 'Update quotes and pricing adjustments',
      'customers:read': 'View customer records',
      'customers:write': 'Update customer records',
      'communications:send': 'Send customer communications',
    };
    return labels[permission] ?? permission.replace(':', ' · ').replaceAll('_', ' ');
  }

  async saveApp(app: OpscendApp): Promise<void> {
    if (!app.installation || !this.canManage() || this.working()) return;
    this.working.set(true);
    try {
      await firstValueFrom(this.appsApi.saveSettings(app.key, app.installation.settings));
      const allowedSecrets = new Set(app.manifest.settings?.secretKeys ?? []);
      for (const [secretKey, rawValue] of Object.entries(this.secretDrafts())) {
        const value = rawValue.trim();
        if (value && allowedSecrets.has(secretKey)) {
          await firstValueFrom(this.appsApi.saveSecret(app.key, secretKey, value));
        }
      }
      this.secretDrafts.set({});
      this.toast.success(`${app.name} settings saved.`);
      await this.load();
    } catch (error) {
      console.error('Unable to save app settings.', error);
      this.toast.error('App settings could not be saved.');
    } finally {
      this.working.set(false);
    }
  }
}
