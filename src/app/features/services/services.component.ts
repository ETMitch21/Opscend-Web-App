import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';

import { ServicesService } from '../../core/services/service';
import {
  type CreateServicePayload,
  type PatchServicePayload,
  type Service,
  type ServiceStatus,
} from '../../core/services/model';

type ServiceViewFilter = 'all' | 'active' | 'inactive' | 'archived';
type DrawerMode = 'create' | 'edit';

interface ServiceFormState {
  name: string;
  code: string;
  status: ServiceStatus;
  price: string;
  duration: string;
  tags: string;
}

interface ServiceListParams {
  limit: number;
  cursor?: string;
  status?: ServiceStatus;
  tag?: string;
  includeDeleted?: boolean;
}

const PAGE_SIZE = 25;

const EMPTY_FORM: ServiceFormState = {
  name: '',
  code: '',
  status: 'active',
  price: '',
  duration: '',
  tags: '',
};

@Component({
  selector: 'app-services-overview',
  standalone: true,
  imports: [CommonModule, TitleCasePipe],
  templateUrl: './services.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Services {
  private readonly servicesService = inject(ServicesService);

  readonly activeView = signal<ServiceViewFilter>('all');
  readonly searchTerm = signal('');
  readonly selectedStatus = signal<ServiceStatus | null>(null);
  readonly selectedTag = signal('');

  readonly services = signal<Service[]>([]);
  readonly allServicesForCounts = signal<Service[]>([]);

  readonly loading = signal(false);
  readonly loadingMore = signal(false);
  readonly saving = signal(false);

  readonly error = signal<string | null>(null);
  readonly drawerError = signal<string | null>(null);
  readonly nextCursor = signal<string | null>(null);

  readonly drawerOpen = signal(false);
  readonly drawerMode = signal<DrawerMode>('create');
  readonly editingService = signal<Service | null>(null);
  readonly form = signal<ServiceFormState>({ ...EMPTY_FORM });

  readonly statuses: ReadonlyArray<ServiceStatus> = ['active', 'inactive'];

  readonly counts = computed(() => {
    const services = this.allServicesForCounts();

    return {
      all: services.filter((service) => !service.deletedAt).length,
      active: services.filter(
        (service) => !service.deletedAt && service.status === 'active'
      ).length,
      inactive: services.filter(
        (service) => !service.deletedAt && service.status === 'inactive'
      ).length,
      archived: services.filter((service) => !!service.deletedAt).length,
    };
  });

  readonly filteredServices = computed(() => {
    let list = [...this.services()];
    const activeView = this.activeView();
    const search = this.searchTerm().trim().toLowerCase();
    const tag = this.selectedTag().trim().toLowerCase();

    switch (activeView) {
      case 'active':
        list = list.filter(
          (service) => !service.deletedAt && service.status === 'active'
        );
        break;

      case 'inactive':
        list = list.filter(
          (service) => !service.deletedAt && service.status === 'inactive'
        );
        break;

      case 'archived':
        list = list.filter((service) => !!service.deletedAt);
        break;

      case 'all':
      default:
        list = list.filter((service) => !service.deletedAt);
        break;
    }

    if (tag) {
      list = list.filter((service) =>
        service.tags.some((serviceTag) =>
          serviceTag.toLowerCase().includes(tag)
        )
      );
    }

    if (search) {
      list = list.filter((service) => this.matchesSearch(service, search));
    }

    return list;
  });

  readonly formValid = computed(() => {
    const form = this.form();

    return (
      form.name.trim().length > 0 &&
      this.parseMoneyToCents(form.price) != null &&
      this.parseDuration(form.duration) !== undefined
    );
  });

  constructor() {
    void this.reloadForCurrentFilters();
  }

  async refresh(): Promise<void> {
    await this.reloadForCurrentFilters();
  }

  async loadMore(): Promise<void> {
    const cursor = this.nextCursor();

    if (!cursor || this.loadingMore()) return;

    this.loadingMore.set(true);
    this.error.set(null);

    try {
      const response = await firstValueFrom(
        this.servicesService.list(
          this.buildListParams({
            limit: PAGE_SIZE,
            cursor,
          })
        )
      );

      this.services.update((current) => [...current, ...response.data]);
      this.nextCursor.set(response.nextCursor);
    } catch (err) {
      this.error.set(this.toErrorMessage(err, 'Unable to load more services.'));
    } finally {
      this.loadingMore.set(false);
    }
  }

  async setView(view: ServiceViewFilter): Promise<void> {
    this.activeView.set(view);

    switch (view) {
      case 'active':
        this.selectedStatus.set('active');
        break;

      case 'inactive':
        this.selectedStatus.set('inactive');
        break;

      case 'archived':
      case 'all':
      default:
        this.selectedStatus.set(null);
        break;
    }

    await this.reloadForCurrentFilters();
  }

  setSearchTerm(value: string): void {
    this.searchTerm.set(value);
  }

  async setTag(value: string): Promise<void> {
    this.selectedTag.set(value);
    await this.reloadForCurrentFilters();
  }

  async archiveService(serviceId: string): Promise<void> {
    try {
      await firstValueFrom(this.servicesService.archive(serviceId));
      await this.reloadForCurrentFilters();
    } catch (err) {
      this.error.set(this.toErrorMessage(err, 'Unable to archive service.'));
    }
  }

  async restoreService(serviceId: string): Promise<void> {
    try {
      await firstValueFrom(this.servicesService.restore(serviceId));
      await this.reloadForCurrentFilters();
    } catch (err) {
      this.error.set(this.toErrorMessage(err, 'Unable to restore service.'));
    }
  }

  openCreateDrawer(): void {
    this.drawerMode.set('create');
    this.editingService.set(null);
    this.form.set({ ...EMPTY_FORM });
    this.drawerError.set(null);
    this.drawerOpen.set(true);
  }

  openEditDrawer(service: Service): void {
    this.drawerMode.set('edit');
    this.editingService.set(service);
    this.form.set({
      name: service.name ?? '',
      code: service.code ?? '',
      status: service.status,
      price: this.centsToInput(service.price),
      duration: service.duration == null ? '' : String(service.duration),
      tags: (service.tags ?? []).join(', '),
    });
    this.drawerError.set(null);
    this.drawerOpen.set(true);
  }

  closeDrawer(): void {
    if (this.saving()) return;

    this.drawerOpen.set(false);
    this.drawerError.set(null);
    this.editingService.set(null);
    this.form.set({ ...EMPTY_FORM });
  }

  updateForm<K extends keyof ServiceFormState>(
    key: K,
    value: ServiceFormState[K]
  ): void {
    this.form.update((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async saveService(): Promise<void> {
    if (!this.formValid() || this.saving()) return;

    const form = this.form();
    const price = this.parseMoneyToCents(form.price);
    const duration = this.parseDuration(form.duration);

    if (price == null || duration === undefined) return;

    const basePayload: CreateServicePayload = {
      name: form.name.trim(),
      code: form.code.trim() || null,
      price,
      duration,
      tags: this.parseTags(form.tags),
    };

    this.saving.set(true);
    this.drawerError.set(null);

    try {
      if (this.drawerMode() === 'create') {
        await firstValueFrom(this.servicesService.create(basePayload));
      } else {
        const service = this.editingService();

        if (!service) {
          throw new Error('Missing service to update.');
        }

        const payload: PatchServicePayload = {
          ...basePayload,
          status: form.status,
        };

        await firstValueFrom(this.servicesService.update(service.id, payload));
      }

      this.drawerOpen.set(false);
      this.editingService.set(null);
      this.form.set({ ...EMPTY_FORM });

      await this.reloadForCurrentFilters();
    } catch (err) {
      this.drawerError.set(this.toErrorMessage(err, 'Unable to save service.'));
    } finally {
      this.saving.set(false);
    }
  }

  clearFilters(): void {
    this.activeView.set('all');
    this.selectedStatus.set(null);
    this.searchTerm.set('');
    this.selectedTag.set('');

    void this.reloadForCurrentFilters();
  }

  trackByServiceId(_: number, service: Service): string {
    return service.id;
  }

  formatMoney(cents: number | null | undefined): string {
    if (cents == null) return '—';

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  }

  formatDuration(minutes: number | null | undefined): string {
    if (minutes == null) return '—';
    if (minutes === 1) return '1 min';
    if (minutes < 60) return `${minutes} mins`;

    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (!mins) return `${hours} hr${hours === 1 ? '' : 's'}`;

    return `${hours} hr${hours === 1 ? '' : 's'} ${mins} min`;
  }

  private async reloadForCurrentFilters(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    this.nextCursor.set(null);

    try {
      const [listResponse, countsResponse] = await Promise.all([
        firstValueFrom(
          this.servicesService.list(
            this.buildListParams({
              limit: PAGE_SIZE,
            })
          )
        ),
        firstValueFrom(
          this.servicesService.list({
            limit: 100,
            includeDeleted: true,
          })
        ),
      ]);

      this.services.set(listResponse.data);
      this.nextCursor.set(listResponse.nextCursor);
      this.allServicesForCounts.set(countsResponse.data);
    } catch (err) {
      this.error.set(this.toErrorMessage(err, 'Unable to load services.'));
    } finally {
      this.loading.set(false);
    }
  }

  private buildListParams(
    base: Pick<ServiceListParams, 'limit' | 'cursor'>
  ): ServiceListParams {
    const view = this.activeView();

    const status: ServiceStatus | undefined =
      view === 'active' || view === 'inactive' ? view : undefined;

    const tag = this.selectedTag().trim();

    return {
      ...base,
      status,
      tag: tag || undefined,
      includeDeleted: view === 'archived',
    };
  }

  private matchesSearch(service: Service, search: string): boolean {
    return [
      service.id,
      service.name,
      service.code,
      service.status,
      this.formatMoney(service.price),
      this.formatDuration(service.duration),
      ...service.tags,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(search));
  }

  private parseMoneyToCents(value: string): number | null {
    const normalized = value.replace(/[$,]/g, '').trim();

    if (!normalized) return null;

    const amount = Number(normalized);

    if (!Number.isFinite(amount) || amount < 0) return null;

    return Math.round(amount * 100);
  }

  private centsToInput(cents: number | null | undefined): string {
    if (cents == null) return '';

    return (cents / 100).toFixed(2);
  }

  private parseDuration(value: string): number | null | undefined {
    const normalized = value.trim();

    if (!normalized) return null;

    const duration = Number(normalized);

    if (!Number.isInteger(duration) || duration < 1) return undefined;

    return duration;
  }

  private parseTags(value: string): string[] {
    const seen = new Set<string>();

    return value
      .split(/[,\n]/)
      .map((tag) => tag.trim().toLowerCase())
      .filter((tag) => {
        if (!tag || seen.has(tag)) return false;

        seen.add(tag);
        return true;
      });
  }

  private toErrorMessage(err: unknown, fallback: string): string {
    if (err instanceof Error && err.message) return err.message;

    if (
      typeof err === 'object' &&
      err !== null &&
      'error' in err &&
      typeof (err as { error?: { message?: unknown } }).error?.message ===
      'string'
    ) {
      return (err as { error: { message: string } }).error.message;
    }

    return fallback;
  }
}