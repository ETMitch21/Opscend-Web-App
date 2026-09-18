import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';

import { firstValueFrom } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { BusinessSettingsService } from '../../core/business-settings/service';

@Component({
  selector: 'app-home-redirect',
  standalone: true,
  template: '',
})
export class HomeRedirectComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly businessSettings = inject(BusinessSettingsService);

  async ngOnInit(): Promise<void> {
    await this.auth.bootstrap();
    let crmEnabled = false;
    if (this.auth.hasPermission('crm:read')) {
      try {
        const features = await firstValueFrom(this.businessSettings.getFeatures());
        crmEnabled = features.settings.crmEnabled;
      } catch {
        crmEnabled = false;
      }
    }

    const target = this.auth.hasPermission('repairs:read')
      ? '/dashboard'
      : this.auth.hasPermission('crm:read') && crmEnabled
        ? '/crm'
        : '/settings/profile/my-profile';
    await this.router.navigateByUrl(target, { replaceUrl: true });
  }
}
