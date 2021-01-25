import 'mapbox-gl/dist/mapbox-gl.css';
//@ts-ignore
import mapboxgl from 'mapbox-gl';
import ReactMapboxGl from 'react-mapbox-gl';

export const workerSet = async () => {
  try {
    const worker = await import(
      //@ts-ignore
      'worker-loader!mapbox-gl/dist/mapbox-gl-csp-worker'
    );
    console.log('here');
    //@ts-ignore
    // eslint-disable-next-line import/no-webpack-loader-syntax
    mapboxgl.workerClass = worker.default;
  } catch {
    console.log('In a sandbox');
  }
};
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
