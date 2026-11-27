// Based on Radix UI color generator
// https://github.com/radix-ui/website/blob/main/components/generate-radix-colors.tsx

import Color, { Coords } from 'colorjs.io';
import { AlphaColors, BaseColors, Palette } from '../models';
import { BezierEasing } from './bezier-easing';
import { referenceColors } from './reference-colors';

// prettier-ignore
const neutralPaletteNames = [
  'gray', 'mauve', 'slate', 'sage', 'olive', 'sand'
] as const;

const lightColors = referenceColors.chromatic.light;
const darkColors = referenceColors.chromatic.dark;
const lightNeutralColors = referenceColors.neutral.light;
const darkNeutralColors = referenceColors.neutral.dark;

export const generatePalette = (config: {
  appearance: 'light' | 'dark';
  primary: string;
  error: string;
  neutral: string;
  background: string;
}): Palette => {
  const backgroundSourceColor = new Color(config.background).to('oklch');

  const primarySourceColor = new Color(config.primary).to('oklch');
  let primaryPalette = getPaletteFromColor(
    primarySourceColor,
    backgroundSourceColor,
    config.appearance === 'light' ? lightColors : darkColors
  );

  const errorSourceColor = new Color(config.error).to('oklch');
  let errorPalette = getPaletteFromColor(
    errorSourceColor,
    backgroundSourceColor,
    config.appearance === 'light' ? lightColors : darkColors
  );

  const neutralSourceColor = new Color(config.neutral).to('oklch');
  const neutralPalette = getPaletteFromColor(
    neutralSourceColor,
    backgroundSourceColor,
    config.appearance === 'light' ? lightNeutralColors : darkNeutralColors
  );

  // Make sure we use the tint from the neutral scale for when base
  // is pure white or black
  const primaryBaseHex = primarySourceColor
    .to('srgb')
    .toString({ format: 'hex' });
  if (primaryBaseHex === '#000' || primaryBaseHex === '#fff') {
    primaryPalette = neutralPalette.map((color) => color.clone());
  }

  const errorBaseHex = errorSourceColor.to('srgb').toString({ format: 'hex' });
  if (errorBaseHex === '#000' || errorBaseHex === '#fff') {
    errorPalette = neutralPalette.map((color) => color.clone());
  }

  // Get step-9 colors
  const [primary9Color, primaryContrastColor] = getStep9Colors(
    primaryPalette,
    primarySourceColor
  );
  primaryPalette[8] = primary9Color;
  primaryPalette[9] = getButtonHoverColor(primary9Color, [primaryPalette]);

  const [error9Color, errorContrastColor] = getStep9Colors(
    errorPalette,
    errorSourceColor
  );
  errorPalette[8] = error9Color;
  errorPalette[9] = getButtonHoverColor(error9Color, [errorPalette]);

  if (
    primaryPalette[8].c === null ||
    primaryPalette[7].c === null ||
    primaryPalette[10].c === null ||
    primaryPalette[11].c === null ||
    errorPalette[7].c === null ||
    errorPalette[8].c === null ||
    errorPalette[10].c === null ||
    errorPalette[11].c === null
  ) {
    throw Error('Color is missing Oklch coords');
  }

  // Limit saturation of the text colors
  primaryPalette[10].c = Math.min(
    Math.max(primaryPalette[8].c, primaryPalette[7].c),
    primaryPalette[10].c
  );
  primaryPalette[11].c = Math.min(
    Math.max(primaryPalette[8].c, primaryPalette[7].c),
    primaryPalette[11].c
  );

  errorPalette[10].c = Math.min(
    Math.max(errorPalette[8].c, errorPalette[7].c),
    errorPalette[10].c
  );
  errorPalette[11].c = Math.min(
    Math.max(errorPalette[8].c, errorPalette[7].c),
    errorPalette[11].c
  );

  return {
    // Background
    background: backgroundSourceColor.to('oklch').toString({ precision: 4 }),

    // Primary
    primary: {
      // Solid colors
      ...(Object.fromEntries(
        primaryPalette.map((color, index) => [
          `${index + 1}`,
          color.to('oklch').toString({ precision: 4 }),
        ])
      ) as BaseColors),

      // Alpha colors
      ...(Object.fromEntries(
        primaryPalette.map((color, index) => [
          `a${index + 1}`,
          getAlphaColorOklch(color, backgroundSourceColor),
        ])
      ) as AlphaColors),

      // Other colors
      contrast: primaryContrastColor.to('oklch').toString({ precision: 4 }),
      surface:
        config.appearance === 'light'
          ? getAlphaColorOklch(primaryPalette[1], backgroundSourceColor, 0.8)
          : getAlphaColorOklch(primaryPalette[1], backgroundSourceColor, 0.5),
    },

    // Error
    error: {
      // Solid colors
      ...(Object.fromEntries(
        errorPalette.map((color, index) => [
          `${index + 1}`,
          color.to('oklch').toString({ precision: 4 }),
        ])
      ) as BaseColors),

      // Alpha colors
      ...(Object.fromEntries(
        errorPalette.map((color, index) => [
          `a${index + 1}`,
          getAlphaColorOklch(color, backgroundSourceColor),
        ])
      ) as AlphaColors),

      // Other colors
      contrast: errorContrastColor.to('oklch').toString({ precision: 4 }),
      surface:
        config.appearance === 'light'
          ? getAlphaColorOklch(errorPalette[1], backgroundSourceColor, 0.8)
          : getAlphaColorOklch(errorPalette[1], backgroundSourceColor, 0.5),
    },

    // Neutral
    neutral: {
      // Solid colors
      ...(Object.fromEntries(
        neutralPalette.map((color, index) => [
          `${index + 1}`,
          color.to('oklch').toString({ precision: 4 }),
        ])
      ) as BaseColors),

      // Alpha colors
      ...(Object.fromEntries(
        neutralPalette.map((color, index) => [
          `a${index + 1}`,
          getAlphaColorOklch(color, backgroundSourceColor),
        ])
      ) as AlphaColors),

      // Other colors
      surface:
        config.appearance === 'light'
          ? new Color('color(display-p3 1 1 1 / 80%)')
              .to('oklch')
              .toString({ precision: 4 })
          : new Color('color(display-p3 0 0 0 / 5%)')
              .to('oklch')
              .toString({ precision: 4 }),
    },
  };
};

