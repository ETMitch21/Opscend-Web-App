import { CommonModule, DatePipe } from '@angular/common';
import {
  AfterViewChecked,
  Component,
  ElementRef,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
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
  RepairMessage,
} from '../../../core/repairs/repair.model';
import { PhonePipe } from '../../../core/pipes/phone-pipe';

type TrackingTab = 'details' | 'messages';

type PublicRepairStatus =
  | 'intake'
  | 'scheduled'
  | 'diagnosing'
  | 'awaiting_approval'
  | 'awaiting_parts'
  | 'in_repair'
  | 'qc'
  | 'ready'
  | 'picked_up'
  | 'canceled'
  | string;

type PublicStatusTone = 'default' | 'waiting' | 'ready' | 'completed' | 'canceled';

type PublicStatusDisplay = {
  key: string;
  label: string;
  eyebrow: string;
  description: string;
  tone: PublicStatusTone;
};

type PublicTrackerStep = {
  key: string;
  label: string;
  description: string;
  state: 'completed' | 'current' | 'upcoming';
  tone: PublicStatusTone;
};

const PUBLIC_FLOW_BASE: Array<Omit<PublicTrackerStep, 'state'>> = [
  {
    key: 'received',
    label: 'Received',
    description: 'We’ve received the repair details.',
    tone: 'default',
  },
  {
    key: 'scheduled',
    label: 'Scheduled',
    description: 'Your repair appointment is booked.',
    tone: 'default',
  },
  {
    key: 'in_progress',
    label: 'In Progress',
    description: 'Repair work is underway.',
    tone: 'default',
  },
  {
    key: 'final_check',
    label: 'Final Check',
    description: 'We’re checking everything before completion.',
    tone: 'default',
  },
  {
    key: 'ready',
    label: 'Ready',
    description: 'Your repair is ready for pickup or completion.',
    tone: 'ready',
  },
  {
    key: 'completed',
    label: 'Completed',
    description: 'The repair is finished.',
    tone: 'completed',
  },
];

function publicStatusFor(status: PublicRepairStatus | null | undefined): PublicStatusDisplay {
  switch (status) {
    case 'intake':
      return {
        key: 'received',
        label: 'Received',
        eyebrow: 'Current Status',
        description: 'We’ve received your repair request and are reviewing the details.',
        tone: 'default',
      };

    case 'scheduled':
      return {
        key: 'scheduled',
        label: 'Scheduled',
        eyebrow: 'Current Status',
        description:
          'Your repair is scheduled. We’ll keep this page updated as the appointment gets closer.',
        tone: 'default',
      };

    case 'diagnosing':
      return {
        key: 'in_progress',
        label: 'In Progress',
        eyebrow: 'Current Status',
        description: 'We’re reviewing the device and confirming the repair details.',
        tone: 'default',
      };

    case 'awaiting_approval':
      return {
        key: 'waiting',
        label: 'Waiting on Approval',
        eyebrow: 'Action Needed',
        description:
          'We need your approval before we can continue. Please check your messages or contact the shop.',
        tone: 'waiting',
      };

    case 'awaiting_parts':
      return {
        key: 'waiting',
        label: 'Waiting on Parts',
        eyebrow: 'Current Status',
        description: 'We’re waiting on parts for your repair. Work will continue once they arrive.',
        tone: 'waiting',
      };

    case 'in_repair':
      return {
        key: 'in_progress',
        label: 'In Progress',
        eyebrow: 'Current Status',
        description: 'Your repair is being worked on now. We’ll update you if anything changes.',
        tone: 'default',
      };

    case 'qc':
      return {
        key: 'final_check',
        label: 'Final Check',
        eyebrow: 'Current Status',
        description: 'The repair work is complete and we’re doing a final quality check.',
        tone: 'default',
      };

    case 'ready':
      return {
        key: 'ready',
        label: 'Ready',
        eyebrow: 'Current Status',
        description: 'Your repair is ready. Please check your messages or contact the shop for next steps.',
        tone: 'ready',
      };

    case 'picked_up':
      return {
        key: 'completed',
        label: 'Completed',
        eyebrow: 'Current Status',
        description: 'This repair has been completed. Thank you for choosing us.',
        tone: 'completed',
      };

    case 'canceled':
      return {
        key: 'canceled',
        label: 'Canceled',
        eyebrow: 'Current Status',
        description: 'This repair has been canceled. Please contact the shop if you have questions.',
        tone: 'canceled',
      };

    default:
      return {
        key: 'in_progress',
        label: 'In Progress',
        eyebrow: 'Current Status',
        description: 'Your repair is moving through the current step. We’ll update this page as it changes.',
        tone: 'default',
      };
  }
}

