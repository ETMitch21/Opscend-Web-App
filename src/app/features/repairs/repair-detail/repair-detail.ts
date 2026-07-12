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
  Clipboard,
  ChevronDown,
  ChevronLeftIcon,
  Clock3,
  Copy,
  DollarSign,
  ExternalLink,
  Grip,
  LockKeyhole,
  LucideAngularModule,
  LucideIconData,
  MailIcon,
  MessageSquareText,
  Paperclip,
  PhoneIcon,
  RefreshCw,
  Save,
  Send,
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
  RepairMessage,
  RepairMessageVisibility,
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
import { ShopContextService } from '../../../core/shop/shop-context.store';
import { RepairNotificationService } from '../../../core/repair-notifications/repair-notification.service';
import type {
  NotificationDeliveryStatus,
  RepairNotification,
  RepairNotificationEvent,
} from '../../../core/repair-notifications/repair-notification.types';
import { RepairsService } from '../../../core/repairs/repairs-service';
import { ContractorPayoutsService } from '../../../core/contractor-payout/contractor-payouts.service';
import type { ContractorPayout } from '../../../core/contractor-payout/contractor-payout.model'; 

interface ShopListResponse {
  data: Array<{
    settings?: {
      booking?: {
        enabled?: boolean;
      };
      customerExperience?: {
        publicRepairTrackingEnabled?: boolean;
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
  private readonly shopContext = inject(ShopContextService);
  private readonly repairNotificationService = inject(RepairNotificationService);
  private readonly repairsService = inject(RepairsService);
  private readonly contractorPayoutsService = inject(ContractorPayoutsService);

  public shopCountry = 'US';

  readonly states = [
    { label: 'Alabama', value: 'AL' },
    { label: 'Alaska', value: 'AK' },
    { label: 'Arizona', value: 'AZ' },
    { label: 'Arkansas', value: 'AR' },
    { label: 'California', value: 'CA' },
    { label: 'Colorado', value: 'CO' },
    { label: 'Connecticut', value: 'CT' },
    { label: 'Delaware', value: 'DE' },
    { label: 'Florida', value: 'FL' },
    { label: 'Georgia', value: 'GA' },
    { label: 'Hawaii', value: 'HI' },
    { label: 'Idaho', value: 'ID' },
    { label: 'Illinois', value: 'IL' },
    { label: 'Indiana', value: 'IN' },
    { label: 'Iowa', value: 'IA' },
    { label: 'Kansas', value: 'KS' },
    { label: 'Kentucky', value: 'KY' },
    { label: 'Louisiana', value: 'LA' },
    { label: 'Maine', value: 'ME' },
    { label: 'Maryland', value: 'MD' },
    { label: 'Massachusetts', value: 'MA' },
    { label: 'Michigan', value: 'MI' },
    { label: 'Minnesota', value: 'MN' },
    { label: 'Mississippi', value: 'MS' },
    { label: 'Missouri', value: 'MO' },
    { label: 'Montana', value: 'MT' },
    { label: 'Nebraska', value: 'NE' },
    { label: 'Nevada', value: 'NV' },
    { label: 'New Hampshire', value: 'NH' },
    { label: 'New Jersey', value: 'NJ' },
    { label: 'New Mexico', value: 'NM' },
    { label: 'New York', value: 'NY' },
    { label: 'North Carolina', value: 'NC' },
    { label: 'North Dakota', value: 'ND' },
    { label: 'Ohio', value: 'OH' },
    { label: 'Oklahoma', value: 'OK' },
    { label: 'Oregon', value: 'OR' },
    { label: 'Pennsylvania', value: 'PA' },
    { label: 'Rhode Island', value: 'RI' },
    { label: 'South Carolina', value: 'SC' },
    { label: 'South Dakota', value: 'SD' },
    { label: 'Tennessee', value: 'TN' },
    { label: 'Texas', value: 'TX' },
    { label: 'Utah', value: 'UT' },
    { label: 'Vermont', value: 'VT' },
    { label: 'Virginia', value: 'VA' },
    { label: 'Washington', value: 'WA' },
    { label: 'West Virginia', value: 'WV' },
    { label: 'Wisconsin', value: 'WI' },
    { label: 'Wyoming', value: 'WY' },
    { label: 'District of Columbia', value: 'DC' },
    { label: 'Puerto Rico', value: 'PR' },
  ];

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
    Clipboard,
    Copy,
    DollarSign,
    ExternalLink,
    RefreshCw,
    Paperclip,
    Save,
    Send,
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
  readonly publicRepairTrackingEnabled = signal(false);
  readonly trackingActionSaving = signal(false);

  readonly repairNotifications = signal<RepairNotification[]>([]);
  readonly repairNotificationsLoading = signal(false);
  readonly repairNotificationsError = signal<string | null>(null);

  readonly repairMessages = signal<RepairMessage[]>([]);
  readonly repairMessagesLoading = signal(false);
  readonly repairMessagesError = signal<string | null>(null);
  readonly repairMessageSaving = signal(false);
  readonly repairMessageUnreadCount = signal(0);

  readonly contractorPayouts = signal<ContractorPayout[]>([]);
  readonly contractorPayoutsLoading = signal(false);
  readonly contractorPayoutsError = signal<string | null>(null);

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

  readonly patternNodes = Array.from({ length: 9 }, (_, index) => ({ index }));
  readonly previewPatternNodes = Array.from({ length: 9 }, (_, index) => ({ index }));

  readonly repair = this.store.selectedRepair;
  readonly loading = this.store.detailLoading;
  readonly saving = this.store.saving;
  readonly uploading = this.store.uploading;
  readonly error = this.store.error;

  readonly notes = this.store.selectedRepairNotes;
  readonly attachments = this.store.selectedRepairAttachments;


  readonly contractorDocumentation = computed(() => this.repair()?.documentation ?? null);

  readonly preRepairPhotos = computed(() =>
    this.attachments().filter((attachment) => this.isPreRepairPhoto(attachment))
  );

  readonly postRepairPhotos = computed(() =>
    this.attachments().filter((attachment) => this.isPostRepairPhoto(attachment))
  );

  readonly contractorSubmissionAvailable = computed(() => {
    const documentation = this.contractorDocumentation();

    return (
      !!documentation ||
      this.preRepairPhotos().length > 0 ||
      this.postRepairPhotos().length > 0
    );
  });

  readonly activeContractorPayout = computed(() => {
    const payouts = this.contractorPayouts();
    if (!payouts.length) return null;

    const statusRank: Record<string, number> = {
      pending: 0,
      approved: 1,
      paid: 2,
      disputed: 3,
    };

    return [...payouts].sort((a, b) => {
      const aRank = statusRank[a.status] ?? 99;
      const bRank = statusRank[b.status] ?? 99;

      if (aRank !== bRank) return aRank - bRank;

      return (
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    })[0] ?? null;
  });

  readonly contractorPayoutStatusText = computed(() => {
    const payout = this.activeContractorPayout();

    if (!payout) return 'No payout yet';

    return `${this.formatMoney(payout.totalCents)} • ${this.prettyPayoutStatus(payout.status)}`;
  });

  readonly sourceQuote = computed(() => this.repair()?.sourceQuote ?? null);
  readonly sourceConversation = computed(
    () => this.repair()?.communicationConversation ?? null
  );
  readonly sourceQuotePublicUrl = computed(() => {
    const token = this.sourceQuote()?.publicApprovalToken;
    if (!token) return null;

    return `${window.location.origin}/quote/${encodeURIComponent(token)}`;
  });

  readonly hasOrder = computed(() => !!this.repair()?.orderId);
  readonly hasAppointment = computed(() => !!this.repair()?.appointment);

  readonly publicTrackingUrl = computed(() => {
    const token = this.repair()?.publicTrackingToken;
    if (!token) return null;

    return `${window.location.origin}/track/${encodeURIComponent(token)}`;
  });

  readonly preferredPublicTrackingUrl = computed(() => {
    const repair = this.repair();

    return repair?.publicShortUrl || this.publicTrackingUrl();
  });

  readonly canUsePublicTracking = computed(() => {
    const repair = this.repair();

    return (
      this.publicRepairTrackingEnabled() &&
      !!repair?.publicTrackingEnabled &&
      !!repair?.publicTrackingToken
    );
  });

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
    serviceMode: ['in_shop' as 'in_shop' | 'on_site'],
    tripFeeApplied: [false],
    tripFeeDollars: [null as number | null],
  });

  readonly noteForm = this.fb.nonNullable.group({
    visibility: ['internal' as 'internal' | 'customer', Validators.required],
    body: ['', [Validators.required, Validators.maxLength(2000)]],
  });

  readonly messageForm = this.fb.nonNullable.group({
    visibility: ['customer_shop' as RepairMessageVisibility, Validators.required],
    message: ['', [Validators.required, Validators.maxLength(4000)]],
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
        serviceMode: repair.serviceMode ?? 'in_shop',
        tripFeeApplied: repair.tripFeeApplied ?? false,
        tripFeeDollars: repair.tripFeeCents != null ? repair.tripFeeCents / 100 : null,
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

    void this.loadShopCountry();

    await this.loadShopFeatureSettings();

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

    await this.loadRepairNotifications(id);
    await this.loadRepairMessages(id);
    await this.loadRepairPayouts(id);

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

  private async loadShopFeatureSettings(): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.http.get<ShopListResponse>(`${this.apiBase}/shops`)
      );

      const settings = response.data?.[0]?.settings;

      this.bookingEnabled.set(settings?.booking?.enabled === true);

      this.publicRepairTrackingEnabled.set(
        settings?.customerExperience?.publicRepairTrackingEnabled === true
      );
    } catch (error) {
      console.error('Failed to load shop feature settings.', error);
      this.bookingEnabled.set(false);
      this.publicRepairTrackingEnabled.set(false);
    }
  }

  async loadRepairNotifications(repairId = this.repairId()): Promise<void> {
    if (!repairId) return;

    this.repairNotificationsLoading.set(true);
    this.repairNotificationsError.set(null);

    try {
      const response = await firstValueFrom(
        this.repairNotificationService.listForRepair(repairId)
      );

      this.repairNotifications.set(response.data ?? []);
    } catch (error) {
      console.error('Failed to load repair notifications.', error);
      this.repairNotificationsError.set('Unable to load repair email history.');
      this.repairNotifications.set([]);
    } finally {
      this.repairNotificationsLoading.set(false);
    }
  }

  async loadRepairMessages(repairId = this.repairId()): Promise<void> {
    if (!repairId) return;

    this.repairMessagesLoading.set(true);
    this.repairMessagesError.set(null);

    try {
      const response = await firstValueFrom(
        this.repairsService.listRepairMessages(repairId)
      );

      this.repairMessages.set(response.messages ?? []);

      await this.markRepairMessagesRead(repairId);
      await this.loadRepairMessageUnreadCount(repairId);
    } catch (error) {
      console.error('Failed to load repair messages.', error);
      this.repairMessagesError.set('Unable to load repair messages.');
      this.repairMessages.set([]);
    } finally {
      this.repairMessagesLoading.set(false);
    }
  }

  async loadRepairMessageUnreadCount(repairId = this.repairId()): Promise<void> {
    if (!repairId) return;

    try {
      const response = await firstValueFrom(
        this.repairsService.getRepairMessageUnreadCount(repairId)
      );

      this.repairMessageUnreadCount.set(response.unreadCount ?? 0);
    } catch (error) {
      console.error('Failed to load repair message unread count.', error);
      this.repairMessageUnreadCount.set(0);
    }
  }

  async loadRepairPayouts(repairId = this.repairId()): Promise<void> {
    if (!repairId) return;

    this.contractorPayoutsLoading.set(true);
    this.contractorPayoutsError.set(null);

    try {
      const payouts = await firstValueFrom(this.contractorPayoutsService.list());

      this.contractorPayouts.set(
        (payouts ?? []).filter((payout) => payout.repairId === repairId)
      );
    } catch (error) {
      console.error('Failed to load contractor payout status.', error);
      this.contractorPayoutsError.set('Unable to load contractor payout status.');
      this.contractorPayouts.set([]);
    } finally {
      this.contractorPayoutsLoading.set(false);
    }
  }

  async markRepairMessagesRead(repairId = this.repairId()): Promise<void> {
    if (!repairId) return;

    try {
      await firstValueFrom(this.repairsService.markRepairMessagesRead(repairId));
      this.repairMessageUnreadCount.set(0);
    } catch (error) {
      console.error('Failed to mark repair messages read.', error);
    }
  }

  async sendRepairMessage(): Promise<void> {
    const repairId = this.repairId();

    if (!repairId || this.messageForm.invalid) {
      this.messageForm.markAllAsTouched();
      return;
    }

    const value = this.messageForm.getRawValue();
    const message = value.message.trim();

    if (!message) {
      this.messageForm.controls.message.setValue('');
      this.messageForm.markAllAsTouched();
      return;
    }

    this.repairMessageSaving.set(true);

    try {
      await firstValueFrom(
        this.repairsService.createRepairMessage(repairId, {
          visibility: value.visibility,
          message,
        })
      );

      this.messageForm.controls.message.setValue('');
      await this.loadRepairMessages(repairId);
      this.toast.success('Message sent', 'The repair message was added.');
    } catch (error) {
      console.error('Failed to send repair message.', error);
      this.toast.error('Message not sent', 'Unable to send this repair message.');
    } finally {
      this.repairMessageSaving.set(false);
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

    payload.serviceMode = value.serviceMode;

    if (value.serviceMode === 'in_shop') {
      payload.serviceAddressId = null;
      payload.tripFeeApplied = false;
      payload.tripFeeCents = null;
    } else {
      payload.serviceAddressId = this.repair()?.serviceAddressId ?? null;
      payload.tripFeeApplied = !!value.tripFeeApplied;
      payload.tripFeeCents = value.tripFeeApplied
        ? Math.round(Number(value.tripFeeDollars ?? 0) * 100)
        : null;
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
      await this.loadRepairNotifications(id);
      await this.loadRepairMessages(id);
      await this.loadRepairPayouts(id);
      this.toast.success('Repair updated', 'Changes saved successfully.');
    } else {
      this.toast.error(
        'Save failed',
        this.error() ?? 'Unable to update repair.'
      );
    }
  }

  async togglePublicTrackingForRepair(enabled: boolean): Promise<void> {
    const id = this.repairId();
    if (!id) return;

    this.trackingActionSaving.set(true);

    try {
      const updated = await this.store.updateRepairTrackingEnabled(id, enabled);

      if (!updated) {
        this.toast.error(
          'Tracking update failed',
          this.error() ?? 'Unable to update repair tracking.'
        );
        return;
      }

      this.toast.success(
        enabled ? 'Tracking enabled' : 'Tracking disabled',
        enabled
          ? 'Customers can view this repair with the public tracking link.'
          : 'The public tracking link no longer works for this repair.'
      );
    } finally {
      this.trackingActionSaving.set(false);
    }
  }

  async regeneratePublicTrackingLink(): Promise<void> {
    const id = this.repairId();
    if (!id) return;

    this.trackingActionSaving.set(true);

    try {
      const updated = await this.store.regeneratePublicTrackingToken(id);

      if (!updated) {
        this.toast.error(
          'Link failed',
          this.error() ?? 'Unable to regenerate the public tracking link.'
        );
        return;
      }

      this.toast.success(
        'Tracking link regenerated',
        'The previous public tracking link no longer works.'
      );
    } finally {
      this.trackingActionSaving.set(false);
    }
  }

  async generatePublicShortTrackingLink(): Promise<void> {
    const id = this.repairId();

    if (!id) return;

    if (!this.canUsePublicTracking()) {
      this.toast.error(
        'Tracking link unavailable',
        'Enable public tracking for this shop and repair first.'
      );
      return;
    }

    this.trackingActionSaving.set(true);

    try {
      const updated = await this.store.createPublicShortTrackingLink(id);

      if (!updated?.publicShortUrl) {
        this.toast.error(
          'Short link failed',
          this.error() ?? 'Unable to generate the short tracking link.'
        );
        return;
      }

      this.toast.success(
        'Short link ready',
        'The short tracking link is now available for this repair.'
      );
    } finally {
      this.trackingActionSaving.set(false);
    }
  }

  async copyPublicTrackingLink(): Promise<void> {
    const url = this.preferredPublicTrackingUrl();

    if (!url || !this.canUsePublicTracking()) {
      this.toast.error(
        'Tracking link unavailable',
        'Public tracking must be enabled for this shop and repair first.'
      );
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      this.toast.success(
        'Copied',
        this.repair()?.publicShortUrl
          ? 'Short tracking link copied to clipboard.'
          : 'Public tracking link copied to clipboard.'
      );
    } catch {
      this.toast.error(
        'Copy failed',
        'Your browser blocked clipboard access. Open the link and copy it manually.'
      );
    }
  }

  openPublicTrackingLink(): void {
    const url = this.preferredPublicTrackingUrl();

    if (!url || !this.canUsePublicTracking()) return;

    window.open(url, '_blank', 'noopener,noreferrer');
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
      await this.loadRepairNotifications(id);
      await this.loadRepairMessages(id);

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


  private isPreRepairPhoto(attachment: RepairAttachment): boolean {
    if (attachment.type === 'pre_repair_photo') return true;

    const filename = attachment.filename?.toLowerCase() ?? '';
    return filename.includes('pre') && this.isImageAttachment(attachment);
  }

  private isPostRepairPhoto(attachment: RepairAttachment): boolean {
    if (attachment.type === 'post_repair_photo') return true;

    const filename = attachment.filename?.toLowerCase() ?? '';
    return (filename.includes('post') || filename.includes('complete')) && this.isImageAttachment(attachment);
  }

  isImageAttachment(attachment: RepairAttachment): boolean {
    return (attachment.mimeType ?? '').toLowerCase().startsWith('image/');
  }

  formatBatteryHealth(value: number | null | undefined): string {
    if (value == null || Number.isNaN(Number(value))) return 'Not provided';
    return `${Number(value)}%`;
  }

  documentationValue(value: string | number | null | undefined): string {
    if (value == null || value === '') return 'Not provided';
    return String(value);
  }

  signatureStatus(value: string | null | undefined): string {
    return value ? 'Captured' : 'Missing';
  }

  signatureStatusClasses(value: string | null | undefined): string {
    return value
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : 'border-gray-200 bg-gray-50 text-gray-500';
  }

  openAssignModal(): void {
    const repair = this.repair();

    if (!repair) return;

    if (!this.bookingEnabled()) {
      this.toast.error(
        'Scheduling disabled',
        'Provider assignment should be managed through scheduling, but booking is currently disabled.'
      );
      return;
    }

    if (repair.status === 'picked_up' || repair.status === 'canceled') {
      this.toast.error(
        'Assignment locked',
        'This repair is closed and can no longer be reassigned.'
      );
      return;
    }

    if (repair.dispatchType === 'contractor') {
      this.toast.error(
        'Use reschedule',
        'Contractor assignment is tied to availability and appointment time. Choose a new appointment slot to reassign this repair.'
      );

      this.openRescheduleModal();
      return;
    }

    if (repair.appointment) {
      this.toast.error(
        'Use reschedule',
        'Provider changes must respect availability. Choose an available appointment slot to change the provider.'
      );

      this.openRescheduleModal();
      return;
    }

    this.openRescheduleModal();
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

    const appointmentAssignedUserId =
      repair.appointment?.assignedUserId ??
      repair.appointment?.technicianUserId ??
      null;

    const assignedUserId = this.isSchedulableUserId(appointmentAssignedUserId)
      ? appointmentAssignedUserId
      : undefined;

    const serviceAddress =
      repair.serviceMode === 'on_site' &&
        repair.serviceAddressLine1 &&
        repair.serviceAddressCity &&
        repair.serviceAddressState &&
        repair.serviceAddressPostalCode
        ? {
          line1: repair.serviceAddressLine1,
          line2: repair.serviceAddressLine2,
          city: repair.serviceAddressCity,
          state: repair.serviceAddressState,
          postalCode: repair.serviceAddressPostalCode,
          country: repair.serviceAddressCountry ?? 'US',
          geo: null,
        }
        : null;

    return {
      title: repair.appointment ? 'Reschedule / Reassign Appointment' : 'Schedule / Assign Appointment',
      subtitle: repair.appointment
        ? 'Choose an available time and provider for this repair.'
        : 'Choose an available appointment time.',
      from: this.schedulerFromIso(),
      to: this.schedulerToIso(),
      durationMinutes: this.selectedDurationMinutes(),
      repairId,
      assignedUserId,
      slotMinutes: 15,
      serviceMode: repair.serviceMode,
      serviceAddressId: repair.serviceAddressId ?? null,
      serviceAddress,
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
      ? await this.appointmentsStore.rescheduleAppointment({
        repairId: id,
        startAt: selection.startAt,
        endAt: selection.endAt,
        candidateType: selection.candidateType,
        assignedUserId:
          selection.candidateType === 'internal'
            ? selection.assignedUserId ?? undefined
            : undefined,
        contractorId:
          selection.candidateType === 'contractor'
            ? selection.contractorId ?? undefined
            : undefined,
      })
      : await this.appointmentsStore.scheduleAppointment({
        repairId: id,
        startAt: selection.startAt,
        endAt: selection.endAt,
        candidateType: selection.candidateType,
        assignedUserId:
          selection.candidateType === 'internal'
            ? selection.assignedUserId ?? undefined
            : undefined,
        contractorId:
          selection.candidateType === 'contractor'
            ? selection.contractorId ?? undefined
            : undefined,
      });

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
    await this.loadRepairNotifications(id);
    await this.loadRepairMessages(id);
    await this.loadRepairPayouts(id);
    await this.loadRepairPayouts(id);

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

  prettyPayoutStatus(status: string | null | undefined): string {
    switch (status) {
      case 'pending':
        return 'Pending Review';
      case 'approved':
        return 'Approved';
      case 'paid':
        return 'Paid';
      case 'disputed':
        return 'Disputed';
      default:
        return 'No Payout';
    }
  }

  payoutStatusClasses(status: string | null | undefined): string {
    switch (status) {
      case 'pending':
        return 'border-amber-200 bg-amber-50 text-amber-700';
      case 'approved':
        return 'border-blue-200 bg-blue-50 text-blue-700';
      case 'paid':
        return 'border-emerald-200 bg-emerald-50 text-emerald-700';
      case 'disputed':
        return 'border-rose-200 bg-rose-50 text-rose-700';
      default:
        return 'border-gray-200 bg-gray-50 text-gray-500';
    }
  }

  openContractorPayouts(): void {
    const payout = this.activeContractorPayout();

    void this.router.navigate(['/contractor-payouts'], {
      queryParams: payout?.repairId ? { repairId: payout.repairId } : undefined,
    });
  }


  openSourceQuote(): void {
    const quote = this.sourceQuote();
    if (!quote) return;

    void this.router.navigate(['/quote-requests'], {
      queryParams: { quoteRequestId: quote.id },
    });
  }

  openSourceConversation(): void {
    const conversation = this.sourceConversation();
    if (!conversation) return;

    void this.router.navigate(['/communications'], {
      queryParams: { conversationId: conversation.id },
    });
  }

  openSourceQuotePublicLink(): void {
    const url = this.sourceQuotePublicUrl();
    if (!url) return;

    window.open(url, '_blank', 'noopener,noreferrer');
  }

  async copySourceQuotePublicLink(): Promise<void> {
    const url = this.sourceQuotePublicUrl();
    if (!url) {
      this.toast.error('Quote link unavailable', 'This quote does not have a public approval link.');
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      this.toast.success('Quote link copied', 'The original quote approval link was copied.');
    } catch {
      this.toast.error('Copy failed', 'Your browser blocked clipboard access.');
    }
  }

  prettyQuoteStatus(status: string | null | undefined): string {
    if (!status) return 'Unknown';
    return status.replaceAll('_', ' ').replace(/\b\w/g, (m) => m.toUpperCase());
  }

  quoteStatusPillClasses(status: string | null | undefined): string {
    switch (status) {
      case 'converted':
      case 'deposit_paid':
      case 'accepted':
        return 'border-emerald-200 bg-emerald-50 text-emerald-700';
      case 'deposit_pending':
      case 'sent':
        return 'border-sky-200 bg-sky-50 text-sky-700';
      case 'declined':
      case 'canceled':
        return 'border-rose-200 bg-rose-50 text-rose-700';
      default:
        return 'border-gray-200 bg-gray-50 text-gray-600';
    }
  }

  sourceQuoteDepositLabel(): string {
    const quote = this.sourceQuote();
    if (!quote) return '—';
    if (!quote.depositRequired) return 'Not required';
    if (quote.depositPaidAt) return `Paid ${this.formatMoney(quote.depositPaidAmountCents ?? quote.depositAmountCents)}`;
    return `Required ${this.formatMoney(quote.depositAmountCents)}`;
  }

  prettyStatus(status: string | null | undefined): string {
    if (!status) return 'Unknown';
    return status.replaceAll('_', ' ').replace(/\b\w/g, (m) => m.toUpperCase());
  }

  statusPillClasses(status: RepairStatus | string | null | undefined): string {
    switch (status) {
      case 'intake':
      case 'awaiting_parts':
      case 'documentation_pending':
        return 'bg-amber-50 text-amber-700';

      case 'scheduled':
      case 'diagnosing':
        return 'bg-blue-50 text-blue-700';

      case 'needs_reassignment':
        return 'bg-orange-50 text-orange-700';

      case 'customer_verified':
        return 'bg-teal-50 text-teal-700';

      case 'awaiting_approval':
        return 'bg-indigo-50 text-indigo-700';

      case 'in_repair':
        return 'bg-cyan-50 text-cyan-700';

      case 'qc':
        return 'bg-violet-50 text-violet-700';

      case 'ready':
        return 'bg-purple-50 text-purple-700';

      case 'picked_up':
        return 'bg-emerald-50 text-emerald-700';

      case 'canceled':
        return 'bg-rose-50 text-rose-700';

      default:
        return 'bg-gray-50 text-gray-600';
    }
  }

  prettyNotificationEvent(event: RepairNotificationEvent): string {
    switch (event) {
      case 'repair_created':
        return 'Repair Created';
      case 'repair_scheduled':
        return 'Appointment Scheduled';
      case 'repair_status_changed':
        return 'Status Updated';
      case 'repair_awaiting_approval':
        return 'Awaiting Approval';
      case 'repair_awaiting_parts':
        return 'Awaiting Parts';
      case 'repair_ready':
        return 'Repair Ready';
      case 'repair_completed':
        return 'Repair Completed';
      case 'repair_canceled':
        return 'Repair Canceled';
      default:
        return this.prettyStatus(event);
    }
  }

  prettyNotificationStatus(status: NotificationDeliveryStatus): string {
    switch (status) {
      case 'queued':
        return 'Queued';
      case 'sent':
        return 'Sent';
      case 'failed':
        return 'Failed';
      case 'skipped':
        return 'Skipped';
      default:
        return this.prettyStatus(status);
    }
  }

  notificationStatusClasses(status: NotificationDeliveryStatus): string {
    switch (status) {
      case 'sent':
        return 'border-emerald-200 bg-emerald-50 text-emerald-700';
      case 'failed':
        return 'border-rose-200 bg-rose-50 text-rose-700';
      case 'skipped':
        return 'border-amber-200 bg-amber-50 text-amber-700';
      case 'queued':
        return 'border-blue-200 bg-blue-50 text-blue-700';
      default:
        return 'border-gray-200 bg-gray-50 text-gray-600';
    }
  }

  notificationStatusDotClasses(status: NotificationDeliveryStatus): string {
    switch (status) {
      case 'sent':
        return 'bg-emerald-500';
      case 'failed':
        return 'bg-rose-500';
      case 'skipped':
        return 'bg-amber-500';
      case 'queued':
        return 'bg-blue-500';
      default:
        return 'bg-gray-400';
    }
  }

  formatDate(value: string | null | undefined): string {
    if (!value) return '—';
    return new Date(value).toLocaleString();
  }

  formatMoney(cents: number | null | undefined): string {
    const value = Number(cents ?? 0) / 100;
    return value.toLocaleString(undefined, {
      style: 'currency',
      currency: 'USD',
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

  prettyMessageRole(role: string | null | undefined): string {
    switch (role) {
      case 'admin':
        return 'Shop';
      case 'contractor':
        return 'Contractor';
      case 'customer':
        return 'Customer';
      case 'system':
        return 'System';
      default:
        return 'Message';
    }
  }

  messageRoleClasses(role: string | null | undefined): string {
    switch (role) {
      case 'admin':
        return 'bg-gray-900 text-white';
      case 'contractor':
        return 'bg-orange-100 text-orange-700';
      case 'customer':
        return 'bg-blue-100 text-blue-700';
      case 'system':
        return 'bg-gray-200 text-gray-700';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  }

  prettyMessageVisibility(visibility: string | null | undefined): string {
    switch (visibility) {
      case 'customer_contractor':
        return 'Customer ↔ Contractor';
      case 'customer_shop':
        return 'Customer ↔ Shop';
      case 'contractor_shop':
        return 'Contractor ↔ Shop';
      case 'internal':
        return 'Internal';
      default:
        return 'Message';
    }
  }

  messageVisibilityClasses(visibility: string | null | undefined): string {
    switch (visibility) {
      case 'customer_contractor':
        return 'border-purple-200 bg-purple-50 text-purple-700';
      case 'customer_shop':
        return 'border-blue-200 bg-blue-50 text-blue-700';
      case 'contractor_shop':
        return 'border-orange-200 bg-orange-50 text-orange-700';
      case 'internal':
        return 'border-gray-200 bg-gray-100 text-gray-700';
      default:
        return 'border-gray-200 bg-white text-gray-600';
    }
  }

  messageReadReceipt(message: RepairMessage): string | null {
    if (message.role !== 'admin') return null;

    const receipts: string[] = [];

    if (
      (message.visibility === 'customer_shop' ||
        message.visibility === 'customer_contractor') &&
      message.readByCustomerAt
    ) {
      receipts.push('Customer read');
    }

    if (
      (message.visibility === 'contractor_shop' ||
        message.visibility === 'customer_contractor') &&
      message.readByContractorAt
    ) {
      receipts.push('Contractor read');
    }

    return receipts.length ? receipts.join(' • ') : null;
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

  private async loadShopCountry(): Promise<void> {
    const shop = await firstValueFrom(this.shopContext.load());
    this.shopCountry = shop?.address?.country || shop?.locale?.country || 'US';
  }

  prettyDispatchType(dispatchType: string | null | undefined): string {
    switch (dispatchType) {
      case 'internal':
        return 'Internal';
      case 'contractor':
        return 'Contractor';
      case 'unassigned':
        return 'Unassigned';
      default:
        return 'Unassigned';
    }
  }

  dispatchPillClasses(dispatchType: string | null | undefined): string {
    switch (dispatchType) {
      case 'internal':
        return 'bg-blue-50 text-blue-700';
      case 'contractor':
        return 'bg-orange-50 text-orange-700';
      case 'unassigned':
        return 'bg-gray-50 text-gray-500';
      default:
        return 'bg-gray-50 text-gray-500';
    }
  }

  @HostListener('document:click', ['$event'])
  handleClickOutside(event: Event): void {
    const target = event.target as HTMLElement;

    if (!target.closest('.status-menu-wrap')) {
      this.statusMenuOpen.set(false);
    }
  }
}