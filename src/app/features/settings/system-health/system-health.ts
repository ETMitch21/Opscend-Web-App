import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import {
  AlertTriangleIcon,
  BoxIcon,
  CheckCircle2Icon,
  CircleAlertIcon,
  CircleDollarSignIcon,
  Clock3Icon,
  ExternalLinkIcon,
  LoaderCircleIcon,
  LucideAngularModule,
  RefreshCwIcon,
  ShieldCheckIcon,
  WrenchIcon,
} from 'lucide-angular';
import { firstValueFrom } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import {
  SystemHealthCategoryKey,
  SystemHealthIssue,
  SystemHealthReport,
} from '../../../core/system-health/model';
import { SystemHealthService } from '../../../core/system-health/service';
import { ToastService } from '../../../core/toast/toast-service';
import { SettingsLayoutComponent } from '../settings-layout/settings-layout';

type CategoryFilter = 'all' | SystemHealthCategoryKey;
type SeverityFilter = 'all' | 'critical' | 'warning';

@Component({
  selector: 'app-system-health',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    LucideAngularModule,
    SettingsLayoutComponent,
  ],
  templateUrl: './system-health.html',
})
export class SystemHealthSettings implements OnInit {
  private readonly healthApi = inject(SystemHealthService);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);
  private readonly currentUser = toSignal(this.auth.currentUser$, {
    initialValue: this.auth.getCurrentUser(),
  });

  readonly icons = {
    Alert: AlertTriangleIcon,
    Box: BoxIcon,
    Check: CheckCircle2Icon,
    CircleAlert: CircleAlertIcon,
    Financial: CircleDollarSignIcon,
    Clock: Clock3Icon,
    External: ExternalLinkIcon,
    Loader: LoaderCircleIcon,
    Refresh: RefreshCwIcon,
    Shield: ShieldCheckIcon,
    Wrench: WrenchIcon,
  };

  readonly loading = signal(true);
  readonly refreshing = signal(false);
  readonly actionIssueId = signal<string | null>(null);
  readonly confirmingIssueId = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly report = signal<SystemHealthReport | null>(null);
  readonly categoryFilter = signal<CategoryFilter>('all');
  readonly severityFilter = signal<SeverityFilter>('all');

  readonly canRepair = computed(() => {
    const permissions = this.currentUser()?.permissions ?? [];
    return permissions.includes('*') || permissions.includes('systemHealth:write') || permissions.includes('systemHealth:*');
  });

  readonly filteredIssues = computed(() => {
    const report = this.report();
    if (!report) return [];

    return report.issues.filter((issue) => {
      const category = this.categoryFilter();
      const severity = this.severityFilter();
      return (category === 'all' || issue.category === category)
        && (severity === 'all' || issue.severity === severity);
    });
  });

  async ngOnInit(): Promise<void> {
    await this.load(false);
  }

  async refresh(): Promise<void> {
    await this.load(true);
  }

  setCategory(category: CategoryFilter): void {
    this.categoryFilter.set(category);
    this.confirmingIssueId.set(null);
  }

  setSeverity(severity: SeverityFilter): void {
    this.severityFilter.set(severity);
    this.confirmingIssueId.set(null);
  }

  canRunAction(issue: SystemHealthIssue): boolean {
    return Boolean(
      issue.action &&
      this.canRepair() &&
      this.auth.hasPermission(issue.action.requiredPermission)
    );
  }

  startAction(issue: SystemHealthIssue): void {
    if (!this.canRunAction(issue) || this.actionIssueId()) return;
    this.confirmingIssueId.set(issue.id);
  }

  cancelAction(): void {
    this.confirmingIssueId.set(null);
  }

  async confirmAction(issue: SystemHealthIssue): Promise<void> {
    if (!issue.action || !this.canRunAction(issue) || this.actionIssueId()) return;

    this.actionIssueId.set(issue.id);
    try {
      const response = await firstValueFrom(
        this.healthApi.runAction(issue.action, issue.entityId),
      );
      this.toast.success(response.message);
      this.confirmingIssueId.set(null);
      await this.load(true, true);
    } catch (error) {
      console.error('System Health remediation failed.', error);
      this.toast.error('The repair could not be applied. Refresh and review the issue again.');
    } finally {
      this.actionIssueId.set(null);
    }
  }

  categoryIcon(key: SystemHealthCategoryKey) {
    if (key === 'financial') return this.icons.Financial;
    if (key === 'inventory') return this.icons.Box;
    if (key === 'automations') return this.icons.Clock;
    return this.icons.Shield;
  }

  scannedAt(): string {
    const generatedAt = this.report()?.generatedAt;
    if (!generatedAt) return '';

    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(generatedAt));
  }

  private async load(isRefresh: boolean, quiet = false): Promise<void> {
    if (isRefresh) this.refreshing.set(true);
    else this.loading.set(true);

    if (!quiet) this.error.set(null);

    try {
      const report = await firstValueFrom(this.healthApi.scan());
      this.report.set(report);
      this.error.set(null);
    } catch (error) {
      console.error('Unable to scan System Health.', error);
      this.error.set('Opscend could not complete the health scan. Try again.');
      if (!quiet) this.report.set(null);
    } finally {
      this.loading.set(false);
      this.refreshing.set(false);
    }
  }
}
