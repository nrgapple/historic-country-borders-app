import React, { useEffect, useState } from 'react'

const url =
  'https://raw.githubusercontent.com/aourednik/historical-basemaps/master/world_bc1000.geojson'

const useData = (value: string) => {
  const [isLoading, setIsLoading] = useState(true)
  const [url, setUrl] = useState<string | undefined>(undefined)
  const [data, setData] = useState<any | undefined>(undefined)
  useEffect(() => {
    if (value) {
      setUrl(
        `https://raw.githubusercontent.com/aourednik/historical-basemaps/master/world_${value}.geojson`
      )
    }
  }, [value])

  useEffect(() => {
    if (url) {
      ;(async () => {
        const resp = await fetch(url)
        setData(await resp.json())
      })()
    }
  }, [url])
}
