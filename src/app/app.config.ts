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
} from '@angular/common/http';

import { routes } from './app.routes';
import { tenantInterceptor } from './core/tenant/tenant-interceptor';
import { AuthInterceptor } from './core/auth/auth.interceptor';
import { AppConfigService } from './core/app-config/app-config.service';

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideHttpClient(
      withInterceptors([tenantInterceptor]),
      withInterceptorsFromDi()
    ),
    provideRouter(routes),
    provideAppInitializer(() => {
      const config = inject(AppConfigService);
      return config.load();
    }),
  ],
};