import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
  Component,
  DestroyRef,
  HostListener,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subscription, firstValueFrom } from 'rxjs';
import {
  LucideAngularModule,
  ArrowLeft,
  Paperclip,
  Save,
  Clock3,
  MessageSquareText,
  MailIcon,
  PhoneIcon,
  LucideIconData,
  ChevronLeftIcon,
  ChevronDown,
  Check,
  UserRoundX,
  UserRound,
  ArrowRight,
  SmartphoneIcon,
} from 'lucide-angular';

import { RepairsStore } from '../../../core/repairs/repairs.store';
import type {
  RepairAttachment,
  RepairStatus,
} from '../../../core/repairs/repair.model';
import { ToastService } from '../../../core/toast/toast-service';
import { UsersStore } from '../../../core/users/users-store';
import { User } from '../../../core/users/users.model';
import { RepairOrderCard } from '../components/repair-order-card/repair-order-card';
import { SchedulingPickerModalComponent } from '../../../components/modals/scheduling-picker-modal/scheduling-picker-modal';
import {
  SchedulingRequest,
  SchedulingSelection,
} from '../../../core/scheduling/scheduling.types';
import { SchedulingModalService } from '../../../core/scheduling/schedulingModal-service';
import { AppointmentsStore } from '../../../core/appointments/appointments.store';
import { environment } from '../../../../environments/environment';
import { PhonePipe } from '../../../core/pipes/phone-pipe';
import { ManageDevicesModalService } from '../../../components/modals/manage-devices-modal-component/manage-devices-modal-service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CustomerDevicesStore } from '../../../core/customer-devices/customer-devices.store';
import { CustomerDevice } from '../../../core/customer-devices/customer-device.model';

interface ShopListResponse {
  data: Array<{
    settings?: {
      booking?: {
        enabled?: boolean;
      };
    };
  }>;
  nextCursor: string | null;
}

@Component({
  selector: 'app-repair-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    LucideAngularModule,
    RepairOrderCard,
    SchedulingPickerModalComponent,
    PhonePipe,
  ],
  templateUrl: './repair-detail.html',
  styleUrl: './repair-detail.scss',
})
export class RepairDetail implements OnInit, OnDestroy {
  readonly statusMenuOpen = signal(false);

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly http = inject(HttpClient);
  private readonly manageDevicesModalService = inject(ManageDevicesModalService);
  private readonly customerDevicesStore = inject(CustomerDevicesStore);
  private readonly destroyRef = inject(DestroyRef);

  readonly store = inject(RepairsStore);
  readonly usersStore = inject(UsersStore);
  private readonly toast = inject(ToastService);
  private readonly appointmentsStore = inject(AppointmentsStore);
  private readonly schedulingModalService = inject(SchedulingModalService);

  private readonly subscription = new Subscription();
  private readonly schedulableRoles = new Set(['owner', 'manager', 'tech']);

  public readonly leftChevronIcon: LucideIconData = ChevronLeftIcon;

  readonly bookingEnabled = signal(false);

  readonly icons = {
    ArrowLeft,
    ArrowRight,
    Paperclip,
    Save,
    Clock3,
    MessageSquareText,
    ChevronDown,
    Check,
    UserRoundX,
    UserRound,
    MailIcon,
    PhoneIcon,
    SmartphoneIcon
  };

  readonly repairId = signal<string | null>(null);

  readonly repair = this.store.selectedRepair;
  readonly loading = this.store.detailLoading;
  readonly saving = this.store.saving;
  readonly uploading = this.store.uploading;
  readonly error = this.store.error;

  readonly accessoriesList = signal<string[]>([]);
  readonly accessoryInput = signal('');

  readonly assignPanelOpen = signal(false);
  readonly assignSearch = signal('');
  readonly assigningUserName = signal<string | null>(null);
  readonly assignmentSaving = signal(false);
  readonly assignmentPendingName = signal<string | null>(null);

  readonly statuses: RepairStatus[] = [
    'intake',
    'scheduled',
    'diagnosing',
    'awaiting_approval',
    'awaiting_parts',
    'in_repair',
    'qc',
    'ready',
    'picked_up',
    'canceled',
  ];

