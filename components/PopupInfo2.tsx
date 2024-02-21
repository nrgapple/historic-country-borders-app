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
    enableBodyScroll(el);
    return () => {
      disableBodyScroll(el);
    };
  }, []);

  return (
    <>
      {place && position && (
        <Popup
          anchor="top"
          className="popup-border"
          style={{
            width: empty ? '200px' : '250px',
            height: empty ? '100px' : '250px',
          }}
          latitude={position[1]}
          longitude={position[0]}
          closeOnClick={false}
          closeOnMove={false}
          onClose={() => {
            onClose?.();
          }}
        >
          <div className="popup-title">{title}</div>
          {isLoading ? (
            <div className="popup-description">Loading...</div>
          ) : empty ? (
            <div className="popup-description">No Info 😔</div>
          ) : (
            <div className="popup-description">{description}</div>
          )}
        </Popup>
      )}
    </>
  );
}

const noData = 'Not Found';
