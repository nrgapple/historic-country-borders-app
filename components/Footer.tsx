import Image from 'next/image';
import { useInfoProvider } from '../contexts/InfoProviderContext';

interface FooterProps {
  dataUrl?: string;
  lastCommit?: Date;
  discussionUrl?: string;
}

export default function Footer({
  dataUrl = 'https://github.com/nrgapple/historicborders-timeline-example',
  lastCommit,
  discussionUrl,
}: FooterProps) {
  const { provider, toggleProvider } = useInfoProvider();

  return (
    <div className="footer-compact">
      {/* Always visible compact version */}
      <div className="footer-compact-trigger">
        <span className="footer-compact-logo">🌎</span>
        <span className="footer-compact-text">HistoricBorders</span>
      </div>

      {/* Expanded content */}
      <div className="footer-compact-expanded">
        <div className="footer-compact-section">
          <div className="footer-compact-title">🌎 HistoricBorders.app</div>
          {!!lastCommit && (
            <div className="footer-compact-update">
              Updated: {lastCommit.toLocaleDateString('en-us', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </div>
          )}
        </div>
        
        {/* AI Provider Toggle Section */}
        <div className="footer-compact-section">
          <div className="footer-compact-title">🤖 AI Information (Beta)</div>
          <div className="footer-compact-ai-toggle">
            <button
              className={`footer-compact-ai-button ${provider === 'ai' ? 'active' : ''}`}
              onClick={toggleProvider}
              title={`Currently using ${provider === 'wikipedia' ? 'Wikipedia' : 'AI'}. Click to switch.`}
            >
              <span className="footer-compact-ai-icon">
                {provider === 'wikipedia' ? '📚' : '🤖'}
              </span>
              <span className="footer-compact-ai-text">
                {provider === 'wikipedia' ? 'Wikipedia' : 'AI Beta'}
              </span>
            </button>
          </div>
        </div>
        
        <div className="footer-compact-links">
          <a href={dataUrl} className="footer-compact-link">📊 Data Source</a>
          <a href="https://github.com/nrgapple/historic-country-borders-app" className="footer-compact-link">
            ⭐️ Star on GitHub
          </a>
          <a href={discussionUrl} className="footer-compact-link">💬 Community</a>
        </div>
      </div>
    </div>
  );
}
