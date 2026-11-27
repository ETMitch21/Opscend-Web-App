import { isPlatformServer } from '@angular/common';
import {
  DOCUMENT,
  EnvironmentProviders,
  inject,
  InjectionToken,
  makeEnvironmentProviders,
  PLATFORM_ID,
} from '@angular/core';

export const WINDOW = new InjectionToken<Window | null>('WINDOW');

export const provideWindow = (): EnvironmentProviders =>
  makeEnvironmentProviders([
    {
      provide: WINDOW,
      useFactory: () =>
        isPlatformServer(inject(PLATFORM_ID))
          ? null
          : (inject(DOCUMENT).defaultView ?? null),
    },
  ]);
