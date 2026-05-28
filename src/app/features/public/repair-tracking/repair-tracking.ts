import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  Check,
  Clock3,
  LucideAngularModule,
  MessageCircle,
  RefreshCw,
  Send,
  PackageCheck,
  SearchX,
  ShieldCheck,
  Smartphone,
  Wrench,
  XCircle,
} from 'lucide-angular';
import { firstValueFrom } from 'rxjs';

import { RepairsService } from '../../../core/repairs/repairs-service';
import {
  PublicRepairTrackingResponse,
  PublicRepairTrackingTimelineItem,
  RepairMessage,
} from '../../../core/repairs/repair.model';

@Component({
  selector: 'app-repair-tracking-page',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, DatePipe, ReactiveFormsModule],
  templateUrl: './repair-tracking.html',
})
export class RepairTracking {
  private readonly route = inject(ActivatedRoute);
  private readonly repairsService = inject(RepairsService);

  readonly icons = {
    Check,
    Clock3,
    PackageCheck,
    SearchX,
    MessageCircle,
    RefreshCw,
    Send,
    ShieldCheck,
    Smartphone,
    Wrench,
    XCircle,
  };

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly tracking = signal<PublicRepairTrackingResponse | null>(null);

  readonly trackingToken = signal<string | null>(null);
  readonly messages = signal<RepairMessage[]>([]);
  readonly messagesLoading = signal(false);
  readonly messagesError = signal<string | null>(null);
  readonly messageSaving = signal(false);
  readonly messageUnreadCount = signal(0);

  readonly messageForm = new FormGroup({
    message: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(4000)],
    }),
  });

  readonly deviceName = computed(() => {
    const device = this.tracking()?.customerDevice;

    if (!device) return 'Device repair';

    return (
      device.displayName ||
      [device.brand, device.model].filter(Boolean).join(' ') ||
      'Device repair'
    );
  });

  readonly isCompleted = computed(() => {
    const status = this.tracking()?.status;
    return status === 'picked_up' || status === 'ready';
  });

  readonly isCanceled = computed(() => this.tracking()?.status === 'canceled');

  async ngOnInit(): Promise<void> {
    const token = this.route.snapshot.paramMap.get('token');

    if (!token) {
      this.loading.set(false);
      this.error.set('tracking_not_found');
      return;
    }

    try {
      this.trackingToken.set(token);

      const response = await firstValueFrom(
        this.repairsService.getPublicRepairTracking(token)
      );

      this.tracking.set(response);
      await this.loadMessages();
    } catch {
      this.error.set('tracking_not_found');
    } finally {
      this.loading.set(false);
    }
  }

  timelineDotClass(item: PublicRepairTrackingTimelineItem): string {
    if (item.current) {
      return 'bg-brand text-white ring-4 ring-brand/10';
    }

    if (item.completed) {
      return 'bg-emerald-500 text-white ring-4 ring-emerald-50';
    }

    return 'bg-gray-100 text-gray-400 ring-4 ring-gray-50';
  }

  timelineTextClass(item: PublicRepairTrackingTimelineItem): string {
    if (item.current) return 'text-gray-950';
    if (item.completed) return 'text-gray-800';
    return 'text-gray-400';
  }

  async loadMessages(): Promise<void> {
    const token = this.trackingToken();

    if (!token) return;

    this.messagesLoading.set(true);
    this.messagesError.set(null);

    try {
      const response = await firstValueFrom(
        this.repairsService.listPublicRepairMessages(token)
      );

      this.messages.set(response.messages ?? []);
      await this.markMessagesRead();
      await this.loadMessageUnreadCount();
    } catch {
      this.messagesError.set('Unable to load messages right now.');
    } finally {
      this.messagesLoading.set(false);
    }
  }

  async loadMessageUnreadCount(): Promise<void> {
    const token = this.trackingToken();

    if (!token) return;

    try {
      const response = await firstValueFrom(
        this.repairsService.getPublicRepairMessageUnreadCount(token)
      );

      this.messageUnreadCount.set(response.unreadCount ?? 0);
    } catch {
      this.messageUnreadCount.set(0);
    }
  }

  async markMessagesRead(): Promise<void> {
    const token = this.trackingToken();

    if (!token) return;

    try {
      await firstValueFrom(this.repairsService.markPublicRepairMessagesRead(token));
      this.messageUnreadCount.set(0);
    } catch {
      // Do not block the public tracking page if read-state tracking fails.
    }
  }

  async sendMessage(): Promise<void> {
    const token = this.trackingToken();
    const text = this.messageForm.controls.message.value.trim();

    if (!token || !text || this.messageForm.invalid) {
      this.messageForm.markAllAsTouched();
      return;
    }

    this.messageSaving.set(true);

    try {
      await firstValueFrom(
        this.repairsService.createPublicRepairMessage(token, {
          message: text,
        })
      );

      this.messageForm.reset({ message: '' });
      await this.loadMessages();
    } catch {
      this.messagesError.set('Unable to send your message right now.');
    } finally {
      this.messageSaving.set(false);
    }
  }

  publicMessageBubbleClass(message: RepairMessage): string {
    if (message.role === 'customer') {
      return 'ml-auto border-brand/20 bg-brand text-white';
    }

    return 'mr-auto border-gray-200 bg-gray-50 text-gray-800';
  }

  publicMessageMetaClass(message: RepairMessage): string {
    if (message.role === 'customer') {
      return 'text-white/70';
    }

    return 'text-gray-400';
  }

  publicMessageSenderLabel(message: RepairMessage): string {
    if (message.role === 'customer') {
      return 'You';
    }

    if (message.role === 'contractor') {
      return 'Repair Partner';
    }

    return this.tracking()?.shop.name ?? 'Shop';
  }

  publicMessageReadReceipt(message: RepairMessage): string | null {
    if (message.role !== 'customer') return null;

    if (message.visibility === 'customer_contractor' && message.readByContractorAt) {
      return 'Read by repair partner';
    }

    if (message.visibility === 'customer_shop' && message.readByShopAt) {
      return `Read by ${this.tracking()?.shop.name ?? 'the shop'}`;
    }

    return null;
  }

  formatStatus(statusLabel: string): string {
    return statusLabel || 'In progress';
  }
}
