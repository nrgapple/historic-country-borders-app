import './styles.css'
import MapContainer from './components/Map'
import React from 'react'
//@ts-ignore
import HorizontalTimeline from 'react-horizontal-timeline'

export default function App() {
  return (
    <div className="App">
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
        }}
      >
        {/* <HorizontalTimeline
          index={0}
          indexClick={(index: any) => {}}
          values={[1600, 1500]}
        /> */}
        <MapContainer />
      </div>
    </div>
  )
}
