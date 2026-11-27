import {
  DOCUMENT,
  PLATFORM_ID,
  provideZonelessChangeDetection,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { provideWindow, WINDOW } from './provider';

describe('WINDOW', () => {
  describe('Browser Environment', () => {
    const fakeWindow = {} as Window;

    it('should resolve to the document default view', () => {
      TestBed.configureTestingModule({
        providers: [
          provideZonelessChangeDetection(),
          { provide: PLATFORM_ID, useValue: 'browser' },
          { provide: DOCUMENT, useValue: { defaultView: fakeWindow } },
          provideWindow(),
        ],
      });

      expect(TestBed.inject(WINDOW)).toBe(fakeWindow);
    });

    it('should resolve to null when the document has no default view', () => {
      TestBed.configureTestingModule({
        providers: [
          provideZonelessChangeDetection(),
          { provide: PLATFORM_ID, useValue: 'browser' },
          { provide: DOCUMENT, useValue: { defaultView: null } },
          provideWindow(),
        ],
      });

      expect(TestBed.inject(WINDOW)).toBeNull();
    });
  });

  describe('Server Environment', () => {
    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [
          provideZonelessChangeDetection(),
          { provide: PLATFORM_ID, useValue: 'server' },
          { provide: DOCUMENT, useValue: { defaultView: {} as Window } },
          provideWindow(),
        ],
      });
    });

    it('should resolve to null', () => {
      expect(TestBed.inject(WINDOW)).toBeNull();
    });
  });
});
