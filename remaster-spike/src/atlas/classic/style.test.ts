import { describe, expect, it } from 'vitest';
import {
  expression,
  latest,
  validateStyleMin,
  type StylePropertySpecification,
} from '@maplibre/maplibre-gl-style-spec';
import type { LayerSpecification } from 'maplibre-gl';
import basemapManifest from '../../../../data/basemap-manifest.json';
import fontManifest from '../../../../data/map-fonts.json';
import { createRequire } from 'node:module';
import {
  AREA_TO_KM2,
  BASEMAP_LAYER,
  BASEMAP_MAXZOOM,
  BASEMAP_MINZOOM,
  BASEMAP_TILES,
  BORDER_ATTR,
  CAPITAL_ATTR,
  FALLBACK_WASH,
  GLYPHS_URL,
  RELIEF,
  CAPITAL_MINZOOM,
  COAST_ATTR,
  COLOR,
  DEFAULT_SETTINGS,
  FEATURE_STATE,
  FONTSTACK,
  LABEL_ATTR,
  LAYER,
  LOW_POWER_HIDDEN,
  MARKER,
  MIN_LABEL_PX,
  PLACE_KIND_SITE,
  SOURCE,
  WASHES,
  WATERLINE_MIN_KM2,
  buildLayers,
  classicAtlasStyle,
  dependencyTint,
  legendEntries,
  neatlineSvg,
  prefersLowPower,
  washFor,
  waterlineCount,
  waterlineMaxzoom,
  withDefaults,
  labelMinKm2,
  STATE_VARIABLE_ANCHORS,
  type ClassicStyleOptions,
  type MapSettings,
} from './index';

// T3's own style check (CommonJS, in the repo root).
const mapFonts = createRequire(import.meta.url)(
  '../../../../scripts/lib/map-fonts.js',
) as {
  checkStyleFontstacks(style: unknown, manifest: unknown): string[];
};

/* ---- Helpers: evaluate a layer property with MapLibre's own expression engine ---- */

type Props = Record<string, unknown>;
type Spec = Record<string, Record<string, StylePropertySpecification>>;
const spec = latest as unknown as Spec;
interface Ctx {
  zoom?: number;
  props?: Props;
  state?: Props;
  id?: number;
}

const layer = (layers: LayerSpecification[], id: string) => {
  const l = layers.find((x) => x.id === id);
  if (!l) throw new Error(`no layer ${id}`);
  return l as LayerSpecification & {
    paint?: Props;
    layout?: Props;
    filter?: unknown;
    minzoom?: number;
    maxzoom?: number;
  };
};

function evaluate(
  l: ReturnType<typeof layer>,
  kind: 'paint' | 'layout',
  prop: string,
  ctx: Ctx = {},
) {
  const value = (kind === 'paint' ? l.paint : l.layout)?.[prop];
  const propSpec = spec[`${kind}_${l.type}`][prop];
  const compiled = expression.createPropertyExpression(
    value,
    `${l.id}.${prop}`,
    propSpec,
  );
  if (compiled.result !== 'success')
    throw new Error(`${l.id}.${prop}: ${JSON.stringify(compiled.value)}`);
  const feature = {
    type: 'Polygon',
    properties: ctx.props ?? {},
    id: ctx.id,
  } as never;
  return compiled.value.evaluate(
    { zoom: ctx.zoom ?? 3 } as never,
    feature,
    (ctx.state ?? {}) as never,
  );
}

function passes(l: ReturnType<typeof layer>, ctx: Ctx = {}) {
  if (!l.filter) return true;
  const f = expression.createExpression(l.filter, `${l.id}.filter`, {
    type: 'boolean',
    'property-type': 'data-driven',
    expression: { interpolated: false, parameters: ['zoom', 'feature'] },
  } as never);
  if (f.result !== 'success')
    throw new Error(`${l.id} filter: ${JSON.stringify(f.value)}`);
  return f.value.evaluate(
    { zoom: ctx.zoom ?? 3 } as never,
    { type: 'Point', properties: ctx.props ?? {}, id: ctx.id } as never,
  );
}