const getStep9Colors = (
  scale: Color[],
  primaryBaseColor: Color
): [Color, Color] => {
  const referenceBackgroundColor = scale[0];
  const distance = primaryBaseColor.deltaEOK(referenceBackgroundColor) * 100;

  // If the primary base color is close to the page background color, it's likely
  // white on white or black on black, so we want to return something that makes
  // sense instead
  if (distance < 25) {
    return [scale[8], getTextColor(scale[8])];
  }

  return [primaryBaseColor, getTextColor(primaryBaseColor)];
};

const getButtonHoverColor = (source: Color, scales: Color[][]) => {
  const L = source.l;
  const C = source.c;
  const H = source.h ?? 0;

  if (L === null || C === null) {
    throw Error('Color is missing Oklch coords');
  }

  const newL = L > 0.4 ? L - 0.03 / (L + 0.1) : L + 0.03 / (L + 0.1);
  const newC = L > 0.4 && !isNaN(H) ? C * 0.93 : C;
  const buttonHoverColor = new Color('oklch', [newL, newC, H]);

  // Find closest in-scale color to donate the chroma and hue.
  // Especially useful when the source color is pure white or black,
  // but the neutral scale is tinted.
  let closestColor = buttonHoverColor;
  let minDistance = Infinity;

  scales.forEach((scale) => {
    for (const color of scale) {
      const distance = buttonHoverColor.deltaEOK(color);
      if (distance < minDistance) {
        minDistance = distance;
        closestColor = color;
      }
    }
  });

  buttonHoverColor.c = closestColor.c;
  buttonHoverColor.h = closestColor.h;
  return buttonHoverColor;
};

