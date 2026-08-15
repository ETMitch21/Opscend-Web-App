import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Customer } from '../../core/customers/customer.model';
import { CustomersStore } from '../../core/customers/customers.store';
import { PhonePipe } from '../../core/pipes/phone-pipe';
import { ToastService } from '../../core/toast/toast-service';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-customer-list',
  standalone: true,
  imports: [CommonModule, FormsModule, PhonePipe],
  templateUrl: './customers.html',
})
export class CustomerComponent implements OnInit {
  private readonly store = inject(CustomersStore);
  private readonly router = inject(Router);
  private toast = inject(ToastService);
  private readonly auth = inject(AuthService);

  protected readonly canWrite = computed(() => this.auth.hasPermission('customers:write'));
  protected readonly canArchive = computed(() => this.auth.hasPermission('customers:delete'));
  protected readonly canRestore = computed(() => this.auth.hasPermission('customers:restore'));

  protected readonly search = signal('');
  protected readonly archivedView = signal(false);

  protected readonly customers = this.store.items;
  protected readonly loading = this.store.loading;
  protected readonly hasMore = this.store.hasMore;

  protected readonly filteredCustomers = computed(() => {
    const term = this.search().trim().toLowerCase();
    const items = this.customers();

    if (!term) return items;

    return items.filter((customer) => {
      const haystack = [
        customer.name,
        customer.email ?? '',
        customer.phone ?? '',
        customer.notes ?? '',
        ...(customer.tags ?? []),
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(term);
    });
  });

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  protected async load(): Promise<void> {
    await this.store.load({
      limit: 25,
      includeDeleted: this.archivedView(),
    });
  }

  protected async refresh(): Promise<void> {
    await this.load();
  }

  protected async loadMore(): Promise<void> {
    await this.store.loadMore({
      limit: 25,
      includeDeleted: this.archivedView(),
    });
  }

  protected async toggleDeleted(): Promise<void> {
    this.archivedView.update((v) => !v);
    this.search.set('');
    await this.load();
  }

  protected createCustomer(): void {
    if (!this.canWrite()) return;
    this.router.navigate(['/customers/create']);
  }

  protected editCustomer(customer: Customer): void {
    if (!this.canWrite()) return;
    this.router.navigate(['/customers', customer.id, 'edit']);
  }

  protected async archiveCustomer(customer: Customer): Promise<void> {
    if (!this.canArchive()) return;
    this.toast.confirm(
      `Archive ${customer.name}?`,
      async () => {
        const ok = await this.store.delete(customer.id);
        if (ok) {
          this.toast.success('Customer archived');
          this.load();
        } else {
          this.toast.error('Failed to archive customer');
        }
      }
    )
  }

  protected async restoreCustomer(customer: Customer): Promise<void> {
    if (!this.canRestore()) return;
    const restored = await this.store.restore(customer.id);
    if (restored) {
      await this.load();
    }
  }

  protected trackById(_: number, customer: Customer): string {
    return customer.id;
  }

  protected formatTags(tags: string[]): string {
    return (tags ?? []).join(', ');
  }
}