const opts = (
  o: Omit<Partial<ClassicStyleOptions>, 'settings'> & {
    settings?: Partial<MapSettings>;
  } = {},
) => withDefaults({ ...o, settings: { ...DEFAULT_SETTINGS, ...o.settings } });
const layersFor = (o: Parameters<typeof opts>[0] = {}) => buildLayers(opts(o));
const km2 = (v: number) => v / AREA_TO_KM2;
const toHex = (c: { r: number; g: number; b: number }) =>
  `#${[c.r, c.g, c.b]
    .map((v) =>
      Math.round(v * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')
    .toUpperCase()}`;

/* ---- Spec validity ------------------------------------------------------------- */

describe('classicAtlasStyle', () => {
  const variants: [string, Parameters<typeof opts>[0]][] = [
    ['defaults', {}],
    ['selected', { selected: { id: 7, name: 'Ottoman Empire' } }],
    ['low power', { lowPower: true }],
    [
      'projector text, large, upper',
      {
        projectorText: true,
        settings: { textSize: 'large', textCase: 'upper' },
      },
    ],
    [
      'labels off, thick borders',
      {
        settings: {
          showLabels: false,
          borderThickness: 4,
          countryOpacity: 0.1,
        },
      },
    ],
  ];
  it.each(variants)(
    'validates against the MapLibre style spec (%s)',
    (_, o) => {
      const style = classicAtlasStyle(
        'https://example.test',
        { borders: '/b.geojson' },
        opts(o),
      );
      expect(validateStyleMin(style as never)).toEqual([]);
    },
  );

  it('uses only contract fontstacks', () => {
    const style =
      JSON.stringify(classicAtlasStyle('', {}, opts({ projectorText: true }))) +
      JSON.stringify(classicAtlasStyle('', {}, opts()));
    const stacks = new Set(
      [...style.matchAll(/"(Alegreya[^"]*|Atkinson[^"]*)"/g)].map((m) => m[1]),
    );
    for (const s of stacks) expect(Object.values(FONTSTACK)).toContain(s);
  });

  it('paints the ocean mask over every border layer, and labels last (plan §2.1 order)', () => {
    const ids = layersFor().map((l) => l.id);
    const at = (id: string) => ids.indexOf(id);
    for (const id of [
      LAYER.territoryFill,
      LAYER.dependencyHatch,
      LAYER.edgeBand,
      LAYER.selectedBand,
      LAYER.border,
      LAYER.selectedLine,
    ])
      expect(at(id)).toBeLessThan(at(LAYER.ocean));
    expect(at(LAYER.ocean)).toBeLessThan(at(LAYER.graticule));
    expect(at(LAYER.graticule)).toBeLessThan(at(LAYER.coast));
    expect(at(LAYER.coast)).toBeLessThan(at(LAYER.lakes));
    expect(at(LAYER.places)).toBeLessThan(at(LAYER.capitals));
    expect(at(LAYER.selectedCapital)).toBeLessThan(at(LAYER.stateLabels));
    expect(ids.at(-1)).toBe(LAYER.selectedCapitalMark);
  });
});

/* ---- Washes and dependencies ---------------------------------------------------- */

