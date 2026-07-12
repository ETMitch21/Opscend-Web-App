import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from "@angular/core";
import { CommonModule, DatePipe } from "@angular/common";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";
import { debounceTime, firstValueFrom } from "rxjs";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  Building2,
  ChevronDownIcon,
  Clipboard,
  Clock3,
  DollarSign,
  ExternalLink,
  House,
  LucideAngularModule,
  Mail,
  MapPin,
  MessageSquare,
  Search,
  Send,
  Share2,
  User,
  Wrench,
  X,
} from "lucide-angular";

import { BookingAdminService } from "../../../core/booking/service";
import { PhonePipe } from "../../../core/pipes/phone-pipe";
import { ToastService } from "../../../core/toast/toast-service";
import {
  BookingQuoteRequest,
  BookingQuoteRequestPatch,
  BookingQuoteRequestStatus,
  BookingQuoteWorkflowStatus,
} from "../../../core/booking/model";

type QuoteRequestViewFilter = "all" | "new" | "contacted" | "canceled";
type QuoteDrawerTab = "summary" | "pricing" | "approval";
type QuoteRequestSortKey =
  | "request"
  | "customer"
  | "device"
  | "repair"
  | "quote"
  | "submitted";
type SortDirection = "asc" | "desc";

interface QuoteTimelineItem {
  label: string;
  value: string | null;
  tone: "done" | "muted";
}

