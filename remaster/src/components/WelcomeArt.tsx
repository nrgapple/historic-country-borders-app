import { useId, type ReactNode } from 'react';
import { COLOR, ERA_TINTS, WASHES } from '../styles/tokens';

/**
 * Small vignettes for the welcome tour, drawn in Direction A's own language:
 * a double-ruled plate, engraved waterlines, hand-tinted washes with an inner
 * edge band, madder selection, Alegreya SC lettering. They are decorative;
 * every card says the same thing in text.
 *
 * Each vignette is 320×160 and scales to its container.
 */

const W = 320;
const H = 160;
const SC = 'var(--font-sc)';
const SERIF = 'var(--font-serif)';
const ACCENT = 'var(--accent)';
/** The map's selection is always madder, whatever the era accent. */
const SELECT = ERA_TINTS.medieval.ink;
/** T6's dependencyTint(madder): the madder wash mixed 40% toward land. */
const COLONY_TINT = '#E9CCB3';

type ArtProps = { className?: string };

function Svg({
  className,
  children,
  ground = COLOR.water,
}: ArtProps & { children: ReactNode; ground?: string }) {
  return (
    <svg
      className={className}
      viewBox={`0 0 ${W} ${H}`}
      width={W}
      height={H}
      aria-hidden="true"
      focusable="false"
    >
      <rect x="0" y="0" width={W} height={H} fill={ground} />
      {children}
      {/* The plate's neatline: a hairline inside a heavier rule. */}
      <rect
        x="0.75"
        y="0.75"
        width={W - 1.5}
        height={H - 1.5}
        fill="none"
        stroke={COLOR.ink}
        strokeWidth="1.5"
      />
      <rect
        x="4.5"
        y="4.5"
        width={W - 9}
        height={H - 9}
        fill="none"
        stroke={COLOR.ink}
        strokeWidth="0.6"
      />
    </svg>
  );
}

/** Faint 10° graticule. */
function Graticule({ step = 40 }: { step?: number }) {
  const lines: ReactNode[] = [];
  for (let x = step; x < W; x += step)
    lines.push(<path key={`x${x}`} d={`M${x} 0V${H}`} />);
  for (let y = step; y < H; y += step)
    lines.push(<path key={`y${y}`} d={`M0 ${y}H${W}`} />);
  return (
    <g stroke={COLOR.ink} strokeOpacity="0.22" strokeWidth="0.5">
      {lines}
    </g>
  );
}

/**
 * Land with engraved waterlines: the coast is stroked wide in water ink and
 * then slightly narrower in water, leaving thin lines offset into the sea.
 */
function Land({ d, fill = COLOR.land }: { d: string; fill?: string }) {
  return (
    <g>
      {[
        [17, 0.18],
        [11, 0.28],
        [6, 0.42],
      ].map(([width, opacity]) => (
        <g key={width}>
          <path
            d={d}
            fill="none"
            stroke={COLOR.waterInk}
            strokeOpacity={opacity}
            strokeWidth={width}
            strokeLinejoin="round"
          />
          <path
            d={d}
            fill="none"
            stroke={COLOR.water}
            strokeWidth={width - 1.2}
            strokeLinejoin="round"
          />
        </g>
      ))}
      <path d={d} fill={fill} stroke={COLOR.ink} strokeWidth="0.9" />
    </g>
  );
}

/** A territory wash with the hand-coloured edge band inside its border. */
function Territory({
  id,
  d,
  fill,
  edge,
  clip,
  selected = false,
  hatch,
}: {
  id: string;
  d: string;
  fill: string;
  edge: string;
  clip: string;
  selected?: boolean;
  hatch?: string;
}) {
  const band = selected ? SELECT : edge;
  return (
    <g clipPath={`url(#${clip})`}>
      <clipPath id={id}>
        <path d={d} />
      </clipPath>
      <path d={d} fill={fill} fillOpacity={selected ? 1 : 0.9} />
      {hatch && <path d={d} fill={`url(#${hatch})`} />}
      <path
        d={d}
        fill="none"
        stroke={band}
        strokeOpacity={selected ? 0.38 : 0.45}
        strokeWidth={selected ? 14 : 9}
        clipPath={`url(#${id})`}
      />
      <path
        d={d}
        fill="none"
        stroke={selected ? SELECT : COLOR.ink}
        strokeWidth={selected ? 2.2 : 0.8}
        strokeLinejoin="round"
      />
    </g>
  );
}

