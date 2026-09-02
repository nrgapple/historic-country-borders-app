import { Popup } from 'react-map-gl';
import { useAllowScroll } from '../hooks/useScrollLock';
import { useEffect, useMemo } from 'react';
import ReactGA4 from 'react-ga4';
import { useCountryInfo } from '../hooks/useCountryInfo';
import { CoordTuple } from '../util/types';

export interface Info {
  position: CoordTuple;
  place: string;
}

interface PopupInfoProps {
  info: Info | undefined;
  onClose?: () => void;
}

const noData = 'Not Found';

export default function PopupInfo({ info, onClose }: PopupInfoProps) {
  const { position, place = '' } = info ?? {};
  const { info: description, title, isLoading } = useCountryInfo(place);
  const empty = useMemo(
    () => !description || description.trim() === '' || description === noData,
    [description],
  );

  useAllowScroll('.popup-description', !!place);

  useEffect(() => {
    if (place && position) {
      ReactGA4.event('country_info_popup_view', {
        country_name: place,
        info_source: 'wikipedia',
        popup_type: 'country_information',
      });
    }
  }, [place, position]);

  const popupStyle = empty
    ? { width: '220px', height: '100px', maxWidth: '90vw', maxHeight: '60vh' }
    : { width: '280px', height: '280px', maxWidth: '90vw', maxHeight: '70vh' };
  const descriptionClass = `popup-description${
    isLoading ? ' loading' : empty ? ' empty' : ''
  }`;

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
            ReactGA4.event('country_info_popup_close', {
              country_name: place,
              info_source: 'wikipedia',
              had_content: !empty && !isLoading,
            });
            onClose?.();
          }}
        >
          <div className="popup-title">
            {title || place}
            {!isLoading && !empty && (
              <span className="provider-indicator" title="Wikipedia">
                📖
              </span>
            )}
          </div>
          <div className={descriptionClass}>
            {isLoading ? (
              '📚 Loading information...'
            ) : empty ? (
              <>
                📖 No Wikipedia information available
                <br />
                for this location 😔
              </>
            ) : (
              description
            )}
          </div>
        </Popup>
      )}
    </>
  );
}
