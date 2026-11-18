/*
 * Shared plumbing for the three Living Atlas mock pages.
 * Each page supplies its own palette, style rules, markup and CSS; this file
 * only holds data plumbing that would be identical in production.
 */
(function () {
  'use strict';

  const HB = (window.HB = {});

  /* ---- Years and eras (mirrors lib/years.ts) ---------------------------- */
  HB.YEARS = [
    -123000, -10000, -8000, -5000, -4000, -3000, -2000, -1500, -1000, -700,
    -500, -400, -323, -300, -200, -100, -1, 100, 200, 300, 400, 500, 600, 700,
    800, 900, 1000, 1100, 1200, 1279, 1300, 1400, 1492, 1500, 1530, 1600, 1650,
    1700, 1715, 1783, 1800, 1815, 1880, 1900, 1914, 1920, 1930, 1938, 1945,
    1960, 1994, 2000, 2010,
  ];
  HB.ERAS = [
    { id: 'prehistory', label: 'Prehistory', short: 'Pre.', from: -Infinity, range: 'before 3000 BC' },
    { id: 'ancient', label: 'Ancient', short: 'Ancient', from: -3000, range: '3000 BC – AD 499' },
    { id: 'medieval', label: 'Medieval', short: 'Medieval', from: 500, range: '500 – 1499' },
    { id: 'early-modern', label: 'Early modern', short: 'Early', from: 1500, range: '1500 – 1799' },
    { id: 'modern', label: 'Modern', short: 'Modern', from: 1800, range: '1800 – today' },
  ];
  HB.eraOf = (year) => {
    for (let i = HB.ERAS.length - 1; i >= 0; i--) if (year >= HB.ERAS[i].from) return HB.ERAS[i];
    return HB.ERAS[0];
  };
  HB.eraSpans = (years) => {
    const spans = [];
    years.forEach((year, index) => {
      const era = HB.eraOf(year);
      const last = spans[spans.length - 1];
      if (last && last.era.id === era.id) last.count++;
      else spans.push({ era, start: index, count: 1 });
    });
    return spans;
  };
  const nf = new Intl.NumberFormat('en-US');
  HB.formatYear = (y) => (y < 0 ? `${nf.format(-y)} BC` : String(y));
  HB.rulerLabel = (y) => (y <= -10000 ? `${Math.round(-y / 1000)}k BC` : HB.formatYear(y));
  HB.yearParts = (y) => ({ value: y < 0 ? nf.format(-y) : String(y), suffix: y < 0 ? 'BC' : 'AD' });

  /* ---- Safe areas -------------------------------------------------------
   * Real devices supply env(safe-area-inset-*). For screenshots, ?safe=59,34
   * overrides the CSS variables and draws a simulated island and home bar.  */
  HB.applySafeAreaSimulation = () => {
    const match = /[?&]safe=(\d+),(\d+)/.exec(location.search);
    if (!match) return;
    const root = document.documentElement;
    root.style.setProperty('--safe-top', `${match[1]}px`);
    root.style.setProperty('--safe-bottom', `${match[2]}px`);
    root.dataset.safeSim = '';
    const chrome = document.createElement('div');
    chrome.className = 'sim-device';
    chrome.setAttribute('aria-hidden', 'true');
    chrome.innerHTML = '<span class="sim-device__island"></span><span class="sim-device__home"></span>';
    document.body.appendChild(chrome);
  };

  /* ---- Local protocol: glyphs and relief from embedded bundles ---------- */
  const b64ToBuffer = (b64) => {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  };
  HB.registerLocalProtocol = () => {
    maplibregl.addProtocol('local', async (params) => {
      const key = decodeURIComponent(params.url.replace('local://', ''));
      if (key.startsWith('glyphs/')) {
        const b64 = window.HB_GLYPHS[key.slice(7).replace(/\.pbf$/, '')];
        return { data: b64 ? b64ToBuffer(b64) : new ArrayBuffer(0) };
      }
      if (key === 'relief.webp') return { data: b64ToBuffer(window.HB_RELIEF.webp) };
      throw new Error(`Unknown local resource ${key}`);
    });
  };

  /* ---- Generated geometry ---------------------------------------------- */
  HB.graticule = (step = 10) => {
    const features = [];
    for (let lon = -180; lon <= 180; lon += step)
      features.push({ type: 'Feature', properties: { kind: 'meridian', value: lon }, geometry: { type: 'LineString', coordinates: [[lon, -80], [lon, 84]] } });
    for (let lat = -80; lat <= 80; lat += step) {
      const coordinates = [];
      for (let lon = -180; lon <= 180; lon += 5) coordinates.push([lon, lat]);
      features.push({ type: 'Feature', properties: { kind: lat === 0 ? 'equator' : 'parallel', value: lat }, geometry: { type: 'LineString', coordinates } });
    }
    return { type: 'FeatureCollection', features };
  };

  /** Sea and ocean label points; the Atlantic is moved into the European view. */
  HB.marine = () => ({
    type: 'FeatureCollection',
    features: window.HB_NE.marine.features.map((f) =>
      f.properties.name === 'North Atlantic Ocean'
        ? { ...f, properties: { ...f.properties, name: 'Atlantic Ocean' }, geometry: { type: 'Point', coordinates: [-19, 46] } }
        : f,
    ),
  });

  HB.reliefCoordinates = () => {
    const { north, south } = window.HB_RELIEF;
    return [[-180, north], [180, north], [180, south], [-180, south]];
  };

  /* ---- Palette remapping (mirrors lib/mapStyle.ts SOURCE_COLORS) --------- */
  HB.SOURCE_COLORS = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE',
    '#85C1E9', '#F8C471', '#82E0AA', '#F1C40F', '#E74C3C', '#3498DB', '#2ECC71',
    '#9B59B6', '#E67E22', '#1ABC9C', '#34495E', '#F39C12', '#D35400', '#27AE60',
    '#2980B9', '#8E44AD', '#16A085', '#F4D03F', '#58D68D', '#5DADE2', '#AF7AC5',
    '#F8D7DA', '#D5DBDB',
  ];
  /** palette: array of {fill, edge}; returns match expressions by key. */
  HB.colorMatch = (palette, key, fallback) => [
    'match',
    ['upcase', ['to-string', ['get', 'COLOR']]],
    ...HB.SOURCE_COLORS.flatMap((c, i) => [c, palette[i % palette.length][key]]),
    fallback,
  ];

  /** Label size by territory area (km²) and zoom: the atlas size hierarchy. */
  HB.areaSize = (sizes, { zooms = [2, 5], growth = 1.55, special } = {}) => {
    const byArea = (scale, i) => {
      const expr = [
        'interpolate', ['linear'], ['log10', ['max', ['get', 'AREA'], 1]],
        4, sizes[0] * scale, 5, sizes[1] * scale, 5.8, sizes[2] * scale, 6.6, sizes[3] * scale,
      ];
      // `special` gives the selected territory its own, larger size.
      return special ? ['match', ['get', 'NAME'], special.name, special.sizes[i], expr] : expr;
    };
    return ['interpolate', ['linear'], ['zoom'], zooms[0], byArea(1, 0), zooms[1], byArea(growth, 1)];
  };

  /* ---- Places -------------------------------------------------------------
   * The source has no rank, so the mock shows a curated set. Production needs
   * a rank and an explicit "archaeological site" class (see the UI review). */
  HB.CITIES = ['Constantinople', 'Vienna', 'Kyiv', 'Genoa', 'Athens', 'Aleppo', 'Prague', 'Novgorod', 'Medina', 'Tlemcen', 'Bolghar', 'Ankara', 'Luxor', 'Kaneš', 'Ziz,  Palermo', 'Beirut'];
  HB.RUINS = ['Kaneš'];
  // The selected territory's capital gets its own top-priority layer in each page.
  HB.placeFilter = ['all', ['in', ['get', 'name'], ['literal', HB.CITIES]], ['!=', ['get', 'name'], 'Constantinople']];
  HB.placeKind = ['case', ['==', ['get', 'name'], 'Constantinople'], 'capital', ['in', ['get', 'name'], ['literal', HB.RUINS]], 'ruin', 'city'];
  HB.placeName = ['match', ['get', 'name'], 'Ziz,  Palermo', 'Palermo', 'Kaneš', 'Kaneš (ruins)', ['get', 'name']];

  /** Draws the city, capital and ruin markers so a dot never shows without its name. */
  HB.addMarkers = (map, { ink, paper, accent = ink, capital = 'ring' }) => {
    const make = (draw, size = 22) => {
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const g = c.getContext('2d');
      draw(g, size / 2);
      return { width: size, height: size, data: g.getImageData(0, 0, size, size).data };
    };
    const circle = (g, r, x, fill, stroke, w) => {
      g.beginPath(); g.arc(x, x, r, 0, Math.PI * 2);
      if (fill) { g.fillStyle = fill; g.fill(); }
      if (stroke) { g.lineWidth = w; g.strokeStyle = stroke; g.stroke(); }
    };
    map.addImage('m-city', make((g, x) => circle(g, 5.5, x, ink, paper, 2.6)), { pixelRatio: 2 });
    if (capital === 'star') {
      map.addImage('m-capital', make((g, x) => {
        g.beginPath();
        for (let i = 0; i < 10; i++) {
          const r = i % 2 ? 4.2 : 10, a = -Math.PI / 2 + (i * Math.PI) / 5;
          g.lineTo(x + r * Math.cos(a), x + r * Math.sin(a));
        }
        g.closePath(); g.fillStyle = accent; g.fill(); g.lineWidth = 2; g.strokeStyle = paper; g.stroke();
      }, 24), { pixelRatio: 2 });
    } else if (capital === 'square') {
      map.addImage('m-capital', make((g, x) => { g.fillStyle = paper; g.fillRect(x - 8, x - 8, 16, 16); g.lineWidth = 2.4; g.strokeStyle = ink; g.strokeRect(x - 7, x - 7, 14, 14); g.fillStyle = accent; g.fillRect(x - 3.5, x - 3.5, 7, 7); }), { pixelRatio: 2 });
    } else {
      map.addImage('m-capital', make((g, x) => { circle(g, 8, x, paper, ink, 2.4); circle(g, 4, x, accent); }), { pixelRatio: 2 });
    }
    map.addImage('m-ruin', make((g, x) => {
      g.fillStyle = ink;
      // Three dots (∴), the conventional mark for ruins.
      [[x, x - 4.5], [x - 4.5, x + 3.5], [x + 4.5, x + 3.5]].forEach(([a, b]) => {
        g.beginPath(); g.arc(a, b, 2.6, 0, Math.PI * 2); g.fill();
      });
    }), { pixelRatio: 2 });
  };

  /** Diagonal hatch tile for fill-pattern (selection without a new colour). */
  HB.hatch = (color, alpha = 0.5, size = 16, width = 3) => {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    g.strokeStyle = color; g.globalAlpha = alpha; g.lineWidth = width;
    [-size, 0, size].forEach((o) => { g.beginPath(); g.moveTo(o, size); g.lineTo(o + size, 0); g.stroke(); });
    return { width: size, height: size, data: g.getImageData(0, 0, size, size).data };
  };

  /* ---- Scale bar --------------------------------------------------------- */
  HB.scaleFor = (map, maxPx) => {
    const center = map.getCenter();
    const metersPerPx = (40075016.686 * Math.cos((center.lat * Math.PI) / 180)) / (512 * 2 ** map.getZoom());
    const maxKm = (maxPx * metersPerPx) / 1000;
    const nice = [100, 200, 250, 500, 1000, 1500, 2000, 2500, 5000].filter((k) => k <= maxKm).pop() || 100;
    return { km: nice, px: (nice * 1000) / metersPerPx };
  };

  /* ---- Timeline ruler (mirrors chooseLabelledTicks in Timeline.tsx) ------ */
  HB.chooseLabelledTicks = (years, width, charPx = 6.6, padPx = 14, selected = -1) => {
    const chosen = new Set();
    const step = width / years.length;
    const last = years.length - 1;
    const extent = (i) => {
      const w = HB.rulerLabel(years[i]).length * charPx + padPx;
      const c = (i + 0.5) * step;
      if (i === 0) return [c - 4, c - 4 + w];
      if (i === last) return [c + 4 - w, c + 4];
      return [c - w / 2, c + w / 2];
    };
    const fits = (i) => {
      const [l, r] = extent(i);
      return [...chosen].every((o) => {
        const [ol, or] = extent(o);
        return r <= ol || l >= or;
      });
    };
    // The selected year is always printed, so the thumb never sits beside a neighbour's label.
    const candidates = [selected, 0, last, ...HB.eraSpans(years).map((s) => s.start), ...years.map((_, i) => i)];
    candidates.forEach((i) => {
      if (i >= 0 && !chosen.has(i) && fits(i)) chosen.add(i);
    });
    return chosen;
  };

  /**
   * Renders the ruler into `root` (expects .tl-eras, .tl-track, .tl-labels
   * children). `opts.eraLabel(span, bandPx)` picks the printed era name.
   */
  HB.renderRuler = (root, year, opts = {}) => {
    const years = HB.YEARS;
    const spans = HB.eraSpans(years);
    const selected = years.indexOf(year);
    const draw = () => {
      const track = root.querySelector('.tl-track');
      const width = track.clientWidth;
      const pos = (i) => `${((i + 0.5) / years.length) * 100}%`;
      const eras = root.querySelector('.tl-eras');
      eras.innerHTML = '';
      spans.forEach((span) => {
        const band = document.createElement('span');
        band.className = 'tl-era';
        band.dataset.era = span.era.id;
        if (selected >= span.start && selected < span.start + span.count) band.dataset.active = '';
        band.style.flexGrow = span.count;
        const bandPx = (span.count / years.length) * width;
        const label = opts.eraLabel ? opts.eraLabel(span, bandPx) : span.era.label;
        band.innerHTML = `<span class="tl-era__label">${label}</span>`;
        band.title = span.era.label;
        eras.appendChild(band);
      });
      track.querySelectorAll('.tl-tick, .tl-thumb').forEach((n) => n.remove());
      const labelled = HB.chooseLabelledTicks(years, width, opts.charPx, opts.padPx, selected);
      years.forEach((y, i) => {
        const tick = document.createElement('span');
        tick.className = 'tl-tick';
        tick.dataset.era = HB.eraOf(y).id;
        if (labelled.has(i)) tick.dataset.major = '';
        if (spans.some((s) => s.start === i && i > 0)) tick.dataset.eraStart = '';
        if (i < selected) tick.dataset.past = '';
        tick.style.left = pos(i);
        track.appendChild(tick);
      });
      const thumb = document.createElement('span');
      thumb.className = 'tl-thumb';
      thumb.style.left = pos(selected);
      track.appendChild(thumb);
      const labels = root.querySelector('.tl-labels');
      labels.innerHTML = '';
      years.forEach((y, i) => {
        if (!labelled.has(i)) return;
        const l = document.createElement('span');
        l.className = 'tl-label';
        if (i === selected) l.dataset.active = '';
        if (i === 0) l.dataset.edge = 'start';
        if (i === years.length - 1) l.dataset.edge = 'end';
        l.dataset.era = HB.eraOf(y).id;
        l.style.left = pos(i);
        l.textContent = HB.rulerLabel(y);
        labels.appendChild(l);
      });
    };
    draw();
    new ResizeObserver(draw).observe(root.querySelector('.tl-track'));
  };

  /* ---- Map boot ---------------------------------------------------------- */
  HB.isPhone = () => window.matchMedia('(max-width: 699px)').matches;

  /**
   * Creates the map, then calls `onReady(map)`. Selection (the Ottoman Empire)
   * is applied through feature-state so styles can treat it specially.
   */
  HB.createMap = ({ container, style, view, selected = 'Ottoman Empire', onReady }) => {
    HB.registerLocalProtocol();
    const map = new maplibregl.Map({
      container,
      style,
      attributionControl: false,
      fadeDuration: 0,
      renderWorldCopies: false,
      maxPitch: 0,
      dragRotate: false,
      preserveDrawingBuffer: true,
    });
    map.touchZoomRotate.disableRotation();
    let markersAdded = false;
    map.on('styleimagemissing', () => {
      if (markersAdded || !HB.beforeMap) return;
      markersAdded = true;
      HB.beforeMap(map);
    });
    const applyView = () => {
      const v = view();
      map.fitBounds(v.bounds, { padding: v.padding, animate: false, maxZoom: v.maxZoom || 5 });
    };
    map.on('load', () => {
      applyView();
      window.HB_1492.borders.features.forEach((f) => {
        if (f.properties.NAME === selected) map.setFeatureState({ source: 'borders', id: f.id }, { selected: true });
      });
      onReady && onReady(map);
      map.once('idle', () => document.documentElement.setAttribute('data-map-ready', ''));
    });
    window.addEventListener('resize', applyView);
    return map;
  };

  /** Click/tap selection: a real interaction so the mock can be explored. */
  HB.enableSelection = (map, onSelect) => {
    let current = null;
    map.on('click', 'territory-fill', (e) => {
      const f = e.features[0];
      if (!f) return;
      if (current != null) map.setFeatureState({ source: 'borders', id: current }, { selected: false });
      current = f.id;
      map.setFeatureState({ source: 'borders', id: f.id }, { selected: true });
      onSelect && onSelect(f.properties.NAME);
    });
    map.on('mouseenter', 'territory-fill', () => (map.getCanvas().style.cursor = 'pointer'));
    map.on('mouseleave', 'territory-fill', () => (map.getCanvas().style.cursor = ''));
  };
})();
