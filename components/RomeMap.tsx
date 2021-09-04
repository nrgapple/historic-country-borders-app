import { FeatureCollection } from 'geojson';
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useParentSize } from '../hooks/useParentSize';
import MapboxGl from 'mapbox-gl';
import Map from '../util/ReactMapBoxGl';
import { GeoJSONLayer, Popup } from 'react-mapbox-gl';
import { FeatureCollectionOptStyle, MapImage } from '../util/types';
import { useWikiData } from '../hooks/useWiki';

interface MapContainerProps {
  fullscreen?: boolean;
  layers: FeatureCollectionOptStyle[];
}

const MapContainer = ({ fullscreen, layers }: MapContainerProps) => {
  const [zoomValue, setZoomValue] = useState(2);
  const mapRef = useRef<MapboxGl.Map | undefined>(undefined);
  const parentRef = useRef<HTMLDivElement>(null);
  const { height, width, refresh } = useParentSize(parentRef);
  const [hasSetStartPosition, setHasSetStartPosition] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState('');
  const [popupPos, setPopupPos] = useState([0, 0]);
  const [loaded, setLoaded] = useState(false);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const wikiInfo = useWikiData(selectedPlace);

  useEffect(() => {
    console.log('here');
    if (mapRef.current) {
      mapRef.current!.resize();
      setUpMap();
    }
  }, [fullscreen]);

  useEffect(() => {
    if (loaded && !imagesLoaded && layers && layers.length > 0) {
      setUpMap();
    }
  }, [layers, loaded]);

  const setUpMap = async () => {
    console.log('staring images');
    await Promise.all(
      Array.from(
        new Set(layers.filter((x) => x.style?.image).map((x) => x.style)),
      ).map(async (s) => {
        const imageData = s!.image;
        await setImageData(imageData);
        console.log('done');
      }),
    );
    setImagesLoaded((curr) => true);

    console.log('ending images');
  };

  const setImageData = (imageData: MapImage | undefined) =>
    new Promise((res, rej) => {
      if (imageData) {
        mapRef.current!.loadImage(imageData.url, (error, image) => {
          console.log(image);
          if (error) rej(error);
          // Add the image to the map style.
          mapRef.current!.addImage(imageData.id, image!);
          res(null);
        });
      }
    });

  const renderLayers = useMemo(
    () =>
      layers.map((l, i) => {
        const layout = l.style?.layout;
        console.log('style', layout);
        return (
          <GeoJSONLayer
            key={i}
            data={l}
            symbolLayout={
              layout ?? {
                'text-field': '{title}',
                'text-font': ['Lato Bold'],
                'text-size': {
                  base: 0.01,
                  stops: [
                    [5, 5],
                    [9, 12],
                  ],
                },
                'text-padding': 3,
                'text-letter-spacing': 0.1,
                'text-max-width': 7,
                'text-transform': 'uppercase',
              }
            }
            symbolOnClick={(e: any) => {
              console.log('wiki', e.features);
              setSelectedPlace(`${e.features[0]?.properties.title}`);
              setPopupPos((curr) => [...(Object.values(e.lngLat) as any)]);
            }}
          />
        );
      }),
    [layers, mapRef.current],
  );

  return (
    <div className="map-grid" ref={parentRef}>
      <Map
        className="map"
        zoom={[zoomValue]}
        style="mapbox://styles/nrgapple/ckk7nff4z0jzj17pitiuejlvt"
        onStyleLoad={(map: MapboxGl.Map) => {
          mapRef.current = map;
          map.resize();
          setLoaded((curr) => true);
        }}
        onZoomEnd={(map) => {
          setZoomValue(map.getZoom());
        }}
        onClick={(e) => setSelectedPlace('')}
      >
        <>
          {selectedPlace && (
            <Popup
              style={{
                width: '250px',
                height: '250px',
              }}
              coordinates={popupPos}
            >
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  color: 'black',
                  overflow: 'scroll',
                }}
              >
                {wikiInfo}
              </div>
            </Popup>
          )}
          {loaded ? renderLayers : <></>}
        </>
      </Map>
    </div>
  );
};

export default MapContainer;
