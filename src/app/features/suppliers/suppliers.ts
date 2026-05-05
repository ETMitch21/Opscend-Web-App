import { CommonModule, DatePipe, TitleCasePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  LucideAngularModule,
  MoreHorizontalIcon,
  PlusIcon,
  RefreshCcwIcon,
  StoreIcon,
  ExternalLinkIcon,
  PencilIcon,
  ArchiveIcon,
  RotateCcwIcon,
} from 'lucide-angular';

import { SupplierStore } from '../../core/suppliers/suppliers.store';
import {
  CreateSupplierPayload,
  PatchSupplierPayload,
  Supplier,
  SupplierProvider,
  SupplierStatus,
} from '../../core/suppliers/suppliers.model';

type SupplierView = 'active' | 'inactive' | 'archived' | 'all';

@Component({
  selector: 'app-suppliers',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, TitleCasePipe, LucideAngularModule],
  templateUrl: './suppliers.html',
})
export class Suppliers implements OnInit {
  private readonly supplierStore = inject(SupplierStore);

  readonly moreHorizontalIcon = MoreHorizontalIcon;
  readonly plusIcon = PlusIcon;
  readonly refreshIcon = RefreshCcwIcon;
  readonly storeIcon = StoreIcon;
  readonly externalLinkIcon = ExternalLinkIcon;
  readonly pencilIcon = PencilIcon;
  readonly archiveIcon = ArchiveIcon;
  readonly restoreIcon = RotateCcwIcon;

  readonly suppliers = this.supplierStore.suppliers;
  readonly loading = this.supplierStore.suppliersLoading;
  readonly loadingMore = this.supplierStore.suppliersLoadingMore;
  readonly error = this.supplierStore.suppliersError;
  readonly nextCursor = this.supplierStore.suppliersNextCursor;
  readonly saving = this.supplierStore.selectedSupplierSaving;
  readonly selectedError = this.supplierStore.selectedSupplierError;

  readonly activeView = signal<SupplierView>('active');
  readonly searchTerm = signal('');

  readonly createOpen = signal(false);
  readonly editOpen = signal(false);
  readonly selectedSupplier = signal<Supplier | null>(null);

  readonly formName = signal('');
  readonly formProvider = signal<SupplierProvider>('manual');
  readonly formStatus = signal<SupplierStatus>('active');
  readonly formWebsite = signal('');
  readonly formPhone = signal('');
  readonly formEmail = signal('');
  readonly formNotes = signal('');

  readonly openActionMenuForSupplierId = signal<string | null>(null);
  readonly actionMenuPosition = signal<{ top: number; right: number } | null>(null);

  readonly counts = computed(() => {
    const suppliers = this.suppliers();

    return {
      all: suppliers.length,
      active: suppliers.filter((supplier) => supplier.status === 'active' && !supplier.deletedAt).length,
      inactive: suppliers.filter((supplier) => supplier.status === 'inactive' && !supplier.deletedAt).length,
      archived: suppliers.filter((supplier) => !!supplier.deletedAt).length,
    };
  });