describe('washes', () => {
  it('maps wash index 0–11 onto the 12 washes and anything else to the fallback', () => {
    const fill = layer(layersFor(), LAYER.territoryFill);
    for (const c of [0, 5, 11])
      expect(
        toHex(evaluate(fill, 'paint', 'fill-color', { props: { c } })),
      ).toBe(WASHES[c].fill);
    for (const c of [12, 30, null])
      expect(
        toHex(evaluate(fill, 'paint', 'fill-color', { props: { c } })),
      ).toBe(FALLBACK_WASH.fill);
    expect(washFor(12).name).toBe('unknown');
    expect(washFor(-1).name).toBe('unknown');
    expect(washFor(2.5).name).toBe('unknown');
  });

  it('edges use the darker pigment of the same wash', () => {
    const band = layer(layersFor(), LAYER.edgeBand);
    expect(
      toHex(evaluate(band, 'paint', 'line-color', { props: { c: 3 } })),
    ).toBe(WASHES[3].edge);
    expect(evaluate(band, 'paint', 'line-offset', { zoom: 2 })).toBeLessThan(0); // inside the border
  });

  it('draws a dependency as a lighter tint of its overlord’s wash, with the overlord’s edge', () => {
    const l = layersFor();
    const dep = {
      c: 4,
      [BORDER_ATTR.dependency]: 1,
      [BORDER_ATTR.overlord]: 9,
      [BORDER_ATTR.overlordWash]: 9,
    };
    const tint = toHex(
      evaluate(layer(l, LAYER.territoryFill), 'paint', 'fill-color', {
        props: dep,
      }),
    );
    expect(tint).toBe(dependencyTint(WASHES[9]));
    const lum = (hex: string) =>
      [1, 3, 5].reduce((s, i) => s + parseInt(hex.slice(i, i + 2), 16), 0);
    expect(lum(tint)).toBeGreaterThan(lum(WASHES[9].fill));
    expect(
      toHex(
        evaluate(layer(l, LAYER.edgeBand), 'paint', 'line-color', {
          props: dep,
        }),
      ),
    ).toBe(WASHES[9].edge);
  });

  it('hatches only dependencies, in the overlord’s pigment, and drops the hatch in low power', () => {
    const hatch = layer(layersFor(), LAYER.dependencyHatch);
    expect(passes(hatch, { props: { c: 1 } })).toBe(false);
    expect(passes(hatch, { props: { c: 1, dep: 1, oc: 2 } })).toBe(true);
    expect(
      evaluate(hatch, 'paint', 'fill-pattern', { props: { dep: 1, oc: 2 } }),
    ).toMatchObject({ name: `${MARKER.hatchPrefix}2` });
    expect(
      evaluate(hatch, 'paint', 'fill-pattern', { props: { dep: 1, oc: 12 } }),
    ).toMatchObject({ name: `${MARKER.hatchPrefix}x` });
    expect(
      layer(layersFor({ lowPower: true }), LAYER.dependencyHatch).layout
        ?.visibility,
    ).toBe('none');
  });

  it('selecting an overlord lightly emphasises its dependencies (feature-state, paint only)', () => {
    const l = layersFor({ settings: { countryOpacity: 0.7 } });
    const fill = layer(l, LAYER.territoryFill);
    const line = layer(l, LAYER.selectedLine);
    const base = evaluate(fill, 'paint', 'fill-opacity');
    const emph = evaluate(fill, 'paint', 'fill-opacity', {
      state: { [FEATURE_STATE.overlordSelected]: true },
    });
    const sel = evaluate(fill, 'paint', 'fill-opacity', {
      state: { [FEATURE_STATE.selected]: true },
    });
    expect(base).toBeLessThan(emph);
    expect(emph).toBeLessThan(sel);
    expect(evaluate(line, 'paint', 'line-opacity')).toBe(0);
    const depLine = evaluate(line, 'paint', 'line-width', {
      zoom: 4,
      state: { overlordSelected: true },
    });
    const selLine = evaluate(line, 'paint', 'line-width', {
      zoom: 4,
      state: { selected: true },
    });
    expect(depLine).toBeGreaterThan(0);
    expect(depLine).toBeLessThan(selLine / 2);
  });
});

/* ---- Settings → style expressions ---------------------------------------------- */

