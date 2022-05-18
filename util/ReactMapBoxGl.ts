import 'mapbox-gl/dist/mapbox-gl.css';
import ReactMapboxGl from 'react-mapbox-gl';

/**
 * Configuration values for Mapbox Component.
 *
 * @interface ReactMapboxGl interface with configurations for creating the map.
 */

export default ReactMapboxGl({
  accessToken:
    'pk.eyJ1IjoibnJnYXBwbGUiLCJhIjoiY2trN2E1YnVvMGJ4OTJwbWptM25waHVmNyJ9.UxvOXdAatpV-H1AXQQ23Kg',
  minZoom: 1,
  maxZoom: 15,
});
