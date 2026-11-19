/**
 * Perceptual colour difference for palette checks: CIELAB (D65) from sRGB hex
 * and the CIEDE2000 ΔE (Sharma, Wu and Dalal, 2005). Roughly, ΔE ≈ 1 is a
 * just-noticeable difference and ΔE > 10 reads as a different colour at a
 * glance. Used by the token tests; nothing at runtime depends on it.
 */

export type Lab = readonly [L: number, a: number, b: number];

/** CIELAB (D65 white) of an `#RRGGBB` sRGB colour. */
export function hexToLab(hex: string): Lab {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;
  const f = (t: number) =>
    t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116;
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

const RAD = Math.PI / 180;

/** CIEDE2000 colour difference of two CIELAB colours. */
export function deltaE2000Lab([L1, a1, b1]: Lab, [L2, a2, b2]: Lab): number {
  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const Cbar7 = ((C1 + C2) / 2) ** 7;
  const G = 0.5 * (1 - Math.sqrt(Cbar7 / (Cbar7 + 25 ** 7)));
  const ap1 = (1 + G) * a1;
  const ap2 = (1 + G) * a2;
  const Cp1 = Math.hypot(ap1, b1);
  const Cp2 = Math.hypot(ap2, b2);
  const hue = (b: number, a: number) => {
    if (a === 0 && b === 0) return 0;
    const h = Math.atan2(b, a) / RAD;
    return h < 0 ? h + 360 : h;
  };
  const hp1 = hue(b1, ap1);
  const hp2 = hue(b2, ap2);
  const chromatic = Cp1 * Cp2 !== 0;

  const dL = L2 - L1;
  const dC = Cp2 - Cp1;
  let dh = 0;
  if (chromatic) {
    dh = hp2 - hp1;
    if (dh > 180) dh -= 360;
    else if (dh < -180) dh += 360;
  }
  const dH = 2 * Math.sqrt(Cp1 * Cp2) * Math.sin((dh / 2) * RAD);

  const Lbar = (L1 + L2) / 2;
  const Cpbar = (Cp1 + Cp2) / 2;
  let hbar = hp1 + hp2;
  if (chromatic) {
    if (Math.abs(hp1 - hp2) > 180) hbar += hbar < 360 ? 360 : -360;
    hbar /= 2;
  }
  const T =
    1 -
    0.17 * Math.cos((hbar - 30) * RAD) +
    0.24 * Math.cos(2 * hbar * RAD) +
    0.32 * Math.cos((3 * hbar + 6) * RAD) -
    0.2 * Math.cos((4 * hbar - 63) * RAD);
  const dTheta = 30 * Math.exp(-(((hbar - 275) / 25) ** 2));
  const Cpbar7 = Cpbar ** 7;
  const RC = 2 * Math.sqrt(Cpbar7 / (Cpbar7 + 25 ** 7));
  const SL = 1 + (0.015 * (Lbar - 50) ** 2) / Math.sqrt(20 + (Lbar - 50) ** 2);
  const SC = 1 + 0.045 * Cpbar;
  const SH = 1 + 0.015 * Cpbar * T;
  const RT = -Math.sin(2 * dTheta * RAD) * RC;

  return Math.sqrt(
    (dL / SL) ** 2 +
      (dC / SC) ** 2 +
      (dH / SH) ** 2 +
      RT * (dC / SC) * (dH / SH),
  );
}

/** CIEDE2000 colour difference of two `#RRGGBB` colours. */
export const deltaE2000 = (a: string, b: string) =>
  deltaE2000Lab(hexToLab(a), hexToLab(b));
