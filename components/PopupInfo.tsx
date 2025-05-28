import { Popup } from 'react-map-gl';
import { useAllowScroll } from '../hooks/useScrollLock';
import { useEffect, useMemo } from 'react';
import ReactGA4 from 'react-ga4';
import { useCountryInfo } from '../hooks/useCountryInfo';
import { useInfoProvider } from '../contexts/InfoProviderContext';
import { CoordTuple } from '../util/types';

export interface Info {
  position: CoordTuple;
  place: string;
}

interface PopupInfoProps {
  info: Info | undefined;
  onClose?: () => void;
}

export default function PopupInfo({ info, onClose }: PopupInfoProps) {
  const { position, place = '' } = info ?? {};
  const { provider } = useInfoProvider();
  const { info: description, title: title, isLoading } = useCountryInfo(place, { provider });
  const empty = useMemo(
    () => !description || description.trim() === '' || description === noData,
    [description],
  );

  // Allow scrolling on the popup description
  useAllowScroll('.popup-description', !!place);

  // Track popup display events
  useEffect(() => {
    if (place && position) {
      ReactGA4.event({
        category: 'AI Feature',
        action: 'popup_displayed',
        label: `${provider}_${place}`,
        value: 1,
      });
    }
  }, [place, position, provider]);

  // Track content loading completion
  useEffect(() => {
    if (place && !isLoading && description) {
      const isError = description.includes('Something went wrong') || 
                     description.includes('AI information requires') ||
                     description.includes('No information available');
      
      if (!isError && !empty) {
        // Track successful content display
        ReactGA4.event({
          category: 'AI Feature',
          action: 'content_displayed',
          label: `${provider}_${place}`,
          value: 1,
        });

        // Track content quality metrics
        const wordCount = description.trim().split(/\s+/).length;
        ReactGA4.event({
          category: 'AI Feature',
          action: 'content_word_count',
          label: `${provider}_${place}`,
          value: wordCount,
        });

        ReactGA4.event({
          category: 'AI Feature',
          action: 'content_length',
          label: `${provider}_${place}`,
          value: description.length,
        });
      } else if (isError) {
        // Track error content display
        ReactGA4.event({
          category: 'AI Feature',
          action: 'content_error_displayed',
          label: `${provider}_${place}`,
          value: 1,
        });
      } else if (empty) {
        // Track empty content
        ReactGA4.event({
          category: 'AI Feature',
          action: 'content_empty_displayed',
          label: `${provider}_${place}`,
          value: 1,
        });
      }
    }
  }, [place, isLoading, description, provider, empty]);

  // Track popup close events
  const handleClose = () => {
    if (place) {
      ReactGA4.event({
        category: 'AI Feature',
        action: 'popup_closed',
        label: `${provider}_${place}`,
        value: 1,
      });
    }
    onClose?.();
  };

  // Determine popup size based on content with viewport constraints
  const popupStyle = useMemo(() => {
    if (empty) {
      return {
        width: '220px',
        height: '100px',
        maxWidth: '90vw',
        maxHeight: '60vh',
      };
    }
    return {
      width: '280px',
      height: '280px',
      maxWidth: '90vw',
      maxHeight: '70vh',
    };
  }, [empty]);

  // Determine description CSS class based on state
  const descriptionClass = useMemo(() => {
    let baseClass = 'popup-description';
    if (isLoading) {
      baseClass += ' loading';
    } else if (empty) {
      baseClass += ' empty';
    }
    return baseClass;
  }, [isLoading, empty]);

  // Get provider-specific loading message and icon
  const loadingMessage = provider === 'ai' ? '🤖 AI generating information...' : '📚 Loading information...';
  const providerIcon = provider === 'ai' ? '🤖' : '📖';

  return (
    <>
      {place && position && (
        <Popup
          anchor="bottom"
          offset={15}
          className="popup-border"
          style={popupStyle}
          latitude={position[1]}
          longitude={position[0]}
          closeOnClick={false}
          closeOnMove={false}
          onClose={handleClose}
        >
          <div className="popup-title">
            {title || place}
            {!isLoading && !empty && (
              <span className="provider-indicator" title={provider === 'ai' ? 'AI Generated' : 'Wikipedia'}>
                {providerIcon}
              </span>
            )}
          </div>
          <div className={descriptionClass}>
            {isLoading ? (
              loadingMessage
            ) : empty ? (
              <>📖 No information available<br />for this location 😔</>
            ) : (
              description
            )}
          </div>
        </Popup>
      )}
    </>
  );
}

const noData = 'Not Found';
