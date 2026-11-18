/**
 * Low-power rule, from the per-decoration profile in
 * docs/product/style-review/README.md. When `lowPower` is on:
 * - these map layers are hidden (visibility `none`, so they cost nothing to draw);
 * - the paper grain overlay is not attached;
 * - the degree-ladder neatline collapses to the single rule phones use.
 * Edge bands, relief, the graticule and the selection always stay.
 */
import { LAYER } from './contract';

export const LOW_POWER_HIDDEN: readonly string[] = [
  LAYER.dependencyHatch,
  LAYER.waterline(1),
  LAYER.waterline(2),
  LAYER.waterline(3),
];

/** The paper grain is a DOM overlay, not a map layer; skip it in low-power mode. */
export const LOW_POWER_DROPS_GRAIN = true;

/** The neatline's ladder repaints an SVG while panning; low-power mode draws the single rule. */
export const LOW_POWER_SIMPLE_NEATLINE = true;

interface DeviceHints {
  hardwareConcurrency?: number;
  deviceMemory?: number;
  /** `WEBGL_debug_renderer_info` renderer string, when exposed. */
  renderer?: string;
  saveData?: boolean;
  reducedTransparency?: boolean;
}

/** Software rasterisers, where every fragment is CPU work. */
const SOFTWARE_GL = /swiftshader|llvmpipe|software|basic render/i;

/**
 * Heuristic default for `lowPower`. Users and the app can always override it.
 * True for software GL, for ≤ 4 cores with ≤ 4 GB (typical school Chromebooks),
 * for Save-Data, and when the user asks for reduced transparency.
 */
export function prefersLowPower(h: DeviceHints): boolean {
  if (h.renderer && SOFTWARE_GL.test(h.renderer)) return true;
  if (h.saveData || h.reducedTransparency) return true;
  const cores = h.hardwareConcurrency ?? 8;
  const memory = h.deviceMemory ?? 8;
  return cores <= 4 && memory <= 4;
}

/** Reads `prefersLowPower` hints from the browser. */
export function detectLowPower(gl?: WebGL2RenderingContext | null): boolean {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean };
  };
  let renderer: string | undefined;
  try {
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    if (gl && ext)
      renderer = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL));
  } catch {
    renderer = undefined;
  }
  return prefersLowPower({
    hardwareConcurrency: nav.hardwareConcurrency,
    deviceMemory: nav.deviceMemory,
    renderer,
    saveData: nav.connection?.saveData,
    reducedTransparency:
      typeof matchMedia === 'function' &&
      matchMedia('(prefers-reduced-transparency: reduce)').matches,
  });
}
