import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  FlaskConical,
  History,
  LayoutTemplate,
  LucideAngularModule,
  Pause,
  Pencil,
  Play,
  Plus,
  RefreshCcw,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
  XCircle,
  Zap,
} from 'lucide-angular';

import { ToastService } from '../../core/toast/toast-service';
import { AutomationService } from '../../core/automations/service';
import {
  AutomationActionDraft,
  AutomationActionType,
  AutomationCondition,
  AutomationExecution,
  AutomationFormTemplate,
  AutomationRule,
  AutomationRulePayload,
  AutomationSummary,
  AutomationTemplate,
  AutomationTriggerType,
  AutomationUser,
} from '../../core/automations/model';

type PageTab = 'automations' | 'templates' | 'history';

@Component({
  selector: 'app-automations',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './automations.html',
})
export class Automations implements OnInit {
  private readonly automationService = inject(AutomationService);
  private readonly toast = inject(ToastService);

  readonly zapIcon = Zap;
  readonly plusIcon = Plus;
  readonly playIcon = Play;
  readonly pauseIcon = Pause;
  readonly copyIcon = Copy;
  readonly trashIcon = Trash2;
  readonly editIcon = Pencil;
  readonly testIcon = FlaskConical;
  readonly historyIcon = History;
  readonly templatesIcon = LayoutTemplate;
  readonly checkIcon = CheckCircle2;
  readonly errorIcon = XCircle;
  readonly closeIcon = X;
  readonly saveIcon = Save;
  readonly refreshIcon = RefreshCcw;
  readonly chevronUpIcon = ChevronUp;
  readonly chevronDownIcon = ChevronDown;
  readonly sparklesIcon = Sparkles;
  readonly shieldIcon = ShieldCheck;
  readonly webhookBodyPlaceholder = '{"repairId":"{{repair.id}}"}';

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly activeTab = signal<PageTab>('automations');
  readonly rules = signal<AutomationRule[]>([]);
  readonly templates = signal<AutomationTemplate[]>([]);
  readonly users = signal<AutomationUser[]>([]);
  readonly formTemplates = signal<AutomationFormTemplate[]>([]);
  readonly summary = signal<AutomationSummary>({
    active: 0,
    paused: 0,
    draft: 0,
    runsToday: 0,
    failuresToday: 0,
    pendingActions: 0,
  });
  readonly executions = signal<AutomationExecution[]>([]);
  readonly historyLoading = signal(false);
  readonly selectedExecution = signal<AutomationExecution | null>(null);
  readonly builderOpen = signal(false);
  readonly editingRuleId = signal<string | null>(null);

  search = '';
  statusFilter = 'all';
  templateCategory = 'all';
  draft: AutomationRulePayload = this.blankDraft();

