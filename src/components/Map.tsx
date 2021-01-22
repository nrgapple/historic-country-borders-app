import React from 'react'
import ReactMapboxGl, {
  Layer,
  Feature,
  Source,
  GeoJSONLayer
} from 'react-mapbox-gl'
import stc from 'string-to-color'
import 'mapbox-gl/dist/mapbox-gl.css'

const Map = ReactMapboxGl({
  accessToken:
    'pk.eyJ1IjoibnJnYXBwbGUiLCJhIjoiY2trN2E1YnVvMGJ4OTJwbWptM25waHVmNyJ9.UxvOXdAatpV-H1AXQQ23Kg'
})

const MapContainer = () => {
  const countryLines = {
    type: 'geojson',
    data:
      'https://raw.githubusercontent.com/aourednik/historical-basemaps/master/world_bc1000.geojson'
  }

  return (
    <Map
      style="mapbox://styles/mapbox/streets-v9"
      containerStyle={{
        height: '100vh',
        width: '100vw'
      }}
      zoom={[3]}
    >
      <Source id="country_lines" geoJsonSource={countryLines} />
      <GeoJSONLayer
        data="https://raw.githubusercontent.com/aourednik/historical-basemaps/master/world_1920.geojson"
        fillPaint={{
          'fill-color': [
            'rgb',
            ['to-number', ['get', 'NAME']],
            ['to-number', ['get', 'NAME']],
            ['to-number', ['get', 'NAME']]
          ],
          'fill-opacity': 0.5,
          'fill-outline-color': '#f00'
        }}
      />
    </Map>
  )
}

export default MapContainer