@Component({
  selector: "app-quote-requests-overview",
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    DatePipe,
    LucideAngularModule,
    PhonePipe,
    ReactiveFormsModule,
  ],
  templateUrl: "./quote-requests-overview.html",
  styleUrl: "./quote-requests-overview.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuoteRequestsOverview {
  private readonly bookingApi = inject(BookingAdminService);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private pendingAutoSave = false;
  private pendingQuoteRequestId: string | null = null;
  private autoSaveToastId: string | number | undefined;

  readonly chevronDownIcon = ChevronDownIcon;
  readonly buildingIcon = Building2;
  readonly clipboardIcon = Clipboard;
  readonly clockIcon = Clock3;
  readonly dollarIcon = DollarSign;
  readonly externalLinkIcon = ExternalLink;
  readonly houseIcon = House;
  readonly mailIcon = Mail;
  readonly mapPinIcon = MapPin;
  readonly messageSquareIcon = MessageSquare;
  readonly searchIcon = Search;
  readonly sendIcon = Send;
  readonly shareIcon = Share2;
  readonly userIcon = User;
  readonly wrenchIcon = Wrench;
  readonly xCloseIcon = X;

  readonly requests = signal<BookingQuoteRequest[]>([]);
  readonly loading = signal(false);
  readonly loadingMore = signal(false);
  readonly updatingId = signal<string | null>(null);
  readonly actionId = signal<string | null>(null);
  readonly savingQuote = signal(false);
  readonly error = signal<string | null>(null);
  readonly drawerError = signal<string | null>(null);
  readonly copySuccess = signal(false);
  readonly nextCursor = signal<string | null>(null);

  readonly activeView = signal<QuoteRequestViewFilter>("new");
  readonly searchTerm = signal("");
  readonly serviceMode = signal<"in_shop" | "on_site" | null>(null);
  readonly pageSize = signal(50);

  readonly sortKey = signal<QuoteRequestSortKey>("submitted");
  readonly sortDirection = signal<SortDirection>("desc");

  readonly selectedRequestId = signal<string | null>(null);
  readonly activeDrawerTab = signal<QuoteDrawerTab>("summary");
  readonly selectedRequest = computed(() => {
    const id = this.selectedRequestId();
    if (!id) return null;
    return this.requests().find((request) => request.id === id) ?? null;
  });

  readonly quoteForm = this.fb.nonNullable.group({
    partCost: [""],
    labor: [""],
    tripFee: [""],
    subtotal: [""],
    total: [""],
    depositRequired: [false],
    depositAmount: [""],
    customerMessage: [""],
    internalNotes: [""],
  });

  readonly viewOptions: ReadonlyArray<{
    value: QuoteRequestViewFilter;
    label: string;
  }> = [
    { value: "all", label: "All" },
    { value: "new", label: "New" },
    { value: "contacted", label: "Contacted" },
    { value: "canceled", label: "Canceled" },
  ];

  readonly drawerTabs: ReadonlyArray<{ value: QuoteDrawerTab; label: string }> = [
    { value: "summary", label: "Summary" },
    { value: "pricing", label: "Pricing" },
    { value: "approval", label: "Notes" },
  ];

  readonly counts = computed(() => {
    const requests = this.requests();

    return {
      all: requests.length,
      new: requests.filter((request) => request.requestStatus === "new").length,
      contacted: requests.filter(
        (request) => request.requestStatus === "contacted",
      ).length,
      canceled: requests.filter(
        (request) => request.requestStatus === "canceled",
      ).length,
    };
  });

  readonly filteredRequests = computed(() => {
    let list = [...this.requests()];
    const activeView = this.activeView();
    const search = this.searchTerm().trim().toLowerCase();
    const serviceMode = this.serviceMode();

    if (activeView !== "all") {
      list = list.filter((request) => request.requestStatus === activeView);
    }

    if (serviceMode) {
      list = list.filter((request) => request.serviceMode === serviceMode);
    }

    if (search) {
      list = list.filter((request) => this.matchesSearch(request, search));
    }

    const sortKey = this.sortKey();
    const sortDirection = this.sortDirection();

    list.sort((a, b) => {
      const comparison = this.compareRequests(a, b, sortKey);
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return list;
  });

  ngOnInit(): void {
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        this.pendingQuoteRequestId = params.get("quoteRequestId");
        this.tryOpenPendingQuoteRequest();
      });

    void this.loadRequests();

    this.quoteForm.valueChanges
      .pipe(debounceTime(700), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (!this.selectedRequest()) return;
        void this.autoSaveSelectedQuote();
      });
  }

  async refresh(): Promise<void> {
    this.nextCursor.set(null);
    await this.loadRequests();
  }

  async loadRequests(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const response = await firstValueFrom(
        this.bookingApi.listQuoteRequests({ limit: this.pageSize() }),
      );

      this.requests.set(response.data);
      this.nextCursor.set(response.nextCursor);
      this.tryOpenPendingQuoteRequest();
    } catch (error) {
      console.error(error);
      this.error.set("Failed to load quote requests.");
      this.requests.set([]);
      this.nextCursor.set(null);
    } finally {
      this.loading.set(false);
    }
  }

  async loadMore(): Promise<void> {
    const cursor = this.nextCursor();
    if (!cursor || this.loadingMore()) return;

    this.loadingMore.set(true);
    this.error.set(null);

    try {
      const response = await firstValueFrom(
        this.bookingApi.listQuoteRequests({ limit: this.pageSize(), cursor }),
      );

      this.requests.update((current) => [...current, ...response.data]);
      this.nextCursor.set(response.nextCursor);
      this.tryOpenPendingQuoteRequest();
    } catch (error) {
      console.error(error);
      this.error.set("Failed to load more quote requests.");
    } finally {
      this.loadingMore.set(false);
    }
  }

  setView(view: QuoteRequestViewFilter): void {
    this.activeView.set(view);
  }

  setSearchTerm(value: string): void {
    this.searchTerm.set(value);
  }

  setServiceMode(value: string | null): void {
    if (value === "in_shop" || value === "on_site") {
      this.serviceMode.set(value);
    } else {
      this.serviceMode.set(null);
    }
  }

  setSort(key: QuoteRequestSortKey): void {
    if (this.sortKey() === key) {
      this.sortDirection.set(this.sortDirection() === "asc" ? "desc" : "asc");
      return;
    }

    this.sortKey.set(key);
    this.sortDirection.set(key === "submitted" ? "desc" : "asc");
  }

  isSortedBy(key: QuoteRequestSortKey): boolean {
    return this.sortKey() === key;
  }

  getSortIconRotation(key: QuoteRequestSortKey): string {
    if (this.sortKey() !== key) return "rotate(0deg)";
    return this.sortDirection() === "asc" ? "rotate(180deg)" : "rotate(0deg)";
  }

  clearFilters(): void {
    this.activeView.set("new");
    this.serviceMode.set(null);
    this.searchTerm.set("");
  }

  trackByRequestId(_: number, request: BookingQuoteRequest): string {
    return request.id;
  }

  openRequest(request: BookingQuoteRequest): void {
    this.selectedRequestId.set(request.id);
    this.activeDrawerTab.set("summary");
    this.drawerError.set(null);
    this.copySuccess.set(false);
    this.patchQuoteForm(request);
  }

  setDrawerTab(tab: QuoteDrawerTab): void {
    this.activeDrawerTab.set(tab);
    this.drawerError.set(null);
  }

  closeDrawer(): void {
    this.selectedRequestId.set(null);
    this.activeDrawerTab.set("summary");
    this.drawerError.set(null);
    this.copySuccess.set(false);
  }

  private tryOpenPendingQuoteRequest(): void {
    const id = this.pendingQuoteRequestId;
    if (!id || this.selectedRequestId() === id) return;

    const request = this.requests().find((item) => item.id === id);
    if (!request) return;

    this.openRequest(request);
  }

  async markContacted(request: BookingQuoteRequest): Promise<void> {
    await this.updateRequestStatus(request, "contacted");
  }

  async reopenRequest(request: BookingQuoteRequest): Promise<void> {
    await this.updateRequestStatus(request, "new");
  }

  async cancelRequest(request: BookingQuoteRequest): Promise<void> {
    const confirmed = window.confirm(
      `Cancel quote request for ${request.customer.name || "this customer"}?`,
    );
    if (!confirmed) return;

    await this.updateRequestStatus(request, "canceled");
  }

  async sendSelectedQuote(): Promise<void> {
    const request = this.selectedRequest();
    if (!request) return;

    await this.runQuoteAction(request, "send", () =>
      this.bookingApi.sendQuoteRequest(request.id),
    );
  }

  async acceptSelectedQuote(): Promise<void> {
    const request = this.selectedRequest();
    if (!request) return;

    const saved = await this.autoSaveSelectedQuote();
    if (!saved) return;

    await this.runQuoteAction(request, "accept", () =>
      this.bookingApi.acceptQuoteRequest(request.id),
    );
  }

  async declineSelectedQuote(): Promise<void> {
    const request = this.selectedRequest();
    if (!request) return;

    const confirmed = window.confirm(
      `Mark quote for ${this.customerLabel(request)} as declined?`,
    );
    if (!confirmed) return;

    const saved = await this.autoSaveSelectedQuote();
    if (!saved) return;

    await this.runQuoteAction(request, "decline", () =>
      this.bookingApi.declineQuoteRequest(request.id),
    );
  }

  async convertSelectedQuote(): Promise<void> {
    const request = this.selectedRequest();
    if (!request || !this.canConvertToRepair(request)) return;

    const confirmed = window.confirm(
      `Create a repair for ${this.customerLabel(request)} from this ${request.depositRequired ? "paid " : ""}quote?`,
    );
    if (!confirmed) return;

    const saved = await this.autoSaveSelectedQuote();
    if (!saved) return;

    await this.runQuoteAction(request, "convert", () =>
      this.bookingApi.convertQuoteRequest(request.id),
    );
  }

  async copyPublicQuoteLink(request: BookingQuoteRequest): Promise<void> {
    const url = this.publicQuoteUrl(request);
    if (!url) return;

    try {
      await navigator.clipboard.writeText(url);
      this.copySuccess.set(true);
      this.toast.success("Quote link copied");
      window.setTimeout(() => this.copySuccess.set(false), 1800);
    } catch (error) {
      console.error(error);
      this.drawerError.set("Could not copy quote link.");
      this.toast.error("Could not copy quote link");
    }
  }


  async shareSelectedQuote(): Promise<void> {
    const request = this.selectedRequest();
    if (!request || this.actionId()) return;

    const saved = await this.autoSaveSelectedQuote();
    if (!saved) return;

    this.actionId.set(`${request.id}:share`);
    this.drawerError.set(null);
    this.copySuccess.set(false);

    try {
      let target = request;

      if (!this.publicQuoteUrl(target)) {
        if (!this.canSendQuote(target)) {
          this.drawerError.set("This quote can no longer be shared.");
          return;
        }

        target = await firstValueFrom(this.bookingApi.sendQuoteRequest(request.id));
        this.replaceRequest(target);
        this.patchQuoteForm(target);
      }

      const url = this.publicQuoteUrl(target);
      if (!url) {
        this.drawerError.set("Could not generate a quote link.");
        return;
      }

      await navigator.clipboard.writeText(url);
      this.copySuccess.set(true);
      this.toast.success("Quote link copied", "Share it with the customer when you are ready.");
      window.setTimeout(() => this.copySuccess.set(false), 2200);
    } catch (error) {
      console.error(error);
      this.drawerError.set("Could not generate or copy quote link.");
      this.toast.error("Could not generate or copy quote link");
    } finally {
      this.actionId.set(null);
    }
  }

  async emailSelectedQuote(): Promise<void> {
    const request = this.selectedRequest();
    if (!request || this.actionId()) return;

    if (!request.customer.email) {
      this.drawerError.set("Add a customer email before emailing this quote.");
      this.toast.error("Customer email required", "Add an email address before sending the quote.");
      return;
    }

    if (!this.canEmailQuote(request)) {
      this.drawerError.set("This quote can no longer be emailed.");
      return;
    }

    const saved = await this.autoSaveSelectedQuote();
    if (!saved) return;

    this.actionId.set(`${request.id}:email`);
    this.drawerError.set(null);

    try {
      const updated = await firstValueFrom(
        this.bookingApi.emailQuoteRequest(request.id),
      );

      this.replaceRequest(updated);
      this.patchQuoteForm(updated);
      this.toast.success("Quote emailed", `Sent to ${updated.customer.email ?? "customer"}.`);
    } catch (error) {
      console.error(error);
      this.drawerError.set("Could not email this quote.");
      this.toast.error("Could not email quote", "The quote link was not sent to the customer.");
    } finally {
      this.actionId.set(null);
    }
  }

  calculateQuoteTotal(): void {
    const formValue = this.quoteForm.getRawValue();
    const partCost = this.dollarsToCents(formValue.partCost) ?? 0;
    const labor = this.dollarsToCents(formValue.labor) ?? 0;
    const tripFee = this.dollarsToCents(formValue.tripFee) ?? 0;
    const total = partCost + labor + tripFee;

    this.quoteForm.patchValue({
      subtotal: this.centsToDollars(total),
      total: this.centsToDollars(total),
    });
  }

  requestDate(request: BookingQuoteRequest): Date | null {
    const value = request.requestedAt || request.updatedAt || request.createdAt;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  deviceLabel(request: BookingQuoteRequest): string {
    return (
      [request.brand, request.model].filter(Boolean).join(" ") ||
      request.category ||
      "Unknown device"
    );
  }

  customerLabel(request: BookingQuoteRequest): string {
    return (
      request.customer.name ||
      request.customer.email ||
      request.customer.phone ||
      "Unknown customer"
    );
  }

  addressLines(request: BookingQuoteRequest): string[] {
    const address = request.address;
    if (!address) return [];

    const line1 = [address.line1, address.line2].filter(Boolean).join(", ");
    const line2 = [address.city, address.state, address.postalCode]
      .filter(Boolean)
      .join(", ");

    return [line1, line2].filter(Boolean);
  }

  money(cents: number | null | undefined): string {
    if (cents === null || cents === undefined) return "Pending";

    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);
  }

  confidenceLabel(request: BookingQuoteRequest): string {
    if (request.requiresManualReview || request.confidence === "manual_review")
      return "Manual review";
    if (request.confidence === "template_confirmed") return "Confirmed";
    return "Estimated";
  }

  statusLabel(request: BookingQuoteRequest): string {
    switch (request.requestStatus) {
      case "contacted":
        return "Contacted";
      case "canceled":
        return "Canceled";
      case "new":
      default:
        return "New";
    }
  }

  tableStatusLabel(request: BookingQuoteRequest): string {
    if (request.requestStatus === "canceled") return "Canceled";

    if (
      request.quoteStatus &&
      !["draft", "quote_requested", "quoted"].includes(request.quoteStatus)
    ) {
      return this.quoteStatusLabel(request.quoteStatus);
    }

    if (request.requestStatus === "contacted") return "Contacted";
    if (request.quoteStatus === "quoted") return "Quoted";

    return this.statusLabel(request);
  }

  tableStatusClass(request: BookingQuoteRequest): string {
    if (request.requestStatus === "canceled" || request.quoteStatus === "canceled") {
      return "bg-rose-50 text-rose-700 ring-rose-100";
    }

    switch (request.quoteStatus) {
      case "accepted":
      case "deposit_paid":
      case "scheduled":
      case "converted":
        return "bg-emerald-50 text-emerald-700 ring-emerald-100";
      case "declined":
        return "bg-rose-50 text-rose-700 ring-rose-100";
      case "sent":
      case "deposit_pending":
        return "bg-sky-50 text-sky-700 ring-sky-100";
      default:
        if (request.requestStatus === "contacted") {
          return "bg-emerald-50 text-emerald-700 ring-emerald-100";
        }

        return "bg-blue-50 text-blue-700 ring-blue-100";
    }
  }

  quoteStatusLabel(status: BookingQuoteWorkflowStatus | string | null | undefined): string {
    switch (status) {
      case "quote_requested":
        return "Quote requested";
      case "deposit_pending":
        return "Deposit pending";
      case "deposit_paid":
        return "Deposit paid";
      case "draft":
        return "Draft";
      case "quoted":
        return "Quoted";
      case "sent":
        return "Sent";
      case "accepted":
        return "Accepted";
      case "declined":
        return "Declined";
      case "scheduled":
        return "Scheduled";
      case "converted":
        return "Converted";
      case "expired":
        return "Expired";
      case "canceled":
        return "Canceled";
      default:
        return "Unknown";
    }
  }

  quoteStatusHint(status: BookingQuoteWorkflowStatus | string | null | undefined): string {
    switch (status) {
      case "sent":
        return "Generated when you create a public quote link.";
      case "accepted":
        return "Updated when the customer accepts or you mark it accepted.";
      case "declined":
        return "Updated when the customer declines or you mark it declined.";
      case "deposit_pending":
        return "Will be used once quote deposits are enabled.";
      case "deposit_paid":
        return "Will update automatically after a successful deposit payment.";
      case "scheduled":
      case "converted":
        return "Updated when this quote becomes a repair.";
      case "canceled":
        return "Updated when the request is canceled.";
      case "quoted":
      case "quote_requested":
      case "draft":
      default:
        return "This updates automatically as you send, accept, decline, collect deposit, or convert the quote.";
    }
  }

  serviceModeLabel(mode: string | null | undefined): string {
    switch (mode) {
      case "on_site":
        return "On-site";
      case "in_shop":
        return "In-shop";
      default:
        return "Unknown";
    }
  }

  publicQuoteUrl(request: BookingQuoteRequest): string | null {
    if (!request.publicApprovalToken) return null;
    return `${window.location.origin}/quote/${request.publicApprovalToken}`;
  }


  progressSteps(request: BookingQuoteRequest): QuoteTimelineItem[] {
    const status = request.quoteStatus;
    const isCanceled = request.requestStatus === "canceled" || status === "canceled";
    const isDeclined = Boolean(request.declinedAt) || status === "declined";
    const hasContacted = Boolean(request.contactedAt);
    const hasSent = Boolean(request.quoteSentAt) || [
      "sent",
      "accepted",
      "deposit_pending",
      "deposit_paid",
      "scheduled",
      "converted",
    ].includes(status);
    const hasAccepted = Boolean(request.acceptedAt) || [
      "accepted",
      "deposit_pending",
      "deposit_paid",
      "scheduled",
      "converted",
    ].includes(status);
    const hasDeposit = Boolean(request.depositPaidAt) || [
      "deposit_paid",
      "scheduled",
      "converted",
    ].includes(status);
    const hasConverted = Boolean(request.convertedAt) || ["scheduled", "converted"].includes(status);

    if (isCanceled) {
      return [
        { label: "Requested", value: request.requestedAt || request.createdAt, tone: "done" },
        { label: "Canceled", value: request.updatedAt, tone: "done" },
      ];
    }

    if (isDeclined) {
      return [
        { label: "Requested", value: request.requestedAt || request.createdAt, tone: "done" },
        { label: "Sent", value: request.quoteSentAt, tone: hasSent ? "done" : "muted" },
        { label: "Declined", value: request.declinedAt, tone: "done" },
      ];
    }

    const steps: QuoteTimelineItem[] = [
      { label: "Requested", value: request.requestedAt || request.createdAt, tone: "done" },
      { label: "Contacted", value: request.contactedAt, tone: hasContacted || hasSent ? "done" : "muted" },
      { label: "Sent", value: request.quoteSentAt, tone: hasSent ? "done" : "muted" },
      { label: "Accepted", value: request.acceptedAt, tone: hasAccepted ? "done" : "muted" },
    ];

    if (request.depositRequired) {
      steps.push({
        label: "Deposit",
        value: request.depositPaidAt,
        tone: hasDeposit ? "done" : "muted",
      });
    }

    steps.push({
      label: "Converted",
      value: request.convertedAt,
      tone: hasConverted ? "done" : "muted",
    });

    return steps;
  }

  timeline(request: BookingQuoteRequest): QuoteTimelineItem[] {
    return [
      { label: "Requested", value: request.requestedAt || request.createdAt, tone: "done" },
      { label: "Contacted", value: request.contactedAt, tone: request.contactedAt ? "done" : "muted" },
      { label: "Quote sent", value: request.quoteSentAt, tone: request.quoteSentAt ? "done" : "muted" },
      { label: "Accepted", value: request.acceptedAt, tone: request.acceptedAt ? "done" : "muted" },
      { label: "Declined", value: request.declinedAt, tone: request.declinedAt ? "done" : "muted" },
      { label: "Deposit paid", value: request.depositPaidAt, tone: request.depositPaidAt ? "done" : "muted" },
      { label: "Converted", value: request.convertedAt, tone: request.convertedAt ? "done" : "muted" },
    ];
  }

  formatDate(value: string | null | undefined): Date | null {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  canSendQuote(request: BookingQuoteRequest): boolean {
    return ![
      "accepted",
      "deposit_pending",
      "deposit_paid",
      "scheduled",
      "converted",
      "declined",
      "expired",
      "canceled",
    ].includes(request.quoteStatus);
  }

  canEmailQuote(request: BookingQuoteRequest): boolean {
    if (!request.customer.email) return false;
    if (!request.estimatedTotalCents) return false;
    if (request.depositRequired && !request.depositAmountCents) return false;
    if (request.requestStatus === "canceled") return false;
    return this.canSendQuote(request);
  }

  canConvertToRepair(request: BookingQuoteRequest): boolean {
    if (request.repairId) return false;
    if (request.requestStatus === "canceled") return false;

    if (request.depositRequired) {
      return request.quoteStatus === "deposit_paid" || Boolean(request.depositPaidAt);
    }

    return ["accepted", "deposit_paid"].includes(request.quoteStatus);
  }

  isDepositPaid(request: BookingQuoteRequest): boolean {
    return Boolean(request.depositPaidAt || request.quoteStatus === "deposit_paid");
  }

  depositStatusLabel(request: BookingQuoteRequest): string {
    if (!request.depositRequired) return "Not required";
    if (this.isDepositPaid(request)) return "Paid";
    if (request.quoteStatus === "deposit_pending") return "Waiting for payment";
    return "Required";
  }

  depositStatusClass(request: BookingQuoteRequest): string {
    if (!request.depositRequired) return "bg-gray-50 text-gray-600 ring-gray-100";
    if (this.isDepositPaid(request)) return "bg-emerald-50 text-emerald-700 ring-emerald-100";
    if (request.quoteStatus === "deposit_pending") return "bg-amber-50 text-amber-700 ring-amber-100";
    return "bg-blue-50 text-blue-700 ring-blue-100";
  }

  convertButtonLabel(request: BookingQuoteRequest): string {
    if (this.actionId() === request.id + ":convert") return "Creating repair...";
    if (request.depositRequired && this.isDepositPaid(request)) return "Create repair from paid quote";
    return "Create repair from quote";
  }

  convertDisabledReason(request: BookingQuoteRequest): string | null {
    if (request.repairId) return "A repair has already been created for this quote.";
    if (request.requestStatus === "canceled" || request.quoteStatus === "canceled") {
      return "Restore this quote request before creating a repair.";
    }
    if (request.quoteStatus === "declined") return "Declined quotes cannot be converted.";
    if (request.depositRequired && !this.isDepositPaid(request)) {
      return request.quoteStatus === "deposit_pending"
        ? "Waiting for the customer to pay the deposit before creating the repair."
        : "This quote requires a paid deposit before creating the repair.";
    }
    if (!["accepted", "deposit_paid"].includes(request.quoteStatus)) {
      return "The quote must be accepted before creating a repair.";
    }
    return null;
  }

  conversationQueryParams(request: BookingQuoteRequest): Record<string, string> {
    if (request.conversationId) return { conversationId: request.conversationId };
    return { quoteId: request.id };
  }

  progressSegmentClass(item: QuoteTimelineItem): string {
    if (item.tone !== "done") {
      return "bg-slate-300 text-white shadow-sm";
    }

    switch (item.label.toLowerCase()) {
      case "requested":
        return "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-sm";
      case "contacted":
        return "bg-gradient-to-r from-sky-500 to-cyan-500 text-white shadow-sm";
      case "sent":
        return "bg-gradient-to-r from-indigo-500 to-blue-500 text-white shadow-sm";
      case "accepted":
        return "bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow-sm";
      case "deposit":
        return "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm";
      case "converted":
        return "bg-gradient-to-r from-gray-800 to-slate-700 text-white shadow-sm";
      case "declined":
      case "canceled":
        return "bg-gradient-to-r from-rose-500 to-red-500 text-white shadow-sm";
      default:
        return "bg-brand text-white shadow-sm";
    }
  }

  private async autoSaveSelectedQuote(): Promise<boolean> {
    const request = this.selectedRequest();
    if (!request) return false;

    if (this.savingQuote()) {
      this.pendingAutoSave = true;
      return false;
    }

    this.savingQuote.set(true);
    this.drawerError.set(null);
    this.showAutoSaveLoadingToast();

    try {
      const updated = await firstValueFrom(
        this.bookingApi.updateQuoteRequest(request.id, this.buildQuotePayload()),
      );

      this.replaceRequest(updated);
      this.patchQuoteForm(updated);
      this.showAutoSaveSuccessToast();
      return true;
    } catch (error) {
      console.error(error);
      this.drawerError.set("Failed to save quote details.");
      this.showAutoSaveErrorToast();
      return false;
    } finally {
      this.savingQuote.set(false);

      if (this.pendingAutoSave && this.selectedRequest()) {
        this.pendingAutoSave = false;
        window.setTimeout(() => void this.autoSaveSelectedQuote(), 0);
      }
    }
  }

  private buildQuotePayload(): BookingQuoteRequestPatch {
    const formValue = this.quoteForm.getRawValue();
    const depositRequired = Boolean(formValue.depositRequired);

    return {
      partCostCents: this.dollarsToCents(formValue.partCost),
      laborCents: this.dollarsToCents(formValue.labor),
      tripFeeCents: this.dollarsToCents(formValue.tripFee),
      estimatedSubtotalCents: this.dollarsToCents(formValue.subtotal),
      estimatedTotalCents: this.dollarsToCents(formValue.total),
      depositRequired,
      depositAmountCents: depositRequired
        ? this.dollarsToCents(formValue.depositAmount)
        : null,
      customerMessage: this.cleanText(formValue.customerMessage),
      internalNotes: this.cleanText(formValue.internalNotes),
    };
  }

  private showAutoSaveLoadingToast(): void {
    this.dismissAutoSaveToast();
    this.autoSaveToastId = this.toast.loading("Saving quote changes...");
  }

  private showAutoSaveSuccessToast(): void {
    this.dismissAutoSaveToast();
    this.toast.success("Quote changes saved");
  }

  private showAutoSaveErrorToast(): void {
    this.dismissAutoSaveToast();
    this.toast.error("Autosave failed", "Quote details were not saved.");
  }

  private dismissAutoSaveToast(): void {
    if (this.autoSaveToastId === undefined) return;
    this.toast.dismiss(this.autoSaveToastId);
    this.autoSaveToastId = undefined;
  }

  private async updateRequestStatus(
    request: BookingQuoteRequest,
    requestStatus: BookingQuoteRequestStatus,
  ): Promise<void> {
    if (this.updatingId()) return;

    this.updatingId.set(request.id);
    this.error.set(null);
    this.drawerError.set(null);

    try {
      const updated = await firstValueFrom(
        this.bookingApi.updateQuoteRequest(request.id, { requestStatus }),
      );

      this.replaceRequest(updated);
      if (this.selectedRequestId() === updated.id) {
        this.patchQuoteForm(updated);
      }
      this.toast.success(this.requestStatusToastMessage(requestStatus));
    } catch (error) {
      console.error(error);
      this.error.set("Failed to update quote request.");
      this.drawerError.set("Failed to update quote request.");
      this.toast.error("Failed to update quote request");
    } finally {
      this.updatingId.set(null);
    }
  }

  private async runQuoteAction(
    request: BookingQuoteRequest,
    action: "send" | "accept" | "decline" | "convert",
    operation: () => ReturnType<BookingAdminService["sendQuoteRequest"]>,
  ): Promise<void> {
    if (this.actionId()) return;

    this.actionId.set(`${request.id}:${action}`);
    this.drawerError.set(null);

    try {
      const updated = await firstValueFrom(operation());
      this.replaceRequest(updated);
      this.patchQuoteForm(updated);
      this.toast.success(this.quoteActionToastMessage(action));
    } catch (error) {
      console.error(error);
      this.drawerError.set(`Failed to ${this.quoteActionVerb(action)} quote.`);
      this.toast.error(`Failed to ${this.quoteActionVerb(action)} quote`);
    } finally {
      this.actionId.set(null);
    }
  }

  private requestStatusToastMessage(status: BookingQuoteRequestStatus): string {
    switch (status) {
      case "contacted":
        return "Quote request marked contacted";
      case "canceled":
        return "Quote request canceled";
      case "new":
      default:
        return "Quote request restored";
    }
  }

  private quoteActionToastMessage(action: "send" | "accept" | "decline" | "convert"): string {
    switch (action) {
      case "send":
        return "Quote link generated";
      case "accept":
        return "Quote approved";
      case "decline":
        return "Quote declined";
      case "convert":
        return "Repair created from quote";
    }
  }

  private quoteActionVerb(action: "send" | "accept" | "decline" | "convert"): string {
    switch (action) {
      case "send":
        return "send";
      case "accept":
        return "approve";
      case "decline":
        return "decline";
      case "convert":
        return "convert";
    }
  }

  private replaceRequest(updated: BookingQuoteRequest): void {
    this.requests.update((current) =>
      current.map((item) => (item.id === updated.id ? updated : item)),
    );
  }

  private patchQuoteForm(request: BookingQuoteRequest): void {
    this.quoteForm.patchValue(
      {
        partCost: this.centsToDollars(request.partCostCents),
        labor: this.centsToDollars(request.laborCents),
        tripFee: this.centsToDollars(request.tripFeeCents),
        subtotal: this.centsToDollars(request.estimatedSubtotalCents),
        total: this.centsToDollars(request.estimatedTotalCents),
        depositRequired: Boolean(request.depositRequired),
        depositAmount: this.centsToDollars(request.depositAmountCents),
        customerMessage: request.customerMessage ?? "",
        internalNotes: request.internalNotes ?? "",
      },
      { emitEvent: false },
    );
  }

  private centsToDollars(cents: number | null | undefined): string {
    if (cents === null || cents === undefined) return "";
    return (cents / 100).toFixed(2);
  }

  private dollarsToCents(value: string | number | null | undefined): number | null {
    const raw = String(value ?? "")
      .replace(/[$,]/g, "")
      .trim();

    if (!raw) return null;

    const amount = Number(raw);
    if (!Number.isFinite(amount)) return null;

    return Math.round(amount * 100);
  }

  private cleanText(value: string | null | undefined): string | null {
    const text = (value ?? "").trim();
    return text ? text : null;
  }

  private matchesSearch(request: BookingQuoteRequest, search: string): boolean {
    return [
      request.id,
      request.requestStatus,
      request.quoteStatus,
      request.category ?? "",
      request.brand ?? "",
      request.model ?? "",
      request.techspecsProductId ?? "",
      request.serviceMode ?? "",
      request.confidence,
      request.repairNeed?.label ?? "",
      request.repairNeed?.code ?? "",
      request.customer.name ?? "",
      request.customer.email ?? "",
      request.customer.phone ?? "",
      request.customerNotes ?? "",
      request.customerMessage ?? "",
      request.internalNotes ?? "",
      request.address?.line1 ?? "",
      request.address?.line2 ?? "",
      request.address?.city ?? "",
      request.address?.state ?? "",
      request.address?.postalCode ?? "",
    ]
      .join(" ")
      .toLowerCase()
      .includes(search);
  }

  private compareRequests(
    a: BookingQuoteRequest,
    b: BookingQuoteRequest,
    key: QuoteRequestSortKey,
  ): number {
    switch (key) {
      case "request":
        return this.compareStrings(a.requestStatus, b.requestStatus);
      case "customer":
        return this.compareStrings(
          this.customerLabel(a),
          this.customerLabel(b),
        );
      case "device":
        return this.compareStrings(this.deviceLabel(a), this.deviceLabel(b));
      case "repair":
        return this.compareStrings(
          a.repairNeed?.label || "",
          b.repairNeed?.label || "",
        );
      case "quote":
        return this.compareNumbers(
          a.estimatedTotalCents ?? -1,
          b.estimatedTotalCents ?? -1,
        );
      case "submitted":
        return this.compareNumbers(
          this.requestDate(a)?.getTime() ?? 0,
          this.requestDate(b)?.getTime() ?? 0,
        );
      default:
        return 0;
    }
  }

  private compareStrings(a: string, b: string): number {
    return a.localeCompare(b, undefined, { sensitivity: "base" });
  }

  private compareNumbers(a: number, b: number): number {
    return a - b;
  }
}
