import {
  PLATFORM_ID,
  provideZonelessChangeDetection,
  signal,
  TransferState,
  WritableSignal,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import { Media } from '../media';
import { WINDOW } from '../window';
import { ThemeConfig } from './models';
import { THEME_CONFIG } from './provider';
import { DEFAULT_BORDER_RADIUS, Theming } from './theming';

const createStorage = (): Storage => {
  const entries = new Map<string, string>();

  return {
    get length() {
      return entries.size;
    },
    clear: () => entries.clear(),
    getItem: (key: string) => entries.get(key) ?? null,
    key: (index: number) => Array.from(entries.keys())[index] ?? null,
    removeItem: (key: string) => {
      entries.delete(key);
    },
    setItem: (key: string, value: string) => {
      entries.set(key, value);
    },
  };
};

const createThemeConfig = (): ThemeConfig => ({
  primary: '#3B82F6',
  error: '#EF4444',
  neutral: '#737373',
  scheme: 'light',
});

const cleanUpDom = () => {
  document.head.querySelector('.theme-colors')?.remove();
  document.documentElement.classList.remove('scheme-dark', 'scheme-light');
};

describe('Theming', () => {
  describe('Browser Environment', () => {
    let prefersDark: WritableSignal<boolean>;
    let themeConfig: ThemeConfig;
    let transferState: { get: Mock; set: Mock };
    let window: { localStorage: Storage };

    const createTheming = (): Theming => {
      const theming = TestBed.inject(Theming);
      TestBed.tick();
      return theming;
    };

    beforeEach(() => {
      prefersDark = signal(false);
      themeConfig = createThemeConfig();
      transferState = { get: vi.fn(() => []), set: vi.fn() };
      window = { localStorage: createStorage() };

      TestBed.configureTestingModule({
        providers: [
          provideZonelessChangeDetection(),
          { provide: PLATFORM_ID, useValue: 'browser' },
          { provide: TransferState, useValue: transferState },
          { provide: WINDOW, useValue: window },
          {
            provide: Media,
            useValue: { match: () => prefersDark.asReadonly() },
          },
          { provide: THEME_CONFIG, useValue: themeConfig },
        ],
      });
    });

    afterEach(() => {
      cleanUpDom();
    });

    it('should seed theme from theme config when storage is empty', () => {
      const theming = createTheming();

      expect(theming.theme()).toEqual({
        primary: '#3B82F6',
        error: '#EF4444',
        neutral: '#737373',
      });
    });

    it('should seed theme from stored colors', () => {
      window.localStorage.setItem('primaryColor', '#10B981');
      window.localStorage.setItem('errorColor', '#DC2626');
      window.localStorage.setItem('neutralColor', '#404040');

      const theming = createTheming();

      expect(theming.theme()).toEqual({
        primary: '#10B981',
        error: '#DC2626',
        neutral: '#404040',
      });
    });

    it('should seed scheme from stored scheme', () => {
      window.localStorage.setItem('scheme', 'dark');

      const theming = createTheming();

      expect(theming.scheme()).toBe('dark');
    });

    it('should be dark when scheme is dark', () => {
      const theming = createTheming();
      theming.scheme.set('dark');

      expect(theming.isDark()).toBe(true);
    });

    it('should not be dark when scheme is light even if system prefers dark', () => {
      const theming = createTheming();
      prefersDark.set(true);

      expect(theming.isDark()).toBe(false);
    });

    it('should not be dark when scheme is system and the system prefers light', () => {
      const theming = createTheming();
      theming.scheme.set('system');

      expect(theming.isDark()).toBe(false);
    });

    it('should be dark when scheme is system and the system prefers dark', () => {
      const theming = createTheming();
      theming.scheme.set('system');
      prefersDark.set(true);

      expect(theming.isDark()).toBe(true);
    });

    it('should toggle scheme classes on the root element', () => {
      const theming = createTheming();
      const rootEl = document.documentElement;

      theming.scheme.set('dark');
      TestBed.tick();

      expect(rootEl.classList.contains('scheme-dark')).toBe(true);
      expect(rootEl.classList.contains('scheme-light')).toBe(false);

      theming.scheme.set('light');
      TestBed.tick();

      expect(rootEl.classList.contains('scheme-dark')).toBe(false);
      expect(rootEl.classList.contains('scheme-light')).toBe(true);
    });

    it('should persist scheme changes', () => {
      const theming = createTheming();

      theming.scheme.set('dark');
      TestBed.tick();

      expect(window.localStorage.getItem('scheme')).toBe('dark');
    });

    it('should persist theme colors', () => {
      const theming = createTheming();

      theming.theme.set({
        primary: '#10B981',
        error: '#DC2626',
        neutral: '#404040',
      });
      TestBed.tick();

      expect(window.localStorage.getItem('primaryColor')).toBe('#10B981');
      expect(window.localStorage.getItem('errorColor')).toBe('#DC2626');
      expect(window.localStorage.getItem('neutralColor')).toBe('#404040');
    });

    it('should append the theme style element to the head', () => {
      createTheming();

      expect(document.head.querySelector('style.theme-colors')).toBeTruthy();
    });

    it('should reuse an existing theme style element', () => {
      const style = document.createElement('style');
      style.classList.add('theme-colors');
      document.head.appendChild(style);

      createTheming();

      expect(document.head.querySelectorAll('.theme-colors').length).toBe(1);
    });

    it('should write css variables into the style element', () => {
      createTheming();
      const content = document.head.querySelector('.theme-colors')?.textContent;

      expect(content).toContain(
        `--theme-border-radius: ${DEFAULT_BORDER_RADIUS};`
      );
      expect(content).toContain('--theme-color-primary-');
      expect(content).toContain('light-dark(');
    });

    it('should use the configured border radius', () => {
      themeConfig.borderRadius = '1rem';

      createTheming();
      const content = document.head.querySelector('.theme-colors')?.textContent;

      expect(content).toContain('--theme-border-radius: 1rem;');
    });
  });

  describe('Server Environment', () => {
    let transferState: { get: Mock; set: Mock };

    beforeEach(() => {
      transferState = { get: vi.fn(() => []), set: vi.fn() };

      TestBed.configureTestingModule({
        providers: [
          provideZonelessChangeDetection(),
          { provide: PLATFORM_ID, useValue: 'server' },
          { provide: TransferState, useValue: transferState },
          { provide: WINDOW, useValue: null },
          {
            provide: Media,
            useValue: { match: () => signal(false).asReadonly() },
          },
          { provide: THEME_CONFIG, useValue: createThemeConfig() },
        ],
      });

      TestBed.inject(Theming);
      TestBed.tick();
    });

    afterEach(() => {
      cleanUpDom();
    });

    it('should not touch root element classes', () => {
      const rootEl = document.documentElement;

      expect(rootEl.classList.contains('scheme-dark')).toBe(false);
      expect(rootEl.classList.contains('scheme-light')).toBe(false);
    });

    it('should not persist anything', () => {
      expect(transferState.set).not.toHaveBeenCalled();
    });

    it('should still write css variables into the style element', () => {
      const content = document.head.querySelector('.theme-colors')?.textContent;

      expect(content).toContain(
        `--theme-border-radius: ${DEFAULT_BORDER_RADIUS};`
      );
      expect(content).toContain('--theme-color-primary-');
    });
  });

  describe('Browser Environment (storage unavailable)', () => {
    let theming: Theming;

    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [
          provideZonelessChangeDetection(),
          { provide: PLATFORM_ID, useValue: 'browser' },
          {
            provide: TransferState,
            useValue: { get: vi.fn(() => []), set: vi.fn() },
          },
          { provide: WINDOW, useValue: {} },
          {
            provide: Media,
            useValue: { match: () => signal(false).asReadonly() },
          },
          { provide: THEME_CONFIG, useValue: createThemeConfig() },
        ],
      });

      theming = TestBed.inject(Theming);
      TestBed.tick();
    });

    afterEach(() => {
      cleanUpDom();
    });

    it('should fall back to theme config', () => {
      expect(theming.theme()).toEqual({
        primary: '#3B82F6',
        error: '#EF4444',
        neutral: '#737373',
      });
      expect(theming.scheme()).toBe('light');
    });

    it('should not throw when changing scheme', () => {
      theming.scheme.set('dark');
      TestBed.tick();

      expect(document.documentElement.classList.contains('scheme-dark')).toBe(
        true
      );
    });
  });
});