function buildPublicTrackerSteps(status: PublicRepairStatus | null | undefined): PublicTrackerStep[] {
  const current = publicStatusFor(status);

  if (current.key === 'canceled') {
    return [
      {
        key: 'received',
        label: 'Received',
        description: 'We received the repair details.',
        state: 'completed',
        tone: 'default',
      },
      {
        key: 'canceled',
        label: 'Canceled',
        description: 'The repair was canceled.',
        state: 'current',
        tone: 'canceled',
      },
    ];
  }

  const flow = [...PUBLIC_FLOW_BASE];

  if (current.key === 'waiting') {
    flow.splice(3, 0, {
      key: 'waiting',
      label: current.label,
      description:
        current.label === 'Waiting on Approval'
          ? 'We’re waiting on your approval before continuing.'
          : 'We’re waiting on parts before continuing.',
      tone: 'waiting',
    });
  }

  const currentIndex = Math.max(
    0,
    flow.findIndex((step) => step.key === current.key)
  );

  return flow.map((step, index) => ({
    ...step,
    label: step.key === current.key ? current.label : step.label,
    description: step.key === current.key ? current.description : step.description,
    state:
      index < currentIndex
        ? 'completed'
        : index === currentIndex
          ? 'current'
          : 'upcoming',
  }));
}

@Component({
  selector: 'app-repair-tracking-page',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, DatePipe, ReactiveFormsModule, PhonePipe],
  templateUrl: './repair-tracking.html',
})
export class RepairTracking implements AfterViewChecked {
  private readonly route = inject(ActivatedRoute);
  private readonly repairsService = inject(RepairsService);
  private shouldScrollMessagesToBottom = false;

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
  readonly activeTab = signal<TrackingTab>('details');
  readonly showFullTimeline = signal(false);

  @ViewChild('messagesScroll')
  private messagesScroll?: ElementRef<HTMLDivElement>;

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

  readonly currentPublicStatus = computed(() =>
    publicStatusFor(this.tracking()?.status ?? null)
  );

  readonly publicTrackerSteps = computed(() =>
    buildPublicTrackerSteps(this.tracking()?.status ?? null)
  );

  readonly timelineProgressLabel = computed(() => {
    const current = this.currentPublicStatus();

    if (current.key === 'canceled') {
      return 'This repair is no longer active.';
    }

    if (current.key === 'completed') {
      return 'This repair is complete.';
    }

    return `Here's where your repair stands right now.`;
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
      await this.loadMessageUnreadCount();
    } catch {
      this.error.set('tracking_not_found');
    } finally {
      this.loading.set(false);
    }
  }

  ngAfterViewChecked(): void {
    if (!this.shouldScrollMessagesToBottom) return;

    this.shouldScrollMessagesToBottom = false;
    this.scrollMessagesToBottom('auto');
  }

  async selectTab(tab: TrackingTab): Promise<void> {
    this.activeTab.set(tab);

    if (tab === 'messages') {
      await this.loadMessages();
    }
  }

  toggleTimelineExpanded(): void {
    this.showFullTimeline.update((value) => !value);
  }

  private requestMessagesScrollToBottom(): void {
    this.shouldScrollMessagesToBottom = true;
    window.setTimeout(() => this.scrollMessagesToBottom('auto'), 0);
    window.setTimeout(() => this.scrollMessagesToBottom('smooth'), 75);
    window.setTimeout(() => this.scrollMessagesToBottom('smooth'), 250);
  }

  private scrollMessagesToBottom(behavior: ScrollBehavior = 'smooth'): void {
    const element = this.messagesScroll?.nativeElement;

    if (!element) return;

    element.scrollTo({
      top: element.scrollHeight,
      behavior,
    });
  }

  publicStatusCardClass(tone: PublicStatusTone): string {
    switch (tone) {
      case 'waiting':
        return 'border-amber-200 bg-amber-50';
      case 'ready':
        return 'border-emerald-200 bg-emerald-50';
      case 'completed':
        return 'border-emerald-200 bg-emerald-50';
      case 'canceled':
        return 'border-rose-200 bg-rose-50';
      default:
        return 'border-brand/20 bg-brand/5';
    }
  }

  publicStatusIconClass(tone: PublicStatusTone): string {
    switch (tone) {
      case 'waiting':
        return 'text-amber-600';
      case 'ready':
        return 'text-emerald-600';
      case 'completed':
        return 'text-emerald-600';
      case 'canceled':
        return 'text-rose-600';
      default:
        return 'text-brand';
    }
  }

  trackerStepCardClass(step: PublicTrackerStep): string {
    if (step.state === 'current') {
      return this.publicStatusCardClass(step.tone) + ' shadow-sm';
    }

    if (step.state === 'completed') {
      return 'border-emerald-200 bg-emerald-50/70';
    }

    return 'border-gray-200 bg-gray-50/80';
  }

  trackerStepIconClass(step: PublicTrackerStep): string {
    if (step.state === 'current') {
      switch (step.tone) {
        case 'waiting':
          return 'bg-amber-500 text-white';
        case 'ready':
        case 'completed':
          return 'bg-emerald-500 text-white';
        case 'canceled':
          return 'bg-rose-500 text-white';
        default:
          return 'bg-brand text-white';
      }
    }

    if (step.state === 'completed') {
      return 'bg-emerald-500 text-white';
    }

    return 'bg-white text-gray-400 ring-1 ring-gray-200';
  }

  trackerStepTextClass(step: PublicTrackerStep): string {
    if (step.state === 'current') return 'text-gray-950';
    if (step.state === 'completed') return 'text-gray-800';
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
      this.requestMessagesScrollToBottom();
      await this.markMessagesRead();
      await this.loadMessageUnreadCount();
    } catch {
      this.messagesError.set('Unable to load messages right now.');
    } finally {
      this.messagesLoading.set(false);
      this.requestMessagesScrollToBottom();
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
      this.requestMessagesScrollToBottom();
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