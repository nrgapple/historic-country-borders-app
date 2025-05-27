import { describe, it, expect } from 'vitest'
import {
  convertYearString,
  mapBCFormat,
  timelineBCFormat,
  mod,
  getYearFromFile,
  invertColor,
  cleanDateErrors,
  groupBy,
  closest,
  dates,
} from '../constants'

describe('constants utilities', () => {
  describe('convertYearString', () => {
    it('should format negative years using the provided formatter', () => {
      const formatter = (value: number) => `${Math.abs(value)} BC`
      expect(convertYearString(formatter, -500)).toBe('500 BC')
      expect(convertYearString(formatter, -1000)).toBe('1000 BC')
    })

    it('should return string representation for positive years', () => {
      const formatter = (value: number) => `${Math.abs(value)} BC`
      expect(convertYearString(formatter, 500)).toBe('500')
      expect(convertYearString(formatter, 1000)).toBe('1000')
    })

    it('should handle year 0', () => {
      const formatter = (value: number) => `${Math.abs(value)} BC`
      expect(convertYearString(formatter, 0)).toBe('0')
    })
  })

  describe('mapBCFormat', () => {
    it('should format negative years for map display', () => {
      expect(mapBCFormat(-500)).toBe('bc500')
      expect(mapBCFormat(-1000)).toBe('bc1000')
      expect(mapBCFormat(-1)).toBe('bc1')
    })
  })

  describe('timelineBCFormat', () => {
    it('should format negative years for timeline display', () => {
      expect(timelineBCFormat(-500)).toBe('500 BC')
      expect(timelineBCFormat(-1000)).toBe('1000 BC')
      expect(timelineBCFormat(-1)).toBe('1 BC')
    })
  })

  describe('mod', () => {
    it('should return correct modulo for positive numbers', () => {
      expect(mod(5, 3)).toBe(2)
      expect(mod(10, 4)).toBe(2)
    })

    it('should return correct modulo for negative numbers', () => {
      expect(mod(-1, 3)).toBe(2)
      expect(mod(-5, 3)).toBe(1)
    })

    it('should handle zero', () => {
      expect(mod(0, 5)).toBe(0)
    })
  })

  describe('getYearFromFile', () => {
    it('should extract year from filename', () => {
      expect(getYearFromFile('world_1000.geojson')).toBe(1000)
      expect(getYearFromFile('world_500.geojson')).toBe(500)
    })

    it('should handle BC years', () => {
      expect(getYearFromFile('world_bc500.geojson')).toBe(-500)
      expect(getYearFromFile('world_bc1000.geojson')).toBe(-1000)
    })
  })

  describe('invertColor', () => {
    it('should invert colors correctly', () => {
      expect(invertColor('#000000', false)).toBe('#ffffff')
      expect(invertColor('#ffffff', false)).toBe('#000000')
      expect(invertColor('#ff0000', false)).toBe('#00ffff')
    })

    it('should return black or white for bw mode', () => {
      expect(invertColor('#ffffff', true)).toBe('#000000')
      expect(invertColor('#000000', true)).toBe('#FFFFFF')
    })

    it('should handle 3-digit hex colors', () => {
      expect(invertColor('#000', false)).toBe('#ffffff')
      expect(invertColor('#fff', false)).toBe('#000000')
    })

    it('should handle colors without # prefix', () => {
      expect(invertColor('000000', false)).toBe('#ffffff')
      expect(invertColor('ffffff', false)).toBe('#000000')
    })

    it('should throw error for invalid hex colors', () => {
      expect(() => invertColor('invalid', false)).toThrow('Invalid HEX color.')
      expect(() => invertColor('#12345', false)).toThrow('Invalid HEX color.')
    })
  })

  describe('cleanDateErrors', () => {
    it('should divide by 10 for dates over 1000', () => {
      expect(cleanDateErrors(5000)).toBe(500)
      expect(cleanDateErrors(12000)).toBe(1200)
    })

    it('should return original date for dates under 1000', () => {
      expect(cleanDateErrors(500)).toBe(500)
      expect(cleanDateErrors(100)).toBe(100)
    })

    it('should handle edge case of exactly 1000', () => {
      expect(cleanDateErrors(1000)).toBe(1000)
    })
  })

  describe('groupBy', () => {
    it('should group array items by key', () => {
      const items = [
        { type: 'fruit', name: 'apple' },
        { type: 'fruit', name: 'banana' },
        { type: 'vegetable', name: 'carrot' },
      ]
      
      const grouped = groupBy(items, item => item.type)
      
      expect(grouped.fruit).toHaveLength(2)
      expect(grouped.vegetable).toHaveLength(1)
      expect(grouped.fruit[0].name).toBe('apple')
      expect(grouped.fruit[1].name).toBe('banana')
      expect(grouped.vegetable[0].name).toBe('carrot')
    })

    it('should handle empty array', () => {
      const grouped = groupBy([] as { type: string }[], item => item.type)
      expect(grouped).toEqual({})
    })
  })

  describe('closest', () => {
    it('should find closest number in array', () => {
      expect(closest([1, 3, 5, 7, 9], 4)).toBe(3)
      expect(closest([1, 3, 5, 7, 9], 6)).toBe(5)
      expect(closest([1, 3, 5, 7, 9], 8)).toBe(7)
    })

    it('should handle exact matches', () => {
      expect(closest([1, 3, 5, 7, 9], 5)).toBe(5)
    })

    it('should handle single element array', () => {
      expect(closest([5], 10)).toBe(5)
    })
  })

  describe('dates array', () => {
    it('should contain expected historical dates', () => {
      expect(dates).toContain(-2000)
      expect(dates).toContain(-1000)
      expect(dates).toContain(1994)
    })

    it('should be sorted in ascending order', () => {
      const sortedDates = [...dates].sort((a, b) => a - b)
      expect(dates).toEqual(sortedDates)
    })
  })
}) 