  readonly hasOrder = computed(() => !!this.repair()?.orderId);
  readonly hasAppointment = computed(() => !!this.repair()?.appointment);
  readonly notes = this.store.selectedRepairNotes;
  readonly attachments = this.store.selectedRepairAttachments;

  readonly events = computed(() => {
    const events = [...this.store.selectedRepairEvents()];
    return events.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  });

  readonly repairForm = this.fb.nonNullable.group({
    status: ['intake' as RepairStatus, Validators.required],
    problemSummary: ['', [Validators.required, Validators.maxLength(500)]],
    intakeNotes: [''],
    conditionNotes: [''],
    passcodeProvided: [false],
    accessoriesText: [''],
    assignedTo: [''],
  });

  readonly noteForm = this.fb.nonNullable.group({
    visibility: ['internal' as 'internal' | 'customer', Validators.required],
    body: ['', [Validators.required, Validators.maxLength(2000)]],
  });

  private readonly syncFormEffect = effect(() => {
    const repair = this.repair();
    if (!repair) return;

    this.accessoriesList.set(repair.accessories ?? []);

    this.repairForm.patchValue(
      {
        status: repair.status,
        problemSummary: repair.problemSummary ?? '',
        intakeNotes: repair.intakeNotes ?? '',
        conditionNotes: repair.conditionNotes ?? '',
        passcodeProvided: repair.passcodeProvided,
        accessoriesText: (repair.accessories ?? []).join(', '),
        assignedTo: repair.assignedTo ?? '',
      },
      { emitEvent: false }
    );
  });

  readonly assignedTech = computed<User | null>(() => {
    const assignedTo = this.repairForm.controls.assignedTo.value?.trim();
    if (!assignedTo) return null;

    const users = this.usersStore.users();

    const exact =
      users.find(
        (user) => user.name.trim().toLowerCase() === assignedTo.toLowerCase()
      ) ?? null;

    if (exact) return exact;

    return {
      id: assignedTo,
      shopId: '',
      name: assignedTo,
      email: null,
      phone: null,
      role: '',
      status: 'active',
      tags: [],
      notes: null,
      createdAt: '',
      createdBy: '',
      updatedAt: '',
    };
  });

