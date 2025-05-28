import { Popup } from 'react-map-gl';
import { disableBodyScroll, enableBodyScroll } from 'body-scroll-lock';
import { useEffect, useMemo } from 'react';
import { useWikiData } from '../hooks/useWiki';
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
  const { info: description, title: title, isLoading } = useWikiData(place);
  const empty = useMemo(
    () => !description || description.trim() === '' || description === noData,
    [description],
  );

  useEffect(() => {
    const el = document.querySelector('.popup-description') as HTMLElement;
    if (el) {
      enableBodyScroll(el);
      return () => {
        disableBodyScroll(el);
      };
    }
  }, []);

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
          <div className="popup-title">{title || place}</div>
          <div className={descriptionClass}>
            {isLoading ? (
              <>📚 Loading information...</>
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