describe('settings mapping', () => {
  const fillOp = (countryOpacity: number, state: Props = {}) =>
    evaluate(
      layer(layersFor({ settings: { countryOpacity } }), LAYER.territoryFill),
      'paint',
      'fill-opacity',
      { state },
    );

  it('maps the default 0.7 opacity to the mock’s 62% and scales linearly', () => {
    expect(fillOp(0.7)).toBeCloseTo(0.62, 3);
    expect(fillOp(0.35)).toBeCloseTo(0.31, 3);
    expect(fillOp(1)).toBeCloseTo(0.886, 3);
    expect(fillOp(0.7, { selected: true })).toBeCloseTo(0.92, 3);
    expect(fillOp(1, { selected: true })).toBe(1);
  });

  it('maps border thickness 0–4 onto the ink border, default 2 = mock 0.5–1.1 px', () => {
    const w = (borderThickness: number, zoom: number) =>
      evaluate(
        layer(layersFor({ settings: { borderThickness } }), LAYER.border),
        'paint',
        'line-width',
        { zoom },
      );
    expect(w(2, 2)).toBeCloseTo(0.5);
    expect(w(2, 6)).toBeCloseTo(1.1);
    expect(w(4, 6)).toBeCloseTo(2.2);
    expect(w(0, 6)).toBe(0);
  });

  it('never thins the selection line below the mock, but thickens it with the setting', () => {
    const w = (borderThickness: number) =>
      evaluate(
        layer(layersFor({ settings: { borderThickness } }), LAYER.selectedLine),
        'paint',
        'line-width',
        { zoom: 6, state: { selected: true } },
      );
    expect(w(0)).toBeCloseTo(3);
    expect(w(2)).toBeCloseTo(3);
    expect(w(4)).toBeCloseTo(6);
  });

  const stateSize = (
    o: Parameters<typeof opts>[0],
    areaKm2: number,
    zoom: number,
    name = 'X',
  ) =>
    evaluate(layer(layersFor(o), LAYER.stateLabels), 'layout', 'text-size', {
      zoom,
      props: { [LABEL_ATTR.name]: name, [LABEL_ATTR.area]: km2(areaKm2) },
    });

  it('sizes state labels by area and zoom, and the text-size setting scales them', () => {
    expect(stateSize({}, 1e4, 2)).toBe(13);
    expect(stateSize({}, 4e6, 2)).toBe(21);
    expect(stateSize({}, 4e6, 5)).toBeCloseTo(32.6, 1);
    expect(stateSize({ settings: { textSize: 'large' } }, 4e6, 2)).toBeCloseTo(
      27.3,
      1,
    );
    expect(stateSize({ settings: { textSize: 'small' } }, 1e5, 2)).toBeCloseTo(
      13.1,
      1,
    );
  });

  it('keeps every map label at or above the projector minimum, at every setting', () => {
    for (const textSize of ['small', 'medium', 'large'] as const) {
      expect(
        stateSize({ settings: { textSize } }, 1, 2),
      ).toBeGreaterThanOrEqual(MIN_LABEL_PX);
      const places = layer(layersFor({ settings: { textSize } }), LAYER.places);
      expect(evaluate(places, 'layout', 'text-size')).toBeGreaterThanOrEqual(
        MIN_LABEL_PX,
      );
    }
  });

  it('gives the selected territory a fixed larger size, bold small caps and madder ink', () => {
    const sel = { selected: { id: 3, name: 'Ottoman Empire' } };
    expect(stateSize(sel, 1e4, 2, 'Ottoman Empire')).toBe(18);
    expect(stateSize(sel, 1e4, 5, 'Ottoman Empire')).toBe(28);
    const l = layer(layersFor(sel), LAYER.stateLabels);
    const props = {
      [LABEL_ATTR.name]: 'Ottoman Empire',
      [LABEL_ATTR.area]: km2(100),
    };
    expect(evaluate(l, 'layout', 'text-font', { props })).toEqual([
      FONTSTACK.stateBold,
    ]);
    expect(toHex(evaluate(l, 'paint', 'text-color', { props }))).toBe(
      COLOR.selectedInk,
    );
    expect(evaluate(l, 'layout', 'symbol-sort-key', { props })).toBe(-1e12);
    expect(passes(l, { zoom: 2, props })).toBe(true); // tiny but selected: still labelled
  });

  it('hides small territories at overview zooms only', () => {
    const l = layer(layersFor(), LAYER.stateLabels);
    const small = {
      props: { [LABEL_ATTR.name]: 'Small', [LABEL_ATTR.area]: km2(10000) },
    };
    expect(passes(l, { zoom: 3, ...small })).toBe(false);
    expect(passes(l, { zoom: 4.5, ...small })).toBe(true);
  });

  it('maps text case to text-transform and tracking', () => {
    const l = (o: Parameters<typeof opts>[0]) =>
      layer(layersFor(o), LAYER.stateLabels);
    expect(l({}).layout?.['text-transform']).toBe('none');
    expect(
      l({ settings: { textCase: 'upper' } }).layout?.['text-transform'],
    ).toBe('uppercase');
    const spacing = (o: Parameters<typeof opts>[0]) =>
      evaluate(l(o), 'layout', 'text-letter-spacing', {
        props: { a: km2(5e5) },
      });
    expect(spacing({ settings: { textCase: 'upper' } })).toBeCloseTo(
      spacing({}) + 0.04,
    );
  });

  it('Projector text swaps every map fontstack to Atkinson and uppercases states', () => {
    const l = layersFor({ projectorText: true });
    expect(layer(l, LAYER.stateLabels).layout?.['text-transform']).toBe(
      'uppercase',
    );
    const fonts = JSON.stringify(
      l
        .map((x) => (x as { layout?: Props }).layout?.['text-font'])
        .filter(Boolean),
    );
    expect(fonts).not.toMatch(/Alegreya/);
    expect(fonts).toMatch(FONTSTACK.projectorBold);
  });

  it('showLabels hides state names, places and capitals but keeps water names', () => {
    const l = layersFor({ settings: { showLabels: false } });
    for (const id of [
      LAYER.stateLabels,
      LAYER.viewportStateLabels,
      LAYER.places,
      LAYER.capitals,
      LAYER.selectedCapital,
      LAYER.selectedCapitalMark,
    ])
      expect(layer(l, id).layout?.visibility).toBe('none');
    expect(layer(l, LAYER.seaLabels).layout?.visibility).toBeUndefined();
  });
});