  readonly filteredAssignableUsers = computed(() => {
    const query = this.assignSearch().trim().toLowerCase();
    const users = this.usersStore.assignableUsers();

    if (!query) return users;

    return users.filter((user) => {
      const haystack = [
        user.name,
        user.email ?? '',
        user.phone ?? '',
        user.role ?? '',
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  });

  readonly schedulerFromIso = computed(() => {
    return new Date().toISOString();
  });

  readonly schedulerToIso = computed(() => {
    const end = new Date();
    end.setDate(end.getDate() + 14);
    return end.toISOString();
  });

  readonly selectedDurationMinutes = computed(() => {
    return 60;
  });

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      await this.router.navigate(['/repairs']);
      return;
    }

    this.repairId.set(id);

    await this.loadBookingEnabled();

    this.subscription.add(
      this.schedulingModalService.confirmed.subscribe(
        (selection: SchedulingSelection | null) => {
          if (!selection) return;
          void this.handleSchedulingConfirmed(selection);
        }
      )
    );

    this.usersStore.load({ limit: 100 }).catch((error) => {
      console.error('Failed to load users', error);
    });

    const repair = await this.store.loadRepair(id);

    if (!repair) {
      this.toast.error('Repair not found', 'We could not load that repair.');
      await this.router.navigate(['/repairs']);
      return;
    }

    const confirmed$ =
      (this.schedulingModalService as any).selectionConfirmed ??
      (this.schedulingModalService as any).confirmedSelection ??
      (this.schedulingModalService as any).selection$ ??
      (this.schedulingModalService as any).selection;

    if (confirmed$?.subscribe) {
      this.subscription.add(
        confirmed$.subscribe((selection: SchedulingSelection | null) => {
          if (!selection) return;
          void this.handleSchedulingConfirmed(selection);
        })
      );
    }

    this.manageDevicesModalService.modalClosed$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.customerDevicesStore.clearSelected();
        if(this.repair()) {
          let id = this.repair()?.id;
          id ? this.store.loadRepair(id) : null;
        }
      });
  }

  private async loadBookingEnabled(): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.http.get<ShopListResponse>(`${environment.apiBase}/shops`)
      );

      this.bookingEnabled.set(
        response.data?.[0]?.settings?.booking?.enabled === true
      );
    } catch (error) {
      console.error('Failed to load booking setting.', error);
      this.bookingEnabled.set(false);
    }
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
    this.store.clearError();
    this.store.clearSelectedRepair();
    this.subscription.unsubscribe();
  }

  async saveRepair(): Promise<void> {
    const id = this.repairId();
    if (!id || this.repairForm.invalid) {
      this.repairForm.markAllAsTouched();
      return;
    }

    const value = this.repairForm.getRawValue();

    const payload: any = {
      status: value.status,
      problemSummary: value.problemSummary.trim(),
      passcodeProvided: value.passcodeProvided,
    };

    if (value.intakeNotes?.trim()) {
      payload.intakeNotes = value.intakeNotes.trim();
    }

    if (value.conditionNotes?.trim()) {
      payload.conditionNotes = value.conditionNotes.trim();
    }

    const accessories = this.accessoriesList();
    if (accessories.length) {
      payload.accessories = accessories;
    }

    if (value.assignedTo?.trim()) {
      payload.assignedTo = value.assignedTo.trim();
    }

    const updated = await this.store.updateRepair(id, payload);

    if (updated) {
      this.toast.success('Repair updated', 'Changes saved successfully.');
    } else {
      this.toast.error(
        'Save failed',
        this.error() ?? 'Unable to update repair.'
      );
    }
  }

  async quickStatusChange(status: RepairStatus): Promise<void> {
    const id = this.repairId();
    if (!id) return;

    const updated = await this.store.updateRepairStatus(id, status);
    if (updated) {
      this.toast.success(
        'Status updated',
        `Repair marked ${this.prettyStatus(status)}.`
      );
    } else {
      this.toast.error(
        'Update failed',
        this.error() ?? 'Unable to change status.'
      );
    }
  }

  async addNote(): Promise<void> {
    const id = this.repairId();
    if (!id || this.noteForm.invalid) {
      this.noteForm.markAllAsTouched();
      return;
    }

    const value = this.noteForm.getRawValue();
    const note = await this.store.addNote(id, {
      visibility: value.visibility,
      body: value.body.trim(),
    });

    if (note) {
      this.noteForm.patchValue({ body: '', visibility: 'internal' });
      this.toast.success('Note added', 'Repair note saved.');
    } else {
      this.toast.error('Note failed', this.error() ?? 'Unable to add note.');
    }
  }

  async onFileSelected(event: Event): Promise<void> {
    const id = this.repairId();
    if (!id) return;

    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const attachment = await this.store.uploadAttachment(id, file);

    if (attachment) {
      this.toast.success('Uploaded', `${attachment.filename} uploaded.`);
    } else {
      this.toast.error(
        'Upload failed',
        this.error() ?? 'Unable to upload attachment.'
      );
    }

    input.value = '';
  }

  async downloadAttachment(attachment: RepairAttachment): Promise<void> {
    const id = this.repairId();
    if (!id) return;

    const url = await this.store.getAttachmentDownloadUrl(id, attachment.id);
    if (!url) {
      this.toast.error(
        'Download failed',
        this.error() ?? 'Unable to get file URL.'
      );
      return;
    }

    window.open(url, '_blank', 'noopener,noreferrer');
  }

  async deleteAttachment(attachment: RepairAttachment): Promise<void> {
    const id = this.repairId();
    if (!id) return;

    const ok = await this.store.deleteAttachment(id, attachment.id);
    if (ok) {
      this.toast.success('Deleted', `${attachment.filename} removed.`);
    } else {
      this.toast.error(
        'Delete failed',
        this.error() ?? 'Unable to delete attachment.'
      );
    }
  }

  openAssignModal(): void {
    this.assignPanelOpen.set(true);
    this.assignSearch.set('');
    this.assigningUserName.set(null);
  }

  closeAssignPanel(): void {
    this.assignPanelOpen.set(false);
    this.assignSearch.set('');
    this.assigningUserName.set(null);
  }

  async selectAssignedUser(user: User): Promise<void> {
    const id = this.repairId();
    if (!id) return;

    const previousValue = this.repairForm.controls.assignedTo.value;

    this.assignmentSaving.set(true);
    this.assignmentPendingName.set(user.name);

    this.repairForm.patchValue({
      assignedTo: user.name,
    });

    try {
      const updated = await this.store.updateRepair(id, {
        assignedTo: user.name,
      });

      if (!updated) {
        this.repairForm.patchValue({
          assignedTo: previousValue ?? '',
        });

        this.toast.error(
          'Assignment failed',
          this.error() ?? 'Unable to assign technician.'
        );
        return;
      }

      this.toast.success('Assigned', `${user.name} is now assigned.`);
      this.closeAssignPanel();
    } finally {
      this.assignmentSaving.set(false);
      this.assignmentPendingName.set(null);
    }
  }

  async clearAssignedUser(): Promise<void> {
    const id = this.repairId();
    if (!id) return;

    const previousValue = this.repairForm.controls.assignedTo.value;

    this.assigningUserName.set(null);
    this.repairForm.patchValue({
      assignedTo: '',
    });

    const updated = await this.store.updateRepair(id, {
      assignedTo: '',
    });

    if (updated) {
      this.toast.success('Unassigned', 'Technician removed.');
      this.closeAssignPanel();
      return;
    }

    this.repairForm.patchValue({
      assignedTo: previousValue ?? '',
    });

    this.toast.error(
      'Unassign failed',
      this.error() ?? 'Unable to remove technician.'
    );
  }

  prettyStatus(status: string | null | undefined): string {
    if (!status) return 'Unknown';
    return status.replaceAll('_', ' ').replace(/\b\w/g, (m) => m.toUpperCase());
  }

  formatDate(value: string | null | undefined): string {
    if (!value) return '—';
    return new Date(value).toLocaleString();
  }

  trackById(_: number, item: { id: string }): string {
    return item.id;
  }

  trackUser(_: number, user: User): string {
    return user.id;
  }

  toggleStatusMenu(): void {
    this.statusMenuOpen.update((v) => !v);
  }

  selectStatus(status: RepairStatus): void {
    this.statusMenuOpen.set(false);
    this.repairForm.patchValue({ status });
    void this.quickStatusChange(status);
  }

  getInitials(name: string | null | undefined): string {
    if (!name) return '?';

    const parts = name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2);

    if (!parts.length) return '?';

    return parts.map((part) => part[0]?.toUpperCase() ?? '').join('');
  }

  addAccessory(event: Event): void {
    event.preventDefault();

    const value = this.accessoryInput().trim();
    if (!value) return;

    this.accessoriesList.update((list) => {
      const exists = list.some(
        (item) => item.toLowerCase() === value.toLowerCase()
      );
      return exists ? list : [...list, value];
    });

    this.accessoryInput.set('');
  }

  handleBackspace(event: KeyboardEvent): void {
    if (this.accessoryInput()) return;

    const list = this.accessoriesList();
    if (!list.length) return;

    event.preventDefault();
    this.accessoriesList.set(list.slice(0, -1));
  }

  onAccessoryKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' && event.key !== ',') {
      if (event.key === 'Backspace' && !this.accessoryInput().trim()) {
        const current = this.accessoriesList();
        if (current.length) {
          this.accessoriesList.set(current.slice(0, -1));
        }
      }
      return;
    }

    event.preventDefault();
    this.commitAccessoryInput();
  }

  commitAccessoryInput(): void {
    const raw = this.accessoryInput().trim();
    if (!raw) return;

    const normalized = raw.replace(/,$/, '').trim();
    if (!normalized) return;

    this.accessoriesList.update((current) => {
      const exists = current.some(
        (item) => item.toLowerCase() === normalized.toLowerCase()
      );

      return exists ? current : [...current, normalized];
    });

    this.accessoryInput.set('');
  }

  removeAccessory(item: string): void {
    this.accessoriesList.update((current) =>
      current.filter((value) => value !== item)
    );
  }

  togglePasscodeProvided(): void {
    const current = this.repairForm.controls.passcodeProvided.value;
    this.repairForm.patchValue({
      passcodeProvided: !current,
    });
  }

  formatAppointmentDate(value: string | null | undefined): string {
    if (!value) return '—';

    return new Date(value).toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  formatAppointmentTimeRange(
    start: string | null | undefined,
    end: string | null | undefined
  ): string {
    if (!start) return '—';

    const startDate = new Date(start);
    const startText = startDate.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });

    if (!end) return startText;

    const endDate = new Date(end);
    const endText = endDate.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });

    return `${startText} – ${endText}`;
  }

  async createOrder(): Promise<void> {
    const id = this.repairId();
    const repair = this.repair();

    if (!id || !repair) return;

    const order = await this.store.createOrderFromRepair(id, {
      items: [
        {
          type: 'service',
          name: 'Repair Service',
          quantity: 1,
          unitPriceCents: 0,
          notes: null,
        },
      ],
      discountCents: 0,
      tags: ['repair'],
      notes: 'Created from repair detail page',
    });

    if (!order) {
      this.toast.error(
        'Order failed',
        this.error() ?? 'Unable to create order.'
      );
      return;
    }

    await this.store.loadRepair(id);

    this.toast.success(
      'Order linked',
      `Order ${order.orderNumber} is now attached.`
    );
  }

  private isSchedulableUserId(userId: string | null | undefined): boolean {
  if (!userId) return false;

  const user =
    this.usersStore.getById?.(userId) ??
    this.usersStore.users().find((item) => item.id === userId);

  const role = String(user?.role ?? '').trim().toLowerCase();
  const status = String(user?.status ?? '').trim().toLowerCase();

  return !!user && status === 'active' && this.schedulableRoles.has(role);
}

  getSchedulingRequest(): SchedulingRequest | null {
    if (!this.bookingEnabled()) return null;

    const repair = this.repair();
    const repairId = this.repairId();

    if (!repair || !repairId) return null;

    const assignedUserId = this.isSchedulableUserId(
      repair.appointment?.technicianUserId
    )
      ? repair.appointment?.technicianUserId ?? undefined
      : undefined;

    return {
      title: repair.appointment ? 'Reschedule Appointment' : 'Schedule Appointment',
      subtitle: 'Choose an available appointment time.',
      from: this.schedulerFromIso(),
      to: this.schedulerToIso(),
      durationMinutes: this.selectedDurationMinutes(),
      repairId,
      assignedUserId,
      slotMinutes: 15,
    };
  }

  openRescheduleModal(): void {
    if (!this.bookingEnabled()) return;

    const request = this.getSchedulingRequest();
    if (!request) return;

    this.schedulingModalService.open(request);
  }

  private async handleSchedulingConfirmed(
    selection: SchedulingSelection
  ): Promise<void> {
    if (!this.bookingEnabled()) return;

    const id = this.repairId();
    const repair = this.repair();

    if (!id || !repair) return;

    const appointment = repair.appointment
      ? await this.appointmentsStore.rescheduleAppointment(
          id,
          selection.startAt,
          selection.endAt,
          selection.assignedUserId ?? undefined
        )
      : await this.appointmentsStore.scheduleAppointment(
          id,
          selection.startAt,
          selection.endAt,
          selection.assignedUserId ?? undefined
        );

    if (!appointment) {
      const code = this.appointmentsStore.errorCode();

      let message = 'Unable to update appointment.';

      switch (code) {
        case 'time_conflict':
          message = 'That technician is already booked for this time.';
          break;

        case 'invalid_slot':
          message = 'That time is no longer available. Please choose another.';
          break;

        case 'cannot_schedule_in_past':
          message = 'You can’t schedule an appointment in the past.';
          break;

        case 'assigned_user_not_found':
          message = 'That technician could not be found.';
          break;
      }

      this.toast.error(
        repair.appointment ? 'Failed to reschedule' : 'Failed to schedule',
        message
      );

      return;
    }

    await this.store.loadRepair(id);

    this.toast.success(
      repair.appointment ? 'Appointment rescheduled' : 'Appointment scheduled',
      repair.appointment
        ? 'The appointment was updated successfully.'
        : 'The appointment was created successfully.'
    );
  }

  editAssignedDevice(customerId:string, customerDevice:CustomerDevice) {
    this.customerDevicesStore.setSelected(customerDevice);
    this.manageDevicesModalService.open(customerId);
  }

  @HostListener('document:click', ['$event'])
  handleClickOutside(event: Event): void {
    const target = event.target as HTMLElement;

    if (!target.closest('.status-menu-wrap')) {
      this.statusMenuOpen.set(false);
    }
  }
}