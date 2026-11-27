import { isPlatformServer } from '@angular/common';
import {
  computed,
  effect,
  inject,
  signal,
  DOCUMENT,
  PLATFORM_ID,
  Service,
} from '@angular/core';
import { LocalStorage } from '../local-storage';
import { Media } from '../media';
import { Palette, Palettes, Scheme, Theme } from './models';
import { THEME_CONFIG } from './provider';
import { generatePalette } from './utils/generate-palette';

export const DEFAULT_BORDER_RADIUS = '0.5rem';

@Service()
export class Theming {
  // Dependencies
  private document = inject(DOCUMENT);
  private isServer = isPlatformServer(inject(PLATFORM_ID));
  private localStorage = inject(LocalStorage);
  private media = inject(Media);
  private themeConfig = inject(THEME_CONFIG);

  // State
  private prefersDarkMode = this.media.match('(prefers-color-scheme: dark)');
  private borderRadius = this.themeConfig.borderRadius ?? DEFAULT_BORDER_RADIUS;

  theme = signal<Theme>({
    primary:
      this.localStorage.getItem('primaryColor') ?? this.themeConfig.primary,
    error: this.localStorage.getItem('errorColor') ?? this.themeConfig.error,
    neutral:
      this.localStorage.getItem('neutralColor') ?? this.themeConfig.neutral,
  });
  scheme = signal<Scheme>(
    (this.localStorage.getItem('scheme') as Scheme) ?? this.themeConfig.scheme
  );
  isDark = computed(
    () =>
      this.scheme() === 'dark' ||
      (this.scheme() === 'system' && this.prefersDarkMode())
  );
  palettes = computed(() => this.generatePalettes(this.theme()));

  // DOM
  private rootEl = this.document.documentElement;
  private readonly themeStyleEl =
    this.document.head.querySelector('.theme-colors') ??
    this.document.createElement('style');

  constructor() {
    // If the style element is not already in the DOM, add it
    if (!this.themeStyleEl.parentNode) {
      this.themeStyleEl.classList.add('theme-colors');
      this.document.head.appendChild(this.themeStyleEl);
    }

    // Update scheme
    effect(() => {
      // Skip the server. Otherwise, the scheme will always be 'system' and
      // the class will always be 'scheme-dark'.
      if (this.isServer) {
        return;
      }

      const scheme = this.scheme();
      const isDark = this.isDark();

      // Add the 'dark' or 'light' class to the HTML element
      this.rootEl.classList.toggle('scheme-dark', isDark);
      this.rootEl.classList.toggle('scheme-light', !isDark);

      // Store the scheme in local storage
      this.localStorage.setItem('scheme', scheme);
    });

    // Store the source colors in local storage
    effect(() => {
      // Skip the server. Otherwise, the theme colors will be stored as the
      // default colors from the theme config on every request.
      if (this.isServer) {
        return;
      }

      const theme = this.theme();

      // Save the source colors to local storage
      this.localStorage.setItem('primaryColor', theme.primary);
      this.localStorage.setItem('errorColor', theme.error);
      this.localStorage.setItem('neutralColor', theme.neutral);
    });

    // Apply the theme
    effect(() => {
      this.applyTheme(this.palettes());
    });
  }

  /**
   * Generate palettes from the theme config.
   */
  private generatePalettes(config: Theme): Palettes {
    return {
      source: {
        primary: config.primary,
        error: config.error,
        neutral: config.neutral,
      },
      light: generatePalette({
        appearance: 'light',
        primary: config.primary,
        error: config.error,
        neutral: config.neutral,
        background: '#FFFFFF', // Backdrop for alpha compositing
      }),
      dark: generatePalette({
        appearance: 'dark',
        primary: config.primary,
        error: config.error,
        neutral: config.neutral,
        background: '#111111', // Backdrop for alpha compositing
      }),
    };
  }

  /**
   * Applies the theme to the DOM by injecting CSS variables into the style
   * element.
   */
  private applyTheme(palettes: Palettes) {
    const variablePrefix = 'theme';
    const style = this.themeStyleEl;

    // Build the style content
    style.textContent = `:root {`;

    // Border radius
    style.textContent += `--${variablePrefix}-border-radius: ${this.borderRadius};`;

    // Primary
    const primaryKeys = Object.keys(
      palettes.light.primary
    ) as (keyof Palette['primary'])[];
    for (const name of primaryKeys) {
      const lightColor = palettes.light.primary[name];
      const darkColor = palettes.dark.primary[name];
      style.textContent += `--${variablePrefix}-color-primary-${name}: light-dark(${lightColor}, ${darkColor});`;
    }

    // Error
    const errorKeys = Object.keys(
      palettes.light.error
    ) as (keyof Palette['error'])[];
    for (const name of errorKeys) {
      const lightColor = palettes.light.error[name];
      const darkColor = palettes.dark.error[name];
      style.textContent += `--${variablePrefix}-color-error-${name}: light-dark(${lightColor}, ${darkColor});`;
    }

    // Neutral
    const neutralKeys = Object.keys(
      palettes.light.neutral
    ) as (keyof Palette['neutral'])[];
    for (const name of neutralKeys) {
      const lightColor = palettes.light.neutral[name];
      const darkColor = palettes.dark.neutral[name];
      style.textContent += `--${variablePrefix}-color-neutral-${name}: light-dark(${lightColor}, ${darkColor});`;
    }

    style.textContent += `}`;
  }
}
