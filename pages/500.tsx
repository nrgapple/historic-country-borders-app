import Link from 'next/link';
import Layout from '../components/Layout';
import { BrandMark } from '../components/Icon';

export default function ServerErrorPage() {
  return (
    <Layout title="Something went wrong" path="/500" noindex>
      <main className="landing">
        <div className="landing__inner">
          <p className="landing__brand">
            <BrandMark size={28} />
            Historic Borders
          </p>
          <h1 className="landing__title">Something went wrong</h1>
          <p className="landing__lede">
            The map could not be shown. Reload the page or try another year.
          </p>
          <p className="landing__actions">
            <Link className="button button--primary" href="/">
              Open a historical map
            </Link>
          </p>
        </div>
      </main>
    </Layout>
  );
}
