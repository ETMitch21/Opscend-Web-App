import { CommonModule } from '@angular/common';
import {
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  FormsModule,
} from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  filter,
  firstValueFrom,
  Observable,
  of,
  switchMap,
  tap,
} from 'rxjs';
import {
  ChevronLeftIcon,
  LucideAngularModule,
  LucideIconData,
} from 'lucide-angular';

import { CustomersStore } from '../../../core/customers/customers.store';
import {
  Customer,
  CustomerAddress,
} from '../../../core/customers/customer.model';
import { CustomerDevicesStore } from '../../../core/customer-devices/customer-devices.store';
import { CustomerDevice } from '../../../core/customer-devices/customer-device.model';
import { PhonePipe } from '../../../core/pipes/phone-pipe';
import { SchedulingPickerModalComponent } from '../../../components/modals/scheduling-picker-modal/scheduling-picker-modal';
import { SchedulingRequest, SchedulingSelection } from '../../../core/scheduling/scheduling.types';
import { RepairsStore } from '../../../core/repairs/repairs.store';
import { AppointmentsStore } from '../../../core/appointments/appointments.store';
import { ToastService } from '../../../core/toast/toast-service';
import { AppConfigService } from '../../../core/app-config/app-config.service';
import { RepairServiceMode } from '../../../core/repairs/repair.model';
import { ShopContextService } from '../../../core/shop/shop-context.store';
import type {
  ServiceAreaCheckReason,
  ServiceAreaCheckResponse,
} from '../../../core/shop/shop-service';

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
  serviceMode: FormControl<RepairServiceMode>;
  serviceAddressId: FormControl<string | null>;
  addressLabel: FormControl<string>;
  addressLine1: FormControl<string>;
  addressLine2: FormControl<string>;
  addressCity: FormControl<string>;
  addressState: FormControl<string>;
  addressPostalCode: FormControl<string>;
  addressCountry: FormControl<string>;
  addressNotes: FormControl<string>;
}>;

interface ShopListResponse {
  data: Array<{
    settings?: {
      booking?: {
        enabled?: boolean;
      };
      onsite?: {
        enabled?: boolean;
        tripFeeEnabled?: boolean;
        defaultTripFeeCents?: number | null;
      };
    };
  }>;
  nextCursor: string | null;
}

