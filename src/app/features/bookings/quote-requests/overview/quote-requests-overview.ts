import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from "@angular/core";
import { CommonModule, DatePipe } from "@angular/common";
import { Router } from "@angular/router";
import { firstValueFrom } from "rxjs";
import {
  Building2,
  ChevronDownIcon,
  House,
  LucideAngularModule,
  Search,
} from "lucide-angular";

import { BookingAdminService } from "../../../../core/booking/service";
import { PhonePipe } from "../../../../core/pipes/phone-pipe";
import {
  BookingQuoteRequest,
  BookingQuoteWorkflowStatus,
} from "../../../../core/booking/model";

type QuoteRequestViewFilter = "all" | "new" | "contacted" | "canceled";
type QuoteRequestSortKey =
  | "request"
  | "customer"
  | "device"
  | "repair"
  | "quote"
  | "submitted";
type SortDirection = "asc" | "desc";

@Component({
  selector: "app-quote-requests-overview",
  standalone: true,
  imports: [CommonModule, DatePipe, LucideAngularModule, PhonePipe],
  templateUrl: "./quote-requests-overview.html",
  styleUrl: "./quote-requests-overview.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuoteRequestsOverview {
  private readonly bookingApi = inject(BookingAdminService);
  private readonly router = inject(Router);

  readonly chevronDownIcon = ChevronDownIcon;
  readonly buildingIcon = Building2;
  readonly houseIcon = House;
  readonly searchIcon = Search;

  readonly requests = signal<BookingQuoteRequest[]>([]);
  readonly loading = signal(false);
  readonly loadingMore = signal(false);
  readonly updatingId = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly nextCursor = signal<string | null>(null);

  readonly activeView = signal<QuoteRequestViewFilter>("new");
  readonly searchTerm = signal("");
  readonly serviceMode = signal<"in_shop" | "on_site" | null>(null);
  readonly pageSize = signal(50);

  readonly sortKey = signal<QuoteRequestSortKey>("submitted");
  readonly sortDirection = signal<SortDirection>("desc");

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
    void this.loadRequests();
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
    void this.router.navigate(["/quote-requests", request.id]);
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
    if (request.requiresManualReview || request.confidence === "manual_review") {
      return "Manual review";
    }
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
        return this.compareStrings(this.customerLabel(a), this.customerLabel(b));
      case "device":
        return this.compareStrings(this.deviceLabel(a), this.deviceLabel(b));
      case "repair":
        return this.compareStrings(a.repairNeed?.label || "", b.repairNeed?.label || "");
      case "quote":
        return this.compareNumbers(a.estimatedTotalCents ?? -1, b.estimatedTotalCents ?? -1);
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
