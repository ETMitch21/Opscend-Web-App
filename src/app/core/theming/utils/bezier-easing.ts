/**
 * https://github.com/gre/bezier-easing
 * BezierEasing - use bezier curve for transition easing function
 * by Gaëtan Renaudeau 2014 - 2015 – MIT License
 *
 * Algebraic solver by Dmitry Baranovskiy
 * http://dmitry.baranovskiy.com/bezier-easing.html
 */

const { cbrt, sqrt, PI: pi } = Math;

// Cardano loses precision as a approaches zero; below this, solve as quadratic
const DEGENERATE_EPSILON = 5e-5;

const LinearEasing = (x: number) => x;

const x2t = (x: number, a: number, b: number, c: number, d: number) => {
  const q = a + b * x;
  const s = q ** 2 + c;

  if (s > 0) {
    const root = sqrt(s);
    return cbrt(q + root) + cbrt(q - root) - d;
  }

  const l = cbrt(sqrt(q * q - s));
  const angle = q ? Math.atan(sqrt(-s) / q) : -pi / 2;

  let phi: number;
  if (b < 0) {
    phi = (q > 0 ? 2 * pi : pi) - angle;
  } else if (d < 0) {
    phi = (q > 0 ? 2 * pi : -3 * pi) + angle;
  } else {
    phi = (q > 0 ? 0 : pi) + angle;
  }

  return 2 * l * Math.cos(phi / 3) - d;
};

const Y = (t: number, ay: number, by: number, cy: number) =>
  ((ay * t + 3 * by) * t + cy) * t;

const BezierEasing = (mX1: number, mY1: number, mX2: number, mY2: number) => {
  if (!(0 <= mX1 && mX1 <= 1 && 0 <= mX2 && mX2 <= 1)) {
    throw new Error('bezier x values must be in [0, 1] range');
  }

  if (mX1 === mY1 && mX2 === mY2) {
    return LinearEasing;
  }

  const a = 6 * (3 * mX1 - 3 * mX2 + 1);

  const ay = 3 * mY1 - 3 * mY2 + 1;
  const by = mY2 - 2 * mY1;
  const cy = 3 * mY1;

  if (Math.abs(a) < DEGENERATE_EPSILON) {
    const B = 3 * mX2 - 6 * mX1;
    const C = 3 * mX1;
    const q2t: (x: number) => number = B
      ? (x) => (sqrt(C * C + 4 * B * x) - C) / (2 * B)
      : (x) => x / C;

    return (x: number): number => {
      if (x === 0 || x === 1) {
        return x;
      }

      return Y(q2t(x), ay, by, cy);
    };
  }

  const b = 6 * (mX2 - 2 * mX1);
  const c = 3 * mX1;

  const a2 = a * a;
  const b2 = b * b;

  const d = b / a;
  const e = (3 * b * c) / a2 - (b2 * b) / (a2 * a);
  const w1 = (2 * c) / a - b2 / a2;
  const w = w1 * w1 * w1;
  const o = 3 / a;

  return (x: number): number => {
    if (x === 0 || x === 1) {
      return x;
    }

    return Y(x2t(x, e, o, w, d), ay, by, cy);
  };
};

export { BezierEasing };
