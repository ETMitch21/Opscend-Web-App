import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { firstValueFrom } from 'rxjs';
import {
  Archive,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Copy,
  Eye,
  FilePlus2,
  GripVertical,
  Image,
  LayoutTemplate,
  Loader2,
  Mail,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Send,
  Signature,
  Trash2,
  UserRound,
  X,
  type LucideIconData,
  LucideAngularModule,
} from 'lucide-angular';

import { ToastService } from '../../core/toast/toast-service';
import { FormsService } from '../../core/forms/service';
import { SignaturePadComponent } from '../../core/forms/signature-pad';
import { FORM_PHOTO_MAX_BYTES, formImageFileToDataUrl, heicDataUrlToJpegDataUrl, isHeicDataUrl } from '../../core/forms/image-utils';
import {
  FormAssignment,
  FormAssignmentPayload,
  FormAudience,
  FormCustomerOption,
  FormField,
  FormFieldType,
  FormRepairOption,
  FormRepairGateStatus,
  FormTemplate,
  FormTemplatePayload,
  FormUserOption,
} from '../../core/forms/model';

type FormsTab = 'templates' | 'assignments' | 'responses';


type FieldTypeOption = {
  value: FormFieldType;
  label: string;
  description: string;
  icon: LucideIconData;
};

@Component({
  selector: 'app-forms',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule, LucideAngularModule, SignaturePadComponent],
  templateUrl: './forms.html',
})
export class FormsPage implements OnInit {
  private readonly formsApi = inject(FormsService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);

  readonly icons = {
    Archive,
    CheckCircle2,
    ClipboardCheck,
    ClipboardList,
    Copy,
    Eye,
    FilePlus2,
    GripVertical,
    Image,
    LayoutTemplate,
    Loader2,
    Mail,
    Pencil,
    Plus,
    RefreshCw,
    Save,
    Send,
    Signature,
    Trash2,
    UserRound,
    X,
  };

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly activeTab = signal<FormsTab>('templates');
  readonly templates = signal<FormTemplate[]>([]);
  readonly assignments = signal<FormAssignment[]>([]);
  readonly users = signal<FormUserOption[]>([]);
  readonly customers = signal<FormCustomerOption[]>([]);
  readonly repairs = signal<FormRepairOption[]>([]);
  readonly summary = signal({ total: 0, pending: 0, completed: 0, overdue: 0 });

  readonly builderOpen = signal(false);
  readonly editingTemplateId = signal<string | null>(null);
  readonly assignmentOpen = signal(false);
  readonly completionOpen = signal(false);
  readonly responseOpen = signal(false);
  readonly selectedAssignment = signal<FormAssignment | null>(null);
  readonly imagePreviews = signal<Record<string, string>>({});
  private readonly pendingImagePreviews = new Set<string>();

  readonly templateSearch = signal('');
  readonly assignmentSearch = signal('');
  readonly assignmentStatus = signal('all');
  readonly categoryFilter = signal('all');
  draft: FormTemplatePayload = this.blankTemplate();
  assignmentDraft: FormAssignmentPayload = this.blankAssignment();
  responses: Record<string, unknown> = {};