  readonly triggerOptions: Array<{
    value: AutomationTriggerType;
    label: string;
    description: string;
    group: string;
  }> = [
    { value: 'repair_created', label: 'Repair created', description: 'A new repair enters the shop.', group: 'Repairs' },
    { value: 'repair_status_changed', label: 'Repair status changed', description: 'A repair moves from one status to another.', group: 'Repairs' },
    { value: 'repair_status_stale', label: 'Repair stays in a status', description: 'A repair remains in one status for a chosen duration.', group: 'Repairs' },
    { value: 'quote_created', label: 'Quote created', description: 'A public or staff quote is created.', group: 'Quotes' },
    { value: 'quote_status_changed', label: 'Quote status changed', description: 'A quote is sent, accepted, declined, or otherwise updated.', group: 'Quotes' },
    { value: 'appointment_scheduled', label: 'Appointment scheduled', description: 'A new appointment is scheduled or rescheduled.', group: 'Appointments' },
    { value: 'appointment_status_changed', label: 'Appointment status changed', description: 'An appointment is completed, canceled, or marked no-show.', group: 'Appointments' },
    { value: 'appointment_approaching', label: 'Appointment approaching', description: 'A scheduled appointment is a chosen number of minutes away.', group: 'Appointments' },
    { value: 'payment_received', label: 'Payment received', description: 'An order records additional payment.', group: 'Orders & payments' },
    { value: 'order_fulfilled', label: 'Order fulfilled', description: 'An order changes to fulfilled.', group: 'Orders & payments' },
    { value: 'order_balance_due', label: 'Order balance remains due', description: 'An order carries a balance beyond a chosen age.', group: 'Orders & payments' },
    { value: 'inventory_low', label: 'Inventory falls below threshold', description: 'Available product quantity crosses below a chosen number.', group: 'Inventory' },
    { value: 'customer_created', label: 'Customer created', description: 'A new customer record is created.', group: 'Customers' },
    { value: 'work_queue_overdue', label: 'Work Queue item overdue', description: 'An active queue item passes its due date.', group: 'Work Queue' },
    { value: 'form_submitted', label: 'Form submitted', description: 'A staff member or customer completes a form.', group: 'Forms' },
    { value: 'business_device_added', label: 'Fleet device added', description: 'A managed device is added to a business account.', group: 'Business & Fleet' },
    { value: 'business_plan_limit_reached', label: 'Fleet plan device limit reached', description: 'A business reaches its covered-device plan limit.', group: 'Business & Fleet' },
    { value: 'business_contract_expiring', label: 'Business contract approaching renewal', description: 'A business contract is approaching its end or renewal date.', group: 'Business & Fleet' },
    { value: 'business_statement_finalized', label: 'Business statement finalized', description: 'A consolidated business statement is finalized.', group: 'Business & Fleet' },
    { value: 'business_statement_paid', label: 'Business statement paid', description: 'A consolidated business statement is paid.', group: 'Business & Fleet' },
    { value: 'business_statement_payment_failed', label: 'Business statement payment failed', description: 'Stripe reports a failed or action-required consolidated invoice.', group: 'Business & Fleet' },
    { value: 'business_statement_overdue', label: 'Business statement overdue', description: 'A consolidated business statement passes its due date with a balance remaining.', group: 'Business & Fleet' },
    { value: 'business_plan_payment_failed', label: 'Fleet plan payment failed', description: 'Recurring fleet subscription billing needs attention.', group: 'Business & Fleet' },
  ];

  readonly actionOptions: Array<{
    value: AutomationActionType;
    label: string;
    description: string;
  }> = [
    { value: 'send_email', label: 'Send email', description: 'Send a branded customer or staff email.' },
    { value: 'send_sms', label: 'Send SMS', description: 'Send a text using the shop Twilio number.' },
    { value: 'internal_notification', label: 'Internal notification', description: 'Create an in-app staff notification.' },
    { value: 'create_work_queue', label: 'Create Work Queue item', description: 'Add a task with priority, owner, and due time.' },
    { value: 'add_repair_note', label: 'Add repair note', description: 'Write an internal or customer-visible repair note.' },
    { value: 'assign_repair', label: 'Assign repair', description: 'Assign the repair to a selected team member.' },
    { value: 'change_repair_status', label: 'Change repair status', description: 'Move the repair to another workflow status.' },
    { value: 'send_portal_link', label: 'Send customer portal link', description: 'Send the customer their shop-specific portal URL.' },
    { value: 'assign_form', label: 'Assign form', description: 'Create a staff or customer form assignment from a template.' },
    { value: 'webhook', label: 'Call webhook', description: 'POST automation data to an external HTTPS endpoint.' },
  ];

  readonly repairStatuses = [
    'intake',
    'scheduled',
    'needs_reassignment',
    'customer_verified',
    'diagnosing',
    'awaiting_approval',
    'awaiting_parts',
    'in_repair',
    'documentation_pending',
    'qc',
    'ready',
    'picked_up',
    'canceled',
  ];

  readonly quoteStatuses = [
    'draft',
    'quote_requested',
    'quoted',
    'sent',
    'accepted',
    'declined',
    'deposit_pending',
    'deposit_paid',
    'scheduled',
    'converted',
    'expired',
    'canceled',
  ];

  readonly appointmentStatuses = ['scheduled', 'completed', 'canceled', 'no_show'];

  readonly conditionFields = [
    'customer.name',
    'customer.email',
    'customer.phone',
    'device.brand',
    'device.model',
    'repair.status',
    'repair.serviceMode',
    'repair.assignedTo',
    'quote.status',
    'quote.estimatedTotalCents',
    'quote.depositRequired',
    'appointment.status',
    'order.paymentStatus',
    'order.balanceCents',
    'order.totalCents',
    'inventory.availableQty',
    'workQueue.priority',
    'form.templateId',
    'form.templateName',
    'form.status',
    'form.submittedByType',
  ];

