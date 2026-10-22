import { CommonModule } from '@angular/common';
import { Component, output } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { RepairPricingTypes } from '../../repair-pricing-types/repair-pricing-types';

/** Reuses the existing repair-type catalog logic without routing away from pricing. */
@Component({
  selector: 'app-repair-types-drawer',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, LucideAngularModule],
  templateUrl: './repair-types-drawer.html',
})
export class RepairTypesDrawer extends RepairPricingTypes {
  readonly dismissed = output<void>();
  close(): void { this.dismissed.emit(); }
}
