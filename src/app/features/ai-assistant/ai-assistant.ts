import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom, Subscription } from 'rxjs';
import {
  Archive,
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  ChevronLeft,
  Clipboard,
  Clock3,
  Copy,
  ExternalLink,
  FileText,
  Gauge,
  History,
  Lightbulb,
  Link2,
  ListPlus,
  Loader2,
  MessageSquareText,
  Maximize2,
  Plus,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Trash2,
  UserRound,
  Wrench,
  X,
  Zap,
  LucideAngularModule,
} from 'lucide-angular';

import { AiAssistantService } from '../../core/ai-assistant/service';
import type {
  AiContextRef,
  AiConversation,
  AiConversationSummary,
  AiMessage,
  AiStatus,
  AiSuggestedAction,
  AiUsageDay,
} from '../../core/ai-assistant/model';
import type { RepairStatus } from '../../core/repairs/repair.model';
import { RepairsService } from '../../core/repairs/repairs-service';
import type { GlobalSearchResponse, SearchItem } from '../../core/search/search-service';
import { SearchService } from '../../core/search/search-service';
import { ToastService } from '../../core/toast/toast-service';
import { WorkQueueService } from '../../core/work-queue/service';

@Component({
  selector: 'app-ai-assistant',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './ai-assistant.html',
  styleUrl: './ai-assistant.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiAssistant implements OnInit, OnDestroy {
  @Input() drawerMode = false;
  @Output() closeRequested = new EventEmitter<void>();
  @Output() expandRequested = new EventEmitter<string | null>();

  @ViewChild('messageViewport') private messageViewport?: ElementRef<HTMLDivElement>;
  @ViewChild('composerInput') private composerInput?: ElementRef<HTMLTextAreaElement>;

  private readonly api = inject(AiAssistantService);
  private readonly searchApi = inject(SearchService);
  private readonly workQueue = inject(WorkQueueService);
  private readonly repairs = inject(RepairsService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly icons = {
    Archive,
    ArrowRight,
    Bot,
    Check,
    CheckCircle2,
    ChevronLeft,
    Clipboard,
    Clock3,
    Copy,
    ExternalLink,
    FileText,
    Gauge,
    History,
    Lightbulb,
    Link2,
    ListPlus,
    Loader2,
    MessageSquareText,
    Maximize2,
    Plus,
    RefreshCw,
    Search,
    Send,
    Sparkles,
    Trash2,
    UserRound,
    Wrench,
    X,
    Zap,
  };

  readonly status = signal<AiStatus | null>(null);
  readonly usage = signal<AiUsageDay[]>([]);
  readonly conversations = signal<AiConversationSummary[]>([]);
  readonly activeConversation = signal<AiConversation | null>(null);
  readonly selectedContexts = signal<AiContextRef[]>([]);
  readonly contextResults = signal<SearchItem[]>([]);
  readonly contextSearchOpen = signal(false);
  readonly contextSearching = signal(false);
  readonly loading = signal(true);
  readonly conversationLoading = signal(false);
  readonly sending = signal(false);
  readonly creatingConversation = signal(false);
  readonly sidebarOpen = signal(false);
  readonly error = signal<string | null>(null);
  readonly actionWorkingId = signal<string | null>(null);
  readonly reviewingActionId = signal<string | null>(null);

  draft = '';
  contextQuery = '';

  private routeSubscription: Subscription | null = null;
  private contextSearchTimer: ReturnType<typeof setTimeout> | null = null;

  readonly requestsRemaining = computed(() => {
    const current = this.status();
    if (!current) return 0;
    return Math.max(0, current.dailyRequestLimit - current.usageToday.requestCount);
  });

  readonly usage30Days = computed(() =>
    this.usage().reduce(
      (total, day) => ({
        requests: total.requests + day.requestCount,
        tokens: total.tokens + day.totalTokens,
        costMicros: total.costMicros + day.estimatedCostMicros,
      }),
      { requests: 0, tokens: 0, costMicros: 0 },
    ),
  );

  readonly pendingActionCount = computed(() =>
    (this.activeConversation()?.messages ?? []).reduce(
      (total, message) => total + message.actions.filter((action) => action.status === 'pending').length,
      0,
    ),
  );

  readonly quickPrompts = [
    'Summarize today’s operations and tell me what needs attention first.',
    'Which active repairs look blocked or at risk, and what should happen next?',
    'Summarize the current technician workload and highlight anything overdue.',
    'Find unanswered customer conversations and suggest follow-up messages.',
    'Use our Knowledge Base to explain the best procedure for the selected record.',
  ];

  ngOnInit(): void {
    if (this.drawerMode) {
      void this.bootstrap(null);
      return;
    }

    this.routeSubscription = this.route.queryParamMap.subscribe((params) => {
      const conversationId = params.get('conversationId');
      void this.bootstrap(conversationId);
    });
  }

  ngOnDestroy(): void {
    this.routeSubscription?.unsubscribe();
    this.routeSubscription = null;
    if (this.contextSearchTimer) clearTimeout(this.contextSearchTimer);
  }


  requestClose(): void {
    this.closeRequested.emit();
  }

  requestExpand(): void {
    this.expandRequested.emit(this.activeConversation()?.id ?? null);
  }

  async bootstrap(requestedConversationId: string | null): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const [statusResponse, conversationsResponse, usageResponse] = await Promise.all([
        firstValueFrom(this.api.getStatus()),
        firstValueFrom(this.api.listConversations()),
        firstValueFrom(this.api.getUsage(30)),
      ]);

      this.status.set(statusResponse);
      this.conversations.set(conversationsResponse.data);
      this.usage.set(usageResponse.data);

      if (!statusResponse.configured) {
        this.activeConversation.set(null);
        return;
      }

      const targetId = requestedConversationId && conversationsResponse.data.some((row) => row.id === requestedConversationId)
        ? requestedConversationId
        : conversationsResponse.data[0]?.id ?? null;

      if (targetId) {
        await this.loadConversation(targetId, false);
      }
    } catch (error) {
      console.error('AI Assistant bootstrap failed.', error);
      this.error.set(this.errorMessage(error, 'The AI Assistant could not be loaded.'));
    } finally {
      this.loading.set(false);
    }
  }

  async refresh(): Promise<void> {
    const currentId = this.activeConversation()?.id ?? null;
    await this.bootstrap(currentId);
  }

  async loadConversation(id: string, updateUrl = true): Promise<void> {
    if (!id || this.conversationLoading()) return;
    this.conversationLoading.set(true);
    this.error.set(null);

    try {
      const response = await firstValueFrom(this.api.getConversation(id));
      this.activeConversation.set(response.data);
      this.sidebarOpen.set(false);
      if (updateUrl && !this.drawerMode) {
        await this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { conversationId: id },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
      }
      this.scrollToBottom();
    } catch (error) {
      console.error('Conversation load failed.', error);
      this.error.set(this.errorMessage(error, 'The conversation could not be loaded.'));
    } finally {
      this.conversationLoading.set(false);
    }
  }

  async newConversation(): Promise<void> {
    if (this.creatingConversation()) return;
    this.creatingConversation.set(true);

    try {
      const response = await firstValueFrom(
        this.api.createConversation({ context: this.selectedContexts()[0] }),
      );
      this.activeConversation.set(response.data);
      this.conversations.update((rows) => [this.toSummary(response.data), ...rows]);
      if (!this.drawerMode) {
        await this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { conversationId: response.data.id },
          queryParamsHandling: 'merge',
        });
      }
      this.sidebarOpen.set(false);
      setTimeout(() => this.composerInput?.nativeElement.focus(), 0);
    } catch (error) {
      console.error('Conversation create failed.', error);
      this.toast.error('Could not start a conversation', this.errorMessage(error, 'Please try again.'));
    } finally {
      this.creatingConversation.set(false);
    }
  }

  async archiveConversation(conversation: AiConversationSummary, event?: Event): Promise<void> {
    event?.stopPropagation();
    if (this.actionWorkingId()) return;
    this.actionWorkingId.set(conversation.id);

    try {
      await firstValueFrom(this.api.archiveConversation(conversation.id));
      const remaining = this.conversations().filter((row) => row.id !== conversation.id);
      this.conversations.set(remaining);
      if (this.activeConversation()?.id === conversation.id) {
        this.activeConversation.set(null);
        const next = remaining[0]?.id ?? null;
        if (!this.drawerMode) {
          await this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { conversationId: next },
            queryParamsHandling: 'merge',
            replaceUrl: true,
          });
        }
        if (next) await this.loadConversation(next, false);
      }
      this.toast.success('Conversation archived');
    } catch (error) {
      console.error('Conversation archive failed.', error);
      this.toast.error('Could not archive conversation', this.errorMessage(error, 'Please try again.'));
    } finally {
      this.actionWorkingId.set(null);
    }
  }

  useQuickPrompt(prompt: string): void {
    this.draft = prompt;
    setTimeout(() => this.composerInput?.nativeElement.focus(), 0);
  }

  async send(): Promise<void> {
    const content = this.draft.trim();
    if (!content || this.sending()) return;

    if (!this.activeConversation()) {
      await this.newConversation();
    }

    const conversation = this.activeConversation();
    if (!conversation) return;

    const maxCharacters = this.status()?.maxPromptCharacters ?? 4_000;
    if (content.length > maxCharacters) {
      this.toast.error('Message is too long', `Keep it under ${maxCharacters.toLocaleString()} characters.`);
      return;
    }

    const optimistic: AiMessage = {
      id: `local-${Date.now()}`,
      role: 'user',
      content,
      sources: [],
      model: null,
      inputTokens: null,
      outputTokens: null,
      totalTokens: null,
      estimatedCostMicros: null,
      createdAt: new Date().toISOString(),
      actions: [],
    };

    this.draft = '';
    this.sending.set(true);
    this.error.set(null);
    this.activeConversation.update((row) => row ? { ...row, messages: [...row.messages, optimistic] } : row);
    this.scrollToBottom();

    try {
      const response = await firstValueFrom(
        this.api.sendMessage(conversation.id, content, this.selectedContexts()),
      );
      this.activeConversation.update((row) => row ? { ...row, messages: [...row.messages, response.data] } : row);
      await this.refreshConversationList(conversation.id);
      await this.refreshUsage();
      this.scrollToBottom();
    } catch (error) {
      console.error('AI message failed.', error);
      this.activeConversation.update((row) => row ? {
        ...row,
        messages: row.messages.filter((message) => message.id !== optimistic.id),
      } : row);
      this.draft = content;
      this.error.set(this.errorMessage(error, 'Opscend AI could not answer. Please try again.'));
    } finally {
      this.sending.set(false);
    }
  }

  handleComposerKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void this.send();
    }
  }

  openContextSearch(): void {
    this.contextSearchOpen.set(true);
    this.contextQuery = '';
    this.contextResults.set([]);
  }

  closeContextSearch(): void {
    this.contextSearchOpen.set(false);
    this.contextQuery = '';
    this.contextResults.set([]);
  }

  onContextQueryChange(value: string): void {
    this.contextQuery = value;
    if (this.contextSearchTimer) clearTimeout(this.contextSearchTimer);

    const query = value.trim();
    if (query.length < 2) {
      this.contextResults.set([]);
      this.contextSearching.set(false);
      return;
    }

    this.contextSearchTimer = setTimeout(() => void this.searchContext(query), 250);
  }

  async searchContext(query: string): Promise<void> {
    this.contextSearching.set(true);
    try {
      const results = await firstValueFrom(this.searchApi.search(query, 5));
      this.contextResults.set(this.flattenSearchResults(results).slice(0, 30));
    } catch (error) {
      console.error('Context search failed.', error);
      this.contextResults.set([]);
    } finally {
      this.contextSearching.set(false);
    }
  }

  addContext(item: SearchItem): void {
    if (this.selectedContexts().some((context) => context.type === item.type && context.id === item.id)) {
      this.closeContextSearch();
      return;
    }

    if (this.selectedContexts().length >= 5) {
      this.toast.info('Context limit reached', 'Remove one of the five selected records first.');
      return;
    }

    this.selectedContexts.update((rows) => [
      ...rows,
      { type: item.type, id: item.id, title: item.title, route: item.route },
    ]);
    this.closeContextSearch();
  }

  removeContext(context: AiContextRef): void {
    this.selectedContexts.update((rows) =>
      rows.filter((row) => !(row.type === context.type && row.id === context.id)),
    );
  }

  reviewAction(action: AiSuggestedAction): void {
    if (action.status !== 'pending') return;
    this.reviewingActionId.set(action.id);
  }

  cancelActionReview(): void {
    this.reviewingActionId.set(null);
  }

  async executeAction(action: AiSuggestedAction): Promise<void> {
    if (this.actionWorkingId() || action.status !== 'pending') return;
    this.actionWorkingId.set(action.id);

    try {
      let result: Record<string, unknown> = {};

      switch (action.type) {
        case 'create_work_queue_item': {
          const created = await firstValueFrom(this.workQueue.create({
            title: action.payload.title || action.title,
            description: action.payload.description || action.description,
            priority: action.payload.priority || 'normal',
            assignedToUserId: action.payload.assignedToUserId || null,
            dueAt: action.payload.dueAt || null,
            customerId: action.payload.customerId || null,
            customerName: action.payload.customerName || null,
            route: action.payload.route || null,
            category: 'AI Assistant',
          }));
          result = { workQueueItemId: created.id, route: created.route };
          this.toast.success('Task created', created.title);
          break;
        }

        case 'update_repair_status': {
          const repairId = action.payload.repairId;
          const status = action.payload.status as RepairStatus | null | undefined;
          if (!repairId || !status) throw new Error('The suggested repair update is incomplete.');
          const repair = await firstValueFrom(this.repairs.updateRepairStatus(repairId, status));
          result = { repairId: repair.id, status: repair.status };
          this.toast.success('Repair updated', `Status changed to ${this.statusLabel(status)}.`);
          break;
        }

        case 'draft_customer_message': {
          const draft = action.payload.draft;
          if (!draft) throw new Error('The suggested message draft is empty.');
          await this.copyText(draft);
          result = { copied: true, channel: action.payload.channel ?? null };
          this.toast.success('Draft copied', 'Review it before sending to the customer.');
          break;
        }

        case 'open_record': {
          const route = action.payload.route;
          if (!route) throw new Error('The suggested record does not have a route.');
          result = { route };
          await firstValueFrom(this.api.resolveAction(action.id, { status: 'completed', result }));
          this.updateAction({ ...action, status: 'completed', result, resolvedAt: new Date().toISOString() });
          this.reviewingActionId.set(null);
          await this.router.navigateByUrl(route);
          return;
        }
      }

      const response = await firstValueFrom(
        this.api.resolveAction(action.id, { status: 'completed', result }),
      );
      this.updateAction(response.data);
      this.reviewingActionId.set(null);
    } catch (error) {
      console.error('AI action failed.', error);
      const message = this.errorMessage(error, 'The suggested action could not be completed.');
      try {
        const response = await firstValueFrom(
          this.api.resolveAction(action.id, { status: 'failed', error: message }),
        );
        this.updateAction(response.data);
      } catch (trackingError) {
        console.error('AI action failure could not be recorded.', trackingError);
      }
      this.toast.error('Action failed', message);
    } finally {
      this.actionWorkingId.set(null);
    }
  }

  async dismissAction(action: AiSuggestedAction): Promise<void> {
    if (this.actionWorkingId() || action.status !== 'pending') return;
    this.actionWorkingId.set(action.id);

    try {
      const response = await firstValueFrom(
        this.api.resolveAction(action.id, { status: 'dismissed' }),
      );
      this.updateAction(response.data);
      this.reviewingActionId.set(null);
    } catch (error) {
      console.error('AI action dismiss failed.', error);
      this.toast.error('Could not dismiss action', this.errorMessage(error, 'Please try again.'));
    } finally {
      this.actionWorkingId.set(null);
    }
  }

  openSource(route: string | null): void {
    if (!route) return;
    void this.router.navigateByUrl(route);
  }

  async copyMessage(message: AiMessage): Promise<void> {
    await this.copyText(message.content);
    this.toast.success('Response copied');
  }

  actionLabel(action: AiSuggestedAction): string {
    switch (action.type) {
      case 'create_work_queue_item': return 'Create task';
      case 'update_repair_status': return 'Apply status change';
      case 'draft_customer_message': return 'Copy draft';
      case 'open_record': return 'Open record';
    }
  }

  actionIcon(action: AiSuggestedAction) {
    switch (action.type) {
      case 'create_work_queue_item': return this.icons.ListPlus;
      case 'update_repair_status': return this.icons.Wrench;
      case 'draft_customer_message': return this.icons.MessageSquareText;
      case 'open_record': return this.icons.ExternalLink;
    }
  }

  contextTypeLabel(type: string): string {
    return type.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
  }

  statusLabel(status: string): string {
    return status.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
  }

  formatDate(value: string | null): string {
    if (!value) return '';
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value));
  }

  formatTokens(value: number): string {
    return new Intl.NumberFormat('en-US', { notation: value >= 10_000 ? 'compact' : 'standard' }).format(value);
  }

  formatCost(micros: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: micros > 0 && micros < 10_000 ? 4 : 2,
      maximumFractionDigits: 4,
    }).format(micros / 1_000_000);
  }

  private async refreshConversationList(activeId: string): Promise<void> {
    const response = await firstValueFrom(this.api.listConversations());
    this.conversations.set(response.data);
    const activeSummary = response.data.find((row) => row.id === activeId);
    if (activeSummary) {
      this.activeConversation.update((row) => row ? { ...row, ...activeSummary } : row);
    }
  }

  private async refreshUsage(): Promise<void> {
    const [status, usage] = await Promise.all([
      firstValueFrom(this.api.getStatus()),
      firstValueFrom(this.api.getUsage(30)),
    ]);
    this.status.set(status);
    this.usage.set(usage.data);
  }

  private updateAction(updated: AiSuggestedAction): void {
    this.activeConversation.update((conversation) => {
      if (!conversation) return conversation;
      return {
        ...conversation,
        messages: conversation.messages.map((message) => ({
          ...message,
          actions: message.actions.map((action) => action.id === updated.id ? updated : action),
        })),
      };
    });
  }

  private flattenSearchResults(results: GlobalSearchResponse): SearchItem[] {
    return [
      ...results.customers,
      ...results.repairs,
      ...results.devices,
      ...results.quotes,
      ...results.orders,
      ...results.conversations,
      ...results.forms,
      ...results.knowledgeArticles,
      ...results.products,
      ...results.purchaseOrders,
      ...results.appointments,
    ];
  }

  private toSummary(conversation: AiConversation): AiConversationSummary {
    return {
      id: conversation.id,
      title: conversation.title,
      contextType: conversation.contextType,
      contextId: conversation.contextId,
      archivedAt: conversation.archivedAt,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      messageCount: conversation.messageCount,
    };
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      const element = this.messageViewport?.nativeElement;
      if (element) element.scrollTop = element.scrollHeight;
    }, 0);
  }

  private async copyText(value: string): Promise<void> {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  }

  private errorMessage(error: any, fallback: string): string {
    const requestId = error?.error?.requestId || error?.headers?.get?.('x-request-id') || null;
    const message = error?.status === 0
      ? 'The server connection was interrupted before Opscend AI could respond. Please try again.'
      : (error?.error?.message || error?.message || fallback);

    return requestId ? `${message} Reference: ${requestId}` : message;
  }
}