  readonly conditionOperators = [
    { value: 'equals', label: 'equals' },
    { value: 'not_equals', label: 'does not equal' },
    { value: 'contains', label: 'contains' },
    { value: 'not_contains', label: 'does not contain' },
    { value: 'greater_than', label: 'is greater than' },
    { value: 'greater_than_or_equal', label: 'is at least' },
    { value: 'less_than', label: 'is less than' },
    { value: 'less_than_or_equal', label: 'is at most' },
    { value: 'is_empty', label: 'is empty' },
    { value: 'is_not_empty', label: 'is not empty' },
    { value: 'in', label: 'is one of' },
    { value: 'not_in', label: 'is not one of' },
    { value: 'is_true', label: 'is true' },
    { value: 'is_false', label: 'is false' },
  ];

  get triggerStatus(): string {
    if (this.draft.triggerType === 'repair_status_stale') {
      return String(this.draft.triggerConfig['status'] ?? 'awaiting_parts');
    }
    const values = this.draft.triggerConfig['toStatuses'];
    return Array.isArray(values) ? String(values[0] ?? '') : '';
  }

  set triggerStatus(value: string) {
    if (this.draft.triggerType === 'repair_status_stale') {
      this.draft.triggerConfig['status'] = value;
      return;
    }
    this.draft.triggerConfig['toStatuses'] = value ? [value] : [];
  }

  get triggerAmount(): number {
    switch (this.draft.triggerType) {
      case 'appointment_approaching':
        return Number(this.draft.triggerConfig['minutesBefore'] ?? 1_440);
      case 'inventory_low':
        return Number(this.draft.triggerConfig['threshold'] ?? 2);
      case 'repair_status_stale':
        return Number(this.draft.triggerConfig['minutesInStatus'] ?? 10_080);
      case 'order_balance_due':
        return Number(this.draft.triggerConfig['ageMinutes'] ?? 4_320);
      default:
        return 0;
    }
  }

  set triggerAmount(value: number) {
    const normalized = Math.max(0, Number(value || 0));
    switch (this.draft.triggerType) {
      case 'appointment_approaching':
        this.draft.triggerConfig['minutesBefore'] = normalized;
        break;
      case 'inventory_low':
        this.draft.triggerConfig['threshold'] = normalized;
        break;
      case 'repair_status_stale':
        this.draft.triggerConfig['minutesInStatus'] = normalized;
        break;
      case 'order_balance_due':
        this.draft.triggerConfig['ageMinutes'] = normalized;
        break;
    }
  }

  async ngOnInit(): Promise<void> {
    await this.loadBootstrap();
  }

  async loadBootstrap(): Promise<void> {
    this.loading.set(true);
    try {
      const response = await firstValueFrom(this.automationService.bootstrap());
      this.rules.set(response.data.rules ?? []);
      this.templates.set(response.data.templates ?? []);
      this.users.set(response.data.users ?? []);
      this.formTemplates.set(response.data.formTemplates ?? []);
      this.summary.set(response.data.summary);
    } catch (error) {
      console.error(error);
      this.toast.error('Could not load automations.');
    } finally {
      this.loading.set(false);
    }
  }

  async setTab(tab: PageTab): Promise<void> {
    this.activeTab.set(tab);
    if (tab === 'history' && this.executions().length === 0) {
      await this.loadHistory();
    }
  }

  filteredRules(): AutomationRule[] {
    const query = this.search.trim().toLowerCase();
    return this.rules().filter((rule) => {
      const matchesStatus = this.statusFilter === 'all' || rule.status === this.statusFilter;
      const matchesQuery =
        !query ||
        rule.name.toLowerCase().includes(query) ||
        (rule.description ?? '').toLowerCase().includes(query) ||
        this.triggerLabel(rule.triggerType).toLowerCase().includes(query);
      return matchesStatus && matchesQuery;
    });
  }

  templateCategories(): string[] {
    return ['all', ...new Set(this.templates().map((template) => template.category))];
  }

  filteredTemplates(): AutomationTemplate[] {
    return this.templates().filter(
      (template) => this.templateCategory === 'all' || template.category === this.templateCategory,
    );
  }

