import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  ExternalLink,
  Inbox,
  Loader2,
  LucideAngularModule,
  Mail,
  MessageSquare,
  Phone,
  RefreshCw,
  Search,
  Send,
} from 'lucide-angular';

import { CommunicationService } from '../../core/communications/service';
import {
  CommunicationChannel,
  CommunicationConversation,
  CommunicationMessage,
} from '../../core/communications/model';
import { ToastService } from '../../core/toast/toast-service';
import { PhonePipe } from '../../core/pipes/phone-pipe';

@Component({
  selector: 'app-communications-inbox',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule, LucideAngularModule, RouterLink, PhonePipe],
  templateUrl: './communications-inbox.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommunicationsInbox implements OnInit, OnDestroy {
  @ViewChild('messageScrollContainer')
  private messageScrollContainer?: ElementRef<HTMLElement>;

  private readonly communicationApi = inject(CommunicationService);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);

  readonly icons = {
    ArrowLeft,
    CheckCircle2,
    Circle,
    ExternalLink,
    Inbox,
    Loader2,
    Mail,
    MessageSquare,
    Phone,
    RefreshCw,
    Search,
    Send,
  };

  readonly conversations = signal<CommunicationConversation[]>([]);
  readonly selectedConversation = signal<CommunicationConversation | null>(null);
  readonly loading = signal(false);
  readonly threadLoading = signal(false);
  readonly sending = signal(false);
  readonly error = signal<string | null>(null);
  readonly searchTerm = signal('');
  readonly activeChannel = signal<'email' | 'sms'>('sms');
  readonly composeSubject = signal('');
  readonly composeBody = signal('');
  readonly nextCursor = signal<string | null>(null);

  readonly selectedMessages = computed(() => this.selectedConversation()?.messages ?? []);

  private readonly inboxPollMs = 4_000;
  private inboxRefreshTimer: ReturnType<typeof setInterval> | null = null;
  private backgroundRefreshRunning = false;

  async ngOnInit(): Promise<void> {
    await this.loadConversations();
    this.startInboxAutoRefresh();

    const quoteId = this.route.snapshot.queryParamMap.get('quoteId');
    const conversationId = this.route.snapshot.queryParamMap.get('conversationId');

    if (quoteId) {
      await this.openQuoteConversation(quoteId);
      return;
    }

    if (conversationId) {
      await this.openConversationById(conversationId);
      return;
    }

    const first = this.conversations()[0];
    if (first) await this.openConversation(first);
  }


  ngOnDestroy(): void {
    if (this.inboxRefreshTimer) {
      clearInterval(this.inboxRefreshTimer);
      this.inboxRefreshTimer = null;
    }
  }

  private startInboxAutoRefresh(): void {
    if (this.inboxRefreshTimer) return;

    this.inboxRefreshTimer = setInterval(() => {
      void this.refreshInBackground();
    }, this.inboxPollMs);
  }

  private async refreshInBackground(): Promise<void> {
    if (this.backgroundRefreshRunning || this.sending()) return;

    this.backgroundRefreshRunning = true;

    try {
      const response = await firstValueFrom(
        this.communicationApi.listConversations({
          limit: 50,
          q: this.searchTerm().trim() || undefined,
          status: 'open',
        }),
      );

      this.reconcileConversationList(response.data ?? []);
      this.nextCursor.set(response.nextCursor ?? null);

      const selectedId = this.selectedConversation()?.id;
      if (!selectedId) return;

      const threadResponse = await firstValueFrom(
        this.communicationApi.getConversation(selectedId),
      );

      const previousThreadSignature = this.conversationThreadSignature(
        this.selectedConversation(),
      );
      const nextThreadSignature = this.conversationThreadSignature(
        threadResponse.data,
      );
      const previousLastMessageId = this.selectedMessages().at(-1)?.id ?? null;
      const nextLastMessageId = threadResponse.data.messages?.at(-1)?.id ?? null;

      if (previousThreadSignature !== nextThreadSignature) {
        this.selectedConversation.set(threadResponse.data);

        if (previousLastMessageId !== nextLastMessageId) {
          this.scheduleScrollToBottom();
        }
      }

      if (this.activeChannel() === 'sms' && !this.canSendSms(threadResponse.data)) {
        this.activeChannel.set('email');
      }
      if (this.activeChannel() === 'email' && !this.canSendEmail(threadResponse.data) && this.canSendSms(threadResponse.data)) {
        this.activeChannel.set('sms');
      }

      this.upsertConversation(threadResponse.data);
      await this.markSelectedRead();
    } catch (error) {
      console.error('Failed to refresh inbox in background.', error);
    } finally {
      this.backgroundRefreshRunning = false;
    }
  }

  async refresh(): Promise<void> {
    this.nextCursor.set(null);
    await this.loadConversations();

    const selectedId = this.selectedConversation()?.id;
    if (selectedId) await this.openConversationById(selectedId, false);
  }

  async loadConversations(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const response = await firstValueFrom(
        this.communicationApi.listConversations({
          limit: 50,
          q: this.searchTerm().trim() || undefined,
          status: 'open',
        }),
      );

      this.conversations.set(response.data ?? []);
      this.nextCursor.set(response.nextCursor ?? null);
    } catch (error) {
      console.error(error);
      this.error.set('Could not load conversations.');
      this.conversations.set([]);
      this.nextCursor.set(null);
    } finally {
      this.loading.set(false);
    }
  }

  async openQuoteConversation(quoteId: string): Promise<void> {
    this.threadLoading.set(true);
    this.error.set(null);

    try {
      const response = await firstValueFrom(this.communicationApi.ensureQuoteConversation(quoteId));
      this.selectedConversation.set(response.data);
      this.activeChannel.set(this.canSendSms(response.data) ? 'sms' : 'email');
      this.upsertConversation(response.data);
      this.scheduleScrollToBottom();
      await this.markSelectedRead();
    } catch (error) {
      console.error(error);
      this.error.set('Could not open the quote conversation.');
    } finally {
      this.threadLoading.set(false);
    }
  }

  async openConversation(conversation: CommunicationConversation): Promise<void> {
    await this.openConversationById(conversation.id);
  }

  async openConversationById(id: string, showLoading = true): Promise<void> {
    if (showLoading) this.threadLoading.set(true);
    this.error.set(null);

    try {
      const response = await firstValueFrom(this.communicationApi.getConversation(id));
      this.selectedConversation.set(response.data);
      this.activeChannel.set(this.canSendSms(response.data) ? 'sms' : 'email');
      this.upsertConversation(response.data);
      this.scheduleScrollToBottom();
      await this.markSelectedRead();
    } catch (error) {
      console.error(error);
      this.error.set('Could not open this conversation.');
    } finally {
      if (showLoading) this.threadLoading.set(false);
    }
  }

  async markSelectedRead(): Promise<void> {
    const selected = this.selectedConversation();
    if (!selected || selected.unreadForShopCount <= 0) return;

    try {
      const response = await firstValueFrom(
        this.communicationApi.markConversationRead(selected.id),
      );
      this.selectedConversation.set(response.data);
      this.upsertConversation(response.data);
      this.scheduleScrollToBottom();
    } catch (error) {
      console.error(error);
    }
  }

  async sendMessage(): Promise<void> {
    const conversation = this.selectedConversation();
    const body = this.composeBody().trim();
    const channel = this.activeChannel();

    if (!conversation || !body || this.sending()) return;

    if (channel === 'email' && !this.canSendEmail(conversation)) {
      this.toast.error('Customer email required', 'Add an email address before sending email.');
      return;
    }

    if (channel === 'sms' && !this.canSendSms(conversation)) {
      this.toast.error('Customer phone required', 'Add a phone number before sending SMS.');
      return;
    }

    this.sending.set(true);
    this.error.set(null);

    try {
      const request = {
        subject: this.composeSubject().trim() || undefined,
        body,
      };

      const response = await firstValueFrom(
        channel === 'email'
          ? this.communicationApi.sendEmailMessage(conversation.id, request)
          : this.communicationApi.sendSmsMessage(conversation.id, request),
      );

      const next: CommunicationConversation = {
        ...conversation,
        lastMessageAt: response.data.createdAt,
        lastOutboundAt: response.data.createdAt,
        lastMessagePreview: response.data.body,
        lastMessageChannel: response.data.channel,
        lastMessageDirection: response.data.direction,
        messages: [...(conversation.messages ?? []), response.data],
      };

      this.selectedConversation.set(next);
      this.upsertConversation(next);
      this.scheduleScrollToBottom();
      this.composeBody.set('');
      if (channel === 'email') this.composeSubject.set('');
      this.toast.success(channel === 'email' ? 'Email sent' : 'SMS sent');
    } catch (error) {
      console.error(error);
      this.toast.error(channel === 'email' ? 'Could not send email' : 'Could not send SMS');
      this.error.set(channel === 'email' ? 'Could not send email.' : 'Could not send SMS.');
    } finally {
      this.sending.set(false);
    }
  }

  setSearchTerm(value: string): void {
    this.searchTerm.set(value);
  }

  setChannel(channel: 'email' | 'sms'): void {
    this.activeChannel.set(channel);
  }

  canSendEmail(conversation: CommunicationConversation): boolean {
    return Boolean(conversation.customerEmail);
  }

  canSendSms(conversation: CommunicationConversation): boolean {
    return Boolean(conversation.customerPhone);
  }

  conversationTitle(conversation: CommunicationConversation): string {
    return (
      conversation.customerName ||
      conversation.customerEmail ||
      conversation.customerPhone ||
      conversation.subject ||
      'Unknown customer'
    );
  }

  conversationSubtitle(conversation: CommunicationConversation): string {
    if (conversation.quote) return `${conversation.quote.repairLabel} · ${conversation.quote.deviceLabel}`;
    if (conversation.repair) return conversation.repair.problemSummary;
    return conversation.subject || 'General conversation';
  }

  channelLabel(channel: CommunicationChannel | null | undefined): string {
    if (channel === 'sms') return 'SMS';
    if (channel === 'email') return 'Email';
    return 'Message';
  }

  messageSender(message: CommunicationMessage): string {
    if (message.direction === 'outbound') return 'You';
    return message.fromName || message.fromEmail || message.fromPhone || 'Customer';
  }

  money(cents: number | null | undefined): string {
    if (cents === null || cents === undefined) return 'Pending';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
  }

  statusLabel(status: string | null | undefined): string {
    if (!status) return 'Unknown';
    return status.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  }

  formatConversationDate(value: string | null | undefined): string {
    if (!value) return '';
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value));
  }


  private scheduleScrollToBottom(delayMs = 50): void {
    window.setTimeout(() => this.scrollMessagesToBottom(), delayMs);
  }

  private scrollMessagesToBottom(): void {
    const element = this.messageScrollContainer?.nativeElement;
    if (!element) return;

    element.scrollTo({
      top: element.scrollHeight,
      behavior: 'smooth',
    });
  }

  private upsertConversation(conversation: CommunicationConversation): void {
    const incoming = this.conversationListItem(conversation);

    this.conversations.update((items) => {
      const existing = items.find((item) => item.id === incoming.id);
      const next = existing
        ? items.map((item) =>
          item.id === incoming.id
            ? this.conversationSummarySignature(item) === this.conversationSummarySignature(incoming)
              ? item
              : incoming
            : item,
        )
        : [incoming, ...items];

      const sorted = this.sortConversationList(next);
      return this.conversationListSignature(items) === this.conversationListSignature(sorted)
        ? items
        : sorted;
    });
  }

  private reconcileConversationList(incoming: CommunicationConversation[]): void {
    this.conversations.update((current) => {
      const currentById = new Map(current.map((item) => [item.id, item]));
      const next = incoming.map((conversation) => {
        const listItem = this.conversationListItem(conversation);
        const existing = currentById.get(listItem.id);

        if (
          existing &&
          this.conversationSummarySignature(existing) === this.conversationSummarySignature(listItem)
        ) {
          return existing;
        }

        return listItem;
      });

      const sorted = this.sortConversationList(next);
      return this.conversationListSignature(current) === this.conversationListSignature(sorted)
        ? current
        : sorted;
    });
  }

  private conversationListItem(
    conversation: CommunicationConversation,
  ): CommunicationConversation {
    return {
      ...conversation,
      messages: undefined,
    };
  }

  private sortConversationList(
    conversations: CommunicationConversation[],
  ): CommunicationConversation[] {
    return [...conversations].sort((a, b) => {
      const aDate = new Date(a.lastMessageAt || a.updatedAt || a.createdAt).getTime();
      const bDate = new Date(b.lastMessageAt || b.updatedAt || b.createdAt).getTime();
      return bDate - aDate;
    });
  }

  private conversationListSignature(
    conversations: CommunicationConversation[],
  ): string {
    return conversations.map((conversation) => this.conversationSummarySignature(conversation)).join('|');
  }

  private conversationSummarySignature(
    conversation: CommunicationConversation,
  ): string {
    return [
      conversation.id,
      conversation.status,
      conversation.customerId ?? '',
      conversation.customerName ?? '',
      conversation.customerEmail ?? '',
      conversation.customerPhone ?? '',
      conversation.subject ?? '',
      conversation.publicRepairQuoteId ?? '',
      conversation.repairId ?? '',
      conversation.lastMessageAt ?? '',
      conversation.lastInboundAt ?? '',
      conversation.lastOutboundAt ?? '',
      conversation.unreadForShopCount,
      conversation.lastMessagePreview ?? '',
      conversation.lastMessageChannel ?? '',
      conversation.lastMessageDirection ?? '',
      conversation.quote?.id ?? '',
      conversation.quote?.status ?? '',
      conversation.quote?.estimatedTotalCents ?? '',
      conversation.quote?.depositRequired ?? '',
      conversation.quote?.depositAmountCents ?? '',
      conversation.quote?.depositPaidAt ?? '',
      conversation.quote?.deviceLabel ?? '',
      conversation.quote?.repairLabel ?? '',
      conversation.repair?.id ?? '',
      conversation.repair?.status ?? '',
      conversation.repair?.problemSummary ?? '',
      conversation.updatedAt,
    ].join('::');
  }

  private conversationThreadSignature(
    conversation: CommunicationConversation | null,
  ): string {
    if (!conversation) return '';

    const messages = conversation.messages ?? [];

    return [
      this.conversationSummarySignature(conversation),
      ...messages.map((message) => [
        message.id,
        message.status,
        message.subject ?? '',
        message.body,
        message.fromName ?? '',
        message.fromEmail ?? '',
        message.fromPhone ?? '',
        message.toName ?? '',
        message.toEmail ?? '',
        message.toPhone ?? '',
        message.providerMessageId ?? '',
        message.errorMessage ?? '',
        message.readAt ?? '',
        message.sentAt ?? '',
        message.receivedAt ?? '',
        message.failedAt ?? '',
        message.createdAt,
      ].join('::')),
    ].join('|');
  }
}
