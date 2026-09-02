import { GetStaticProps } from 'next';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import historicalManifest from '../data/historical-manifest.json';
import { ConfigType } from '../util/types';

export interface DataProps {
  years: number[];
  user: string;
  id: string;
  config: ConfigType;
}

const getRandomYear = (years: number[]): string => {
  if (years.length === 0) return '';
  return years[Math.floor(Math.random() * years.length)].toString();
};

const IndexPage = ({ years }: DataProps) => {
  const router = useRouter();

  useEffect(() => {
    if (years.length > 0 && router.isReady) {
      router.replace(`/year/${getRandomYear(years)}`);
    }
  }, [years, router]);

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontFamily: "'Times New Roman', serif",
        fontSize: '18px',
        color: '#654321',
      }}
    >
      Loading historic borders...
    </div>
  );
};

export const getStaticProps: GetStaticProps<DataProps> = async () => ({
  props: {
    years: historicalManifest.years,
    user: 'aourednik',
    id: 'historical-basemaps',
    config: {
      name: 'Historic Borders',
      description: 'Interactive historical country borders.',
      commitDate: historicalManifest.source.commitDate,
    },
  },
});

export default IndexPage;
