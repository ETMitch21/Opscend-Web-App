import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  Check,
  Clock3,
  ExternalLink,
  LucideAngularModule,
  PackageCheck,
  SearchX,
  ShieldCheck,
  Smartphone,
  Wrench,
  XCircle,
} from 'lucide-angular';
import { firstValueFrom } from 'rxjs';

import { RepairsService } from '../../../core/repairs/repairs-service';
import {
  PublicRepairTrackingResponse,
  PublicRepairTrackingTimelineItem,
} from '../../../core/repairs/repair.model';

@Component({
  selector: 'app-repair-tracking-page',
  standalone: true,
  imports: [CommonModule, RouterLink, LucideAngularModule, DatePipe],
  templateUrl: './repair-tracking.html',
})
export class RepairTracking {
  private readonly route = inject(ActivatedRoute);
  private readonly repairsService = inject(RepairsService);

  readonly icons = {
    Check,
    Clock3,
    ExternalLink,
    PackageCheck,
    SearchX,
    ShieldCheck,
    Smartphone,
    Wrench,
    XCircle,
  };

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly tracking = signal<PublicRepairTrackingResponse | null>(null);

  readonly deviceName = computed(() => {
    const device = this.tracking()?.customerDevice;

    if (!device) return 'Device repair';

    return (
      device.displayName ||
      [device.brand, device.model].filter(Boolean).join(' ') ||
      'Device repair'
    );
  });

  readonly isCompleted = computed(() => {
    const status = this.tracking()?.status;
    return status === 'picked_up' || status === 'ready';
  });

  readonly isCanceled = computed(() => this.tracking()?.status === 'canceled');

  async ngOnInit(): Promise<void> {
    const token = this.route.snapshot.paramMap.get('token');

    if (!token) {
      this.loading.set(false);
      this.error.set('tracking_not_found');
      return;
    }

    try {
      const response = await firstValueFrom(
        this.repairsService.getPublicRepairTracking(token)
      );

      this.tracking.set(response);
    } catch {
      this.error.set('tracking_not_found');
    } finally {
      this.loading.set(false);
    }
  }

  timelineDotClass(item: PublicRepairTrackingTimelineItem): string {
    if (item.current) {
      return 'bg-brand text-white ring-4 ring-brand/10';
    }

    if (item.completed) {
      return 'bg-emerald-500 text-white ring-4 ring-emerald-50';
    }

    return 'bg-gray-100 text-gray-400 ring-4 ring-gray-50';
  }

  timelineTextClass(item: PublicRepairTrackingTimelineItem): string {
    if (item.current) return 'text-gray-950';
    if (item.completed) return 'text-gray-800';
    return 'text-gray-400';
  }

  formatStatus(statusLabel: string): string {
    return statusLabel || 'In progress';
  }
}