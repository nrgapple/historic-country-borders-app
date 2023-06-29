import { Popup } from 'react-mapbox-gl';
import { disableBodyScroll, enableBodyScroll } from 'body-scroll-lock';
import { useEffect, useMemo } from 'react';

interface PopupInfoProps {
  position: [lng: number, lat: number];
  title: string;
  description: string;
  isLoading?: boolean;
}

export default function PopupInfo({
  position,
  title,
  description,
  isLoading,
}: PopupInfoProps) {
  const empty = useMemo(
    () => !description || description.trim() === '' || description === noData,
    [description],
  );
  useEffect(() => {
    const el = document.querySelector('.popup-description') as HTMLElement;
    disableBodyScroll(el);
  }, []);
  return (
    <Popup
      className="popup-border"
      style={{
        width: empty ? '200px' : '250px',
        height: empty ? '100px' : '250px',
      }}
      coordinates={position}
    >
      <div className="popup-container">
        <div className="popup-title">{title}</div>
        {isLoading ? (
          <div className="popup-description">Loading...</div>
        ) : empty ? (
          <div className="popup-description">No Info 😔</div>
        ) : (
          <div className="popup-description">{description}</div>
        )}
      </div>
    </Popup>
  );
}

const noData = 'Not Found';
