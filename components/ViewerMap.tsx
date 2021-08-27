import React, {
  useEffect,
  useRef,
  useState,
  useMemo,
  forwardRef,
  MutableRefObject,
} from 'react';
import { GeoJSONLayer, Popup } from 'react-mapbox-gl';
import MapboxGl from 'mapbox-gl';
import { useData } from '../hooks/useData';
import Map from '../util/ReactMapBoxGl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Feature, FeatureCollection, MultiPolygon, Point } from 'geojson';
import dynamic from 'next/dynamic';
import { invertColor, multiPolygonToPolygon } from '../util/constants';
import hexToRgba from 'hex-rgba';
import { GlobeProps } from 'react-globe.gl';
import { useParentSize } from '../hooks/useParentSize';
import text from '../util/Roboto_Regular.json';
import { MapEvent } from 'react-mapbox-gl/lib/map-events';
import { useWikiData } from '../hooks/useWiki';

const GlobeTmpl = dynamic(() => import('../util/GlobeWrapper'), {
  ssr: false,
});

const Globe = forwardRef((props: GlobeProps, ref) => (
  <GlobeTmpl {...props} forwardRef={ref} />
));

interface MapContainerProps {
  year: string;
  user: string;
  id: string;
  fullscreen?: boolean;
  threeD: boolean;
}

const MapContainer = ({
  year,
  fullscreen,
  user,
  id,
  threeD = true,
}: MapContainerProps) => {
  const [, data] = useData(year, user, id);
  const [zoomValue, setZoomValue] = useState(2);
  const mapRef = useRef<MapboxGl.Map | undefined>(undefined);
  const globeRef = useRef<any>(undefined);
  const parentRef = useRef<HTMLDivElement>(null);
  const { height, width, refresh } = useParentSize(parentRef);
  const [hasSetStartPosition, setHasSetStartPosition] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState('');
  const [popupPos, setPopupPos] = useState([0, 0]);
  const wikiInfo = useWikiData(selectedPlace);

  const setColors = (d: {}) => {
    const feature = d as Feature;
    return hexToRgba(feature.properties!.COLOR, 70);
  };

  const resetGlobePosition = () => {
    if (globeRef.current && threeD) {
      globeRef.current.pointOfView({
        lat: 46.71109,
        lng: 1.7191036,
        altitude: 1,
      });
      setHasSetStartPosition(true);
    }
  };

  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.resize();
    }
    if (globeRef.current) {
      refresh();
    }
  }, [fullscreen]);

  useEffect(() => {
    if (!hasSetStartPosition) {
      if (!globeRef.current) {
        setTimeout(() => {
          resetGlobePosition();
        }, 400);
      }
      resetGlobePosition();
    }
  }, [globeRef.current, threeD]);

  useEffect(() => {
    if (!threeD) setHasSetStartPosition(false);
  }, [threeD]);

  const average = (array: any) =>
    array.reduce((a: any, b: any) => a + b) / array.length;

  const maxArea = useMemo(() => {
    if (data) {
      const values = data?.labels.features.map((x) =>
        parseFloat(x.properties?.AREA),
      );
      return average(values!);
    }
    return undefined;
  }, [data]);

  const size = (value: number) => {
    if (maxArea) {
      const ratio = value / maxArea;
      if (ratio > 1) {
        return 0.7;
      }
      if (ratio < 0.1) {
        return 0.1;
      }
      return ratio;
    }
    return 0.5;
  };

  return (
    <div className="map-grid" ref={parentRef}>
      {threeD ? (
        <>
          {data && (
            <>
              <Globe
                height={height}
                width={width}
                globeImageUrl="//unpkg.com/three-globe@2.15.1/example/img/earth-blue-marble.jpg"
                showAtmosphere={false}
                backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
                waitForGlobeReady={false}
                polygonsData={
                  multiPolygonToPolygon(
                    data.borders as FeatureCollection<MultiPolygon>,
                  ).features
                }
                polygonAltitude={0.01}
                polygonStrokeColor={() => '#000'}
                polygonCapColor={setColors}
                polygonSideColor={() => 'rgba(0, 100, 0, 0.15)'}
                polygonsTransitionDuration={0}
                labelsData={data.labels.features}
                labelLat={(d) => (d as Feature<Point>).geometry.coordinates[1]}
                labelLng={(d) => (d as Feature<Point>).geometry.coordinates[0]}
                labelText={(d) => (d as Feature<Point>).properties?.NAME}
                labelColor={(d) =>
                  invertColor((d as Feature<Point>).properties?.COLOR, true)
                }
                labelSize={(d) => {
                  return size(
                    parseFloat((d as Feature<Point>).properties?.AREA),
                  );
                }}
                labelAltitude={0.015}
                labelIncludeDot={false}
                labelsTransitionDuration={0}
                animateIn={false}
                ref={globeRef}
                labelTypeFace={text}
              />
            </>
          )}
        </>
      ) : (
        <Map
          className="map"
          zoom={[zoomValue]}
          style="mapbox://styles/nrgapple/ckk7nff4z0jzj17pitiuejlvt"
          onStyleLoad={(map: MapboxGl.Map) => {
            mapRef.current = map;
            map.resize();
          }}
          onZoomEnd={(map) => {
            setZoomValue(map.getZoom());
          }}
          onClick={(e) => setSelectedPlace('')}
        >
          {data && (
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
              <GeoJSONLayer
                data={data.borders}
                fillPaint={{
                  'fill-color': ['get', 'COLOR'],
                  'fill-opacity': 0.5,
                }}
                fillOnClick={(e: any) => {
                  console.log(e);
                  setSelectedPlace(e.features[0]?.properties.NAME);
                  setPopupPos((curr) => [...(Object.values(e.lngLat) as any)]);
                }}
              />
              <GeoJSONLayer
                data={data.labels}
                symbolLayout={{
                  'text-field': '{NAME}',
                  'text-font': ['Lato Bold'],
                  'text-size': {
                    base: 1,
                    stops: [
                      [12, 12],
                      [16, 16],
                    ],
                  },
                  'text-padding': 3,
                  'text-letter-spacing': 0.1,
                  'text-max-width': 7,
                  'text-transform': 'uppercase',
                }}
              />
            </>
          )}
        </Map>
      )}
    </div>
  );
};

export default MapContainer;
