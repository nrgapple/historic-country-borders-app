import Link from 'next/link';
import Layout from '../components/Layout';
import { BrandMark } from '../components/Icon';

export default function NotFoundPage() {
  return (
    <Layout
      title="Map not found"
      description="That historical map year is not available."
      path="/404"
      noindex
    >
      <main className="landing">
        <div className="landing__inner">
          <p className="landing__brand">
            <BrandMark size={28} />
            Historic Borders
          </p>
          <h1 className="landing__title">That map is not available</h1>
          <p className="landing__lede">
            The year or page in this link is not one of the published Historic
            Borders maps.
          </p>
          <p className="landing__actions">
            <Link className="button button--primary" href="/">
              Open a random year
            </Link>
            <Link className="button" href="/year/1914">
              See the world in 1914
            </Link>
            <Link className="button" href="/pa/school-districts">
              Open Pennsylvania school districts
            </Link>
          </p>
        </div>
      </main>
    </Layout>
  );
}
