import './styles.css'
import MapContainer from './components/Map'
import React from 'react'
//@ts-ignore
import HorizontalTimeline from 'react-horizontal-timeline'

export default function App() {
  return (
    <>
      <div className="grid">
        <div
          style={{
            width: '100%',
            height: '100px',
            fontSize: '15px',
          }}
        >
          <HorizontalTimeline
            styles={{
              background: '#fff',
              foreground: '#1A79AD',
              outline: '#dfdfdf',
            }}
            index={0}
            indexClick={(index: any) => {}}
            getLabel={(date: any, index: any) => new Date(date).getFullYear()}
            values={['1520']}
          />
        </div>
      </div>
      <div className="grid">
        <MapContainer />
      </div>
    </>
  )
}
