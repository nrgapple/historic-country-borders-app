import Link from 'next/link';
import Layout from '../components/Layout';

export default function NotFoundPage() {
  return (
    <Layout
      title="Map not found"
      description="That historical map year is not available."
      url="https://historicborders.app/404"
    >
      <main
        style={{
          maxWidth: '42rem',
          margin: '10vh auto',
          padding: '2rem',
          fontFamily: "'Times New Roman', serif",
          color: '#654321',
        }}
      >
        <h1>That map is not available</h1>
        <p>
          The year or page in this link is not one of the published Historic
          Borders maps.
        </p>
        <p>
          <Link href="/">Explore an available historical year</Link> or{' '}
          <Link href="/pa/school-districts">
            open Pennsylvania school districts
          </Link>
          .
        </p>
      </main>
    </Layout>
  );
}
