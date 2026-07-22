import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, filter, map, distinctUntilChanged, firstValueFrom, merge } from 'rxjs';
import {
  Activity,
  AlertTriangle,
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Clock3,
  ExternalLink,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Plus,
  ReceiptText,
  Settings,
  Smartphone,
  UserRound,
  Wrench,
  Search,
  RotateCcw,
  Loader2,
  LucideAngularModule,
} from 'lucide-angular';

import { CustomersStore } from '../../../core/customers/customers.store';
import {
  Customer,
  CustomerAddress,
  CreateCustomerAddressRequest,
  UpdateCustomerAddressRequest,
  GeoPoint,
  CustomerContactConflict,
} from '../../../core/customers/customer.model';
import { ToastService } from '../../../core/toast/toast-service';
import { CustomerDevicesStore } from '../../../core/customer-devices/customer-devices.store';
import { CustomerDevice } from '../../../core/customer-devices/customer-device.model';
import { ManageDevicesModalService } from '../../../components/modals/manage-devices-modal-component/manage-devices-modal-service';
import { ShopContextService } from '../../../core/shop/shop-context.store';
import { RepairsService } from '../../../core/repairs/repairs-service';
import { Repair, RepairListResponse, RepairStatus } from '../../../core/repairs/repair.model';
import { BookingAdminService } from '../../../core/booking/service';
import { BookingQuoteRequest, BookingQuoteRequestsResponse, BookingQuoteWorkflowStatus } from '../../../core/booking/model';
import { OrdersService } from '../../../core/orders/orders-service';
import { FulfillmentStatus, Order, OrderListResponse, PaymentStatus } from '../../../core/orders/orders-model';
import { CommunicationService } from '../../../core/communications/service';
import {
  CommunicationChannel,
  CommunicationDirection,
  CustomerCommunicationActivityItem,
  CustomerCommunicationSummary,
} from '../../../core/communications/model';
import {
  CustomerWorkspace,
  CustomerWorkspaceOpenItem,
  CustomerWorkspaceOrderSummary,
  CustomerWorkspaceQuoteSummary,
  CustomerWorkspaceRepairSummary,
  CustomerWorkspaceTimelineItem,
  CustomerWorkspaceTimelineType,
  CustomerWorkspaceTone,
} from '../../../core/customers/customer-workspace.model';

type CustomerWorkspaceTab =
  | 'overview'
  | 'timeline'
  | 'repairs'
  | 'quotes'
  | 'orders'
  | 'devices'
  | 'addresses'
  | 'settings';

type CustomerTimelineFilter = 'all' | CustomerWorkspaceTimelineType;
type CustomerHistoryDateFilter = 'all' | '30d' | '90d' | 'year';
type RepairHistoryStatusFilter = 'all' | 'open' | RepairStatus;
type QuoteHistoryStatusFilter = 'all' | 'active' | BookingQuoteWorkflowStatus;
type OrderPaymentStatusFilter = 'all' | PaymentStatus;
type OrderFulfillmentStatusFilter = 'all' | FulfillmentStatus;


type CustomerFlagKey =
  | 'vip'
  | 'warranty-concern'
  | 'payment-issue'
  | 'communication-preference'
  | 'do-not-sms'
  | 'follow-up';

type CustomerFlagTone =
  | 'brand'
  | 'info'
  | 'success'
  | 'warning'
  | 'danger'
  | 'neutral';

interface CustomerQuickFlag {
  key: CustomerFlagKey;
  label: string;
  description: string;
  tone: CustomerFlagTone;
}

interface CustomerWorkspaceViewState {
  version: 1;
  activeTab: CustomerWorkspaceTab;
  timelineFilter: CustomerTimelineFilter;
  repairHistorySearch: string;
  repairHistoryStatus: RepairHistoryStatusFilter;
  repairHistoryDate: CustomerHistoryDateFilter;
  quoteHistorySearch: string;
  quoteHistoryStatus: QuoteHistoryStatusFilter;
  quoteHistoryDate: CustomerHistoryDateFilter;
  orderHistorySearch: string;
  orderPaymentStatus: OrderPaymentStatusFilter;
  orderFulfillmentStatus: OrderFulfillmentStatusFilter;
  orderHistoryDate: CustomerHistoryDateFilter;
}

type EditCustomerForm = FormGroup<{
  name: FormControl<string>;
  email: FormControl<string>;
  phone: FormControl<string>;
  tags: FormControl<string>;
  notes: FormControl<string>;
}>;

type AddressForm = FormGroup<{
  label: FormControl<string>;
  line1: FormControl<string>;
  line2: FormControl<string>;
  city: FormControl<string>;
  state: FormControl<string>;
  postalCode: FormControl<string>;
  country: FormControl<string>;
  geo: FormControl<GeoPoint | null>;
  notes: FormControl<string>;
  isDefault: FormControl<boolean>;
}>;

