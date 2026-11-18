import type { GetStaticPaths, GetStaticProps } from 'next';
import historicalManifest from '../../data/historical-manifest.json';
import HistoryAtlas from '../../components/HistoryAtlas';
import { parseYearParam } from '../../lib/years';

interface YearPageProps {
  years: number[];
  initialYear: number;
}

const YearPage = ({ years, initialYear }: YearPageProps) => (
  <HistoryAtlas years={years} initialYear={initialYear} />
);

export const getStaticPaths: GetStaticPaths = async () => ({
  paths: historicalManifest.years.map((year) => ({
    params: { year: String(year) },
  })),
  fallback: false,
});

export const getStaticProps: GetStaticProps<YearPageProps> = async ({
  params,
}) => {
  const initialYear = parseYearParam(params?.year, historicalManifest.years);
  if (initialYear === undefined) return { notFound: true };
  return { props: { years: historicalManifest.years, initialYear } };
};

export default YearPage;
