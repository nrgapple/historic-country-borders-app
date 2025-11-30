import Map from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { ComponentProps, forwardRef } from 'react';
import { mapboxToken } from './constants';

interface MapboxDefaultMapProps extends ComponentProps<typeof Map> {
  mapStyle?: string;
}

const MapboxDefaultMap = forwardRef<any, MapboxDefaultMapProps>((props, ref) => {
  const { mapStyle, ...restProps } = props;
  // Default to Mapbox Streets style if not specified, otherwise use custom style for main map
  const defaultStyle = mapStyle ?? "mapbox://styles/mapbox/streets-v12";
  
  return (
    <Map
      {...restProps}
      ref={ref}
      reuseMaps
      minZoom={props.minZoom ?? 1}
      maxZoom={props.maxZoom ?? 15}
      mapboxAccessToken={mapboxToken}
      mapStyle={defaultStyle}
    />
  );
});

MapboxDefaultMap.displayName = 'MapboxDefaultMap';

export default MapboxDefaultMap;