const getPaletteFromColor = (
  source: Color,
  backgroundColor: Color,
  referenceColors: Record<string, Color[]>
) => {
  const darkModeEasing = [1, 0, 1, 0] as [number, number, number, number];
  const lightModeEasing = [0, 2, 0, 2] as [number, number, number, number];

  const allColors: { scale: string; color: Color; distance: number }[] = [];

  Object.entries(referenceColors).forEach(([name, scale]) => {
    for (const color of scale) {
      const distance = source.deltaEOK(color);
      allColors.push({ scale: name, distance, color });
    }
  });

  allColors.sort((a, b) => a.distance - b.distance);

  // Remove non-unique scales
  const closestColors = allColors.filter(
    (color, i, arr) =>
      i === arr.findIndex((value) => value.scale === color.scale)
  );

  // If the next two closest colors are both neutrals, remove the second one
  // until it’s not a neutral anymore. This is because up next we will be
  // comparing how close the two closest colors are to the source color, and
  // since the neutrals are all extremely close to each other, we won’t get any
  // useful data from the second-closest color if it’s also a neutral.
  const neutralScaleNamesStr = neutralPaletteNames as readonly string[];
  const allAreNeutrals = closestColors.every((color) =>
    neutralScaleNamesStr.includes(color.scale)
  );
  if (
    !allAreNeutrals &&
    neutralScaleNamesStr.includes(closestColors[0].scale)
  ) {
    while (neutralScaleNamesStr.includes(closestColors[1].scale)) {
      closestColors.splice(1, 1);
    }
  }

  const colorA = closestColors[0];
  const colorB = closestColors[1];

  // Light trigonometry ahead.
  //
  // We want to determine the color that is the closest to the source color.
  // Sometimes it makes sense to proportionally mix the two closest colors
  // together, but sometimes it is not useful at all. Color coords are spatial
  // in 3D, however we can treat the data we have as a 2D projection that is
  // good enough.
  //
  // Case 1:
  // If the distances between the source color, the 1st closest color (A) and
  // the 2nd closest color (B) form a triangle where NEITHER angle A nor B are
  // larger than 90 degrees, then we want to mix the 1st and the 2nd closest
  // colors in the same proportion as distances AD and BD are to each other.
  // Mixing the two would result in a color that would be closer to the source
  // color than either of the two original closest colors. Example: source color
  // is a desaturated blue, which is between "indigo" and "slate" scales.
  //
  //        C ← Source color
  //       /|⟍
  //      / |  ⟍
  //   b /  |    ⟍  a
  //    /   |      ⟍
  //   /    |        ⟍
  //  A --- D -------- B
  //        ↑
  //        The color we want to use as the base, which is a mix of A and B.
  //
  // Case 2:
  // If the distances between the source color, the 1st closest color (A) and
  // the 2nd closest color (B) form a triangle where EITHER angle A or B are
  // larger than 90 degrees, then we don’t care about point B because it’s
  // directionally the same as A, as mixing A and B can’t provide us with a
  // color that is any closer to the source. Example: source color is a
  // saturated blue, with "blue" being the closest scale, and "indigo" just
  // being further.
  //
  //  C ← Source color
  //   \⟍
  //    \  ⟍
  //     \    ⟍  a
  //    b \      ⟍
  //       \        ⟍
  //        A ------- B
  //        ↑
  //        The color we want to use as the base, which is not influenced by B.

  // We’ll need all the lengths of the triangle sides, named after the angles
  // they look at:
  const a = colorB.distance;
  const b = colorA.distance;
  const c = colorA.color.deltaEOK(colorB.color);

  // We can get the ratios of AD to BD lengths with trigonometry using tangents,
  // as the ratio of the tangents of the opposite angles will match.
  const cosA = (b ** 2 + c ** 2 - a ** 2) / (2 * b * c);
  const radA = Math.acos(cosA);
  const sinA = Math.sin(radA);

  const cosB = (a ** 2 + c ** 2 - b ** 2) / (2 * a * c);
  const radB = Math.acos(cosB);
  const sinB = Math.sin(radB);

  // Tangent of angle C in the ACD triangle
  const tanC1 = cosA / sinA;

  // Tangent of angle C in the BCD triangle
  const tanC2 = cosB / sinB;

  // The ratio of the tangents corresponds to the ratio of the distances AD to
  // BD. In the end, it means how much of scale B we want to mix into scale A.
  // If it’s "0" or less, this is an obtuse triangle from case 2, and we use
  // just scale A.
  const ratio = Math.max(0, tanC1 / tanC2) * 0.5;

  // The base scale is going to be a mix of the two closest scales, with the mix
  // ratio we determined before
  const scaleA = referenceColors[colorA.scale];
  const scaleB = referenceColors[colorB.scale];
  const scale = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) =>
    Color.mix(scaleA[i], scaleB[i], ratio, { space: 'oklch' })
  );

  // Get the closest color from the pre-mixed scale we created
  const baseColor = scale
    .slice()
    .sort((a, b) => source.deltaEOK(a) - source.deltaEOK(b))[0];

  // Adjust chroma and hue of the scale
  const sourceC = source.c;
  const sourceH = source.h;
  const baseColorC = baseColor.c;
  const canAdjustChroma =
    sourceC !== null && baseColorC !== null && baseColorC !== 0;
  const ratioC = canAdjustChroma ? sourceC / baseColorC : 1;

  scale.forEach((color) => {
    if (color.c !== null && sourceC !== null) {
      color.c = Math.min(sourceC * 1.5, color.c * ratioC);
    }

    if (sourceH !== null) {
      color.h = sourceH;
    }
  });

  // Light mode
  if (scale[0].l && scale[0].l > 0.5) {
    const lightnessScale = scale.map((color) => {
      if (color.l === null) {
        throw Error('Color is missing Oklch coords');
      }

      return color.l;
    });

    if (backgroundColor.l === null) {
      throw Error('Color is missing Oklch coords');
    }

    const backgroundL = Math.max(0, Math.min(1, backgroundColor.l));
    const newLightnessScale = transposeProgressionStart(
      backgroundL,
      // Add white as the first "step" of the light scale
      [1, ...lightnessScale],
      lightModeEasing
    );

    // Remove the step we added
    newLightnessScale.shift();

    newLightnessScale.forEach((lightness, i) => {
      scale[i].l = lightness;
    });

    return scale;
  }

  // Dark mode
  const ease: typeof darkModeEasing = [...darkModeEasing];
  const referenceBackgroundColorL = scale[0].l;

  if (referenceBackgroundColorL === null || backgroundColor.l === null) {
    throw Error('Color is missing Oklch coords');
  }

  const backgroundColorL = Math.max(0, Math.min(1, backgroundColor.l));

  // If background is lighter than step 0, we want to gradually change the
  // easing to linear
  const ratioL = backgroundColorL / referenceBackgroundColorL;

  if (ratioL > 1) {
    const maxRatio = 1.5;

    for (let i = 0; i < ease.length; i++) {
      const metaRatio = (ratioL - 1) * (maxRatio / (maxRatio - 1));
      ease[i] = ratioL > maxRatio ? 0 : Math.max(0, ease[i] * (1 - metaRatio));
    }
  }

  const lightnessScale = scale.map((color) => {
    if (color.l === null) {
      throw Error('Color is missing Oklch coords');
    }

    return color.l;
  });
  const backgroundL = backgroundColor.l;
  const newLightnessScale = transposeProgressionStart(
    backgroundL,
    lightnessScale,
    ease
  );

  newLightnessScale.forEach((lightness, i) => {
    scale[i].l = lightness;
  });

  return scale;
};

