import { GetStaticPaths, GetStaticProps } from 'next';
import historicalManifest from '../../data/historical-manifest.json';
import Viewer from '../../components/Viewer';
import { ConfigType } from '../../util/types';

export interface DataProps {
  years: number[];
  user: string;
  id: string;
  config: ConfigType;
  currentYear: string;
}

const YearPage = (props: DataProps) => <Viewer {...props} />;

export const getStaticPaths: GetStaticPaths = async () => ({
  paths: historicalManifest.years.map((year) => ({
    params: { year: year.toString() },
  })),
  fallback: false,
});

export const getStaticProps: GetStaticProps<DataProps> = async ({ params }) => {
  const currentYear = params?.year as string;

  if (!historicalManifest.years.includes(Number(currentYear))) {
    return { notFound: true };
  }

  return {
    props: {
      years: historicalManifest.years,
      user: 'aourednik',
      id: 'historical-basemaps',
      config: {
        name: 'Historic Borders',
        description: 'Interactive historical country borders.',
        commitDate: historicalManifest.source.commitDate,
      },
      currentYear,
    },
  };
};

export default YearPage;
