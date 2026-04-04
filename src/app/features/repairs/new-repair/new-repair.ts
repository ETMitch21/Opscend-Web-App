import { CommonModule } from '@angular/common';
import { Component, computed, DestroyRef, HostListener, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, debounceTime, distinctUntilChanged, filter, of, switchMap, tap } from 'rxjs';
import { ChevronLeftIcon, LucideAngularModule, LucideIconData } from 'lucide-angular';

import { CustomersStore } from '../../../core/customers/customers.store';
import { Customer } from '../../../core/customers/customer.model';
import { CustomerDevicesStore } from '../../../core/customer-devices/customer-devices.store';
import { CustomerDevice } from '../../../core/customer-devices/customer-device.model';
import { PhonePipe } from '../../../core/pipes/phone-pipe';
import { SchedulingPickerModalComponent } from "../../../components/modals/scheduling-picker-modal/scheduling-picker-modal";
import { SchedulingSelection } from '../../../core/scheduling/scheduling.types';
import { RepairsStore } from '../../../core/repairs/repairs.store';
import { AppointmentsStore } from '../../../core/appointments/appointments.store';
import { ToastService } from '../../../core/toast/toast-service';

type NewRepairForm = FormGroup<{
  customerId: FormControl<string | null>;
  customerSearchControl: FormControl<string>;
  deviceId: FormControl<string | null>;
  deviceSearchControl: FormControl<string>;
  name: FormControl<string>;
  email: FormControl<string>;
  phone: FormControl<string>;
  nickname: FormControl<string>;
  brand: FormControl<string>;
  model: FormControl<string>;
  imei: FormControl<string>;
  serial: FormControl<string>;
  problemSummary: FormControl<string>;
  quotedPriceDollars: FormControl<number | null>;
  schedulingSelected: FormControl<boolean>;
}>;

