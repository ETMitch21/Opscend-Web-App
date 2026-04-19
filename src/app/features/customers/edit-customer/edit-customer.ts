import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter, map, distinctUntilChanged, firstValueFrom } from 'rxjs';
import { ChevronLeft, LucideAngularModule } from 'lucide-angular';

import { CustomersStore } from '../../../core/customers/customers.store';
import {
  Customer,
  CustomerAddress,
  CreateCustomerAddressRequest,
  UpdateCustomerAddressRequest,
} from '../../../core/customers/customer.model';
import { ToastService } from '../../../core/toast/toast-service';
import { CustomerDevicesStore } from '../../../core/customer-devices/customer-devices.store';
import { CustomerDevice } from '../../../core/customer-devices/customer-device.model';
import { ManageDevicesModalService } from '../../../components/modals/manage-devices-modal-component/manage-devices-modal-service';
import { ShopContextService } from '../../../core/shop/shop-context.store';

type EditCustomerForm = FormGroup<{
  name: FormControl<string>;
  email: FormControl<string>;
  phone: FormControl<string>;
  notes: FormControl<string>;
}>;

type AddressForm = FormGroup<{
  label: FormControl<string>;
  line1: FormControl<string>;
  line2: FormControl<string>;
  city: FormControl<string>;
  state: FormControl<string>;
  postalCode: FormControl<string>;
  country: FormControl<string>;
  notes: FormControl<string>;
  isDefault: FormControl<boolean>;
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
  private readonly shopContext = inject(ShopContextService);

  public readonly leftChevronIcon = ChevronLeft;

  public customer: Customer | null = null;
  public customerDevices: CustomerDevice[] = [];
  public addresses: CustomerAddress[] = [];
  public working = false;

  public addressModalOpen = false;
  public editingAddress: CustomerAddress | null = null;
  public addressWorking = false;

  public shopCountry = 'US';

  readonly states = [
    { label: 'Alabama', value: 'AL' },
    { label: 'Alaska', value: 'AK' },
    { label: 'Arizona', value: 'AZ' },
    { label: 'Arkansas', value: 'AR' },
    { label: 'California', value: 'CA' },
    { label: 'Colorado', value: 'CO' },
    { label: 'Connecticut', value: 'CT' },
    { label: 'Delaware', value: 'DE' },
    { label: 'Florida', value: 'FL' },
    { label: 'Georgia', value: 'GA' },
    { label: 'Hawaii', value: 'HI' },
    { label: 'Idaho', value: 'ID' },
    { label: 'Illinois', value: 'IL' },
    { label: 'Indiana', value: 'IN' },
    { label: 'Iowa', value: 'IA' },
    { label: 'Kansas', value: 'KS' },
    { label: 'Kentucky', value: 'KY' },
    { label: 'Louisiana', value: 'LA' },
    { label: 'Maine', value: 'ME' },
    { label: 'Maryland', value: 'MD' },
    { label: 'Massachusetts', value: 'MA' },
    { label: 'Michigan', value: 'MI' },
    { label: 'Minnesota', value: 'MN' },
    { label: 'Mississippi', value: 'MS' },
    { label: 'Missouri', value: 'MO' },
    { label: 'Montana', value: 'MT' },
    { label: 'Nebraska', value: 'NE' },
    { label: 'Nevada', value: 'NV' },
    { label: 'New Hampshire', value: 'NH' },
    { label: 'New Jersey', value: 'NJ' },
    { label: 'New Mexico', value: 'NM' },
    { label: 'New York', value: 'NY' },
    { label: 'North Carolina', value: 'NC' },
    { label: 'North Dakota', value: 'ND' },
    { label: 'Ohio', value: 'OH' },
    { label: 'Oklahoma', value: 'OK' },
    { label: 'Oregon', value: 'OR' },
    { label: 'Pennsylvania', value: 'PA' },
    { label: 'Rhode Island', value: 'RI' },
    { label: 'South Carolina', value: 'SC' },
    { label: 'South Dakota', value: 'SD' },
    { label: 'Tennessee', value: 'TN' },
    { label: 'Texas', value: 'TX' },
    { label: 'Utah', value: 'UT' },
    { label: 'Vermont', value: 'VT' },
    { label: 'Virginia', value: 'VA' },
    { label: 'Washington', value: 'WA' },
    { label: 'West Virginia', value: 'WV' },
    { label: 'Wisconsin', value: 'WI' },
    { label: 'Wyoming', value: 'WY' },
    { label: 'District of Columbia', value: 'DC' },
    { label: 'Puerto Rico', value: 'PR' },
  ];

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

  public readonly addressForm: AddressForm = new FormGroup({
    label: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(80)],
    }),
    line1: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(120)],
    }),
    line2: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(120)],
    }),
    city: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(80)],
    }),
    state: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(80)],
    }),
    postalCode: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(20)],
    }),
    country: new FormControl('US', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(2)],
    }),
    notes: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(500)],
    }),
    isDefault: new FormControl(false, {
      nonNullable: true,
    }),
  });

  ngOnInit(): void {
    void this.loadShopCountry();
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

  private async loadShopCountry(): Promise<void> {
    const shop = await firstValueFrom(this.shopContext.load());
    this.shopCountry = shop?.address?.country || shop?.locale?.country || 'US';

    this.addressForm.patchValue({
      country: this.shopCountry,
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

    await Promise.all([
      this.loadDevices(),
      this.loadAddresses(),
    ]);
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

  private async loadAddresses(): Promise<void> {
    if (!this.customer) return;

    try {
      this.addresses = await this.store.loadAddresses(this.customer.id);
    } catch {
      this.toast.error(
        'Failed to load addresses',
        'Unable to load customer addresses right now.'
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

  openNewAddressModal(): void {
    this.editingAddress = null;
    this.addressForm.reset({
      label: '',
      line1: '',
      line2: '',
      city: '',
      state: '',
      postalCode: '',
      country: 'US',
      notes: '',
      isDefault: this.addresses.length === 0,
    });
    this.addressModalOpen = true;
  }

  openEditAddressModal(address: CustomerAddress): void {
    this.editingAddress = address;
    this.addressForm.reset({
      label: address.label ?? '',
      line1: address.line1,
      line2: address.line2 ?? '',
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
      country: address.country,
      notes: address.notes ?? '',
      isDefault: address.isDefault,
    });
    this.addressModalOpen = true;
  }

  closeAddressModal(): void {
    if (this.addressWorking) return;
    this.addressModalOpen = false;
    this.editingAddress = null;
    this.addressForm.reset({
      label: '',
      line1: '',
      line2: '',
      city: '',
      state: '',
      postalCode: '',
      country: 'US',
      notes: '',
      isDefault: false,
    });
  }

  async saveAddress(): Promise<void> {
    if (!this.customer || this.addressForm.invalid || this.addressWorking) {
      this.addressForm.markAllAsTouched();
      return;
    }

    this.addressWorking = true;

    try {
      const raw = this.addressForm.getRawValue();

      const payload: CreateCustomerAddressRequest | UpdateCustomerAddressRequest = {
        label: raw.label.trim() || null,
        line1: raw.line1.trim(),
        line2: raw.line2.trim() || null,
        city: raw.city.trim(),
        state: raw.state.trim(),
        postalCode: raw.postalCode.trim(),
        country: raw.country.trim().toUpperCase(),
        notes: raw.notes.trim() || null,
        isDefault: raw.isDefault,
      };

      const saved = this.editingAddress
        ? await this.store.updateAddress(this.customer.id, this.editingAddress.id, payload)
        : await this.store.createAddress(this.customer.id, payload as CreateCustomerAddressRequest);

      if (saved) {
        this.addresses = this.store.addresses();
        this.toast.success(
          this.editingAddress ? 'Address Updated' : 'Address Added',
          this.formatAddressShort(saved)
        );
        this.closeAddressModal();
      }
    } catch (e: any) {
      this.toast.error(e);
    } finally {
      this.addressWorking = false;
    }
  }

  async setDefaultAddress(address: CustomerAddress): Promise<void> {
    if (!this.customer || address.isDefault || this.addressWorking) return;

    this.addressWorking = true;

    try {
      const updated = await this.store.setDefaultAddress(this.customer.id, address.id);
      if (updated) {
        this.addresses = this.store.addresses();
        this.toast.success('Default Address Updated', this.formatAddressShort(updated));
      }
    } catch (e: any) {
      this.toast.error(e);
    } finally {
      this.addressWorking = false;
    }
  }

  async deleteAddress(address: CustomerAddress): Promise<void> {
    if (!this.customer || this.addressWorking) return;

    const confirmed = window.confirm('Delete this address?');
    if (!confirmed) return;

    this.addressWorking = true;

    try {
      const ok = await this.store.deleteAddress(this.customer.id, address.id);
      if (ok) {
        this.addresses = this.store.addresses();
        this.toast.success('Address Deleted', this.formatAddressShort(address));
      }
    } catch (e: any) {
      this.toast.error(e);
    } finally {
      this.addressWorking = false;
    }
  }

  trackByAddressId(_index: number, address: CustomerAddress): string {
    return address.id;
  }

  formatAddressLines(address: CustomerAddress): string[] {
    const line2 = address.line2?.trim();
    const cityStatePostal = [address.city, address.state, address.postalCode].filter(Boolean).join(', ').replace(', ,', ',');
    return [
      address.line1,
      ...(line2 ? [line2] : []),
      cityStatePostal,
      address.country,
    ].filter((value) => !!value);
  }

  formatAddressShort(address: CustomerAddress): string {
    return [address.line1, address.city, address.state, address.postalCode]
      .filter(Boolean)
      .join(', ');
  }
}