/* ---- Waterline rule (plan §9.2 P3) ---------------------------------------------- */

describe('waterline rule', () => {
  it('draws four lines below z3.5, two up to z5 and none from z5', () => {
    expect([1, 2, 3.49].map(waterlineCount)).toEqual([4, 4, 4]);
    expect([3.5, 4, 4.99].map(waterlineCount)).toEqual([2, 2, 2]);
    expect([5, 6, 10].map(waterlineCount)).toEqual([0, 0, 0]);
  });

  it('encodes the rule as exclusive layer maxzooms that agree with waterlineCount', () => {
    const l = layersFor();
    expect(
      [0, 1, 2, 3].map((i) => layer(l, LAYER.waterline(i)).maxzoom),
    ).toEqual([5, 5, 3.5, 3.5]);
    for (const zoom of [2, 3, 3.49, 3.5, 4.2, 4.99, 5, 7]) {
      const drawn = [0, 1, 2, 3].filter(
        (i) => zoom < (layer(l, LAYER.waterline(i)).maxzoom ?? 24),
      ).length;
      expect(drawn).toBe(waterlineCount(zoom));
    }
    expect(waterlineMaxzoom(4)).toBe(0);
  });

  it('ramps opacity down with zoom and fades seaward', () => {
    const l = layersFor();
    const op = (i: number, zoom: number) =>
      evaluate(layer(l, LAYER.waterline(i)), 'paint', 'line-opacity', { zoom });
    expect(op(0, 2)).toBeGreaterThan(op(0, 4));
    expect(op(0, 2)).toBeGreaterThan(op(1, 2));
    expect(op(1, 2)).toBeGreaterThan(op(3, 2));
    expect(op(0, 4.99)).toBeCloseTo(0.62 * 0.4, 2);
  });

  it('rings only landmasses of at least 5,000 km², offset seaward', () => {
    const w = layer(layersFor(), LAYER.waterline(0));
    expect(
      passes(w, { props: { [COAST_ATTR.landmassKm2]: WATERLINE_MIN_KM2 } }),
    ).toBe(true);
    expect(passes(w, { props: { [COAST_ATTR.landmassKm2]: 4999 } })).toBe(
      false,
    );
    expect(passes(w, { props: {} })).toBe(false);
    expect(w.paint?.['line-offset']).toBeGreaterThan(0);
    expect(
      passes(layer(layersFor(), LAYER.coast), {
        props: { [COAST_ATTR.landmassKm2]: 10 },
      }),
    ).toBe(true);
  });

  it('low power keeps one waterline only', () => {
    const l = layersFor({ lowPower: true });
    const visible = [0, 1, 2, 3].filter(
      (i) => layer(l, LAYER.waterline(i)).layout?.visibility !== 'none',
    );
    expect(visible).toEqual([0]);
  });
});

/* ---- Places, ruins, capitals ---------------------------------------------------- */

