import { describe, it, expect } from 'vitest'
import { 
  stringToBrightHexColor, 
  stringToVibrantHexColor, 
  stringToVibrantHexColor2 
} from '../stringToColor'

describe('stringToColor utilities', () => {
  describe('stringToBrightHexColor', () => {
    it('should return a valid hex color', () => {
      const result = stringToBrightHexColor('test')
      expect(result).toMatch(/^#[0-9a-f]{6}$/i)
    })

    it('should return consistent colors for the same input', () => {
      const input = 'consistent-test'
      const result1 = stringToBrightHexColor(input)
      const result2 = stringToBrightHexColor(input)
      expect(result1).toBe(result2)
    })

    it('should return different colors for different inputs', () => {
      const result1 = stringToBrightHexColor('input1')
      const result2 = stringToBrightHexColor('input2')
      expect(result1).not.toBe(result2)
    })

    it('should handle empty string', () => {
      const result = stringToBrightHexColor('')
      expect(result).toMatch(/^#[0-9a-f]{6}$/i)
    })
  })

  describe('stringToVibrantHexColor', () => {
    it('should return a valid hex color', () => {
      const result = stringToVibrantHexColor('test')
      expect(result).toMatch(/^#[0-9a-f]{6}$/i)
    })

    it('should return consistent colors for the same input', () => {
      const input = 'vibrant-test'
      const result1 = stringToVibrantHexColor(input)
      const result2 = stringToVibrantHexColor(input)
      expect(result1).toBe(result2)
    })

    it('should return different colors for different inputs', () => {
      const result1 = stringToVibrantHexColor('input1')
      const result2 = stringToVibrantHexColor('input2')
      expect(result1).not.toBe(result2)
    })
  })

  describe('stringToVibrantHexColor2', () => {
    it('should return a valid hex color', () => {
      const result = stringToVibrantHexColor2('test')
      expect(result).toMatch(/^#[0-9a-f]{6}$/i)
    })

    it('should return consistent colors for the same input', () => {
      const input = 'vibrant2-test'
      const result1 = stringToVibrantHexColor2(input)
      const result2 = stringToVibrantHexColor2(input)
      expect(result1).toBe(result2)
    })

    it('should return different colors for different inputs', () => {
      const result1 = stringToVibrantHexColor2('input1')
      const result2 = stringToVibrantHexColor2('input2')
      expect(result1).not.toBe(result2)
    })

    it('should handle special characters', () => {
      const result = stringToVibrantHexColor2('test@#$%^&*()')
      expect(result).toMatch(/^#[0-9a-f]{6}$/i)
    })
  })

  describe('color function comparison', () => {
    it('should produce different results from different functions', () => {
      const input = 'comparison-test'
      const bright = stringToBrightHexColor(input)
      const vibrant1 = stringToVibrantHexColor(input)
      const vibrant2 = stringToVibrantHexColor2(input)

      // They should all be valid hex colors
      expect(bright).toMatch(/^#[0-9a-f]{6}$/i)
      expect(vibrant1).toMatch(/^#[0-9a-f]{6}$/i)
      expect(vibrant2).toMatch(/^#[0-9a-f]{6}$/i)

      // They should produce different results (most likely)
      expect(new Set([bright, vibrant1, vibrant2]).size).toBeGreaterThan(1)
    })
  })
}) 