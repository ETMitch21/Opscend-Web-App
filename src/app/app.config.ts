import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import {
  HTTP_INTERCEPTORS,
  provideHttpClient,
  withInterceptors,
  withInterceptorsFromDi,
  withXhr
} from '@angular/common/http';

import { routes } from './app.routes';
import { tenantInterceptor } from './core/tenant/tenant-interceptor';
import { AuthInterceptor } from './core/auth/auth.interceptor';
import { AppConfigService } from './core/app-config/app-config.service';
import { TenantService } from './core/tenant/tenant.service';
import { provideTheming } from './core/theming';
import { provideLocalStorage } from './core/local-storage';
import { provideMedia } from './core/media';
import { provideWindow } from './core/window';

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideHttpClient(withXhr(), 
      withInterceptors([tenantInterceptor]),
      withInterceptorsFromDi()
    ),
    provideRouter(routes),
    // BuilderKit palette only. Never install its mock HTTP backend in Opscend.
    provideWindow(),
    provideLocalStorage(),
    provideMedia(),
    provideTheming({ scheme: 'light', primary: '#c65b25', error: '#E5484D', neutral: '#8B8D98' }),
    provideAppInitializer(() => {
      // Tenant context must exist before the router starts its initial
      // navigation. Initializing it from App.ngOnInit() is too late on a
      // hard refresh: guarded feature routes can begin API requests before
      // the root component lifecycle hook runs.
      const tenant = inject(TenantService);
      tenant.init();

      const config = inject(AppConfigService);
      return config.load();
    }),
  ],
};