describe('places and capitals', () => {
  it('draws ruins with ∴, an italic face and “(ruins)”; cities with a dot', () => {
    const p = layer(layersFor(), LAYER.places);
    const site = {
      props: {
        [LABEL_ATTR.place]: 'Kaneš',
        [LABEL_ATTR.placeKind]: PLACE_KIND_SITE,
      },
    };
    const city = { props: { [LABEL_ATTR.place]: 'Vienna' } };
    expect(evaluate(p, 'layout', 'icon-image', site)).toMatchObject({
      name: MARKER.site,
    });
    expect(evaluate(p, 'layout', 'icon-image', city)).toMatchObject({
      name: MARKER.city,
    });
    expect(evaluate(p, 'layout', 'text-font', site)).toEqual([
      FONTSTACK.riverItalic,
    ]);
    expect(evaluate(p, 'layout', 'text-font', city)).toEqual([FONTSTACK.city]);
    expect(String(evaluate(p, 'layout', 'text-field', site))).toBe(
      'Kaneš (ruins)',
    );
  });

  it('shows the selected capital at every zoom and the others from CAPITAL_MINZOOM', () => {
    const l = layersFor({ selected: { id: 12, name: 'France' } });
    const others = layer(l, LAYER.capitals);
    const selected = layer(l, LAYER.selectedCapital);
    const mark = layer(l, LAYER.selectedCapitalMark);
    expect(others.minzoom).toBe(CAPITAL_MINZOOM);
    expect(selected.minzoom).toBeUndefined();
    expect(mark.layout?.['icon-ignore-placement']).toBe(true);
    const paris = { props: { name: 'Paris', t: 12 } };
    const berlin = { props: { name: 'Berlin', t: 4 } };
    expect([passes(selected, paris), passes(selected, berlin)]).toEqual([
      true,
      false,
    ]);
    expect([passes(others, paris), passes(others, berlin)]).toEqual([
      false,
      true,
    ]);
    expect(passes(layer(layersFor(), LAYER.selectedCapital), paris)).toBe(
      false,
    );
  });
});

/* ---- Low power, legend, neatline ------------------------------------------------ */

describe('low power', () => {
  it('only hides decorations, never content', () => {
    const content = [
      LAYER.territoryFill,
      LAYER.border,
      LAYER.selectedLine,
      LAYER.ocean,
      LAYER.coast,
      LAYER.stateLabels,
      LAYER.places,
    ];
    for (const id of content) expect(LOW_POWER_HIDDEN).not.toContain(id);
  });

  it('defaults on for software GL and small Chromebooks, off for capable devices', () => {
    expect(
      prefersLowPower({ renderer: 'ANGLE (Google, SwiftShader Device)' }),
    ).toBe(true);
    expect(prefersLowPower({ hardwareConcurrency: 4, deviceMemory: 4 })).toBe(
      true,
    );
    expect(
      prefersLowPower({
        hardwareConcurrency: 8,
        deviceMemory: 8,
        renderer: 'ANGLE Metal Renderer: Apple M4',
      }),
    ).toBe(false);
    expect(prefersLowPower({ hardwareConcurrency: 8, saveData: true })).toBe(
      true,
    );
  });
});

describe('legend metadata', () => {
  const none = {
    selected: false,
    dependency: false,
    overlordDependency: false,
    capital: false,
    city: false,
    site: false,
  };
  it('lists only the classes drawn', () => {
    expect(legendEntries(none)).toEqual([]);
    expect(
      legendEntries({ ...none, city: true, site: true }).map((e) => e.id),
    ).toEqual(['city', 'site']);
    expect(
      legendEntries({
        ...none,
        selected: true,
        overlordDependency: true,
        dependency: true,
        capital: true,
      }).map((e) => e.id),
    ).toEqual(['selected', 'overlord-dependency', 'dependency', 'capital']);
  });
  it('drops the hatch from the dependency swatch in low power', () => {
    const sym = (lowPower: boolean) =>
      legendEntries({ ...none, dependency: true, lowPower })[0].symbol;
    expect(sym(false)).toMatchObject({ hatch: true });
    expect(sym(true)).toMatchObject({ hatch: false });
  });
});

