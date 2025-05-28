import Image from 'next/image';
import ReactGA4 from 'react-ga4';
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

  const handleToggleProvider = () => {
    const newProvider = provider === 'wikipedia' ? 'ai' : 'wikipedia';
    
    // Track AI feature toggle
    ReactGA4.event({
      category: 'AI Feature',
      action: 'toggle_provider',
      label: `${provider}_to_${newProvider}`,
      value: 1,
    });

    // Track specific provider activation
    ReactGA4.event({
      category: 'AI Feature',
      action: newProvider === 'ai' ? 'enable_ai' : 'disable_ai',
      label: newProvider,
      value: 1,
    });

    toggleProvider();
  };

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
              onClick={handleToggleProvider}
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
