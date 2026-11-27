import { describe, expect, it } from 'vitest';
import { Palette } from '../models';
import { generatePalette } from './generate-palette';

const hues = [
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  '11',
  '12',
] as const;

const createConfig = (
  overrides?: Partial<Parameters<typeof generatePalette>[0]>
) => ({
  appearance: 'light' as const,
  primary: '#3B82F6',
  error: '#EF4444',
  neutral: '#737373',
  background: '#FFFFFF',
  ...overrides,
});

const expectValidColor = (value: string) => {
  expect(value).toBeTruthy();
  expect(value).toMatch(/^oklch\(/);
  expect(value).not.toMatch(/NaN|null|undefined/);
};

const expectValidPalette = (palette: Palette) => {
  expectValidColor(palette.background);

  for (const scale of [palette.primary, palette.error, palette.neutral]) {
    for (const hue of hues) {
      expectValidColor(scale[hue]);
      expectValidColor(scale[`a${hue}`]);
    }

    expectValidColor(scale.surface);
  }

  expectValidColor(palette.primary.contrast);
  expectValidColor(palette.error.contrast);
};

const solidColors = (scale: Palette['neutral']) =>
  hues.map((hue) => scale[hue]);

describe('generatePalette', () => {
  describe('Standard Color Set', () => {
    it('should return a complete palette for light appearance', () => {
      const palette = generatePalette(createConfig());

      expectValidPalette(palette);
    });

    it('should return a complete palette for dark appearance', () => {
      const palette = generatePalette(
        createConfig({ appearance: 'dark', background: '#0A0A0A' })
      );

      expectValidPalette(palette);
    });
  });

  describe('Pure Black And White Sources', () => {
    it('should map a pure black primary onto the neutral scale', () => {
      const palette = generatePalette(createConfig({ primary: '#000000' }));

      expectValidPalette(palette);
      expect(solidColors(palette.primary).slice(0, 8)).toEqual(
        solidColors(palette.neutral).slice(0, 8)
      );
    });

    it('should map a pure white primary onto the neutral scale', () => {
      const palette = generatePalette(createConfig({ primary: '#FFFFFF' }));

      expectValidPalette(palette);
      expect(solidColors(palette.primary).slice(0, 8)).toEqual(
        solidColors(palette.neutral).slice(0, 8)
      );
    });

    it('should map a pure black error onto the neutral scale', () => {
      const palette = generatePalette(createConfig({ error: '#000000' }));

      expectValidPalette(palette);
      expect(solidColors(palette.error).slice(0, 8)).toEqual(
        solidColors(palette.neutral).slice(0, 8)
      );
    });

    it('should map a pure white error onto the neutral scale', () => {
      const palette = generatePalette(createConfig({ error: '#FFFFFF' }));

      expectValidPalette(palette);
      expect(solidColors(palette.error).slice(0, 8)).toEqual(
        solidColors(palette.neutral).slice(0, 8)
      );
    });

    it('should handle a pure black background in dark appearance', () => {
      const palette = generatePalette(
        createConfig({ appearance: 'dark', background: '#000000' })
      );

      expectValidPalette(palette);
    });

    it('should handle a pure white background in light appearance', () => {
      const palette = generatePalette(createConfig({ background: '#FFFFFF' }));

      expectValidPalette(palette);
    });
  });

  describe('Grays And Low Chroma', () => {
    it('should handle a pure gray primary', () => {
      const palette = generatePalette(createConfig({ primary: '#808080' }));

      expectValidPalette(palette);
    });

    it('should handle a near-gray primary', () => {
      const palette = generatePalette(createConfig({ primary: '#7A7D80' }));

      expectValidPalette(palette);
    });

    it('should handle gray primary, error and neutral at once', () => {
      const palette = generatePalette(
        createConfig({
          primary: '#808080',
          error: '#A3A3A3',
          neutral: '#737373',
        })
      );

      expectValidPalette(palette);
    });

    it('should handle a pure gray primary in dark appearance', () => {
      const palette = generatePalette(
        createConfig({
          appearance: 'dark',
          primary: '#808080',
          background: '#0A0A0A',
        })
      );

      expectValidPalette(palette);
    });
  });

  describe('Unusual Backgrounds', () => {
    it('should handle an off-white background', () => {
      const palette = generatePalette(createConfig({ background: '#FAFAF8' }));

      expectValidPalette(palette);
    });

    it('should handle a mid-gray background in light appearance', () => {
      const palette = generatePalette(createConfig({ background: '#808080' }));

      expectValidPalette(palette);
    });

    it('should handle a mid-gray background in dark appearance', () => {
      const palette = generatePalette(
        createConfig({ appearance: 'dark', background: '#808080' })
      );

      expectValidPalette(palette);
    });

    it('should handle a background lighter than the dark reference scale', () => {
      const palette = generatePalette(
        createConfig({ appearance: 'dark', background: '#FFFFFF' })
      );

      expectValidPalette(palette);
    });
  });

  // Golden palettes of the current generator; regenerate only on a
  // deliberate color-quality decision.
  describe('Golden Palettes', () => {
    it('should match the golden palette for the standard set in light appearance', () => {
      const palette = generatePalette(createConfig());

      expect(palette).toEqual({
        background: 'oklch(100% 0 none)',
        primary: {
          '1': 'oklch(99.33% 0.0032 259.8)',
          '2': 'oklch(98.16% 0.0096 259.8)',
          '3': 'oklch(96.01% 0.02 259.8)',
          '4': 'oklch(93.72% 0.0375 259.8)',
          '5': 'oklch(90.58% 0.0543 259.8)',
          '6': 'oklch(86.38% 0.0701 259.8)',
          '7': 'oklch(80.9% 0.0899 259.8)',
          '8': 'oklch(73.45% 0.1227 259.8)',
          '9': 'oklch(62.31% 0.188 259.8)',
          '10': 'oklch(58.16% 0.1912 259.8)',
          '11': 'oklch(55.4% 0.188 259.8)',
          '12': 'oklch(32.31% 0.0974 259.8)',
          a1: 'oklch(54.63% 0.2703 259.6 / 0.012)',
          a2: 'oklch(51.96% 0.2375 257.8 / 0.036)',
          a3: 'oklch(52.15% 0.2621 259.7 / 0.075)',
          a4: 'oklch(54.46% 0.2444 257 / 0.126)',
          a5: 'oklch(54.46% 0.2444 257 / 0.189)',
          a6: 'oklch(52.57% 0.2559 258.9 / 0.259)',
          a7: 'oklch(50.15% 0.2507 259.5 / 0.35)',
          a8: 'oklch(49.14% 0.2476 259.7 / 0.483)',
          a9: 'oklch(49.3% 0.2579 260.4 / 0.695)',
          a10: 'oklch(47.17% 0.2451 260.2 / 0.75)',
          a11: 'oklch(45.13% 0.2333 260.1 / 0.773)',
          a12: 'oklch(24.24% 0.1103 257.2 / 0.899)',
          contrast: 'oklch(100% 0 0)',
          surface: 'oklch(97.77% 0.0102 254.4 / 0.8)',
        },
        error: {
          '1': 'oklch(99.35% 0.0033 25.33)',
          '2': 'oklch(98.33% 0.0087 25.33)',
          '3': 'oklch(95.59% 0.0227 25.33)',
          '4': 'oklch(92.78% 0.0508 25.33)',
          '5': 'oklch(89.55% 0.0667 25.33)',
          '6': 'oklch(85.63% 0.0805 25.33)',
          '7': 'oklch(80.66% 0.0968 25.33)',
          '8': 'oklch(74.45% 0.1224 25.33)',
          '9': 'oklch(63.68% 0.2078 25.33)',
          '10': 'oklch(59.61% 0.2097 25.33)',
          '11': 'oklch(55.86% 0.2078 25.33)',
          '12': 'oklch(34.01% 0.1126 25.33)',
          a1: 'oklch(48.48% 0.2207 28.58 / 0.012)',
          a2: 'oklch(59.95% 0.2589 30.94 / 0.032)',
          a3: 'oklch(59.37% 0.256 31.16 / 0.087)',
          a4: 'oklch(58.4% 0.2544 30.95 / 0.157)',
          a5: 'oklch(58.41% 0.2573 30.53 / 0.216)',
          a6: 'oklch(58.79% 0.2593 30.5 / 0.283)',
          a7: 'oklch(55.82% 0.2483 30.18 / 0.361)',
          a8: 'oklch(53.14% 0.2368 30.09 / 0.467)',
          a9: 'oklch(55.61% 0.2538 29.37 / 0.702)',
          a10: 'oklch(52.31% 0.2396 29.23 / 0.753)',
          a11: 'oklch(49.4% 0.2268 29.15 / 0.793)',
          a12: 'oklch(27.28% 0.1218 30.14 / 0.899)',
          contrast: 'oklch(100% 0 0)',
          surface: 'oklch(97.97% 0.0109 23.68 / 0.8)',
        },
        neutral: {
          '1': 'oklch(99.24% 0 156.6)',
          '2': 'oklch(98.09% 0 166.6)',
          '3': 'oklch(95.51% 0 165.2)',
          '4': 'oklch(93.13% 0 165.4)',
          '5': 'oklch(90.93% 0 162.6)',
          '6': 'oklch(88.51% 0 162.8)',
          '7': 'oklch(85.12% 0 164.7)',
          '8': 'oklch(79.24% 0 164.3)',
          '9': 'oklch(63.94% 0 167.7)',
          '10': 'oklch(60.49% 0 168.2)',
          '11': 'oklch(50.05% 0 171)',
          '12': 'oklch(24% 0 161.8)',
          a1: 'oklch(0% 0 none / 0.0118)',
          a2: 'oklch(0% 0 none / 0.0235)',
          a3: 'oklch(0% 0 none / 0.0588)',
          a4: 'oklch(0% 0 none / 0.0902)',
          a5: 'oklch(0% 0 none / 0.1176)',
          a6: 'oklch(0% 0 none / 0.149)',
          a7: 'oklch(0% 0 none / 0.1922)',
          a8: 'oklch(0% 0 none / 0.2667)',
          a9: 'oklch(0% 0 none / 0.451)',
          a10: 'oklch(0% 0 none / 0.4941)',
          a11: 'oklch(0% 0 none / 0.6118)',
          a12: 'oklch(0% 0 none / 0.8784)',
          surface: 'oklch(100% 0 none / 0.8)',
        },
      });
    });

    it('should match the golden palette for the standard set in dark appearance', () => {
      const palette = generatePalette(
        createConfig({ appearance: 'dark', background: '#0A0A0A' })
      );

      expect(palette).toEqual({
        background: 'oklch(14.48% 0 none)',
        primary: {
          '1': 'oklch(14.48% 0.0248 259.8)',
          '2': 'oklch(20.34% 0.0291 259.8)',
          '3': 'oklch(26.95% 0.0664 259.8)',
          '4': 'oklch(31.57% 0.0952 259.8)',
          '5': 'oklch(36.25% 0.1045 259.8)',
          '6': 'oklch(41.05% 0.1092 259.8)',
          '7': 'oklch(46.46% 0.1181 259.8)',
          '8': 'oklch(52.55% 0.1356 259.8)',
          '9': 'oklch(62.31% 0.188 259.8)',
          '10': 'oklch(58.16% 0.188 259.8)',
          '11': 'oklch(77.17% 0.1272 259.8)',
          '12': 'oklch(90.88% 0.0467 259.8)',
          a1: 'oklch(46.81% 0.32 264 / 0.041)',
          a2: 'oklch(65.03% 0.1988 258.3 / 0.103)',
          a3: 'oklch(62.01% 0.2217 258.9 / 0.237)',
          a4: 'oklch(60.62% 0.2308 259 / 0.343)',
          a5: 'oklch(63.03% 0.2149 259.2 / 0.417)',
          a6: 'oklch(65.6% 0.1983 259.5 / 0.486)',
          a7: 'oklch(67.44% 0.1866 259.7 / 0.572)',
          a8: 'oklch(67.73% 0.1846 259.9 / 0.686)',
          a9: 'oklch(65.22% 0.2004 260.3 / 0.931)',
          a10: 'oklch(63.86% 0.2094 259.7 / 0.874)',
          a11: 'oklch(78.19% 0.1211 258.5 / 0.976)',
          a12: 'oklch(91.83% 0.0435 257.8 / 0.988)',
          contrast: 'oklch(100% 0 0)',
          surface: 'oklch(26.22% 0.0528 259.4 / 0.5)',
        },
        error: {
          '1': 'oklch(14.48% 0.0141 25.33)',
          '2': 'oklch(19.8% 0.0224 25.33)',
          '3': 'oklch(24.74% 0.0675 25.33)',
          '4': 'oklch(28.73% 0.1016 25.33)',
          '5': 'oklch(33.05% 0.113 25.33)',
          '6': 'oklch(38.17% 0.1178 25.33)',
          '7': 'oklch(44.98% 0.1274 25.33)',
          '8': 'oklch(54.26% 0.1548 25.33)',
          '9': 'oklch(63.68% 0.2078 25.33)',
          '10': 'oklch(59.61% 0.2078 25.33)',
          '11': 'oklch(78.37% 0.1741 25.33)',
          '12': 'oklch(90.16% 0.0558 25.33)',
          a1: 'oklch(63.12% 0.2914 28.96 / 0.017)',
          a2: 'oklch(73.02% 0.2091 26.53 / 0.078)',
          a3: 'oklch(67.77% 0.2668 29.01 / 0.18)',
          a4: 'oklch(66.12% 0.2849 27.85 / 0.266)',
          a5: 'oklch(67.22% 0.2726 27.25 / 0.331)',
          a6: 'oklch(69.49% 0.2481 26.78 / 0.4)',
          a7: 'oklch(71.84% 0.2238 26.49 / 0.498)',
          a8: 'oklch(72.52% 0.2169 25.98 / 0.658)',
          a9: 'oklch(70.79% 0.2345 25.33 / 0.862)',
          a10: 'oklch(69.56% 0.2474 25.42 / 0.8)',
          a11: 'oklch(80.39% 0.1437 25.98 / 0.939)',
          a12: 'oklch(91.88% 0.054 26.15 / 0.972)',
          contrast: 'oklch(100% 0 0)',
          surface: 'oklch(24.97% 0.0435 24.1 / 0.5)',
        },
        neutral: {
          '1': 'oklch(14.48% 0 307.8)',
          '2': 'oklch(20.8% 0 307.8)',
          '3': 'oklch(25.11% 0 306.5)',
          '4': 'oklch(28.19% 0 307.8)',
          '5': 'oklch(31.23% 0 306.9)',
          '6': 'oklch(34.87% 0 304)',
          '7': 'oklch(40.2% 0 304.4)',
          '8': 'oklch(48.8% 0 300.7)',
          '9': 'oklch(53.81% 0 294)',
          '10': 'oklch(58.45% 0 295.4)',
          '11': 'oklch(77% 0 296.6)',
          '12': 'oklch(94.89% 0 286.3)',
          a1: 'oklch(0% 0 none / 0)',
          a2: 'oklch(100% 0 none / 0.0571)',
          a3: 'oklch(100% 0 none / 0.098)',
          a4: 'oklch(100% 0 none / 0.1265)',
          a5: 'oklch(100% 0 none / 0.1592)',
          a6: 'oklch(100% 0 none / 0.1959)',
          a7: 'oklch(100% 0 none / 0.2531)',
          a8: 'oklch(100% 0 none / 0.351)',
          a9: 'oklch(100% 0 none / 0.4082)',
          a10: 'oklch(100% 0 none / 0.4612)',
          a11: 'oklch(100% 0 none / 0.6939)',
          a12: 'oklch(100% 0 none / 0.9306)',
          surface: 'oklch(0% 0 none / 0.05)',
        },
      });
    });

    it('should match the golden palette for a gray primary in light appearance', () => {
      const palette = generatePalette(createConfig({ primary: '#808080' }));

      expect(palette).toEqual({
        background: 'oklch(100% 0 none)',
        primary: {
          '1': 'oklch(99.23% 0 47.96)',
          '2': 'oklch(98.07% 0 62.23)',
          '3': 'oklch(95.3% 0 62.12)',
          '4': 'oklch(92.54% 0 61.13)',
          '5': 'oklch(89.56% 0 59.67)',
          '6': 'oklch(85.98% 0 59.33)',
          '7': 'oklch(81.09% 0 56.62)',
          '8': 'oklch(74.07% 0 54.28)',
          '9': 'oklch(59.99% 0 none)',
          '10': 'oklch(55.7% 0 54.83)',
          '11': 'oklch(50.81% 0 52.43)',
          '12': 'oklch(33.02% 0 51.68)',
          a1: 'oklch(0% 0 none / 0.0118)',
          a2: 'oklch(0% 0 none / 0.0235)',
          a3: 'oklch(0% 0 none / 0.0627)',
          a4: 'oklch(0% 0 none / 0.098)',
          a5: 'oklch(0% 0 none / 0.1373)',
          a6: 'oklch(0% 0 none / 0.1804)',
          a7: 'oklch(0% 0 none / 0.2431)',
          a8: 'oklch(0% 0 none / 0.3294)',
          a9: 'oklch(0% 0 none / 0.498)',
          a10: 'oklch(0% 0 none / 0.549)',
          a11: 'oklch(0% 0 none / 0.6039)',
          a12: 'oklch(0% 0 none / 0.7922)',
          contrast: 'oklch(100% 0 0)',
          surface: 'oklch(97.91% 0 none / 0.8)',
        },
        error: {
          '1': 'oklch(99.35% 0.0033 25.33)',
          '2': 'oklch(98.33% 0.0087 25.33)',
          '3': 'oklch(95.59% 0.0227 25.33)',
          '4': 'oklch(92.78% 0.0508 25.33)',
          '5': 'oklch(89.55% 0.0667 25.33)',
          '6': 'oklch(85.63% 0.0805 25.33)',
          '7': 'oklch(80.66% 0.0968 25.33)',
          '8': 'oklch(74.45% 0.1224 25.33)',
          '9': 'oklch(63.68% 0.2078 25.33)',
          '10': 'oklch(59.61% 0.2097 25.33)',
          '11': 'oklch(55.86% 0.2078 25.33)',
          '12': 'oklch(34.01% 0.1126 25.33)',
          a1: 'oklch(48.48% 0.2207 28.58 / 0.012)',
          a2: 'oklch(59.95% 0.2589 30.94 / 0.032)',
          a3: 'oklch(59.37% 0.256 31.16 / 0.087)',
          a4: 'oklch(58.4% 0.2544 30.95 / 0.157)',
          a5: 'oklch(58.41% 0.2573 30.53 / 0.216)',
          a6: 'oklch(58.79% 0.2593 30.5 / 0.283)',
          a7: 'oklch(55.82% 0.2483 30.18 / 0.361)',
          a8: 'oklch(53.14% 0.2368 30.09 / 0.467)',
          a9: 'oklch(55.61% 0.2538 29.37 / 0.702)',
          a10: 'oklch(52.31% 0.2396 29.23 / 0.753)',
          a11: 'oklch(49.4% 0.2268 29.15 / 0.793)',
          a12: 'oklch(27.28% 0.1218 30.14 / 0.899)',
          contrast: 'oklch(100% 0 0)',
          surface: 'oklch(97.97% 0.0109 23.68 / 0.8)',
        },
        neutral: {
          '1': 'oklch(99.24% 0 156.6)',
          '2': 'oklch(98.09% 0 166.6)',
          '3': 'oklch(95.51% 0 165.2)',
          '4': 'oklch(93.13% 0 165.4)',
          '5': 'oklch(90.93% 0 162.6)',
          '6': 'oklch(88.51% 0 162.8)',
          '7': 'oklch(85.12% 0 164.7)',
          '8': 'oklch(79.24% 0 164.3)',
          '9': 'oklch(63.94% 0 167.7)',
          '10': 'oklch(60.49% 0 168.2)',
          '11': 'oklch(50.05% 0 171)',
          '12': 'oklch(24% 0 161.8)',
          a1: 'oklch(0% 0 none / 0.0118)',
          a2: 'oklch(0% 0 none / 0.0235)',
          a3: 'oklch(0% 0 none / 0.0588)',
          a4: 'oklch(0% 0 none / 0.0902)',
          a5: 'oklch(0% 0 none / 0.1176)',
          a6: 'oklch(0% 0 none / 0.149)',
          a7: 'oklch(0% 0 none / 0.1922)',
          a8: 'oklch(0% 0 none / 0.2667)',
          a9: 'oklch(0% 0 none / 0.451)',
          a10: 'oklch(0% 0 none / 0.4941)',
          a11: 'oklch(0% 0 none / 0.6118)',
          a12: 'oklch(0% 0 none / 0.8784)',
          surface: 'oklch(100% 0 none / 0.8)',
        },
      });
    });

    it('should match the golden palette for a low-chroma primary in dark appearance', () => {
      const palette = generatePalette(
        createConfig({
          appearance: 'dark',
          primary: '#7A7D80',
          background: '#0A0A0A',
        })
      );

      expect(palette).toEqual({
        background: 'oklch(14.48% 0 none)',
        primary: {
          '1': 'oklch(14.48% 0.0004 247.9)',
          '2': 'oklch(20.97% 0.0007 247.9)',
          '3': 'oklch(25.17% 0.0009 247.9)',
          '4': 'oklch(28.93% 0.0012 247.9)',
          '5': 'oklch(32.82% 0.0015 247.9)',
          '6': 'oklch(37.35% 0.0018 247.9)',
          '7': 'oklch(42.94% 0.0022 247.9)',
          '8': 'oklch(49.83% 0.0027 247.9)',
          '9': 'oklch(58.81% 0.0058 247.9)',
          '10': 'oklch(54.45% 0.0058 247.9)',
          '11': 'oklch(79.32% 0.0051 247.9)',
          '12': 'oklch(91.51% 0.0018 247.9)',
          a1: 'oklch(0% 0 none / 0)',
          a2: 'oklch(100% 0 none / 0.0571)',
          a3: 'oklch(100% 0 none / 0.098)',
          a4: 'oklch(98.13% 0.0102 286.2 / 0.139)',
          a5: 'oklch(99.5% 0.008 195.8 / 0.176)',
          a6: 'oklch(99.58% 0.0067 195.8 / 0.225)',
          a7: 'oklch(98.87% 0.0069 235 / 0.29)',
          a8: 'oklch(99.03% 0.0051 254.4 / 0.368)',
          a9: 'oklch(98.06% 0.0102 254.4 / 0.482)',
          a10: 'oklch(97.71% 0.0122 252.6 / 0.429)',
          a11: 'oklch(98.87% 0.0069 235 / 0.735)',
          a12: 'oklch(99.65% 0.002 243.2 / 0.89)',
          contrast: 'oklch(100% 0 0)',
          surface: 'oklch(26.86% 0 none / 0.5)',
        },
        error: {
          '1': 'oklch(14.48% 0.0141 25.33)',
          '2': 'oklch(19.8% 0.0224 25.33)',
          '3': 'oklch(24.74% 0.0675 25.33)',
          '4': 'oklch(28.73% 0.1016 25.33)',
          '5': 'oklch(33.05% 0.113 25.33)',
          '6': 'oklch(38.17% 0.1178 25.33)',
          '7': 'oklch(44.98% 0.1274 25.33)',
          '8': 'oklch(54.26% 0.1548 25.33)',
          '9': 'oklch(63.68% 0.2078 25.33)',
          '10': 'oklch(59.61% 0.2078 25.33)',
          '11': 'oklch(78.37% 0.1741 25.33)',
          '12': 'oklch(90.16% 0.0558 25.33)',
          a1: 'oklch(63.12% 0.2914 28.96 / 0.017)',
          a2: 'oklch(73.02% 0.2091 26.53 / 0.078)',
          a3: 'oklch(67.77% 0.2668 29.01 / 0.18)',
          a4: 'oklch(66.12% 0.2849 27.85 / 0.266)',
          a5: 'oklch(67.22% 0.2726 27.25 / 0.331)',
          a6: 'oklch(69.49% 0.2481 26.78 / 0.4)',
          a7: 'oklch(71.84% 0.2238 26.49 / 0.498)',
          a8: 'oklch(72.52% 0.2169 25.98 / 0.658)',
          a9: 'oklch(70.79% 0.2345 25.33 / 0.862)',
          a10: 'oklch(69.56% 0.2474 25.42 / 0.8)',
          a11: 'oklch(80.39% 0.1437 25.98 / 0.939)',
          a12: 'oklch(91.88% 0.054 26.15 / 0.972)',
          contrast: 'oklch(100% 0 0)',
          surface: 'oklch(24.97% 0.0435 24.1 / 0.5)',
        },
        neutral: {
          '1': 'oklch(14.48% 0 307.8)',
          '2': 'oklch(20.8% 0 307.8)',
          '3': 'oklch(25.11% 0 306.5)',
          '4': 'oklch(28.19% 0 307.8)',
          '5': 'oklch(31.23% 0 306.9)',
          '6': 'oklch(34.87% 0 304)',
          '7': 'oklch(40.2% 0 304.4)',
          '8': 'oklch(48.8% 0 300.7)',
          '9': 'oklch(53.81% 0 294)',
          '10': 'oklch(58.45% 0 295.4)',
          '11': 'oklch(77% 0 296.6)',
          '12': 'oklch(94.89% 0 286.3)',
          a1: 'oklch(0% 0 none / 0)',
          a2: 'oklch(100% 0 none / 0.0571)',
          a3: 'oklch(100% 0 none / 0.098)',
          a4: 'oklch(100% 0 none / 0.1265)',
          a5: 'oklch(100% 0 none / 0.1592)',
          a6: 'oklch(100% 0 none / 0.1959)',
          a7: 'oklch(100% 0 none / 0.2531)',
          a8: 'oklch(100% 0 none / 0.351)',
          a9: 'oklch(100% 0 none / 0.4082)',
          a10: 'oklch(100% 0 none / 0.4612)',
          a11: 'oklch(100% 0 none / 0.6939)',
          a12: 'oklch(100% 0 none / 0.9306)',
          surface: 'oklch(0% 0 none / 0.05)',
        },
      });
    });
  });
});