  openNewBuilder(): void {
    this.editingRuleId.set(null);
    this.draft = this.blankDraft();
    this.builderOpen.set(true);
  }

  editRule(rule: AutomationRule): void {
    this.editingRuleId.set(rule.id);
    this.draft = {
      name: rule.name,
      description: rule.description,
      status: rule.status,
      triggerType: rule.triggerType,
      triggerConfig: structuredClone(rule.triggerConfig ?? {}),
      conditionMode: rule.conditionMode,
      conditions: structuredClone(rule.conditions ?? []),
      runOncePerSource: rule.runOncePerSource,
      cooldownMinutes: rule.cooldownMinutes,
      quietHoursEnabled: rule.quietHoursEnabled,
      quietHoursStart: rule.quietHoursStart,
      quietHoursEnd: rule.quietHoursEnd,
      testMode: rule.testMode,
      failureThreshold: rule.failureThreshold,
      actions: rule.actions.map((action) => ({
        id: action.id,
        type: action.type,
        label: action.label,
        config: structuredClone(action.config ?? {}),
        delayMinutes: action.delayMinutes,
        cancelIfChanged: action.cancelIfChanged,
        sortOrder: action.sortOrder,
        enabled: action.enabled,
      })),
    };
    this.builderOpen.set(true);
  }

  closeBuilder(): void {
    if (this.saving()) return;
    this.builderOpen.set(false);
    this.editingRuleId.set(null);
  }