const getTextColor = (background: Color) => {
  const white = new Color('oklch', [1, 0, 0]);

  if (Math.abs(white.contrastAPCA(background)) < 40) {
    const [_, C, H] = background.coords;
    if (C === null) {
      throw Error('Color is missing Oklch coords');
    }

    return new Color('oklch', [0.25, Math.max(0.08 * C, 0.04), H ?? 0]);
  }

  return white;
};

// target = background * (1 - alpha) + (foreground * alpha)
// alpha = (target - background) / (foreground - background)
// Expects 0-1 numbers for the RGB channels
const getAlphaColor = (
  targetRgb: Coords,
  backgroundRgb: Coords,
  rgbPrecision: number,
  alphaPrecision: number,
  targetAlpha?: number
) => {
  const [tr, tg, tb] = targetRgb.map((coord) => {
    if (coord === null) {
      throw Error('Color is missing RGB coords');
    }

    return Math.round(coord * rgbPrecision);
  });
  const [br, bg, bb] = backgroundRgb.map((coord) => {
    if (coord === null) {
      throw Error('Color is missing RGB coords');
    }

    return Math.round(coord * rgbPrecision);
  });

  if (
    tr === undefined ||
    tg === undefined ||
    tb === undefined ||
    br === undefined ||
    bg === undefined ||
    bb === undefined
  ) {
    throw Error('Color is undefined');
  }

  // Is the background color lighter, RGB-wise, than target color?
  // Decide whether we want to add as little color or as much color as possible,
  // darkening or lightening the background respectively.
  // If at least one of the bits of the target RGB value
  // is lighter than the background, we want to lighten it.
  let desiredRgb = 0;
  if (tr > br) {
    desiredRgb = rgbPrecision;
  } else if (tg > bg) {
    desiredRgb = rgbPrecision;
  } else if (tb > bb) {
    desiredRgb = rgbPrecision;
  }

  const alphaR = (tr - br) / (desiredRgb - br);
  const alphaG = (tg - bg) / (desiredRgb - bg);
  const alphaB = (tb - bb) / (desiredRgb - bb);

  const isPureNeutral = [alphaR, alphaG, alphaB].every(
    (alpha) => alpha === alphaR
  );

  // No need for precision gymnastics with pure neutrals, and we can get cleaner
  // output
  if (!targetAlpha && isPureNeutral) {
    // Convert back to 0-1 values
    const V = desiredRgb / rgbPrecision;
    return [V, V, V, alphaR] as const;
  }

  const clampRgb = (n: number) =>
    isNaN(n) ? 0 : Math.min(rgbPrecision, Math.max(0, n));
  const clampA = (n: number) =>
    isNaN(n) ? 0 : Math.min(alphaPrecision, Math.max(0, n));
  const maxAlpha = targetAlpha ?? Math.max(alphaR, alphaG, alphaB);

  const A = clampA(Math.ceil(maxAlpha * alphaPrecision)) / alphaPrecision;
  let R = clampRgb(((br * (1 - A) - tr) / A) * -1);
  let G = clampRgb(((bg * (1 - A) - tg) / A) * -1);
  let B = clampRgb(((bb * (1 - A) - tb) / A) * -1);

  R = Math.ceil(R);
  G = Math.ceil(G);
  B = Math.ceil(B);

  const blendedR = blendAlpha(R, A, br);
  const blendedG = blendAlpha(G, A, bg);
  const blendedB = blendAlpha(B, A, bb);

  // Correct for rounding errors in light mode
  if (desiredRgb === 0) {
    if (tr <= br && tr !== blendedR) {
      R = tr > blendedR ? R + 1 : R - 1;
    }

    if (tg <= bg && tg !== blendedG) {
      G = tg > blendedG ? G + 1 : G - 1;
    }

    if (tb <= bb && tb !== blendedB) {
      B = tb > blendedB ? B + 1 : B - 1;
    }
  }

  // Correct for rounding errors in dark mode
  if (desiredRgb === rgbPrecision) {
    if (tr >= br && tr !== blendedR) {
      R = tr > blendedR ? R + 1 : R - 1;
    }

    if (tg >= bg && tg !== blendedG) {
      G = tg > blendedG ? G + 1 : G - 1;
    }

    if (tb >= bb && tb !== blendedB) {
      B = tb > blendedB ? B + 1 : B - 1;
    }
  }

  // Convert back to 0-1 values
  R = R / rgbPrecision;
  G = G / rgbPrecision;
  B = B / rgbPrecision;

  return [R, G, B, A] as const;
};

