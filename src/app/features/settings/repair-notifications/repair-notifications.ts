import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import {
  BellIcon,
  ChevronDownIcon,
  MailIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  SaveIcon,
  ToggleLeftIcon,
} from 'lucide-angular';
import { LucideAngularModule } from 'lucide-angular';

import { AppConfigService } from '../../../core/app-config/app-config.service';

type RepairNotificationEvent =
  | 'repair_created'
  | 'repair_scheduled'
  | 'repair_status_changed'
  | 'repair_awaiting_approval'
  | 'repair_awaiting_parts'
  | 'repair_ready'
  | 'repair_completed'
  | 'repair_canceled';

type NotificationChannel = 'email' | 'sms';

interface ShopResponse {
  id: string;
  name: string;
  email: string | null;
  repairNotificationsEnabled: boolean;
  repairEmailFromName: string | null;
  replyToEmail: string | null;
}

interface RepairNotificationTemplate {
  id: string;
  shopId: string;
  event: RepairNotificationEvent;
  channel: NotificationChannel;
  enabled: boolean;
  subject: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

interface RepairNotificationTemplateListResponse {
  templates: RepairNotificationTemplate[];
}

@Component({
  selector: 'app-repair-notification-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './repair-notifications.html',
})
export class RepairNotifications implements OnInit {
  private readonly appConfig = inject(AppConfigService);
  private readonly http = inject(HttpClient);

  readonly icons = {
    Bell: BellIcon,
    ChevronDown: ChevronDownIcon,
    Mail: MailIcon,
    RefreshCw: RefreshCwIcon,
    RotateCcw: RotateCcwIcon,
    Save: SaveIcon,
    ToggleLeft: ToggleLeftIcon,
  };

  readonly loading = signal(false);
  readonly savingShopSettings = signal(false);
  readonly savingTemplateIds = signal<Set<string>>(new Set());
  readonly resettingTemplateIds = signal<Set<string>>(new Set());

  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);

  readonly shopId = signal<string | null>(null);
  readonly shopName = signal('');

  repairNotificationsEnabled = true;
  repairEmailFromName = '';
  replyToEmail = '';

  readonly templates = signal<RepairNotificationTemplate[]>([]);
  readonly expandedTemplateId = signal<string | null>(null);

  readonly supportedVariables = [
    '{{customerFirstName}}',
    '{{deviceDisplayName}}',
    '{{repairNumber}}',
    '{{repairStatusLabel}}',
    '{{shopName}}',
  ];

  readonly enabledTemplateCount = computed(() =>
    this.templates().filter((template) => template.enabled).length
  );

  readonly totalTemplateCount = computed(() => this.templates().length);

  private get apiBase(): string {
    return this.appConfig.config.apiBase;
  }

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    this.success.set(null);