@Component({
  selector: 'app-edit-customer',
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
    LucideAngularModule,
  ],
  templateUrl: './edit-customer.html',
  styleUrl: './edit-customer.scss',
})
export class EditCustomer implements OnInit {
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly store = inject(CustomersStore);
  private readonly customerDevicesStore = inject(CustomerDevicesStore);
  private readonly deviceModalService = inject(ManageDevicesModalService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly shopContext = inject(ShopContextService);
  private readonly repairsService = inject(RepairsService);
  private readonly bookingAdminService = inject(BookingAdminService);
  private readonly ordersService = inject(OrdersService);
  private readonly communicationService = inject(CommunicationService);

  public readonly leftChevronIcon = ArrowLeft;
  public readonly userIcon = UserRound;
  public readonly phoneIcon = Phone;
  public readonly mailIcon = Mail;
  public readonly messageIcon = MessageSquare;
  public readonly repairIcon = Wrench;
  public readonly deviceIcon = Smartphone;
  public readonly addressIcon = MapPin;
  public readonly settingsIcon = Settings;
  public readonly activityIcon = Activity;
  public readonly quoteIcon = ClipboardList;
  public readonly orderIcon = ReceiptText;
  public readonly plusIcon = Plus;
  public readonly externalLinkIcon = ExternalLink;
  public readonly chevronRightIcon = ChevronRight;
  public readonly calendarIcon = CalendarDays;
  public readonly revenueIcon = CircleDollarSign;
  public readonly clockIcon = Clock3;
  public readonly searchIcon = Search;
  public readonly resetIcon = RotateCcw;
  public readonly loaderIcon = Loader2;
  public readonly alertIcon = AlertTriangle;
  public readonly inboundIcon = ArrowDownLeft;
  public readonly outboundIcon = ArrowUpRight;

  public customer: Customer | null = null;
  public workspace: CustomerWorkspace | null = null;
  public loadingWorkspace = true;
  public activeTab: CustomerWorkspaceTab = 'overview';
  public timelineFilter: CustomerTimelineFilter = 'all';

  public communicationSummary: CustomerCommunicationSummary | null = null;
  public communicationSummaryLoading = false;
  public communicationSummaryError: string | null = null;


  private readonly importantNoteTag = 'important-note';
  private activeCustomerId: string | null = null;
  private suppressInitialEmptyTabForCustomerId: string | null = null;

  public internalNotesDraft = '';
  public internalNotesEditing = false;
  public internalNotesWorking = false;
  public customerFlagsWorking = false;
  public pinInternalNoteAsAlert = false;

  public readonly quickFlags: CustomerQuickFlag[] = [
    {
      key: 'vip',
      label: 'VIP',
      description: 'High-priority customer',
      tone: 'success',
    },
    {
      key: 'warranty-concern',
      label: 'Warranty concern',
      description: 'Review warranty context before service',
      tone: 'warning',
    },
    {
      key: 'payment-issue',
      label: 'Payment issue',
      description: 'Review payment status before proceeding',
      tone: 'danger',
    },
    {
      key: 'communication-preference',
      label: 'Communication preference',
      description: 'Check the customer note for contact preferences',
      tone: 'info',
    },
    {
      key: 'do-not-sms',
      label: 'Do not SMS',
      description: 'Default customer communication to email',
      tone: 'danger',
    },
    {
      key: 'follow-up',
      label: 'Follow up',
      description: 'Customer needs a follow-up',
      tone: 'brand',
    },
  ];

  public repairHistory: Repair[] = [];
  public quoteHistory: BookingQuoteRequest[] = [];
  public orderHistory: Order[] = [];

  public repairHistoryLoading = false;
  public quoteHistoryLoading = false;
  public orderHistoryLoading = false;

  public repairHistoryLoaded = false;
  public quoteHistoryLoaded = false;
  public orderHistoryLoaded = false;

  public repairHistoryError: string | null = null;
  public quoteHistoryError: string | null = null;
  public orderHistoryError: string | null = null;

  public repairHistorySearch = '';
  public quoteHistorySearch = '';
  public orderHistorySearch = '';

  public repairHistoryStatus: RepairHistoryStatusFilter = 'all';
  public quoteHistoryStatus: QuoteHistoryStatusFilter = 'all';
  public orderPaymentStatus: OrderPaymentStatusFilter = 'all';
  public orderFulfillmentStatus: OrderFulfillmentStatusFilter = 'all';

  public repairHistoryDate: CustomerHistoryDateFilter = 'all';
  public quoteHistoryDate: CustomerHistoryDateFilter = 'all';
  public orderHistoryDate: CustomerHistoryDateFilter = 'all';

  public readonly historyDateOptions: Array<{ key: CustomerHistoryDateFilter; label: string }> = [
    { key: 'all', label: 'All time' },
    { key: '30d', label: 'Last 30 days' },
    { key: '90d', label: 'Last 90 days' },
    { key: 'year', label: 'Last year' },
  ];

  public readonly repairStatusOptions: Array<{ key: RepairHistoryStatusFilter; label: string }> = [
    { key: 'all', label: 'All statuses' },
    { key: 'open', label: 'All open repairs' },
    { key: 'intake', label: 'Intake' },
    { key: 'scheduled', label: 'Scheduled' },
    { key: 'diagnosing', label: 'Diagnosing' },
    { key: 'awaiting_approval', label: 'Awaiting approval' },
    { key: 'awaiting_parts', label: 'Awaiting parts' },
    { key: 'in_repair', label: 'In repair' },
    { key: 'qc', label: 'Quality check' },
    { key: 'ready', label: 'Ready' },
    { key: 'picked_up', label: 'Picked up' },
    { key: 'canceled', label: 'Canceled' },
  ];

  public readonly quoteStatusOptions: Array<{ key: QuoteHistoryStatusFilter; label: string }> = [
    { key: 'all', label: 'All statuses' },
    { key: 'active', label: 'Active quotes' },
    { key: 'draft', label: 'Draft' },
    { key: 'quote_requested', label: 'Requested' },
    { key: 'quoted', label: 'Quoted' },
    { key: 'sent', label: 'Sent' },
    { key: 'accepted', label: 'Accepted' },
    { key: 'declined', label: 'Declined' },
    { key: 'deposit_pending', label: 'Deposit pending' },
    { key: 'deposit_paid', label: 'Deposit paid' },
    { key: 'scheduled', label: 'Scheduled' },
    { key: 'converted', label: 'Converted' },
    { key: 'expired', label: 'Expired' },
    { key: 'canceled', label: 'Canceled' },
  ];

  public readonly orderPaymentStatusOptions: Array<{ key: OrderPaymentStatusFilter; label: string }> = [
    { key: 'all', label: 'All payment statuses' },
    { key: 'unpaid', label: 'Unpaid' },
    { key: 'paid', label: 'Paid' },
    { key: 'refunded', label: 'Refunded' },
    { key: 'voided', label: 'Voided' },
  ];

  public readonly orderFulfillmentStatusOptions: Array<{ key: OrderFulfillmentStatusFilter; label: string }> = [
    { key: 'all', label: 'All fulfillment' },
    { key: 'unfulfilled', label: 'Unfulfilled' },
    { key: 'fulfilled', label: 'Fulfilled' },
  ];

  public readonly timelineFilters: Array<{
    key: CustomerTimelineFilter;
    label: string;
  }> = [
    { key: 'all', label: 'All activity' },
    { key: 'repair', label: 'Repairs' },
    { key: 'quote', label: 'Quotes' },
    { key: 'order', label: 'Orders' },
    { key: 'communication', label: 'Messages' },
    { key: 'customer', label: 'Customer' },
  ];

  public readonly tabs: Array<{
    key: CustomerWorkspaceTab;
    label: string;
    icon: any;
  }> = [
    { key: 'overview', label: 'Overview', icon: this.userIcon },
    { key: 'timeline', label: 'Timeline', icon: this.activityIcon },
    { key: 'repairs', label: 'Repairs', icon: this.repairIcon },
    { key: 'quotes', label: 'Quotes', icon: this.quoteIcon },
    { key: 'orders', label: 'Orders', icon: this.orderIcon },
    { key: 'devices', label: 'Devices', icon: this.deviceIcon },
    { key: 'addresses', label: 'Addresses', icon: this.addressIcon },
    { key: 'settings', label: 'Settings', icon: this.settingsIcon },
  ];
  public customerDevices: CustomerDevice[] = [];
  public addresses: CustomerAddress[] = [];
  public working = false;
  public customerIdentityChecking = false;
  public customerIdentityConflicts: CustomerContactConflict[] = [];

  public addressModalOpen = false;
  public editingAddress: CustomerAddress | null = null;
  public addressWorking = false;

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

  public readonly editCustomerForm: EditCustomerForm = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2)],
    }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    phone: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(10), Validators.maxLength(10)],
    }),
    tags: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(650)],
    }),
    notes: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(2000)],
    }),
  });

  public readonly addressForm: AddressForm = new FormGroup({
    label: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(80)],
    }),
    line1: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(120)],
    }),
    line2: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(120)],
    }),
    city: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(80)],
    }),
    state: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(80)],
    }),
    postalCode: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(20)],
    }),
    country: new FormControl('US', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(2)],
    }),
    geo: new FormControl<GeoPoint | null>(null),
    notes: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(500)],
    }),
    isDefault: new FormControl(false, {
      nonNullable: true,
    }),
  });

  ngOnInit(): void {
    void this.loadShopCountry();
    this.route.paramMap
      .pipe(
        map((params) => params.get('id')),
        filter((id): id is string => !!id),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((id) => {
        this.activeCustomerId = id;
        const requestedTab = this.route.snapshot.queryParamMap.get('tab');
        this.suppressInitialEmptyTabForCustomerId = requestedTab ? null : id;
        this.restoreWorkspaceViewState(
          id,
          this.isWorkspaceTab(requestedTab) ? requestedTab : null,
        );
        void this.loadCustomer(id);
      });

    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        if (!this.activeCustomerId) return;

        const requestedTab = params.get('tab');

        if (
          !requestedTab &&
          this.suppressInitialEmptyTabForCustomerId === this.activeCustomerId
        ) {
          this.suppressInitialEmptyTabForCustomerId = null;
          return;
        }

        this.suppressInitialEmptyTabForCustomerId = null;
        const tab: CustomerWorkspaceTab = this.isWorkspaceTab(requestedTab)
          ? requestedTab
          : 'overview';

        if (this.activeTab !== tab) {
          this.activeTab = tab;
          this.persistWorkspaceViewState();
          void this.ensureHistoryLoaded(tab);
        }
      });

    this.deviceModalService.modalClosed$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        void Promise.all([this.loadDevices(), this.reloadWorkspace()]);
      });

    merge(
      this.editCustomerForm.controls.email.valueChanges,
      this.editCustomerForm.controls.phone.valueChanges,
    )
      .pipe(debounceTime(350), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        void this.checkCustomerIdentity();
      });
  }

  private async loadShopCountry(): Promise<void> {
    const shop = await firstValueFrom(this.shopContext.load());
    this.shopCountry = shop?.address?.country || shop?.locale?.country || 'US';

    this.addressForm.patchValue({
      country: this.shopCountry,
    });
  }

  private async loadCustomer(id: string): Promise<void> {
    this.loadingWorkspace = true;
    this.resetHistoryState();
    this.communicationSummary = null;
    this.communicationSummaryError = null;

    try {
      this.workspace = await this.store.loadWorkspace(id);
      this.customer = this.workspace?.customer ?? null;

      if (!this.customer) {
        this.toast.error('Customer not found', 'A customer with that ID does not exist.');
        void this.router.navigate(['customers', 'overview']);
        return;
      }

      this.syncCustomerEditorState(this.customer);

      await Promise.all([
        this.loadDevices(),
        this.loadAddresses(),
        this.loadCommunicationSummary(),
      ]);

      await this.checkCustomerIdentity();
      await this.ensureHistoryLoaded(this.activeTab);
    } finally {
      this.loadingWorkspace = false;
    }
  }

  private async reloadWorkspace(): Promise<void> {
    if (!this.customer) return;

    const workspace = await this.store.loadWorkspace(this.customer.id);
    if (!workspace) return;

    this.workspace = workspace;
    this.customer = workspace.customer;
    this.syncCustomerEditorState(workspace.customer, false);
  }

  private async loadDevices(): Promise<void> {
    if (!this.customer) return;

    try {
      await this.customerDevicesStore.load(this.customer.id);
      this.customerDevices = this.customerDevicesStore.items() ?? [];
    } catch {
      this.toast.error(
        'Failed to load devices',
        'Unable to load customer devices. Please try again by refreshing the page.'
      );
    }
  }

  private async loadAddresses(): Promise<void> {
    if (!this.customer) return;

    try {
      this.addresses = await this.store.loadAddresses(this.customer.id);
    } catch {
      this.toast.error(
        'Failed to load addresses',
        'Unable to load customer addresses right now.'
      );
    }
  }

  private async loadCommunicationSummary(): Promise<void> {
    if (!this.customer || this.communicationSummaryLoading) return;

    this.communicationSummaryLoading = true;
    this.communicationSummaryError = null;

    try {
      const response = await firstValueFrom(
        this.communicationService.getCustomerSummary(this.customer.id),
      );
      this.communicationSummary = response.data;
    } catch (error) {
      console.error('Customer communication summary could not be loaded.', error);
      this.communicationSummary = null;
      this.communicationSummaryError = 'Could not load this customer’s communication history.';
    } finally {
      this.communicationSummaryLoading = false;
    }
  }

  async reloadCommunicationSummary(): Promise<void> {
    await this.loadCommunicationSummary();
  }

  duplicateCustomer(): CustomerContactConflict['customer'] | null {
    return this.customerIdentityConflicts[0]?.customer ?? null;
  }

  duplicateSummary(): string {
    const fields = [...new Set(this.customerIdentityConflicts.map((item) => item.field))];
    if (!fields.length) return 'This contact already exists.';
    if (fields.length === 2) return 'This email and phone already belong to another customer.';
    return `This ${fields[0]} already belongs to another customer.`;
  }

  openDuplicateCustomer(): void {
    const customer = this.duplicateCustomer();
    if (!customer) return;
    void this.router.navigate(['/customers', customer.id]);
  }

  private async checkCustomerIdentity(): Promise<void> {
    if (!this.customer) return;

    const email = this.editCustomerForm.controls.email.value.trim();
    const phone = this.editCustomerForm.controls.phone.value.trim();

    if (!email && !phone) {
      this.customerIdentityConflicts = [];
      this.customerIdentityChecking = false;
      return;
    }

    this.customerIdentityChecking = true;

    try {
      const response = await firstValueFrom(
        this.store.checkIdentity({
          email: email || null,
          phone: phone || null,
          excludeCustomerId: this.customer.id,
        }),
      );

      this.customerIdentityConflicts = response.conflicts ?? [];
    } catch (error) {
      console.error('Customer identity check failed.', error);
      this.customerIdentityConflicts = [];
    } finally {
      this.customerIdentityChecking = false;
    }
  }

  async save(): Promise<void> {
    if (this.editCustomerForm.invalid || !this.customer || this.working) {
      this.editCustomerForm.markAllAsTouched();
      return;
    }

    await this.checkCustomerIdentity();

    if (this.customerIdentityConflicts.length) {
      this.toast.error('Existing customer found', 'This email or phone belongs to another customer.');
      return;
    }

    this.working = true;

    try {
      const { name, email, phone, tags, notes } = this.editCustomerForm.getRawValue();

      const normalizedTags = this.withImportantNoteTag(
        this.normalizeTags(tags),
        Boolean(
          notes.trim() && this.customer.tags.includes(this.importantNoteTag),
        ),
      );

      const updatedCustomer = await this.store.update(this.customer.id, {
        name,
        email,
        phone,
        tags: normalizedTags,
        notes,
      });

      if (updatedCustomer) {
        this.applyUpdatedCustomer(updatedCustomer);
        this.toast.success('Customer Updated', `${name} was updated.`);
      }
    } catch (e: any) {
      this.toast.error(e);
    } finally {
      this.working = false;
    }
  }

  setActiveTab(tab: CustomerWorkspaceTab): void {
    this.activeTab = tab;
    this.persistWorkspaceViewState();
    void this.ensureHistoryLoaded(tab);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: tab === 'overview' ? { tab: null } : { tab },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  isWorkspaceTab(value: string | null): value is CustomerWorkspaceTab {
    return this.tabs.some((tab) => tab.key === value);
  }

  private syncCustomerEditorState(customer: Customer, resetNoteEditor = true): void {
    this.editCustomerForm.patchValue(
      {
        name: customer.name ?? '',
        email: customer.email ?? '',
        phone: customer.phone ?? '',
        tags: (customer.tags ?? [])
          .filter((tag) => tag !== this.importantNoteTag)
          .join(', '),
        notes: customer.notes ?? '',
      },
      { emitEvent: false },
    );

    if (resetNoteEditor || !this.internalNotesEditing) {
      this.internalNotesDraft = customer.notes ?? '';
      this.pinInternalNoteAsAlert = (customer.tags ?? []).includes(
        this.importantNoteTag,
      );
    }
  }

  private applyUpdatedCustomer(
    customer: Customer,
    resetNoteEditor = true,
  ): void {
    this.customer = customer;
    if (this.workspace) {
      this.workspace = { ...this.workspace, customer };
    }
    this.syncCustomerEditorState(customer, resetNoteEditor);
  }

  beginInternalNotesEdit(): void {
    if (!this.customer) return;
    this.internalNotesDraft = this.customer.notes ?? '';
    this.pinInternalNoteAsAlert = this.customer.tags.includes(
      this.importantNoteTag,
    );
    this.internalNotesEditing = true;
  }

  cancelInternalNotesEdit(): void {
    if (
      !this.customer ||
      this.internalNotesWorking ||
      this.customerFlagsWorking
    ) return;
    this.internalNotesDraft = this.customer.notes ?? '';
    this.pinInternalNoteAsAlert = this.customer.tags.includes(
      this.importantNoteTag,
    );
    this.internalNotesEditing = false;
  }

  async saveInternalNotes(): Promise<void> {
    if (!this.customer || this.internalNotesWorking) return;

    const notes = this.internalNotesDraft.trim();
    const nextTags = this.withImportantNoteTag(
      this.customer.tags,
      Boolean(notes && this.pinInternalNoteAsAlert),
    );

    if (nextTags.length > 25) {
      this.toast.error(
        'Too many customer tags',
        'Remove a tag before pinning this note as an alert.',
      );
      return;
    }

    this.internalNotesWorking = true;

    try {
      const updated = await this.store.update(this.customer.id, {
        notes: notes || null,
        tags: nextTags,
      });

      if (!updated) {
        this.toast.error(
          'Notes could not be saved',
          'Please try again in a moment.',
        );
        return;
      }

      this.applyUpdatedCustomer(updated);
      this.internalNotesEditing = false;
      this.toast.success(
        'Internal notes saved',
        notes ? 'The customer note was updated.' : 'The customer note was cleared.',
      );
    } catch (error: any) {
      this.toast.error(error);
    } finally {
      this.internalNotesWorking = false;
    }
  }

  internalNotesDirty(): boolean {
    if (!this.customer) return false;

    const savedNotes = String(this.customer.notes ?? '').trim();
    const draftNotes = this.internalNotesDraft.trim();
    const savedPinned = this.customer.tags.includes(this.importantNoteTag);
    const draftPinned = Boolean(draftNotes && this.pinInternalNoteAsAlert);

    return savedNotes !== draftNotes || savedPinned !== draftPinned;
  }

  customerHasImportantNote(): boolean {
    return Boolean(
      this.customer?.notes?.trim() &&
        this.customer.tags.includes(this.importantNoteTag),
    );
  }

  customerHasDoNotSms(): boolean {
    return this.customer?.tags.includes('do-not-sms') ?? false;
  }

  visibleCustomerTags(): string[] {
    return (this.customer?.tags ?? []).filter(
      (tag) => tag !== this.importantNoteTag,
    );
  }

  hasCustomerFlag(key: CustomerFlagKey): boolean {
    return this.customer?.tags.includes(key) ?? false;
  }

  async toggleCustomerFlag(key: CustomerFlagKey): Promise<void> {
    if (
      !this.customer ||
      this.customerFlagsWorking ||
      this.internalNotesWorking
    ) return;

    const current = new Set(this.customer.tags ?? []);
    const enabled = current.has(key);

    if (enabled) {
      current.delete(key);
    } else {
      if (current.size >= 25) {
        this.toast.error(
          'Too many customer tags',
          'Remove an existing tag before adding another flag.',
        );
        return;
      }
      current.add(key);
    }

    this.customerFlagsWorking = true;

    try {
      const updated = await this.store.update(this.customer.id, {
        tags: [...current],
      });

      if (!updated) {
        this.toast.error(
          'Flag could not be updated',
          'Please try again in a moment.',
        );
        return;
      }

      this.applyUpdatedCustomer(updated, !this.internalNotesEditing);
    } catch (error: any) {
      this.toast.error(error);
    } finally {
      this.customerFlagsWorking = false;
    }
  }

  customerFlagClass(flag: CustomerQuickFlag): string {
    if (!this.hasCustomerFlag(flag.key)) {
      return 'border-app-border bg-app-surface text-app-text-muted hover:border-brand/30 hover:bg-brand/5 hover:text-app-text';
    }

    switch (flag.tone) {
      case 'success':
        return 'border-emerald-200 bg-emerald-50 text-emerald-700';
      case 'warning':
        return 'border-amber-200 bg-amber-50 text-amber-700';
      case 'danger':
        return 'border-rose-200 bg-rose-50 text-rose-700';
      case 'info':
        return 'border-sky-200 bg-sky-50 text-sky-700';
      case 'brand':
        return 'border-brand/30 bg-brand/10 text-brand';
      default:
        return 'border-app-border bg-app-surface-muted text-app-text';
    }
  }

  focusInternalNotes(): void {
    if (this.activeTab !== 'overview') {
      this.setActiveTab('overview');
    }

    this.internalNotesEditing = true;
    setTimeout(() => {
      document
        .getElementById('customer-internal-notes')
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  tabCount(tab: CustomerWorkspaceTab): number | null {
    if (!this.workspace) return null;

    switch (tab) {
      case 'timeline':
        return this.customerTimeline().length;
      case 'repairs':
        return this.workspace.stats.totalRepairs;
      case 'quotes':
        return this.workspace.stats.totalQuotes;
      case 'orders':
        return this.workspace.stats.totalOrders;
      case 'devices':
        return this.workspace.stats.totalDevices;
      case 'addresses':
        return this.addresses.length;
      default:
        return null;
    }
  }

  private withImportantNoteTag(tags: string[], enabled: boolean): string[] {
    const next = new Set(tags ?? []);
    if (enabled) next.add(this.importantNoteTag);
    else next.delete(this.importantNoteTag);
    return [...next];
  }

  private workspaceViewStateKey(customerId: string): string {
    return `opscend:customer-workspace:${customerId}:view-state:v1`;
  }

  private restoreWorkspaceViewState(
    customerId: string,
    requestedTab: CustomerWorkspaceTab | null,
  ): void {
    if (typeof window === 'undefined') {
      if (requestedTab) this.activeTab = requestedTab;
      return;
    }

    try {
      const raw = window.sessionStorage.getItem(
        this.workspaceViewStateKey(customerId),
      );
      if (!raw) {
        if (requestedTab) this.activeTab = requestedTab;
        return;
      }

      const state = JSON.parse(raw) as Partial<CustomerWorkspaceViewState>;

      const restoredTab = this.isWorkspaceTab(state.activeTab ?? null)
        ? state.activeTab!
        : 'overview';
      this.activeTab = requestedTab ?? restoredTab;

      if (this.isTimelineFilter(state.timelineFilter)) {
        this.timelineFilter = state.timelineFilter;
      }

      this.repairHistorySearch = this.safeStoredSearch(
        state.repairHistorySearch,
      );
      if (this.isRepairHistoryStatus(state.repairHistoryStatus)) {
        this.repairHistoryStatus = state.repairHistoryStatus;
      }
      if (this.isHistoryDateFilter(state.repairHistoryDate)) {
        this.repairHistoryDate = state.repairHistoryDate;
      }

      this.quoteHistorySearch = this.safeStoredSearch(
        state.quoteHistorySearch,
      );
      if (this.isQuoteHistoryStatus(state.quoteHistoryStatus)) {
        this.quoteHistoryStatus = state.quoteHistoryStatus;
      }
      if (this.isHistoryDateFilter(state.quoteHistoryDate)) {
        this.quoteHistoryDate = state.quoteHistoryDate;
      }

      this.orderHistorySearch = this.safeStoredSearch(
        state.orderHistorySearch,
      );
      if (this.isOrderPaymentStatus(state.orderPaymentStatus)) {
        this.orderPaymentStatus = state.orderPaymentStatus;
      }
      if (this.isOrderFulfillmentStatus(state.orderFulfillmentStatus)) {
        this.orderFulfillmentStatus = state.orderFulfillmentStatus;
      }
      if (this.isHistoryDateFilter(state.orderHistoryDate)) {
        this.orderHistoryDate = state.orderHistoryDate;
      }
    } catch (error) {
      console.warn('Customer workspace view state could not be restored.', error);
      if (requestedTab) this.activeTab = requestedTab;
    }
  }

  private persistWorkspaceViewState(): void {
    const customerId = this.activeCustomerId ?? this.customer?.id ?? null;
    if (!customerId || typeof window === 'undefined') return;

    const state: CustomerWorkspaceViewState = {
      version: 1,
      activeTab: this.activeTab,
      timelineFilter: this.timelineFilter,
      repairHistorySearch: this.repairHistorySearch,
      repairHistoryStatus: this.repairHistoryStatus,
      repairHistoryDate: this.repairHistoryDate,
      quoteHistorySearch: this.quoteHistorySearch,
      quoteHistoryStatus: this.quoteHistoryStatus,
      quoteHistoryDate: this.quoteHistoryDate,
      orderHistorySearch: this.orderHistorySearch,
      orderPaymentStatus: this.orderPaymentStatus,
      orderFulfillmentStatus: this.orderFulfillmentStatus,
      orderHistoryDate: this.orderHistoryDate,
    };

    try {
      window.sessionStorage.setItem(
        this.workspaceViewStateKey(customerId),
        JSON.stringify(state),
      );
    } catch (error) {
      console.warn('Customer workspace view state could not be saved.', error);
    }
  }

  private safeStoredSearch(value: unknown): string {
    return typeof value === 'string' ? value.slice(0, 200) : '';
  }

  private isTimelineFilter(value: unknown): value is CustomerTimelineFilter {
    return this.timelineFilters.some((filter) => filter.key === value);
  }

  private isHistoryDateFilter(
    value: unknown,
  ): value is CustomerHistoryDateFilter {
    return this.historyDateOptions.some((option) => option.key === value);
  }

  private isRepairHistoryStatus(
    value: unknown,
  ): value is RepairHistoryStatusFilter {
    return this.repairStatusOptions.some((option) => option.key === value);
  }

  private isQuoteHistoryStatus(
    value: unknown,
  ): value is QuoteHistoryStatusFilter {
    return this.quoteStatusOptions.some((option) => option.key === value);
  }

  private isOrderPaymentStatus(
    value: unknown,
  ): value is OrderPaymentStatusFilter {
    return this.orderPaymentStatusOptions.some((option) => option.key === value);
  }

  private isOrderFulfillmentStatus(
    value: unknown,
  ): value is OrderFulfillmentStatusFilter {
    return this.orderFulfillmentStatusOptions.some(
      (option) => option.key === value,
    );
  }

  updateRepairHistorySearch(value: string): void {
    this.repairHistorySearch = value;
    this.persistWorkspaceViewState();
  }

  updateRepairHistoryStatus(value: RepairHistoryStatusFilter): void {
    this.repairHistoryStatus = value;
    this.persistWorkspaceViewState();
  }

  updateRepairHistoryDate(value: CustomerHistoryDateFilter): void {
    this.repairHistoryDate = value;
    this.persistWorkspaceViewState();
  }

  updateQuoteHistorySearch(value: string): void {
    this.quoteHistorySearch = value;
    this.persistWorkspaceViewState();
  }

  updateQuoteHistoryStatus(value: QuoteHistoryStatusFilter): void {
    this.quoteHistoryStatus = value;
    this.persistWorkspaceViewState();
  }

  updateQuoteHistoryDate(value: CustomerHistoryDateFilter): void {
    this.quoteHistoryDate = value;
    this.persistWorkspaceViewState();
  }

  updateOrderHistorySearch(value: string): void {
    this.orderHistorySearch = value;
    this.persistWorkspaceViewState();
  }

  updateOrderPaymentStatus(value: OrderPaymentStatusFilter): void {
    this.orderPaymentStatus = value;
    this.persistWorkspaceViewState();
  }

  updateOrderFulfillmentStatus(value: OrderFulfillmentStatusFilter): void {
    this.orderFulfillmentStatus = value;
    this.persistWorkspaceViewState();
  }

  updateOrderHistoryDate(value: CustomerHistoryDateFilter): void {
    this.orderHistoryDate = value;
    this.persistWorkspaceViewState();
  }

  customerInitials(): string {
    const name = this.customer?.name?.trim() ?? '';
    if (!name) return 'CU';

    return name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
  }

  customerFirstName(): string {
    return this.customer?.name?.trim().split(/\s+/)[0] || 'Customer';
  }

  customerSince(): string {
    const value = this.customer?.createdAt;
    if (!value) return '';

    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      year: 'numeric',
    }).format(new Date(value));
  }

  formatPhone(value: string | null | undefined): string {
    const digits = String(value ?? '').replace(/\D/g, '').slice(-10);
    if (digits.length !== 10) return value || 'No phone';
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  formatMoney(cents: number | null | undefined): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format((cents ?? 0) / 100);
  }

  formatDate(value: string | null | undefined): string {
    if (!value) return 'Not available';
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(value));
  }

  formatDateTime(value: string | null | undefined): string {
    if (!value) return 'Not available';
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value));
  }

  statusLabel(status: string | null | undefined): string {
    return String(status ?? 'unknown')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (character) => character.toUpperCase());
  }

  normalizeTags(value: string): string[] {
    const tags = value
      .split(/[,\n]/g)
      .map((tag) =>
        tag
          .trim()
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9-_]/g, '')
          .slice(0, 24),
      )
      .filter(Boolean);

    return [...new Set(tags)].slice(0, 25);
  }

  healthBadgeClass(tone: CustomerWorkspaceTone): string {
    switch (tone) {
      case 'success':
        return 'border-emerald-200 bg-emerald-50 text-emerald-700';
      case 'warning':
        return 'border-amber-200 bg-amber-50 text-amber-700';
      case 'danger':
        return 'border-rose-200 bg-rose-50 text-rose-700';
      case 'info':
        return 'border-sky-200 bg-sky-50 text-sky-700';
      default:
        return 'border-app-border bg-app-surface-muted text-app-text-muted';
    }
  }

  attentionCardClass(tone: CustomerWorkspaceTone): string {
    switch (tone) {
      case 'warning':
        return 'border-amber-200 bg-amber-50/70';
      case 'danger':
        return 'border-rose-200 bg-rose-50/70';
      case 'success':
        return 'border-emerald-200 bg-emerald-50/70';
      case 'info':
        return 'border-sky-200 bg-sky-50/70';
      default:
        return 'border-app-border bg-app-surface-muted';
    }
  }

  setTimelineFilter(filter: CustomerTimelineFilter): void {
    this.timelineFilter = filter;
    this.persistWorkspaceViewState();
  }

  private resetHistoryState(): void {
    this.repairHistory = [];
    this.quoteHistory = [];
    this.orderHistory = [];

    this.repairHistoryLoaded = false;
    this.quoteHistoryLoaded = false;
    this.orderHistoryLoaded = false;

    this.repairHistoryLoading = false;
    this.quoteHistoryLoading = false;
    this.orderHistoryLoading = false;

    this.repairHistoryError = null;
    this.quoteHistoryError = null;
    this.orderHistoryError = null;
  }

  private async ensureHistoryLoaded(tab: CustomerWorkspaceTab): Promise<void> {
    if (!this.customer) return;

    if (tab === 'repairs' && !this.repairHistoryLoaded) {
      await this.loadRepairHistory();
      return;
    }

    if (tab === 'quotes' && !this.quoteHistoryLoaded) {
      await this.loadQuoteHistory();
      return;
    }

    if (tab === 'orders' && !this.orderHistoryLoaded) {
      await this.loadOrderHistory();
    }
  }

  async reloadRepairHistory(): Promise<void> {
    this.repairHistoryLoaded = false;
    await this.loadRepairHistory();
  }

  async reloadQuoteHistory(): Promise<void> {
    this.quoteHistoryLoaded = false;
    await this.loadQuoteHistory();
  }

  async reloadOrderHistory(): Promise<void> {
    this.orderHistoryLoaded = false;
    await this.loadOrderHistory();
  }

  private async loadRepairHistory(): Promise<void> {
    if (!this.customer || this.repairHistoryLoading) return;

    this.repairHistoryLoading = true;
    this.repairHistoryError = null;

    try {
      const rows: Repair[] = [];
      let cursor: string | null = null;
      let pageCount = 0;

      do {
        const response: RepairListResponse = await firstValueFrom(
          this.repairsService.listRepairs({
            customerId: this.customer.id,
            limit: 100,
            cursor: cursor ?? undefined,
          }),
        );

        rows.push(...(response.data ?? []));
        cursor = response.nextCursor ?? null;
        pageCount += 1;
      } while (cursor && pageCount < 100);

      this.repairHistory = this.uniqueById(rows);
      this.repairHistoryLoaded = true;
    } catch (error) {
      console.error('Customer repair history could not be loaded.', error);
      this.repairHistoryError = 'Could not load this customer’s repair history.';
    } finally {
      this.repairHistoryLoading = false;
    }
  }

  private async loadQuoteHistory(): Promise<void> {
    if (!this.customer || this.quoteHistoryLoading) return;

    this.quoteHistoryLoading = true;
    this.quoteHistoryError = null;

    try {
      const rows: BookingQuoteRequest[] = [];
      let cursor: string | null = null;
      let pageCount = 0;

      do {
        const response: BookingQuoteRequestsResponse = await firstValueFrom(
          this.bookingAdminService.listQuoteRequests({
            customerId: this.customer.id,
            limit: 100,
            cursor,
          }),
        );

        rows.push(...(response.data ?? []));
        cursor = response.nextCursor ?? null;
        pageCount += 1;
      } while (cursor && pageCount < 100);

      this.quoteHistory = this.uniqueById(rows);
      this.quoteHistoryLoaded = true;
    } catch (error) {
      console.error('Customer quote history could not be loaded.', error);
      this.quoteHistoryError = 'Could not load this customer’s quote history.';
    } finally {
      this.quoteHistoryLoading = false;
    }
  }

  private async loadOrderHistory(): Promise<void> {
    if (!this.customer || this.orderHistoryLoading) return;

    this.orderHistoryLoading = true;
    this.orderHistoryError = null;

    try {
      const rows: Order[] = [];
      let cursor: string | null = null;
      let pageCount = 0;

      do {
        const response: OrderListResponse = await firstValueFrom(
          this.ordersService.list({
            customerId: this.customer.id,
            limit: 100,
            cursor,
          }),
        );

        rows.push(...(response.data ?? []));
        cursor = response.nextCursor ?? null;
        pageCount += 1;
      } while (cursor && pageCount < 100);

      this.orderHistory = this.uniqueById(rows);
      this.orderHistoryLoaded = true;
    } catch (error) {
      console.error('Customer order history could not be loaded.', error);
      this.orderHistoryError = 'Could not load this customer’s order history.';
    } finally {
      this.orderHistoryLoading = false;
    }
  }

  private uniqueById<T extends { id: string }>(rows: T[]): T[] {
    return [...new Map(rows.map((row) => [row.id, row])).values()];
  }

  filteredRepairHistory(): Repair[] {
    const search = this.repairHistorySearch.trim().toLowerCase();

    return this.repairHistory.filter((repair) => {
      if (!this.matchesHistoryDate(repair.createdAt, this.repairHistoryDate)) return false;

      if (this.repairHistoryStatus === 'open') {
        if (['picked_up', 'canceled'].includes(repair.status)) return false;
      } else if (this.repairHistoryStatus !== 'all' && repair.status !== this.repairHistoryStatus) {
        return false;
      }

      if (!search) return true;

      const haystack = [
        repair.problemSummary,
        repair.status,
        repair.assignedTo,
        this.historyRepairDeviceLabel(repair),
        repair.serviceMode,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(search);
    });
  }

  filteredQuoteHistory(): BookingQuoteRequest[] {
    const search = this.quoteHistorySearch.trim().toLowerCase();
    const terminalStatuses = ['declined', 'converted', 'expired', 'canceled'];

    return this.quoteHistory.filter((quote) => {
      if (!this.matchesHistoryDate(quote.createdAt, this.quoteHistoryDate)) return false;

      if (this.quoteHistoryStatus === 'active') {
        if (terminalStatuses.includes(quote.quoteStatus)) return false;
      } else if (this.quoteHistoryStatus !== 'all' && quote.quoteStatus !== this.quoteHistoryStatus) {
        return false;
      }

      if (!search) return true;

      const haystack = [
        this.historyQuoteRepairLabel(quote),
        this.historyQuoteDeviceLabel(quote),
        quote.quoteStatus,
        quote.requestStatus,
        quote.customerMessage,
        quote.internalNotes,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(search);
    });
  }

  filteredOrderHistory(): Order[] {
    const search = this.orderHistorySearch.trim().toLowerCase();

    return this.orderHistory.filter((order) => {
      if (!this.matchesHistoryDate(order.createdAt, this.orderHistoryDate)) return false;

      if (this.orderPaymentStatus !== 'all' && order.paymentStatus !== this.orderPaymentStatus) return false;
      if (this.orderFulfillmentStatus !== 'all' && order.fulfillmentStatus !== this.orderFulfillmentStatus) return false;

      if (!search) return true;

      const haystack = [
        order.orderNumber,
        order.paymentStatus,
        order.fulfillmentStatus,
        order.notes,
        ...(order.items ?? []).flatMap((item) => [item.name, item.sku]),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(search);
    });
  }

  private matchesHistoryDate(value: string, filter: CustomerHistoryDateFilter): boolean {
    if (filter === 'all') return true;

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return false;

    const cutoff = new Date();
    if (filter === '30d') cutoff.setDate(cutoff.getDate() - 30);
    if (filter === '90d') cutoff.setDate(cutoff.getDate() - 90);
    if (filter === 'year') cutoff.setFullYear(cutoff.getFullYear() - 1);

    return date >= cutoff;
  }

  clearRepairHistoryFilters(): void {
    this.repairHistorySearch = '';
    this.repairHistoryStatus = 'all';
    this.repairHistoryDate = 'all';
    this.persistWorkspaceViewState();
  }

  clearQuoteHistoryFilters(): void {
    this.quoteHistorySearch = '';
    this.quoteHistoryStatus = 'all';
    this.quoteHistoryDate = 'all';
    this.persistWorkspaceViewState();
  }

  clearOrderHistoryFilters(): void {
    this.orderHistorySearch = '';
    this.orderPaymentStatus = 'all';
    this.orderFulfillmentStatus = 'all';
    this.orderHistoryDate = 'all';
    this.persistWorkspaceViewState();
  }

  hasRepairHistoryFilters(): boolean {
    return Boolean(this.repairHistorySearch.trim() || this.repairHistoryStatus !== 'all' || this.repairHistoryDate !== 'all');
  }

  hasQuoteHistoryFilters(): boolean {
    return Boolean(this.quoteHistorySearch.trim() || this.quoteHistoryStatus !== 'all' || this.quoteHistoryDate !== 'all');
  }

  hasOrderHistoryFilters(): boolean {
    return Boolean(
      this.orderHistorySearch.trim() ||
      this.orderPaymentStatus !== 'all' ||
      this.orderFulfillmentStatus !== 'all' ||
      this.orderHistoryDate !== 'all',
    );
  }

  historyRepairDeviceLabel(repair: Repair): string {
    const device = repair.customerDevice as
      | { displayName?: string | null; nickname?: string | null; brand?: string | null; model?: string | null }
      | null
      | undefined;

    return device?.displayName || device?.nickname || [device?.brand, device?.model].filter(Boolean).join(' ') || 'Device';
  }

  historyQuoteRepairLabel(quote: BookingQuoteRequest): string {
    return quote.repairNeed?.label || quote.template?.name || 'Repair quote';
  }

  historyQuoteDeviceLabel(quote: BookingQuoteRequest): string {
    return [quote.brand, quote.model].filter(Boolean).join(' ') || quote.category || 'Device';
  }

  historyOrderTotal(order: Order): number {
    return order.totals?.totalCents ?? 0;
  }

  historyOrderBalance(order: Order): number {
    return order.totals?.balanceCents ?? 0;
  }

  openHistoryRepair(repair: Repair): void {
    void this.router.navigate(['/repairs/detail', repair.id]);
  }

  openHistoryQuote(quote: BookingQuoteRequest): void {
    void this.router.navigate(['/quote-requests', quote.id]);
  }

  async openHistoryOrder(order: Order): Promise<void> {
    try {
      const response = await firstValueFrom(this.repairsService.listRepairs({ orderId: order.id, limit: 1 }));
      const repair = response.data?.[0];

      if (repair) {
        void this.router.navigate(['/repairs/detail', repair.id]);
        return;
      }

      this.toast.info('Order details', 'This order is not linked to a repair detail page yet.');
    } catch (error) {
      console.error('Linked repair could not be located.', error);
      this.toast.error('Order could not be opened', 'We could not locate the repair linked to this order.');
    }
  }

  trackByHistoryRepairId(_index: number, repair: Repair): string {
    return repair.id;
  }

  trackByHistoryQuoteId(_index: number, quote: BookingQuoteRequest): string {
    return quote.id;
  }

  trackByHistoryOrderId(_index: number, order: Order): string {
    return order.id;
  }

  customerTimeline(): CustomerWorkspaceTimelineItem[] {
    const workspaceTimeline = this.workspace?.timeline ?? [];
    const communicationTimeline = (this.communicationSummary?.recentActivity ?? []).map(
      (item) => this.communicationActivityToTimelineItem(item),
    );

    return [...workspaceTimeline, ...communicationTimeline]
      .sort(
        (a, b) =>
          new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
      )
      .slice(0, 150);
  }

  private communicationActivityToTimelineItem(
    item: CustomerCommunicationActivityItem,
  ): CustomerWorkspaceTimelineItem {
    const channel = this.communicationChannelLabel(item.channel);
    const inbound = item.direction === 'inbound';
    const failed = this.isCommunicationWarningStatus(item.status);
    const title = failed
      ? `${channel} delivery issue`
      : inbound
        ? `${channel} received`
        : `${channel} sent`;

    const detail = [item.subject, item.preview]
      .filter(Boolean)
      .join(' · ');

    return {
      id: `communication:${item.id}`,
      type: 'communication',
      title,
      detail: detail || null,
      occurredAt: item.occurredAt,
      status: item.status,
      route: `/communications?conversationId=${encodeURIComponent(item.conversationId)}`,
      tone: failed
        ? 'danger'
        : inbound
          ? 'info'
          : ['delivered', 'opened', 'clicked'].includes(String(item.status))
            ? 'success'
            : 'neutral',
    };
  }

  filteredTimeline(): CustomerWorkspaceTimelineItem[] {
    const timeline = this.customerTimeline();
    if (this.timelineFilter === 'all') return timeline;
    return timeline.filter((item) => item.type === this.timelineFilter);
  }

  timelineFilterCount(filter: CustomerTimelineFilter): number {
    const timeline = this.customerTimeline();
    if (filter === 'all') return timeline.length;
    return timeline.filter((item) => item.type === filter).length;
  }

  statusClass(status: string | null | undefined): string {
    const normalized = String(status ?? '').toLowerCase();

    if (['paid', 'fulfilled', 'ready', 'picked_up', 'accepted', 'converted', 'completed'].includes(normalized)) {
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    }

    if (['canceled', 'cancelled', 'declined', 'failed', 'refunded'].includes(normalized)) {
      return 'border-rose-200 bg-rose-50 text-rose-700';
    }

    if (['unpaid', 'partial', 'unfulfilled', 'awaiting_parts', 'on_hold'].includes(normalized)) {
      return 'border-amber-200 bg-amber-50 text-amber-700';
    }

    return 'border-sky-200 bg-sky-50 text-sky-700';
  }

  timelineDotClass(item: CustomerWorkspaceTimelineItem): string {
    switch (item.tone) {
      case 'success':
        return 'bg-emerald-500 ring-emerald-100';
      case 'warning':
        return 'bg-amber-500 ring-amber-100';
      case 'danger':
        return 'bg-rose-500 ring-rose-100';
      case 'info':
        return 'bg-sky-500 ring-sky-100';
      default:
        return 'bg-slate-400 ring-slate-100';
    }
  }

  repairDeviceLabel(repair: CustomerWorkspaceRepairSummary): string {
    return (
      repair.device?.displayName ||
      repair.device?.nickname ||
      [repair.device?.brand, repair.device?.model].filter(Boolean).join(' ') ||
      'Device'
    );
  }

  deviceDisplayLabel(device: CustomerDevice): string {
    return [device.brand, device.model].filter(Boolean).join(' ') || 'Device details not set';
  }

  openRepair(repair: CustomerWorkspaceRepairSummary): void {
    void this.router.navigate(['/repairs/detail', repair.id]);
  }

  openQuote(quote: CustomerWorkspaceQuoteSummary): void {
    void this.router.navigate(['/quote-requests', quote.id]);
  }

  openOrder(order: CustomerWorkspaceOrderSummary): void {
    if (order.repairId) {
      void this.router.navigate(['/repairs/detail', order.repairId]);
      return;
    }

    this.setActiveTab('orders');
  }

  openOpenItem(item: CustomerWorkspaceOpenItem): void {
    if (!item.route) return;
    void this.router.navigateByUrl(item.route);
  }

  openNextAppointment(): void {
    const repairId = this.workspace?.nextAppointment?.repairId;
    if (!repairId) return;
    void this.router.navigate(['/repairs/detail', repairId]);
  }

  openTimelineItem(item: CustomerWorkspaceTimelineItem): void {
    if (!item.route) return;
    void this.router.navigateByUrl(item.route);
  }

  createRepair(): void {
    if (!this.customer) return;
    void this.router.navigate(['/repairs/create'], {
      queryParams: { customerId: this.customer.id },
    });
  }

  openCommunications(): void {
    if (!this.customer) return;

    const channel = this.preferredCustomerCommunicationChannel();
    const conversationId =
      this.communicationSummary?.conversationStatus === 'archived'
        ? null
        : this.communicationSummary?.conversationId ?? null;

    void this.router.navigate(['/communications'], {
      queryParams: conversationId
        ? { conversationId, channel }
        : { customerId: this.customer.id, channel },
    });
  }

  openCommunicationConversation(conversationId: string | null | undefined): void {
    if (!conversationId || !this.customer) {
      this.openCommunications();
      return;
    }

    const channel = this.preferredCustomerCommunicationChannel();

    void this.router.navigate(['/communications'], {
      queryParams: { conversationId, channel },
    });
  }

  private preferredCustomerCommunicationChannel(): 'sms' | 'email' | 'note' {
    if (!this.customer) return 'note';
    if (!this.customerHasDoNotSms() && this.customer.phone) return 'sms';
    if (this.customer.email) return 'email';
    return 'note';
  }

  communicationChannelLabel(channel: CommunicationChannel | null | undefined): string {
    if (channel === 'sms') return 'SMS';
    if (channel === 'email') return 'Email';
    if (channel === 'call' || channel === 'voice') return 'Call';
    return 'Message';
  }

  communicationDirectionLabel(
    direction: CommunicationDirection | null | undefined,
  ): string {
    if (direction === 'inbound') return 'Inbound';
    if (direction === 'outbound') return 'Outbound';
    return 'Communication';
  }

  communicationUnreadLabel(): string {
    const unread = this.communicationSummary?.unreadCount ?? 0;
    return unread > 99 ? '99+' : String(unread);
  }

  communicationLastActivityAt(): string | null {
    const candidates = [
      this.workspace?.stats.lastActivityAt ?? null,
      this.communicationSummary?.lastMessageAt ?? null,
    ].filter((value): value is string => Boolean(value));

    if (!candidates.length) return null;

    return candidates.sort(
      (a, b) => new Date(b).getTime() - new Date(a).getTime(),
    )[0] ?? null;
  }

  communicationStatusClass(status: string | null | undefined): string {
    if (this.isCommunicationWarningStatus(status)) {
      return 'border-rose-200 bg-rose-50 text-rose-700';
    }

    if (['delivered', 'received', 'opened', 'clicked'].includes(String(status))) {
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    }

    return 'border-sky-200 bg-sky-50 text-sky-700';
  }

  isCommunicationWarningStatus(status: string | null | undefined): boolean {
    return ['failed', 'bounced', 'complained', 'rejected', 'delayed'].includes(
      String(status ?? '').toLowerCase(),
    );
  }

  trackByTimelineId(_index: number, item: CustomerWorkspaceTimelineItem): string {
    return item.id;
  }

  trackByRepairId(_index: number, repair: CustomerWorkspaceRepairSummary): string {
    return repair.id;
  }

  trackByQuoteId(_index: number, quote: CustomerWorkspaceQuoteSummary): string {
    return quote.id;
  }

  trackByOrderId(_index: number, order: CustomerWorkspaceOrderSummary): string {
    return order.id;
  }

  cancel(): void {
    void this.router.navigate(['customers', 'overview']);
  }

  editDevice(device: CustomerDevice): void {
    if (!this.customer) return;

    this.customerDevicesStore.setSelected(device);
    this.deviceModalService.open(this.customer.id);
  }

  openDeviceModal(): void {
    if (!this.customer) return;

    this.customerDevicesStore.clearSelected();
    this.deviceModalService.open(this.customer.id);
  }

  openNewAddressModal(): void {
    this.editingAddress = null;
    this.addressForm.reset({
      label: '',
      line1: '',
      line2: '',
      city: '',
      state: '',
      postalCode: '',
      country: this.shopCountry,
      geo: null,
      notes: '',
      isDefault: this.addresses.length === 0,
    });
    this.addressModalOpen = true;
  }

  openEditAddressModal(address: CustomerAddress): void {
    this.editingAddress = address;
    this.addressForm.reset({
      label: address.label ?? '',
      line1: address.line1,
      line2: address.line2 ?? '',
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
      country: address.country,
      geo: address.geo,
      notes: address.notes ?? '',
      isDefault: address.isDefault,
    });
    this.addressModalOpen = true;
  }

  closeAddressModal(): void {
    if (this.addressWorking) return;
    this.addressModalOpen = false;
    this.editingAddress = null;
    this.addressForm.reset({
      label: '',
      line1: '',
      line2: '',
      city: '',
      state: '',
      postalCode: '',
      country: this.shopCountry,
      geo: null,
      notes: '',
      isDefault: false,
    });
  }

  async saveAddress(): Promise<void> {
    if (!this.customer || this.addressForm.invalid || this.addressWorking) {
      this.addressForm.markAllAsTouched();
      return;
    }

    this.addressWorking = true;

    try {
      const raw = this.addressForm.getRawValue();

      const payload: CreateCustomerAddressRequest | UpdateCustomerAddressRequest = {
        label: raw.label.trim() || null,
        line1: raw.line1.trim(),
        line2: raw.line2.trim() || null,
        city: raw.city.trim(),
        state: raw.state.trim(),
        postalCode: raw.postalCode.trim(),
        country: raw.country.trim().toUpperCase(),
        geo: this.addressForm.controls.geo.value,
        notes: raw.notes.trim() || null,
        isDefault: raw.isDefault,
      };

      const saved = this.editingAddress
        ? await this.store.updateAddress(this.customer.id, this.editingAddress.id, payload)
        : await this.store.createAddress(this.customer.id, payload as CreateCustomerAddressRequest);

      if (saved) {
        this.addresses = this.store.addresses();
        this.toast.success(
          this.editingAddress ? 'Address Updated' : 'Address Added',
          this.formatAddressShort(saved)
        );
        this.closeAddressModal();
      }
    } catch (e: any) {
      this.toast.error(e);
    } finally {
      this.addressWorking = false;
    }
  }

  async setDefaultAddress(address: CustomerAddress): Promise<void> {
    if (!this.customer || address.isDefault || this.addressWorking) return;

    this.addressWorking = true;

    try {
      const updated = await this.store.setDefaultAddress(this.customer.id, address.id);
      if (updated) {
        this.addresses = this.store.addresses();
        this.toast.success('Default Address Updated', this.formatAddressShort(updated));
      }
    } catch (e: any) {
      this.toast.error(e);
    } finally {
      this.addressWorking = false;
    }
  }

  async deleteAddress(address: CustomerAddress): Promise<void> {
    if (!this.customer || this.addressWorking) return;

    const confirmed = window.confirm('Delete this address?');
    if (!confirmed) return;

    this.addressWorking = true;

    try {
      const ok = await this.store.deleteAddress(this.customer.id, address.id);
      if (ok) {
        this.addresses = this.store.addresses();
        this.toast.success('Address Deleted', this.formatAddressShort(address));
      }
    } catch (e: any) {
      this.toast.error(e);
    } finally {
      this.addressWorking = false;
    }
  }

  trackByAddressId(_index: number, address: CustomerAddress): string {
    return address.id;
  }

  formatAddressLines(address: CustomerAddress): string[] {
    const line2 = address.line2?.trim();
    const cityStatePostal = [address.city, address.state, address.postalCode].filter(Boolean).join(', ').replace(', ,', ',');
    return [
      address.line1,
      ...(line2 ? [line2] : []),
      cityStatePostal,
      address.country,
    ].filter((value) => !!value);
  }

  formatAddressShort(address: CustomerAddress): string {
    return [address.line1, address.city, address.state, address.postalCode]
      .filter(Boolean)
      .join(', ');
  }
}