/** The atlas capital: a five-pointed ink star in a paper ring. */
function CapitalMark({ x, y, r = 6 }: { x: number; y: number; r?: number }) {
  const points = Array.from({ length: 10 }, (_, i) => {
    const radius = i % 2 ? r * 0.29 : r * 0.72;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    return `${(x + radius * Math.cos(a)).toFixed(2)},${(y + radius * Math.sin(a)).toFixed(2)}`;
  }).join(' ');
  return (
    <g>
      <circle
        cx={x}
        cy={y}
        r={r}
        fill={COLOR.sheet}
        stroke={COLOR.ink}
        strokeWidth="1.2"
      />
      <polygon points={points} fill={COLOR.ink} />
    </g>
  );
}

function CityMark({ x, y }: { x: number; y: number }) {
  return (
    <circle
      cx={x}
      cy={y}
      r="2.8"
      fill={COLOR.ink}
      stroke={COLOR.sheet}
      strokeWidth="1.3"
    />
  );
}

function RuinsMark({ x, y }: { x: number; y: number }) {
  return (
    <g fill={COLOR.ink} stroke={COLOR.sheet} strokeWidth="0.8">
      <circle cx={x} cy={y - 2.6} r="1.8" />
      <circle cx={x - 2.6} cy={y + 2} r="1.8" />
      <circle cx={x + 2.6} cy={y + 2} r="1.8" />
    </g>
  );
}

function HatchPattern({ id, color }: { id: string; color: string }) {
  return (
    <pattern
      id={id}
      width="6"
      height="6"
      patternUnits="userSpaceOnUse"
      patternTransform="rotate(45)"
    >
      <path d="M0 0V6" stroke={color} strokeOpacity="0.65" strokeWidth="1.1" />
    </pattern>
  );
}

/** Lettering with the cream halo every map label carries. */
function MapLabel({
  x,
  y,
  children,
  size = 11,
  color = COLOR.ink,
  spacing = 0.12,
  anchor = 'middle',
  italic = false,
}: {
  x: number;
  y: number;
  children: ReactNode;
  size?: number;
  color?: string;
  spacing?: number;
  anchor?: 'start' | 'middle' | 'end';
  italic?: boolean;
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      fill={color}
      stroke={COLOR.sheet}
      strokeWidth="2.6"
      strokeOpacity="0.85"
      paintOrder="stroke"
      style={{
        font: `${italic ? 'italic ' : ''}${italic ? 500 : 700} ${size}px/1 ${italic ? SERIF : SC}`,
        letterSpacing: `${spacing}em`,
      }}
    >
      {children}
    </text>
  );
}

/* ------------------------------------------------------------------ Cards */

const COAST =
  'M-12 30C22 22 54 12 92 20C124 27 148 14 178 24C206 33 220 56 206 80C194 100 166 100 146 114C124 129 98 148 70 172L-12 172Z';

