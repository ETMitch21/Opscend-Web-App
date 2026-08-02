import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  Building2Icon,
  CheckIcon,
  ChevronRightIcon,
  LoaderCircleIcon,
  LucideAngularModule,
  MapPinIcon,
  PlusIcon,
  XIcon,
} from 'lucide-angular';

import {
  AccessibleLocation,
  AuthService,
  CreateLocationInput,
} from '../../../core/auth/auth.service';
import { SettingsLayoutComponent } from '../settings-layout/settings-layout';

@Component({
  selector: 'app-shop-locations',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, SettingsLayoutComponent],
  templateUrl: './shop-locations.html',
})
export class ShopLocations {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly currentUser = toSignal(this.auth.currentUser$, {
    initialValue: this.auth.getCurrentUser(),
  });

  readonly icons = {
    Building: Building2Icon,
    Check: CheckIcon,
    ChevronRight: ChevronRightIcon,
    Loader: LoaderCircleIcon,
    MapPin: MapPinIcon,
    Plus: PlusIcon,
    X: XIcon,
  };

  readonly locations = computed(() => this.currentUser()?.locations ?? []);
  readonly organizationName = computed(
    () => this.currentUser()?.organization?.name ?? 'Your business',
  );
  readonly showCreateForm = signal(false);
  readonly creating = signal(false);
  readonly switchingLocationId = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);

  name = '';
  legalName = '';
  slug = '';
  timezone = 'America/Chicago';
  phone = '';
  email = '';
  addressLine1 = '';
  addressLine2 = '';
  addressCity = '';
  addressState = '';
  addressPostalCode = '';
  addressCountry = 'US';
  private slugWasEdited = false;

  readonly timezones = [
    { label: 'Central (Chicago)', value: 'America/Chicago' },
    { label: 'Eastern (New York)', value: 'America/New_York' },
    { label: 'Mountain (Denver)', value: 'America/Denver' },
    { label: 'Pacific (Los Angeles)', value: 'America/Los_Angeles' },
  ];

  openCreateForm(): void {
    this.error.set(null);
    this.success.set(null);
    this.showCreateForm.set(true);
  }

  closeCreateForm(): void {
    if (this.creating()) return;
    this.showCreateForm.set(false);
    this.resetForm();
  }

  onNameChange(value: string): void {
    this.name = value;

    if (!this.slugWasEdited) {
      this.slug = this.slugify(value);
    }
  }

  onSlugChange(value: string): void {
    this.slugWasEdited = true;
    this.slug = this.slugify(value);
  }

  async createLocation(): Promise<void> {
    if (this.creating()) return;

    const name = this.name.trim();
    const slug = this.slugify(this.slug);

    if (name.length < 2 || slug.length < 3) {
      this.error.set('Enter a location name and a valid URL slug.');
      return;
    }

    this.creating.set(true);
    this.error.set(null);
    this.success.set(null);

    const input: CreateLocationInput = {
      name,
      slug,
      timezone: this.timezone,
      ...(this.legalName.trim() ? { legalName: this.legalName.trim() } : {}),
      ...(this.phone.trim() ? { phone: this.phone.trim() } : {}),
      ...(this.email.trim() ? { email: this.email.trim().toLowerCase() } : {}),
      address: {
        ...(this.addressLine1.trim() ? { line1: this.addressLine1.trim() } : {}),
        ...(this.addressLine2.trim() ? { line2: this.addressLine2.trim() } : {}),
        ...(this.addressCity.trim() ? { city: this.addressCity.trim() } : {}),
        ...(this.addressState.trim() ? { state: this.addressState.trim() } : {}),
        ...(this.addressPostalCode.trim()
          ? { postalCode: this.addressPostalCode.trim() }
          : {}),
        country: this.addressCountry,
      },
    };

    try {
      const response = await firstValueFrom(this.auth.createLocation(input));
      await this.auth.loadMe();
      this.success.set(`${response.location.name} is ready.`);
      this.showCreateForm.set(false);
      this.resetForm();
    } catch (error: any) {
      const code = error?.error?.error;
      this.error.set(
        code === 'shop_slug_taken'
          ? 'That location URL is already in use.'
          : 'The location could not be created. Review the details and try again.',
      );
    } finally {
      this.creating.set(false);
    }
  }

  async switchLocation(location: AccessibleLocation): Promise<void> {
    if (location.isCurrent || this.switchingLocationId()) return;

    this.switchingLocationId.set(location.shopId);
    this.error.set(null);

    try {
      await firstValueFrom(this.auth.switchLocation(location.shopId));
      await this.router.navigateByUrl('/dashboard');
      window.location.reload();
    } catch {
      this.error.set('The location could not be opened. Try again in a moment.');
      this.switchingLocationId.set(null);
    }
  }

  locationAddress(location: AccessibleLocation): string {
    const address = location.address;
    if (!address) return location.slug;

    return [
      address.line1,
      [address.city, address.state].filter(Boolean).join(', '),
      address.postalCode,
    ]
      .filter(Boolean)
      .join(' · ');
  }

  private resetForm(): void {
    this.name = '';
    this.legalName = '';
    this.slug = '';
    this.timezone = 'America/Chicago';
    this.phone = '';
    this.email = '';
    this.addressLine1 = '';
    this.addressLine2 = '';
    this.addressCity = '';
    this.addressState = '';
    this.addressPostalCode = '';
    this.addressCountry = 'US';
    this.slugWasEdited = false;
  }

  private slugify(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
  }
}