// Important – I empirically discovered that this rounding is how the browser
// actually overlays transparent RGB bits over each other. It does NOT round the
// whole result altogether.
const blendAlpha = (
  foreground: number,
  alpha: number,
  background: number,
  round = true
) => {
  if (round) {
    return (
      Math.round(background * (1 - alpha)) + Math.round(foreground * alpha)
    );
  }

  return background * (1 - alpha) + foreground * alpha;
};

const getAlphaColorOklch = (
  targetColor: Color,
  backgroundColor: Color,
  targetAlpha?: number
) => {
  // Convert to sRGB for blending. We don't want to blend in the Oklch space
  // because it's not perceptually uniform.
  targetColor.toGamut('srgb');
  backgroundColor.toGamut('srgb');

  const [r, g, b, a] = getAlphaColor(
    targetColor.to('p3').coords,
    backgroundColor.to('p3').coords,
    255,
    1000,
    targetAlpha
  );

  return new Color('p3', [r, g, b], a).to('oklch').toString({ precision: 4 });
};

const transposeProgressionStart = (
  to: number,
  arr: number[],
  curve: [number, number, number, number]
) => {
  return arr.map((n, i, arr) => {
    const lastIndex = arr.length - 1;
    const diff = arr[0] - to;
    const fn = BezierEasing(...curve);
    return n - diff * fn(1 - i / lastIndex);
  });
};

const transposeProgressionEnd = (
  to: number,
  arr: number[],
  curve: [number, number, number, number]
) => {
  return arr.map((n, i, arr) => {
    const lastIndex = arr.length - 1;
    const diff = arr[lastIndex] - to;
    const fn = BezierEasing(...curve);
    return n - diff * fn(i / lastIndex);
  });
};