/** 1. Share a place link: a selected territory and the link slip it makes. */
export function ShareArt({ className }: ArtProps) {
  const uid = useId().replace(/:/g, '');
  const land = `${uid}-land`;
  return (
    <Svg className={className}>
      <defs>
        <clipPath id={land}>
          <path d={COAST} />
        </clipPath>
      </defs>
      <Graticule />
      <Land d={COAST} />
      <Territory
        id={`${uid}-a`}
        clip={land}
        d="M-12 0L72 0L88 58L62 98L40 172L-12 172Z"
        fill={WASHES[1].fill}
        edge={WASHES[1].edge}
      />
      <Territory
        id={`${uid}-c`}
        clip={land}
        d="M150 0L330 0L330 172L118 172L160 82L142 50Z"
        fill={WASHES[2].fill}
        edge={WASHES[2].edge}
      />
      <Territory
        id={`${uid}-b`}
        clip={land}
        d="M72 0L150 0L142 50L160 82L118 172L40 172L62 98L88 58Z"
        fill={COLOR.selectedFill}
        edge={SELECT}
        selected
      />
      <CapitalMark x={104} y={70} r={5.5} />
      <MapLabel x={104} y={98} size={12} color={COLOR.selectedInk}>
        Your place
      </MapLabel>

      {/* Leader from the selection to the link slip. */}
      <path
        d="M128 104C150 116 162 118 176 116"
        fill="none"
        stroke={COLOR.ink}
        strokeWidth="0.9"
        strokeDasharray="2.5 2.5"
      />
      <g transform="translate(176 92)">
        <rect
          width="130"
          height="54"
          fill={COLOR.sheet}
          stroke={COLOR.ink}
          strokeWidth="1"
        />
        <path d="M0 4.5H130" stroke={COLOR.ink} strokeWidth="0.6" />
        <g
          transform="translate(10 14) scale(0.62)"
          fill="none"
          stroke={ACCENT}
          strokeWidth="2.2"
          strokeLinecap="round"
        >
          <path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" />
        </g>
        <text
          x="30"
          y="25"
          fill={ACCENT}
          style={{
            font: `700 11px/1 ${SC}`,
            letterSpacing: '0.1em',
          }}
        >
          Link copied
        </text>
        <text
          x="10"
          y="43"
          fill={COLOR.ink2}
          style={{ font: `italic 400 10.5px/1 ${SERIF}` }}
        >
          /year/1492?place=…
        </text>
      </g>
    </Svg>
  );
}

/** 2. Find any territory: a typed query, its match, and the map framing it. */
export function FindArt({ className }: ArtProps) {
  const uid = useId().replace(/:/g, '');
  const land = `${uid}-land`;
  const coast =
    'M196 40C222 30 252 34 276 28C296 24 318 30 330 34L330 172L190 172C200 150 214 132 206 112C198 92 182 70 196 40Z';
  return (
    <Svg className={className} ground={COLOR.paper}>
      <defs>
        <clipPath id={`${uid}-plate`}>
          <rect x="178" y="16" width="128" height="128" />
        </clipPath>
        <clipPath id={land}>
          <path d={coast} />
        </clipPath>
      </defs>

      {/* The map plate being framed. */}
      <g clipPath={`url(#${uid}-plate)`}>
        <rect x="178" y="16" width="128" height="128" fill={COLOR.water} />
        <Land d={coast} />
        <Territory
          id={`${uid}-a`}
          clip={land}
          d="M180 0L330 0L330 74L262 86L224 70L180 76Z"
          fill={WASHES[3].fill}
          edge={WASHES[3].edge}
        />
        <Territory
          id={`${uid}-c`}
          clip={land}
          d="M180 120L250 116L284 132L330 124L330 172L180 172Z"
          fill={WASHES[7].fill}
          edge={WASHES[7].edge}
        />
        <Territory
          id={`${uid}-b`}
          clip={land}
          d="M180 76L224 70L262 86L330 74L330 124L284 132L250 116L180 120Z"
          fill={COLOR.selectedFill}
          edge={SELECT}
          selected
        />
      </g>
      <rect
        x="178.5"
        y="16.5"
        width="127"
        height="127"
        fill="none"
        stroke={COLOR.ink}
      />
      {/* Framing brackets: the camera fits the territory. */}
      <g fill="none" stroke={SELECT} strokeWidth="1.8">
        <path d="M206 70V62H216M286 62H296V70M296 118V126H286M216 126H206V118" />
      </g>

      {/* The search field and its list. */}
      <rect
        x="14.5"
        y="20.5"
        width="140"
        height="30"
        fill={COLOR.sheet}
        stroke={COLOR.ink}
      />
      <g
        transform="translate(22 27) scale(0.7)"
        fill="none"
        stroke={COLOR.ink}
        strokeWidth="2"
        strokeLinecap="round"
      >
        <circle cx="11" cy="11" r="6.5" />
        <path d="M20 20l-4.2-4.2" />
      </g>
      <text
        x="44"
        y="40"
        fill={COLOR.ink}
        style={{ font: `400 14px/1 ${SERIF}` }}
      >
        Ara
      </text>
      <path d="M69.5 28V43" stroke={COLOR.focus} strokeWidth="1.2" />
      <rect
        x="14.5"
        y="54.5"
        width="140"
        height="84"
        fill={COLOR.sheet}
        stroke={COLOR.ink}
      />
      <rect x="15" y="55" width="139" height="27" fill={COLOR.paper2} />
      <rect x="15" y="55" width="3" height="27" fill={ACCENT} />
      {[
        ['Aragón', 73],
        ['Arabs', 100],
        ['Arakan', 127],
      ].map(([name, y]) => (
        <g key={name}>
          <text
            x="26"
            y={y}
            fill={COLOR.ink}
            style={{ font: `700 12.5px/1 ${SERIF}` }}
          >
            {name}
          </text>
        </g>
      ))}
      <path d="M15 82.5H154M15 109.5H154" stroke={COLOR.hair} />

      {/* From the chosen name to the map. */}
      <path
        d="M156 68C168 68 172 82 198 90"
        fill="none"
        stroke={COLOR.ink}
        strokeWidth="0.9"
        strokeDasharray="2.5 2.5"
      />
      <path d="M193 85.5L199.5 90.5L191.5 92" fill="none" stroke={COLOR.ink} />
    </Svg>
  );
}

