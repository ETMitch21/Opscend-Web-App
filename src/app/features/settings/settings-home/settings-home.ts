import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import {
  ArrowRightIcon,
  LucideAngularModule,
  SearchIcon,
  SettingsIcon,
  XIcon,
} from 'lucide-angular';

import { AuthService } from '../../../core/auth/auth.service';
import {
  SettingsNavGroup,
  visibleSettingsGroups,
} from '../settings-navigation';

@Component({
  selector: 'app-settings-home',
  standalone: true,
  imports: [CommonModule, RouterLink, LucideAngularModule],
  templateUrl: './settings-home.html',
})
export class SettingsHome {
  private readonly auth = inject(AuthService);

  readonly icons = {
    ArrowRight: ArrowRightIcon,
    Search: SearchIcon,
    Settings: SettingsIcon,
    X: XIcon,
  };

  readonly search = signal('');
  private readonly currentUser = toSignal(this.auth.currentUser$, {
    initialValue: this.auth.getCurrentUser(),
  });

  readonly groups = computed(() =>
    visibleSettingsGroups(this.currentUser()?.role),
  );

  readonly filteredGroups = computed<SettingsNavGroup[]>(() => {
    const query = this.normalize(this.search());
    if (!query) return this.groups();

    return this.groups()
      .map((group) => ({
        ...group,
        items: group.items.filter((item) =>
          this.normalize(
            [
              item.label,
              item.description,
              group.label,
              group.description,
              ...(item.keywords ?? []),
            ].join(' '),
          ).includes(query),
        ),
      }))
      .filter((group) => group.items.length > 0);
  });

  readonly visibleSettingCount = computed(() =>
    this.filteredGroups().reduce((count, group) => count + group.items.length, 0),
  );

  clearSearch(): void {
    this.search.set('');
  }

  private normalize(value: string): string {
    return value.trim().toLowerCase().replace(/\s+/g, ' ');
  }
}
