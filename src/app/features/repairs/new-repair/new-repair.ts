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
  FormsModule,
  ReactiveFormsModule,
  Validators,
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
  from,
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
import {
  SchedulingRequest,
  SchedulingSelection,
} from '../../../core/scheduling/scheduling.types';
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
import {
  TechSpecsBrand,
  TechSpecsModel,
  TechSpecsService,
} from '../../../core/techspecs/techspecs.service';

import { ProductsService } from '../../../core/products/products-service';
import { Product } from '../../../core/products/products-model';
import { ServicesService } from '../../../core/services/service';
import { Service } from '../../../core/services/model';
import { MobileSentrixService } from '../../../core/mobilesentrix/mobilesentrix-service';
import { mapMobileSentrixItems } from '../../../core/mobilesentrix/mobilesentrix-search-mapper';

type RepairWizardStep = 'customer' | 'device' | 'repair' | 'service' | 'review';

type NewRepairForm = FormGroup<{
  customerId: FormControl<string | null>;
  customerSearchControl: FormControl<string>;

  deviceId: FormControl<string | null>;
  deviceSearchControl: FormControl<string>;

  name: FormControl<string>;
  email: FormControl<string>;
  phone: FormControl<string>;

  catalogRef: FormControl<string | null>;
  techSpecsBrandSearchControl: FormControl<string>;
  techSpecsModelSearchControl: FormControl<string>;
  nickname: FormControl<string>;
  brand: FormControl<string>;
  model: FormControl<string>;
  imei: FormControl<string>;
  serial: FormControl<string>;

  problemSummary: FormControl<string>;
  repairNeedKey: FormControl<string>;
  repairServiceKey: FormControl<string>;
  customerNotes: FormControl<string>;
  partSearchControl: FormControl<string>;
  selectedInventoryProductId: FormControl<string | null>;
  selectedSupplierPartId: FormControl<string | null>;
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
    id: string;
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

interface RepairNeedOption {
  key: string;
  shortLabel: string;
  label: string;
  description: string;
}

interface RepairServiceOption {
  key: string;
  serviceId: string;
  needKey: string;
  label: string;
  description: string;
  defaultLaborCents: number;
  searchTerms: string[];
  tags: string[];
}

type SelectedPartSource = 'inventory' | 'mobilesentrix' | 'none' | 'later';

interface SelectedPartDraft {
  source: SelectedPartSource;
  id?: string | null;
  name: string;
  sku?: string | null;
  costCents?: number | null;
  priceCents?: number | null;
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
  private readonly techSpecsService = inject(TechSpecsService);
  private readonly servicesService = inject(ServicesService);
  private readonly productsService = inject(ProductsService);
  private readonly mobileSentrixService = inject(MobileSentrixService);

  private readonly preferredDeviceCatalogCategories = [
    'Mobile Phones',
    'Cell Phones',
    'Smartphones',
    'Phones',
    'Phone',
  ];

  private readonly deviceCatalogPageSize = 20;

  private readonly popularBrandsByCountryCategory: Record<
    string,
    Record<string, string[]>
  > = {
    US: {
      smartphones: ['Apple', 'Samsung', 'Google', 'Motorola', 'OnePlus', 'LG'],
      'cell phones': [
        'Apple',
        'Samsung',
        'Google',
        'Motorola',
        'OnePlus',
        'LG',
      ],
      phones: ['Apple', 'Samsung', 'Google', 'Motorola', 'OnePlus', 'LG'],
      tablets: ['Apple', 'Samsung', 'Microsoft', 'Lenovo', 'Amazon'],
      laptops: ['Apple', 'Dell', 'HP', 'Lenovo', 'Microsoft', 'Acer', 'Asus'],
    },
  };

  private readonly defaultPopularBrandsByCategory: Record<string, string[]> = {
    smartphones: ['Apple', 'Samsung', 'Google', 'Motorola', 'OnePlus'],
    'cell phones': ['Apple', 'Samsung', 'Google', 'Motorola', 'OnePlus'],
    phones: ['Apple', 'Samsung', 'Google', 'Motorola', 'OnePlus'],
    tablets: ['Apple', 'Samsung', 'Microsoft', 'Lenovo', 'Amazon'],
    laptops: ['Apple', 'Dell', 'HP', 'Lenovo', 'Microsoft', 'Acer', 'Asus'],
  };

  private readonly regionBlocklistByCountry: Record<string, string[]> = {
    US: [
      'china',
      'chinese',
      'india',
      'indian',
      'japan',
      'japanese',
      'korea',
      'korean',
      'hong kong',
      'taiwan',
      'russia',
      'europe',
      'european',
      'middle east',
      'latin america',
      'brazil',
      'mexico',
      'canada',
      'global',
      'international',
      'dual sim',
      'dual-sim',
      'dualsim',
    ],
  };

  public shopId: string | null = null;
  public shopCountry = 'US';
  public deviceCatalogCategory: string | null = null;
  public loadingDeviceCatalogCategory = false;

  private deviceCatalogCategoryLoadPromise: Promise<void> | null = null;

  public readonly leftChevronIcon: LucideIconData = ChevronLeftIcon;

  public readonly steps: Array<{
    key: RepairWizardStep;
    label: string;
    eyebrow: string;
  }> = [
    { key: 'customer', label: 'Customer', eyebrow: 'Who is this for?' },
    { key: 'device', label: 'Device', eyebrow: 'What are we fixing?' },
    { key: 'repair', label: 'Repair', eyebrow: 'What is wrong?' },
    { key: 'service', label: 'Service', eyebrow: 'Where and when?' },
    { key: 'review', label: 'Review', eyebrow: 'Confirm details' },
  ];

  public readonly currentStep = signal<RepairWizardStep>('customer');
  public readonly bookingEnabled = signal(false);
  public readonly onsiteEnabled = signal(false);
  public readonly onsiteTripFeeEnabled = signal(false);
  public readonly onsiteDefaultTripFeeCents = signal<number | null>(null);

  public creatingRepair = false;

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

  public techSpecsBrandResults: TechSpecsBrand[] = [];
  public techSpecsModelResults: TechSpecsModel[] = [];
  public selectedTechSpecsBrand: TechSpecsBrand | null = null;
  public selectedTechSpecsModel: TechSpecsModel | null = null;
  public showTechSpecsBrandResults = false;
  public showTechSpecsModelResults = false;
  public searchingTechSpecsBrands = false;
  public searchingTechSpecsModels = false;

  public readonly repairNeeds: RepairNeedOption[] = [
    {
      key: 'screen_damage',
      shortLabel: 'Screen',
      label: 'Screen damage',
      description:
        'Cracked glass, display lines, black screen, or touch issues.',
    },
    {
      key: 'battery_issue',
      shortLabel: 'Battery',
      label: 'Battery issue',
      description:
        'Poor battery life, swelling, charging cycles, or random shutdowns.',
    },
    {
      key: 'charging_issue',
      shortLabel: 'Charging',
      label: 'Charging issue',
      description:
        'Won’t charge, loose port, slow charging, or cable detection issues.',
    },
    {
      key: 'camera_issue',
      shortLabel: 'Camera',
      label: 'Camera issue',
      description:
        'Blurry camera, broken lens, camera app failure, or focus problems.',
    },
    {
      key: 'back_glass_damage',
      shortLabel: 'Back glass',
      label: 'Back glass damage',
      description: 'Cracked back housing or rear glass damage.',
    },
    {
      key: 'speaker_audio',
      shortLabel: 'Audio',
      label: 'Speaker / audio issue',
      description: 'Speaker, microphone, receiver, or audio quality issue.',
    },
    {
      key: 'button_issue',
      shortLabel: 'Buttons',
      label: 'Button issue',
      description: 'Power, volume, mute, home, or side button issue.',
    },
    {
      key: 'water_damage',
      shortLabel: 'Water damage',
      label: 'Water damage',
      description:
        'Liquid exposure, corrosion, or intermittent behavior after moisture.',
    },
    {
      key: 'no_power',
      shortLabel: 'No power',
      label: 'No power',
      description: 'Device will not power on or appears completely dead.',
    },
    {
      key: 'software_diagnostics',
      shortLabel: 'Software',
      label: 'Software / diagnostics',
      description:
        'Software issue, setup help, diagnostics, or unknown behavior.',
    },
    {
      key: 'other',
      shortLabel: 'Other',
      label: 'Other repair need',
      description: 'Something else not listed here.',
    },
  ];

  public repairServices: RepairServiceOption[] = [];
  public loadingRepairServices = false;
  public repairServicesLookupFailed = false;
  public activeShopServices: Service[] = [];

  public selectedPart: SelectedPartDraft | null = null;
  public showPartsPanel = false;
  public inventoryPartResults: any[] = [];
  public mobileSentrixPartResults: any[] = [];
  public partLookupStarted = false;
  public searchingInventoryParts = false;
  public searchingMobileSentrixParts = false;
  public inventoryLookupFailed = false;
  public mobileSentrixLookupFailed = false;

  public customerAddresses: CustomerAddress[] = [];
  public loadingCustomerAddresses = false;
  public creatingInlineAddress = false;
  public selectedSchedulingSelection: SchedulingSelection | null = null;
  public serviceAreaCheckInFlight = false;
  public serviceAreaCheckedAddressKey: string | null = null;
  public serviceAreaStatus: ServiceAreaCheckResponse | null = null;

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

  public readonly newRepairForm: NewRepairForm = new FormGroup({
    customerId: new FormControl<string | null>(null),
    customerSearchControl: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),

    deviceId: new FormControl<string | null>(null),
    deviceSearchControl: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),

    name: new FormControl('', { nonNullable: true }),
    email: new FormControl('', { nonNullable: true }),
    phone: new FormControl('', { nonNullable: true }),

    catalogRef: new FormControl<string | null>(null),
    techSpecsBrandSearchControl: new FormControl('', { nonNullable: true }),
    techSpecsModelSearchControl: new FormControl('', { nonNullable: true }),
    nickname: new FormControl('', { nonNullable: true }),
    brand: new FormControl('', { nonNullable: true }),
    model: new FormControl('', { nonNullable: true }),
    imei: new FormControl('', { nonNullable: true }),
    serial: new FormControl('', { nonNullable: true }),

    problemSummary: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(500)],
    }),
    repairNeedKey: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    repairServiceKey: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    customerNotes: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(500)],
    }),
    partSearchControl: new FormControl('', { nonNullable: true }),
    selectedInventoryProductId: new FormControl<string | null>(null),
    selectedSupplierPartId: new FormControl<string | null>(null),
    quotedPriceDollars: new FormControl<number | null>(null, {
      validators: [Validators.min(0)],
    }),

    schedulingSelected: new FormControl(false, { nonNullable: true }),
    serviceMode: new FormControl<RepairServiceMode>('in_shop', {
      nonNullable: true,
    }),
    serviceAddressId: new FormControl<string | null>(null),
    addressLabel: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(80)],
    }),
    addressLine1: new FormControl('', { nonNullable: true }),
    addressLine2: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(120)],
    }),
    addressCity: new FormControl('', { nonNullable: true }),
    addressState: new FormControl('', { nonNullable: true }),
    addressPostalCode: new FormControl('', { nonNullable: true }),
    addressCountry: new FormControl('US', { nonNullable: true }),
    addressNotes: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(500)],
    }),
  });

  private get apiBase(): string {
    return this.appConfig.config.apiBase;
  }

  constructor() {
    this.customerSearchControl.valueChanges
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        tap((rawValue) => {
          const value = rawValue.trim();

          if (!this.newCustomer) {
            this.selectedCustomer = null;
            this.newRepairForm.controls.customerId.setValue(null, {
              emitEvent: false,
            });
            this.clearSelectedDevice(false);
            this.resetCustomerAddresses();
          }

          if (!value) {
            this.customerResults = [];
            this.showCustomerResults = false;
            this.searchingCustomers = false;
          }
        }),
        filter(() => !this.newCustomer),
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
              this.toastService.error(
                'Customer search failed',
                'We could not search customers right now.',
              );
              return of([]);
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((results) => {
        this.customerResults = results;
        this.showCustomerResults = true;
        this.searchingCustomers = false;
      });

    this.newRepairForm.controls.email.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.updateCustomerValidators());

    this.newRepairForm.controls.phone.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.updateCustomerValidators());

    this.deviceSearchControl.valueChanges
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        tap((rawValue) => {
          const value = rawValue.trim();

          if (!this.newDevice) {
            this.selectedDevice = null;
            this.newRepairForm.controls.deviceId.setValue(null, {
              emitEvent: false,
            });
          }

          if (!value) {
            this.deviceResults = [];
            this.showDeviceResults = false;
            this.searchingDevices = false;
          }
        }),
        filter(() => !this.newDevice),
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
              this.toastService.error(
                'Device search failed',
                'We could not search this customer’s devices right now.',
              );
              return of([]);
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((results) => {
        this.deviceResults = results;
        this.showDeviceResults = true;
        this.searchingDevices = false;
      });

    this.techSpecsBrandSearchControl.valueChanges
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        tap((rawValue) => {
          const value = rawValue.trim();

          if (this.selectedTechSpecsBrand?.name !== value) {
            this.selectedTechSpecsBrand = null;
            this.selectedTechSpecsModel = null;
            this.techSpecsModelResults = [];
            this.showTechSpecsModelResults = false;
            this.newRepairForm.patchValue(
              {
                catalogRef: null,
                techSpecsModelSearchControl: '',
                brand: '',
                model: '',
                nickname: '',
              },
              { emitEvent: false },
            );
          }

          if (!value) {
            this.techSpecsBrandResults = [];
            this.showTechSpecsBrandResults = false;
            this.searchingTechSpecsBrands = false;
          }
        }),
        filter(() => this.newDevice),
        filter((rawValue) => rawValue.trim().length >= 2),
        tap(() => {
          this.searchingTechSpecsBrands = true;
          this.showTechSpecsBrandResults = true;
        }),
        switchMap((rawValue) => {
          const search = rawValue.trim();
          const searchKey = this.normalizeCatalogKey(search);

          const preferredMatches = this.getPreferredCatalogBrandOptions()
            .filter((brand) =>
              this.normalizeCatalogKey(brand.name).includes(searchKey),
            )
            .map((brand) => brand.name);

          if (preferredMatches.length) {
            return of({ items: preferredMatches });
          }

          return from(this.loadDeviceCatalogCategory(true)).pipe(
            switchMap(() => {
              const category = this.deviceCatalogCategory;

              if (!category) {
                this.searchingTechSpecsBrands = false;
                this.showTechSpecsBrandResults = true;
                return of({ items: [] });
              }

              return this.techSpecsService
                .searchBrands(category, search, {
                  page: 0,
                  size: this.deviceCatalogPageSize,
                })
                .pipe(
                  catchError(() => {
                    this.searchingTechSpecsBrands = false;
                    this.techSpecsBrandResults = [];
                    this.showTechSpecsBrandResults = true;
                    this.toastService.error(
                      'Brand lookup failed',
                      'We could not search TechSpecs brands right now.',
                    );
                    return of({ items: [] });
                  }),
                );
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((response) => {
        this.techSpecsBrandResults = this.unwrapBrandPage(
          response,
          this.techSpecsBrandSearchControl.value,
        );
        this.showTechSpecsBrandResults = true;
        this.searchingTechSpecsBrands = false;
      });

    this.techSpecsModelSearchControl.valueChanges
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        tap((rawValue) => {
          const value = rawValue.trim();

          if (this.selectedTechSpecsModel?.name !== value) {
            this.selectedTechSpecsModel = null;
            this.newRepairForm.patchValue(
              {
                catalogRef: null,
                model: '',
                nickname: this.buildDefaultDeviceNickname(
                  this.selectedTechSpecsBrand?.name ?? '',
                ),
              },
              { emitEvent: false },
            );
          }

          if (!value) {
            this.techSpecsModelResults = [];
            this.showTechSpecsModelResults = false;
            this.searchingTechSpecsModels = false;
          }
        }),
        filter(() => this.newDevice),
        filter(() => !!this.selectedTechSpecsBrand),
        filter((rawValue) => rawValue.trim().length >= 1),
        tap(() => {
          this.searchingTechSpecsModels = true;
          this.showTechSpecsModelResults = true;
        }),
        switchMap((rawValue) =>
          from(this.loadDeviceCatalogCategory(true)).pipe(
            switchMap(() => {
              const category = this.deviceCatalogCategory;

              if (!category || !this.selectedTechSpecsBrand) {
                this.searchingTechSpecsModels = false;
                this.showTechSpecsModelResults = true;
                return of({ items: [] });
              }

              return this.techSpecsService
                .searchModels(
                  category,
                  this.selectedTechSpecsBrand.name,
                  rawValue.trim(),
                  {
                    page: 0,
                    size: this.deviceCatalogPageSize,
                  },
                )
                .pipe(
                  catchError(() => {
                    this.searchingTechSpecsModels = false;
                    this.techSpecsModelResults = [];
                    this.showTechSpecsModelResults = true;
                    this.toastService.error(
                      'Model lookup failed',
                      'We could not search TechSpecs models right now.',
                    );
                    return of({ items: [] });
                  }),
                );
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((response) => {
        this.techSpecsModelResults = this.unwrapModelPage(response);
        this.showTechSpecsModelResults = true;
        this.searchingTechSpecsModels = false;
      });

    this.newRepairForm.controls.customerNotes.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.updateProblemSummaryFromStructuredFields());

    this.updateCustomerValidators();
    this.updateDeviceValidators();
    this.updateSchedulingValidators();
    this.updateServiceValidators();
  }

  ngOnInit(): void {
    void this.loadShopContext();
    void this.loadBookingEnabled();
    void this.loadRepairServices();
  }

  get customerSearchControl(): FormControl<string> {
    return this.newRepairForm.controls.customerSearchControl;
  }

  get deviceSearchControl(): FormControl<string> {
    return this.newRepairForm.controls.deviceSearchControl;
  }

  get techSpecsBrandSearchControl(): FormControl<string> {
    return this.newRepairForm.controls.techSpecsBrandSearchControl;
  }

  get techSpecsModelSearchControl(): FormControl<string> {
    return this.newRepairForm.controls.techSpecsModelSearchControl;
  }

  readonly schedulingRequest = (): SchedulingRequest | null => {
    if (!this.bookingEnabled()) return null;

    const serviceMode = this.onsiteEnabled()
      ? this.newRepairForm.controls.serviceMode.value
      : 'in_shop';

    if (serviceMode === 'on_site') {
      if (this.serviceAreaCheckInFlight) return null;
      if (!this.serviceAreaStatus?.allowed) return null;
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

    if (serviceMode !== 'on_site') return request;

    if (this.creatingInlineAddress) {
      const inlineAddress = this.buildInlineSchedulingAddress();
      if (!inlineAddress) return null;

      return {
        ...request,
        serviceAddressId: null,
        serviceAddress: inlineAddress,
      };
    }

    const selectedAddressId =
      this.newRepairForm.controls.serviceAddressId.value;
    if (!selectedAddressId) return null;

    return {
      ...request,
      serviceAddressId: selectedAddressId,
      serviceAddress: null,
    };
  };

  readonly schedulerFromIso = (): string => new Date().toISOString();

  readonly schedulerToIso = (): string => {
    const end = new Date();
    end.setDate(end.getDate() + 14);
    return end.toISOString();
  };

  readonly selectedDurationMinutes = (): number => 60;

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
    if (this.creatingRepair) return false;
    if (!this.newRepairForm.valid) return false;
    if (!this.isCustomerStepValid()) return false;
    if (!this.isDeviceStepValid()) return false;
    if (!this.isRepairStepValid()) return false;
    if (!this.isServiceStepValid()) return false;
    if (!this.isOnSiteMode()) return true;
    return this.hasValidOnsiteAddress() && !this.serviceAreaCheckInFlight;
  };

  currentStepIndex(): number {
    return this.steps.findIndex((step) => step.key === this.currentStep());
  }

  isStepComplete(step: RepairWizardStep): boolean {
    switch (step) {
      case 'customer':
        return this.isCustomerStepValid();
      case 'device':
        return this.isDeviceStepValid();
      case 'repair':
        return this.isRepairStepValid();
      case 'service':
        return this.isServiceStepValid();
      case 'review':
        return this.canCreateRepair();
      default:
        return false;
    }
  }

  isStepDisabled(step: RepairWizardStep): boolean {
    const targetIndex = this.steps.findIndex((item) => item.key === step);
    if (targetIndex <= this.currentStepIndex()) return false;

    for (let i = 0; i < targetIndex; i += 1) {
      if (!this.isStepComplete(this.steps[i].key)) return true;
    }

    return false;
  }

  goToStep(step: RepairWizardStep): void {
    if (this.isStepDisabled(step)) return;
    this.closeDropdowns();
    this.currentStep.set(step);

    if (step === 'device') {
      this.prepareDeviceStep();
    }
  }

  goBack(): void {
    const index = this.currentStepIndex();
    if (index <= 0) return;
    this.closeDropdowns();
    this.currentStep.set(this.steps[index - 1].key);
  }

  continueStep(): void {
    const step = this.currentStep();

    if (!this.isStepComplete(step)) {
      this.markStepTouched(step);
      this.showStepError(step);
      return;
    }

    const index = this.currentStepIndex();
    const next = this.steps[index + 1]?.key;
    if (!next) return;

    this.closeDropdowns();
    this.currentStep.set(next);

    if (next === 'device') {
      this.prepareDeviceStep();
    }
  }

  primaryButtonLabel(): string {
    if (this.creatingRepair) return 'Creating...';
    if (this.currentStep() === 'review') return 'Create Repair';
    return 'Continue';
  }

  onPrimaryAction(): void {
    if (this.currentStep() === 'review') {
      void this.createRepair();
      return;
    }

    this.continueStep();
  }

  customerSummary(): string {
    if (this.selectedCustomer) {
      return (
        this.selectedCustomer.name ??
        this.selectedCustomer.email ??
        this.selectedCustomer.phone ??
        'Selected customer'
      );
    }

    if (this.newCustomer) {
      return this.newRepairForm.controls.name.value.trim() || 'New customer';
    }

    return 'Not selected';
  }

  customerSecondarySummary(): string {
    if (this.selectedCustomer) {
      return (
        [this.selectedCustomer.email, this.selectedCustomer.phone]
          .filter(Boolean)
          .join(' · ') || 'No contact details'
      );
    }

    if (this.newCustomer) {
      return (
        [
          this.newRepairForm.controls.email.value.trim(),
          this.newRepairForm.controls.phone.value.trim(),
        ]
          .filter(Boolean)
          .join(' · ') || 'Contact details required'
      );
    }

    return 'Choose or create a customer';
  }

  deviceSummary(): string {
    if (this.selectedDevice) return this.getDeviceDisplay(this.selectedDevice);

    if (this.newDevice) {
      return (
        this.newRepairForm.controls.nickname.value.trim() ||
        [
          this.newRepairForm.controls.brand.value.trim(),
          this.newRepairForm.controls.model.value.trim(),
        ]
          .filter(Boolean)
          .join(' ') ||
        'New device'
      );
    }

    return 'Not selected';
  }

  deviceSecondarySummary(): string {
    if (this.selectedDevice) {
      return (
        this.getDeviceSecondary(this.selectedDevice) || 'Saved customer device'
      );
    }

    if (this.newDevice) {
      if (this.selectedTechSpecsModel) return 'Matched from TechSpecs';
      return 'TechSpecs model required';
    }

    return 'Choose or add a device';
  }

  repairSummary(): string {
    const need = this.selectedRepairNeed();
    const service = this.selectedRepairService();

    if (need && service) return `${need.label} — ${service.label}`;
    if (need) return need.label;

    return 'No repair need selected';
  }

  repairSecondarySummary(): string {
    const part = this.selectedPartSummary();
    const notes = this.newRepairForm.controls.customerNotes.value.trim();
    return (
      [part, notes].filter(Boolean).join(' · ') ||
      'No parts or notes selected yet'
    );
  }

  quotedPriceSummary(): string {
    const value = this.newRepairForm.controls.quotedPriceDollars.value;
    if (value == null || value === 0) return 'No quoted price';
    return `$${Number(value).toFixed(2)}`;
  }

  serviceSummary(): string {
    const serviceMode = this.onsiteEnabled()
      ? this.newRepairForm.controls.serviceMode.value
      : 'in_shop';

    return serviceMode === 'on_site' ? 'On-site' : 'In-shop';
  }

  serviceSecondarySummary(): string {
    if (!this.bookingEnabled()) return 'Scheduling disabled';

    if (!this.selectedSchedulingSelection) {
      return 'Appointment not selected';
    }

    return `${this.formatDateTime(this.selectedSchedulingSelection.startAt)} – ${this.formatTime(
      this.selectedSchedulingSelection.endAt,
    )}`;
  }

  tripFeeSummary(): string {
    if (
      this.newRepairForm.controls.serviceMode.value === 'on_site' &&
      this.onsiteTripFeeEnabled() &&
      this.onsiteDefaultTripFeeCents() != null
    ) {
      return `$${this.centsToDollars(this.onsiteDefaultTripFeeCents())?.toFixed(2)}`;
    }

    return 'None';
  }

  private async loadRepairServices(): Promise<void> {
    this.loadingRepairServices = true;
    this.repairServicesLookupFailed = false;

    try {
      const services = await firstValueFrom(
        this.servicesService.listActive(150),
      );
      this.activeShopServices = services;
      this.repairServices = this.mapServicesToRepairOptions(services);
    } catch {
      this.activeShopServices = [];
      this.repairServices = [];
      this.repairServicesLookupFailed = true;
      this.toastService.error(
        'Services could not be loaded',
        'The active service catalog could not be loaded. Refresh and try again.',
      );
    } finally {
      this.loadingRepairServices = false;
    }
  }

  private mapServicesToRepairOptions(
    services: Service[],
  ): RepairServiceOption[] {
    return services
      .filter((service) => service.status === 'active')
      .flatMap((service) => {
        const needKeys = this.inferRepairNeedKeys(service);

        return needKeys.map((needKey) => ({
          key: `${service.id}:${needKey}`,
          serviceId: service.id,
          needKey,
          label: service.name,
          description: this.serviceDescription(service),
          defaultLaborCents: Number(service.price ?? 0),
          searchTerms: this.serviceSearchTerms(service, needKey),
          tags: service.tags ?? [],
        }));
      })
      .sort((a, b) => {
        const priceSort = b.defaultLaborCents - a.defaultLaborCents;
        if (priceSort !== 0) return priceSort;
        return a.label.localeCompare(b.label);
      });
  }

  private inferRepairNeedKeys(service: Service): string[] {
    const haystack = this.normalizeServiceText(
      [service.name, service.code, ...(service.tags ?? [])]
        .filter(Boolean)
        .join(' '),
    );

    const matches: string[] = [];

    const add = (key: string) => {
      if (!matches.includes(key)) matches.push(key);
    };

    if (/\b(back glass|rear glass|housing|backglass)\b/.test(haystack)) {
      add('back_glass_damage');
    }

    if (/\b(screen|display|oled|lcd|digitizer|glass)\b/.test(haystack)) {
      add('screen_damage');
    }

    if (/\b(battery|batteries)\b/.test(haystack)) {
      add('battery_issue');
    }

    if (
      /\b(charge|charging|charger|port|dock connector|lightning|usb c|usb-c)\b/.test(
        haystack,
      )
    ) {
      add('charging_issue');
    }

    if (/\b(camera|lens|front camera|rear camera)\b/.test(haystack)) {
      add('camera_issue');
    }

    if (
      /\b(speaker|microphone|mic|receiver|earpiece|audio|sound)\b/.test(
        haystack,
      )
    ) {
      add('speaker_audio');
    }

    if (
      /\b(button|power button|volume|mute|home button|side button)\b/.test(
        haystack,
      )
    ) {
      add('button_issue');
    }

    if (/\b(water|liquid|moisture|corrosion)\b/.test(haystack)) {
      add('water_damage');
    }

    if (
      /\b(no power|dead|won'?t power|does not power|logic board|board)\b/.test(
        haystack,
      )
    ) {
      add('no_power');
    }

    if (
      /\b(software|diagnostic|diagnostics|setup|restore|data|transfer|troubleshoot)\b/.test(
        haystack,
      )
    ) {
      add('software_diagnostics');
    }

    if (!matches.length) {
      add('other');
    }

    return matches;
  }

  private serviceDescription(service: Service): string {
    const details: string[] = [];

    if (service.duration != null && service.duration > 0) {
      details.push(`${service.duration} min`);
    }

    if (service.code) {
      details.push(service.code);
    }

    if (service.tags?.length) {
      details.push(service.tags.slice(0, 4).join(', '));
    }

    return details.length
      ? details.join(' · ')
      : 'Active service from your service catalog.';
  }

  private serviceSearchTerms(service: Service, needKey: string): string[] {
    const baseTerms = [
      service.name,
      service.code ?? '',
      ...(service.tags ?? []),
      ...this.defaultSearchTermsForNeed(needKey),
    ]
      .filter(Boolean)
      .map((value) => value.trim())
      .filter(Boolean);

    return Array.from(new Set(baseTerms));
  }

  private defaultSearchTermsForNeed(needKey: string): string[] {
    switch (needKey) {
      case 'screen_damage':
        return ['screen', 'display', 'oled', 'lcd'];
      case 'battery_issue':
        return ['battery'];
      case 'charging_issue':
        return ['charge port', 'charging port', 'dock connector'];
      case 'camera_issue':
        return ['camera', 'front camera', 'rear camera'];
      case 'back_glass_damage':
        return ['back glass', 'rear glass', 'housing'];
      case 'speaker_audio':
        return ['speaker', 'microphone', 'receiver', 'earpiece'];
      case 'button_issue':
        return ['button', 'flex cable'];
      case 'water_damage':
        return ['water damage', 'diagnostic'];
      case 'no_power':
        return ['battery', 'charge port', 'logic board'];
      case 'software_diagnostics':
        return ['diagnostic'];
      default:
        return ['repair'];
    }
  }

  private normalizeServiceText(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  selectedRepairNeed(): RepairNeedOption | null {
    const key = this.newRepairForm.controls.repairNeedKey.value;
    return this.repairNeeds.find((need) => need.key === key) ?? null;
  }

  selectedRepairService(): RepairServiceOption | null {
    const key = this.newRepairForm.controls.repairServiceKey.value;
    return this.repairServices.find((service) => service.key === key) ?? null;
  }

  repairServicesForSelectedNeed(): RepairServiceOption[] {
    const need = this.selectedRepairNeed();
    if (!need) return [];
    return this.repairServices.filter(
      (service) => service.needKey === need.key,
    );
  }

  selectRepairNeed(need: RepairNeedOption): void {
    this.newRepairForm.patchValue({
      repairNeedKey: need.key,
      repairServiceKey: '',
    });

    this.resetPartLookup();
    this.updateProblemSummaryFromStructuredFields();
  }

  selectRepairService(service: RepairServiceOption): void {
    this.newRepairForm.patchValue({ repairServiceKey: service.key });

    if (this.newRepairForm.controls.quotedPriceDollars.value == null) {
      this.newRepairForm.controls.quotedPriceDollars.setValue(
        Number((service.defaultLaborCents / 100).toFixed(2)),
      );
    }

    this.seedPartSearchControl();
    this.updateProblemSummaryFromStructuredFields();
  }

  formatCents(value: number | null | undefined): string {
    const cents = Number(value ?? 0);
    return `$${(cents / 100).toFixed(2)}`;
  }

  canSearchParts(): boolean {
    return !!this.selectedRepairService() && !!this.deviceSummary();
  }

  togglePartsPanel(): void {
    this.showPartsPanel = !this.showPartsPanel;
  }

  async searchPartsNow(): Promise<void> {
    if (!this.canSearchParts()) {
      this.toastService.error(
        'Parts search not ready',
        'Select a repair service and device before searching parts.',
      );
      return;
    }

    const query = this.buildPartSearchQuery();

    if (!query) {
      this.toastService.error(
        'Search term required',
        'Enter a part search term before checking inventory or MobileSentrix.',
      );
      return;
    }

    this.showPartsPanel = true;
    this.partLookupStarted = true;
    this.inventoryLookupFailed = false;
    this.mobileSentrixLookupFailed = false;
    this.inventoryPartResults = [];
    this.mobileSentrixPartResults = [];
    this.searchingInventoryParts = true;
    this.searchingMobileSentrixParts = true;

    const inventoryPromise = firstValueFrom(
      this.productsService.list({ status: 'active', limit: 50 }),
    )
      .then((response) => {
        this.inventoryPartResults = this.filterInventoryParts(
          response.data ?? [],
          query,
        );
      })
      .catch(() => {
        this.inventoryLookupFailed = true;
        this.inventoryPartResults = [];
      })
      .finally(() => {
        this.searchingInventoryParts = false;
      });

    const mobileSentrixPromise = firstValueFrom(
      this.mobileSentrixService.search({
        q: query,
        maxResults: 20,
        startIndex: 0,
      }),
    )
      .then((response) => {
        this.mobileSentrixPartResults = mapMobileSentrixItems(
          response.items ?? [],
        );
      })
      .catch(() => {
        this.mobileSentrixLookupFailed = true;
        this.mobileSentrixPartResults = [];
      })
      .finally(() => {
        this.searchingMobileSentrixParts = false;
      });

    await Promise.allSettled([inventoryPromise, mobileSentrixPromise]);
  }

  selectInventoryPart(part: any): void {
    this.selectedPart = {
      source: 'inventory',
      id: part.id ?? null,
      name: part.name ?? 'Inventory part',
      sku: part.sku ?? null,
      costCents: part.costCents ?? part.cost ?? null,
      priceCents: part.priceCents ?? part.price ?? null,
    };

    this.newRepairForm.patchValue({
      selectedInventoryProductId: part.id ?? null,
      selectedSupplierPartId: null,
    });

    this.updateProblemSummaryFromStructuredFields();
  }

  selectMobileSentrixPart(part: any): void {
    this.selectedPart = {
      source: 'mobilesentrix',
      id: part.id ?? null,
      name: part.title ?? part.name ?? 'MobileSentrix part',
      sku: part.sku ?? null,
      costCents: part.costCents ?? part.priceCents ?? null,
      priceCents: null,
    };

    this.newRepairForm.patchValue({
      selectedInventoryProductId: null,
      selectedSupplierPartId: part.id ?? null,
    });

    this.updateProblemSummaryFromStructuredFields();
  }

  useNoPartNeeded(): void {
    this.selectedPart = { source: 'none', name: 'No part needed' };
    this.newRepairForm.patchValue({
      selectedInventoryProductId: null,
      selectedSupplierPartId: null,
    });
    this.updateProblemSummaryFromStructuredFields();
  }

  decidePartLater(): void {
    this.selectedPart = { source: 'later', name: 'Decide later' };
    this.newRepairForm.patchValue({
      selectedInventoryProductId: null,
      selectedSupplierPartId: null,
    });
    this.updateProblemSummaryFromStructuredFields();
  }

  selectedPartSummary(): string {
    if (!this.selectedPart) return '';

    switch (this.selectedPart.source) {
      case 'inventory':
        return `Inventory: ${this.selectedPart.name}`;
      case 'mobilesentrix':
        return `MobileSentrix: ${this.selectedPart.name}`;
      case 'none':
        return 'No part needed';
      case 'later':
        return 'Part source will be decided later';
      default:
        return this.selectedPart.name;
    }
  }

  formatDateTime(value: string): string {
    return new Intl.DateTimeFormat(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value));
  }

  formatTime(value: string): string {
    return new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value));
  }

  onCustomerFocus(): void {
    const value = this.customerSearchControl.value.trim();
    if (value.length >= 2 && !this.selectedCustomer && !this.newCustomer) {
      this.showCustomerResults = true;
    }
  }

  onDeviceFocus(): void {
    const value = this.deviceSearchControl.value.trim();
    if (value.length >= 2 && !this.selectedDevice && !!this.selectedCustomer) {
      this.showDeviceResults = true;
    }
  }

  onTechSpecsBrandFocus(): void {
    if (this.selectedTechSpecsBrand) return;

    this.showTechSpecsBrandResults = true;

    const value = this.techSpecsBrandSearchControl.value.trim();

    if (this.techSpecsBrandResults.length) {
      return;
    }

    if (value.length >= 2) {
      return;
    }

    this.searchingTechSpecsBrands = false;
    this.techSpecsBrandResults = this.getPreferredCatalogBrandOptions();
  }

  onTechSpecsModelFocus(): void {
    if (!this.selectedTechSpecsBrand || this.selectedTechSpecsModel) return;

    this.showTechSpecsModelResults = true;

    const value = this.techSpecsModelSearchControl.value.trim();

    if (this.techSpecsModelResults.length || value.length >= 1) {
      return;
    }

    this.searchingTechSpecsModels = false;
  }

  selectCustomer(customer: Customer): void {
    this.selectedCustomer = customer;
    this.newCustomer = false;
    this.showCustomerResults = false;

    this.newRepairForm.patchValue(
      {
        customerId: customer.id,
        customerSearchControl:
          customer.name ?? customer.email ?? customer.phone ?? '',
        name: '',
        email: '',
        phone: '',
      },
      { emitEvent: false },
    );

    this.clearSelectedDevice(false);
    this.newRepairForm.controls.customerNotes.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.updateProblemSummaryFromStructuredFields());

    this.updateCustomerValidators();
    this.updateDeviceValidators();
    void this.loadCustomerAddresses(customer.id);
  }

  startNewCustomer(): void {
    this.newCustomer = true;
    this.selectedCustomer = null;
    this.showCustomerResults = false;
    this.customerResults = [];

    this.newRepairForm.patchValue(
      {
        customerId: null,
        customerSearchControl: '',
      },
      { emitEvent: false },
    );

    this.clearSelectedDevice(false);
    this.resetCustomerAddresses();
    this.newRepairForm.controls.customerNotes.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.updateProblemSummaryFromStructuredFields());

    this.updateCustomerValidators();
    this.updateDeviceValidators();
    this.updateServiceValidators();
  }

  cancelNewCustomer(): void {
    this.newCustomer = false;

    this.newRepairForm.patchValue({
      name: '',
      email: '',
      phone: '',
    });

    this.newRepairForm.controls.customerNotes.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.updateProblemSummaryFromStructuredFields());

    this.updateCustomerValidators();
  }

  clearSelectedCustomer(): void {
    this.selectedCustomer = null;
    this.customerResults = [];
    this.showCustomerResults = false;
    this.newCustomer = false;

    this.newRepairForm.patchValue({
      customerId: null,
      customerSearchControl: '',
      name: '',
      email: '',
      phone: '',
    });

    this.clearSelectedDevice(false);
    this.resetCustomerAddresses();
    this.newRepairForm.controls.customerNotes.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.updateProblemSummaryFromStructuredFields());

    this.updateCustomerValidators();
    this.updateDeviceValidators();
    this.updateServiceValidators();
  }

  selectDevice(device: CustomerDevice): void {
    this.selectedDevice = device;
    this.newDevice = false;
    this.showDeviceResults = false;
    this.clearTechSpecsSelection(false);

    this.newRepairForm.patchValue(
      {
        deviceId: device.id,
        deviceSearchControl: this.getDeviceDisplay(device),
      },
      { emitEvent: false },
    );

    this.updateDeviceValidators();
  }

  startNewDevice(): void {
    if (!this.selectedCustomer && !this.newCustomer) {
      this.toastService.error(
        'Customer required',
        'Select or create a customer before adding a device.',
      );
      return;
    }

    this.newDevice = true;
    this.selectedDevice = null;
    this.showDeviceResults = false;
    this.deviceResults = [];
    this.clearTechSpecsSelection(false);

    this.newRepairForm.patchValue(
      {
        deviceId: null,
        deviceSearchControl: '',
        catalogRef: null,
        techSpecsBrandSearchControl: '',
        techSpecsModelSearchControl: '',
        nickname: '',
        brand: '',
        model: '',
        imei: '',
        serial: '',
      },
      { emitEvent: false },
    );

    this.updateDeviceValidators();
  }

  cancelNewDevice(): void {
    this.newDevice = false;
    this.clearTechSpecsSelection(false);

    this.newRepairForm.patchValue({
      catalogRef: null,
      techSpecsBrandSearchControl: '',
      techSpecsModelSearchControl: '',
      nickname: '',
      brand: '',
      model: '',
      imei: '',
      serial: '',
    });

    this.updateDeviceValidators();
  }

  clearSelectedDevice(updateValidators = true): void {
    this.selectedDevice = null;
    this.deviceResults = [];
    this.showDeviceResults = false;
    this.newDevice = false;
    this.clearTechSpecsSelection(false);

    this.newRepairForm.patchValue(
      {
        deviceId: null,
        deviceSearchControl: '',
        catalogRef: null,
        techSpecsBrandSearchControl: '',
        techSpecsModelSearchControl: '',
        nickname: '',
        brand: '',
        model: '',
        imei: '',
        serial: '',
      },
      { emitEvent: false },
    );

    if (updateValidators) this.updateDeviceValidators();
  }

  selectTechSpecsBrand(brand: TechSpecsBrand): void {
    this.selectedTechSpecsBrand = brand;
    this.selectedTechSpecsModel = null;
    this.techSpecsBrandResults = [];
    this.techSpecsModelResults = [];
    this.showTechSpecsBrandResults = false;
    this.showTechSpecsModelResults = false;

    this.newRepairForm.patchValue(
      {
        catalogRef: null,
        techSpecsBrandSearchControl: brand.name,
        techSpecsModelSearchControl: '',
        brand: brand.name,
        model: '',
        nickname: this.buildDefaultDeviceNickname(brand.name),
      },
      { emitEvent: false },
    );

    this.updateDeviceValidators();
  }

  clearTechSpecsBrand(): void {
    this.clearTechSpecsSelection(true);
  }

  selectTechSpecsModel(model: TechSpecsModel): void {
    if (!this.selectedTechSpecsBrand) return;

    const brandName = this.selectedTechSpecsBrand.name;
    const modelName = model.name;
    const displayName = `${brandName} ${modelName}`.trim();
    const nickname = this.buildDefaultDeviceNickname(modelName || displayName);

    this.selectedTechSpecsModel = model;
    this.techSpecsModelResults = [];
    this.showTechSpecsModelResults = false;

    this.newRepairForm.patchValue(
      {
        catalogRef: model.id,
        techSpecsModelSearchControl: model.name,
        brand: brandName,
        model: modelName,
        nickname,
      },
      { emitEvent: false },
    );

    this.updateDeviceValidators();
  }

  clearTechSpecsModel(): void {
    this.selectedTechSpecsModel = null;
    this.techSpecsModelResults = [];
    this.showTechSpecsModelResults = false;

    this.newRepairForm.patchValue({
      catalogRef: null,
      techSpecsModelSearchControl: '',
      model: '',
      nickname: this.buildDefaultDeviceNickname(
        this.selectedTechSpecsBrand?.name ?? '',
      ),
    });

    this.updateDeviceValidators();
  }

  private prepareDeviceStep(): void {
    if (!this.isCustomerStepValid()) return;
    if (this.selectedDevice || this.newDevice) return;

    if (this.newCustomer) {
      this.startNewDevice();
      return;
    }

    const customerId = this.selectedCustomer?.id;
    if (!customerId) return;

    this.searchingDevices = true;
    this.showDeviceResults = false;
    this.deviceResults = [];

    this.customerDevicesStore
      .search(customerId, '')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (devices) => {
          if (this.currentStep() !== 'device') return;

          this.searchingDevices = false;

          if (!devices.length) {
            this.startNewDevice();
            return;
          }

          this.deviceResults = devices;
          this.showDeviceResults = true;
        },
        error: () => {
          if (this.currentStep() !== 'device') return;

          this.searchingDevices = false;
          this.deviceResults = [];
          this.showDeviceResults = false;

          this.toastService.error(
            'Device lookup failed',
            'We could not check this customer’s saved devices. Add a new device instead.',
          );

          this.startNewDevice();
        },
      });
  }

  canSearchDevices(): boolean {
    return !!this.selectedCustomer || this.isCustomerStepValid();
  }

  private buildDefaultDeviceNickname(deviceName: string): string {
    const normalizedDeviceName = deviceName.trim();
    if (!normalizedDeviceName) return '';

    const firstName = this.customerFirstNameForDeviceNickname();
    if (!firstName) return normalizedDeviceName;

    return `${this.toPossessive(firstName)} ${normalizedDeviceName}`.trim();
  }

  private customerFirstNameForDeviceNickname(): string {
    const customerName =
      this.selectedCustomer?.name?.trim() ||
      this.newRepairForm.controls.name.value.trim();

    if (!customerName) return '';

    return customerName
      .split(/\s+/)[0]
      .replace(/[.,;:!?]+$/g, '')
      .trim();
  }

  private toPossessive(name: string): string {
    const cleanedName = name
      .trim()
      .replace(/[’']s$/i, '')
      .replace(/[’']$/g, '');
    if (!cleanedName) return '';

    return /s$/i.test(cleanedName) ? `${cleanedName}'` : `${cleanedName}'s`;
  }

  getDeviceDisplay(device: CustomerDevice): string {
    return (
      device.nickname?.trim() ||
      device.displayName?.trim() ||
      [device.brand, device.model].filter(Boolean).join(' ') ||
      'Unnamed Device'
    );
  }

  getDeviceSecondary(device: CustomerDevice): string {
    const imei = device.imei ? `IMEI •••• ${device.imei.slice(-5)}` : null;
    const serial = device.serial ? `S/N ${device.serial}` : null;
    const catalog = device.catalogRef ? 'TechSpecs matched' : null;
    return [catalog, imei, serial].filter(Boolean).join(' · ');
  }

  onServiceModeChange(mode: RepairServiceMode): void {
    this.newRepairForm.patchValue({ serviceMode: mode });
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

  onInlineAddressPostalBlur(): void {
    if (!this.isOnSiteMode() || !this.creatingInlineAddress) return;
    void this.validateServiceArea(true);
  }

  onServiceAddressSelectionChange(): void {
    this.clearServiceAreaStatus(false);
    if (!this.isOnSiteMode() || this.creatingInlineAddress) return;
    void this.validateServiceArea(true);
  }

  onSchedulingSelectionChange(selection: SchedulingSelection): void {
    if (!this.bookingEnabled()) return;

    this.selectedSchedulingSelection = selection;
    this.newRepairForm.patchValue({ schedulingSelected: true });
    this.updateSchedulingValidators();
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

  async validateServiceArea(showToast = true): Promise<void> {
    if (!this.onsiteEnabled()) return;
    if (!this.isOnSiteMode()) return;

    const payload = this.creatingInlineAddress
      ? this.buildInlineServiceAreaPayload()
      : this.buildSelectedAddressServiceAreaPayload();

    const key = this.getServiceAreaAddressKey(payload);
    if (!payload || !key) return;

    if (this.serviceAreaCheckedAddressKey === key && this.serviceAreaStatus) {
      if (showToast && this.serviceAreaStatus.reason) {
        this.toastForServiceAreaReason(this.serviceAreaStatus.reason);
      }
      return;
    }

    this.serviceAreaCheckInFlight = true;

    try {
      if (!this.shopId) {
        await this.loadShopContext();
      }

      if (!this.shopId) {
        throw new Error('Missing shop id for service-area check.');
      }

      const response = await firstValueFrom(
        this.http.post<ServiceAreaCheckResponse>(
          `${this.apiBase}/shops/${this.shopId}/settings/onsite/service-area/check`,
          payload,
        ),
      );

      this.serviceAreaStatus = response;
      this.serviceAreaCheckedAddressKey = key;

      if (showToast && response.reason) {
        this.toastForServiceAreaReason(response.reason);
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
          'We could not verify that address right now.',
        );
      }
    } finally {
      this.serviceAreaCheckInFlight = false;
    }
  }

  async createRepair(): Promise<void> {
    if (!this.canCreateRepair()) {
      this.newRepairForm.markAllAsTouched();

      if (this.isOnSiteMode() && !this.hasValidOnsiteAddress()) {
        this.toastService.error(
          'Valid on-site address required',
          'Confirm a serviceable on-site address before creating this repair.',
        );
      } else {
        this.toastService.error(
          'Repair not ready',
          'Review the required fields before creating this repair.',
        );
      }

      return;
    }

    const schedulingSelection = this.selectedSchedulingSelection
      ? { ...this.selectedSchedulingSelection }
      : null;

    const dispatchType =
      schedulingSelection?.candidateType === 'contractor'
        ? 'contractor'
        : schedulingSelection?.candidateType === 'internal'
          ? 'internal'
          : 'unassigned';

    this.creatingRepair = true;

    try {
      const customerId = await this.ensureCustomer();
      if (!customerId) {
        this.toastService.error(
          'Customer could not be saved',
          'Check the customer details and try again.',
        );
        return;
      }

      const deviceId = await this.ensureDevice(customerId);
      if (!deviceId) {
        this.toastService.error(
          'Device could not be saved',
          'Select a TechSpecs device model and try again.',
        );
        return;
      }

      const serviceMode = this.onsiteEnabled()
        ? this.newRepairForm.controls.serviceMode.value
        : 'in_shop';

      const serviceAddressId =
        serviceMode === 'on_site'
          ? await this.ensureServiceAddress(customerId)
          : null;

      if (serviceMode === 'on_site' && !serviceAddressId) {
        this.toastService.error(
          'Service address could not be saved',
          'Check the service address and try again.',
        );
        return;
      }

      const repair = await this.repairsStore.createRepair({
        customerId,
        customerDeviceId: deviceId,
        problemSummary: this.buildProblemSummary(),
        assignedTo: this.bookingEnabled()
          ? (schedulingSelection?.assignedTo ?? undefined)
          : undefined,
        dispatchType,
        serviceMode,
        serviceAddressId:
          serviceMode === 'on_site'
            ? (serviceAddressId ?? undefined)
            : undefined,
        tripFeeApplied:
          serviceMode === 'on_site' && this.onsiteTripFeeEnabled(),
        tripFeeCents:
          serviceMode === 'on_site' && this.onsiteTripFeeEnabled()
            ? this.onsiteDefaultTripFeeCents()
            : null,
      } as any);

      if (!repair?.id) {
        this.toastService.error(
          'Repair could not be created',
          'The customer and device were saved, but the repair could not be created.',
        );
        return;
      }

      let orderCreated = false;
      let appointmentScheduled = !this.bookingEnabled() || !schedulingSelection;

      try {
        const items = this.buildOrderItems(serviceMode);

        const order = await this.repairsStore.createOrderFromRepair(repair.id, {
          items,
          discountCents: 0,
          tags: ['repair'],
          notes: 'Created from new repair flow',
        });

        orderCreated = !!order;
      } catch (error) {
        console.error('Repair created, but order creation failed.', error);
      }

      if (this.bookingEnabled() && schedulingSelection) {
        try {
          const scheduled = await this.appointmentsStore.scheduleAppointment({
            repairId: repair.id,
            startAt: schedulingSelection.startAt,
            endAt: schedulingSelection.endAt,
            candidateType: schedulingSelection.candidateType,
            assignedUserId:
              schedulingSelection.candidateType === 'internal'
                ? (schedulingSelection.assignedUserId ?? undefined)
                : undefined,
            contractorId:
              schedulingSelection.candidateType === 'contractor'
                ? (schedulingSelection.contractorId ?? undefined)
                : undefined,
          });

          appointmentScheduled = !!scheduled;
        } catch (error) {
          console.error(
            'Repair created, but appointment scheduling failed.',
            error,
          );
          appointmentScheduled = false;
        }
      }

      if (orderCreated && appointmentScheduled) {
        this.toastService.success(
          'Repair created',
          'The repair, order, and appointment were created successfully.',
        );
      } else if (!orderCreated && !appointmentScheduled) {
        this.toastService.error(
          'Repair created with follow-up needed',
          'The repair exists, but the order and appointment need to be finished from the repair page.',
        );
      } else if (!orderCreated) {
        this.toastService.error(
          'Repair created without order',
          'Finish the order from the repair page.',
        );
      } else {
        this.toastService.error(
          'Repair created without appointment',
          'Finish scheduling from the repair page.',
        );
      }

      await this.router.navigate(['/repairs', 'detail', repair.id]);
    } catch (error) {
      console.error('Failed to create repair flow.', error);
      this.toastService.error(
        'Repair creation failed',
        'Something went wrong while creating this repair.',
      );
    } finally {
      this.creatingRepair = false;
    }
  }

  private async loadDeviceCatalogCategory(
    showErrorToast = false,
  ): Promise<void> {
    if (this.deviceCatalogCategory) {
      return;
    }

    if (this.deviceCatalogCategoryLoadPromise) {
      return this.deviceCatalogCategoryLoadPromise;
    }

    this.loadingDeviceCatalogCategory = true;

    this.deviceCatalogCategoryLoadPromise = firstValueFrom(
      this.techSpecsService.listCategories({
        page: 0,
        size: this.deviceCatalogPageSize,
      }),
    )
      .then((page) => {
        const categories = this.unwrapStringPage(page);

        this.deviceCatalogCategory =
          this.preferredDeviceCatalogCategories.find((preferred) =>
            categories.some(
              (category) => category.toLowerCase() === preferred.toLowerCase(),
            ),
          ) ??
          categories.find((category) => /phone|mobile|cell/i.test(category)) ??
          categories[0] ??
          null;
      })
      .catch(() => {
        this.deviceCatalogCategory = null;

        if (showErrorToast) {
          this.toastService.error(
            'Device catalog unavailable',
            'TechSpecs categories could not be loaded. Device lookup may not work until this is fixed.',
          );
        }
      })
      .finally(() => {
        this.loadingDeviceCatalogCategory = false;
        this.deviceCatalogCategoryLoadPromise = null;
      });

    return this.deviceCatalogCategoryLoadPromise;
  }

  private unwrapStringPage(response: unknown): string[] {
    const items = this.extractPageItems<unknown>(response);

    return items
      .flatMap((item) => (Array.isArray(item) ? item : [item]))
      .filter((item): item is string => typeof item === 'string')
      .filter(Boolean);
  }

  private unwrapBrandPage(response: unknown, search = ''): TechSpecsBrand[] {
    const searchKey = this.normalizeCatalogKey(search);
    const category = this.deviceCatalogCategory ?? 'Smartphones';

    const brands = this.uniqueStrings(this.unwrapStringPage(response)).filter(
      (brand) =>
        !searchKey || this.normalizeCatalogKey(brand).includes(searchKey),
    );

    return this.sortCatalogBrands({
      brands,
      category,
      country: this.shopCountry,
    }).map((brand) => this.techSpecsService.toBrandOption(brand));
  }

  private getPreferredCatalogBrandOptions(): TechSpecsBrand[] {
    const category = this.deviceCatalogCategory ?? 'Smartphones';
    const categoryKey = this.normalizeCatalogKey(category);
    const country = this.normalizeCountryCode(this.shopCountry);

    const countryPopular =
      this.popularBrandsByCountryCategory[country]?.[categoryKey] ?? [];
    const defaultPopular =
      this.defaultPopularBrandsByCategory[categoryKey] ?? [];
    const fallbackPopular = this.defaultPopularBrandsByCategory[
      'smartphones'
    ] ?? ['Apple', 'Samsung', 'Google', 'Motorola', 'OnePlus'];

    const brands = countryPopular.length
      ? countryPopular
      : defaultPopular.length
        ? defaultPopular
        : fallbackPopular;

    return this.sortCatalogBrands({
      brands,
      category,
      country,
    }).map((brand) => this.techSpecsService.toBrandOption(brand));
  }

  private unwrapModelPage(response: unknown): TechSpecsModel[] {
    const models = this.extractPageItems<any>(response);
    const brand = this.selectedTechSpecsBrand?.name ?? '';
    const search = this.techSpecsModelSearchControl.value;

    return this.curateCatalogModels({
      models,
      brand,
      country: this.shopCountry,
      search,
      filterRegion: true,
    }).map((model) => this.techSpecsService.toModelOption(model));
  }

  private normalizeCountryCode(value: unknown): string {
    const normalized = String(value ?? '')
      .trim()
      .toUpperCase();

    if (!normalized) return 'US';
    if (normalized === 'USA' || normalized === 'UNITED STATES') return 'US';

    return normalized;
  }

  private normalizeCatalogKey(value: unknown): string {
    return String(value ?? '')
      .trim()
      .toLowerCase()
      .replace(/&/g, 'and')
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private singularizeCatalogKey(value: string): string {
    return value
      .split(' ')
      .map((part) => {
        if (part.length > 3 && part.endsWith('s')) return part.slice(0, -1);
        return part;
      })
      .join(' ')
      .trim();
  }

  private uniqueStrings(values: string[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];

    for (const value of values) {
      const trimmed = String(value ?? '').trim();
      if (!trimmed) continue;

      const key = this.normalizeCatalogKey(trimmed);
      if (!key || seen.has(key)) continue;

      seen.add(key);
      out.push(trimmed);
    }

    return out;
  }

  private popularBrandRank(opts: {
    brand: string;
    category: string;
    country: string;
  }): number {
    const categoryKey = this.normalizeCatalogKey(opts.category);
    const country = this.normalizeCountryCode(opts.country);

    const countryPopular =
      this.popularBrandsByCountryCategory[country]?.[categoryKey] ?? [];

    const defaultPopular =
      this.defaultPopularBrandsByCategory[categoryKey] ?? [];
    const popular = countryPopular.length ? countryPopular : defaultPopular;

    const index = popular.findIndex(
      (brand) =>
        this.normalizeCatalogKey(brand) ===
        this.normalizeCatalogKey(opts.brand),
    );

    return index === -1 ? 9999 : index;
  }

  private sortCatalogBrands(opts: {
    brands: string[];
    category: string;
    country: string;
  }): string[] {
    return this.uniqueStrings(opts.brands).sort((a, b) => {
      const rankA = this.popularBrandRank({
        brand: a,
        category: opts.category,
        country: opts.country,
      });

      const rankB = this.popularBrandRank({
        brand: b,
        category: opts.category,
        country: opts.country,
      });

      if (rankA !== rankB) return rankA - rankB;

      return a.localeCompare(b);
    });
  }

  private isRegionBlockedForCountry(opts: {
    value: string;
    country: string;
  }): boolean {
    const country = this.normalizeCountryCode(opts.country);
    const blocklist = this.regionBlocklistByCountry[country] ?? [];
    const haystack = this.normalizeCatalogKey(opts.value);

    return blocklist.some((term) =>
      haystack.includes(this.normalizeCatalogKey(term)),
    );
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private simplifyCatalogModelName(opts: {
    brand: string;
    model: string;
    country: string;
  }): string {
    const brandKey = this.normalizeCatalogKey(opts.brand);
    let model = String(opts.model ?? '').trim();

    if (
      brandKey &&
      this.normalizeCatalogKey(model).startsWith(`${brandKey} `)
    ) {
      const brandRegex = new RegExp(
        `^${this.escapeRegExp(opts.brand)}\\s+`,
        'i',
      );
      model = model.replace(brandRegex, '').trim();
    }

    model = model
      .replace(/\bA\d{4}\b/gi, '')
      .replace(/\bSM-[A-Z0-9]+(?:\/[A-Z0-9]+)?\b/gi, '')
      .replace(/\bXT\d{4,5}(?:-\d+)?\b/gi, '')
      .replace(/\b[A-Z]{1,3}\d{3,5}(?:[A-Z]{1,3})?\b/g, '');

    model = model
      .replace(/\b\d+\s?(GB|TB)\b/gi, '')
      .replace(/\b\d+\s?GB\s?RAM\b/gi, '')
      .replace(/\b\d+\s?\/\s?\d+\s?(GB|TB)\b/gi, '');

    model = model
      .replace(
        /\b(Global|International|China|Chinese|India|Indian|Japan|Japanese|Korea|Korean|Hong Kong|Taiwan|Russia|Europe|European|Middle East|Latin America|Brazil|Mexico|Canada|USA|US|United States)\b/gi,
        '',
      )
      .replace(
        /\b(Dual SIM|Dual-SIM|DualSim|Single SIM|eSIM|CDMA|GSM|Unlocked|Carrier|Verizon|AT&T|T-Mobile|Sprint)\b/gi,
        '',
      );

    model = model.replace(/\b5G\b/gi, '');

    model = model
      .replace(/\([^)]*\)/g, '')
      .replace(/\[[^\]]*\]/g, '')
      .replace(/\s*[-–—]\s*$/g, '')
      .replace(/^\s*[-–—]\s*/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();

    return model || String(opts.model ?? '').trim();
  }

  private catalogModelDedupKey(opts: {
    brand: string;
    model: string;
    country: string;
  }): string {
    return this.singularizeCatalogKey(
      this.normalizeCatalogKey(
        this.simplifyCatalogModelName({
          brand: opts.brand,
          model: opts.model,
          country: opts.country,
        }),
      ),
    );
  }

  private modelGenerationRank(model: string): number {
    const normalized = this.normalizeCatalogKey(model);

    const iphoneMatch = normalized.match(/\biphone\s+(\d{1,2})\b/);
    if (iphoneMatch) return 10_000 + Number(iphoneMatch[1]);

    const galaxySMatch = normalized.match(/\bgalaxy\s+s(\d{1,2})\b/);
    if (galaxySMatch) return 9_000 + Number(galaxySMatch[1]);

    const pixelMatch = normalized.match(/\bpixel\s+(\d{1,2})\b/);
    if (pixelMatch) return 8_000 + Number(pixelMatch[1]);

    const ipadGenMatch = normalized.match(
      /\bipad\b.*\b(\d{1,2})(st|nd|rd|th)?\s+gen/,
    );
    if (ipadGenMatch) return 7_000 + Number(ipadGenMatch[1]);

    return 0;
  }

  private catalogModelSortScore(model: { model?: string | null }): number {
    const modelName = String(model.model ?? '');
    const normalized = this.normalizeCatalogKey(modelName);
    let score = this.modelGenerationRank(modelName);

    if (normalized.includes('pro max')) score += 80;
    else if (normalized.includes('ultra')) score += 80;
    else if (normalized.includes('pro')) score += 70;
    else if (normalized.includes('plus')) score += 60;
    else if (normalized.includes('fe')) score += 30;

    score -= Math.min(normalized.length, 120) / 10;

    return score;
  }

  private curateCatalogModels(opts: {
    models: any[];
    brand: string;
    country: string;
    search?: string | null;
    filterRegion?: boolean;
  }): any[] {
    const byKey = new Map<string, any>();

    for (const item of opts.models) {
      const rawModel = String(item?.model ?? item?.name ?? '').trim();

      if (!rawModel) continue;

      if (
        opts.filterRegion !== false &&
        this.isRegionBlockedForCountry({
          value: rawModel,
          country: opts.country,
        })
      ) {
        continue;
      }

      const simplifiedName = this.simplifyCatalogModelName({
        brand: opts.brand,
        model: rawModel,
        country: opts.country,
      });

      if (!simplifiedName) continue;

      const key = this.catalogModelDedupKey({
        brand: opts.brand,
        model: simplifiedName,
        country: opts.country,
      });

      if (!key) continue;

      const candidate = {
        ...item,
        brand: item?.brand || opts.brand,
        model: simplifiedName,
      };

      const existing = byKey.get(key);

      if (
        !existing ||
        String(candidate.model ?? '').length <
          String(existing.model ?? '').length
      ) {
        byKey.set(key, candidate);
      }
    }

    let out = Array.from(byKey.values());

    if (opts.search?.trim()) {
      const searchKey = this.normalizeCatalogKey(opts.search);

      out = out.filter((model) =>
        this.normalizeCatalogKey(model.model).includes(searchKey),
      );
    }

    return out.sort((a, b) => {
      const scoreB = this.catalogModelSortScore(b);
      const scoreA = this.catalogModelSortScore(a);

      if (scoreA !== scoreB) return scoreB - scoreA;

      return String(a.model ?? '').localeCompare(String(b.model ?? ''));
    });
  }

  private extractPageItems<T>(response: unknown): T[] {
    if (Array.isArray(response)) return response as T[];

    if (
      response &&
      typeof response === 'object' &&
      Array.isArray((response as { items?: unknown }).items)
    ) {
      return (response as { items: T[] }).items;
    }

    if (
      response &&
      typeof response === 'object' &&
      Array.isArray((response as { data?: unknown }).data)
    ) {
      return (response as { data: T[] }).data;
    }

    return [];
  }

  private unwrapList<T>(response: unknown): T[] {
    return this.extractPageItems<T>(response);
  }

  private isCustomerStepValid(): boolean {
    if (this.newCustomer) {
      return (
        this.newRepairForm.controls.name.valid &&
        this.newRepairForm.controls.email.valid &&
        this.newRepairForm.controls.phone.valid &&
        this.hasNewCustomerContactValue()
      );
    }

    return (
      !!this.selectedCustomer && !!this.newRepairForm.controls.customerId.value
    );
  }

  hasNewCustomerContactValue(): boolean {
    return (
      !!this.newRepairForm.controls.email.value.trim() ||
      !!this.newRepairForm.controls.phone.value.trim()
    );
  }

  private isDeviceStepValid(): boolean {
    if (this.newDevice) {
      return (
        !!this.selectedTechSpecsBrand &&
        !!this.selectedTechSpecsModel &&
        !!this.newRepairForm.controls.catalogRef.value &&
        this.newRepairForm.controls.nickname.valid
      );
    }

    return (
      !!this.selectedDevice && !!this.newRepairForm.controls.deviceId.value
    );
  }

  private isRepairStepValid(): boolean {
    return (
      this.newRepairForm.controls.repairNeedKey.valid &&
      this.newRepairForm.controls.repairServiceKey.valid &&
      this.newRepairForm.controls.customerNotes.valid &&
      this.newRepairForm.controls.problemSummary.valid &&
      this.newRepairForm.controls.quotedPriceDollars.valid
    );
  }

  private isServiceStepValid(): boolean {
    if (this.isOnSiteMode() && !this.hasValidOnsiteAddress()) return false;
    if (this.serviceAreaCheckInFlight) return false;
    if (!this.bookingEnabled()) return true;
    return !!this.selectedSchedulingSelection;
  }

  private markStepTouched(step: RepairWizardStep): void {
    switch (step) {
      case 'customer':
        this.newRepairForm.controls.customerSearchControl.markAsTouched();
        this.newRepairForm.controls.name.markAsTouched();
        this.newRepairForm.controls.email.markAsTouched();
        this.newRepairForm.controls.phone.markAsTouched();
        break;
      case 'device':
        this.newRepairForm.controls.deviceSearchControl.markAsTouched();
        this.newRepairForm.controls.catalogRef.markAsTouched();
        this.newRepairForm.controls.techSpecsBrandSearchControl.markAsTouched();
        this.newRepairForm.controls.techSpecsModelSearchControl.markAsTouched();
        this.newRepairForm.controls.nickname.markAsTouched();
        break;
      case 'repair':
        this.newRepairForm.controls.repairNeedKey.markAsTouched();
        this.newRepairForm.controls.repairServiceKey.markAsTouched();
        this.newRepairForm.controls.customerNotes.markAsTouched();
        this.newRepairForm.controls.problemSummary.markAsTouched();
        this.newRepairForm.controls.quotedPriceDollars.markAsTouched();
        break;
      case 'service':
        this.newRepairForm.controls.serviceAddressId.markAsTouched();
        this.newRepairForm.controls.addressLine1.markAsTouched();
        this.newRepairForm.controls.addressCity.markAsTouched();
        this.newRepairForm.controls.addressState.markAsTouched();
        this.newRepairForm.controls.addressPostalCode.markAsTouched();
        this.newRepairForm.controls.schedulingSelected.markAsTouched();
        break;
      case 'review':
        this.newRepairForm.markAllAsTouched();
        break;
    }
  }

  private showStepError(step: RepairWizardStep): void {
    switch (step) {
      case 'customer':
        this.toastService.error(
          'Customer required',
          'Select an existing customer or complete the new customer details.',
        );
        break;
      case 'device':
        this.toastService.error(
          'Device required',
          'Select a saved device or choose an exact model from TechSpecs.',
        );
        break;
      case 'repair':
        this.toastService.error(
          'Repair details required',
          'Select a repair need and recommended service before continuing.',
        );
        break;
      case 'service':
        this.toastService.error(
          'Service details required',
          'Confirm the service location and appointment details.',
        );
        break;
      case 'review':
        this.toastService.error(
          'Repair not ready',
          'Review the required fields before creating this repair.',
        );
        break;
    }
  }

  private buildPartSearchQuery(): string {
    const typedQuery =
      this.newRepairForm.controls.partSearchControl.value.trim();
    if (typedQuery) return typedQuery;

    const service = this.selectedRepairService();
    const device = this.deviceSummary();
    const serviceTerm = service?.searchTerms?.[0] ?? service?.label ?? '';

    return [device, serviceTerm].filter(Boolean).join(' ').trim();
  }

  private filterInventoryParts(products: Product[], query: string): any[] {
    const queryTokens = this.tokenizePartSearch(query);
    const serviceTokens =
      this.selectedRepairService()?.searchTerms.flatMap((term) =>
        this.tokenizePartSearch(term),
      ) ?? [];
    const deviceTokens = this.tokenizePartSearch(this.deviceSummary());
    const requiredTokens = Array.from(
      new Set(
        [...serviceTokens, ...deviceTokens].filter(
          (token) => token.length >= 3,
        ),
      ),
    );

    return products
      .map((product) => ({
        ...product,
        priceCents: product.price ?? 0,
        costCents: product.cost ?? null,
        score: this.scoreInventoryProduct(product, queryTokens, requiredTokens),
      }))
      .filter((product) => product.score > 0)
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
      .slice(0, 8);
  }

  private scoreInventoryProduct(
    product: Product,
    queryTokens: string[],
    requiredTokens: string[],
  ): number {
    const haystack = this.normalizePartSearchText(
      [
        product.name,
        product.sku,
        ...(product.tags ?? []),
        ...(product.supplierLinks ?? []).flatMap((link) => [
          link.supplierSku,
          link.supplierProductName,
          link.supplierName,
        ]),
      ]
        .filter(Boolean)
        .join(' '),
    );

    let score = 0;

    for (const token of queryTokens) {
      if (haystack.includes(token)) score += token.length > 3 ? 3 : 1;
    }

    for (const token of requiredTokens) {
      if (haystack.includes(token)) score += 2;
    }

    return score;
  }

  private tokenizePartSearch(value: string): string[] {
    return this.normalizePartSearchText(value)
      .split(' ')
      .map((token) => token.trim())
      .filter((token) => token.length >= 2);
  }

  private normalizePartSearchText(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private seedPartSearchControl(): void {
    const service = this.selectedRepairService();
    const device = this.deviceSummary();
    const terms = service?.searchTerms?.[0] ?? service?.label ?? '';
    const query = [device, terms].filter(Boolean).join(' ').trim();

    this.newRepairForm.controls.partSearchControl.setValue(query, {
      emitEvent: false,
    });
  }

  private resetPartLookup(): void {
    this.selectedPart = null;
    this.inventoryPartResults = [];
    this.mobileSentrixPartResults = [];
    this.partLookupStarted = false;
    this.searchingInventoryParts = false;
    this.searchingMobileSentrixParts = false;
    this.inventoryLookupFailed = false;
    this.mobileSentrixLookupFailed = false;
    this.showPartsPanel = false;
    this.newRepairForm.patchValue({
      partSearchControl: '',
      selectedInventoryProductId: null,
      selectedSupplierPartId: null,
    });
  }

  private updateProblemSummaryFromStructuredFields(): void {
    this.newRepairForm.controls.problemSummary.setValue(
      this.buildProblemSummary(),
      {
        emitEvent: false,
      },
    );
  }

  private buildProblemSummary(): string {
    const need = this.selectedRepairNeed();
    const service = this.selectedRepairService();
    const notes = this.newRepairForm.controls.customerNotes.value.trim();
    const part = this.selectedPartSummary();

    return [need?.label, service?.label, part, notes]
      .filter(Boolean)
      .join(' — ')
      .slice(0, 500);
  }

  private searchCustomers(query: string): Observable<Customer[]> {
    return this.customersStore.search(query);
  }

  private searchDevices(query: string): Observable<CustomerDevice[]> {
    const customerId = this.newRepairForm.controls.customerId.value;
    if (!customerId) return of([]);
    return this.customerDevicesStore.search(customerId, query);
  }

  private updateCustomerValidators(): void {
    const nameControl = this.newRepairForm.controls.name;
    const emailControl = this.newRepairForm.controls.email;
    const phoneControl = this.newRepairForm.controls.phone;
    const searchControl = this.newRepairForm.controls.customerSearchControl;
    const emailValue = emailControl.value.trim();
    const phoneValue = phoneControl.value.trim();
    const hasContact = !!emailValue || !!phoneValue;

    if (this.newCustomer) {
      nameControl.setValidators([
        Validators.required,
        Validators.maxLength(120),
      ]);
      emailControl.setValidators(
        hasContact
          ? [Validators.email]
          : [Validators.required, Validators.email],
      );
      phoneControl.setValidators(hasContact ? [] : [Validators.required]);
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
    const catalogRefControl = this.newRepairForm.controls.catalogRef;
    const brandSearchControl =
      this.newRepairForm.controls.techSpecsBrandSearchControl;
    const modelSearchControl =
      this.newRepairForm.controls.techSpecsModelSearchControl;
    const nicknameControl = this.newRepairForm.controls.nickname;
    const brandControl = this.newRepairForm.controls.brand;
    const modelControl = this.newRepairForm.controls.model;
    const searchControl = this.newRepairForm.controls.deviceSearchControl;

    if (this.newDevice) {
      catalogRefControl.setValidators([Validators.required]);
      brandSearchControl.setValidators([Validators.required]);
      modelSearchControl.setValidators([Validators.required]);
      nicknameControl.setValidators([
        Validators.required,
        Validators.maxLength(120),
      ]);
      brandControl.setValidators([Validators.required]);
      modelControl.setValidators([Validators.required]);
      searchControl.clearValidators();
    } else {
      catalogRefControl.clearValidators();
      brandSearchControl.clearValidators();
      modelSearchControl.clearValidators();
      nicknameControl.clearValidators();
      brandControl.clearValidators();
      modelControl.clearValidators();
      searchControl.setValidators([Validators.required]);
    }

    catalogRefControl.updateValueAndValidity({ emitEvent: false });
    brandSearchControl.updateValueAndValidity({ emitEvent: false });
    modelSearchControl.updateValueAndValidity({ emitEvent: false });
    nicknameControl.updateValueAndValidity({ emitEvent: false });
    brandControl.updateValueAndValidity({ emitEvent: false });
    modelControl.updateValueAndValidity({ emitEvent: false });
    searchControl.updateValueAndValidity({ emitEvent: false });
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

  private updateServiceValidators(): void {
    const serviceModeControl = this.newRepairForm.controls.serviceMode;
    const serviceAddressIdControl =
      this.newRepairForm.controls.serviceAddressId;
    const addressLine1Control = this.newRepairForm.controls.addressLine1;
    const addressCityControl = this.newRepairForm.controls.addressCity;
    const addressStateControl = this.newRepairForm.controls.addressState;
    const addressPostalCodeControl =
      this.newRepairForm.controls.addressPostalCode;
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
      this.clearInlineAddressControls();
    } else if (serviceModeControl.value === 'on_site') {
      if (this.creatingInlineAddress) {
        serviceAddressIdControl.clearValidators();
        addressLine1Control.setValidators([
          Validators.required,
          Validators.maxLength(120),
        ]);
        addressCityControl.setValidators([
          Validators.required,
          Validators.maxLength(80),
        ]);
        addressStateControl.setValidators([
          Validators.required,
          Validators.maxLength(80),
        ]);
        addressPostalCodeControl.setValidators([
          Validators.required,
          Validators.maxLength(20),
        ]);
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
      this.clearInlineAddressControls();
    }

    serviceAddressIdControl.updateValueAndValidity({ emitEvent: false });
    addressLine1Control.updateValueAndValidity({ emitEvent: false });
    addressCityControl.updateValueAndValidity({ emitEvent: false });
    addressStateControl.updateValueAndValidity({ emitEvent: false });
    addressPostalCodeControl.updateValueAndValidity({ emitEvent: false });
    addressCountryControl.updateValueAndValidity({ emitEvent: false });
  }

  private clearInlineAddressControls(): void {
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
      { emitEvent: false },
    );
  }

  private clearTechSpecsSelection(updateValidators: boolean): void {
    this.selectedTechSpecsBrand = null;
    this.selectedTechSpecsModel = null;
    this.techSpecsBrandResults = [];
    this.techSpecsModelResults = [];
    this.showTechSpecsBrandResults = false;
    this.showTechSpecsModelResults = false;

    if (updateValidators) {
      this.newRepairForm.patchValue({
        catalogRef: null,
        techSpecsBrandSearchControl: '',
        techSpecsModelSearchControl: '',
        brand: '',
        model: '',
        nickname: '',
      });
      this.updateDeviceValidators();
    }
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

    if (!createdCustomer?.id) return null;

    this.selectedCustomer = createdCustomer;
    this.newCustomer = false;

    this.newRepairForm.patchValue(
      {
        customerId: createdCustomer.id,
        customerSearchControl:
          createdCustomer.name ??
          createdCustomer.email ??
          createdCustomer.phone ??
          '',
      },
      { emitEvent: false },
    );

    this.newRepairForm.controls.customerNotes.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.updateProblemSummaryFromStructuredFields());

    this.updateCustomerValidators();
    await this.loadCustomerAddresses(createdCustomer.id);

    return createdCustomer.id;
  }

  private async ensureDevice(customerId: string): Promise<string | null> {
    if (!this.newDevice) {
      return this.newRepairForm.controls.deviceId.value;
    }

    const catalogRef = this.newRepairForm.controls.catalogRef.value;
    const brand = this.newRepairForm.controls.brand.value.trim();
    const model = this.newRepairForm.controls.model.value.trim();
    const displayName = `${brand} ${model}`.trim();
    const nickname =
      this.newRepairForm.controls.nickname.value.trim() || displayName;

    const createdDevice = await this.customerDevicesStore.create(customerId, {
      catalogRef: catalogRef ?? undefined,
      nickname,
      displayName,
      brand,
      model,
      imei: this.newRepairForm.controls.imei.value.trim() || undefined,
      serial: this.newRepairForm.controls.serial.value.trim() || undefined,
    } as any);

    if (!createdDevice?.id) return null;

    this.selectedDevice = createdDevice;
    this.newDevice = false;

    this.newRepairForm.patchValue(
      {
        deviceId: createdDevice.id,
        deviceSearchControl: this.getDeviceDisplay(createdDevice),
      },
      { emitEvent: false },
    );

    this.updateDeviceValidators();

    return createdDevice.id;
  }

  private async ensureServiceAddress(
    customerId: string,
  ): Promise<string | null> {
    if (!this.onsiteEnabled() || !this.isOnSiteMode()) return null;

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
        this.newRepairForm.controls.addressPostalCode.value,
      ),
      country: this.newRepairForm.controls.addressCountry.value
        .trim()
        .toUpperCase(),
      notes: this.newRepairForm.controls.addressNotes.value.trim() || null,
      isDefault: this.customerAddresses.length === 0,
    });

    if (!created?.id) return null;

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
      addressCountry: this.shopCountry,
      addressNotes: '',
    });

    this.updateServiceValidators();
    this.serviceAreaStatus = { allowed: true, reason: 'ok' };
    this.serviceAreaCheckedAddressKey = this.getServiceAreaAddressKey(
      this.buildSelectedAddressServiceAreaPayload(),
    );

    return created.id;
  }

  private async loadCustomerAddresses(customerId: string): Promise<void> {
    this.loadingCustomerAddresses = true;

    try {
      this.customerAddresses =
        await this.customersStore.loadAddresses(customerId);

      const currentId = this.newRepairForm.controls.serviceAddressId.value;
      const stillExists =
        !!currentId && this.customerAddresses.some((x) => x.id === currentId);

      if (!stillExists) {
        const defaultAddress =
          this.customerAddresses.find((x) => x.isDefault) ??
          this.customerAddresses[0] ??
          null;

        this.newRepairForm.patchValue({
          serviceAddressId: this.isOnSiteMode()
            ? (defaultAddress?.id ?? null)
            : null,
        });
      }

      this.clearServiceAreaStatus(false);

      if (
        this.isOnSiteMode() &&
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
    this.clearInlineAddressControls();
  }

  private async loadBookingEnabled(): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.http.get<ShopListResponse>(`${this.apiBase}/shops`),
      );

      const shop = response.data?.[0] ?? null;

      if (!this.shopId && shop?.id) {
        this.shopId = shop.id;
      }

      const settings = shop?.settings;

      this.bookingEnabled.set(settings?.booking?.enabled === true);
      this.onsiteEnabled.set(settings?.onsite?.enabled === true);
      this.onsiteTripFeeEnabled.set(settings?.onsite?.tripFeeEnabled === true);
      this.onsiteDefaultTripFeeCents.set(
        settings?.onsite?.defaultTripFeeCents ?? null,
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

  private async loadShopContext(): Promise<void> {
    try {
      const shop = await firstValueFrom(this.shopContext.load());
      const shopWithId = shop as typeof shop & { id?: string | null };

      this.shopId = shopWithId?.id ?? this.shopId;
      this.shopCountry =
        shop?.address?.country ||
        shop?.locale?.country ||
        this.shopCountry ||
        'US';

      this.newRepairForm.patchValue(
        { addressCountry: this.shopCountry },
        { emitEvent: false },
      );
    } catch (error) {
      console.error('Failed to load shop context.', error);

      this.newRepairForm.patchValue(
        { addressCountry: this.shopCountry },
        { emitEvent: false },
      );
    }
  }

  private buildOrderItems(serviceMode: RepairServiceMode) {
    type RepairOrderItem = {
      type: 'service' | 'product';
      productId: string | null;
      name: string;
      quantity: number;
      unitPriceCents: number;
      notes: string | null;
      sku: string | null;
    };

    const quotedPriceCents = this.dollarsToCents(
      this.newRepairForm.controls.quotedPriceDollars.value,
    );

    const items: RepairOrderItem[] = [
      {
        type: 'service',
        productId: null,
        name: this.selectedRepairService()?.label ?? 'Repair Service',
        quantity: 1,
        unitPriceCents: quotedPriceCents,
        notes: null,
        sku: null,
      },
    ];

    if (
      this.selectedPart?.source === 'inventory' &&
      this.newRepairForm.controls.selectedInventoryProductId.value
    ) {
      items.push({
        type: 'product',
        productId: this.newRepairForm.controls.selectedInventoryProductId.value,
        name: this.selectedPart.name,
        quantity: 1,
        unitPriceCents: Number(this.selectedPart.priceCents ?? 0),
        notes: 'Inventory part selected during repair intake',
        sku: this.selectedPart.sku ?? null,
      });
    }

    if (
      serviceMode === 'on_site' &&
      this.onsiteTripFeeEnabled() &&
      this.onsiteDefaultTripFeeCents() != null
    ) {
      items.push({
        type: 'service',
        productId: null,
        name: 'On-Site Trip Fee',
        quantity: 1,
        unitPriceCents: this.onsiteDefaultTripFeeCents()!,
        notes: null,
        sku: null,
      });
    }

    return items;
  }

  private buildInlineServiceAreaPayload() {
    return {
      serviceMode: this.newRepairForm.controls.serviceMode.value,
      line1: this.newRepairForm.controls.addressLine1.value.trim(),
      line2: this.newRepairForm.controls.addressLine2.value.trim() || null,
      city: this.newRepairForm.controls.addressCity.value.trim(),
      state: this.newRepairForm.controls.addressState.value.trim(),
      postalCode: this.normalizePostalCode(
        this.newRepairForm.controls.addressPostalCode.value,
      ),
      country: this.newRepairForm.controls.addressCountry.value
        .trim()
        .toUpperCase(),
    };
  }

  private getSelectedAddressForCheck(): CustomerAddress | null {
    const serviceAddressId = this.newRepairForm.controls.serviceAddressId.value;
    if (!serviceAddressId) return null;
    return (
      this.customerAddresses.find((x) => x.id === serviceAddressId) ?? null
    );
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
      this.newRepairForm.controls.addressPostalCode.value,
    );
    const country = this.newRepairForm.controls.addressCountry.value
      .trim()
      .toUpperCase();

    if (!line1 || !city || !state || !postalCode || !country) return null;

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
    } | null,
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
          'This on-site address is inside your service area.',
        );
        return;
      case 'onsite_disabled':
        this.toastService.error(
          'On-site repairs disabled',
          'On-site service is not enabled for this shop.',
        );
        return;
      case 'service_address_required':
        this.toastService.error(
          'Address incomplete',
          'Enter a complete service address before continuing.',
        );
        return;
      case 'outside_service_area':
        this.toastService.error(
          'Outside service area',
          'That address is outside your current on-site service area.',
        );
        return;
      case 'address_not_resolved':
        this.toastService.error(
          'Address not found',
          'We could not verify that address. Please review it and try again.',
        );
        return;
      case 'shop_address_missing':
        this.toastService.error(
          'Shop location missing',
          'Your shop address is not fully configured for service-area checks.',
        );
        return;
      case 'in_shop':
      default:
        return;
    }
  }

  private centsToDollars(value: number | null | undefined): number | null {
    if (value == null) return null;
    return value / 100;
  }

  private dollarsToCents(value: number | null | undefined): number {
    const numeric = Number(value ?? 0);
    if (!Number.isFinite(numeric)) return 0;
    return Math.round(numeric * 100);
  }

  private normalizePostalCode(value: string): string {
    return value.trim().toUpperCase();
  }

  @HostListener('document:click')
  closeDropdowns(): void {
    this.showCustomerResults = false;
    this.showDeviceResults = false;
    this.showTechSpecsBrandResults = false;
    this.showTechSpecsModelResults = false;
  }
}