const ERA_ORDER = [
  'prehistory',
  'ancient',
  'medieval',
  'early-modern',
  'modern',
] as const;

/** 3. Step through time: the plate-title year, the era ruler and the arrow keys. */
export function TimeArt({ className }: ArtProps) {
  const x0 = 16;
  const widths = [40, 72, 84, 52, 40];
  const starts = widths.map((_, i) =>
    widths.slice(0, i).reduce((a, b) => a + b, x0),
  );
  // 1492 sits at the close of the Medieval band, as on the real ruler.
  const thumb = starts[2] + widths[2] - 6;
  const cells = Array.from({ length: 36 }, (_, i) => i);
  return (
    <Svg className={className} ground={COLOR.paper}>
      <text
        x={W / 2 - 12}
        y="46"
        textAnchor="middle"
        fill={COLOR.ink}
        style={{
          font: `700 34px/1 ${SERIF}`,
          fontVariantNumeric: 'lining-nums',
        }}
      >
        1492
        <tspan
          dx="5"
          style={{ font: `700 15px/1 ${SC}`, letterSpacing: '0.06em' }}
        >
          AD
        </tspan>
      </text>
      <text
        x={W / 2}
        y="62"
        textAnchor="middle"
        fill={ERA_TINTS.medieval.ink}
        style={{ font: `700 11px/1 ${SC}`, letterSpacing: '0.16em' }}
      >
        Medieval
      </text>

      {ERA_ORDER.map((era, i) => (
        <rect
          key={era}
          x={starts[i] + 0.5}
          y="72.5"
          width={widths[i]}
          height="14"
          fill={ERA_TINTS[era].wash}
          stroke={COLOR.ink}
          strokeWidth="0.8"
        />
      ))}
      <path
        d={`M${starts[2]} 86.5h${widths[2]}`}
        stroke={ERA_TINTS.medieval.ink}
        strokeWidth="2.5"
      />
      {/* The alternating ladder track, like a scale bar. */}
      <rect
        x={x0 + 0.5}
        y="87.5"
        width="288"
        height="7"
        fill={COLOR.sheet}
        stroke={COLOR.ink}
        strokeWidth="0.8"
      />
      {cells
        .filter((i) => i % 2)
        .map((i) => (
          <rect
            key={i}
            x={x0 + i * 8}
            y="88"
            width="8"
            height="6"
            fill={COLOR.ink}
          />
        ))}
      <path d={`M${thumb} 74V106`} stroke={ERA_TINTS.medieval.ink} />
      <rect
        x={thumb - 5}
        y="77"
        width="10"
        height="10"
        transform={`rotate(45 ${thumb} 82)`}
        fill={ERA_TINTS.medieval.ink}
        stroke={COLOR.sheet}
        strokeWidth="1.2"
      />
      <text
        x={thumb}
        y="116"
        textAnchor="middle"
        fill={ERA_TINTS.medieval.ink}
        style={{
          font: `700 11px/1 ${SERIF}`,
          fontVariantNumeric: 'lining-nums',
        }}
      >
        1492
      </text>

      {/* The arrow keys. */}
      {[
        ['←', 64],
        ['→', 228],
      ].map(([key, x]) => (
        <g key={key} transform={`translate(${x} 124)`}>
          <rect
            x="0.5"
            y="1.5"
            width="28"
            height="24"
            rx="2"
            fill={COLOR.ink2}
          />
          <rect
            x="0.5"
            y="0.5"
            width="28"
            height="22"
            rx="2"
            fill={COLOR.sheet}
            stroke={COLOR.ink}
          />
          <text
            x="14.5"
            y="16"
            textAnchor="middle"
            fill={COLOR.ink}
            style={{ font: `700 14px/1 ${SERIF}` }}
          >
            {key}
          </text>
        </g>
      ))}
      <text
        x={W / 2 - 1}
        y="140"
        textAnchor="middle"
        fill={COLOR.ink2}
        style={{ font: `italic 400 11px/1 ${SERIF}` }}
      >
        one map at a time
      </text>
    </Svg>
  );
}

