import {
  ease,
  fieldSize,
  frameAt,
  interiorSeeds,
  jumpSteps,
  reduce,
  sharedKeys,
  skipReason,
  switchTime,
  TIMING,
  worldCopies,
  type Machine,
  type Part,
  type SkipInput,
} from './plan';

const animate: SkipInput = {
  enabled: true,
  reducedMotion: false,
  lowPower: false,
  webgl2: true,
  projection: 'mercator',
  hidden: false,
  shown: true,
  from: 1914,
  to: 1920,
  reload: false,
  moving: false,
};

describe('skipReason', () => {
  it('animates an ordinary year change', () => {
    expect(skipReason(animate)).toBeNull();
  });

  it.each([
    [{ enabled: false }, 'setting-off'],
    [{ reducedMotion: true }, 'reduced-motion'],
    [{ lowPower: true }, 'low-power'],
    [{ webgl2: false }, 'no-webgl2'],
    [{ projection: 'globe' }, 'projection'],
    [{ hidden: true }, 'hidden'],
    [{ reload: true }, 'reload'],
    [{ shown: false }, 'first-load'],
    [{ to: 1914 }, 'same-year'],
    [{ moving: true }, 'moving'],
  ] as const)('skips for %o', (patch, reason) => {
    expect(skipReason({ ...animate, ...patch })).toBe(reason);
  });

  it('reports the setting before the device preference', () => {
    expect(
      skipReason({ ...animate, enabled: false, reducedMotion: true }),
    ).toBe('setting-off');
  });
});

describe('ease', () => {
  it('starts and ends at rest and is symmetric', () => {
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    expect(ease(0.5)).toBeCloseTo(0.5);
    expect(ease(0.25) + ease(0.75)).toBeCloseTo(1);
    expect(ease(-1)).toBe(0);
    expect(ease(2)).toBe(1);
  });

  it('is monotonic', () => {
    let last = -1;
    for (let t = 0; t <= 1; t += 0.01) {
      expect(ease(t)).toBeGreaterThanOrEqual(last);
      last = ease(t);
    }
  });
});

describe('switchTime', () => {
  it('is 0 at the growing side and 1 at the far side of a region', () => {
    expect(switchTime(0, 40, 100)).toBe(0);
    expect(switchTime(40, 0, 100)).toBe(1);
    expect(switchTime(10, 30, 100)).toBeCloseTo(0.25);
  });

  it('normalizes per region: a sliver and a continent finish together', () => {
    // The same relative position gets the same time, whatever the size.
    expect(switchTime(3, 9, 100)).toBeCloseTo(switchTime(300, 900, 100));
    expect(switchTime(5, 0, 100)).toBe(switchTime(5000, 0, 100));
  });

  it('swells a brand-new territory from its middle', () => {
    // No old land to grow from: deeper pixels switch first.
    expect(switchTime(null, 80, 100)).toBeCloseTo(0.2);
    expect(switchTime(null, 5, 100)).toBeCloseTo(0.95);
    expect(switchTime(null, 500, 100)).toBe(0);
  });

  it('advances steadily when nothing is on the far side', () => {
    expect(switchTime(0, null, 100)).toBe(0);
    expect(switchTime(100, null, 100)).toBeCloseTo(0.5);
    expect(switchTime(null, null, 100)).toBe(0.5);
  });

  it('always stays within 0–1', () => {
    for (const d1 of [null, 0, 1, 50, 1e6])
      for (const d2 of [null, 0, 1, 50, 1e6]) {
        const t = switchTime(d1, d2, 64);
        expect(t).toBeGreaterThanOrEqual(0);
        expect(t).toBeLessThanOrEqual(1);
      }
  });
});

describe('frameAt', () => {
  it('fades in, grows, holds, fades out', () => {
    expect(frameAt(0, null)).toEqual({
      phase: 'fade-in',
      alpha: 0,
      progress: 0,
    });
    expect(frameAt(TIMING.fadeIn / 2, null).alpha).toBeCloseTo(0.5);
    const mid = frameAt(TIMING.fadeIn + TIMING.grow / 2, null);
    expect(mid).toMatchObject({ phase: 'grow', alpha: 1 });
    expect(mid.progress).toBeCloseTo(0.5);
    const end = TIMING.fadeIn + TIMING.grow;
    expect(frameAt(end + 500, null)).toEqual({
      phase: 'hold',
      alpha: 1,
      progress: 1,
    });
    const out = frameAt(end + 500 + TIMING.fadeOut / 2, end + 500);
    expect(out.phase).toBe('fade-out');
    expect(out.alpha).toBeCloseTo(0.5);
    expect(frameAt(end + 500 + TIMING.fadeOut, end + 500).phase).toBe('done');
  });

  it('runs in about a second', () => {
    const total = TIMING.fadeIn + TIMING.grow + TIMING.fadeOut;
    expect(TIMING.grow).toBeGreaterThanOrEqual(800);
    expect(TIMING.grow).toBeLessThanOrEqual(1200);
    expect(total).toBeLessThan(1600);
  });
});

