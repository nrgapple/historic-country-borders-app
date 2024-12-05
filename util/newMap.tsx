import Map from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { ComponentProps } from 'react';
import { mapboxToken } from './constants';

export default function NewMap(props: ComponentProps<typeof Map>) {
  return (
    <Map
      {...props}
      reuseMaps
      minZoom={1}
      maxZoom={15}
      mapboxAccessToken={mapboxToken}
      mapStyle="mapbox://styles/nrgapple1/cm4awphea01dn01s3ajotcscl"
    />
  );
}
