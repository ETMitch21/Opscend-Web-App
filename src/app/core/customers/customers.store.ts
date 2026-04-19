import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import {
  CreateCustomerAddressRequest,
  CreateCustomerRequest,
  Customer,
  CustomerAddress,
  CustomerListQuery,
  UpdateCustomerAddressRequest,
  UpdateCustomerRequest,
} from './customer.model';
import { CustomersService } from './customers-services';

@Injectable({
  providedIn: 'root',
})
export class CustomersStore {
  private readonly customersService = inject(CustomersService);

  private readonly _items = signal<Customer[]>([]);
  private readonly _selected = signal<Customer | null>(null);
  private readonly _addresses = signal<CustomerAddress[]>([]);
  private readonly _loading = signal(false);
  private readonly _saving = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _nextCursor = signal<string | null>(null);
  private readonly _loaded = signal(false);

  readonly items = this._items.asReadonly();
  readonly selected = this._selected.asReadonly();
  readonly addresses = this._addresses.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly saving = this._saving.asReadonly();
  readonly error = this._error.asReadonly();
  readonly nextCursor = this._nextCursor.asReadonly();
  readonly loaded = this._loaded.asReadonly();

  readonly hasItems = computed(() => this._items().length > 0);
  readonly hasMore = computed(() => !!this._nextCursor());

