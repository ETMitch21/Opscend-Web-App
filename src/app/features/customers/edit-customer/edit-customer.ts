import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter, map, distinctUntilChanged } from 'rxjs';
import { ChevronLeft, LucideAngularModule } from 'lucide-angular';

import { CustomersStore } from '../../../core/customers/customers.store';
import { Customer } from '../../../core/customers/customer.model';
import { ToastService } from '../../../core/toast/toast-service';
import { CustomerDevicesStore } from '../../../core/customer-devices/customer-devices.store';
import { CustomerDevice } from '../../../core/customer-devices/customer-device.model';
import { ManageDevicesModalService } from '../../../components/modals/manage-devices-modal-component/manage-devices-modal-service';

type EditCustomerForm = FormGroup<{
  name: FormControl<string>;
  email: FormControl<string>;
  phone: FormControl<string>;
  notes: FormControl<string>;
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

  public readonly leftChevronIcon = ChevronLeft;

  public customer: Customer | null = null;
  public customerDevices: CustomerDevice[] = [];
  public working = false;

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
    notes: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(500)],
    }),
  });

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        map((params) => params.get('id')),
        filter((id): id is string => !!id),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((id) => {
        void this.loadCustomer(id);
      });

    this.deviceModalService.modalClosed$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        void this.loadDevices();
      });
  }

  private async loadCustomer(id: string): Promise<void> {
    this.customer = await this.store.getById(id);

    if (!this.customer) {
      this.toast.error('Customer not found', 'A customer with that ID does not exist.');
      void this.router.navigate(['customers', 'overview']);
      return;
    }

    this.editCustomerForm.patchValue({
      name: this.customer.name ?? '',
      email: this.customer.email ?? '',
      phone: this.customer.phone ?? '',
      notes: this.customer.notes ?? '',
    });

    await this.loadDevices();
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

  async save(): Promise<void> {
    if (this.editCustomerForm.invalid || !this.customer || this.working) {
      this.editCustomerForm.markAllAsTouched();
      return;
    }

    this.working = true;

    try {
      const { name, email, phone, notes } = this.editCustomerForm.getRawValue();

      const updatedCustomer = await this.store.update(this.customer.id, {
        name,
        email,
        phone,
        notes,
      });

      if (updatedCustomer) {
        this.customer = updatedCustomer;
        this.toast.success('Customer Updated', `${name} was updated.`);
      }
    } catch (e: any) {
      this.toast.error(e);
    } finally {
      this.working = false;
    }
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
}