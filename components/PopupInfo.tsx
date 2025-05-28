import { Popup } from 'react-map-gl';
import { useAllowScroll } from '../hooks/useScrollLock';
import { useEffect, useMemo } from 'react';
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
          onClose={() => {
            onClose?.();
          }}
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