describe('neatline', () => {
  const base = {
    width: 400,
    height: 300,
    west: -12,
    east: 22,
    south: 31,
    north: 58,
    x: (l: number) => (l + 12) * 10,
    y: (l: number) => (58 - l) * 10,
  };
  it('alternates ink and paper every 5° with labels every 10° on larger screens', () => {
    const svg = neatlineSvg({ ...base, phone: false });
    expect(svg).toContain('10°E');
    expect(svg).toContain('40°N');
    expect(svg).toContain(COLOR.ink);
    expect(svg).toContain(COLOR.sheet);
  });
  it('is a single rule on phones', () => {
    const svg = neatlineSvg({ ...base, phone: true });
    expect(svg.match(/<rect/g)).toHaveLength(1);
    expect(svg).not.toContain('°');
  });
});

describe('contract', () => {
  it('keeps T1/T2 names in one place', () => {
    expect(SOURCE).toMatchObject({
      basemap: 'basemap',
      borders: 'borders',
      labels: 'labels',
      capitals: 'capitals',
    });
    expect(BORDER_ATTR).toEqual({
      wash: 'c',
      dependency: 'dep',
      overlord: 'ov',
      overlordWash: 'oc',
    });
    expect(LABEL_ATTR).toEqual({
      name: 'n',
      area: 'a',
      place: 'p',
      placeKind: 'k',
    });
    expect(CAPITAL_ATTR).toEqual({ name: 'name', territory: 't', qid: 'qid' });
    expect(AREA_TO_KM2).toBe(1);
  });

  it('matches T2’s basemap manifest and layer contract', () => {
    expect(BASEMAP_TILES).toBe(basemapManifest.tiles.url);
    expect([BASEMAP_MINZOOM, BASEMAP_MAXZOOM]).toEqual([
      basemapManifest.tiles.minzoom,
      basemapManifest.tiles.maxzoom,
    ]);
    expect(RELIEF.url).toBe(basemapManifest.relief.url);
    expect(RELIEF.coordinates).toEqual(basemapManifest.relief.coordinates);
    expect(Object.values(BASEMAP_LAYER).sort()).toEqual(
      Object.keys(basemapManifest.layers).sort(),
    );
    const used = new Set(
      layersFor()
        .map((l) => (l as { 'source-layer'?: string })['source-layer'])
        .filter(Boolean),
    );
    for (const sl of used)
      expect(Object.keys(basemapManifest.layers)).toContain(sl);
  });

  it('matches T3’s glyph manifest: URL, and every text-font a published single stack', () => {
    expect(GLYPHS_URL).toBe(fontManifest.glyphs.url);
    expect(Object.values(FONTSTACK).sort()).toEqual(
      Object.keys(fontManifest.glyphs.fontstacks).sort(),
    );
    const variants: Parameters<typeof opts>[0][] = [
      {},
      { selected: { id: 1, name: 'Ottoman Empire' } },
      {
        projectorText: true,
        settings: { textCase: 'upper', textSize: 'large' },
      },
      { lowPower: true, settings: { showLabels: false } },
    ];
    for (const o of variants) {
      const style = classicAtlasStyle('', {}, opts(o));
      expect(mapFonts.checkStyleFontstacks(style, fontManifest)).toEqual([]);
    }
  });
});

/* ---- Label priority (T7: state names beat city names) ---------------------------- */