/** 4. Projector mode: the map alone on a classroom screen, in large type. */
export function ProjectorArt({ className }: ArtProps) {
  const uid = useId().replace(/:/g, '');
  const land = `${uid}-land`;
  const coast =
    'M40 52C80 40 120 50 150 40C190 28 230 44 290 36L290 140L40 140Z';
  return (
    <Svg className={className} ground={COLOR.paper2}>
      <defs>
        <clipPath id={`${uid}-screen`}>
          <rect x="44" y="22" width="232" height="104" />
        </clipPath>
        <clipPath id={land}>
          <path d={coast} />
        </clipPath>
      </defs>
      {/* Pull-down screen: roller, sheet, weighted hem and cord. */}
      <rect x="34" y="12" width="252" height="9" fill={COLOR.ink} />
      <rect x="30" y="13" width="6" height="7" fill={COLOR.ink2} />
      <rect x="284" y="13" width="6" height="7" fill={COLOR.ink2} />
      <g clipPath={`url(#${uid}-screen)`}>
        <rect x="44" y="22" width="232" height="104" fill={COLOR.water} />
        <Land d={coast} />
        <Territory
          id={`${uid}-a`}
          clip={land}
          d="M30 30L140 30L132 90L112 150L30 150Z"
          fill={WASHES[8].fill}
          edge={WASHES[8].edge}
        />
        <Territory
          id={`${uid}-b`}
          clip={land}
          d="M140 30L300 30L300 150L112 150L132 90Z"
          fill={WASHES[9].fill}
          edge={WASHES[9].edge}
        />
        <MapLabel x={88} y={98} size={15} spacing={0.14}>
          Hungary
        </MapLabel>
        <MapLabel x={214} y={92} size={15} spacing={0.14}>
          Venice
        </MapLabel>
      </g>
      <rect
        x="44.5"
        y="21.5"
        width="231"
        height="105"
        fill="none"
        stroke={COLOR.ink}
      />
      {/* The projector caption: the year, large. */}
      <rect
        x="52.5"
        y="30.5"
        width="76"
        height="34"
        fill={COLOR.sheet}
        stroke={COLOR.ink}
      />
      <text
        x="90"
        y="56"
        textAnchor="middle"
        fill={COLOR.ink}
        style={{
          font: `700 22px/1 ${SERIF}`,
          fontVariantNumeric: 'lining-nums',
        }}
      >
        1492
      </text>
      <rect x="40" y="126" width="240" height="5" fill={COLOR.ink} />
      <path d="M160 131V140" stroke={COLOR.ink} />
      <circle cx="160" cy="142" r="2" fill={COLOR.ink} />

      {/* Two rows of desks, seen from the back of the room. */}
      <g fill="none" stroke={COLOR.ink2} strokeWidth="1">
        {[0, 1, 2, 3].map((i) => (
          <path key={`a${i}`} d={`M${70 + i * 48} 146h34`} />
        ))}
        {[0, 1, 2, 3, 4].map((i) => (
          <path key={`b${i}`} d={`M${40 + i * 52} 154h40`} strokeWidth="1.4" />
        ))}
      </g>
    </Svg>
  );
}