@Component({
  selector: 'app-new-repair',
  imports: [CommonModule, LucideAngularModule, RouterModule, FormsModule, ReactiveFormsModule, PhonePipe, SchedulingPickerModalComponent],
  templateUrl: './new-repair.html',
  styleUrl: './new-repair.scss',
})
export class NewRepair {
  private readonly customersStore = inject(CustomersStore);
  private readonly customerDevicesStore = inject(CustomerDevicesStore);
  private readonly destroyRef = inject(DestroyRef);
  private readonly repairsStore = inject(RepairsStore);
  private readonly appointmentsStore = inject(AppointmentsStore);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);

  public readonly leftChevronIcon: LucideIconData = ChevronLeftIcon;

  public customerResults: Customer[] = [];
  public selectedCustomer: Customer | null = null;
  public showCustomerResults = false;
  public searchingCustomers = false;
  public newCustomer = false;

  public deviceResults: CustomerDevice[] = [];
  public selectedDevice: CustomerDevice | null = null;
  public showDeviceResults = false;
  public searchingDevices = false;
  public newDevice = false;
  public selectedSchedulingSelection: SchedulingSelection | null = null;

  public readonly newRepairForm: NewRepairForm = new FormGroup({
    customerId: new FormControl<string | null>(null),
    customerSearchControl: new FormControl('', { nonNullable: true }),
    deviceSearchControl: new FormControl('', { nonNullable: true }),
    deviceId: new FormControl<string | null>(null),
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    email: new FormControl('', {
      nonNullable: true,
    }),
    phone: new FormControl('', {
      nonNullable: true,
    }),
    nickname: new FormControl('', {
      nonNullable: true,
    }),
    brand: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    model: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    imei: new FormControl('', {
      nonNullable: true,
    }),
    serial: new FormControl('', {
      nonNullable: true,
    }),
    problemSummary: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(500)]
    }),
    quotedPriceDollars: new FormControl<number | null>(null, {
      validators: [Validators.min(0)]
    }),
    schedulingSelected: new FormControl(false, {
      nonNullable: true,
      validators: [Validators.required, Validators.requiredTrue]
    })
  });

  readonly schedulingRequest = computed(() => ({
    title: 'Schedule Repair',
    subtitle: 'Choose an available appointment time.',
    from: this.schedulerFromIso(),
    to: this.schedulerToIso(),
    durationMinutes: this.selectedDurationMinutes(),
    assignedUserId: undefined,
    slotMinutes: 15,
  }));

  readonly schedulerFromIso = computed(() => {
    return new Date().toISOString();
  });

  readonly schedulerToIso = computed(() => {
    const end = new Date();
    end.setDate(end.getDate() + 14);
    return end.toISOString();
  });

  readonly selectedDurationMinutes = computed(() => {
    return 60;
  });

  constructor() {
    this.customerSearchControl.valueChanges
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        tap((rawValue) => {
          const value = rawValue.trim();

          this.selectedCustomer = null;
          this.newRepairForm.controls.customerId.setValue(null);

          this.clearSelectedDevice();
          this.newDevice = false;

          if (!value) {
            this.customerResults = [];
            this.showCustomerResults = false;
            this.searchingCustomers = false;
          }
        }),
        filter((rawValue) => rawValue.trim().length >= 2),
        tap(() => {
          this.searchingCustomers = true;
        }),
        switchMap((rawValue) =>
          this.searchCustomers(rawValue.trim()).pipe(
            catchError(() => {
              this.searchingCustomers = false;
              this.customerResults = [];
              this.showCustomerResults = false;
              return of([]);
            })
          )
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((results) => {
        this.customerResults = results;
        this.showCustomerResults = true;
        this.searchingCustomers = false;
      });

    this.deviceSearchControl.valueChanges
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        tap((rawValue) => {
          const value = rawValue.trim();

          this.selectedDevice = null;
          this.newRepairForm.controls.deviceId.setValue(null);

          if (!value) {
            this.deviceResults = [];
            this.showDeviceResults = false;
            this.searchingDevices = false;
          }
        }),
        filter((rawValue) => rawValue.trim().length >= 2),
        filter(() => !!this.selectedCustomer),
        tap(() => {
          this.searchingDevices = true;
        }),
        switchMap((rawValue) =>
          this.searchDevices(rawValue.trim()).pipe(
            catchError(() => {
              this.searchingDevices = false;
              this.deviceResults = [];
              this.showDeviceResults = false;
              return of([]);
            })
          )
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((results) => {
        this.deviceResults = results;
        this.showDeviceResults = true;
        this.searchingDevices = false;
      });

    this.updateCustomerValidators();
    this.updateDeviceValidators();
  }

  get customerSearchControl(): FormControl<string> {
    return this.newRepairForm.controls.customerSearchControl;
  }

  get deviceSearchControl(): FormControl<string> {
    return this.newRepairForm.controls.deviceSearchControl;
  }

  onCustomerFocus(): void {
    const value = this.customerSearchControl.value.trim();
    if (value.length >= 2 && !this.selectedCustomer) {
      this.showCustomerResults = true;
    }
  }

  onDeviceFocus(): void {
    const value = this.deviceSearchControl.value.trim();
    if (value.length >= 2 && !this.selectedDevice && !!this.selectedCustomer) {
      this.showDeviceResults = true;
    }
  }

  selectCustomer(customer: Customer): void {
    this.selectedCustomer = customer;
    this.newCustomer = false;
    this.showCustomerResults = false;

    this.newRepairForm.patchValue(
      {
        customerId: customer.id,
        customerSearchControl: customer.name ?? customer.email ?? customer.phone ?? '',
      },
      { emitEvent: false }
    );

    this.clearSelectedDevice();
    this.newDevice = false;

    this.updateCustomerValidators();
    this.updateDeviceValidators();
  }

  startNewCustomer(): void {
    this.newCustomer = true;
    this.selectedCustomer = null;
    this.showCustomerResults = false;
    this.customerResults = [];

    this.newRepairForm.patchValue({
      customerId: null,
    });

    this.clearSelectedDevice();
    this.newDevice = false;

    this.updateCustomerValidators();
    this.updateDeviceValidators();
  }

  clearSelectedCustomer(): void {
    this.selectedCustomer = null;
    this.customerResults = [];
    this.showCustomerResults = false;
    this.newCustomer = false;

    this.newRepairForm.patchValue({
      customerId: null,
      customerSearchControl: '',
    });

    this.clearSelectedDevice();
    this.newDevice = false;

    this.updateCustomerValidators();
    this.updateDeviceValidators();
  }

  selectDevice(device: CustomerDevice): void {
    this.selectedDevice = device;
    this.newDevice = false;
    this.showDeviceResults = false;

    this.newRepairForm.patchValue(
      {
        deviceId: device.id,
        deviceSearchControl: this.getDeviceDisplay(device),
      },
      { emitEvent: false }
    );

    this.updateDeviceValidators();
  }

  startNewDevice(): void {
    if (!this.selectedCustomer && !this.newCustomer) return;

    this.newDevice = true;
    this.selectedDevice = null;
    this.showDeviceResults = false;
    this.deviceResults = [];

    this.newRepairForm.patchValue({
      deviceId: null,
      deviceSearchControl: '',
    });

    this.updateDeviceValidators();
  }

  clearSelectedDevice(): void {
    this.selectedDevice = null;
    this.deviceResults = [];
    this.showDeviceResults = false;
    this.newDevice = false;

    this.newRepairForm.patchValue({
      deviceId: null,
      deviceSearchControl: '',
      nickname: '',
      brand: '',
      model: '',
      imei: '',
      serial: '',
    });

    this.updateDeviceValidators();
  }

  getDeviceDisplay(device: CustomerDevice): string {
    return device.nickname?.trim()
      || [device.brand, device.model].filter(Boolean).join(' ')
      || 'Unnamed Device';
  }

  getDeviceSecondary(device: CustomerDevice): string {
    const imei = device.imei ? `IMEI •••• ${device.imei.slice(-5)}` : null;
    const serial = device.serial ? `S/N ${device.serial}` : null;
    return [imei, serial].filter(Boolean).join(' · ');
  }

  canSearchDevices(): boolean {
    return !!this.selectedCustomer || this.newCustomer;
  }

  private searchCustomers(query: string) {
    return this.customersStore.search(query);
  }

  private searchDevices(query: string) {
    const customerId = this.newRepairForm.controls.customerId.value;
    if (!customerId) return of([]);

    return this.customerDevicesStore.search(customerId, query);
  }

  private updateCustomerValidators(): void {
    const nameControl = this.newRepairForm.controls.name;
    const emailControl = this.newRepairForm.controls.email;
    const phoneControl = this.newRepairForm.controls.phone;
    const searchControl = this.newRepairForm.controls.customerSearchControl;

    if (this.newCustomer) {
      nameControl.setValidators([Validators.required]);
      emailControl.setValidators([Validators.required, Validators.email]);
      phoneControl.setValidators([Validators.required]);
      searchControl.clearValidators();
    } else {
      nameControl.clearValidators();
      emailControl.clearValidators();
      phoneControl.clearValidators();
      searchControl.setValidators([Validators.required]);
    }

    nameControl.updateValueAndValidity({ emitEvent: false });
    emailControl.updateValueAndValidity({ emitEvent: false });
    phoneControl.updateValueAndValidity({ emitEvent: false });
    searchControl.updateValueAndValidity({ emitEvent: false });
  }

  private updateDeviceValidators(): void {
    const nicknameControl = this.newRepairForm.controls.nickname;
    const brandControl = this.newRepairForm.controls.brand;
    const modelControl = this.newRepairForm.controls.model;
    const imeiControl = this.newRepairForm.controls.imei;
    const serialControl = this.newRepairForm.controls.serial;
    const searchControl = this.newRepairForm.controls.deviceSearchControl;

    if (this.newDevice) {
      brandControl.setValidators([Validators.required]);
      modelControl.setValidators([Validators.required]);
      searchControl.clearValidators();
    } else {
      nicknameControl.clearValidators();
      brandControl.clearValidators();
      modelControl.clearValidators();
      imeiControl.clearValidators();
      serialControl.clearValidators();
      searchControl.setValidators([Validators.required]);
    }

    nicknameControl.updateValueAndValidity({ emitEvent: false });
    brandControl.updateValueAndValidity({ emitEvent: false });
    modelControl.updateValueAndValidity({ emitEvent: false });
    imeiControl.updateValueAndValidity({ emitEvent: false });
    serialControl.updateValueAndValidity({ emitEvent: false });
    searchControl.updateValueAndValidity({ emitEvent: false });
  }

  cancelNewCustomer(): void {
    this.newCustomer = false;

    this.newRepairForm.patchValue({
      name: '',
      email: '',
      phone: '',
    });

    this.updateCustomerValidators();
  }

  cancelNewDevice(): void {
    this.newDevice = false;

    this.newRepairForm.patchValue({
      nickname: '',
      brand: '',
      model: '',
      imei: '',
      serial: '',
    });

    this.updateDeviceValidators();
  }

  @HostListener('document:click')
  closeDropdowns(): void {
    this.showCustomerResults = false;
    this.showDeviceResults = false;
  }

  onSchedulingSelectionChange(selection: SchedulingSelection): void {
    this.selectedSchedulingSelection = selection;
    this.newRepairForm.patchValue({
      schedulingSelected: true
    });
  }

  private async ensureCustomer(): Promise<string | null> {
    if (!this.newCustomer) {
      return this.newRepairForm.controls.customerId.value;
    }

    const createdCustomer = await this.customersStore.create({
      name: this.newRepairForm.controls.name.value.trim(),
      email: this.newRepairForm.controls.email.value.trim() || undefined,
      phone: this.newRepairForm.controls.phone.value.trim() || undefined,
    } as any);

    if (!createdCustomer?.id) {
      console.error('Failed to create customer.');
      return null;
    }

    this.selectedCustomer = createdCustomer;
    this.newCustomer = false;

    this.newRepairForm.patchValue(
      {
        customerId: createdCustomer.id,
        customerSearchControl:
          createdCustomer.name ?? createdCustomer.email ?? createdCustomer.phone ?? '',
      },
      { emitEvent: false }
    );

    this.updateCustomerValidators();

    return createdCustomer.id;
  }

  private async ensureDevice(customerId: string): Promise<string | null> {
    if (!this.newDevice) {
      return this.newRepairForm.controls.deviceId.value;
    }

    const createdDevice = await this.customerDevicesStore.create(customerId, {
      nickname: this.newRepairForm.controls.nickname.value.trim() || undefined,
      displayName: this.newRepairForm.controls.nickname.value.trim() || undefined,
      brand: this.newRepairForm.controls.brand.value.trim(),
      model: this.newRepairForm.controls.model.value.trim(),
      imei: this.newRepairForm.controls.imei.value.trim() || undefined,
      serial: this.newRepairForm.controls.serial.value.trim() || undefined,
    } as any);

    if (!createdDevice?.id) {
      console.error('Failed to create device.');
      return null;
    }

    this.selectedDevice = createdDevice;
    this.newDevice = false;

    this.newRepairForm.patchValue(
      {
        deviceId: createdDevice.id,
        deviceSearchControl: this.getDeviceDisplay(createdDevice),
      },
      { emitEvent: false }
    );

    this.updateDeviceValidators();

    return createdDevice.id;
  }

  private dollarsToCents(value: number | null | undefined): number {
    const numeric = Number(value ?? 0);
    if (!Number.isFinite(numeric)) return 0;
    return Math.round(numeric * 100);
  }

  async createRepair(): Promise<void> {
    if (this.newRepairForm.invalid) {
      this.newRepairForm.markAllAsTouched();
      return;
    }

    try {
      const customerId = await this.ensureCustomer();
      if (!customerId) return;

      const deviceId = await this.ensureDevice(customerId);
      if (!deviceId) return;

      const repair = await this.repairsStore.createRepair({
        customerId,
        customerDeviceId: deviceId,
        problemSummary: this.newRepairForm.controls.problemSummary.value.trim(),
        assignedTo: this.selectedSchedulingSelection?.assignedTo ?? undefined,
      } as any);

      if (!repair) {
        console.error('Failed to create repair.');
        return;
      }

      const quotedPriceCents = this.dollarsToCents(
        this.newRepairForm.controls.quotedPriceDollars.value
      );

      const order = await this.repairsStore.createOrderFromRepair(repair.id, {
        items: [
          {
            type: 'service',
            name: 'Repair Service',
            quantity: 1,
            unitPriceCents: quotedPriceCents,
            notes: null,
          },
        ],
        discountCents: 0,
        tags: ['repair'],
        notes: 'Created from new repair flow',
      });

      if (!order) {
        console.error('Repair created, but order creation failed.');
      }

      if (this.selectedSchedulingSelection) {
        const scheduled = await this.appointmentsStore.scheduleAppointment(
          repair.id,
          this.selectedSchedulingSelection.startAt,
          this.selectedSchedulingSelection.endAt,
          this.selectedSchedulingSelection.assignedUserId ?? undefined
        );

        if (!scheduled) {
          console.error('Repair created, but appointment scheduling failed.');
        }
      }

      this.toastService.success('Repair Created Successfully', 'This repair was created successfully.');
      this.router.navigate(['/repairs']);
    } catch (error) {
      console.error('Failed to create repair flow.', error);
    }
  }
}