// Ported as-is from ../lib/years.ts (formatting and eras); trimmed for the spike.
export interface Era { id: string; label: string; from: number }
export const ERAS: readonly Era[] = [
  { id: 'prehistory', label: 'Prehistory', from: -Infinity },
  { id: 'ancient', label: 'Ancient', from: -3000 },
  { id: 'medieval', label: 'Medieval', from: 500 },
  { id: 'early-modern', label: 'Early modern', from: 1500 },
  { id: 'modern', label: 'Modern', from: 1800 },
];
export const eraOf = (year: number): Era => {
  for (let i = ERAS.length - 1; i >= 0; i -= 1) if (year >= ERAS[i].from) return ERAS[i];
  return ERAS[0];
};
const numberFormat = new Intl.NumberFormat('en-US');
export const formatYear = (year: number) => (year < 0 ? `${numberFormat.format(-year)} BC` : String(year));
export const formatYearLong = (year: number) => (year < 0 ? `${numberFormat.format(-year)} BC` : `${year} AD`);
export const yearPath = (year: number) => `/year/${year}`;
export const parseYearPath = (pathname: string, years: readonly number[]) => {
  const m = /^\/year\/(-?\d+)$/.exec(pathname);
  const year = m ? Number(m[1]) : NaN;
  return years.includes(year) ? year : undefined;
};