describe('reduce (interrupted transitions)', () => {
  const idle: Machine = { kind: 'idle' };

  it('prepares, then starts only for the current token', () => {
    const a = reduce(idle, { type: 'request', from: 1914, to: 1920 });
    expect(a.state).toMatchObject({ kind: 'preparing', from: 1914, to: 1920 });
    expect(a.effects).toEqual([
      expect.objectContaining({ type: 'prepare', from: 1914, to: 1920 }),
    ]);
    const token = (a.state as { token: number }).token;
    expect(
      reduce(a.state, { type: 'ready', token: token + 1 }).effects,
    ).toEqual([]);
    const b = reduce(a.state, { type: 'ready', token });
    expect(b.state).toMatchObject({ kind: 'running', to: 1920 });
    expect(b.effects).toEqual([{ type: 'start', from: 1914, to: 1920, token }]);
    expect(reduce(b.state, { type: 'done', token }).state).toEqual(idle);
  });

  it('retargets while preparing, keeping the year on screen as the start', () => {
    const a = reduce(idle, { type: 'request', from: 1914, to: 1920 });
    // The controller's borders still show 1914.
    const b = reduce(a.state, { type: 'request', from: 1914, to: 1930 });
    expect(b.state).toMatchObject({ kind: 'preparing', from: 1914, to: 1930 });
    const oldToken = (a.state as { token: number }).token;
    expect(reduce(b.state, { type: 'ready', token: oldToken }).effects).toEqual(
      [],
    );
  });

  it('snaps a running change and starts the next from its target', () => {
    const running: Machine = {
      kind: 'running',
      from: 1914,
      to: 1920,
      token: 7,
    };
    const next = reduce(running, { type: 'request', from: 1914, to: 1930 });
    expect(next.effects[0]).toEqual({ type: 'snap', year: 1920 });
    expect(next.effects[1]).toMatchObject({
      type: 'prepare',
      from: 1920,
      to: 1930,
    });
    expect(next.state).toMatchObject({ kind: 'preparing', from: 1920 });
  });

  it('never builds a backlog: only the latest request survives', () => {
    let state: Machine = idle;
    for (const to of [1920, 1930, 1938, 1945])
      state = reduce(state, { type: 'request', from: 1914, to }).state;
    expect(state).toMatchObject({ kind: 'preparing', from: 1914, to: 1945 });
  });

  it('going back to the year on screen just shows it', () => {
    const a = reduce(idle, { type: 'request', from: 1914, to: 1920 });
    const b = reduce(a.state, { type: 'request', from: 1914, to: 1914 });
    expect(b.state).toEqual(idle);
    expect(b.effects).toEqual([{ type: 'show', year: 1914 }]);
  });

  it('cancels a running change by snapping; ignores cancel while preparing', () => {
    const running: Machine = { kind: 'running', from: 1, to: 2, token: 3 };
    expect(reduce(running, { type: 'cancel' })).toEqual({
      state: idle,
      effects: [{ type: 'snap', year: 2 }],
    });
    const preparing: Machine = { kind: 'preparing', from: 1, to: 2, token: 3 };
    expect(reduce(preparing, { type: 'cancel' }).state).toBe(preparing);
  });

  it('shows the year at once when preparing fails', () => {
    const preparing: Machine = { kind: 'preparing', from: 1, to: 2, token: 3 };
    expect(reduce(preparing, { type: 'failed', token: 3 })).toEqual({
      state: idle,
      effects: [{ type: 'show', year: 2 }],
    });
  });
});

describe('sharedKeys', () => {
  it('gives each name one key across both years; 0 is no territory', () => {
    const keys = sharedKeys(
      ['German Empire', 'France', 'Russian Empire'],
      ['France', 'Germany', 'Poland', 'Russian Empire'],
    );
    expect(Array.from(keys.from)).toEqual([1, 2, 3]);
    expect(Array.from(keys.to)).toEqual([2, 4, 5, 3]);
    expect(keys.count).toBe(6);
  });
});

describe('interiorSeeds', () => {
  const part = (id: number, bbox: Part['bbox']): Part => ({
    id,
    bbox,
    seed: [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2],
  });

  it('seeds new territories and parts far from their old land', () => {
    const keys = sharedKeys(['France'], ['France', 'Poland']);
    const seeds = interiorSeeds(
      [part(0, [0.5, 0.3, 0.52, 0.32])],
      [
        part(0, [0.5, 0.3, 0.53, 0.32]), // grows from its old land
        part(0, [0.1, 0.6, 0.12, 0.62]), // a new colony overseas
        part(1, [0.55, 0.28, 0.58, 0.3]), // a new state
      ],
      keys.from,
      keys.to,
    );
    expect(seeds).toEqual([
      { key: 1, x: 0.11, y: 0.61 },
      { key: 2, x: 0.565, y: expect.closeTo(0.29) },
    ]);
  });
});

describe('screen helpers', () => {
  it('lists the world copies on screen', () => {
    expect(worldCopies(-30, 40)).toEqual([0]);
    expect(worldCopies(-250, 100)).toEqual([-1, 0]);
    expect(worldCopies(100, 300)).toEqual([0, 1]);
    expect(worldCopies(-5000, 5000)).toEqual([-3, -2, -1, 0, 1, 2, 3]);
  });

  it('caps the distance field so a 3x phone costs no more than a laptop', () => {
    expect(fieldSize(800, 600)).toEqual({ width: 800, height: 600, scale: 1 });
    const phone = fieldSize(1170, 2532);
    expect(phone.width * phone.height).toBeLessThanOrEqual(530_000);
    expect(phone.scale).toBeGreaterThan(2);
  });

  it('halves jump-flood steps from the next power of two, then repeats 1', () => {
    expect(jumpSteps(700, 500)).toEqual([
      512, 256, 128, 64, 32, 16, 8, 4, 2, 1, 1,
    ]);
    expect(jumpSteps(1, 1)).toEqual([1]);
  });
});
