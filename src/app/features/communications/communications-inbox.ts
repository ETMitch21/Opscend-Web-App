import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Circle,
  ExternalLink,
  Inbox,
  Loader2,
  LucideAngularModule,
  Mail,
  MessageSquare,
  Phone,
  RefreshCw,
  SmartphoneIcon,
  Wrench,
  Clipboard,
  UserRound,
  Search,
  Send,
  Trash2,
  AlertTriangle,
  PlusCircle,
} from 'lucide-angular';

import { CommunicationService } from '../../core/communications/service';
import {
  CommunicationChannel,
  CommunicationConversation,
  CommunicationMessage,
  CommunicationTimelineItem,
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
    Archive,
    ArchiveRestore,
    ArrowLeft,
    CheckCircle2,
    ChevronDown,
    Circle,
    ExternalLink,
    Inbox,
    Loader2,
    Mail,
    MessageSquare,
    Phone,
    RefreshCw,
    SmartphoneIcon,
    Wrench,
    Clipboard,
    UserRound,
    Search,
    Send,
    Trash2,
    AlertTriangle,
    PlusCircle,
  };

  readonly conversations = signal<CommunicationConversation[]>([]);
  readonly selectedConversation = signal<CommunicationConversation | null>(null);
  readonly loading = signal(false);
  readonly threadLoading = signal(false);
  readonly sending = signal(false);
  readonly conversationActionRunning = signal(false);
  readonly error = signal<string | null>(null);
  readonly searchTerm = signal('');
  readonly conversationStatusFilter = signal<'open' | 'archived' | 'all'>('open');
  readonly activeChannel = signal<'email' | 'sms' | 'note'>('sms');
  readonly composeSubject = signal('');
  readonly composeBody = signal('');
  readonly addingInternalNote = signal(false);
  readonly nextCursor = signal<string | null>(null);

  readonly relatedDevicesOpen = signal(true);
  readonly relatedQuotesOpen = signal(true);
  readonly relatedRepairsOpen = signal(true);

  readonly selectedMessages = computed(() => this.selectedConversation()?.messages ?? []);
  readonly selectedTimeline = computed(() => {
    const conversation = this.selectedConversation();
    if (!conversation) return [];

    if (conversation.timeline?.length) return conversation.timeline;

    return (conversation.messages ?? []).map((message) => this.messageToTimelineItem(message));
  });

  readonly selectedCustomerProfile = computed(() => {
    const conversation = this.selectedConversation();
    if (!conversation) return null;

    const profile = conversation.customerProfile;

    return {
      id: conversation.customerId ?? profile?.id ?? null,
      name: conversation.customerName || profile?.name || null,
      email: conversation.customerEmail || profile?.email || null,
      phone: conversation.customerPhone || profile?.phone || null,
    };
  });

  readonly selectedRelatedQuotes = computed(() => {
    const conversation = this.selectedConversation();
    if (!conversation) return [];
    return conversation.relatedQuotes?.length
      ? conversation.relatedQuotes
      : conversation.quote
        ? [conversation.quote]
        : [];
  });

  readonly selectedRelatedRepairs = computed(() => {
    const conversation = this.selectedConversation();
    if (!conversation) return [];
    return conversation.relatedRepairs?.length
      ? conversation.relatedRepairs
      : conversation.repair
        ? [conversation.repair]
        : [];
  });

  readonly selectedRelatedDevices = computed(() => this.selectedConversation()?.relatedDevices ?? []);

  readonly selectedDeliveryWarnings = computed(() =>
    (this.selectedConversation()?.messages ?? []).filter((message) =>
      message.direction === 'outbound' &&
      message.channel === 'email' &&
      ['failed', 'bounced', 'complained', 'rejected', 'delayed'].includes(String(message.status)),
    ),
  );

  readonly visibleConversationCount = computed(() => this.conversations().length);
  readonly totalUnreadCount = computed(() =>
    this.conversations().reduce((total, conversation) => total + (conversation.unreadForShopCount || 0), 0),
  );

  private readonly inboxPollMs = 4_000;
  private inboxRefreshTimer: ReturnType<typeof setInterval> | null = null;
  private backgroundRefreshRunning = false;

  async ngOnInit(): Promise<void> {
    await this.loadConversations();
    this.startInboxAutoRefresh();

    const params = this.route.snapshot.queryParamMap;
    const conversationId = params.get('conversationId')?.trim();
    const repairId = params.get('repairId')?.trim();
    const quoteId = params.get('quoteId')?.trim();
    const customerId = params.get('customerId')?.trim();
    const requestedChannel = this.parseRequestedChannel(params.get('channel'));

    if (conversationId) {
      await this.openConversationById(conversationId);
      this.applyRequestedChannel(requestedChannel);
      return;
    }

    if (repairId) {
      await this.openRepairConversation(repairId);
      this.applyRequestedChannel(requestedChannel);
      return;
    }

    if (quoteId) {
      await this.openQuoteConversation(quoteId);
      this.applyRequestedChannel(requestedChannel);
      return;
    }

    if (customerId) {
      await this.openCustomerConversation(customerId);
      this.applyRequestedChannel(requestedChannel);
      return;
    }

    const first = this.conversations()[0];
    if (first) await this.openConversation(first);
  }

  private parseRequestedChannel(
    value: string | null,
  ): 'email' | 'sms' | 'note' | null {
    return value === 'email' || value === 'sms' || value === 'note'
      ? value
      : null;
  }

  private applyRequestedChannel(
    requestedChannel: 'email' | 'sms' | 'note' | null,
  ): void {
    const conversation = this.selectedConversation();
    if (!conversation || !requestedChannel) return;

    if (requestedChannel === 'note') {
      this.activeChannel.set('note');
      return;
    }

    if (requestedChannel === 'sms' && this.canSendSms(conversation)) {
      this.activeChannel.set('sms');
      return;
    }

    if (requestedChannel === 'email' && this.canSendEmail(conversation)) {
      this.activeChannel.set('email');
    }
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
          status: this.conversationStatusFilter(),
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

      if (this.activeChannel() !== 'note') {
        if (this.activeChannel() === 'sms' && !this.canSendSms(threadResponse.data)) {
          this.activeChannel.set('email');
        }
        if (this.activeChannel() === 'email' && !this.canSendEmail(threadResponse.data) && this.canSendSms(threadResponse.data)) {
          this.activeChannel.set('sms');
        }
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
          status: this.conversationStatusFilter(),
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

  async openRepairConversation(repairId: string): Promise<void> {
    this.threadLoading.set(true);
    this.error.set(null);

    try {
      const response = await firstValueFrom(
        this.communicationApi.ensureRepairConversation(repairId),
      );
      this.selectedConversation.set(response.data);
      this.activeChannel.set(this.canSendSms(response.data) ? 'sms' : 'email');
      this.upsertConversation(response.data);
      this.scheduleScrollToBottom();
      await this.markSelectedRead();
    } catch (error) {
      console.error(error);
      this.error.set('Could not open the repair conversation.');
    } finally {
      this.threadLoading.set(false);
    }
  }

  async openCustomerConversation(customerId: string): Promise<void> {
    this.threadLoading.set(true);
    this.error.set(null);

    try {
      const response = await firstValueFrom(
        this.communicationApi.ensureCustomerConversation(customerId),
      );
      this.selectedConversation.set(response.data);
      this.activeChannel.set(this.canSendSms(response.data) ? 'sms' : 'email');
      this.upsertConversation(response.data);
      this.scheduleScrollToBottom();
      await this.markSelectedRead();
    } catch (error) {
      console.error(error);
      this.error.set('Could not open the customer conversation.');
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

    if (conversation.status === 'archived') {
      this.toast.info('Conversation is archived', 'Reopen this conversation before sending a message.');
      return;
    }

    if (channel === 'note') {
      await this.addInternalNoteFromComposer(conversation, body);
      return;
    }

    if (channel === 'email' && !this.canSendEmail(conversation)) {
      this.toast.error('Customer email required', 'Add an email address before sending email.');
      return;
    }

    if (channel === 'sms' && !this.canSendSms(conversation)) {
      this.toast.error('SMS unavailable', this.smsUnavailableText(conversation));
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

  private async addInternalNoteFromComposer(
    conversation: CommunicationConversation,
    body: string,
  ): Promise<void> {
    if (this.addingInternalNote()) return;

    this.addingInternalNote.set(true);
    this.error.set(null);

    try {
      const response = await firstValueFrom(
        this.communicationApi.addInternalNote(conversation.id, body),
      );

      this.selectedConversation.set(response.data);
      this.upsertConversation(response.data);
      this.composeBody.set('');
      this.scheduleScrollToBottom();
      this.toast.success('Note added', 'The internal note was added to the timeline.');
    } catch (error) {
      console.error(error);
      this.toast.error('Note not added', 'Unable to add the internal note.');
      this.error.set('Could not add internal note.');
    } finally {
      this.addingInternalNote.set(false);
    }
  }

  setSearchTerm(value: string): void {
    this.searchTerm.set(value);
  }

  async clearSearch(): Promise<void> {
    if (!this.searchTerm().trim()) return;
    this.searchTerm.set('');
    await this.loadConversations();
  }

  async setConversationStatusFilter(status: 'open' | 'archived' | 'all'): Promise<void> {
    if (this.conversationStatusFilter() === status) return;

    this.conversationStatusFilter.set(status);
    this.selectedConversation.set(null);
    this.nextCursor.set(null);
    await this.loadConversations();

    const first = this.conversations()[0];
    if (first) await this.openConversation(first);
  }

  async archiveSelectedConversation(): Promise<void> {
    const conversation = this.selectedConversation();
    if (!conversation || this.conversationActionRunning()) return;

    const confirmed = window.confirm('Archive this conversation? It will leave the inbox but can be reopened later from Archived.');
    if (!confirmed) return;

    this.conversationActionRunning.set(true);
    this.error.set(null);

    try {
      await firstValueFrom(this.communicationApi.archiveConversation(conversation.id));
      await this.removeConversationFromCurrentList(conversation.id);
      this.toast.success('Conversation archived', 'It was moved out of the open Inbox.');
    } catch (error) {
      console.error(error);
      this.toast.error('Conversation not archived', 'Unable to archive this conversation.');
      this.error.set('Could not archive this conversation.');
    } finally {
      this.conversationActionRunning.set(false);
    }
  }

  async reopenSelectedConversation(): Promise<void> {
    const conversation = this.selectedConversation();
    if (!conversation || this.conversationActionRunning()) return;

    this.conversationActionRunning.set(true);
    this.error.set(null);

    try {
      await firstValueFrom(this.communicationApi.reopenConversation(conversation.id));
      await this.removeConversationFromCurrentList(conversation.id);
      this.toast.success('Conversation reopened', 'It was moved back to the open Inbox.');
    } catch (error) {
      console.error(error);
      this.toast.error('Conversation not reopened', 'Unable to reopen this conversation.');
      this.error.set('Could not reopen this conversation.');
    } finally {
      this.conversationActionRunning.set(false);
    }
  }

  async deleteSelectedConversation(): Promise<void> {
    const conversation = this.selectedConversation();
    if (!conversation || this.conversationActionRunning()) return;

    const confirmed = window.confirm(
      'Delete this conversation and its message history? This cannot be undone.',
    );
    if (!confirmed) return;

    this.conversationActionRunning.set(true);
    this.error.set(null);

    try {
      await firstValueFrom(this.communicationApi.deleteConversation(conversation.id));
      await this.removeConversationFromCurrentList(conversation.id);
      this.toast.success('Conversation deleted', 'The conversation was removed from the inbox.');
    } catch (error) {
      console.error(error);
      this.toast.error('Conversation not deleted', 'Unable to delete this conversation.');
      this.error.set('Could not delete this conversation.');
    } finally {
      this.conversationActionRunning.set(false);
    }
  }

  toggleRelatedDevices(): void {
    this.relatedDevicesOpen.update((open) => !open);
  }

  toggleRelatedQuotes(): void {
    this.relatedQuotesOpen.update((open) => !open);
  }

  toggleRelatedRepairs(): void {
    this.relatedRepairsOpen.update((open) => !open);
  }

  setChannel(channel: 'email' | 'sms' | 'note'): void {
    this.activeChannel.set(channel);
  }

  canSendEmail(conversation: CommunicationConversation): boolean {
    return Boolean(conversation.customerEmail);
  }

  canSendSms(conversation: CommunicationConversation): boolean {
    return Boolean(conversation.customerPhone && conversation.smsEnabled);
  }

  canSendActiveChannel(conversation: CommunicationConversation): boolean {
    if (conversation.status === 'archived') return false;
    if (this.activeChannel() === 'note') return true;

    return this.activeChannel() === 'sms'
      ? this.canSendSms(conversation)
      : this.canSendEmail(conversation);
  }

  smsUnavailableText(conversation: CommunicationConversation): string {
    if (!conversation.customerPhone) return 'Customer phone required.';

    switch (conversation.smsUnavailableReason) {
      case 'sms_not_enabled_for_shop':
        return 'SMS is not enabled for this shop. Turn it on in Shop Settings > Communications.';
      case 'shop_twilio_number_required':
        return 'A Twilio phone number is required before SMS can be sent.';
      case 'customer_phone_required':
        return 'Customer phone required.';
      default:
        return conversation.smsEnabled
          ? ''
          : 'SMS is not available for this shop.';
    }
  }

  activeChannelUnavailableText(conversation: CommunicationConversation): string | null {
    if (conversation.status === 'archived') return 'Reopen this conversation before sending a message.';
    if (this.activeChannel() === 'note') return null;

    if (this.activeChannel() === 'sms' && !this.canSendSms(conversation)) {
      return this.smsUnavailableText(conversation);
    }

    if (this.activeChannel() === 'email' && !this.canSendEmail(conversation)) {
      return 'Customer email required.';
    }

    return null;
  }

  composePlaceholder(conversation: CommunicationConversation): string {
    const unavailable = this.activeChannelUnavailableText(conversation);
    if (unavailable) return unavailable;
    if (this.activeChannel() === 'note') return 'Add an internal note...';
    return this.activeChannel() === 'email' ? 'Write an email...' : 'Write an SMS...';
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
    const quoteCount = conversation.relatedQuotes?.length ?? (conversation.quote ? 1 : 0);
    const repairCount = conversation.relatedRepairs?.length ?? (conversation.repair ? 1 : 0);

    const parts = [
      quoteCount ? `${quoteCount} quote${quoteCount === 1 ? '' : 's'}` : null,
      repairCount ? `${repairCount} repair${repairCount === 1 ? '' : 's'}` : null,
    ].filter(Boolean);

    return parts.length ? parts.join(' · ') : conversation.subject || 'Customer conversation';
  }

  channelLabel(channel: CommunicationChannel | null | undefined): string {
    if (channel === 'sms') return 'SMS';
    if (channel === 'email') return 'Email';
    if (channel === 'note') return 'Note';
    if (channel === 'system') return 'System';
    return 'Message';
  }

  messageStatusLabel(status: string | null | undefined): string | null {
    switch (status) {
      case 'queued':
        return 'Queued';
      case 'sent':
        return 'Sent';
      case 'delivered':
        return 'Delivered';
      case 'opened':
        return 'Opened';
      case 'clicked':
        return 'Clicked';
      case 'delayed':
        return 'Delayed';
      case 'failed':
        return 'Failed';
      case 'bounced':
        return 'Bounced';
      case 'complained':
        return 'Spam complaint';
      case 'rejected':
        return 'Rejected';
      default:
        return null;
    }
  }

  messageStatusPillClass(status: string | null | undefined): string {
    switch (status) {
      case 'delivered':
      case 'opened':
      case 'clicked':
        return 'bg-emerald-100 text-emerald-800 ring-emerald-200';
      case 'queued':
      case 'sent':
      case 'delayed':
        return 'bg-amber-100 text-amber-800 ring-amber-200';
      case 'failed':
      case 'bounced':
      case 'complained':
      case 'rejected':
        return 'bg-rose-100 text-rose-800 ring-rose-200';
      default:
        return 'bg-white/15 text-current ring-white/20';
    }
  }

  timelineStatusLabel(item: CommunicationTimelineItem): string | null {
    if (item.direction !== 'outbound' || item.channel !== 'email') return null;
    return this.messageStatusLabel(item.status);
  }

  timelineStatusPillClass(item: CommunicationTimelineItem): string {
    return this.messageStatusPillClass(item.status);
  }

  timelineHasDeliveryProblem(item: CommunicationTimelineItem): boolean {
    return ['failed', 'bounced', 'complained', 'rejected', 'delayed'].includes(String(item.status));
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

  deviceLabel(device: { displayName?: string | null; brand?: string | null; model?: string | null; nickname?: string | null }): string {
    return (
      device.nickname ||
      device.displayName ||
      [device.brand, device.model].filter(Boolean).join(' ') ||
      'Customer device'
    );
  }

  deviceMetaLabel(device: { brand?: string | null; model?: string | null }): string | null {
    const value = [device.brand, device.model].filter(Boolean).join(' ');
    return value || null;
  }

  repairLabel(repair: { problemSummary?: string | null; deviceLabel?: string | null }): string {
    return repair.problemSummary || repair.deviceLabel || 'Repair';
  }

  quoteDepositLabel(quote: { depositRequired?: boolean; depositPaidAt?: string | null; depositAmountCents?: number | null }): string | null {
    if (!quote.depositRequired) return null;
    return `${quote.depositPaidAt ? 'Deposit paid' : 'Deposit due'} · ${this.money(quote.depositAmountCents)}`;
  }

  contextCountLabel(count: number, singular: string): string {
    return `${count} ${singular}${count === 1 ? '' : 's'}`;
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


  timelineTitle(item: CommunicationTimelineItem): string {
    return item.title || this.channelLabel(item.channel);
  }

  timelineActor(item: CommunicationTimelineItem): string {
    if (item.actorLabel) return item.actorLabel;
    if (item.direction === 'outbound') return 'You';
    if (item.direction === 'inbound') return 'Customer';
    if (item.type === 'repair_event' || item.type === 'quote_event') return 'System';
    return 'Internal';
  }

  timelineIsBubble(item: CommunicationTimelineItem): boolean {
    return (
      item.type === 'message' ||
      item.type === 'internal_note' ||
      (item.type === 'repair_note' && item.tone === 'note') ||
      item.channel === 'email' ||
      item.channel === 'sms' ||
      item.channel === 'note'
    );
  }

  timelineIsOutbound(item: CommunicationTimelineItem): boolean {
    return (
      item.direction === 'outbound' ||
      item.direction === 'internal' ||
      item.type === 'internal_note' ||
      item.channel === 'note' ||
      item.tone === 'note'
    );
  }

  timelineBubbleClass(item: CommunicationTimelineItem): string {
    if (
      item.type === 'internal_note' ||
      item.channel === 'note' ||
      item.direction === 'internal' ||
      item.tone === 'note'
    ) {
      return 'bg-amber-50 text-amber-950 ring-amber-100';
    }

    if (item.direction === 'outbound') {
      return 'bg-gray-900 text-white ring-gray-900';
    }

    return 'bg-app-surface text-app-text ring-app-border';
  }

  timelineEventDetail(item: CommunicationTimelineItem): string | null {
    const body = item.body?.trim();
    if (!body) return null;

    if (item.type === 'quote_event') {
      if (item.title?.toLowerCase().includes('deposit paid')) {
        return body.replace(/^Deposit paid:\s*/i, '');
      }

      return null;
    }

    if (item.type === 'repair_event') return null;

    return body.length > 70 ? `${body.slice(0, 70).trim()}…` : body;
  }

  timelineEventDotClass(item: CommunicationTimelineItem): string {
    switch (item.tone) {
      case 'success':
        return 'bg-emerald-500';
      case 'danger':
        return 'bg-rose-500';
      case 'note':
        return 'bg-amber-500';
      case 'info':
        return 'bg-sky-500';
      default:
        return 'bg-gray-400';
    }
  }

  timelineEventClass(item: CommunicationTimelineItem): string {
    switch (item.tone) {
      case 'success':
        return 'border-emerald-100 bg-emerald-50 text-emerald-900';
      case 'danger':
        return 'border-rose-100 bg-rose-50 text-rose-900';
      case 'note':
        return 'border-amber-100 bg-amber-50 text-amber-950';
      case 'info':
        return 'border-sky-100 bg-sky-50 text-sky-900';
      default:
        return 'border-app-border bg-app-surface text-app-text';
    }
  }

  private messageToTimelineItem(message: CommunicationMessage): CommunicationTimelineItem {
    const isInternalNote = message.channel === 'note' || message.direction === 'internal';

    return {
      id: `message:${message.id}`,
      type: isInternalNote ? 'internal_note' : 'message',
      sourceId: message.id,
      channel: message.channel,
      direction: message.direction,
      status: message.status,
      title: isInternalNote
        ? 'Internal note'
        : message.direction === 'outbound'
          ? `Outbound ${this.channelLabel(message.channel)}`
          : `Inbound ${this.channelLabel(message.channel)}`,
      body: message.body,
      subject: message.subject,
      actorLabel: this.messageSender(message),
      occurredAt: message.createdAt,
      tone: isInternalNote ? 'note' : message.direction === 'outbound' ? 'outbound' : 'inbound',
    };
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

  private async removeConversationFromCurrentList(conversationId: string): Promise<void> {
    const current = this.conversations();
    const nextConversations = current.filter((item) => item.id !== conversationId);
    const nextSelected = nextConversations[0] ?? null;

    this.conversations.set(nextConversations);
    this.selectedConversation.set(null);

    if (nextSelected) {
      await this.openConversation(nextSelected);
    }
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
      conversation.relatedQuotes?.map((quote) => `${quote.id}:${quote.status}:${quote.updatedAt ?? ''}`).join(',') ?? '',
      conversation.repair?.id ?? '',
      conversation.repair?.status ?? '',
      conversation.repair?.problemSummary ?? '',
      conversation.relatedRepairs?.map((repair) => `${repair.id}:${repair.status}:${repair.updatedAt ?? ''}`).join(',') ?? '',
      conversation.relatedDevices?.map((device) => `${device.id}:${device.updatedAt ?? ''}`).join(',') ?? '',
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
      ...(conversation.timeline ?? []).map((item) => [
        item.id,
        item.type,
        item.title,
        item.body ?? '',
        item.occurredAt,
      ].join('::')),
    ].join('|');
  }
}
