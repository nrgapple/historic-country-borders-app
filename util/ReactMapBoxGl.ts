import 'mapbox-gl/dist/mapbox-gl.css';
import ReactMapboxGl from 'react-mapbox-gl';
import { mapboxToken } from './constants';

/**
 * Configuration values for Mapbox Component.
 *
 * @interface ReactMapboxGl interface with configurations for creating the map.
 */

export default ReactMapboxGl({
  accessToken: mapboxToken,
  minZoom: 1,
  maxZoom: 15,
});
