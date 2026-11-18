import { useEffect, useRef } from 'react';
import { actions } from './store';
import type { mountMap as MountMap } from './map';

/**
 * Full-bleed map for reviewing the Classic-atlas style (screenshots and
 * profiling). Not product UI. Query: ?place=<name> selects; ?fit=w,s,e,n and
 * ?pad=t,r,b,l frame the camera; ?grain=0 and ?neatline=0 drop the overlays;
 * the style options of `optionsFromQuery` apply.
 */
export default function StyleReview({ year }: { year: number }) {
  const map = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  useEffect(() => {
    actions.init(year);
    let handle: ReturnType<typeof MountMap> | undefined;
    const cleanups: (() => void)[] = [];
    let cancelled = false;
    void Promise.all([import('./map'), import('./style')]).then(
      ([{ mountMap }, style]) => {
        if (cancelled || !map.current || !svg.current) return;
        handle = mountMap(map.current);
        const p = new URLSearchParams(location.search);
        const fit = p.get('fit')?.split(',').map(Number);
        const pad = p.get('pad')?.split(',').map(Number) ?? [24, 24, 24, 24];
        if (fit?.length === 4)
          handle.map.fitBounds(
            [
              [fit[0], fit[1]],
              [fit[2], fit[3]],
            ],
            {
              animate: false,
              maxZoom: 6,
              padding: {
                top: pad[0],
                right: pad[1],
                bottom: pad[2],
                left: pad[3],
              },
            },
          );
        const phone = () => matchMedia('(max-width: 699px)').matches;
        const simple = () =>
          phone() ||
          (handle!.options.lowPower && style.LOW_POWER_SIMPLE_NEATLINE);
        if (p.get('neatline') !== '0')
          cleanups.push(style.attachNeatline(handle.map, svg.current, simple));
        if (
          p.get('grain') !== '0' &&
          !(handle.options.lowPower && style.LOW_POWER_DROPS_GRAIN)
        )
          cleanups.push(style.attachPaperGrain(map.current.parentElement!));
        (window as unknown as { __review: unknown }).__review = {
          handle,
          style,
        };
      },
    );
    return () => {
      cancelled = true;
      cleanups.forEach((fn) => fn());
      handle?.destroy();
    };
  }, [year]);
  return (
    <div className="review">
      <div
        ref={map}
        className="review__map"
        role="region"
        aria-label="Historical map"
      />
      <svg ref={svg} className="review__neatline" aria-hidden="true" />
    </div>
  );
}