    try {
      const listRes = await firstValueFrom(
        this.http.get<{ data: ShopResponse[]; nextCursor: string | null }>(
          `${this.apiBase}/shops`
        )
      );

      const shop = listRes?.data?.[0] ?? null;

      if (!shop) {
        this.error.set('Could not find your shop.');
        return;
      }

      this.shopId.set(shop.id);
      this.shopName.set(shop.name ?? '');

      this.repairNotificationsEnabled = !!shop.repairNotificationsEnabled;
      this.repairEmailFromName = shop.repairEmailFromName ?? '';
      this.replyToEmail = shop.replyToEmail ?? '';

      const templatesRes = await firstValueFrom(
        this.http.get<RepairNotificationTemplateListResponse>(
          `${this.apiBase}/repair-notification-templates`
        )
      );

      this.templates.set(this.sortTemplates(templatesRes.templates ?? []));
    } catch (err) {
      console.error(err);
      this.error.set('Could not load repair notification settings.');
    } finally {
      this.loading.set(false);
    }
  }

  async saveShopSettings(): Promise<void> {
    const shopId = this.shopId();

    if (!shopId) {
      this.error.set('Shop not loaded.');
      return;
    }

    this.savingShopSettings.set(true);
    this.error.set(null);
    this.success.set(null);

    try {
      await firstValueFrom(
        this.http.patch(`${this.apiBase}/shops/${shopId}`, {
          repairNotificationsEnabled: this.repairNotificationsEnabled,
          repairEmailFromName: this.repairEmailFromName.trim() || null,
          replyToEmail: this.replyToEmail.trim() || null,
        })
      );

      this.success.set('Repair notification settings saved.');
      await this.load();
    } catch (err) {
      console.error(err);
      this.error.set('Could not save repair notification settings.');
    } finally {
      this.savingShopSettings.set(false);
    }
  }

  async saveTemplate(template: RepairNotificationTemplate): Promise<void> {
    this.setSavingTemplate(template.id, true);
    this.error.set(null);
    this.success.set(null);

    try {
      const updated = await firstValueFrom(
        this.http.patch<RepairNotificationTemplate>(
          `${this.apiBase}/repair-notification-templates/${template.id}`,
          {
            enabled: template.enabled,
            subject: template.subject.trim(),
            body: template.body.trim(),
          }
        )
      );

      this.templates.update((templates) =>
        this.sortTemplates(
          templates.map((item) => (item.id === updated.id ? updated : item))
        )
      );

      this.success.set(`${this.prettyEvent(template.event)} template saved.`);
    } catch (err) {
      console.error(err);
      this.error.set(`Could not save ${this.prettyEvent(template.event)} template.`);
    } finally {
      this.setSavingTemplate(template.id, false);
    }
  }

  async resetTemplate(template: RepairNotificationTemplate): Promise<void> {
    this.setResettingTemplate(template.id, true);
    this.error.set(null);
    this.success.set(null);

    try {
      const updated = await firstValueFrom(
        this.http.post<RepairNotificationTemplate>(
          `${this.apiBase}/repair-notification-templates/${template.id}/reset`,
          {}
        )
      );

      this.templates.update((templates) =>
        this.sortTemplates(
          templates.map((item) => (item.id === updated.id ? updated : item))
        )
      );

      this.success.set(`${this.prettyEvent(template.event)} template reset.`);
    } catch (err) {
      console.error(err);
      this.error.set(`Could not reset ${this.prettyEvent(template.event)} template.`);
    } finally {
      this.setResettingTemplate(template.id, false);
    }
  }

  toggleTemplate(template: RepairNotificationTemplate): void {
    this.templates.update((templates) =>
      templates.map((item) =>
        item.id === template.id ? { ...item, enabled: !item.enabled } : item
      )
    );
  }

  updateTemplateSubject(template: RepairNotificationTemplate, value: string): void {
    this.templates.update((templates) =>
      templates.map((item) =>
        item.id === template.id ? { ...item, subject: value } : item
      )
    );
  }

  updateTemplateBody(template: RepairNotificationTemplate, value: string): void {
    this.templates.update((templates) =>
      templates.map((item) =>
        item.id === template.id ? { ...item, body: value } : item
      )
    );
  }

  toggleExpanded(templateId: string): void {
    this.expandedTemplateId.set(
      this.expandedTemplateId() === templateId ? null : templateId
    );
  }

  isTemplateSaving(templateId: string): boolean {
    return this.savingTemplateIds().has(templateId);
  }

  isTemplateResetting(templateId: string): boolean {
    return this.resettingTemplateIds().has(templateId);
  }

  prettyEvent(event: RepairNotificationEvent): string {
    switch (event) {
      case 'repair_created':
        return 'Repair Created';
      case 'repair_scheduled':
        return 'Appointment Scheduled';
      case 'repair_status_changed':
        return 'Status Updated';
      case 'repair_awaiting_approval':
        return 'Awaiting Approval';
      case 'repair_awaiting_parts':
        return 'Awaiting Parts';
      case 'repair_ready':
        return 'Repair Ready';
      case 'repair_completed':
        return 'Repair Completed';
      case 'repair_canceled':
        return 'Repair Canceled';
      default:
        return event;
    }
  }

  eventDescription(event: RepairNotificationEvent): string {
    switch (event) {
      case 'repair_created':
        return 'Sent when a new repair is created.';
      case 'repair_scheduled':
        return 'Sent when a repair appointment is scheduled or rescheduled.';
      case 'repair_status_changed':
        return 'Fallback email for general repair status changes.';
      case 'repair_awaiting_approval':
        return 'Sent when a repair is waiting for customer approval.';
      case 'repair_awaiting_parts':
        return 'Sent when a repair is waiting on parts.';
      case 'repair_ready':
        return 'Sent when a repair is ready for pickup or completion.';
      case 'repair_completed':
        return 'Sent when a repair is completed or picked up.';
      case 'repair_canceled':
        return 'Sent when a repair is canceled.';
      default:
        return 'Automated repair notification.';
    }
  }

  private sortTemplates(
    templates: RepairNotificationTemplate[]
  ): RepairNotificationTemplate[] {
    const order: RepairNotificationEvent[] = [
      'repair_created',
      'repair_scheduled',
      'repair_status_changed',
      'repair_awaiting_approval',
      'repair_awaiting_parts',
      'repair_ready',
      'repair_completed',
      'repair_canceled',
    ];

    return [...templates].sort(
      (a, b) => order.indexOf(a.event) - order.indexOf(b.event)
    );
  }

  private setSavingTemplate(templateId: string, saving: boolean): void {
    this.savingTemplateIds.update((current) => {
      const next = new Set(current);

      if (saving) {
        next.add(templateId);
      } else {
        next.delete(templateId);
      }

      return next;
    });
  }

  private setResettingTemplate(templateId: string, resetting: boolean): void {
    this.resettingTemplateIds.update((current) => {
      const next = new Set(current);

      if (resetting) {
        next.add(templateId);
      } else {
        next.delete(templateId);
      }

      return next;
    });
  }
}