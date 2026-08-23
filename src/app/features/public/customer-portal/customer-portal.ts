import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import type { StripeCardElement } from '@stripe/stripe-js';
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Clock3,
  CreditCard,
  FileSignature,
  FileText,
  ExternalLink,
  History,
  Inbox,
  Loader2,
  LogOut,
  LucideAngularModule,
  Mail,
  MessageCircle,
  PackageCheck,
  Pencil,
  Plus,
  ReceiptText,
  RefreshCw,
  Save,
  Send,
  ShieldCheck,
  Smartphone,
  Trash2,
  UserRound,
  Users,
  WalletCards,
  Wrench,
  X,
  XCircle,
  type LucideIconData,
} from 'lucide-angular';

import { CustomerPortalService } from '../../../core/customer-portal/service';
import {
  CustomerPortalBusinessContact,
  CustomerPortalDashboard,
  CustomerPortalDevice,
  CustomerPortalDeviceCatalogBrand,
  CustomerPortalDeviceCatalogCategory,
  CustomerPortalDeviceCatalogModel,
  CustomerPortalMessage,
  CustomerPortalOrder,
  CustomerPortalPaymentIntentResponse,
  CustomerPortalQuote,
  CustomerPortalRepair,
  CustomerPortalSessionResponse,
  CustomerPortalShop,
} from '../../../core/customer-portal/model';
import { StripeService } from '../../../core/stripe/stripe-service';

type CustomerPortalTab =
  | 'overview'
  | 'repairs'
  | 'quotes'
  | 'billing'
  | 'forms'
  | 'devices'
  | 'business';

type CustomerPortalScreen = 'login' | 'link-sent' | 'portal';

