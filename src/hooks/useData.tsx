import {
  FeatureCollection,
  GeoJsonProperties,
  Feature,
  MultiPolygon,
  Point,
  Geometry,
} from 'geojson'
import { useEffect, useState } from 'react'
import stc from 'string-to-color'
import polylabel from 'polylabel'

export interface CountryData {
  labels: FeatureCollection
  borders: FeatureCollection
}

export const useData = (value: string) => {
  const [isLoading, setIsLoading] = useState(true)
  const [url, setUrl] = useState<string | undefined>(undefined)
  const [data, setData] = useState<CountryData | undefined>(undefined)

  const processData = (data: FeatureCollection) => {
    const featureParts = data.features.map((feature) => {
      const color = stc(feature.properties!.NAME)
      const labels = (feature.geometry as MultiPolygon).coordinates
        .map((x) => polylabel(x))
        .map((x) => ({
          geometry: {
            type: 'Point',
            coordinates: x,
          } as Point,
          properties: {
            ...feature.properties,
            COLOR: color,
          } as GeoJsonProperties,
        })) as Feature[]

      const bounds = {
        geometry: feature.geometry,
        properties: {
          ...feature.properties,
          COLOR: color,
        } as GeoJsonProperties,
      } as Feature
      return {
        bounds,
        labels,
      }
    })
    const labelCol = {
      ...data,
      features: featureParts.map((x) => x.labels).flat(1),
    } as FeatureCollection
    const boundCol = {
      ...data,
      features: featureParts.map((x) => x.bounds),
    } as FeatureCollection
    return {
      labels: labelCol,
      borders: boundCol,
    } as CountryData
  }

  useEffect(() => {
    if (value) {
      setIsLoading(true)
      setUrl(
        `https://raw.githubusercontent.com/aourednik/historical-basemaps/master/world_${value}.geojson`,
      )
    }
  }, [value])

  useEffect(() => {
    if (url) {
      ;(async () => {
        try {
          const resp = await fetch(url)
          const mapData = await resp.json()
          setData(processData(mapData as FeatureCollection))
        } catch (error) {
          console.error(error)
        }
      })()
    }
  }, [url])

  useEffect(() => {
    if (data) {
      setIsLoading(false)
    }
  }, [data])

  return [isLoading, data] as const
}
