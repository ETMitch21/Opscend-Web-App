import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import {
  CreateCustomerDeviceRequest,
  CustomerDevice,
  CustomerDeviceListQuery,
  UpdateCustomerDeviceRequest,
} from './customer-device.model';
import { CustomerDevicesService } from './customer-devices.service';

@Injectable({
  providedIn: 'root',
})
export class CustomerDevicesStore {
  private readonly customerDevicesService = inject(CustomerDevicesService);

  private readonly _items = signal<CustomerDevice[]>([]);
  private readonly _selected = signal<CustomerDevice | null>(null);
  private readonly _loading = signal(false);
  private readonly _saving = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _nextCursor = signal<string | null>(null);
  private readonly _loaded = signal(false);
  private readonly _customerId = signal<string | null>(null);

  readonly items = this._items.asReadonly();
  readonly selected = this._selected.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly saving = this._saving.asReadonly();
  readonly error = this._error.asReadonly();
  readonly nextCursor = this._nextCursor.asReadonly();
  readonly loaded = this._loaded.asReadonly();
  readonly customerId = this._customerId.asReadonly();

  readonly hasItems = computed(() => this._items().length > 0);
  readonly hasMore = computed(() => !!this._nextCursor());

  async load(
    customerId: string,
    query: CustomerDeviceListQuery = { limit: 25 }
  ): Promise<void> {
    this._loading.set(true);
    this._error.set(null);
    this._customerId.set(customerId);

    try {
      const res = await firstValueFrom(
        this.customerDevicesService.list(customerId, query)
      );
      this._items.set(res.data);
      this._nextCursor.set(res.nextCursor);
      this._loaded.set(true);
    } catch (err: any) {
      this._error.set(err?.error?.error ?? 'Failed to load customer devices.');
    } finally {
      this._loading.set(false);
    }
  }

  search(customerId: string, query: string): Observable<CustomerDevice[]> {
    this._error.set(null);
    return this.customerDevicesService.search(customerId, query);
  }

  async loadMore(
    extraQuery: Omit<CustomerDeviceListQuery, 'cursor'> = {}
  ): Promise<void> {
    const customerId = this._customerId();
    const cursor = this._nextCursor();

    if (!customerId || !cursor || this._loading()) return;

    this._loading.set(true);
    this._error.set(null);

    try {
      const res = await firstValueFrom(
        this.customerDevicesService.list(customerId, {
          ...extraQuery,
          cursor,
        })
      );

      this._items.update((current) => [...current, ...res.data]);
      this._nextCursor.set(res.nextCursor);
    } catch (err: any) {
      this._error.set(err?.error?.error ?? 'Failed to load more customer devices.');
    } finally {
      this._loading.set(false);
    }
  }

  async getById(id: string): Promise<CustomerDevice | null> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const device = await firstValueFrom(this.customerDevicesService.getById(id));
      this._selected.set(device);

      this._items.update((items) => {
        const index = items.findIndex((x) => x.id === device.id);
        if (index === -1) return [device, ...items];

        const copy = [...items];
        copy[index] = device;
        return copy;
      });

      return device;
    } catch (err: any) {
      this._error.set(err?.error?.error ?? 'Failed to load customer device.');
      return null;
    } finally {
      this._loading.set(false);
    }
  }

  async create(
    customerId: string,
    payload: CreateCustomerDeviceRequest
  ): Promise<CustomerDevice | null> {
    this._saving.set(true);
    this._error.set(null);

    try {
      const created = await firstValueFrom(
        this.customerDevicesService.create(customerId, payload)
      );
      this._items.update((items) => [created, ...items]);
      this._selected.set(created);
      this._customerId.set(customerId);
      return created;
    } catch (err: any) {
      this._error.set(err?.error?.error ?? 'Failed to create customer device.');
      return null;
    } finally {
      this._saving.set(false);
    }
  }

  async update(
    id: string,
    payload: UpdateCustomerDeviceRequest
  ): Promise<CustomerDevice | null> {
    this._saving.set(true);
    this._error.set(null);

    try {
      const updated = await firstValueFrom(
        this.customerDevicesService.update(id, payload)
      );

      this._items.update((items) =>
        items.map((item) => (item.id === updated.id ? updated : item))
      );

      if (this._selected()?.id === updated.id) {
        this._selected.set(updated);
      }

      return updated;
    } catch (err: any) {
      this._error.set(err?.error?.error ?? 'Failed to update customer device.');
      return null;
    } finally {
      this._saving.set(false);
    }
  }

  setSelected(device: CustomerDevice | null): void {
    this._selected.set(device);
  }

  clearSelected(): void {
    this._selected.set(null);
  }

  clearError(): void {
    this._error.set(null);
  }

  reset(): void {
    this._items.set([]);
    this._selected.set(null);
    this._loading.set(false);
    this._saving.set(false);
    this._error.set(null);
    this._nextCursor.set(null);
    this._loaded.set(false);
    this._customerId.set(null);
  }
}