@Component({
  selector: 'app-customer-portal',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, LucideAngularModule],
  templateUrl: './customer-portal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerPortal implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly portalApi = inject(CustomerPortalService);
  private readonly stripeService = inject(StripeService);

  @ViewChild('cardMount') private cardMount?: ElementRef<HTMLDivElement>;

  readonly icons = {
    ArrowLeft,
    Building2,
    CalendarDays,
    Check,
    CheckCircle2,
    ChevronRight,
    CircleDollarSign,
    ClipboardList,
    Clock3,
    CreditCard,
    ExternalLink,
    FileSignature,
    FileText,
    History,
    Inbox,
    Loader2,
    LogOut,
    Mail,
    MessageCircle,
    PackageCheck,
    Pencil,
    Plus,
    ReceiptText,
    RefreshCw,
    Save,
    Send,
    ShieldCheck,
    Smartphone,
    Trash2,
    UserRound,
    Users,
    WalletCards,
    Wrench,
    X,
    XCircle,
  };

  readonly shopSlug = signal('');
  readonly screen = signal<CustomerPortalScreen>('login');
  readonly activeTab = signal<CustomerPortalTab>('overview');
  readonly loading = signal(true);
  readonly refreshing = signal(false);
  readonly configError = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly notice = signal<string | null>(null);

  readonly shop = signal<CustomerPortalShop | null>(null);
  readonly session = signal<CustomerPortalSessionResponse | null>(null);
  readonly dashboard = signal<CustomerPortalDashboard | null>(null);

  readonly email = signal('');
  readonly requestingLink = signal(false);
  readonly verifyingLink = signal(false);

  readonly selectedRepair = signal<CustomerPortalRepair | null>(null);
  readonly repairDetailLoading = signal(false);
  readonly repairMessages = signal<CustomerPortalMessage[]>([]);
  readonly messageDraft = signal('');
  readonly sendingMessage = signal(false);

  readonly paymentOrder = signal<CustomerPortalOrder | null>(null);
  readonly paymentIntent = signal<CustomerPortalPaymentIntentResponse | null>(null);
  readonly paymentLoading = signal(false);
  readonly paymentSubmitting = signal(false);
  readonly paymentError = signal<string | null>(null);
  private paymentCard: StripeCardElement | null = null;

  readonly fleetRequestDevice = signal<CustomerPortalDevice | null>(null);
  readonly fleetRequestProblem = signal('');
  readonly fleetRequestPo = signal('');
  readonly fleetRequestNotes = signal('');
  readonly fleetRequestSubmitting = signal(false);

  readonly businessBusy = signal(false);
  readonly accountEditing = signal(false);
  readonly businessNameDraft = signal('');
  readonly businessLegalNameDraft = signal('');
  readonly businessBillingEmailDraft = signal('');
  readonly businessBillingPhoneDraft = signal('');

  readonly contactEditorId = signal<string | 'new' | null>(null);
  readonly contactNameDraft = signal('');
  readonly contactTitleDraft = signal('');
  readonly contactEmailDraft = signal('');
  readonly contactPhoneDraft = signal('');
  readonly contactPrimaryDraft = signal(false);
  readonly contactBillingDraft = signal(false);
  readonly contactAuthorizeDraft = signal(true);
  readonly contactUpdatesDraft = signal(true);

  readonly deviceEditorId = signal<string | 'new' | null>(null);
  readonly deviceCatalogCategories = signal<CustomerPortalDeviceCatalogCategory[]>([]);
  readonly deviceCatalogBrands = signal<CustomerPortalDeviceCatalogBrand[]>([]);
  readonly deviceCatalogModels = signal<CustomerPortalDeviceCatalogModel[]>([]);
  readonly deviceCatalogLoading = signal(false);
  readonly deviceCategoryDraft = signal('');
  readonly deviceBrandDraft = signal('');
  readonly deviceCatalogRefDraft = signal('');
  readonly deviceAssetTagDraft = signal('');
  readonly deviceSerialDraft = signal('');
  readonly deviceImeiDraft = signal('');
  readonly deviceAssignedNameDraft = signal('');
  readonly deviceAssignedEmailDraft = signal('');
  readonly deviceDepartmentDraft = signal('');
  readonly deviceStatusDraft = signal<'active' | 'spare' | 'retired' | 'lost'>('active');
  readonly deviceCoveredDraft = signal(true);

  readonly displayShop = computed(() => this.dashboard()?.shop ?? this.shop());
  readonly customer = computed(() => this.dashboard()?.customer ?? this.session()?.customer ?? null);
  readonly business = computed(() => this.dashboard()?.business ?? null);
  readonly viewerContact = computed(() => this.business()?.viewerContact ?? null);
  readonly viewerName = computed(() => this.viewerContact()?.name?.trim() || this.customer()?.name?.trim() || 'Customer');
  readonly viewerEmail = computed(() => this.viewerContact()?.email?.trim() || this.session()?.account.email || this.customer()?.email || '');
  readonly firstName = computed(() => this.viewerName().split(/\s+/)[0] || 'there');
  readonly fleetDevices = computed(() => {
    const businessId = this.business()?.id;
    return (this.dashboard()?.devices ?? []).filter((device) => !businessId || device.businessAccountId === businessId);
  });

  readonly brandColor = computed(() => {
    const value = this.displayShop()?.primaryColor?.trim();
    return value && /^#[0-9a-f]{6}$/i.test(value) ? value : '#111827';
  });

  readonly brandTint = computed(() => `${this.brandColor()}12`);
  readonly brandRing = computed(() => `${this.brandColor()}2b`);

  readonly allRepairs = computed(() => [
    ...(this.dashboard()?.activeRepairs ?? []),
    ...(this.dashboard()?.repairHistory ?? []),
  ]);

  readonly upcomingAppointments = computed(() =>
    (this.dashboard()?.activeRepairs ?? [])
      .filter((repair) => {
        const appointment = repair.appointment;
        return Boolean(
          appointment &&
            appointment.status === 'scheduled' &&
            new Date(appointment.startAt).getTime() >= Date.now(),
        );
      })
      .sort(
        (left, right) =>
          new Date(left.appointment!.startAt).getTime() -
          new Date(right.appointment!.startAt).getTime(),
      ),
  );

  readonly quotesNeedingAction = computed(() =>
    (this.dashboard()?.quotes ?? []).filter((quote) =>
      ['quoted', 'sent', 'accepted', 'deposit_pending'].includes(quote.status),
    ),
  );

  readonly outstandingOrders = computed(() =>
    (this.dashboard()?.orders ?? []).filter((order) => order.balanceCents > 0),
  );

  readonly tabs: ReadonlyArray<{
    key: CustomerPortalTab;
    label: string;
    icon: LucideIconData;
  }> = [
    { key: 'overview', label: 'Home', icon: Inbox },
    { key: 'repairs', label: 'Repairs', icon: Wrench },
    { key: 'quotes', label: 'Quotes', icon: FileText },
    { key: 'billing', label: 'Billing', icon: WalletCards },
    { key: 'forms', label: 'Forms', icon: ClipboardList },
    { key: 'devices', label: 'Devices', icon: Smartphone },
    { key: 'business', label: 'Business account', icon: Building2 },
  ];

  readonly visibleTabs = computed(() =>
    this.tabs.filter((tab) => tab.key !== 'business' || Boolean(this.business())),
  );

  ngOnInit(): void {
    void this.initialize();
  }

  ngOnDestroy(): void {
    this.destroyPaymentCard();
  }

  private async initialize(): Promise<void> {
    const shopSlug = this.route.snapshot.paramMap.get('shopSlug')?.trim().toLowerCase() ?? '';
    this.shopSlug.set(shopSlug);

    if (!shopSlug) {
      this.configError.set('This customer portal link is incomplete.');
      this.loading.set(false);
      return;
    }

    try {
      const config = await firstValueFrom(this.portalApi.getConfig(shopSlug));
      this.shop.set(config.shop);
    } catch {
      this.configError.set('This customer portal could not be found.');
      this.loading.set(false);
      return;
    }

    const verificationToken = this.route.snapshot.queryParamMap.get('token');
    if (verificationToken) {
      await this.verifyMagicLink(verificationToken);
      return;
    }

    if (this.portalApi.getSessionToken(shopSlug)) {
      try {
        const session = await firstValueFrom(this.portalApi.validateSession(shopSlug));
        this.session.set(session);
        this.screen.set('portal');
        await this.loadDashboard();
        return;
      } catch {
        this.portalApi.clearSessionToken(shopSlug);
      }
    }

    this.screen.set('login');
    this.loading.set(false);
  }

  async requestMagicLink(): Promise<void> {
    const email = this.email().trim();
    if (!email || this.requestingLink()) return;

    this.requestingLink.set(true);
    this.actionError.set(null);
    this.notice.set(null);

    try {
      await firstValueFrom(this.portalApi.requestLink(this.shopSlug(), email));
      this.screen.set('link-sent');
    } catch {
      this.actionError.set('We could not send the sign-in link. Please try again.');
    } finally {
      this.requestingLink.set(false);
    }
  }

  backToLogin(): void {
    this.actionError.set(null);
    this.screen.set('login');
  }

  private async verifyMagicLink(token: string): Promise<void> {
    this.verifyingLink.set(true);
    this.actionError.set(null);

    try {
      const response = await firstValueFrom(
        this.portalApi.verifyLink(this.shopSlug(), token),
      );

      if (!response.sessionToken) {
        throw new Error('Missing customer portal session token.');
      }

      this.portalApi.saveSessionToken(this.shopSlug(), response.sessionToken);
      this.session.set(response);
      this.screen.set('portal');

      await this.router.navigate(['/portal', this.shopSlug()], {
        replaceUrl: true,
      });
    } catch {
      this.portalApi.clearSessionToken(this.shopSlug());
      this.screen.set('login');
      this.actionError.set('This sign-in link is invalid or has expired. Request a new link below.');
      this.loading.set(false);
    } finally {
      this.verifyingLink.set(false);
    }
  }

  async loadDashboard(showRefresh = false): Promise<void> {
    if (showRefresh) this.refreshing.set(true);
    else this.loading.set(true);

    this.actionError.set(null);

    try {
      const response = await firstValueFrom(
        this.portalApi.getDashboard(this.shopSlug()),
      );
      this.dashboard.set(response.data);
      this.shop.set(response.data.shop);
      if (this.activeTab() === 'business' && !response.data.business) this.activeTab.set('overview');
      if (!this.accountEditing()) this.populateAccountDrafts();
      this.screen.set('portal');
    } catch {
      this.portalApi.clearSessionToken(this.shopSlug());
      this.dashboard.set(null);
      this.session.set(null);
      this.screen.set('login');
      this.actionError.set('Your portal session expired. Request a new sign-in link.');
    } finally {
      this.loading.set(false);
      this.refreshing.set(false);
    }
  }

  selectTab(tab: CustomerPortalTab): void {
    if (tab === 'business' && !this.business()) return;
    this.activeTab.set(tab);
    this.notice.set(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async openRepair(repair: CustomerPortalRepair): Promise<void> {
    this.selectedRepair.set(repair);
    this.repairDetailLoading.set(true);
    this.repairMessages.set([]);
    this.actionError.set(null);

    try {
      const [repairResponse, messageResponse] = await Promise.all([
        firstValueFrom(this.portalApi.getRepair(this.shopSlug(), repair.id)),
        firstValueFrom(this.portalApi.listMessages(this.shopSlug(), repair.id)),
      ]);

      this.selectedRepair.set(repairResponse.data);
      this.repairMessages.set(messageResponse.messages);

      await firstValueFrom(
        this.portalApi.markMessagesRead(this.shopSlug(), repair.id),
      ).catch(() => undefined);
    } catch {
      this.actionError.set('We could not load this repair. Please try again.');
    } finally {
      this.repairDetailLoading.set(false);
    }
  }

  closeRepair(): void {
    this.selectedRepair.set(null);
    this.repairMessages.set([]);
    this.messageDraft.set('');
    void this.loadDashboard(true);
  }

  async sendMessage(): Promise<void> {
    const repair = this.selectedRepair();
    const message = this.messageDraft().trim();
    if (!repair || !message || this.sendingMessage()) return;

    this.sendingMessage.set(true);
    this.actionError.set(null);

    try {
      const created = await firstValueFrom(
        this.portalApi.sendMessage(this.shopSlug(), repair.id, message),
      );
      this.repairMessages.update((messages) => [...messages, created]);
      this.messageDraft.set('');
    } catch {
      this.actionError.set('Your message could not be sent. Please try again.');
    } finally {
      this.sendingMessage.set(false);
    }
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.portalApi.logout(this.shopSlug()));
    } catch {
      // Clear the local session even when the API cannot be reached.
    }

    this.portalApi.clearSessionToken(this.shopSlug());
    this.dashboard.set(null);
    this.session.set(null);
    this.selectedRepair.set(null);
    this.screen.set('login');
  }

  async openPayment(order: CustomerPortalOrder): Promise<void> {
    if (!order.canPayOnline || order.balanceCents <= 0 || this.paymentLoading()) return;

    this.destroyPaymentCard();
    this.paymentOrder.set(order);
    this.paymentIntent.set(null);
    this.paymentError.set(null);
    this.paymentLoading.set(true);

    try {
      const intent = await firstValueFrom(
        this.portalApi.createOrderPaymentIntent(this.shopSlug(), order.id),
      );
      this.paymentIntent.set(intent);

      window.setTimeout(() => {
        void this.mountPaymentCard(intent);
      }, 0);
    } catch {
      this.paymentError.set('Online payment could not be started. Please contact the shop.');
    } finally {
      this.paymentLoading.set(false);
    }
  }

  private async mountPaymentCard(
    intent: CustomerPortalPaymentIntentResponse,
  ): Promise<void> {
    const mount = this.cardMount?.nativeElement;
    if (!mount || this.paymentOrder()?.id !== intent.orderId) return;

    try {
      const cardResult = await this.stripeService.createCardElement({
        stripeAccountId: intent.stripeAccountId,
      });
      cardResult.card.mount(mount);
      this.paymentCard = cardResult.card;
    } catch {
      this.paymentError.set('The secure payment form could not be loaded.');
    }
  }

  closePayment(): void {
    this.destroyPaymentCard();
    this.paymentOrder.set(null);
    this.paymentIntent.set(null);
    this.paymentError.set(null);
  }

  async submitPayment(): Promise<void> {
    const order = this.paymentOrder();
    const intent = this.paymentIntent();
    const card = this.paymentCard;

    if (!order || !intent || !card || this.paymentSubmitting()) return;

    this.paymentSubmitting.set(true);
    this.paymentError.set(null);

    try {
      const result = await this.stripeService.confirmCardPayment({
        stripeAccountId: intent.stripeAccountId,
        clientSecret: intent.clientSecret,
        card,
      });

      if (result.error) {
        this.paymentError.set(result.error.message || 'The payment was not completed.');
        return;
      }

      if (result.paymentIntent?.status !== 'succeeded') {
        this.paymentError.set('The payment is still processing. Please try again shortly.');
        return;
      }

      await firstValueFrom(
        this.portalApi.recordOrderPayment(
          this.shopSlug(),
          order.id,
          result.paymentIntent.id,
        ),
      );

      this.notice.set(`Payment received for order ${order.orderNumber}.`);
      this.closePayment();
      await this.loadDashboard(true);
    } catch {
      this.paymentError.set('The payment could not be completed. Please try again.');
    } finally {
      this.paymentSubmitting.set(false);
    }
  }

  openFleetRepairRequest(device: CustomerPortalDevice): void {
    if (!this.dashboard()?.business) return;
    this.fleetRequestDevice.set(device);
    this.fleetRequestProblem.set('');
    this.fleetRequestPo.set('');
    this.fleetRequestNotes.set('');
    this.actionError.set(null);
  }

  closeFleetRepairRequest(): void {
    if (this.fleetRequestSubmitting()) return;
    this.fleetRequestDevice.set(null);
    this.fleetRequestProblem.set('');
    this.fleetRequestPo.set('');
    this.fleetRequestNotes.set('');
  }

  async submitFleetRepairRequest(): Promise<void> {
    const device = this.fleetRequestDevice();
    const problemSummary = this.fleetRequestProblem().trim();
    if (!device || !problemSummary || this.fleetRequestSubmitting()) return;
    this.fleetRequestSubmitting.set(true);
    this.actionError.set(null);
    try {
      await firstValueFrom(this.portalApi.submitBusinessRepairRequest(this.shopSlug(), {
        customerDeviceId: device.id,
        problemSummary,
        purchaseOrderNumber: this.fleetRequestPo().trim() || null,
        intakeNotes: this.fleetRequestNotes().trim() || null,
      }));
      this.notice.set(`Repair request submitted for ${this.deviceLabel(device)}.`);
      this.fleetRequestDevice.set(null);
      this.fleetRequestProblem.set('');
      this.fleetRequestPo.set('');
      this.fleetRequestNotes.set('');
      await this.loadDashboard(true);
      this.activeTab.set('repairs');
    } catch (error: any) {
      this.actionError.set(error?.error?.message || 'The repair request could not be submitted.');
    } finally {
      this.fleetRequestSubmitting.set(false);
    }
  }

  setFleetRequestProblem(value: string): void { this.fleetRequestProblem.set(value); }
  setFleetRequestPo(value: string): void { this.fleetRequestPo.set(value); }
  setFleetRequestNotes(value: string): void { this.fleetRequestNotes.set(value); }

  private destroyPaymentCard(): void {
    if (this.paymentCard) {
      this.paymentCard.destroy();
      this.paymentCard = null;
    }
  }

  setEmail(value: string): void {
    this.email.set(value);
  }

  setMessageDraft(value: string): void {
    this.messageDraft.set(value);
  }

  money(cents: number | null | undefined): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(Number(cents ?? 0) / 100);
  }

  date(value: string | null | undefined): string {
    if (!value) return '—';
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(value));
  }

  dateTime(value: string | null | undefined): string {
    if (!value) return '—';
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value));
  }

  relativeDate(value: string | null | undefined): string {
    if (!value) return '';
    const date = new Date(value);
    const diff = Date.now() - date.getTime();
    const minutes = Math.max(0, Math.floor(diff / 60_000));
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return this.date(value);
  }

  deviceName(repair: CustomerPortalRepair): string {
    return (
      repair.device?.nickname ||
      repair.device?.displayName ||
      [repair.device?.brand, repair.device?.model].filter(Boolean).join(' ') ||
      'Device'
    );
  }

  quoteDevice(quote: CustomerPortalQuote): string {
    return [quote.brand, quote.model].filter(Boolean).join(' ') || quote.category || 'Device';
  }

  deviceLabel(device: CustomerPortalDevice): string {
    return device.nickname || device.displayName || [device.brand, device.model].filter(Boolean).join(' ');
  }

  deviceModelLabel(device: CustomerPortalDevice): string {
    return [device.brand, device.model].filter(Boolean).join(' ') || 'Saved device';
  }

  openLatestRepair(repairId: string): void {
    const repair = this.allRepairs().find((item) => item.id === repairId);
    if (repair) void this.openRepair(repair);
  }

  statusClass(status: string): string {
    if (['ready', 'picked_up', 'deposit_paid', 'paid', 'fulfilled'].includes(status)) {
      return 'bg-emerald-50 text-emerald-700 ring-emerald-100';
    }
    if (['canceled', 'declined', 'expired', 'voided'].includes(status)) {
      return 'bg-rose-50 text-rose-700 ring-rose-100';
    }
    if (['awaiting_parts', 'awaiting_approval', 'deposit_pending', 'unpaid'].includes(status)) {
      return 'bg-amber-50 text-amber-700 ring-amber-100';
    }
    return 'bg-blue-50 text-blue-700 ring-blue-100';
  }

  serviceModeLabel(mode: string): string {
    return mode === 'on_site' ? 'On-site' : 'In-shop';
  }

  quoteActionLabel(quote: CustomerPortalQuote): string {
    if (quote.status === 'deposit_pending' || (quote.status === 'accepted' && quote.depositRequired && !quote.depositPaidAt)) {
      return 'Pay deposit';
    }
    if (['quoted', 'sent'].includes(quote.status)) return 'Review quote';
    return 'View quote';
  }

  shopAddress(shop: CustomerPortalShop | null): string {
    if (!shop) return '';
    const cityLine = [shop.addressCity, shop.addressState, shop.addressPostalCode]
      .filter(Boolean)
      .join(', ');
    return [shop.addressLine1, shop.addressLine2, cityLine]
      .filter(Boolean)
      .join(' · ');
  }

  customerInitials(): string {
    const name = this.viewerName() || this.viewerEmail() || 'Customer';
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  }

  billingTermsLabel(value: string | null | undefined): string {
    const labels: Record<string, string> = {
      due_on_receipt: 'Due on receipt',
      net_15: 'Net 15',
      net_30: 'Net 30',
      net_45: 'Net 45',
      net_60: 'Net 60',
    };
    return labels[value || ''] || (value || '—').replace(/_/g, ' ');
  }

  billingIntervalLabel(interval: string | null | undefined, count = 1): string {
    if (!interval) return 'billing period';
    if (interval === 'month') return count > 1 ? `${count} months` : 'month';
    if (interval === 'year') return count > 1 ? `${count} years` : 'year';
    return interval;
  }

  private populateAccountDrafts(): void {
    const business = this.business();
    if (!business) return;
    this.businessNameDraft.set(business.name || '');
    this.businessLegalNameDraft.set(business.legalName || '');
    this.businessBillingEmailDraft.set(business.billingEmail || '');
    this.businessBillingPhoneDraft.set(business.billingPhone || '');
  }

  startAccountEdit(): void {
    this.populateAccountDrafts();
    this.accountEditing.set(true);
    this.actionError.set(null);
  }

  cancelAccountEdit(): void {
    this.accountEditing.set(false);
    this.populateAccountDrafts();
  }

  async saveBusinessAccount(): Promise<void> {
    if (this.businessBusy() || !this.businessNameDraft().trim()) return;
    this.businessBusy.set(true);
    this.actionError.set(null);
    try {
      await firstValueFrom(this.portalApi.updateBusinessAccount(this.shopSlug(), {
        name: this.businessNameDraft().trim(),
        legalName: this.businessLegalNameDraft().trim() || null,
        billingEmail: this.businessBillingEmailDraft().trim() || null,
        billingPhone: this.businessBillingPhoneDraft().trim() || null,
      }));
      this.accountEditing.set(false);
      this.notice.set('Business account details updated.');
      await this.loadDashboard(true);
    } catch (error: any) {
      this.actionError.set(error?.error?.message || 'Business account details could not be updated.');
    } finally {
      this.businessBusy.set(false);
    }
  }

  async openBusinessBillingPortal(): Promise<void> {
    if (this.businessBusy()) return;
    const popup = window.open('', '_blank');
    this.businessBusy.set(true);
    this.actionError.set(null);
    try {
      const response = await firstValueFrom(this.portalApi.openBusinessBillingPortal(this.shopSlug()));
      if (popup) popup.location.href = response.url;
      else window.location.href = response.url;
    } catch (error: any) {
      popup?.close();
      this.actionError.set(error?.error?.message || 'Stripe billing management could not be opened.');
    } finally {
      this.businessBusy.set(false);
    }
  }

  openBusinessAgreement(): void {
    const path = this.business()?.agreement?.documentPath;
    if (!path) return;
    window.open(this.portalApi.resolveApiPath(path), '_blank', 'noopener,noreferrer');
  }

  startNewContact(): void {
    this.contactEditorId.set('new');
    this.contactNameDraft.set('');
    this.contactTitleDraft.set('');
    this.contactEmailDraft.set('');
    this.contactPhoneDraft.set('');
    this.contactPrimaryDraft.set(false);
    this.contactBillingDraft.set(false);
    this.contactAuthorizeDraft.set(true);
    this.contactUpdatesDraft.set(true);
  }

  editBusinessContact(contact: CustomerPortalBusinessContact): void {
    this.contactEditorId.set(contact.id);
    this.contactNameDraft.set(contact.name);
    this.contactTitleDraft.set(contact.title || '');
    this.contactEmailDraft.set(contact.email || '');
    this.contactPhoneDraft.set(contact.phone || '');
    this.contactPrimaryDraft.set(contact.isPrimary);
    this.contactBillingDraft.set(contact.isBilling);
    this.contactAuthorizeDraft.set(contact.canAuthorizeRepairs);
    this.contactUpdatesDraft.set(contact.receivesUpdates);
  }

  cancelContactEdit(): void { this.contactEditorId.set(null); }

  async saveBusinessContact(): Promise<void> {
    const editorId = this.contactEditorId();
    if (!editorId || !this.contactNameDraft().trim() || this.businessBusy()) return;
    this.businessBusy.set(true);
    this.actionError.set(null);
    const payload = {
      name: this.contactNameDraft().trim(),
      title: this.contactTitleDraft().trim() || null,
      email: this.contactEmailDraft().trim() || null,
      phone: this.contactPhoneDraft().trim() || null,
      isPrimary: this.contactPrimaryDraft(),
      isBilling: this.contactBillingDraft(),
      canAuthorizeRepairs: this.contactAuthorizeDraft(),
      receivesUpdates: this.contactUpdatesDraft(),
    };
    try {
      if (editorId === 'new') await firstValueFrom(this.portalApi.addBusinessContact(this.shopSlug(), payload));
      else await firstValueFrom(this.portalApi.updateBusinessContact(this.shopSlug(), editorId, payload));
      this.contactEditorId.set(null);
      this.notice.set(editorId === 'new' ? 'Business contact added.' : 'Business contact updated.');
      await this.loadDashboard(true);
    } catch (error: any) {
      this.actionError.set(error?.error?.message || 'The business contact could not be saved.');
    } finally {
      this.businessBusy.set(false);
    }
  }

  async removeBusinessContact(contact: CustomerPortalBusinessContact): Promise<void> {
    if (this.businessBusy() || !confirm(`Remove ${contact.name} from this business account?`)) return;
    this.businessBusy.set(true);
    this.actionError.set(null);
    try {
      await firstValueFrom(this.portalApi.deleteBusinessContact(this.shopSlug(), contact.id));
      this.notice.set('Business contact removed.');
      await this.loadDashboard(true);
    } catch (error: any) {
      this.actionError.set(error?.error?.message || 'The business contact could not be removed.');
    } finally {
      this.businessBusy.set(false);
    }
  }

  async startNewBusinessDevice(): Promise<void> {
    this.deviceEditorId.set('new');
    this.deviceCategoryDraft.set('');
    this.deviceBrandDraft.set('');
    this.deviceCatalogRefDraft.set('');
    this.deviceCatalogBrands.set([]);
    this.deviceCatalogModels.set([]);
    this.deviceAssetTagDraft.set('');
    this.deviceSerialDraft.set('');
    this.deviceImeiDraft.set('');
    this.deviceAssignedNameDraft.set('');
    this.deviceAssignedEmailDraft.set('');
    this.deviceDepartmentDraft.set('');
    this.deviceStatusDraft.set('active');
    this.deviceCoveredDraft.set(true);
    await this.ensureDeviceCatalogCategories();
  }

  async editBusinessDevice(device: CustomerPortalDevice): Promise<void> {
    this.deviceEditorId.set(device.id);
    this.deviceCategoryDraft.set('');
    this.deviceBrandDraft.set('');
    this.deviceCatalogRefDraft.set(device.catalogRef || '');
    this.deviceCatalogBrands.set([]);
    this.deviceCatalogModels.set([]);
    this.deviceAssetTagDraft.set(device.assetTag || '');
    this.deviceSerialDraft.set(device.serial || '');
    this.deviceImeiDraft.set(device.imei || '');
    this.deviceAssignedNameDraft.set(device.assignedToName || '');
    this.deviceAssignedEmailDraft.set(device.assignedToEmail || '');
    this.deviceDepartmentDraft.set(device.department || '');
    this.deviceStatusDraft.set((device.fleetStatus as 'active' | 'spare' | 'retired' | 'lost') || 'active');
    this.deviceCoveredDraft.set(device.isPlanCovered);

    await this.ensureDeviceCatalogCategories();
    if (!device.catalogRef) return;

    this.deviceCatalogLoading.set(true);
    try {
      const response = await firstValueFrom(this.portalApi.getBusinessDeviceCatalogModel(this.shopSlug(), device.catalogRef));
      const model = response.data;
      this.deviceCategoryDraft.set(model.categoryId);
      this.deviceBrandDraft.set(model.brandId);
      const [brands, models] = await Promise.all([
        firstValueFrom(this.portalApi.listBusinessDeviceCatalogBrands(this.shopSlug(), model.categoryId)),
        firstValueFrom(this.portalApi.listBusinessDeviceCatalogModels(this.shopSlug(), model.brandId)),
      ]);
      this.deviceCatalogBrands.set(brands.data);
      this.deviceCatalogModels.set(models.data);
      this.deviceCatalogRefDraft.set(model.id);
    } catch (error: any) {
      this.actionError.set(
        error?.error?.message ||
        'This saved device is no longer linked to an active catalog model. Choose a current model before saving.',
      );
      this.deviceCatalogRefDraft.set('');
    } finally {
      this.deviceCatalogLoading.set(false);
    }
  }

  cancelDeviceEdit(): void {
    this.deviceEditorId.set(null);
    this.deviceCategoryDraft.set('');
    this.deviceBrandDraft.set('');
    this.deviceCatalogRefDraft.set('');
    this.deviceCatalogBrands.set([]);
    this.deviceCatalogModels.set([]);
  }

  private async ensureDeviceCatalogCategories(): Promise<void> {
    if (this.deviceCatalogCategories().length) return;
    this.deviceCatalogLoading.set(true);
    try {
      const response = await firstValueFrom(this.portalApi.listBusinessDeviceCatalogCategories(this.shopSlug()));
      this.deviceCatalogCategories.set(response.data);
    } catch (error: any) {
      this.actionError.set(error?.error?.message || 'The shop device catalog could not be loaded.');
    } finally {
      this.deviceCatalogLoading.set(false);
    }
  }

  async onDeviceCategoryChange(categoryId: string): Promise<void> {
    this.deviceCategoryDraft.set(categoryId);
    this.deviceBrandDraft.set('');
    this.deviceCatalogRefDraft.set('');
    this.deviceCatalogBrands.set([]);
    this.deviceCatalogModels.set([]);
    if (!categoryId) return;
    this.deviceCatalogLoading.set(true);
    try {
      const response = await firstValueFrom(this.portalApi.listBusinessDeviceCatalogBrands(this.shopSlug(), categoryId));
      this.deviceCatalogBrands.set(response.data);
    } catch (error: any) {
      this.actionError.set(error?.error?.message || 'Device brands could not be loaded.');
    } finally {
      this.deviceCatalogLoading.set(false);
    }
  }

  async onDeviceBrandChange(brandId: string): Promise<void> {
    this.deviceBrandDraft.set(brandId);
    this.deviceCatalogRefDraft.set('');
    this.deviceCatalogModels.set([]);
    if (!brandId) return;
    this.deviceCatalogLoading.set(true);
    try {
      const response = await firstValueFrom(this.portalApi.listBusinessDeviceCatalogModels(this.shopSlug(), brandId));
      this.deviceCatalogModels.set(response.data);
    } catch (error: any) {
      this.actionError.set(error?.error?.message || 'Device models could not be loaded.');
    } finally {
      this.deviceCatalogLoading.set(false);
    }
  }

  setDeviceStatusDraft(value: string): void {
    if (value === 'active' || value === 'spare' || value === 'retired' || value === 'lost') {
      this.deviceStatusDraft.set(value);
    }
  }

  async saveBusinessDevice(): Promise<void> {
    const editorId = this.deviceEditorId();
    const catalogRef = this.deviceCatalogRefDraft().trim();
    if (!editorId || !catalogRef || this.businessBusy()) return;
    this.businessBusy.set(true);
    this.actionError.set(null);
    const payload = {
      catalogRef,
      assetTag: this.deviceAssetTagDraft().trim() || null,
      serial: this.deviceSerialDraft().trim() || null,
      imei: this.deviceImeiDraft().trim() || null,
      assignedToName: this.deviceAssignedNameDraft().trim() || null,
      assignedToEmail: this.deviceAssignedEmailDraft().trim() || null,
      department: this.deviceDepartmentDraft().trim() || null,
      fleetStatus: this.deviceStatusDraft(),
      isPlanCovered: this.deviceCoveredDraft(),
    };
    try {
      if (editorId === 'new') await firstValueFrom(this.portalApi.addBusinessDevice(this.shopSlug(), payload));
      else await firstValueFrom(this.portalApi.updateBusinessDevice(this.shopSlug(), editorId, payload));
      this.cancelDeviceEdit();
      this.notice.set(editorId === 'new' ? 'Fleet device added.' : 'Fleet device updated.');
      await this.loadDashboard(true);
    } catch (error: any) {
      this.actionError.set(error?.error?.message || 'The fleet device could not be saved.');
    } finally {
      this.businessBusy.set(false);
    }
  }

  async retireBusinessDevice(device: CustomerPortalDevice): Promise<void> {
    if (this.businessBusy() || !confirm(`Retire ${this.deviceLabel(device)} from the active fleet?`)) return;
    this.businessBusy.set(true);
    this.actionError.set(null);
    try {
      await firstValueFrom(this.portalApi.updateBusinessDevice(this.shopSlug(), device.id, { fleetStatus: 'retired', isPlanCovered: false }));
      this.notice.set(`${this.deviceLabel(device)} was retired from the fleet.`);
      await this.loadDashboard(true);
    } catch (error: any) {
      this.actionError.set(error?.error?.message || 'The fleet device could not be retired.');
    } finally {
      this.businessBusy.set(false);
    }
  }
}
