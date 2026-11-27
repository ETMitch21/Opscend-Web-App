import Color from 'colorjs.io';

export type Scheme = 'light' | 'dark' | 'system';
export type Theme = {
  primary: string;
  error: string;
  neutral: string;
};

export type ThemeConfig = Theme & {
  scheme: Scheme;
  borderRadius?: string;
};

export type ReferenceColors = {
  chromatic: {
    light: Record<string, Color[]>;
    dark: Record<string, Color[]>;
  };
  neutral: {
    light: Record<string, Color[]>;
    dark: Record<string, Color[]>;
  };
};

// prettier-ignore
export type Hue = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | '11' | '12';
export type AlphaHue = `a${Hue}`;
export type BaseColors = Record<Hue, string>;
export type AlphaColors = Record<AlphaHue, string>;
export type SurfaceColor = Record<'surface', string>;
export type ContrastColor = Record<'contrast', string>;

export type Palette = {
  background: string;
  primary: BaseColors & AlphaColors & SurfaceColor & ContrastColor;
  error: BaseColors & AlphaColors & SurfaceColor & ContrastColor;
  neutral: BaseColors & AlphaColors & SurfaceColor;
};

export type Palettes = {
  source: {
    primary: string;
    error: string;
    neutral: string;
  };
  light: Palette;
  dark: Palette;
};
