import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { Subscription, firstValueFrom } from 'rxjs';
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
  Globe2,
  Paperclip,
  X,
  FileText,
  Image,
  Zap,
  Clock3,
  UserPlus,
  Flag,
  Tags,
  Sparkles,
} from 'lucide-angular';

import { CommunicationService } from '../../core/communications/service';
import { AuthService } from '../../core/auth/auth.service';
import { UsersStore } from '../../core/users/users-store';
import {
  CommunicationChannel,
  CommunicationConversation,
  CommunicationMessage,
  CommunicationTimelineItem,
  CommunicationQuickReply,
  CommunicationKnowledgeSuggestion,
  CommunicationQuoteOption,
} from '../../core/communications/model';
import { ToastService } from '../../core/toast/toast-service';
import { PhonePipe } from '../../core/pipes/phone-pipe';

type ComposerChannel = 'email' | 'sms' | 'web_chat' | 'note';

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
  private readonly auth = inject(AuthService);
  readonly usersStore = inject(UsersStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
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
    Globe2,
    Paperclip,
    X,
    FileText,
    Image,
    Zap,
    Clock3,
    UserPlus,
    Flag,
    Tags,
    Sparkles,
  };

  readonly conversations = signal<CommunicationConversation[]>([]);
  readonly selectedConversation = signal<CommunicationConversation | null>(null);
  readonly loading = signal(false);
  readonly threadLoading = signal(false);
  readonly sending = signal(false);
  readonly conversationActionRunning = signal(false);
  readonly bulkActionRunning = signal(false);
  readonly selectedConversationIds = signal<ReadonlySet<string>>(new Set<string>());
  readonly requestedConversationId = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly searchTerm = signal('');
  readonly conversationStatusFilter = signal<'open' | 'archived' | 'all'>('open');
  readonly assignmentFilter = signal<'all' | 'mine' | 'unassigned'>('all');
  readonly snoozedFilter = signal<'exclude' | 'include' | 'only'>('exclude');
  readonly activeChannel = signal<ComposerChannel>('sms');
  readonly composeSubject = signal('');
  readonly composeBody = signal('');
  readonly pendingAttachments = signal<File[]>([]);
  readonly uploadingAttachments = signal(false);
  readonly quickRepliesOpen = signal(false);
  readonly quickReplies = signal<CommunicationQuickReply[]>([]);
  readonly availableQuickReplies = computed(() => {
    const channel = this.activeChannel();
    if (channel === 'note') return [];
    return this.quickReplies().filter((reply) => reply.isActive && reply.channels.includes(channel));
  });
  readonly addingInternalNote = signal(false);
  readonly nextCursor = signal<string | null>(null);
  readonly workflowSaving = signal(false);
  readonly aiAssistLoading = signal(false);
  readonly suggestedReply = signal<string | null>(null);
  readonly knowledgeSuggestions = signal<CommunicationKnowledgeSuggestion[]>([]);
  readonly quoteOptions = signal<CommunicationQuoteOption[]>([]);
  readonly quoteIdentityMissing = signal<string[]>([]);
  readonly quoteOptionsLoading = signal(false);
  readonly quoteCreating = signal(false);
  readonly newTag = signal('');
  readonly teammates = this.usersStore.assignableUsers;
  readonly anotherTeammateTyping = computed(() => {
    const web = this.selectedConversation()?.webChatContext;
    if (!web?.teammateTyping) return null;
    const currentUserId = this.auth.currentUserId();
    if (web.teammateTypingUserId && currentUserId && web.teammateTypingUserId === currentUserId) return null;
    return web.teammateTypingName || 'Another teammate';
  });

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

  readonly bulkSelectedConversations = computed(() => {
    const selectedIds = this.selectedConversationIds();
    return this.conversations().filter((conversation) => selectedIds.has(conversation.id));
  });
  readonly selectedConversationCount = computed(() => this.bulkSelectedConversations().length);
  readonly selectedUnreadCount = computed(() =>
    this.bulkSelectedConversations().filter((conversation) => conversation.unreadForShopCount > 0).length,
  );
  readonly selectedOpenCount = computed(() =>
    this.bulkSelectedConversations().filter((conversation) => conversation.status !== 'archived').length,
  );
  readonly selectedArchivedCount = computed(() =>
    this.bulkSelectedConversations().filter((conversation) => conversation.status === 'archived').length,
  );
  readonly allVisibleSelected = computed(() => {
    const conversations = this.conversations();
    const selectedIds = this.selectedConversationIds();
    return conversations.length > 0 && conversations.every((conversation) => selectedIds.has(conversation.id));
  });
  readonly someVisibleSelected = computed(() => {
    const selectedCount = this.selectedConversationCount();
    return selectedCount > 0 && !this.allVisibleSelected();
  });

  private readonly inboxPollMs = 2_000;
  private inboxRefreshTimer: ReturnType<typeof setInterval> | null = null;
  private routeParamsSubscription: Subscription | null = null;
  private backgroundRefreshRunning = false;
  private threadRequestVersion = 0;
  private readonly markReadInFlight = new Set<string>();
  private webChatTypingTimer: ReturnType<typeof setTimeout> | null = null;
  private webChatTypingConversationId: string | null = null;
  private webChatTypingLastPingAt = 0;

  async ngOnInit(): Promise<void> {
    if (!this.usersStore.loaded()) void this.usersStore.load().catch(() => undefined);
    await Promise.all([this.loadConversations(), this.loadQuickReplies()]);
    this.startInboxAutoRefresh();

    this.routeParamsSubscription = this.route.queryParamMap.subscribe((params) => {
      void this.handleRouteSelection(params);
    });
  }

  private async loadQuickReplies(): Promise<void> {
    try {
      const response = await firstValueFrom(this.communicationApi.listQuickReplies());
      this.quickReplies.set(response.data ?? []);
    } catch {
      this.quickReplies.set([]);
    }
  }

  private async handleRouteSelection(params: ParamMap): Promise<void> {
    const conversationId = params.get('conversationId')?.trim();
    const repairId = params.get('repairId')?.trim();
    const quoteId = params.get('quoteId')?.trim();
    const customerId = params.get('customerId')?.trim();
    const requestedChannel = this.parseRequestedChannel(params.get('channel'));

    if (conversationId) {
      this.requestedConversationId.set(conversationId);

      if (this.selectedConversation()?.id === conversationId) {
        this.applyRequestedChannel(requestedChannel);
        await this.markSelectedRead();
        return;
      }

      await this.openConversationById(conversationId, true, requestedChannel);
      return;
    }

    if (repairId) {
      await this.openRepairConversation(repairId, requestedChannel);
      return;
    }

    if (quoteId) {
      await this.openQuoteConversation(quoteId, requestedChannel);
      return;
    }

    if (customerId) {
      await this.openCustomerConversation(customerId, requestedChannel);
      return;
    }

    this.requestedConversationId.set(null);
    this.threadRequestVersion += 1;
    this.selectedConversation.set(null);

    const first = this.conversations()[0];
    if (first) {
      await this.navigateToConversation(first.id, true, requestedChannel);
    }
  }

  private parseRequestedChannel(
    value: string | null,
  ): ComposerChannel | null {
    return value === 'email' || value === 'sms' || value === 'web_chat' || value === 'note'
      ? value
      : null;
  }

  private applyRequestedChannel(
    requestedChannel: ComposerChannel | null,
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

    if (requestedChannel === 'web_chat' && this.canSendWebChat(conversation)) {
      this.activeChannel.set('web_chat');
      return;
    }

    if (requestedChannel === 'email' && this.canSendEmail(conversation)) {
      this.activeChannel.set('email');
    }
  }

  private async navigateToConversation(
    conversationId: string | null,
    replaceUrl = false,
    requestedChannel: ComposerChannel | null = null,
  ): Promise<void> {
    const queryParams: Record<string, string | null> = {
      conversationId,
      repairId: null,
      quoteId: null,
      customerId: null,
    };

    if (requestedChannel) queryParams['channel'] = requestedChannel;

    await this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
      replaceUrl,
    });
  }

  ngOnDestroy(): void {
    if (this.inboxRefreshTimer) {
      clearInterval(this.inboxRefreshTimer);
      this.inboxRefreshTimer = null;
    }

    this.routeParamsSubscription?.unsubscribe();
    this.routeParamsSubscription = null;
    void this.stopWebChatTyping();
  }

  private startInboxAutoRefresh(): void {
    if (this.inboxRefreshTimer) return;

    this.inboxRefreshTimer = setInterval(() => {
      void this.refreshInBackground();
    }, this.inboxPollMs);
  }

  private async refreshInBackground(): Promise<void> {
    if (
      this.backgroundRefreshRunning ||
      this.sending() ||
      this.bulkActionRunning() ||
      this.conversationActionRunning()
    ) return;

    this.backgroundRefreshRunning = true;

    try {
      const response = await firstValueFrom(
        this.communicationApi.listConversations({
          limit: 50,
          q: this.searchTerm().trim() || undefined,
          status: this.conversationStatusFilter(),
          assignment: this.assignmentFilter(),
          snoozed: this.snoozedFilter(),
        }),
      );

      this.reconcileConversationList(response.data ?? []);
      this.pruneBulkSelectionToVisible();
      this.nextCursor.set(response.nextCursor ?? null);

      const selectedId = this.requestedConversationId();
      if (!selectedId || this.threadLoading()) return;

      const requestVersion = this.threadRequestVersion;
      const threadResponse = await firstValueFrom(
        this.communicationApi.getConversation(selectedId),
      );

      if (
        this.requestedConversationId() !== selectedId ||
        this.threadRequestVersion !== requestVersion
      ) {
        return;
      }

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
        if (this.activeChannel() === 'web_chat' && !this.canSendWebChat(threadResponse.data)) {
          this.activeChannel.set(this.canSendSms(threadResponse.data) ? 'sms' : 'email');
        }
        if (this.activeChannel() === 'sms' && !this.canSendSms(threadResponse.data)) {
          this.activeChannel.set(this.canSendWebChat(threadResponse.data) ? 'web_chat' : 'email');
        }
        if (
          this.activeChannel() === 'email' &&
          !this.canSendEmail(threadResponse.data)
        ) {
          this.activeChannel.set(
            this.canSendWebChat(threadResponse.data)
              ? 'web_chat'
              : this.canSendSms(threadResponse.data)
                ? 'sms'
                : 'note',
          );
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
    await this.syncConversationSelectionAfterListChange();
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
          assignment: this.assignmentFilter(),
          snoozed: this.snoozedFilter(),
        }),
      );

      this.conversations.set(response.data ?? []);
      this.pruneBulkSelectionToVisible();
      this.nextCursor.set(response.nextCursor ?? null);
    } catch (error) {
      console.error(error);
      this.error.set('Could not load conversations.');
      this.conversations.set([]);
      this.selectedConversationIds.set(new Set<string>());
      this.nextCursor.set(null);
    } finally {
      this.loading.set(false);
    }
  }

  async setAssignmentFilter(value: 'all' | 'mine' | 'unassigned'): Promise<void> {
    if (this.assignmentFilter() === value) return;
    this.assignmentFilter.set(value);
    await this.loadConversations();
  }

  async setSnoozedFilter(value: 'exclude' | 'include' | 'only'): Promise<void> {
    if (this.snoozedFilter() === value) return;
    this.snoozedFilter.set(value);
    await this.loadConversations();
  }

  async updateWorkflow(payload: { assignedUserId?: string | null; snoozedUntil?: string | null; priority?: 'low' | 'normal' | 'high' | 'urgent'; tags?: string[]; intent?: string | null }): Promise<void> {
    const conversation = this.selectedConversation();
    if (!conversation || this.workflowSaving()) return;
    this.workflowSaving.set(true);
    try {
      const response = await firstValueFrom(this.communicationApi.updateConversationWorkflow(conversation.id, payload));
      this.selectedConversation.set(response.data);
      this.upsertConversation(response.data);
    } catch (error) {
      console.error(error);
      this.toast.error('Could not update conversation');
    } finally {
      this.workflowSaving.set(false);
    }
  }

  async takeConversation(): Promise<void> {
    const userId = this.auth.currentUserId();
    if (!userId) return;
    await this.updateWorkflow({ assignedUserId: userId, snoozedUntil: null });
  }

  async assignConversation(userId: string | null): Promise<void> {
    await this.updateWorkflow({ assignedUserId: userId || null });
  }

  async snoozeConversation(option: 'hour' | 'tomorrow' | 'week' | 'clear'): Promise<void> {
    if (option === 'clear') {
      await this.updateWorkflow({ snoozedUntil: null });
      return;
    }
    const date = new Date();
    if (option === 'hour') date.setHours(date.getHours() + 1);
    if (option === 'tomorrow') date.setDate(date.getDate() + 1);
    if (option === 'week') date.setDate(date.getDate() + 7);
    await this.updateWorkflow({ snoozedUntil: date.toISOString() });
  }

  async setConversationPriority(priority: 'low' | 'normal' | 'high' | 'urgent'): Promise<void> {
    await this.updateWorkflow({ priority });
  }

  async addConversationTag(): Promise<void> {
    const conversation = this.selectedConversation();
    const tag = this.newTag().trim();
    if (!conversation || !tag) return;
    const tags = [...new Set([...(conversation.tags ?? []), tag])].slice(0, 20);
    this.newTag.set('');
    await this.updateWorkflow({ tags });
  }

  async removeConversationTag(tag: string): Promise<void> {
    const conversation = this.selectedConversation();
    if (!conversation) return;
    await this.updateWorkflow({ tags: (conversation.tags ?? []).filter((item) => item !== tag) });
  }

  async refreshAiSummary(): Promise<void> {
    const conversation = this.selectedConversation();
    if (!conversation || this.aiAssistLoading()) return;
    this.aiAssistLoading.set(true);
    try {
      const response = await firstValueFrom(this.communicationApi.getAiAssist(conversation.id, 'all'));
      if (response.conversation) {
        this.selectedConversation.set(response.conversation);
        this.upsertConversation(response.conversation);
      }
      this.suggestedReply.set(response.data.suggestedReply ?? null);
      this.knowledgeSuggestions.set(response.data.knowledgeSuggestions ?? []);
    } catch (error) {
      console.error(error);
      this.toast.error('AI assist is unavailable right now');
    } finally {
      this.aiAssistLoading.set(false);
    }
  }

  async insertSuggestedReply(): Promise<void> {
    const conversation = this.selectedConversation();
    if (!conversation || this.aiAssistLoading()) return;
    this.aiAssistLoading.set(true);
    try {
      const response = await firstValueFrom(this.communicationApi.getAiAssist(conversation.id, 'suggest_reply'));
      const suggestion = response.data.suggestedReply?.trim();
      if (suggestion) {
        this.suggestedReply.set(suggestion);
        this.composeBody.set(suggestion);
      }
    } catch (error) {
      console.error(error);
      this.toast.error('Could not generate a suggested reply');
    } finally {
      this.aiAssistLoading.set(false);
    }
  }

  async findKnowledgeSuggestions(): Promise<void> {
    const conversation = this.selectedConversation();
    if (!conversation || this.aiAssistLoading()) return;
    this.aiAssistLoading.set(true);
    try {
      const response = await firstValueFrom(this.communicationApi.getAiAssist(conversation.id, 'knowledge'));
      this.knowledgeSuggestions.set(response.data.knowledgeSuggestions ?? []);
      if (!response.data.knowledgeSuggestions?.length) {
        this.toast.success('No matching knowledge articles', 'There were no strong KB matches for this conversation.');
      }
    } catch (error) {
      console.error(error);
      this.toast.error('Could not search the knowledge base');
    } finally {
      this.aiAssistLoading.set(false);
    }
  }

  async loadQuoteOptionsFromConversation(): Promise<void> {
    const conversation = this.selectedConversation();
    if (!conversation?.webChatContext || this.quoteOptionsLoading()) return;
    this.quoteOptionsLoading.set(true);
    this.quoteOptions.set([]);
    this.quoteIdentityMissing.set([]);
    try {
      const response = await firstValueFrom(this.communicationApi.getConversationQuoteOptions(conversation.id));
      this.quoteOptions.set(response.data ?? []);
      this.quoteIdentityMissing.set(response.missingIdentity ?? []);
      if (!response.identityReady) {
        this.toast.error('Customer details needed', `Collect ${response.missingIdentity.join(', ')} before creating a quote.`);
      } else if (!response.data?.length) {
        this.toast.error('No exact quote found', 'This conversation does not map confidently to an instant pricing option.');
      }
    } catch (error) {
      console.error(error);
      this.toast.error('Could not find quote options');
    } finally {
      this.quoteOptionsLoading.set(false);
    }
  }

  async createQuoteFromConversation(option: CommunicationQuoteOption): Promise<void> {
    const conversation = this.selectedConversation();
    if (!conversation || this.quoteCreating()) return;
    const confirmed = window.confirm(`Create and send ${option.deviceLabel} · ${option.repairLabel} (${option.variantName}) for ${this.money(option.totalCents)}?`);
    if (!confirmed) return;
    this.quoteCreating.set(true);
    try {
      const response = await firstValueFrom(this.communicationApi.createConversationQuote(conversation.id, {
        templateId: option.templateId,
        serviceMode: option.serviceMode,
      }));
      this.selectedConversation.set(response.conversation);
      this.upsertConversation(response.conversation);
      this.quoteOptions.set([]);
      this.toast.success('Quote created', response.message);
      this.scheduleScrollToBottom();
    } catch (error: any) {
      console.error(error);
      this.toast.error('Quote not created', error?.error?.message || 'The quote could not be created from this conversation.');
    } finally {
      this.quoteCreating.set(false);
    }
  }

  async openQuoteConversation(
    quoteId: string,
    requestedChannel: ComposerChannel | null = null,
  ): Promise<void> {
    await this.openEnsuredConversation(
      () => this.communicationApi.ensureQuoteConversation(quoteId),
      'Could not open the quote conversation.',
      requestedChannel,
    );
  }

  async openRepairConversation(
    repairId: string,
    requestedChannel: ComposerChannel | null = null,
  ): Promise<void> {
    await this.openEnsuredConversation(
      () => this.communicationApi.ensureRepairConversation(repairId),
      'Could not open the repair conversation.',
      requestedChannel,
    );
  }

  async openCustomerConversation(
    customerId: string,
    requestedChannel: ComposerChannel | null = null,
  ): Promise<void> {
    await this.openEnsuredConversation(
      () => this.communicationApi.ensureCustomerConversation(customerId),
      'Could not open the customer conversation.',
      requestedChannel,
    );
  }

  private async openEnsuredConversation(
    request: () => ReturnType<CommunicationService['getConversation']>,
    errorMessage: string,
    requestedChannel: ComposerChannel | null,
  ): Promise<void> {
    const requestVersion = ++this.threadRequestVersion;
    this.threadLoading.set(true);
    this.error.set(null);

    try {
      const response = await firstValueFrom(request());
      if (requestVersion !== this.threadRequestVersion) return;

      this.requestedConversationId.set(response.data.id);
      this.setOpenedConversation(response.data, requestedChannel);
      await this.navigateToConversation(response.data.id, true, requestedChannel);
      await this.markSelectedRead();
    } catch (error) {
      if (requestVersion !== this.threadRequestVersion) return;
      console.error(error);
      this.error.set(errorMessage);
    } finally {
      if (requestVersion === this.threadRequestVersion) {
        this.threadLoading.set(false);
      }
    }
  }

  async openConversation(conversation: CommunicationConversation): Promise<void> {
    if (this.requestedConversationId() === conversation.id) {
      await this.markSelectedRead();
      return;
    }

    await this.navigateToConversation(conversation.id);
  }

  async openConversationById(
    id: string,
    showLoading = true,
    requestedChannel: ComposerChannel | null = null,
  ): Promise<void> {
    const requestVersion = ++this.threadRequestVersion;
    this.requestedConversationId.set(id);
    if (showLoading) this.threadLoading.set(true);
    this.error.set(null);

    try {
      const response = await firstValueFrom(this.communicationApi.getConversation(id));

      if (
        requestVersion !== this.threadRequestVersion ||
        this.requestedConversationId() !== id
      ) {
        return;
      }

      this.setOpenedConversation(response.data, requestedChannel);
      await this.markSelectedRead();
    } catch (error) {
      if (requestVersion !== this.threadRequestVersion) return;
      console.error(error);
      this.error.set('Could not open this conversation.');
    } finally {
      if (showLoading && requestVersion === this.threadRequestVersion) {
        this.threadLoading.set(false);
      }
    }
  }

  private setOpenedConversation(
    conversation: CommunicationConversation,
    requestedChannel: ComposerChannel | null,
  ): void {
    void this.stopWebChatTyping();
    this.quickRepliesOpen.set(false);
    this.knowledgeSuggestions.set([]);
    this.quoteOptions.set([]);
    this.quoteIdentityMissing.set([]);
    this.suggestedReply.set(null);
    this.selectedConversation.set(conversation);
    this.activeChannel.set(
      conversation.lastMessageChannel === 'web_chat' && this.canSendWebChat(conversation)
        ? 'web_chat'
        : this.canSendSms(conversation)
          ? 'sms'
          : this.canSendEmail(conversation)
            ? 'email'
            : this.canSendWebChat(conversation)
              ? 'web_chat'
              : 'note',
    );
    this.applyRequestedChannel(requestedChannel);
    this.upsertConversation(conversation);
    this.scheduleScrollToBottom();
  }

  async markSelectedRead(): Promise<void> {
    const selected = this.selectedConversation();
    if (
      !selected ||
      selected.unreadForShopCount <= 0 ||
      this.markReadInFlight.has(selected.id)
    ) return;

    const selectedId = selected.id;
    this.markReadInFlight.add(selectedId);

    try {
      const response = await firstValueFrom(
        this.communicationApi.markConversationRead(selectedId),
      );

      this.upsertConversation(response.data);

      if (this.requestedConversationId() === selectedId) {
        this.selectedConversation.set(response.data);
        this.scheduleScrollToBottom();
      }
    } catch (error) {
      console.error(error);
    } finally {
      this.markReadInFlight.delete(selectedId);
    }
  }

  async sendMessage(): Promise<void> {
    const conversation = this.selectedConversation();
    const body = this.composeBody().trim();
    const channel = this.activeChannel();

    const pendingFiles = this.pendingAttachments();
    const hasAttachmentPayload = channel === 'web_chat' && pendingFiles.length > 0;
    if (!conversation || (!body && !hasAttachmentPayload) || this.sending()) return;

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

    if (channel === 'web_chat' && !this.canSendWebChat(conversation)) {
      this.toast.error('Web chat unavailable', 'This website chat is no longer active.');
      return;
    }

    this.sending.set(true);
    this.error.set(null);
    this.quickRepliesOpen.set(false);
    if (channel === 'web_chat') void this.setWebChatTyping(false);

    try {
      const attachmentIds = channel === 'web_chat'
        ? await this.uploadPendingAttachments(conversation.id)
        : [];
      const request = {
        subject: this.composeSubject().trim() || undefined,
        body,
        attachmentIds,
      };

      const response = await firstValueFrom(
        channel === 'email'
          ? this.communicationApi.sendEmailMessage(conversation.id, request)
          : channel === 'web_chat'
            ? this.communicationApi.sendWebChatMessage(conversation.id, request)
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
        timeline: conversation.timeline?.length
          ? [...conversation.timeline, this.messageToTimelineItem(response.data)]
          : conversation.timeline,
      };

      this.selectedConversation.set(next);
      this.upsertConversation(next);
      this.scheduleScrollToBottom();
      this.composeBody.set('');
      this.pendingAttachments.set([]);
      if (channel === 'email') this.composeSubject.set('');
      this.toast.success(channel === 'email' ? 'Email sent' : channel === 'web_chat' ? 'Web chat sent' : 'SMS sent');
    } catch (error) {
      console.error(error);
      this.toast.error(channel === 'email' ? 'Could not send email' : channel === 'web_chat' ? 'Could not send web chat' : 'Could not send SMS');
      this.error.set(channel === 'email' ? 'Could not send email.' : channel === 'web_chat' ? 'Could not send web chat.' : 'Could not send SMS.');
    } finally {
      this.sending.set(false);
    }
  }

  onAttachmentFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (!files.length) return;

    const maxBytes = 15 * 1024 * 1024;
    const allowed = files.filter((file) => {
      if (file.size <= 0 || file.size > maxBytes) {
        this.toast.error('Attachment too large', `${file.name} must be 15 MB or smaller.`);
        return false;
      }
      return true;
    });
    const next = [...this.pendingAttachments(), ...allowed].slice(0, 5);
    if (this.pendingAttachments().length + allowed.length > 5) {
      this.toast.info('Attachment limit', 'You can send up to 5 attachments at a time.');
    }
    this.pendingAttachments.set(next);
  }

  removePendingAttachment(index: number): void {
    this.pendingAttachments.update((files) => files.filter((_, currentIndex) => currentIndex !== index));
  }

  isImageAttachment(contentType: string | null | undefined): boolean {
    return String(contentType ?? '').toLowerCase().startsWith('image/');
  }

  formatAttachmentSize(bytes: number | null | undefined): string {
    const value = Number(bytes ?? 0);
    if (!value) return '';
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
    return `${(value / (1024 * 1024)).toFixed(value >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
  }

  teammateInitials(item: CommunicationTimelineItem): string {
    const name = this.timelineActor(item).trim();
    const parts = name.split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    return (parts.length === 1 ? parts[0].slice(0, 2) : `${parts[0][0]}${parts[parts.length - 1][0]}`).toUpperCase();
  }

  private async uploadPendingAttachments(conversationId: string): Promise<string[]> {
    const files = this.pendingAttachments();
    if (!files.length) return [];
    this.uploadingAttachments.set(true);
    try {
      const ids: string[] = [];
      for (const file of files) {
        const mimeType = file.type || 'application/octet-stream';
        const init = await firstValueFrom(this.communicationApi.initAttachment(conversationId, {
          filename: file.name,
          mimeType,
          sizeBytes: file.size,
        }));
        const uploadResponse = await fetch(init.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': mimeType },
          body: file,
        });
        if (!uploadResponse.ok) throw new Error(`Attachment upload failed (${uploadResponse.status})`);
        const completed = await firstValueFrom(this.communicationApi.completeAttachment(conversationId, {
          filename: file.name,
          mimeType,
          sizeBytes: file.size,
          storageKey: init.storageKey,
        }));
        ids.push(completed.data.id);
      }
      return ids;
    } finally {
      this.uploadingAttachments.set(false);
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

  async applySearch(): Promise<void> {
    this.clearBulkSelection();
    this.nextCursor.set(null);
    await this.loadConversations();
    await this.syncConversationSelectionAfterListChange();
  }

  async clearSearch(): Promise<void> {
    if (!this.searchTerm().trim()) return;
    this.searchTerm.set('');
    await this.applySearch();
  }

  async setConversationStatusFilter(status: 'open' | 'archived' | 'all'): Promise<void> {
    if (this.conversationStatusFilter() === status) return;

    this.conversationStatusFilter.set(status);
    this.clearBulkSelection();
    this.selectedConversation.set(null);
    this.threadRequestVersion += 1;
    this.nextCursor.set(null);
    await this.loadConversations();
    await this.syncConversationSelectionAfterListChange();
  }

  isConversationBulkSelected(conversationId: string): boolean {
    return this.selectedConversationIds().has(conversationId);
  }

  toggleConversationSelection(conversationId: string, checked: boolean): void {
    this.selectedConversationIds.update((current) => {
      const next = new Set(current);
      if (checked) next.add(conversationId);
      else next.delete(conversationId);
      return next;
    });
  }

  toggleSelectAllVisible(checked: boolean): void {
    if (!checked) {
      this.clearBulkSelection();
      return;
    }

    this.selectedConversationIds.set(
      new Set(this.conversations().map((conversation) => conversation.id)),
    );
  }

  clearBulkSelection(): void {
    if (this.selectedConversationIds().size === 0) return;
    this.selectedConversationIds.set(new Set<string>());
  }

  async bulkMarkRead(): Promise<void> {
    const targets = this.bulkSelectedConversations().filter(
      (conversation) => conversation.unreadForShopCount > 0,
    );
    if (targets.length === 0 || this.bulkActionRunning()) return;

    this.bulkActionRunning.set(true);
    this.error.set(null);

    try {
      const results = await Promise.allSettled(
        targets.map((conversation) =>
          firstValueFrom(this.communicationApi.markConversationRead(conversation.id)),
        ),
      );

      let succeeded = 0;
      results.forEach((result) => {
        if (result.status !== 'fulfilled') return;
        succeeded += 1;
        this.upsertConversation(result.value.data);
        if (this.requestedConversationId() === result.value.data.id) {
          this.selectedConversation.set(result.value.data);
        }
      });

      this.clearBulkSelection();
      this.showBulkResult('marked read', succeeded, targets.length);
    } finally {
      this.bulkActionRunning.set(false);
    }
  }

  async bulkArchive(): Promise<void> {
    const targets = this.bulkSelectedConversations().filter(
      (conversation) => conversation.status !== 'archived',
    );
    if (targets.length === 0 || this.bulkActionRunning()) return;

    const confirmed = window.confirm(
      `Archive ${targets.length} conversation${targets.length === 1 ? '' : 's'}?`,
    );
    if (!confirmed) return;

    await this.runBulkMoveAction(
      targets.map((conversation) => conversation.id),
      (id) => this.communicationApi.archiveConversation(id),
      'archived',
    );
  }

  async bulkReopen(): Promise<void> {
    const targets = this.bulkSelectedConversations().filter(
      (conversation) => conversation.status === 'archived',
    );
    if (targets.length === 0 || this.bulkActionRunning()) return;

    await this.runBulkMoveAction(
      targets.map((conversation) => conversation.id),
      (id) => this.communicationApi.reopenConversation(id),
      'reopened',
    );
  }

  async bulkDelete(): Promise<void> {
    const targets = this.bulkSelectedConversations();
    if (targets.length === 0 || this.bulkActionRunning()) return;

    const confirmed = window.confirm(
      `Delete ${targets.length} conversation${targets.length === 1 ? '' : 's'} and all message history? This cannot be undone.`,
    );
    if (!confirmed) return;

    this.bulkActionRunning.set(true);
    this.error.set(null);

    try {
      const results = await Promise.allSettled(
        targets.map((conversation) =>
          firstValueFrom(this.communicationApi.deleteConversation(conversation.id)),
        ),
      );
      const succeeded = results.filter((result) => result.status === 'fulfilled').length;

      this.clearBulkSelection();
      await this.loadConversations();
      await this.syncConversationSelectionAfterListChange();
      this.showBulkResult('deleted', succeeded, targets.length);
    } finally {
      this.bulkActionRunning.set(false);
    }
  }

  private async runBulkMoveAction(
    ids: string[],
    action: (id: string) => ReturnType<CommunicationService['archiveConversation']>,
    actionLabel: 'archived' | 'reopened',
  ): Promise<void> {
    this.bulkActionRunning.set(true);
    this.error.set(null);

    try {
      const results = await Promise.allSettled(
        ids.map((id) => firstValueFrom(action(id))),
      );
      const succeeded = results.filter((result) => result.status === 'fulfilled').length;

      this.clearBulkSelection();
      await this.loadConversations();
      await this.syncConversationSelectionAfterListChange();
      this.showBulkResult(actionLabel, succeeded, ids.length);
    } finally {
      this.bulkActionRunning.set(false);
    }
  }

  private showBulkResult(actionLabel: string, succeeded: number, attempted: number): void {
    if (succeeded === attempted) {
      this.toast.success(
        `${succeeded} conversation${succeeded === 1 ? '' : 's'} ${actionLabel}`,
      );
      return;
    }

    this.toast.error(
      'Some conversations were not updated',
      `${succeeded} of ${attempted} conversations were ${actionLabel}.`,
    );
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
      await this.loadConversations();
      await this.syncConversationSelectionAfterListChange();
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
      await this.loadConversations();
      await this.syncConversationSelectionAfterListChange();
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
      await this.loadConversations();
      await this.syncConversationSelectionAfterListChange();
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

  setChannel(channel: ComposerChannel): void {
    if (this.activeChannel() === 'web_chat' && channel !== 'web_chat') {
      void this.stopWebChatTyping();
    }
    this.quickRepliesOpen.set(false);
    this.activeChannel.set(channel);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { channel },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  onComposeBodyChange(value: string): void {
    this.composeBody.set(value);
    const conversation = this.selectedConversation();
    if (!conversation || this.activeChannel() !== 'web_chat' || !this.canSendWebChat(conversation)) return;

    if (!value.trim()) {
      void this.setWebChatTyping(false);
      return;
    }

    void this.setWebChatTyping(true);
    if (this.webChatTypingTimer) clearTimeout(this.webChatTypingTimer);
    this.webChatTypingTimer = setTimeout(() => void this.setWebChatTyping(false), 2_600);
  }

  onComposerKeydown(event: KeyboardEvent): void {
    if (event.key === '/' && !this.composeBody().trim() && this.activeChannel() !== 'note') {
      event.preventDefault();
      this.quickRepliesOpen.set(true);
    }
    if (event.key === 'Escape' && this.quickRepliesOpen()) {
      this.quickRepliesOpen.set(false);
    }
  }

  toggleQuickReplies(): void {
    this.quickRepliesOpen.update((open) => !open);
  }

  useQuickReply(reply: CommunicationQuickReply): void {
    const customerName = this.selectedCustomerProfile()?.name?.trim() ?? '';
    const firstName = customerName.split(/\s+/).filter(Boolean)[0] ?? '';
    const resolved = reply.body.replaceAll('{{first_name}}', firstName || 'there');
    this.composeBody.set(resolved);
    this.quickRepliesOpen.set(false);
    if (this.activeChannel() === 'web_chat') this.onComposeBodyChange(resolved);
  }

  private async setWebChatTyping(typing: boolean): Promise<void> {
    const conversation = this.selectedConversation();
    if (!conversation || !conversation.webChatEnabled) return;

    if (this.webChatTypingTimer && !typing) {
      clearTimeout(this.webChatTypingTimer);
      this.webChatTypingTimer = null;
    }
    const now = Date.now();
    if (typing && this.webChatTypingConversationId === conversation.id && now - this.webChatTypingLastPingAt < 2_500) {
      return;
    }
    this.webChatTypingConversationId = typing ? conversation.id : null;
    this.webChatTypingLastPingAt = typing ? now : 0;
    try {
      await firstValueFrom(this.communicationApi.setWebChatTyping(conversation.id, typing));
    } catch {
      // Typing presence is best-effort and must never block the composer.
    }
  }

  private async stopWebChatTyping(): Promise<void> {
    if (this.webChatTypingTimer) {
      clearTimeout(this.webChatTypingTimer);
      this.webChatTypingTimer = null;
    }
    const conversationId = this.webChatTypingConversationId ?? (this.activeChannel() === 'web_chat' ? this.selectedConversation()?.id ?? null : null);
    this.webChatTypingConversationId = null;
    this.webChatTypingLastPingAt = 0;
    if (!conversationId) return;
    try {
      await firstValueFrom(this.communicationApi.setWebChatTyping(conversationId, false));
    } catch {
      // Best-effort cleanup; server-side presence expires automatically.
    }
  }

  canSendEmail(conversation: CommunicationConversation): boolean {
    return Boolean(conversation.customerEmail);
  }

  canSendSms(conversation: CommunicationConversation): boolean {
    return Boolean(conversation.customerPhone && conversation.smsEnabled);
  }

  canSendWebChat(conversation: CommunicationConversation): boolean {
    return Boolean(conversation.webChatEnabled && conversation.webChatState !== 'closed');
  }

  canSendActiveChannel(conversation: CommunicationConversation): boolean {
    if (conversation.status === 'archived') return false;
    if (this.activeChannel() === 'note') return true;

    if (this.activeChannel() === 'web_chat') return this.canSendWebChat(conversation);
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

    if (this.activeChannel() === 'web_chat' && !this.canSendWebChat(conversation)) {
      return 'This website chat is no longer active.';
    }

    return null;
  }

  composePlaceholder(conversation: CommunicationConversation): string {
    const unavailable = this.activeChannelUnavailableText(conversation);
    if (unavailable) return unavailable;
    if (this.activeChannel() === 'note') return 'Add an internal note...';
    if (this.activeChannel() === 'web_chat') return 'Reply in website chat...';
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
    if (channel === 'web_chat') return 'Web Chat';
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
      readAt: message.readAt,
      attachments: message.attachments ?? [],
      tone: isInternalNote ? 'note' : message.direction === 'outbound' ? 'outbound' : 'inbound',
    };
  }

  webChatStateLabel(state: string | null | undefined): string {
    switch (state) {
      case 'ai': return 'AI handling';
      case 'human_requested': return 'Needs teammate';
      case 'human': return 'Teammate joined';
      case 'closed': return 'Chat ended';
      default: return 'Web visitor';
    }
  }

  webChatStateClass(state: string | null | undefined): string {
    switch (state) {
      case 'ai': return 'bg-violet-50 text-violet-700 ring-violet-100';
      case 'human_requested': return 'bg-amber-50 text-amber-700 ring-amber-100';
      case 'human': return 'bg-emerald-50 text-emerald-700 ring-emerald-100';
      default: return 'bg-app-surface-muted text-app-text-muted ring-app-border';
    }
  }

  webChatHost(value: string | null | undefined): string | null {
    if (!value) return null;
    try {
      return new URL(value).host.replace(/^www\./i, '');
    } catch {
      return value;
    }
  }

  webChatPageLabel(title: string | null | undefined, url: string | null | undefined): string {
    if (title?.trim()) return title.trim();
    if (!url) return 'Website visitor';
    try {
      const parsed = new URL(url);
      return parsed.pathname === '/' ? parsed.host : parsed.pathname;
    } catch {
      return url;
    }
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

  private async syncConversationSelectionAfterListChange(): Promise<void> {
    const requestedId = this.requestedConversationId();
    const requestedStillVisible = Boolean(
      requestedId && this.conversations().some((conversation) => conversation.id === requestedId),
    );

    if (requestedId && requestedStillVisible) {
      await this.openConversationById(
        requestedId,
        false,
        this.parseRequestedChannel(this.route.snapshot.queryParamMap.get('channel')),
      );
      return;
    }

    this.threadRequestVersion += 1;
    this.selectedConversation.set(null);
    this.requestedConversationId.set(null);

    const first = this.conversations()[0];
    await this.navigateToConversation(
      first?.id ?? null,
      true,
      this.parseRequestedChannel(this.route.snapshot.queryParamMap.get('channel')),
    );
  }

  private pruneBulkSelectionToVisible(): void {
    const visibleIds = new Set(this.conversations().map((conversation) => conversation.id));
    const current = this.selectedConversationIds();
    const next = new Set([...current].filter((id) => visibleIds.has(id)));

    if (next.size !== current.size) {
      this.selectedConversationIds.set(next);
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
      const aDate = new Date(a.lastMessageAt || a.createdAt || a.updatedAt).getTime();
      const bDate = new Date(b.lastMessageAt || b.createdAt || b.updatedAt).getTime();
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
      conversation.webChatState ?? '',
      conversation.webChatContext?.lastSeenAt ?? '',
      conversation.webChatContext?.pageUrl ?? '',
      conversation.webChatContext?.visitorTyping ? 'typing' : '',
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
