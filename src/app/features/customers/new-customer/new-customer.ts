import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { debounceTime, firstValueFrom, merge } from 'rxjs';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { CustomersStore } from '../../../core/customers/customers.store';
import type { CustomerContactConflict } from '../../../core/customers/customer.model';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ToastService } from '../../../core/toast/toast-service';
import { ShopContextService } from '../../../core/shop/shop-context.store';

type NewCustomerForm = FormGroup<{
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
  geo: FormControl<{ lat: number; lng: number } | null>;
  notes: FormControl<string>;
  isDefault: FormControl<boolean>;
}>;

@Component({
  selector: 'app-new-customer',
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './new-customer.html',
  styleUrl: './new-customer.scss',
})
export class NewCustomer implements OnInit {
  private readonly router = inject(Router);
  private readonly customersStore = inject(CustomersStore);
  private readonly toast = inject(ToastService);
  private readonly shopContext = inject(ShopContextService);
  private readonly destroyRef = inject(DestroyRef);

  public working = false;
  public customerIdentityChecking = false;
  public customerIdentityConflicts: CustomerContactConflict[] = [];

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

  async ngOnInit(): Promise<void> {
    const shop = await firstValueFrom(this.shopContext.load());
    this.shopCountry = shop?.address?.country || shop?.locale?.country || 'US';

    this.addressForm.patchValue({
      country: this.shopCountry,
    });

    merge(
      this.newCustomerForm.controls.email.valueChanges,
      this.newCustomerForm.controls.phone.valueChanges,
    )
      .pipe(debounceTime(350), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        void this.checkCustomerIdentity();
      });
  }

  public readonly newCustomerForm: NewCustomerForm = new FormGroup({
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
      validators: [Validators.required, Validators.minLength(10)],
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
    }),
    line2: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(120)],
    }),
    city: new FormControl('', {
      nonNullable: true,
    }),
    state: new FormControl('', {
      nonNullable: true,
    }),
    postalCode: new FormControl('', {
      nonNullable: true,
    }),
    country: new FormControl('US', {
      nonNullable: true,
    }),
    geo: new FormControl<{ lat: number; lng: number } | null>(null),
    notes: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(500)],
    }),
    isDefault: new FormControl(true, {
      nonNullable: true,
    }),
  });

  public addAddress = false;

  toggleAddAddress(): void {
    this.addAddress = !this.addAddress;

    if (!this.addAddress) {
      this.addressForm.reset({
        label: '',
        line1: '',
        line2: '',
        city: '',
        state: '',
        postalCode: '',
        country: 'US',
        geo: null,
        notes: '',
        isDefault: true,
      });
    }
  }

  duplicateCustomer(): CustomerContactConflict['customer'] | null {
    return this.customerIdentityConflicts[0]?.customer ?? null;
  }

  duplicateSummary(): string {
    const fields = [...new Set(this.customerIdentityConflicts.map((item) => item.field))];
    if (!fields.length) return 'This contact already exists.';
    if (fields.length === 2) return 'This email and phone already belong to an existing customer.';
    return `This ${fields[0]} already belongs to an existing customer.`;
  }

  openDuplicateCustomer(): void {
    const customer = this.duplicateCustomer();
    if (!customer) return;
    void this.router.navigate(['/customers', customer.id, 'edit']);
  }

  private async checkCustomerIdentity(): Promise<void> {
    const email = this.newCustomerForm.controls.email.value.trim();
    const phone = this.newCustomerForm.controls.phone.value.trim();

    if (!email && !phone) {
      this.customerIdentityConflicts = [];
      this.customerIdentityChecking = false;
      return;
    }

    this.customerIdentityChecking = true;

    try {
      const response = await firstValueFrom(
        this.customersStore.checkIdentity({
          email: email || null,
          phone: phone || null,
        }),
      );

      this.customerIdentityConflicts = response.conflicts ?? [];
    } catch (error) {
      console.error('Customer identity check failed.', error);
      this.customerIdentityConflicts = [];
    } finally {
      this.customerIdentityChecking = false;
    }
  }

  async create(): Promise<void> {
    if (this.newCustomerForm.invalid) {
      this.newCustomerForm.markAllAsTouched();
      return;
    }

    await this.checkCustomerIdentity();

    if (this.customerIdentityConflicts.length) {
      this.toast.error('Existing customer found', 'Use the existing customer instead of creating a duplicate.');
      return;
    }

    if (this.addAddress) {
      const { line1, city, state, postalCode, country } = this.addressForm.getRawValue();
      if (!line1.trim() || !city.trim() || !state.trim() || !postalCode.trim() || !country.trim()) {
        this.addressForm.markAllAsTouched();
        return;
      }
    }

    this.working = true;

    try {
      const created = await this.customersStore.create({
        name: this.newCustomerForm.controls.name.value.trim(),
        email: this.newCustomerForm.controls.email.value.trim() || null,
        phone: this.newCustomerForm.controls.phone.value.trim() || null,
        notes: this.newCustomerForm.controls.notes.value.trim() || null,
      });

      if (!created) {
        this.toast.error('Customer not created', 'Something went wrong while creating the customer.');
        return;
      }

      if (this.addAddress) {
        await this.customersStore.createAddress(created.id, {
          label: this.addressForm.controls.label.value.trim() || null,
          line1: this.addressForm.controls.line1.value.trim(),
          line2: this.addressForm.controls.line2.value.trim() || null,
          city: this.addressForm.controls.city.value.trim(),
          state: this.addressForm.controls.state.value.trim(),
          postalCode: this.addressForm.controls.postalCode.value.trim(),
          country: this.addressForm.controls.country.value.trim().toUpperCase(),
          geo: this.addressForm.controls.geo.value,
          notes: this.addressForm.controls.notes.value.trim() || '',
          isDefault: this.addressForm.controls.isDefault.value,
        });
      }

      this.toast.success('Customer created', `${created.name} was created successfully.`);
      void this.router.navigate(['customers', 'overview']);
    } catch (e: any) {
      this.toast.error(e);
    } finally {
      this.working = false;
    }
  }

  cancel(): void {
    void this.router.navigate(['customers', 'overview']);
  }
}