@Component({
  selector: 'app-new-repair',
  imports: [
    CommonModule,
    LucideAngularModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
    PhonePipe,
    SchedulingPickerModalComponent,
  ],
  templateUrl: './new-repair.html',
  styleUrl: './new-repair.scss',
})
export class NewRepair implements OnInit {
  private readonly appConfig = inject(AppConfigService);
  private readonly customersStore = inject(CustomersStore);
  private readonly customerDevicesStore = inject(CustomerDevicesStore);
  private readonly destroyRef = inject(DestroyRef);
  private readonly repairsStore = inject(RepairsStore);
  private readonly appointmentsStore = inject(AppointmentsStore);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);
  private readonly shopContext = inject(ShopContextService);

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

  public readonly leftChevronIcon: LucideIconData = ChevronLeftIcon;

  readonly bookingEnabled = signal(false);
  readonly onsiteEnabled = signal(false);
  readonly onsiteTripFeeEnabled = signal(false);
  readonly onsiteDefaultTripFeeCents = signal<number | null>(null);

  public customerAddresses: CustomerAddress[] = [];
  public loadingCustomerAddresses = false;
  public creatingInlineAddress = false;


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
  public serviceAreaCheckInFlight = false;
  public serviceAreaCheckedAddressKey: string | null = null;
  public serviceAreaStatus: ServiceAreaCheckResponse | null = null;

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
      validators: [Validators.required, Validators.maxLength(500)],
    }),
    quotedPriceDollars: new FormControl<number | null>(null, {
      validators: [Validators.min(0)],
    }),
    schedulingSelected: new FormControl(false, {
      nonNullable: true,
    }),
    serviceMode: new FormControl<RepairServiceMode>('in_shop', {
      nonNullable: true,
    }),
    serviceAddressId: new FormControl<string | null>(null),
    addressLabel: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(80)],
    }),
    addressLine1: new FormControl('', {
      nonNullable: true,
    }),
    addressLine2: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(120)],
    }),
    addressCity: new FormControl('', {
      nonNullable: true,
    }),
    addressState: new FormControl('', {
      nonNullable: true,
    }),
    addressPostalCode: new FormControl('', {
      nonNullable: true,
    }),
    addressCountry: new FormControl('US', {
      nonNullable: true,
    }),
    addressNotes: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(500)],
    }),
  });

  private get apiBase(): string {
    return this.appConfig.config.apiBase;
  }

  readonly schedulingRequest = () => {
    if (!this.bookingEnabled()) {
      return null;
    }

    const serviceMode = this.onsiteEnabled()
      ? this.newRepairForm.controls.serviceMode.value
      : 'in_shop';

    if (serviceMode === 'on_site') {
      if (this.serviceAreaCheckInFlight) {
        return null;
      }

      if (!this.serviceAreaStatus?.allowed) {
        return null;
      }
    }

    const request: SchedulingRequest = {
      title: 'Schedule Repair',
      subtitle: 'Choose an available appointment time.',
      from: this.schedulerFromIso(),
      to: this.schedulerToIso(),
      durationMinutes: this.selectedDurationMinutes(),
      assignedUserId: undefined,
      slotMinutes: 15,
      serviceMode,
    };

    if (serviceMode !== 'on_site') {
      return request;
    }

    if (this.creatingInlineAddress) {
      const inlineAddress = this.buildInlineSchedulingAddress();

      if (!inlineAddress) {
        return null;
      }

      return {
        ...request,
        serviceAddressId: null,
        serviceAddress: inlineAddress,
      };
    }

    const selectedAddressId = this.newRepairForm.controls.serviceAddressId.value;

    if (!selectedAddressId) {
      return null;
    }

    return {
      ...request,
      serviceAddressId: selectedAddressId,
      serviceAddress: null,
    };
  };

  readonly schedulerFromIso = () => {
    return new Date().toISOString();
  };

  readonly schedulerToIso = () => {
    const end = new Date();
    end.setDate(end.getDate() + 14);
    return end.toISOString();
  };

  readonly selectedDurationMinutes = () => {
    return 60;
  };

  readonly isOnSiteMode = (): boolean =>
    this.newRepairForm.controls.serviceMode.value === 'on_site';

  readonly hasValidOnsiteAddress = (): boolean => {
    if (!this.isOnSiteMode()) return true;
    return this.serviceAreaStatus?.allowed === true;
  };

  readonly shouldShowSchedulingPicker = (): boolean => {
    if (!this.bookingEnabled()) return false;
    if (!this.isOnSiteMode()) return true;
    return this.hasValidOnsiteAddress();
  };

  readonly canCreateRepair = (): boolean => {
    if (!this.newRepairForm.valid) return false;
    if (!this.isOnSiteMode()) return true;
    return this.hasValidOnsiteAddress() && !this.serviceAreaCheckInFlight;
  };

  private centsToDollars(value: number | null | undefined): number | null {
    if (value == null) return null;
    return value / 100;
  }

  private normalizePostalCode(value: string): string {
    return value.trim().toUpperCase();
  }

  private buildInlineServiceAreaPayload() {
    return {
      serviceMode: this.newRepairForm.controls.serviceMode.value,
      line1: this.newRepairForm.controls.addressLine1.value.trim(),
      line2: this.newRepairForm.controls.addressLine2.value.trim() || null,
      city: this.newRepairForm.controls.addressCity.value.trim(),
      state: this.newRepairForm.controls.addressState.value.trim(),
      postalCode: this.normalizePostalCode(
        this.newRepairForm.controls.addressPostalCode.value
      ),
      country: this.newRepairForm.controls.addressCountry.value.trim().toUpperCase(),
    };
  }

  private getSelectedAddressForCheck(): CustomerAddress | null {
    const serviceAddressId = this.newRepairForm.controls.serviceAddressId.value;
    if (!serviceAddressId) return null;

    return this.customerAddresses.find((x) => x.id === serviceAddressId) ?? null;
  }

  private buildSelectedAddressServiceAreaPayload() {
    const address = this.getSelectedAddressForCheck();
    if (!address) return null;

    return {
      serviceMode: this.newRepairForm.controls.serviceMode.value,
      line1: address.line1,
      line2: address.line2 ?? null,
      city: address.city,
      state: address.state,
      postalCode: this.normalizePostalCode(address.postalCode),
      country: address.country,
    };
  }

  private buildInlineSchedulingAddress() {
    const line1 = this.newRepairForm.controls.addressLine1.value.trim();
    const city = this.newRepairForm.controls.addressCity.value.trim();
    const state = this.newRepairForm.controls.addressState.value.trim();
    const postalCode = this.normalizePostalCode(
      this.newRepairForm.controls.addressPostalCode.value
    );
    const country = this.newRepairForm.controls.addressCountry.value.trim().toUpperCase();

    if (!line1 || !city || !state || !postalCode || !country) {
      return null;
    }

    return {
      line1,
      line2: this.newRepairForm.controls.addressLine2.value.trim() || null,
      city,
      state,
      postalCode,
      country,
    };
  }

  private getServiceAreaAddressKey(
    payload: {
      serviceMode?: 'in_shop' | 'on_site';
      line1?: string;
      line2?: string | null;
      city?: string;
      state?: string;
      postalCode?: string;
      country?: string;
    } | null
  ): string | null {
    if (!payload) return null;

    return JSON.stringify({
      serviceMode: payload.serviceMode ?? 'in_shop',
      line1: payload.line1?.trim() ?? '',
      line2: payload.line2?.trim() ?? '',
      city: payload.city?.trim() ?? '',
      state: payload.state?.trim() ?? '',
      postalCode: payload.postalCode?.trim().toUpperCase() ?? '',
      country: payload.country?.trim().toUpperCase() ?? '',
    });
  }

  private clearServiceAreaStatus(resetSelection = true): void {
    this.serviceAreaStatus = null;
    this.serviceAreaCheckedAddressKey = null;
    this.serviceAreaCheckInFlight = false;

    if (resetSelection) {
      this.selectedSchedulingSelection = null;
      this.newRepairForm.controls.schedulingSelected.setValue(false, {
        emitEvent: false,
      });
      this.updateSchedulingValidators();
    }
  }

  private toastForServiceAreaReason(reason: ServiceAreaCheckReason): void {
    switch (reason) {
      case 'ok':
        this.toastService.success(
          'Address confirmed',
          'This on-site address is inside your service area.'
        );
        return;
      case 'onsite_disabled':
        this.toastService.error(
          'On-site repairs disabled',
          'On-site service is not enabled for this shop.'
        );
        return;
      case 'service_address_required':
        this.toastService.error(
          'Address incomplete',
          'Enter a complete service address before continuing.'
        );
        return;
      case 'outside_service_area':
        this.toastService.error(
          'Outside service area',
          'That address is outside your current on-site service area.'
        );
        return;
      case 'address_not_resolved':
        this.toastService.error(
          'Address not found',
          'We could not verify that address. Please review it and try again.'
        );
        return;
      case 'shop_address_missing':
        this.toastService.error(
          'Shop location missing',
          'Your shop address is not fully configured for service-area checks.'
        );
        return;
      case 'in_shop':
      default:
        return;
    }
  }

  async validateServiceArea(showToast = true): Promise<void> {
    if (!this.onsiteEnabled()) {
      this.clearServiceAreaStatus();
      return;
    }

    if (!this.isOnSiteMode()) {
      this.clearServiceAreaStatus(false);
      this.serviceAreaStatus = {
        allowed: true,
        reason: 'in_shop',
      };
      return;
    }

    const payload = this.creatingInlineAddress
      ? this.buildInlineServiceAreaPayload()
      : this.buildSelectedAddressServiceAreaPayload();

    const key = this.getServiceAreaAddressKey(payload);

    if (!payload || !key) {
      this.clearServiceAreaStatus();
      if (showToast) {
        this.toastForServiceAreaReason('service_address_required');
      }
      return;
    }

    if (this.serviceAreaCheckedAddressKey === key && this.serviceAreaStatus) {
      if (showToast) {
        this.toastForServiceAreaReason(this.serviceAreaStatus.reason);
      }
      return;
    }

    this.serviceAreaCheckInFlight = true;
    this.selectedSchedulingSelection = null;
    this.newRepairForm.controls.schedulingSelected.setValue(false, {
      emitEvent: false,
    });
    this.updateSchedulingValidators();

    try {
      const result = await firstValueFrom(this.shopContext.checkServiceArea(payload));
      this.serviceAreaStatus = result;
      this.serviceAreaCheckedAddressKey = key;

      if (showToast) {
        this.toastForServiceAreaReason(result.reason);
      }
    } catch (error) {
      console.error('Failed to check service area.', error);
      this.serviceAreaStatus = {
        allowed: false,
        reason: 'address_not_resolved',
      };
      this.serviceAreaCheckedAddressKey = key;

      if (showToast) {
        this.toastService.error(
          'Service area check failed',
          'We could not verify that address right now.'
        );
      }
    } finally {
      this.serviceAreaCheckInFlight = false;
    }
  }

  onInlineAddressPostalBlur(): void {
    if (!this.isOnSiteMode() || !this.creatingInlineAddress) return;
    void this.validateServiceArea(true);
  }

  onServiceAddressSelectionChange(): void {
    this.clearServiceAreaStatus(false);

    if (!this.isOnSiteMode() || this.creatingInlineAddress) return;
    void this.validateServiceArea(true);
  }

  ngOnInit(): void {
    void this.loadShopCountry();
    void this.loadBookingEnabled();
  }

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
    this.updateSchedulingValidators();
  }

  get customerSearchControl(): FormControl<string> {
    return this.newRepairForm.controls.customerSearchControl;
  }

  get deviceSearchControl(): FormControl<string> {
    return this.newRepairForm.controls.deviceSearchControl;
  }

  private async loadBookingEnabled(): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.http.get<ShopListResponse>(`${this.apiBase}/shops`)
      );

      const settings = response.data?.[0]?.settings;

      this.bookingEnabled.set(settings?.booking?.enabled === true);
      this.onsiteEnabled.set(settings?.onsite?.enabled === true);
      this.onsiteTripFeeEnabled.set(settings?.onsite?.tripFeeEnabled === true);
      this.onsiteDefaultTripFeeCents.set(
        settings?.onsite?.defaultTripFeeCents ?? null
      );
    } catch (error) {
      console.error('Failed to load booking/on-site settings.', error);
      this.bookingEnabled.set(false);
      this.onsiteEnabled.set(false);
      this.onsiteTripFeeEnabled.set(false);
      this.onsiteDefaultTripFeeCents.set(null);
    } finally {
      this.updateSchedulingValidators();
      this.updateServiceValidators();
    }
  }

  private updateSchedulingValidators(): void {
    const schedulingControl = this.newRepairForm.controls.schedulingSelected;

    if (this.bookingEnabled()) {
      schedulingControl.setValidators([Validators.requiredTrue]);
      schedulingControl.setValue(!!this.selectedSchedulingSelection, {
        emitEvent: false,
      });
    } else {
      schedulingControl.clearValidators();
      schedulingControl.setValue(true, { emitEvent: false });
      this.selectedSchedulingSelection = null;
    }

    schedulingControl.updateValueAndValidity({ emitEvent: false });
  }


  private async loadCustomerAddresses(customerId: string): Promise<void> {
    this.loadingCustomerAddresses = true;

    try {
      this.customerAddresses = await this.customersStore.loadAddresses(customerId);

      const currentId = this.newRepairForm.controls.serviceAddressId.value;
      const stillExists = !!currentId && this.customerAddresses.some((x) => x.id === currentId);

      if (stillExists) return;

      const defaultAddress =
        this.customerAddresses.find((x) => x.isDefault) ??
        this.customerAddresses[0] ??
        null;

      this.newRepairForm.patchValue({
        serviceAddressId:
          this.newRepairForm.controls.serviceMode.value === 'on_site'
            ? defaultAddress?.id ?? null
            : null,
      });

      this.clearServiceAreaStatus(false);

      if (
        this.newRepairForm.controls.serviceMode.value === 'on_site' &&
        this.newRepairForm.controls.serviceAddressId.value
      ) {
        await this.validateServiceArea(false);
      }
    } finally {
      this.loadingCustomerAddresses = false;
      this.updateServiceValidators();
    }
  }

  private resetCustomerAddresses(): void {
    this.customerAddresses = [];
    this.loadingCustomerAddresses = false;
    this.creatingInlineAddress = false;
    this.clearServiceAreaStatus(false);

    this.newRepairForm.patchValue(
      {
        serviceAddressId: null,
        addressLabel: '',
        addressLine1: '',
        addressLine2: '',
        addressCity: '',
        addressState: '',
        addressPostalCode: '',
        addressCountry: this.shopCountry,
        addressNotes: '',
      },
      { emitEvent: false }
    );
  }

  private updateServiceValidators(): void {
    const serviceModeControl = this.newRepairForm.controls.serviceMode;
    const serviceAddressIdControl = this.newRepairForm.controls.serviceAddressId;

    const addressLine1Control = this.newRepairForm.controls.addressLine1;
    const addressCityControl = this.newRepairForm.controls.addressCity;
    const addressStateControl = this.newRepairForm.controls.addressState;
    const addressPostalCodeControl = this.newRepairForm.controls.addressPostalCode;
    const addressCountryControl = this.newRepairForm.controls.addressCountry;

    if (!this.onsiteEnabled()) {
      serviceModeControl.setValue('in_shop', { emitEvent: false });

      serviceAddressIdControl.clearValidators();
      addressLine1Control.clearValidators();
      addressCityControl.clearValidators();
      addressStateControl.clearValidators();
      addressPostalCodeControl.clearValidators();
      addressCountryControl.clearValidators();

      this.creatingInlineAddress = false;

      this.newRepairForm.patchValue(
        {
          serviceAddressId: null,
          addressLabel: '',
          addressLine1: '',
          addressLine2: '',
          addressCity: '',
          addressState: '',
          addressPostalCode: '',
          addressCountry: 'US',
          addressNotes: '',
        },
        { emitEvent: false }
      );
    } else if (serviceModeControl.value === 'on_site') {
      if (this.creatingInlineAddress) {
        serviceAddressIdControl.clearValidators();
        addressLine1Control.setValidators([Validators.required, Validators.maxLength(120)]);
        addressCityControl.setValidators([Validators.required, Validators.maxLength(80)]);
        addressStateControl.setValidators([Validators.required, Validators.maxLength(80)]);
        addressPostalCodeControl.setValidators([Validators.required, Validators.maxLength(20)]);
        addressCountryControl.setValidators([
          Validators.required,
          Validators.minLength(2),
          Validators.maxLength(2),
        ]);
      } else {
        serviceAddressIdControl.setValidators([Validators.required]);
        addressLine1Control.clearValidators();
        addressCityControl.clearValidators();
        addressStateControl.clearValidators();
        addressPostalCodeControl.clearValidators();
        addressCountryControl.clearValidators();

        if (!serviceAddressIdControl.value && this.customerAddresses.length) {
          const defaultAddress =
            this.customerAddresses.find((x) => x.isDefault) ??
            this.customerAddresses[0];

          serviceAddressIdControl.setValue(defaultAddress?.id ?? null, {
            emitEvent: false,
          });
        }
      }
    } else {
      serviceAddressIdControl.clearValidators();
      addressLine1Control.clearValidators();
      addressCityControl.clearValidators();
      addressStateControl.clearValidators();
      addressPostalCodeControl.clearValidators();
      addressCountryControl.clearValidators();

      this.creatingInlineAddress = false;

      this.newRepairForm.patchValue(
        {
          serviceAddressId: null,
          addressLabel: '',
          addressLine1: '',
          addressLine2: '',
          addressCity: '',
          addressState: '',
          addressPostalCode: '',
          addressCountry: 'US',
          addressNotes: '',
        },
        { emitEvent: false }
      );
    }

    serviceAddressIdControl.updateValueAndValidity({ emitEvent: false });
    addressLine1Control.updateValueAndValidity({ emitEvent: false });
    addressCityControl.updateValueAndValidity({ emitEvent: false });
    addressStateControl.updateValueAndValidity({ emitEvent: false });
    addressPostalCodeControl.updateValueAndValidity({ emitEvent: false });
    addressCountryControl.updateValueAndValidity({ emitEvent: false });
  }

  onServiceModeChange(mode: RepairServiceMode): void {
    this.newRepairForm.patchValue({
      serviceMode: mode,
    });

    this.clearServiceAreaStatus();

    if (mode === 'in_shop') {
      this.creatingInlineAddress = false;
      this.newRepairForm.patchValue({
        serviceAddressId: null,
        addressLabel: '',
        addressLine1: '',
        addressLine2: '',
        addressCity: '',
        addressState: '',
        addressPostalCode: '',
        addressCountry: this.shopCountry,
        addressNotes: '',
      });
    }

    if (mode === 'on_site' && !this.customerAddresses.length) {
      this.creatingInlineAddress = true;
    }

    this.updateServiceValidators();
  }

  startInlineAddress(): void {
    this.creatingInlineAddress = true;
    this.clearServiceAreaStatus();
    this.newRepairForm.patchValue({
      serviceAddressId: null,
      addressLabel: '',
      addressLine1: '',
      addressLine2: '',
      addressCity: '',
      addressState: '',
      addressPostalCode: '',
      addressCountry: this.shopCountry,
      addressNotes: '',
    });
    this.updateServiceValidators();
  }

  cancelInlineAddress(): void {
    this.creatingInlineAddress = false;
    this.clearServiceAreaStatus();

    const defaultAddress =
      this.customerAddresses.find((x) => x.isDefault) ??
      this.customerAddresses[0] ??
      null;

    this.newRepairForm.patchValue({
      serviceAddressId: defaultAddress?.id ?? null,
      addressLabel: '',
      addressLine1: '',
      addressLine2: '',
      addressCity: '',
      addressState: '',
      addressPostalCode: '',
      addressCountry: this.shopCountry,
      addressNotes: '',
    });

    this.updateServiceValidators();
  }

  formatAddressLabel(address: CustomerAddress): string {
    return address.label?.trim() || 'Address';
  }

  formatAddressSummary(address: CustomerAddress): string {
    return [
      address.line1,
      address.line2,
      `${address.city}, ${address.state} ${address.postalCode}`.trim(),
    ]
      .filter(Boolean)
      .join(' • ');
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
    void this.loadCustomerAddresses(customer.id);
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
    this.resetCustomerAddresses();

    this.updateCustomerValidators();
    this.updateDeviceValidators();
    this.updateServiceValidators();
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
    this.resetCustomerAddresses();

    this.updateCustomerValidators();
    this.updateDeviceValidators();
    this.updateServiceValidators();
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
    return (
      device.nickname?.trim() ||
      [device.brand, device.model].filter(Boolean).join(' ') ||
      'Unnamed Device'
    );
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
    if (!this.bookingEnabled()) return;

    this.selectedSchedulingSelection = selection;
    this.newRepairForm.patchValue({
      schedulingSelected: true,
    });
    this.updateSchedulingValidators();
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
    await this.loadCustomerAddresses(createdCustomer.id);

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


  private async ensureServiceAddress(customerId: string): Promise<string | null> {
    if (!this.onsiteEnabled() || this.newRepairForm.controls.serviceMode.value !== 'on_site') {
      return null;
    }

    if (!this.creatingInlineAddress) {
      return this.newRepairForm.controls.serviceAddressId.value;
    }

    const created = await this.customersStore.createAddress(customerId, {
      label: this.newRepairForm.controls.addressLabel.value.trim() || null,
      line1: this.newRepairForm.controls.addressLine1.value.trim(),
      line2: this.newRepairForm.controls.addressLine2.value.trim() || null,
      city: this.newRepairForm.controls.addressCity.value.trim(),
      state: this.newRepairForm.controls.addressState.value.trim(),
      postalCode: this.normalizePostalCode(
        this.newRepairForm.controls.addressPostalCode.value
      ),
      country: this.newRepairForm.controls.addressCountry.value.trim().toUpperCase(),
      notes: this.newRepairForm.controls.addressNotes.value.trim() || null,
      isDefault: this.customerAddresses.length === 0,
    });

    if (!created) {
      console.error('Failed to create service address.');
      return null;
    }

    await this.loadCustomerAddresses(customerId);
    this.creatingInlineAddress = false;

    this.newRepairForm.patchValue({
      serviceAddressId: created.id,
      addressLabel: '',
      addressLine1: '',
      addressLine2: '',
      addressCity: '',
      addressState: '',
      addressPostalCode: '',
      addressCountry: 'US',
      addressNotes: '',
    });

    this.updateServiceValidators();
    this.serviceAreaStatus = {
      allowed: true,
      reason: 'ok',
    };
    this.serviceAreaCheckedAddressKey = this.getServiceAreaAddressKey(
      this.buildSelectedAddressServiceAreaPayload()
    );
    return created.id;
  }

  private dollarsToCents(value: number | null | undefined): number {
    const numeric = Number(value ?? 0);
    if (!Number.isFinite(numeric)) return 0;
    return Math.round(numeric * 100);
  }

  async createRepair(): Promise<void> {
    if (!this.canCreateRepair()) {
      if (this.newRepairForm.invalid) {
        this.newRepairForm.markAllAsTouched();
      }

      if (this.isOnSiteMode() && !this.hasValidOnsiteAddress()) {
        this.toastService.error(
          'Valid on-site address required',
          'Please confirm a serviceable on-site address before creating this repair.'
        );
      }
      return;
    }

    const schedulingSelection = this.selectedSchedulingSelection
  ? { ...this.selectedSchedulingSelection }
  : null;

    try {
      const customerId = await this.ensureCustomer();
      if (!customerId) return;

      const deviceId = await this.ensureDevice(customerId);
      if (!deviceId) return;

      const serviceMode = this.onsiteEnabled()
        ? this.newRepairForm.controls.serviceMode.value
        : 'in_shop';

      const serviceAddressId =
        serviceMode === 'on_site'
          ? await this.ensureServiceAddress(customerId)
          : null;

      if (serviceMode === 'on_site' && !serviceAddressId) {
        return;
      }

      const repair = await this.repairsStore.createRepair({
        customerId,
        customerDeviceId: deviceId,
        problemSummary: this.newRepairForm.controls.problemSummary.value.trim(),
        assignedTo: this.bookingEnabled()
  ? schedulingSelection?.assignedTo ?? undefined
  : undefined,
        serviceMode,
        serviceAddressId:
          serviceMode === 'on_site' ? serviceAddressId ?? undefined : undefined,
        tripFeeApplied: serviceMode === 'on_site' && this.onsiteTripFeeEnabled(),
        tripFeeCents:
          serviceMode === 'on_site' && this.onsiteTripFeeEnabled()
            ? this.onsiteDefaultTripFeeCents()
            : null,
      } as any);

      if (!repair) {
        console.error('Failed to create repair.');
        return;
      }

      const quotedPriceCents = this.dollarsToCents(
        this.newRepairForm.controls.quotedPriceDollars.value
      );

      const items = [
        {
          type: 'service',
          name: 'Repair Service',
          quantity: 1,
          unitPriceCents: quotedPriceCents,
          notes: null,
        },
      ];

      if (
        serviceMode === 'on_site' &&
        this.onsiteTripFeeEnabled() &&
        this.onsiteDefaultTripFeeCents() != null
      ) {
        items.push({
          type: 'service',
          name: 'On-Site Trip Fee',
          quantity: 1,
          unitPriceCents: this.onsiteDefaultTripFeeCents()!,
          notes: null,
        });
      }

      const order = await this.repairsStore.createOrderFromRepair(repair.id, {
        items,
        discountCents: 0,
        tags: ['repair'],
        notes: 'Created from new repair flow',
      });

      if (!order) {
        console.error('Repair created, but order creation failed.');
      }

      if (this.bookingEnabled() && schedulingSelection) {
  const scheduled = await this.appointmentsStore.scheduleAppointment(
    repair.id,
    schedulingSelection.startAt,
    schedulingSelection.endAt,
    schedulingSelection.assignedUserId ?? undefined
  );

  if (!scheduled) {
    console.error('Repair created, but appointment scheduling failed.');
  }
}

      this.toastService.success(
        'Repair Created Successfully',
        'This repair was created successfully.'
      );
      this.router.navigate(['/repairs']);
    } catch (error) {
      console.error('Failed to create repair flow.', error);
    }
  }

  private async loadShopCountry(): Promise<void> {
    const shop = await firstValueFrom(this.shopContext.load());
    this.shopCountry = shop?.address?.country || shop?.locale?.country || 'US';

    this.newRepairForm.patchValue(
      {
        addressCountry: this.shopCountry,
      },
      { emitEvent: false }
    );
  }
}