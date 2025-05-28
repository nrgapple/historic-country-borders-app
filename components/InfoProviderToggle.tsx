import React from 'react';
import { useInfoProvider } from '../contexts/InfoProviderContext';

export default function InfoProviderToggle() {
  const { provider, toggleProvider } = useInfoProvider();

  return (
    <div className="info-provider-toggle">
      <button
        className="info-provider-toggle-button"
        onClick={toggleProvider}
        title={`Currently using ${provider === 'wikipedia' ? 'Wikipedia' : 'AI'}. Click to switch.`}
      >
        <span className="info-provider-icon">
          {provider === 'wikipedia' ? '📚' : '🤖'}
        </span>
        <span className="info-provider-text">
          {provider === 'wikipedia' ? 'Wiki' : 'AI'}
        </span>
      </button>
    </div>
  );
} 