  readonly filteredSuppliers = computed(() => {
    const view = this.activeView();
    const search = this.searchTerm().trim().toLowerCase();

    return this.suppliers().filter((supplier) => {
      if (view === 'active' && (supplier.status !== 'active' || supplier.deletedAt)) return false;
      if (view === 'inactive' && (supplier.status !== 'inactive' || supplier.deletedAt)) return false;
      if (view === 'archived' && !supplier.deletedAt) return false;

      if (!search) return true;

      return [
        supplier.id,
        supplier.name,
        supplier.provider,
        supplier.status,
        supplier.website,
        supplier.phone,
        supplier.email,
        supplier.notes,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search));
    });
  });

  async ngOnInit(): Promise<void> {
    await this.supplierStore.loadSuppliers({
      includeDeleted: true,
      status: undefined,
      limit: 100,
    });
  }

  async refresh(): Promise<void> {
    await this.supplierStore.loadSuppliers({
      includeDeleted: true,
      status: undefined,
      limit: 100,
      cursor: null,
    });
  }

  async loadMore(): Promise<void> {
    await this.supplierStore.loadMoreSuppliers();
  }

  setView(view: SupplierView): void {
    this.activeView.set(view);
  }

  setSearchTerm(value: string): void {
    this.searchTerm.set(value);
  }

  providerLabel(provider: SupplierProvider | string): string {
    if (provider === 'mobilesentrix') return 'MobileSentrix';

    return provider
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  providerTone(provider: SupplierProvider): 'blue' | 'gray' | 'purple' {
    if (provider === 'mobilesentrix') return 'blue';
    if (provider === 'manual') return 'gray';
    return 'purple';
  }

  statusLabel(supplier: Supplier): string {
    if (supplier.deletedAt) return 'Archived';
    return supplier.status === 'active' ? 'Active' : 'Inactive';
  }

  openCreate(): void {
    this.selectedSupplier.set(null);
    this.resetForm();
    this.createOpen.set(true);
  }

  closeCreate(): void {
    this.createOpen.set(false);
    this.resetForm();
  }

  openEdit(supplier: Supplier): void {
    this.closeActionMenu();
    this.selectedSupplier.set(supplier);

    this.formName.set(supplier.name);
    this.formProvider.set(supplier.provider);
    this.formStatus.set(supplier.status);
    this.formWebsite.set(supplier.website ?? '');
    this.formPhone.set(supplier.phone ?? '');
    this.formEmail.set(supplier.email ?? '');
    this.formNotes.set(supplier.notes ?? '');

    this.editOpen.set(true);
  }

  closeEdit(): void {
    this.editOpen.set(false);
    this.selectedSupplier.set(null);
    this.resetForm();
  }

  private resetForm(): void {
    this.formName.set('');
    this.formProvider.set('manual');
    this.formStatus.set('active');
    this.formWebsite.set('');
    this.formPhone.set('');
    this.formEmail.set('');
    this.formNotes.set('');
  }

  private buildPayload(): CreateSupplierPayload | PatchSupplierPayload {
    return {
      name: this.formName().trim(),
      provider: this.formProvider(),
      status: this.formStatus(),
      website: this.formWebsite().trim() || null,
      phone: this.formPhone().trim() || null,
      email: this.formEmail().trim() || null,
      notes: this.formNotes().trim() || null,
    };
  }

  async submitCreate(): Promise<void> {
    if (!this.formName().trim()) return;

    const supplier = await this.supplierStore.createSupplier(
      this.buildPayload() as CreateSupplierPayload
    );

    if (!supplier) return;

    this.closeCreate();
  }

  async submitEdit(): Promise<void> {
    const supplier = this.selectedSupplier();
    if (!supplier || !this.formName().trim()) return;

    const updated = await this.supplierStore.updateSupplier(
      supplier.id,
      this.buildPayload() as PatchSupplierPayload
    );

    if (!updated) return;

    this.closeEdit();
  }

  async archiveSupplier(supplier: Supplier): Promise<void> {
    this.closeActionMenu();

    if (!confirm(`Archive ${supplier.name}?`)) return;

    await this.supplierStore.archiveSupplier(supplier.id);
  }

  async restoreSupplier(supplier: Supplier): Promise<void> {
    this.closeActionMenu();
    await this.supplierStore.restoreSupplier(supplier.id);
  }

  toggleActionMenu(supplierId: string, event: MouseEvent): void {
    event.stopPropagation();

    const current = this.openActionMenuForSupplierId();

    if (current === supplierId) {
      this.closeActionMenu();
      return;
    }

    const button = event.currentTarget as HTMLElement;
    const rect = button.getBoundingClientRect();

    this.actionMenuPosition.set({
      top: rect.bottom + 6,
      right: window.innerWidth - rect.right,
    });

    this.openActionMenuForSupplierId.set(supplierId);
  }

  closeActionMenu(): void {
    this.openActionMenuForSupplierId.set(null);
    this.actionMenuPosition.set(null);
  }

  trackBySupplierId(_: number, supplier: Supplier): string {
    return supplier.id;
  }
}