describe('label priority', () => {
  const ids = () => layersFor().map((l) => l.id);
  const at = (id: string) => ids().indexOf(id);

  it('places every state-name layer before (above) every city and capital layer', () => {
    // MapLibre places symbol layers top-down: a higher layer claims space first.
    for (const state of [LAYER.stateLabels, LAYER.viewportStateLabels])
      for (const place of [
        LAYER.places,
        LAYER.capitals,
        LAYER.selectedCapital,
        LAYER.seaLabels,
        LAYER.riverLabels,
      ])
        expect(at(state)).toBeGreaterThan(at(place));
    // Names at their own points (and the selection) go before viewport anchors.
    expect(at(LAYER.stateLabels)).toBeGreaterThan(
      at(LAYER.viewportStateLabels),
    );
  });

  it('sorts larger territories first and the selection before all of them', () => {
    const key = (o: Parameters<typeof opts>[0], name: string, area: number) =>
      evaluate(
        layer(layersFor(o), LAYER.stateLabels),
        'layout',
        'symbol-sort-key',
        {
          props: { [LABEL_ATTR.name]: name, [LABEL_ATTR.area]: km2(area) },
        },
      ) as number;
    const russia = key({}, 'Russian Empire', 21356357);
    const austria = key({}, 'Austro-Hungarian Empire', 652005);
    const germany = key({}, 'German Empire', 520943);
    expect(russia).toBeLessThan(austria);
    expect(austria).toBeLessThan(germany);
    const sel = { selected: { id: 7, name: 'Luxembourg' } };
    expect(key(sel, 'Luxembourg', 2703)).toBeLessThan(
      key(sel, 'Russian Empire', 21356357),
    );
    // The viewport layer orders its anchors the same way.
    const v = layer(layersFor(), LAYER.viewportStateLabels);
    expect(v.layout?.['symbol-sort-key']).toEqual(
      layer(layersFor(), LAYER.stateLabels).layout?.['symbol-sort-key'],
    );
  });

  it('lets a colliding state name move one line up or down instead of dropping', () => {
    for (const id of [LAYER.stateLabels, LAYER.viewportStateLabels]) {
      const l = layer(layersFor(), id);
      expect(l.layout?.['text-variable-anchor']).toEqual([
        ...STATE_VARIABLE_ANCHORS,
      ]);
      expect(STATE_VARIABLE_ANCHORS[0]).toBe('center');
      expect(STATE_VARIABLE_ANCHORS).not.toContain('left');
    }
  });

  it('never draws a city dot without its name, or a name without its dot', () => {
    const p = layer(layersFor(), LAYER.places);
    expect(p.layout?.['text-optional']).toBe(false);
    expect(p.layout?.['icon-optional']).toBe(false);
    expect(p.layout?.['icon-allow-overlap']).toBeUndefined();
    expect(p.layout?.['text-allow-overlap']).toBeUndefined();
  });

  it('hides relocated territories at their own points only', () => {
    const russia = {
      id: 131,
      props: {
        [LABEL_ATTR.name]: 'Russian Empire',
        [LABEL_ATTR.area]: km2(2e7),
      },
    };
    const germany = {
      id: 133,
      props: {
        [LABEL_ATTR.name]: 'German Empire',
        [LABEL_ATTR.area]: km2(5e5),
      },
    };
    const l = layersFor({ relocatedLabels: [131] });
    for (const zoom of [2, 4.5, 6]) {
      expect(passes(layer(l, LAYER.stateLabels), { zoom, ...russia })).toBe(
        false,
      );
      expect(passes(layer(l, LAYER.stateLabels), { zoom, ...germany })).toBe(
        true,
      );
      expect(
        passes(layer(l, LAYER.viewportStateLabels), { zoom, ...russia }),
      ).toBe(true);
    }
    // A city point (no id, no name) is never a state name.
    expect(
      passes(layer(l, LAYER.stateLabels), {
        zoom: 6,
        props: { [LABEL_ATTR.place]: 'Prague' },
      }),
    ).toBe(false);
  });

  it('uses one area floor per zoom for the filter and for viewport anchors', () => {
    expect(labelMinKm2(2)).toBe(18000);
    expect(labelMinKm2(4.2)).toBe(4000);
    expect(labelMinKm2(6)).toBe(0);
    const l = layer(layersFor(), LAYER.stateLabels);
    for (const zoom of [2, 3.9, 4, 5, 5.5, 7]) {
      const floor = labelMinKm2(zoom);
      const props = (a: number) => ({
        props: { [LABEL_ATTR.name]: 'X', [LABEL_ATTR.area]: km2(a) },
      });
      expect(passes(l, { zoom, ...props(floor + 1) })).toBe(true);
      if (floor > 0) expect(passes(l, { zoom, ...props(floor) })).toBe(false);
    }
  });

  it('starts the viewport-anchor source empty, with no network request', () => {
    const style = classicAtlasStyle('https://example.test', {}, opts());
    expect(style.sources[SOURCE.viewportLabels]).toMatchObject({
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
  });
});
