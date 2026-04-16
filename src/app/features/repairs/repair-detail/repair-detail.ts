import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { firstValueFrom, Subscription } from 'rxjs';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronLeftIcon,
  Clock3,
  Grip,
  LockKeyhole,
  LucideAngularModule,
  LucideIconData,
  MailIcon,
  MessageSquareText,
  Paperclip,
  PhoneIcon,
  Save,
  Shield,
  SmartphoneIcon,
  UserRound,
  UserRoundX,
  X,
} from 'lucide-angular';

import { AppConfigService } from '../../../core/app-config/app-config.service';
import { AppointmentsStore } from '../../../core/appointments/appointments.store';
import { CustomerDevice } from '../../../core/customer-devices/customer-device.model';
import { CustomerDevicesStore } from '../../../core/customer-devices/customer-devices.store';
import { PhonePipe } from '../../../core/pipes/phone-pipe';
import type {
  RepairAttachment,
  RepairStatus,
  RepairUnlockType,
} from '../../../core/repairs/repair.model';
import { RepairsStore } from '../../../core/repairs/repairs.store';
import { SchedulingModalService } from '../../../core/scheduling/schedulingModal-service';
import type {
  SchedulingRequest,
  SchedulingSelection,
} from '../../../core/scheduling/scheduling.types';
import { ToastService } from '../../../core/toast/toast-service';
import { User } from '../../../core/users/users.model';
import { UsersStore } from '../../../core/users/users-store';
import { ManageDevicesModalService } from '../../../components/modals/manage-devices-modal-component/manage-devices-modal-service';
import { SchedulingPickerModalComponent } from '../../../components/modals/scheduling-picker-modal/scheduling-picker-modal';
import { RepairOrderCard } from '../components/repair-order-card/repair-order-card';

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
  @ViewChild('patternPad') patternPad?: ElementRef<HTMLElement>;

  private readonly appConfig = inject(AppConfigService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly manageDevicesModalService = inject(ManageDevicesModalService);
  private readonly customerDevicesStore = inject(CustomerDevicesStore);

  readonly store = inject(RepairsStore);
  readonly usersStore = inject(UsersStore);
  private readonly toast = inject(ToastService);
  private readonly appointmentsStore = inject(AppointmentsStore);
  private readonly schedulingModalService = inject(SchedulingModalService);

  private readonly subscription = new Subscription();
  private readonly schedulableRoles = new Set(['owner', 'manager', 'tech']);
  private patternDrawing = false;

  public readonly leftChevronIcon: LucideIconData = ChevronLeftIcon;

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
    SmartphoneIcon,
    Shield,
    LockKeyhole,
    Grip,
    X,
  };

  readonly statusMenuOpen = signal(false);
  readonly unlockModalOpen = signal(false);
  readonly bookingEnabled = signal(false);

  readonly repairId = signal<string | null>(null);
  readonly accessoriesList = signal<string[]>([]);
  readonly accessoryInput = signal('');

  readonly assignPanelOpen = signal(false);
  readonly assignSearch = signal('');
  readonly assigningUserName = signal<string | null>(null);
  readonly assignmentSaving = signal(false);
  readonly assignmentPendingName = signal<string | null>(null);

  readonly patternPath = signal<number[]>([]);

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

  readonly patternNodes = Array.from({ length: 9 }, (_, index) => ({ index }));
  readonly previewPatternNodes = Array.from({ length: 9 }, (_, index) => ({ index }));

  readonly repair = this.store.selectedRepair;
  readonly loading = this.store.detailLoading;
  readonly saving = this.store.saving;
  readonly uploading = this.store.uploading;
  readonly error = this.store.error;

  readonly notes = this.store.selectedRepairNotes;
  readonly attachments = this.store.selectedRepairAttachments;

  readonly hasOrder = computed(() => !!this.repair()?.orderId);
  readonly hasAppointment = computed(() => !!this.repair()?.appointment);

  readonly events = computed(() => {
    const events = [...this.store.selectedRepairEvents()];
    return events.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  });

  readonly unlockSummary = computed(() => {
    const unlockType = this.repairForm.controls.unlockType.value;
    const pinCode = this.repairForm.controls.pinCode.value?.trim() ?? '';
    const patternCode = this.repairForm.controls.patternCode.value?.trim() ?? '';

    if (unlockType === 'pin' && pinCode) {
      return `PIN saved • ${'•'.repeat(Math.max(pinCode.length, 4))}`;
    }

    if (unlockType === 'pattern' && patternCode) {
      return 'Pattern saved';
    }

    return 'No unlock method saved';
  });

  readonly unlockBadgeTone = computed(() => {
    const unlockType = this.repairForm.controls.unlockType.value;
    return unlockType === 'none' ? 'muted' : 'active';
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

  readonly schedulerFromIso = computed(() => {
    return new Date().toISOString();
  });

  readonly schedulerToIso = computed(() => {
    const end = new Date();
    end.setDate(end.getDate() + 14);
    return end.toISOString();
  });

  readonly selectedDurationMinutes = computed(() => 60);

  readonly patternSegments = computed(() => {
    const path = this.patternPath();
    const segments: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];

    for (let i = 1; i < path.length; i++) {
      const prev = this.getPatternNodeCenter(path[i - 1]);
      const curr = this.getPatternNodeCenter(path[i]);

      if (!prev || !curr) continue;

      segments.push({
        x1: prev.x,
        y1: prev.y,
        x2: curr.x,
        y2: curr.y,
      });
    }

    return segments;
  });

  readonly previewPatternPath = computed(() =>
    this.parsePatternCode(this.repairForm.controls.patternCode.value)
  );

  readonly patternPreviewSegments = computed(() => {
    const path = this.previewPatternPath();
    const segments: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];

    for (let i = 1; i < path.length; i++) {
      const prev = this.previewPatternPoint(path[i - 1]);
      const curr = this.previewPatternPoint(path[i]);

      segments.push({
        x1: prev.x,
        y1: prev.y,
        x2: curr.x,
        y2: curr.y,
      });
    }

    return segments;
  });

  readonly repairForm = this.fb.nonNullable.group({
    status: ['intake' as RepairStatus, Validators.required],
    problemSummary: ['', [Validators.required, Validators.maxLength(500)]],
    intakeNotes: [''],
    conditionNotes: [''],
    passcodeProvided: [false],
    unlockType: ['none' as RepairUnlockType],
    pinCode: [''],
    patternCode: [''],
    accessoriesText: [''],
    assignedTo: [''],
  });

  readonly noteForm = this.fb.nonNullable.group({
    visibility: ['internal' as 'internal' | 'customer', Validators.required],
    body: ['', [Validators.required, Validators.maxLength(2000)]],
  });

  private get apiBase(): string {
    return this.appConfig.config.apiBase;
  }

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
        unlockType: repair.unlockType ?? 'none',
        pinCode: repair.pinCode ?? '',
        patternCode: repair.patternCode ?? '',
        accessoriesText: (repair.accessories ?? []).join(', '),
        assignedTo: repair.assignedTo ?? '',
      },
      { emitEvent: false }
    );

    if ((repair.unlockType ?? 'none') === 'pattern') {
      this.syncPatternPathFromControl();
    } else {
      this.patternPath.set([]);
    }
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
        const currentRepairId = this.repair()?.id;
        if (currentRepairId) {
          void this.store.loadRepair(currentRepairId);
        }
      });
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
    this.store.clearError();
    this.store.clearSelectedRepair();
  }

  private async loadBookingEnabled(): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.http.get<ShopListResponse>(`${this.apiBase}/shops`)
      );

      this.bookingEnabled.set(
        response.data?.[0]?.settings?.booking?.enabled === true
      );
    } catch (error) {
      console.error('Failed to load booking setting.', error);
      this.bookingEnabled.set(false);
    }
  }

  async saveRepair(): Promise<void> {
    const id = this.repairId();
    if (!id || this.repairForm.invalid) {
      this.repairForm.markAllAsTouched();
      return;
    }

    const value = this.repairForm.getRawValue();
    const payload: any = {};

    payload.status = value.status;
    payload.problemSummary = value.problemSummary.trim();

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

    if (value.unlockType === 'pin' && value.pinCode?.trim()) {
      payload.passcodeProvided = true;
      payload.unlockType = 'pin';
      payload.pinCode = value.pinCode.trim();
      payload.patternCode = null;
    } else if (value.unlockType === 'pattern' && value.patternCode?.trim()) {
      payload.passcodeProvided = true;
      payload.unlockType = 'pattern';
      payload.patternCode = value.patternCode.trim();
      payload.pinCode = null;
    } else if (value.unlockType === 'none') {
      payload.passcodeProvided = false;
      payload.unlockType = 'none';
      payload.pinCode = null;
      payload.patternCode = null;
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

  openUnlockModal(): void {
    this.unlockModalOpen.set(true);

    if (this.repairForm.controls.unlockType.value === 'pattern') {
      queueMicrotask(() => {
        requestAnimationFrame(() => {
          this.syncPatternPathFromControl();
        });
      });
    }
  }

  closeUnlockModal(): void {
    this.unlockModalOpen.set(false);
  }

  setUnlockType(type: RepairUnlockType): void {
    this.repairForm.patchValue({
      unlockType: type,
      passcodeProvided: type !== 'none',
    });

    if (type === 'pin') {
      this.patternDrawing = false;
      this.patternPath.set([]);
      this.repairForm.patchValue({
        patternCode: '',
      });
    }

    if (type === 'pattern') {
      this.repairForm.patchValue({
        pinCode: '',
      });

      const existing = this.repairForm.controls.patternCode.value?.trim();
      if (existing) {
        const parsed = existing
          .split(',')
          .map((v) => Number(v.trim()))
          .filter((v) => !Number.isNaN(v) && v >= 0 && v < 9);

        this.patternPath.set([...new Set(parsed)]);
      } else {
        this.patternPath.set([]);
      }
    }

    if (type === 'none') {
      this.patternDrawing = false;
      this.patternPath.set([]);
      this.repairForm.patchValue({
        pinCode: '',
        patternCode: '',
        passcodeProvided: false,
      });
    }
  }

  clearUnlockData(): void {
    this.patternDrawing = false;
    this.patternPath.set([]);
    this.repairForm.patchValue({
      passcodeProvided: false,
      unlockType: 'none',
      pinCode: '',
      patternCode: '',
    });
  }

  resetPattern(): void {
    this.patternDrawing = false;
    this.patternPath.set([]);
    this.repairForm.patchValue({
      patternCode: '',
      passcodeProvided: this.repairForm.controls.unlockType.value !== 'none',
    });
  }

  beginPatternDraw(index: number, event: PointerEvent): void {
    event.preventDefault();
    event.stopPropagation();

    this.setUnlockType('pattern');
    this.patternDrawing = true;
    this.patternPath.set([index]);
    this.syncPatternCodeFromPath();
  }

  extendPatternDraw(index: number): void {
    if (!this.patternDrawing) return;

    this.patternPath.update((current) => {
      if (current.includes(index)) return current;
      return [...current, index];
    });

    this.syncPatternCodeFromPath();
  }

  onPatternPointerMove(event: PointerEvent): void {
    if (!this.patternDrawing) return;

    const element = document.elementFromPoint(
      event.clientX,
      event.clientY
    ) as HTMLElement | null;
    const nodeButton = element?.closest('[data-pattern-index]') as HTMLElement | null;
    if (!nodeButton) return;

    const rawIndex = nodeButton.getAttribute('data-pattern-index');
    if (rawIndex == null) return;

    const index = Number(rawIndex);
    if (Number.isNaN(index)) return;

    this.extendPatternDraw(index);
  }

  endPatternDraw(): void {
    if (!this.patternDrawing) return;
    this.patternDrawing = false;
    this.syncPatternCodeFromPath();
  }

  private syncPatternCodeFromPath(): void {
    const path = this.patternPath();
    this.repairForm.patchValue({
      patternCode: path.length ? path.join(',') : '',
      passcodeProvided: path.length > 0,
    });
  }

  private parsePatternCode(value: string | null | undefined): number[] {
    if (!value?.trim()) return [];

    return [
      ...new Set(
        value
          .split(',')
          .map((part) => Number(part.trim()))
          .filter((part) => Number.isInteger(part) && part >= 0 && part < 9)
      ),
    ];
  }

  private syncPatternPathFromControl(): void {
    const parsed = this.parsePatternCode(this.repairForm.controls.patternCode.value);

    this.patternPath.set([]);
    queueMicrotask(() => {
      this.patternPath.set(parsed);
    });
  }

  private getPatternNodeElement(index: number): HTMLElement | null {
    const pad = this.patternPad?.nativeElement;
    if (!pad) return null;

    return pad.querySelector(
      `[data-pattern-index="${index}"]`
    ) as HTMLElement | null;
  }

  private getPatternNodeCenter(index: number): { x: number; y: number } | null {
    const pad = this.patternPad?.nativeElement;
    const node = this.getPatternNodeElement(index);

    if (!pad || !node) return null;

    const padRect = pad.getBoundingClientRect();
    const nodeRect = node.getBoundingClientRect();

    return {
      x: nodeRect.left + nodeRect.width / 2 - padRect.left,
      y: nodeRect.top + nodeRect.height / 2 - padRect.top,
    };
  }

  previewPatternPoint(index: number): { x: number; y: number } {
    const row = Math.floor(index / 3);
    const col = index % 3;
    const positions = [18, 50, 82];

    return {
      x: positions[col],
      y: positions[row],
    };
  }

  isPreviewPatternNodeActive(index: number): boolean {
    return this.previewPatternPath().includes(index);
  }

  isPreviewPatternStart(index: number): boolean {
    const path = this.previewPatternPath();
    return path.length > 0 && path[0] === index;
  }

  isPreviewPatternEnd(index: number): boolean {
    const path = this.previewPatternPath();
    return path.length > 1 && path[path.length - 1] === index;
  }

  previewPatternFill(index: number): string {
    if (!this.isPreviewPatternNodeActive(index)) return '#ffffff';
    if (this.isPreviewPatternStart(index)) return '#ffffff';
    if (this.isPreviewPatternEnd(index)) return '#ffffff';
    return 'currentColor';
  }

  previewPatternStroke(index: number): string {
    if (!this.isPreviewPatternNodeActive(index)) return '#d1d5db';
    if (this.isPreviewPatternStart(index)) return '#10b981';
    if (this.isPreviewPatternEnd(index)) return '#111827';
    return 'currentColor';
  }

  isPatternNodeActive(index: number): boolean {
    return this.patternPath().includes(index);
  }

  previewPatternInnerFill(index: number): string {
    if (!this.isPreviewPatternNodeActive(index)) return '#9ca3af';
    if (this.isPreviewPatternStart(index)) return '#10b981';
    if (this.isPreviewPatternEnd(index)) return '#111827';
    return '#ffffff';
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
      assignedTo: null,
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

  editAssignedDevice(customerId: string, customerDevice: CustomerDevice): void {
    this.customerDevicesStore.setSelected(customerDevice);
    this.manageDevicesModalService.open(customerId);
  }

  prettyStatus(status: string | null | undefined): string {
    if (!status) return 'Unknown';
    return status.replaceAll('_', ' ').replace(/\b\w/g, (m) => m.toUpperCase());
  }

  formatDate(value: string | null | undefined): string {
    if (!value) return '—';
    return new Date(value).toLocaleString();
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

  @HostListener('document:click', ['$event'])
  handleClickOutside(event: Event): void {
    const target = event.target as HTMLElement;

    if (!target.closest('.status-menu-wrap')) {
      this.statusMenuOpen.set(false);
    }
  }
}