  async createFromTemplate(template: AutomationTemplate): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.automationService.createFromTemplate(template.key),
      );
      this.toast.success('Automation template added.', 'Review it before enabling.');
      await this.loadBootstrap();
      this.editRule(response.data);
    } catch (error) {
      console.error(error);
      this.toast.error('Could not create the automation.');
    }
  }

  onTriggerChanged(): void {
    switch (this.draft.triggerType) {
      case 'repair_status_changed':
        this.draft.triggerConfig = { toStatuses: ['ready'] };
        break;
      case 'quote_status_changed':
        this.draft.triggerConfig = { toStatuses: ['sent'] };
        break;
      case 'appointment_status_changed':
        this.draft.triggerConfig = { toStatuses: ['no_show'] };
        break;
      case 'appointment_approaching':
        this.draft.triggerConfig = { minutesBefore: 1_440 };
        break;
      case 'inventory_low':
        this.draft.triggerConfig = { threshold: 2 };
        break;
      case 'repair_status_stale':
        this.draft.triggerConfig = { status: 'awaiting_parts', minutesInStatus: 10_080 };
        break;
      case 'order_balance_due':
        this.draft.triggerConfig = { ageMinutes: 4_320 };
        break;
      default:
        this.draft.triggerConfig = {};
        break;
    }
  }

  addCondition(): void {
    this.draft.conditions.push({ field: 'repair.status', operator: 'equals', value: '' });
  }

  removeCondition(index: number): void {
    this.draft.conditions.splice(index, 1);
  }

  addAction(type: AutomationActionType = 'send_email'): void {
    this.draft.actions.push(this.defaultAction(type, this.draft.actions.length));
  }

  actionTypeChanged(action: AutomationActionDraft): void {
    const replacement = this.defaultAction(action.type, action.sortOrder);
    action.label = replacement.label;
    action.config = replacement.config;
    action.delayMinutes = replacement.delayMinutes;
    action.cancelIfChanged = replacement.cancelIfChanged;
  }

  removeAction(index: number): void {
    if (this.draft.actions.length <= 1) {
      this.toast.info('An automation needs at least one action.');
      return;
    }
    this.draft.actions.splice(index, 1);
    this.reindexActions();
  }

  moveAction(index: number, direction: -1 | 1): void {
    const target = index + direction;
    if (target < 0 || target >= this.draft.actions.length) return;
    const [action] = this.draft.actions.splice(index, 1);
    this.draft.actions.splice(target, 0, action!);
    this.reindexActions();
  }

  async saveRule(): Promise<void> {
    if (!this.draft.name.trim()) {
      this.toast.error('Automation name is required.');
      return;
    }
    if (!this.draft.actions.length) {
      this.toast.error('Add at least one action.');
      return;
    }

    this.saving.set(true);
    try {
      const payload = structuredClone(this.draft);
      payload.actions = payload.actions.map((action, index) => ({
        ...action,
        sortOrder: index,
        delayMinutes: Math.max(0, Number(action.delayMinutes || 0)),
      }));
      payload.cooldownMinutes =
        payload.cooldownMinutes === null || payload.cooldownMinutes === undefined
          ? null
          : Math.max(0, Number(payload.cooldownMinutes));

      if (this.editingRuleId()) {
        await firstValueFrom(
          this.automationService.update(this.editingRuleId()!, payload),
        );
        this.toast.success('Automation updated.');
      } else {
        await firstValueFrom(this.automationService.create(payload));
        this.toast.success('Automation created.');
      }

      this.builderOpen.set(false);
      this.editingRuleId.set(null);
      await this.loadBootstrap();
    } catch (error) {
      console.error(error);
      this.toast.error('Could not save the automation.');
    } finally {
      this.saving.set(false);
    }
  }

  async toggleRule(rule: AutomationRule): Promise<void> {
    try {
      if (rule.status === 'active') {
        await firstValueFrom(this.automationService.disable(rule.id));
        this.toast.success('Automation paused.');
      } else {
        await firstValueFrom(this.automationService.enable(rule.id));
        this.toast.success('Automation enabled.');
      }
      await this.loadBootstrap();
    } catch (error) {
      console.error(error);
      this.toast.error('Could not update the automation.');
    }
  }

  async duplicateRule(rule: AutomationRule): Promise<void> {
    try {
      await firstValueFrom(this.automationService.duplicate(rule.id));
      this.toast.success('Automation duplicated.');
      await this.loadBootstrap();
    } catch (error) {
      console.error(error);
      this.toast.error('Could not duplicate the automation.');
    }
  }

  async testRule(rule: AutomationRule): Promise<void> {
    try {
      const response = await firstValueFrom(this.automationService.test(rule.id));
      this.toast.success(
        'Test completed.',
        response.data.status === 'test'
          ? 'No email, SMS, task, notification, or webhook was actually sent.'
          : `Result: ${response.data.status}`,
      );
      await this.loadHistory();
    } catch (error: any) {
      console.error(error);
      const message = error?.error?.message || 'A matching sample record was not available.';
      this.toast.error('Could not test the automation.', message);
    }
  }

  async archiveRule(rule: AutomationRule): Promise<void> {
    const confirmed = window.confirm(`Archive “${rule.name}”? Pending actions will be canceled.`);
    if (!confirmed) return;
    try {
      await firstValueFrom(this.automationService.archive(rule.id));
      this.toast.success('Automation archived.');
      await this.loadBootstrap();
    } catch (error) {
      console.error(error);
      this.toast.error('Could not archive the automation.');
    }
  }

  async loadHistory(): Promise<void> {
    this.historyLoading.set(true);
    try {
      const response = await firstValueFrom(
        this.automationService.listExecutions({ limit: 100 }),
      );
      this.executions.set(response.data ?? []);
    } catch (error) {
      console.error(error);
      this.toast.error('Could not load automation history.');
    } finally {
      this.historyLoading.set(false);
    }
  }

  selectExecution(execution: AutomationExecution): void {
    this.selectedExecution.set(
      this.selectedExecution()?.id === execution.id ? null : execution,
    );
  }

  triggerLabel(trigger: AutomationTriggerType): string {
    return this.triggerOptions.find((option) => option.value === trigger)?.label ?? trigger;
  }

  actionLabel(type: AutomationActionType): string {
    return this.actionOptions.find((option) => option.value === type)?.label ?? type;
  }

  statusLabel(status: string): string {
    return status
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  statusClass(status: string): string {
    switch (status) {
      case 'active':
      case 'succeeded':
        return 'border-emerald-200 bg-emerald-50 text-emerald-700';
      case 'paused':
      case 'partial':
        return 'border-amber-200 bg-amber-50 text-amber-700';
      case 'failed':
        return 'border-rose-200 bg-rose-50 text-rose-700';
      case 'test':
        return 'border-violet-200 bg-violet-50 text-violet-700';
      case 'skipped':
        return 'border-slate-200 bg-slate-50 text-slate-600';
      default:
        return 'border-app-border bg-app-surface-muted text-app-text-muted';
    }
  }

  ruleActionSummary(rule: AutomationRule): string {
    const labels = rule.actions
      .filter((action) => action.enabled)
      .map((action) => this.actionLabel(action.type));
    if (labels.length <= 2) return labels.join(' + ');
    return `${labels.slice(0, 2).join(' + ')} +${labels.length - 2}`;
  }

  formatRelative(value: string | null): string {
    if (!value) return 'Never';
    const date = new Date(value);
    const diffMinutes = Math.round((Date.now() - date.getTime()) / 60_000);
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffMinutes < 1_440) return `${Math.round(diffMinutes / 60)}h ago`;
    if (diffMinutes < 10_080) return `${Math.round(diffMinutes / 1_440)}d ago`;
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
  }

  formatDuration(minutes: number | null | undefined): string {
    if (!minutes) return 'Immediately';
    if (minutes < 60) return `${minutes} min`;
    if (minutes < 1_440) return `${minutes / 60} hr`;
    return `${minutes / 1_440} day${minutes / 1_440 === 1 ? '' : 's'}`;
  }

  executionActionResults(execution: AutomationExecution): Array<Record<string, any>> {
    return Array.isArray(execution.actionResults) ? execution.actionResults : [];
  }

  private blankDraft(): AutomationRulePayload {
    return {
      name: '',
      description: '',
      status: 'draft',
      triggerType: 'repair_status_changed',
      triggerConfig: { toStatuses: ['ready'] },
      conditionMode: 'all',
      conditions: [],
      runOncePerSource: false,
      cooldownMinutes: 1_440,
      quietHoursEnabled: true,
      quietHoursStart: '20:00',
      quietHoursEnd: '08:00',
      testMode: false,
      failureThreshold: 5,
      actions: [this.defaultAction('send_email', 0)],
    };
  }

  private defaultAction(type: AutomationActionType, sortOrder: number): AutomationActionDraft {
    const common = {
      type,
      delayMinutes: 0,
      cancelIfChanged: true,
      sortOrder,
      enabled: true,
    };

    switch (type) {
      case 'send_email':
        return {
          ...common,
          label: 'Email customer',
          config: {
            recipient: 'customer',
            subject: 'Update from {{shop.name}}',
            body: 'Hi {{customer.firstName}},\n\nWe have an update for your {{device.displayName}}.\n\nView details: {{portal.url}}',
          },
        };
      case 'send_sms':
        return {
          ...common,
          label: 'Text customer',
          config: {
            recipient: 'customer',
            body: '{{shop.name}}: We have an update for your {{device.displayName}}. {{portal.url}}',
          },
        };
      case 'internal_notification':
        return {
          ...common,
          label: 'Notify staff',
          config: {
            recipient: 'owner',
            subject: 'Automation alert',
            body: '{{customer.name}} — {{device.displayName}} needs attention.',
          },
        };
      case 'create_work_queue':
        return {
          ...common,
          label: 'Create task',
          config: {
            title: 'Follow up with {{customer.name}}',
            description: 'Review {{device.displayName}} and complete the next step.',
            category: 'Automation',
            priority: 'normal',
            assignTo: 'unassigned',
            dueMinutes: 0,
          },
        };
      case 'add_repair_note':
        return {
          ...common,
          label: 'Add repair note',
          config: { visibility: 'internal', body: 'Automation note: {{automation.trigger.toStatus}}' },
        };
      case 'assign_repair':
        return {
          ...common,
          label: 'Assign repair',
          config: { userId: this.users()[0]?.id ?? '' },
        };
      case 'change_repair_status':
        return {
          ...common,
          label: 'Change repair status',
          config: { status: 'ready' },
        };
      case 'send_portal_link':
        return {
          ...common,
          label: 'Send portal link',
          config: { recipient: 'customer', channel: 'email' },
        };
      case 'assign_form':
        return {
          ...common,
          label: 'Assign form',
          config: {
            templateId: this.formTemplates()[0]?.id ?? '',
            audience: 'customer',
            title: '',
            assignTo: 'unassigned',
            userId: '',
            dueMinutes: 0,
            sendEmail: true,
          },
        };
      case 'webhook':
        return {
          ...common,
          label: 'Call webhook',
          config: { url: '', method: 'POST', headers: {}, body: '' },
        };
    }
  }

  private reindexActions(): void {
    this.draft.actions.forEach((action, index) => (action.sortOrder = index));
  }
}