/** 5. Reading the map: symbols on a small map and the key that names them. */
export function SymbolsArt({ className }: ArtProps) {
  const uid = useId().replace(/:/g, '');
  const land = `${uid}-land`;
  const hatch = `${uid}-hatch`;
  const ruler = WASHES[0];
  const coast =
    'M-10 26C30 18 70 30 104 22C130 16 150 30 156 50C162 76 140 92 150 116C156 132 150 150 144 172L-10 172Z';
  return (
    <Svg className={className}>
      <defs>
        <clipPath id={land}>
          <path d={coast} />
        </clipPath>
        <clipPath id={`${uid}-map`}>
          <rect x="0" y="0" width="166" height={H} />
        </clipPath>
        <HatchPattern id={hatch} color={ruler.edge} />
      </defs>
      <g clipPath={`url(#${uid}-map)`}>
        <Graticule />
        <Land d={coast} />
        <Territory
          id={`${uid}-a`}
          clip={land}
          d="M-10 0L120 0L112 64L70 84L-10 80Z"
          fill={ruler.fill}
          edge={ruler.edge}
        />
        {/* A colony: a lighter tint of its ruler, hatched in the ruler's edge. */}
        <Territory
          id={`${uid}-b`}
          clip={land}
          d="M-10 80L70 84L112 64L120 0L180 0L180 172L-10 172Z"
          fill={COLONY_TINT}
          edge={ruler.edge}
          hatch={hatch}
        />
        <CapitalMark x={46} y={44} />
        <CityMark x={92} y={36} />
        <RuinsMark x={58} y={120} />
        <MapLabel x={50} y={66} size={10}>
          Empire
        </MapLabel>
        <MapLabel x={110} y={108} size={10}>
          Colony
        </MapLabel>
      </g>
      <path d="M166.5 0V160" stroke={COLOR.ink} strokeWidth="0.8" />

      {/* The key, set like an atlas legend. */}
      <rect x="166" y="0" width="154" height={H} fill={COLOR.sheet} />
      <text
        x="243"
        y="27"
        textAnchor="middle"
        fill={COLOR.ink}
        style={{ font: `700 12px/1 ${SC}`, letterSpacing: '0.22em' }}
      >
        Key
      </text>
      <path d="M182 34H304M182 37H304" stroke={COLOR.ink} strokeWidth="0.6" />
      <g style={{ font: `400 12.5px/1 ${SERIF}` }} fill={COLOR.ink}>
        <CapitalMark x={192} y={54} r={6} />
        <text x="206" y="58">
          Capital
        </text>
        <CityMark x={192} y={78} />
        <text x="206" y="82">
          City
        </text>
        <RuinsMark x={192} y={102} />
        <text x="206" y="106">
          Ruins
        </text>
        <rect
          x="184.5"
          y="118.5"
          width="16"
          height="12"
          fill={COLONY_TINT}
          stroke={ruler.edge}
        />
        <rect x="185" y="119" width="15" height="11" fill={`url(#${hatch})`} />
        <text x="206" y="129">
          Colony, in its
        </text>
        <text x="206" y="143">
          ruler’s tint
        </text>
      </g>
    </Svg>
  );
}
