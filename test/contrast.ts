/**
 * WCAG 2.2 contrast checks for CSS design tokens.
 *
 * `readTokens` extracts custom properties from the first `:root { … }` block
 * of a stylesheet (or an HTML file's inline <style>), resolving `var()`
 * references. Token pairs are then checked with `contrastRatio`, compositing
 * translucent colours over their backdrop first. The same helpers check
 * today's `styles/index.css` and Direction A's tokens; the remaster's token
 * file only needs a new pair list.
 */

export type Rgba = { r: number; g: number; b: number; a: number };

/** AA thresholds: normal text, and large text or meaningful graphics. */
export const AA_TEXT = 4.5;
export const AA_LARGE_OR_GRAPHIC = 3;

const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

/** Reads `--name: value` declarations from the first :root block. */
export function readTokens(css: string): Record<string, string> {
  const source = stripComments(css);
  const start = source.search(/:root\s*\{/);
  if (start < 0) throw new Error('No :root block found');
  const open = source.indexOf('{', start);
  let depth = 0;
  let end = open;
  for (; end < source.length; end += 1) {
    if (source[end] === '{') depth += 1;
    if (source[end] === '}' && --depth === 0) break;
  }
  const block = source.slice(open + 1, end);
  const tokens: Record<string, string> = {};
  for (const match of block.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
    tokens[match[1]] = match[2].trim();
  }
  return tokens;
}

/** Resolves a token name (without `--`) to a literal value. */
export function resolveToken(
  tokens: Record<string, string>,
  name: string,
  seen = new Set<string>(),
): string {
  if (seen.has(name)) throw new Error(`Circular token --${name}`);
  const value = tokens[name];
  if (value === undefined) throw new Error(`Unknown token --${name}`);
  seen.add(name);
  return value.replace(/var\(\s*--([\w-]+)\s*(?:,[^)]*)?\)/g, (_m, ref) =>
    resolveToken(tokens, ref, seen),
  );
}

export function parseColor(value: string): Rgba {
  const color = value.trim().toLowerCase();
  const hex = color.match(/^#([0-9a-f]{3,8})$/);
  if (hex) {
    let digits = hex[1];
    if (digits.length === 3 || digits.length === 4) {
      digits = [...digits].map((d) => d + d).join('');
    }
    if (digits.length !== 6 && digits.length !== 8) {
      throw new Error(`Unsupported hex colour ${value}`);
    }
    const n = (i: number) => parseInt(digits.slice(i, i + 2), 16);
    return {
      r: n(0),
      g: n(2),
      b: n(4),
      a: digits.length === 8 ? n(6) / 255 : 1,
    };
  }
  const rgb = color.match(/^rgba?\(([^)]+)\)$/);
  if (rgb) {
    const parts = rgb[1].split(/[\s,/]+/).filter(Boolean);
    const [r, g, b] = parts.slice(0, 3).map(Number);
    const alpha = parts[3];
    const a =
      alpha === undefined
        ? 1
        : alpha.endsWith('%')
          ? Number(alpha.slice(0, -1)) / 100
          : Number(alpha);
    if ([r, g, b, a].some(Number.isNaN)) {
      throw new Error(`Unsupported colour ${value}`);
    }
    return { r, g, b, a };
  }
  if (color === 'white') return { r: 255, g: 255, b: 255, a: 1 };
  if (color === 'black') return { r: 0, g: 0, b: 0, a: 1 };
  throw new Error(`Unsupported colour ${value}`);
}

/** Composites `top` over an opaque `bottom`. */
export function composite(top: Rgba, bottom: Rgba): Rgba {
  const mix = (t: number, b: number) => t * top.a + b * (1 - top.a);
  return {
    r: mix(top.r, bottom.r),
    g: mix(top.g, bottom.g),
    b: mix(top.b, bottom.b),
    a: 1,
  };
}

const channel = (value: number) => {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

export const relativeLuminance = ({ r, g, b }: Rgba) =>
  0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

export function contrastRatio(foreground: Rgba, background: Rgba) {
  const [light, dark] = [
    relativeLuminance(foreground),
    relativeLuminance(background),
  ].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

/**
 * A colour reference: a token name (`ink`), a literal (`#fff`), or a
 * translucent token laid over another (`accent-soft over surface`).
 */
export type ColorRef = string;

export function resolveColor(
  tokens: Record<string, string>,
  ref: ColorRef,
): Rgba {
  const [top, bottom] = ref.split(/\s+over\s+/);
  const read = (name: string) =>
    parseColor(
      name.startsWith('#') || /^rgba?\(/.test(name)
        ? name
        : resolveToken(tokens, name),
    );
  const color = read(top);
  if (bottom) return composite(color, resolveColor(tokens, bottom));
  if (color.a < 1) {
    throw new Error(`"${ref}" is translucent; say what it sits "over"`);
  }
  return color;
}

export type ContrastPair = {
  foreground: ColorRef;
  background: ColorRef;
  /** Defaults to AA for normal text (4.5:1). */
  minimum?: number;
  use?: string;
};

export type ContrastResult = ContrastPair & {
  ratio: number;
  minimum: number;
  passes: boolean;
};

export function checkPairs(
  tokens: Record<string, string>,
  pairs: ContrastPair[],
): ContrastResult[] {
  return pairs.map((pair) => {
    const minimum = pair.minimum ?? AA_TEXT;
    const ratio = contrastRatio(
      resolveColor(tokens, pair.foreground),
      resolveColor(tokens, pair.background),
    );
    return { ...pair, minimum, ratio, passes: ratio >= minimum };
  });
}

/** Every text token on every background token, at one threshold. */
export const allPairs = (
  foregrounds: ColorRef[],
  backgrounds: ColorRef[],
  minimum = AA_TEXT,
): ContrastPair[] =>
  foregrounds.flatMap((foreground) =>
    backgrounds.map((background) => ({ foreground, background, minimum })),
  );

export const describeResult = (result: ContrastResult) =>
  `${result.foreground} on ${result.background}: ${result.ratio.toFixed(2)}:1 (needs ${result.minimum}:1)`;
