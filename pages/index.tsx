import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import historicalManifest from '../data/historical-manifest.json';
import Layout from '../components/Layout';
import { BrandMark } from '../components/Icon';
import { formatYear, formatYearLong, yearPath } from '../lib/years';

const years = historicalManifest.years;

/**
 * The home page sends visitors to a random year, as it always has, but does it
 * with a tiny inline script before React loads instead of after hydration. The
 * static markup doubles as a crawlable index of every available year.
 */
const redirectScript = `(function(){try{var y=${JSON.stringify(
  years,
)};var s=location.search;location.replace('/year/'+y[Math.floor(Math.random()*y.length)]+s);}catch(e){}})();`;

export default function HomePage() {
  const router = useRouter();

  // Client-side navigations to "/" do not run the inline script.
  useEffect(() => {
    const year = years[Math.floor(Math.random() * years.length)];
    void router.replace(`${yearPath(year)}${window.location.search}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Layout path="/">
      <script dangerouslySetInnerHTML={{ __html: redirectScript }} />
      <main className="landing">
        <div className="landing__inner">
          <p className="landing__brand">
            <BrandMark size={28} />
            Historic Borders
          </p>
          <h1 className="landing__title">
            An interactive atlas of world borders, {formatYearLong(years[0])} to{' '}
            {formatYearLong(years[years.length - 1])}
          </h1>
          <p className="landing__lede">Opening a random year…</p>
          <nav aria-label="All years">
            <ul className="year-index">
              {years.map((year) => (
                <li key={year}>
                  <Link href={yearPath(year)}>{formatYear(year)}</Link>
                </li>
              ))}
            </ul>
          </nav>
          <p className="landing__more">
            <Link href="/pa/school-districts">
              Pennsylvania school districts map
            </Link>
          </p>
        </div>
      </main>
    </Layout>
  );
}
