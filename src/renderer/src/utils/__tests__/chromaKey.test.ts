import { describe, expect, it } from 'vitest'
import { applyChromaKey } from '../chromaKey'

describe('applyChromaKey', () => {
  it('keys out exact color matches with zero tolerance', () => {
    const data = new Uint8ClampedArray([
      0, 255, 0, 255,
      255, 0, 0, 255
    ])
    const imageData = { data, width: 2, height: 1 } as unknown as ImageData
    const result = applyChromaKey(imageData, {
      colors: [{ r: 0, g: 255, b: 0 }],
      tolerance: 0,
      feather: 0
    })
    expect(result.data[3]).toBe(0)
    expect(result.data[7]).toBe(255)
  })

  it('leaves alpha untouched when no key colors are provided', () => {
    const data = new Uint8ClampedArray([10, 20, 30, 200])
    const imageData = { data, width: 1, height: 1 } as unknown as ImageData
    const result = applyChromaKey(imageData, { colors: [], tolerance: 10, feather: 5 })
    expect(result.data[3]).toBe(200)
  })
})