  async load(query: CustomerListQuery = { limit: 25 }): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const res = await firstValueFrom(this.customersService.list(query));
      this._items.set(res.data);
      this._nextCursor.set(res.nextCursor);
      this._loaded.set(true);
    } catch (err: any) {
      this._error.set(err?.error?.error ?? 'Failed to load customers.');
    } finally {
      this._loading.set(false);
    }
  }

  async loadMore(extraQuery: Omit<CustomerListQuery, 'cursor'> = {}): Promise<void> {
    const cursor = this._nextCursor();
    if (!cursor || this._loading()) return;

    this._loading.set(true);
    this._error.set(null);

    try {
      const res = await firstValueFrom(
        this.customersService.list({
          ...extraQuery,
          cursor,
        })
      );

      this._items.update((current) => [...current, ...res.data]);
      this._nextCursor.set(res.nextCursor);
    } catch (err: any) {
      this._error.set(err?.error?.error ?? 'Failed to load more customers.');
    } finally {
      this._loading.set(false);
    }
  }

  search(query: string): Observable<Customer[]> {
    this._error.set(null);
    return this.customersService.search(query);
  }

  async getById(id: string): Promise<Customer | null> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const customer = await firstValueFrom(this.customersService.getById(id));
      this._selected.set(customer);

      this._items.update((items) => {
        const index = items.findIndex((x) => x.id === customer.id);
        if (index === -1) return [customer, ...items];

        const copy = [...items];
        copy[index] = customer;
        return copy;
      });

      return customer;
    } catch (err: any) {
      this._error.set(err?.error?.error ?? 'Failed to load customer.');
      return null;
    } finally {
      this._loading.set(false);
    }
  }

  async create(payload: CreateCustomerRequest): Promise<Customer | null> {
    this._saving.set(true);
    this._error.set(null);

    try {
      const created = await firstValueFrom(this.customersService.create(payload));
      this._items.update((items) => [created, ...items]);
      this._selected.set(created);
      return created;
    } catch (err: any) {
      this._error.set(err?.error?.error ?? 'Failed to create customer.');
      return null;
    } finally {
      this._saving.set(false);
    }
  }

  async update(id: string, payload: UpdateCustomerRequest): Promise<Customer | null> {
    this._saving.set(true);
    this._error.set(null);

    try {
      const updated = await firstValueFrom(this.customersService.update(id, payload));

      this._items.update((items) =>
        items.map((item) => (item.id === updated.id ? updated : item))
      );

      if (this._selected()?.id === updated.id) {
        this._selected.set(updated);
      }

      return updated;
    } catch (err: any) {
      this._error.set(err?.error?.error ?? 'Failed to update customer.');
      return null;
    } finally {
      this._saving.set(false);
    }
  }

  async delete(id: string): Promise<boolean> {
    this._saving.set(true);
    this._error.set(null);

    try {
      await firstValueFrom(this.customersService.delete(id));
      this._items.update((items) => items.filter((item) => item.id !== id));

      if (this._selected()?.id === id) {
        this._selected.set(null);
      }

      return true;
    } catch (err: any) {
      this._error.set(err?.error?.error ?? 'Failed to delete customer.');
      return false;
    } finally {
      this._saving.set(false);
    }
  }

  async restore(id: string): Promise<Customer | null> {
    this._saving.set(true);
    this._error.set(null);

    try {
      const restored = await firstValueFrom(this.customersService.restore(id));

      this._items.update((items) => {
        const index = items.findIndex((x) => x.id === restored.id);
        if (index === -1) return [restored, ...items];

        const copy = [...items];
        copy[index] = restored;
        return copy;
      });

      if (this._selected()?.id === restored.id) {
        this._selected.set(restored);
      }

      return restored;
    } catch (err: any) {
      this._error.set(err?.error?.error ?? 'Failed to restore customer.');
      return null;
    } finally {
      this._saving.set(false);
    }
  }

  async loadAddresses(customerId: string): Promise<CustomerAddress[]> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const rows = await firstValueFrom(this.customersService.listAddresses(customerId));
      this._addresses.set(rows);
      return rows;
    } catch (err: any) {
      this._error.set(err?.error?.error ?? 'Failed to load customer addresses.');
      return [];
    } finally {
      this._loading.set(false);
    }
  }

  async createAddress(
    customerId: string,
    payload: CreateCustomerAddressRequest
  ): Promise<CustomerAddress | null> {
    this._saving.set(true);
    this._error.set(null);

    try {
      const created = await firstValueFrom(
        this.customersService.createAddress(customerId, payload)
      );

      this._addresses.update((items) => {
        const next = items.filter((x) => !created.isDefault || !x.isDefault);
        return created.isDefault ? [created, ...next] : [...next, created];
      });

      return created;
    } catch (err: any) {
      this._error.set(err?.error?.error ?? 'Failed to create customer address.');
      return null;
    } finally {
      this._saving.set(false);
    }
  }

  async updateAddress(
    customerId: string,
    addressId: string,
    payload: UpdateCustomerAddressRequest
  ): Promise<CustomerAddress | null> {
    this._saving.set(true);
    this._error.set(null);

    try {
      const updated = await firstValueFrom(
        this.customersService.updateAddress(customerId, addressId, payload)
      );

      this._addresses.update((items) =>
        items.map((item) => ({
          ...item,
          isDefault: updated.isDefault ? item.id === updated.id : item.isDefault,
        })).map((item) => (item.id === updated.id ? updated : item))
      );

      return updated;
    } catch (err: any) {
      this._error.set(err?.error?.error ?? 'Failed to update customer address.');
      return null;
    } finally {
      this._saving.set(false);
    }
  }

  async setDefaultAddress(customerId: string, addressId: string): Promise<CustomerAddress | null> {
    this._saving.set(true);
    this._error.set(null);

    try {
      const updated = await firstValueFrom(
        this.customersService.setDefaultAddress(customerId, addressId)
      );

      this._addresses.update((items) =>
        items
          .map((item) => ({
            ...item,
            isDefault: item.id === updated.id,
          }))
          .sort((a, b) => Number(b.isDefault) - Number(a.isDefault))
      );

      return updated;
    } catch (err: any) {
      this._error.set(err?.error?.error ?? 'Failed to set default address.');
      return null;
    } finally {
      this._saving.set(false);
    }
  }

  async deleteAddress(customerId: string, addressId: string): Promise<boolean> {
    this._saving.set(true);
    this._error.set(null);

    try {
      await firstValueFrom(this.customersService.deleteAddress(customerId, addressId));
      this._addresses.update((items) => items.filter((item) => item.id !== addressId));
      return true;
    } catch (err: any) {
      this._error.set(err?.error?.error ?? 'Failed to delete customer address.');
      return false;
    } finally {
      this._saving.set(false);
    }
  }

  setSelected(customer: Customer | null): void {
    this._selected.set(customer);
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
    this._addresses.set([]);
    this._loading.set(false);
    this._saving.set(false);
    this._error.set(null);
    this._nextCursor.set(null);
    this._loaded.set(false);
  }
}