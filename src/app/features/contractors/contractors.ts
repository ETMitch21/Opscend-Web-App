import {
    ChangeDetectionStrategy,
    Component,
    computed,
    inject,
    signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
    FormBuilder,
    ReactiveFormsModule,
    Validators,
} from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
    CheckIcon,
    ChevronDownIcon,
    CirclePlusIcon,
    Loader2Icon,
    ShieldCheckIcon,
    HandshakeIcon,
    XIcon,
    LucideAngularModule,
} from 'lucide-angular';

import { AppConfigService } from '../../core/app-config/app-config.service';
import { ToastService } from '../../core/toast/toast-service';
import { ContractorsStore } from '../../core/contractors/contractors.store';
import {
    ContractorAgreementStatus,
    ContractorBackgroundStatus,
    ContractorProfile,
    ContractorStatus,
    ContractorTier,
} from '../../core/contractors/contractor.model';
import { ContractorPayoutStatus } from '../../core/contractor-payout/contractor-payout.model';

interface ServiceOption {
    id: string;
    name: string;
}

interface ServiceListResponse {
    data: ServiceOption[];
    nextCursor?: string | null;
}

type ContractorFilter = 'all' | 'active' | 'inactive';

@Component({
    selector: 'app-contractors',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, LucideAngularModule],
    templateUrl: './contractors.html',
    styleUrl: './contractors.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Contractors {
    private readonly fb = inject(FormBuilder);
    private readonly http = inject(HttpClient);
    private readonly appConfig = inject(AppConfigService);
    private readonly toast = inject(ToastService);

    readonly contractorsStore = inject(ContractorsStore);

    readonly chevronDownIcon = ChevronDownIcon;
    readonly circlePlusIcon = CirclePlusIcon;
    readonly checkIcon = CheckIcon;
    readonly xIcon = XIcon;
    readonly handshakeIcon = HandshakeIcon;
    readonly shieldCheckIcon = ShieldCheckIcon;
    readonly loaderIcon = Loader2Icon;

    readonly createModalOpen = signal(false);
    readonly drawerOpen = signal(false);
    readonly selectedContractor = signal<ContractorProfile | null>(null);

    readonly services = signal<ServiceOption[]>([]);
    readonly loadingServices = signal(false);
    readonly selectedServiceIds = signal<Set<string>>(new Set());

    readonly activeFilter = signal<ContractorFilter>('all');
    readonly searchTerm = signal('');

    readonly tiers: ReadonlyArray<ContractorTier> = [
        'starter',
        'pro',
        'diamond',
    ];

    readonly createForm = this.fb.nonNullable.group({
        name: ['', [Validators.required, Validators.maxLength(120)]],
        email: ['', [Validators.required, Validators.email]],
        password: ['', [Validators.required, Validators.minLength(8)]],
        tier: this.fb.nonNullable.control<ContractorTier>('starter', {
            validators: [Validators.required],
        }),
        isActive: [false],
    });

    readonly filteredContractors = computed(() => {
        const filter = this.activeFilter();
        const search = this.searchTerm().trim().toLowerCase();

        let contractors = [...(this.contractorsStore.items() ?? [])];

        if (filter === 'active') {
            contractors = contractors.filter((contractor) => contractor.isActive);
        }

        if (filter === 'inactive') {
            contractors = contractors.filter((contractor) => !contractor.isActive);
        }

        if (search) {
            contractors = contractors.filter((contractor) =>
                this.matchesSearch(contractor, search)
            );
        }

        return contractors.sort((a, b) =>
            this.getContractorName(a).localeCompare(this.getContractorName(b))
        );
    });

    readonly counts = computed(() => {
        const contractors = this.contractorsStore.items() ?? [];

        return {
            all: contractors.length,
            active: contractors.filter((contractor) => contractor.isActive).length,
            inactive: contractors.filter((contractor) => !contractor.isActive).length,
        };
    });

    async ngOnInit(): Promise<void> {
        await Promise.all([
            this.contractorsStore.load({ limit: 50 }),
            this.loadServices(),
        ]);
    }

    setFilter(filter: ContractorFilter): void {
        this.activeFilter.set(filter);
    }

    setSearchTerm(value: string): void {
        this.searchTerm.set(value);
    }

    openCreateModal(): void {
        this.createForm.reset({
            name: '',
            email: '',
            password: this.generateTemporaryPassword(),
            tier: 'starter',
            isActive: false,
        });

        this.selectedServiceIds.set(new Set());
        this.createModalOpen.set(true);
    }

    closeCreateModal(): void {
        this.createModalOpen.set(false);
        this.createForm.reset({
            name: '',
            email: '',
            password: '',
            tier: 'starter',
            isActive: false,
        });
        this.selectedServiceIds.set(new Set());
    }

    async openContractorDrawer(contractor: ContractorProfile): Promise<void> {
        this.selectedContractor.set(contractor);
        this.drawerOpen.set(true);

        const [metrics, onboarding] = await Promise.all([
            this.contractorsStore.getMetrics(contractor.id),
            this.contractorsStore.getOnboarding(contractor.id),
        ]);

        if (!metrics) {
            this.toast.error(
                'Metrics not loaded',
                this.contractorsStore.error() ?? 'Unable to load contractor metrics.'
            );
        }

        if (!onboarding) {
            this.toast.error(
                'Onboarding not loaded',
                this.contractorsStore.error() ?? 'Unable to load contractor onboarding.'
            );
        }
    }

    closeContractorDrawer(): void {
        this.drawerOpen.set(false);
        this.selectedContractor.set(null);
        this.contractorsStore.clearSelected();
    }

    async createContractor(): Promise<void> {
        if (this.createForm.invalid) {
            this.createForm.markAllAsTouched();
            return;
        }

        const value = this.createForm.getRawValue();

        const contractor = await this.contractorsStore.createWithUser({
            name: value.name.trim(),
            email: value.email.trim().toLowerCase(),
            password: value.password,
            tier: value.tier,
            isActive: value.isActive,
            serviceIds: [...this.selectedServiceIds()],
            availableForJobs: false,
        });

        if (!contractor) {
            this.toast.error(
                'Contractor not created',
                this.contractorsStore.error() ?? 'Something went wrong.'
            );
            return;
        }

        this.toast.success(
            'Contractor created',
            `${contractor.user.name} can now sign in to the contractor app.`
        );

        this.closeCreateModal();
    }

    async toggleContractorStatus(contractor: ContractorProfile): Promise<void> {
        if (contractor.isActive) {
            const updated = await this.contractorsStore.deactivate(contractor.id);

            if (!updated) {
                this.toast.error(
                    'Contractor not updated',
                    this.contractorsStore.error() ?? 'Something went wrong.'
                );
                return;
            }

            this.toast.success(
                'Contractor deactivated',
                `${updated.user.name} is now inactive.`
            );

            await this.contractorsStore.getOnboarding(contractor.id);
            return;
        }

        const updated = await this.contractorsStore.activate(contractor.id);

        if (!updated) {
            this.toast.error(
                'Activation blocked',
                this.contractorsStore.error() ?? 'Contractor cannot be activated yet.'
            );
            await this.contractorsStore.getOnboarding(contractor.id);
            return;
        }

        this.toast.success(
            'Contractor activated',
            `${updated.user.name} is now active.`
        );

        await this.contractorsStore.getOnboarding(contractor.id);
    }

    async refresh(): Promise<void> {
        await this.contractorsStore.load();
    }

    async loadMore(): Promise<void> {
        await this.contractorsStore.loadMore();
    }

    async markAgreementAccepted(contractor: ContractorProfile): Promise<void> {
        const onboarding = await this.contractorsStore.updateOnboarding(contractor.id, {
            agreementStatus: 'accepted',
        });

        if (!onboarding) {
            this.toast.error(
                'Agreement not updated',
                this.contractorsStore.error() ?? 'Unable to update agreement status.'
            );
            return;
        }

        this.toast.success('Agreement accepted', 'Contractor agreement marked accepted.');
    }

    async markBackgroundClear(contractor: ContractorProfile): Promise<void> {
        const onboarding = await this.contractorsStore.updateOnboarding(contractor.id, {
            backgroundStatus: 'clear',
        });

        if (!onboarding) {
            this.toast.error(
                'Background not updated',
                this.contractorsStore.error() ?? 'Unable to update background status.'
            );
            return;
        }

        this.toast.success('Background cleared', 'Background status marked clear.');
    }

    async markOnboardingInProgress(contractor: ContractorProfile): Promise<void> {
        const onboarding = await this.contractorsStore.updateOnboarding(contractor.id, {
            status: 'onboarding',
            isActive: false,
            availableForJobs: false,
        });

        if (!onboarding) {
            this.toast.error(
                'Onboarding not updated',
                this.contractorsStore.error() ?? 'Unable to update onboarding status.'
            );
            return;
        }

        this.toast.success('Onboarding updated', 'Contractor moved to onboarding.');
    }

    prettyContractorStatus(status: ContractorStatus | string | null | undefined): string {
        switch (status) {
            case 'invited':
                return 'Invited';
            case 'onboarding':
                return 'Onboarding';
            case 'active':
                return 'Active';
            case 'suspended':
                return 'Suspended';
            case 'rejected':
                return 'Rejected';
            case 'offboarded':
                return 'Offboarded';
            default:
                return 'Unknown';
        }
    }

    prettyAgreementStatus(status: ContractorAgreementStatus | string | null | undefined): string {
        switch (status) {
            case 'not_required':
                return 'Not Required';
            case 'pending':
                return 'Pending';
            case 'accepted':
                return 'Accepted';
            case 'expired':
                return 'Expired';
            default:
                return 'Unknown';
        }
    }

    prettyBackgroundStatus(status: ContractorBackgroundStatus | string | null | undefined): string {
        switch (status) {
            case 'not_required':
                return 'Not Required';
            case 'pending':
                return 'Pending';
            case 'clear':
                return 'Clear';
            case 'review':
                return 'Review';
            case 'failed':
                return 'Failed';
            case 'expired':
                return 'Expired';
            default:
                return 'Unknown';
        }
    }

    prettyPayoutStatus(status: ContractorPayoutStatus | string | null | undefined): string {
        switch (status) {
            case 'not_started':
                return 'Not Started';
            case 'onboarding_required':
                return 'Onboarding Required';
            case 'pending_verification':
                return 'Pending Verification';
            case 'enabled':
                return 'Enabled';
            case 'restricted':
                return 'Restricted';
            case 'disabled':
                return 'Disabled';
            default:
                return 'Unknown';
        }
    }

    onboardingPillClasses(value: string | null | undefined): string {
        switch (value) {
            case 'active':
            case 'accepted':
            case 'clear':
            case 'enabled':
                return 'bg-emerald-50 text-emerald-700 ring-emerald-100';
            case 'pending':
            case 'onboarding':
            case 'pending_verification':
            case 'onboarding_required':
            case 'invited':
                return 'bg-amber-50 text-amber-700 ring-amber-100';
            case 'suspended':
            case 'rejected':
            case 'failed':
            case 'restricted':
            case 'disabled':
            case 'expired':
                return 'bg-red-50 text-red-700 ring-red-100';
            default:
                return 'bg-gray-50 text-gray-600 ring-gray-200';
        }
    }

    toggleService(serviceId: string): void {
        this.selectedServiceIds.update((current) => {
            const next = new Set(current);

            if (next.has(serviceId)) {
                next.delete(serviceId);
            } else {
                next.add(serviceId);
            }

            return next;
        });
    }

    isServiceSelected(serviceId: string): boolean {
        return this.selectedServiceIds().has(serviceId);
    }

    getContractorName(contractor: ContractorProfile): string {
        return contractor.user?.name || 'Unnamed contractor';
    }

    getContractorEmail(contractor: ContractorProfile): string {
        return contractor.user?.email || 'No email';
    }

    getCapabilitySummary(contractor: ContractorProfile): string {
        if (!contractor.capabilities?.length) {
            return 'No services assigned';
        }

        if (contractor.capabilities.length === 1) {
            return contractor.capabilities[0]?.serviceName ?? '1 service';
        }

        return `${contractor.capabilities.length} services`;
    }

    prettyTier(tier: ContractorTier | string | null | undefined): string {
        switch (tier) {
            case 'starter':
                return 'Starter';
            case 'pro':
                return 'Pro';
            case 'diamond':
                return 'Diamond';
            default:
                return 'Starter';
        }
    }

    prettyStanding(standing: string | null | undefined): string {
        switch (standing) {
            case 'warning':
                return 'Warning';
            case 'probation':
                return 'Probation';
            case 'review':
                return 'Review Needed';
            case 'good':
            default:
                return 'Good Standing';
        }
    }

    standingPillClasses(standing: string | null | undefined): string {
        switch (standing) {
            case 'review':
                return 'bg-red-50 text-red-700 ring-red-100';
            case 'probation':
                return 'bg-orange-50 text-orange-700 ring-orange-100';
            case 'warning':
                return 'bg-amber-50 text-amber-700 ring-amber-100';
            case 'good':
            default:
                return 'bg-emerald-50 text-emerald-700 ring-emerald-100';
        }
    }

    formatRate(value: number | null | undefined): string {
        return `${Math.round((value ?? 0) * 100)}%`;
    }

    formatMoney(cents: number | null | undefined): string {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
        }).format((cents ?? 0) / 100);
    }

    tierPillClasses(tier: ContractorTier | string): string {
        switch (tier) {
            case 'diamond':
                return 'bg-purple-50 text-purple-700 ring-purple-100';
            case 'pro':
                return 'bg-blue-50 text-blue-700 ring-blue-100';
            case 'starter':
            default:
                return 'bg-gray-50 text-gray-600 ring-gray-200';
        }
    }

    private async loadServices(): Promise<void> {
        this.loadingServices.set(true);

        try {
            const params = new HttpParams().set('limit', '100');

            const response = await firstValueFrom(
                this.http.get<ServiceListResponse>(
                    `${this.appConfig.config.apiBase}/services`,
                    { params }
                )
            );

            this.services.set(
                [...(response.data ?? [])].sort((a, b) =>
                    a.name.localeCompare(b.name)
                )
            );
        } catch (error) {
            console.error(error);
            this.services.set([]);
        } finally {
            this.loadingServices.set(false);
        }
    }

    private matchesSearch(
        contractor: ContractorProfile,
        search: string
    ): boolean {
        const haystack = [
            contractor.id,
            contractor.user?.name,
            contractor.user?.email,
            contractor.tier,
            contractor.isActive ? 'active' : 'inactive',
            ...(contractor.capabilities ?? []).map((capability) => capability.serviceName),
        ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();

        return haystack.includes(search);
    }

    private generateTemporaryPassword(): string {
        const random = Math.random().toString(36).slice(2, 8);
        return `Opscend-${random}!`;
    }
}