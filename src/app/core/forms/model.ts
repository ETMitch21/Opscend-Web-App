export type FormAudience = 'staff' | 'customer' | 'both';
export type FormTemplateStatus = 'draft' | 'active' | 'archived';
export type FormRepairGateStatus =
  | 'scheduled'
  | 'needs_reassignment'
  | 'customer_verified'
  | 'diagnosing'
  | 'awaiting_approval'
  | 'awaiting_parts'
  | 'in_repair'
  | 'documentation_pending'
  | 'qc'
  | 'ready'
  | 'picked_up';
export type FormAssignmentStatus = 'pending' | 'in_progress' | 'completed' | 'canceled';
export type FormFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'email'
  | 'phone'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'checkbox_group'
  | 'date'
  | 'photo'
  | 'signature'
  | 'heading'
  | 'paragraph';

export interface FormOption {
  label: string;
  value: string;
}

export interface FormConditionalLogic {
  fieldKey: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'is_checked' | 'is_not_checked';
  value?: unknown;
}

export interface FormField {
  id?: string;
  templateId?: string;
  key: string;
  label: string;
  type: FormFieldType;
  helpText: string | null;
  placeholder: string | null;
  required: boolean;
  options: FormOption[];
  validation: Record<string, unknown>;
  conditionalLogic: FormConditionalLogic | null;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface FormTemplate {
  id: string;
  shopId: string;
  starterKey: string | null;
  name: string;
  description: string | null;
  category: string;
  audience: FormAudience;
  status: FormTemplateStatus;
  requiredBeforeRepairStatus: FormRepairGateStatus | null;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  assignmentCount: number;
  fields: FormField[];
}

export interface FormSubmission {
  id: string;
  assignmentId: string;
  responses: Record<string, unknown>;
  formSnapshot: Record<string, unknown> | null;
  submittedByType: 'staff' | 'customer';
  submittedByUserId: string | null;
  submittedByCustomerId: string | null;
  submittedAt: string;
  createdAt: string;
}

export interface FormAssignment {
  id: string;
  shopId: string;
  templateId: string;
  title: string;
  audience: 'staff' | 'customer';
  status: FormAssignmentStatus;
  assignedToUserId: string | null;
  customerId: string | null;
  repairId: string | null;
  customerDeviceId: string | null;
  appointmentId: string | null;
  publicToken: string;
  publicUrl: string;
  dueAt: string | null;
  sentAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  completedByUserId: string | null;
  completedByCustomer: boolean;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  template: FormTemplate | null;
  customer: { id: string; name: string | null; email: string | null; phone: string | null } | null;
  repair: { id: string; status: string; problemSummary: string } | null;
  device: { id: string; displayName: string; nickname: string | null } | null;
  appointment: { id: string; startAt: string; endAt: string; status: string } | null;
  assignedToUser: { id: string; name: string; email: string | null } | null;
  submission: FormSubmission | null;
}

export interface FormUserOption {
  id: string;
  name: string;
  email: string | null;
  role: string;
}

export interface FormCustomerOption {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
}

export interface FormRepairOption {
  id: string;
  status: string;
  problemSummary: string;
  customerId: string;
  customerName: string;
  customerEmail: string | null;
  customerDeviceId: string;
  deviceName: string;
  appointmentId: string | null;
  appointmentStartAt: string | null;
  updatedAt: string;
}

export interface FormsBootstrapResponse {
  data: {
    templates: FormTemplate[];
    assignments: FormAssignment[];
    users: FormUserOption[];
    customers: FormCustomerOption[];
    repairs: FormRepairOption[];
    summary: { total: number; pending: number; completed: number; overdue: number };
  };
}

export interface FormTemplatePayload {
  name: string;
  description?: string | null;
  category: string;
  audience: FormAudience;
  status: FormTemplateStatus;
  requiredBeforeRepairStatus?: FormRepairGateStatus | null;
  fields: FormField[];
}

export interface FormAssignmentPayload {
  templateId: string;
  title?: string | null;
  audience: 'staff' | 'customer';
  assignedToUserId?: string | null;
  customerId?: string | null;
  repairId?: string | null;
  customerDeviceId?: string | null;
  appointmentId?: string | null;
  dueAt?: string | null;
  sendEmail: boolean;
}

export interface PublicFormTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string;
  fields: FormField[];
}

export interface PublicFormResponse {
  data: {
    id: string;
    title: string;
    status: FormAssignmentStatus;
    dueAt: string | null;
    completedAt: string | null;
    template: PublicFormTemplate;
    device: { id: string; displayName: string; nickname: string | null } | null;
    shop: {
      name: string;
      slug: string;
      logoUrl: string | null;
      primaryColor: string | null;
      phone: string | null;
      email: string | null;
    } | null;
    customerName: string | null;
  };
}
