import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      fontFamily: "'Times New Roman', serif",
      textAlign: 'center',
      color: '#654321',
      backgroundColor: '#f5f3f0',
      padding: '2rem'
    }}>
      <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>404</h1>
      <h2 style={{ fontSize: '1.5rem', marginBottom: '2rem' }}>Historic Year Not Found</h2>
      <p style={{ fontSize: '1.1rem', marginBottom: '2rem', maxWidth: '600px' }}>
        The year you're looking for might not exist in our historical database, 
        or it may have been lost to the sands of time.
      </p>
      <Link 
        href="/" 
        style={{
          padding: '12px 24px',
          backgroundColor: '#6930c3',
          color: 'white',
          textDecoration: 'none',
          borderRadius: '4px',
          fontSize: '1rem',
          transition: 'background-color 0.2s'
        }}
      >
        Return to Historic Borders
      </Link>
    </div>
  );
} 