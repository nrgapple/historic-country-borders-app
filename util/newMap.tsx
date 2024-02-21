import Map from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { ComponentProps } from 'react';

export default function NewMap(props: ComponentProps<typeof Map>) {
  return (
    <Map
      {...props}
      reuseMaps
      minZoom={1}
      maxZoom={15}
      mapboxAccessToken={
        'pk.eyJ1IjoibnJnYXBwbGUiLCJhIjoiY2trN2E1YnVvMGJ4OTJwbWptM25waHVmNyJ9.UxvOXdAatpV-H1AXQQ23Kg'
      }
      mapStyle="mapbox://styles/nrgapple/ckk7nff4z0jzj17pitiuejlvt"
    />
  );
}
