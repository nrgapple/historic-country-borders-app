import { Popup } from 'react-map-gl';
import { useAllowScroll } from '../hooks/useScrollLock';
import { useEffect, useMemo } from 'react';
import ReactGA4 from 'react-ga4';
import { useCountryInfo } from '../hooks/useCountryInfo';
import { useSettings } from '../contexts/SettingsContext';
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
  const { settings } = useSettings();
  const provider = settings.infoProvider;
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
      ReactGA4.event('country_info_popup_view', {
        country_name: place,
        info_provider: provider,
        popup_type: 'country_information'
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
        const wordCount = description.trim().split(/\s+/).length;
        
        ReactGA4.event('country_info_content_loaded', {
          country_name: place,
          info_provider: provider,
          content_length: description.length,
          word_count: wordCount,
          content_quality: wordCount < 50 ? 'brief' : wordCount < 150 ? 'moderate' : 'detailed'
        });
      } else if (isError) {
        // Track error content display
        ReactGA4.event('country_info_content_error', {
          country_name: place,
          info_provider: provider,
          error_type: description.includes('AI information requires') ? 'authentication_required' : 
                     description.includes('Something went wrong') ? 'content_generation_failed' : 'unknown_error'
        });
      } else if (empty) {
        // Track empty content
        ReactGA4.event('country_info_content_empty', {
          country_name: place,
          info_provider: provider,
          reason: 'no_data_available'
        });
      }
    }
  }, [place, isLoading, description, provider, empty]);

  // Track popup close events
  const handleClose = () => {
    if (place) {
      ReactGA4.event('country_info_popup_close', {
        country_name: place,
        info_provider: provider,
        had_content: !empty && !isLoading
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
