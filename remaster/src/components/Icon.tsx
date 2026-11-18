/** Small stroke icon set drawn on a 24×24 grid. Decorative unless labelled. */
const PATHS = {
  chevronLeft: <path d="M15 18l-6-6 6-6" />,
  chevronRight: <path d="M9 18l6-6-6-6" />,
  chevronDown: <path d="M6 9l6 6 6-6" />,
  close: <path d="M18 6L6 18M6 6l12 12" />,
  sliders: (
    <>
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="10" cy="17" r="2" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </>
  ),
  message: (
    <path d="M20 14a2 2 0 0 1-2 2H9l-5 4V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z" />
  ),
  expand: <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />,
  collapse: <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7" />,
  external: (
    <>
      <path d="M14 4h6v6M20 4l-9 9" />
      <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </>
  ),
  refresh: <path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4.2-4.2" />
    </>
  ),
  link: (
    <path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" />
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  present: (
    <>
      <rect x="3" y="4" width="18" height="12" />
      <path d="M12 16v4M8 20h8" />
    </>
  ),
} as const;

export type IconName = keyof typeof PATHS;

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
}

export default function Icon({ name, size = 18, className }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}

/**
 * The Historic Borders mark in Direction A: an engraved compass rose (two
 * rings, cardinal lines, a lozenge needle) set beside the Alegreya SC name.
 */
export function BrandMark({ size = 34 }: { size?: number }) {
  return (
    <svg
      className="brand-mark"
      width={size}
      height={size}
      viewBox="0 0 34 34"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="17" cy="17" r="15" />
      <circle cx="17" cy="17" r="11.5" strokeWidth=".8" />
      <path d="M17 2v30M2 17h30" strokeWidth=".8" />
      <path
        d="M5.6 9.5C10 12 24 12 28.4 9.5M5.6 24.5C10 22 24 22 28.4 24.5"
        strokeWidth=".8"
      />
      <path d="M17 6l2.4 11L17 28l-2.4-11z" fill="currentColor" stroke="none" />
    </svg>
  );
}
