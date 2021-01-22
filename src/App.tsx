import './styles.css'
import MapContainer from './components/Map'
import React, { useState } from 'react'
//@ts-ignore
import HorizontalTimeline from 'react-horizontal-timeline'
import { dates } from './util/constants'

export default function App() {
  const [index, setIndex] = useState(0)

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
            index={index}
            indexClick={(newIndex: number) => {
              setIndex(newIndex)
            }}
            getLabel={(date: any) => new Date(date, 0).getFullYear()}
            values={dates}
          />
        </div>
      </div>
      <div className="grid">
        <MapContainer year={dates[index].toString()} />
      </div>
    </>
  )
}