  readonly repairGateStatuses: Array<{ value: FormRepairGateStatus; label: string }> = [
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'needs_reassignment', label: 'Needs Reassignment' },
    { value: 'customer_verified', label: 'Customer Verified' },
    { value: 'diagnosing', label: 'Diagnosing' },
    { value: 'awaiting_approval', label: 'Awaiting Approval' },
    { value: 'awaiting_parts', label: 'Awaiting Parts' },
    { value: 'in_repair', label: 'In Repair' },
    { value: 'documentation_pending', label: 'Documentation Pending' },
    { value: 'qc', label: 'Quality Check' },
    { value: 'ready', label: 'Ready' },
    { value: 'picked_up', label: 'Picked Up' },
  ];

  readonly fieldTypes: FieldTypeOption[] = [
    { value: 'text', label: 'Short text', description: 'Single-line answer', icon: FilePlus2 },
    { value: 'textarea', label: 'Long text', description: 'Multi-line notes', icon: FilePlus2 },
    { value: 'number', label: 'Number', description: 'Numeric answer', icon: FilePlus2 },
    { value: 'email', label: 'Email', description: 'Validated email address', icon: Mail },
    { value: 'phone', label: 'Phone', description: 'Phone number', icon: UserRound },
    { value: 'select', label: 'Dropdown', description: 'Choose one option', icon: ClipboardList },
    { value: 'radio', label: 'Multiple choice', description: 'Visible single choice', icon: ClipboardList },
    { value: 'checkbox', label: 'Checkbox', description: 'Agreement or confirmation', icon: ClipboardCheck },
    { value: 'checkbox_group', label: 'Checkbox group', description: 'Choose multiple options', icon: ClipboardCheck },
    { value: 'date', label: 'Date', description: 'Calendar date', icon: ClipboardList },
    { value: 'photo', label: 'Photo', description: 'Upload or take a picture', icon: Image },
    { value: 'signature', label: 'Signature', description: 'Draw a signature', icon: Signature },
    { value: 'heading', label: 'Heading', description: 'Section heading', icon: LayoutTemplate },
    { value: 'paragraph', label: 'Instructions', description: 'Read-only information', icon: LayoutTemplate },
  ];

  readonly filteredTemplates = computed(() => {
    const search = this.templateSearch().trim().toLowerCase();
    return this.templates().filter((template) => {
      const category = this.categoryFilter();
      const matchesCategory = category === 'all' || template.category === category;
      const matchesSearch = !search || [template.name, template.description, template.category]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search));
      return matchesCategory && matchesSearch;
    });
  });

  readonly filteredAssignments = computed(() => {
    const search = this.assignmentSearch().trim().toLowerCase();
    return this.assignments().filter((assignment) => {
      const status = this.assignmentStatus();
      const matchesStatus = status === 'all' || assignment.status === status;
      const haystack = [
        assignment.title,
        assignment.customer?.name,
        assignment.customer?.email,
        assignment.device?.displayName,
        assignment.template?.name,
      ].filter(Boolean).join(' ').toLowerCase();
      return matchesStatus && (!search || haystack.includes(search));
    });
  });

  readonly completedAssignments = computed(() =>
    this.assignments().filter((assignment) => assignment.status === 'completed' && assignment.submission),
  );

  readonly activeTemplates = computed(() =>
    this.templates().filter((template) => template.status === 'active'),
  );

  readonly categories = computed(() =>
    [...new Set(this.templates().map((template) => template.category))].sort((a, b) => a.localeCompare(b)),
  );

  async ngOnInit(): Promise<void> {
    await this.load();
    this.openAssignmentFromQuery();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const response = await firstValueFrom(this.formsApi.bootstrap());
      this.templates.set(response.data.templates);
      this.assignments.set(response.data.assignments);
      this.users.set(response.data.users);
      this.customers.set(response.data.customers);
      this.repairs.set(response.data.repairs);
      this.summary.set(response.data.summary);
    } catch (error) {
      console.error(error);
      this.toast.error('Forms could not be loaded.');
    } finally {
      this.loading.set(false);
    }
  }

  selectTab(tab: FormsTab): void {
    this.activeTab.set(tab);
  }

  openCreateTemplate(): void {
    this.editingTemplateId.set(null);
    this.draft = this.blankTemplate();
    this.builderOpen.set(true);
  }

  editTemplate(template: FormTemplate): void {
    this.editingTemplateId.set(template.id);
    this.draft = {
      name: template.name,
      description: template.description,
      category: template.category,
      audience: template.audience,
      status: template.status,
      requiredBeforeRepairStatus: template.requiredBeforeRepairStatus,
      fields: template.fields.map((field, index) => ({
        ...field,
        options: (field.options ?? []).map((option) => ({ ...option })),
        validation: { ...(field.validation ?? {}) },
        conditionalLogic: field.conditionalLogic ? { ...field.conditionalLogic } : null,
        sortOrder: index,
      })),
    };
    this.builderOpen.set(true);
  }

  closeBuilder(): void {
    if (this.saving()) return;
    this.builderOpen.set(false);
  }

  addField(type: FormFieldType): void {
    const index = this.draft.fields.length;
    const optionField = ['select', 'radio', 'checkbox_group'].includes(type);
    const label = this.fieldTypes.find((item) => item.value === type)?.label ?? 'Field';
    this.draft.fields.push({
      key: this.uniqueFieldKey(label),
      label,
      type,
      helpText: null,
      placeholder: null,
      required: false,
      options: optionField
        ? [{ label: 'Option 1', value: 'option_1' }, { label: 'Option 2', value: 'option_2' }]
        : [],
      validation: {},
      conditionalLogic: null,
      sortOrder: index,
    });
  }

  removeField(index: number): void {
    this.draft.fields.splice(index, 1);
    this.normalizeFieldOrder();
  }

  duplicateField(index: number): void {
    const source = this.draft.fields[index];
    if (!source) return;
    const copy: FormField = {
      ...source,
      id: undefined,
      key: this.uniqueFieldKey(`${source.key}_copy`),
      label: `${source.label} copy`,
      options: source.options.map((option) => ({ ...option })),
      validation: { ...source.validation },
      conditionalLogic: source.conditionalLogic ? { ...source.conditionalLogic } : null,
      sortOrder: index + 1,
    };
    this.draft.fields.splice(index + 1, 0, copy);
    this.normalizeFieldOrder();
  }

  dropField(event: CdkDragDrop<FormField[]>): void {
    moveItemInArray(this.draft.fields, event.previousIndex, event.currentIndex);
    this.normalizeFieldOrder();
  }

  addOption(field: FormField): void {
    const number = field.options.length + 1;
    field.options.push({ label: `Option ${number}`, value: `option_${number}` });
  }

  removeOption(field: FormField, index: number): void {
    field.options.splice(index, 1);
  }

  updateOptionValue(option: { label: string; value: string }): void {
    option.value = this.slug(option.label) || option.value;
  }

  toggleConditional(field: FormField): void {
    field.conditionalLogic = field.conditionalLogic
      ? null
      : { fieldKey: this.draft.fields.find((candidate) => candidate.key !== field.key)?.key ?? '', operator: 'equals', value: '' };
  }

  async saveTemplate(): Promise<void> {
    const validation = this.validateTemplate();
    if (validation) {
      this.toast.error(validation);
      return;
    }
    this.saving.set(true);
    try {
      this.normalizeFieldOrder();
      const id = this.editingTemplateId();
      const response = id
        ? await firstValueFrom(this.formsApi.updateTemplate(id, this.draft))
        : await firstValueFrom(this.formsApi.createTemplate(this.draft));
      this.templates.update((templates) => {
        const existingIndex = templates.findIndex((template) => template.id === response.data.id);
        if (existingIndex === -1) return [response.data, ...templates];
        const next = [...templates];
        next[existingIndex] = response.data;
        return next;
      });
      this.builderOpen.set(false);
      this.toast.success(id ? 'Form template updated.' : 'Form template created.');
    } catch (error) {
      console.error(error);
      this.toast.error('The form template could not be saved.');
    } finally {
      this.saving.set(false);
    }
  }

  async duplicateTemplate(template: FormTemplate): Promise<void> {
    try {
      const response = await firstValueFrom(this.formsApi.duplicateTemplate(template.id));
      this.templates.update((templates) => [response.data, ...templates]);
      this.toast.success('Template duplicated.');
    } catch (error) {
      console.error(error);
      this.toast.error('Template could not be duplicated.');
    }
  }

  async archiveTemplate(template: FormTemplate): Promise<void> {
    if (!confirm(`Archive “${template.name}”? Existing completed responses will remain available.`)) return;
    try {
      await firstValueFrom(this.formsApi.archiveTemplate(template.id));
      this.templates.update((templates) => templates.filter((item) => item.id !== template.id));
      this.toast.success('Template archived.');
    } catch (error) {
      console.error(error);
      this.toast.error('Template could not be archived.');
    }
  }

  openAssign(template?: FormTemplate): void {
    if (template && template.status !== 'active') {
      this.toast.error('Activate the template before assigning it.');
      return;
    }
    this.assignmentDraft = this.blankAssignment();
    if (template) {
      this.assignmentDraft.templateId = template.id;
      this.assignmentDraft.title = template.name;
      this.assignmentDraft.audience = template.audience === 'staff' ? 'staff' : 'customer';
      this.assignmentDraft.sendEmail = this.assignmentDraft.audience === 'customer';
    }
    this.assignmentOpen.set(true);
  }

  closeAssign(): void {
    if (this.saving()) return;
    this.assignmentOpen.set(false);
  }

  onRepairSelected(repairId: string | null | undefined): void {
    const repair = this.repairs().find((item) => item.id === repairId);
    if (!repair) return;
    this.assignmentDraft.customerId = repair.customerId;
    this.assignmentDraft.customerDeviceId = repair.customerDeviceId;
    this.assignmentDraft.appointmentId = repair.appointmentId;
  }

  onTemplateSelected(templateId: string): void {
    const template = this.templates().find((item) => item.id === templateId);
    if (!template) return;
    this.assignmentDraft.title = template.name;
    if (template.audience === 'staff') {
      this.assignmentDraft.audience = 'staff';
      this.assignmentDraft.sendEmail = false;
    }
  }

  async createAssignment(): Promise<void> {
    if (!this.assignmentDraft.templateId) {
      this.toast.error('Choose a form template.');
      return;
    }
    if (this.assignmentDraft.audience === 'customer' && !this.assignmentDraft.customerId && !this.assignmentDraft.repairId) {
      this.toast.error('Choose a customer or repair for a customer form.');
      return;
    }
    this.saving.set(true);
    try {
      const payload: FormAssignmentPayload = {
        ...this.assignmentDraft,
        dueAt: this.assignmentDraft.dueAt
          ? new Date(this.assignmentDraft.dueAt).toISOString()
          : null,
      };
      const response = await firstValueFrom(this.formsApi.createAssignment(payload));
      this.assignments.update((assignments) => [response.data, ...assignments]);
      this.templates.update((templates) => templates.map((template) =>
        template.id === response.data.templateId
          ? { ...template, assignmentCount: template.assignmentCount + 1 }
          : template,
      ));
      this.assignmentOpen.set(false);
      this.recalculateSummary();
      this.toast.success(this.assignmentDraft.sendEmail ? 'Form assigned and emailed.' : 'Form assigned.');
    } catch (error) {
      console.error(error);
      this.toast.error('The form could not be assigned.');
    } finally {
      this.saving.set(false);
    }
  }

  openComplete(assignment: FormAssignment): void {
    this.selectedAssignment.set(assignment);
    this.responses = this.defaultResponses(assignment.template?.fields ?? []);
    this.completionOpen.set(true);
  }

  closeComplete(): void {
    if (this.saving()) return;
    this.completionOpen.set(false);
  }

  async submitStaffForm(): Promise<void> {
    const assignment = this.selectedAssignment();
    if (!assignment) return;
    const error = this.validateResponses(assignment.template?.fields ?? [], this.responses);
    if (error) {
      this.toast.error(error);
      return;
    }
    this.saving.set(true);
    try {
      const response = await firstValueFrom(this.formsApi.submitStaffAssignment(assignment.id, this.responses));
      this.replaceAssignment(response.data);
      this.completionOpen.set(false);
      this.recalculateSummary();
      this.toast.success('Form completed.');
    } catch (error) {
      console.error(error);
      this.toast.error('The form could not be submitted.');
    } finally {
      this.saving.set(false);
    }
  }

  openResponse(assignment: FormAssignment): void {
    this.selectedAssignment.set(assignment);
    this.responseOpen.set(true);
  }

  closeResponse(): void {
    this.responseOpen.set(false);
  }

  async resend(assignment: FormAssignment): Promise<void> {
    try {
      const response = await firstValueFrom(this.formsApi.resendAssignment(assignment.id));
      this.replaceAssignment(response.data);
      this.toast.success('Form email sent.');
    } catch (error) {
      console.error(error);
      this.toast.error('The form email could not be sent.');
    }
  }

  async cancelAssignment(assignment: FormAssignment): Promise<void> {
    if (!confirm(`Cancel “${assignment.title}”?`)) return;
    try {
      const response = await firstValueFrom(this.formsApi.updateAssignment(assignment.id, { status: 'canceled' }));
      this.replaceAssignment(response.data);
      this.recalculateSummary();
      this.toast.success('Assignment canceled.');
    } catch (error) {
      console.error(error);
      this.toast.error('The assignment could not be canceled.');
    }
  }

  async copyLink(assignment: FormAssignment): Promise<void> {
    try {
      await navigator.clipboard.writeText(assignment.publicUrl);
      this.toast.success('Form link copied.');
    } catch {
      this.toast.error('The form link could not be copied.');
    }
  }

  visibleField(field: FormField, values: Record<string, unknown> = this.responses): boolean {
    const logic = field.conditionalLogic;
    if (!logic?.fieldKey) return true;
    const actual = values[logic.fieldKey];
    switch (logic.operator) {
      case 'not_equals': return String(actual ?? '') !== String(logic.value ?? '');
      case 'contains': return Array.isArray(actual) ? actual.map(String).includes(String(logic.value ?? '')) : String(actual ?? '').includes(String(logic.value ?? ''));
      case 'is_checked': return actual === true;
      case 'is_not_checked': return actual !== true;
      case 'equals':
      default: return String(actual ?? '') === String(logic.value ?? '');
    }
  }

  checkboxGroupChecked(field: FormField, value: string): boolean {
    return Array.isArray(this.responses[field.key]) && (this.responses[field.key] as unknown[]).map(String).includes(value);
  }

  toggleCheckboxGroup(field: FormField, value: string, checked: boolean): void {
    const current = Array.isArray(this.responses[field.key]) ? [...(this.responses[field.key] as unknown[]).map(String)] : [];
    this.responses[field.key] = checked
      ? [...new Set([...current, value])]
      : current.filter((item) => item !== value);
  }

  async capturePhoto(field: FormField, event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > FORM_PHOTO_MAX_BYTES) {
      this.toast.error('Photos must be 15 MB or smaller.');
      input.value = '';
      return;
    }
    try {
      this.responses[field.key] = await formImageFileToDataUrl(file);
    } catch (error) {
      console.error(error);
      this.toast.error(error instanceof Error ? error.message : 'The photo could not be prepared.');
      input.value = '';
    }
  }

  responseValue(assignment: FormAssignment, field: FormField): unknown {
    return assignment.submission?.responses?.[field.key] ?? null;
  }

  responseDisplay(value: unknown): string {
    if (value == null || value === '') return 'No response';
    if (value === true) return 'Yes';
    if (value === false) return 'No';
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  isImageValue(value: unknown): value is string {
    return typeof value === 'string' && value.startsWith('data:image/');
  }

  imagePreview(key: string, value: unknown): string | null {
    if (!this.isImageValue(value)) return null;
    if (!isHeicDataUrl(value)) return value;

    const cached = this.imagePreviews()[key];
    if (cached) return cached;

    if (!this.pendingImagePreviews.has(key)) {
      this.pendingImagePreviews.add(key);
      void heicDataUrlToJpegDataUrl(value)
        .then((preview) => this.imagePreviews.update((current) => ({ ...current, [key]: preview })))
        .catch((error) => {
          console.error('Unable to convert HEIC form response for display.', error);
          this.toast.error('This HEIC photo could not be displayed.');
        })
        .finally(() => this.pendingImagePreviews.delete(key));
    }

    return null;
  }

  statusClass(status: string): string {
    switch (status) {
      case 'completed': return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
      case 'in_progress': return 'bg-blue-50 text-blue-700 ring-blue-200';
      case 'canceled': return 'bg-slate-100 text-slate-500 ring-slate-200';
      default: return 'bg-amber-50 text-amber-700 ring-amber-200';
    }
  }

  date(value: string | null | undefined): string {
    if (!value) return '—';
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
  }

  audienceLabel(value: FormAudience | 'staff' | 'customer'): string {
    return value === 'both' ? 'Staff + customer' : value === 'staff' ? 'Staff' : 'Customer';
  }

  repairGateStatusLabel(status: FormRepairGateStatus | null | undefined): string {
    if (!status) return 'No repair status gate';
    return this.repairGateStatuses.find((item) => item.value === status)?.label ?? status;
  }

  fieldTypeLabel(type: FormFieldType): string {
    return this.fieldTypes.find((item) => item.value === type)?.label ?? type;
  }

  private openAssignmentFromQuery(): void {
    const assignmentId = this.route.snapshot.queryParamMap.get('assignment');
    if (!assignmentId) return;

    const assignment = this.assignments().find((item) => item.id === assignmentId);
    if (!assignment) return;

    this.activeTab.set('assignments');
    this.assignmentSearch.set(assignment.title);

    if (assignment.status === 'completed' && assignment.submission) {
      this.openResponse(assignment);
      return;
    }

    if (assignment.audience === 'staff' && !['completed', 'canceled'].includes(assignment.status)) {
      this.openComplete(assignment);
    }
  }

  private blankTemplate(): FormTemplatePayload {
    return {
      name: '',
      description: null,
      category: 'General',
      audience: 'both',
      status: 'draft',
      requiredBeforeRepairStatus: null,
      fields: [],
    };
  }

  private blankAssignment(): FormAssignmentPayload {
    return {
      templateId: '',
      title: null,
      audience: 'customer',
      assignedToUserId: null,
      customerId: null,
      repairId: null,
      customerDeviceId: null,
      appointmentId: null,
      dueAt: null,
      sendEmail: true,
    };
  }

  private uniqueFieldKey(label: string): string {
    const base = this.slug(label) || 'field';
    let key = base;
    let index = 2;
    while (this.draft.fields.some((field) => field.key === key)) key = `${base}_${index++}`;
    return key;
  }

  private slug(value: string): string {
    return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 100);
  }

  private normalizeFieldOrder(): void {
    this.draft.fields.forEach((field, index) => {
      field.sortOrder = index;
      if (!field.key.trim()) field.key = this.uniqueFieldKey(field.label || `field_${index + 1}`);
    });
  }

  private validateTemplate(): string | null {
    if (!this.draft.name.trim()) return 'Enter a template name.';
    if (!this.draft.category.trim()) return 'Enter a category.';
    if (this.draft.fields.length === 0) return 'Add at least one field.';
    const keys = new Set<string>();
    for (const field of this.draft.fields) {
      if (!field.label.trim()) return 'Every field needs a label.';
      if (!field.key.trim()) field.key = this.uniqueFieldKey(field.label);
      if (keys.has(field.key)) return `Field keys must be unique. “${field.key}” is repeated.`;
      keys.add(field.key);
      if (['select', 'radio', 'checkbox_group'].includes(field.type) && field.options.length === 0) return `${field.label} needs at least one option.`;
    }
    return null;
  }

  private defaultResponses(fields: FormField[]): Record<string, unknown> {
    return Object.fromEntries(fields.map((field) => [field.key, field.type === 'checkbox' ? false : field.type === 'checkbox_group' ? [] : '']));
  }

  private validateResponses(fields: FormField[], values: Record<string, unknown>): string | null {
    for (const field of fields) {
      if (!field.required || !this.visibleField(field, values) || ['heading', 'paragraph'].includes(field.type)) continue;
      const value = values[field.key];
      const empty = value == null || value === '' || (Array.isArray(value) && value.length === 0) || (field.type === 'checkbox' && value !== true);
      if (empty) return `${field.label} is required.`;
    }
    return null;
  }

  private replaceAssignment(updated: FormAssignment): void {
    this.assignments.update((assignments) => assignments.map((assignment) => assignment.id === updated.id ? updated : assignment));
    this.selectedAssignment.set(updated);
  }

  private recalculateSummary(): void {
    const assignments = this.assignments();
    this.summary.set({
      total: assignments.length,
      pending: assignments.filter((assignment) => ['pending', 'in_progress'].includes(assignment.status)).length,
      completed: assignments.filter((assignment) => assignment.status === 'completed').length,
      overdue: assignments.filter((assignment) => Boolean(assignment.dueAt) && new Date(assignment.dueAt!).getTime() < Date.now() && !['completed', 'canceled'].includes(assignment.status)).length,
    });
  }
}
