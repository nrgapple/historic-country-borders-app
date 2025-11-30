import Map from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { ComponentProps, forwardRef } from 'react';
import { mapboxToken } from './constants';

const MapboxDefaultMap = forwardRef<any, ComponentProps<typeof Map>>((props, ref) => {
  return (
    <Map
      {...props}
      ref={ref}
      reuseMaps
      minZoom={props.minZoom ?? 1}
      maxZoom={props.maxZoom ?? 15}
      mapboxAccessToken={mapboxToken}
      mapStyle="mapbox://styles/nrgapple1/cm4awphea01dn01s3ajotcscl"
    />
  );
});

MapboxDefaultMap.displayName = 'MapboxDefaultMap';

export default MapboxDefaultMap;
