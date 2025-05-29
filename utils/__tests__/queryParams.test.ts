import { describe, it, expect } from 'vitest'
import {
  parseQueryParams,
  getMapViewFromQuery,
  formatMapCoordinates,
  isValidYear,
  getDefaultYear,
} from '../queryParams'
import { DEFAULT_MAP_VIEW } from '../../types/query'

describe('queryParams utilities', () => {
  describe('parseQueryParams', () => {
    it('should return empty object for null/undefined query', () => {
      expect(parseQueryParams(null)).toEqual({})
      expect(parseQueryParams(undefined)).toEqual({})
    })

    it('should parse string parameters correctly', () => {
      const query = {
        lng: '10.5',
        lat: '20.3',
        zoom: '5',
      }
      
      const result = parseQueryParams(query)
      
      expect(result).toEqual({
        lng: '10.5',
        lat: '20.3',
        zoom: '5',
      })
    })

    it('should handle array values by taking first element', () => {
      const query = {
        lng: ['10.5', '11.5'],
        lat: ['20.3', '21.3'],
      }
      
      const result = parseQueryParams(query)
      
      expect(result).toEqual({
        lng: '10.5',
        lat: '20.3',
        zoom: undefined,
      })
    })

    it('should handle missing parameters', () => {
      const query = {
        lng: '10.5',
      }
      
      const result = parseQueryParams(query)
      
      expect(result).toEqual({
        lng: '10.5',
        lat: undefined,
        zoom: undefined,
      })
    })
  })

  describe('getMapViewFromQuery', () => {
    it('should return default values for empty query', () => {
      const result = getMapViewFromQuery({})
      
      expect(result).toEqual(DEFAULT_MAP_VIEW)
    })

    it('should parse valid coordinates', () => {
      const query = {
        lng: '10.5',
        lat: '20.3',
        zoom: '8',
      }
      
      const result = getMapViewFromQuery(query)
      
      expect(result).toEqual({
        longitude: 10.5,
        latitude: 20.3,
        zoom: 8,
      })
    })

    it('should use defaults for invalid coordinates', () => {
      const query = {
        lng: 'invalid',
        lat: 'also-invalid',
        zoom: 'not-a-number',
      }
      
      const result = getMapViewFromQuery(query)
      
      expect(result).toEqual(DEFAULT_MAP_VIEW)
    })

    it('should mix valid and invalid values correctly', () => {
      const query = {
        lng: '10.5',
        lat: 'invalid',
        zoom: '8',
      }
      
      const result = getMapViewFromQuery(query)
      
      expect(result).toEqual({
        longitude: 10.5,
        latitude: DEFAULT_MAP_VIEW.latitude,
        zoom: 8,
      })
    })
  })

  describe('formatMapCoordinates', () => {
    it('should format coordinates to 7 decimal places', () => {
      const result = formatMapCoordinates(10.123456789, 20.987654321, 5.5)
      
      expect(result).toEqual({
        lng: '10.1234568',
        lat: '20.9876543',
        zoom: '5.5000000',
      })
    })

    it('should handle integer values', () => {
      const result = formatMapCoordinates(10, 20, 5)
      
      expect(result).toEqual({
        lng: '10.0000000',
        lat: '20.0000000',
        zoom: '5.0000000',
      })
    })

    it('should handle negative coordinates', () => {
      const result = formatMapCoordinates(-10.5, -20.3, 8.2)
      
      expect(result).toEqual({
        lng: '-10.5000000',
        lat: '-20.3000000',
        zoom: '8.2000000',
      })
    })
  })

  describe('isValidYear', () => {
    const availableYears = [1000, 1500, 2000, 2023]

    it('should return true for valid years', () => {
      expect(isValidYear('1000', availableYears)).toBe(true)
      expect(isValidYear('2023', availableYears)).toBe(true)
    })

    it('should return false for invalid years', () => {
      expect(isValidYear('1999', availableYears)).toBe(false)
      expect(isValidYear('3000', availableYears)).toBe(false)
    })

    it('should return false for non-numeric strings', () => {
      expect(isValidYear('abc', availableYears)).toBe(false)
      expect(isValidYear('20a3', availableYears)).toBe(false)
    })

    it('should return false for undefined/empty year', () => {
      expect(isValidYear(undefined, availableYears)).toBe(false)
      expect(isValidYear('', availableYears)).toBe(false)
    })

    it('should handle empty available years array', () => {
      expect(isValidYear('2023', [])).toBe(false)
    })
  })

  describe('getDefaultYear', () => {
    it('should return first year as string', () => {
      const availableYears = [1000, 1500, 2000, 2023]
      expect(getDefaultYear(availableYears)).toBe('1000')
    })

    it('should handle single year array', () => {
      const availableYears = [2023]
      expect(getDefaultYear(availableYears)).toBe('2023')
    })

    it('should return empty string for empty array', () => {
      expect(getDefaultYear([])).toBe('')
    })

    it('should handle negative years', () => {
      const availableYears = [-500, 0, 1000]
      expect(getDefaultYear(availableYears)).toBe('-500')
    })
  })
}) 