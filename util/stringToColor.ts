export function stringToBrightHexColor(inputString: string): string {
  const hash = (str: string): number => {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
    }
    return h;
  };

  const isValidColor = (r: number, g: number, b: number): boolean => {
    const minBrightness = 190;
    const minDiff = 30;
    const colorDifference = (x: number, y: number, z: number) =>
      Math.abs(x - y) + Math.abs(x - z) + Math.abs(y - z);
    return (
      r > minBrightness ||
      g > minBrightness ||
      (b > minBrightness && colorDifference(r, g, b) > minDiff)
    );
  };

  let h = hash(inputString);
  let r, g, b;

  do {
    r = (h >> 8) & 0xff;
    g = (h >> 16) & 0xff;
    b = (h >> 24) & 0xff;
    h = (Math.imul(31, h) + 1) | 0;
  } while (!isValidColor(r, g, b));

  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

export function stringToVibrantHexColor(inputString: string): string {
  const hash = (str: string): number => {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
    }
    return h;
  };

  const rgbToHsv = (
    r: number,
    g: number,
    b: number,
  ): [number, number, number] => {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const diff = max - min;
    const h =
      diff === 0
        ? 0
        : max === r
        ? ((g - b) / diff) % 6
        : max === g
        ? (b - r) / diff + 2
        : (r - g) / diff + 4;
    const s = max === 0 ? 0 : diff / max;
    const v = max / 255;
    return [h * 60, s, v];
  };

  const isValidColor = (r: number, g: number, b: number): boolean => {
    const minSaturation = 0.7;
    const minBrightness = 0.4;
    const [, s, v] = rgbToHsv(r, g, b);
    return s > minSaturation && v > minBrightness;
  };

  let h = hash(inputString);
  let r, g, b;

  do {
    r = (h >> 8) & 0xff;
    g = (h >> 16) & 0xff;
    b = (h >> 24) & 0xff;
    h = (Math.imul(31, h) + 1) | 0;
  } while (!isValidColor(r, g, b));

  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

export function stringToVibrantHexColor2(input: string): string {
  const minBrightness = 127;
  const minColorDifference = 80;

  function hashString(input: string): number {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
  }

  function adjustColorComponent(colorComponent: number): number {
    return minBrightness + (colorComponent % (256 - minBrightness));
  }

  function adjustColorDifference(
    r: number,
    g: number,
    b: number,
  ): [number, number, number] {
    if (Math.abs(r - g) < minColorDifference) {
      g = (g + minColorDifference) % 256;
    }
    if (Math.abs(r - b) < minColorDifference) {
      b = (b + minColorDifference) % 256;
    }
    if (Math.abs(g - b) < minColorDifference) {
      b = (b + minColorDifference) % 256;
    }
    return [r, g, b];
  }

  const hash = hashString(input);
  let r = adjustColorComponent((hash & 0xff0000) >> 16);
  let g = adjustColorComponent((hash & 0x00ff00) >> 8);
  let b = adjustColorComponent(hash & 0x0000ff);

  [r, g, b] = adjustColorDifference(r, g, b);

  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}
