import { describe, expect, it } from 'vitest'
import { calculateSpriteSheetLayout } from '../spriteSheet'

describe('calculateSpriteSheetLayout', () => {
  it('computes dimensions and placements with padding', () => {
    const layout = calculateSpriteSheetLayout(32, 16, 3, 2, 2, 4)
    expect(layout.sheetWidth).toBe(32 * 2 + 4)
    expect(layout.sheetHeight).toBe(16 * 2 + 4)
    expect(layout.cells[0]).toEqual({ x: 0, y: 0, width: 32, height: 16 })
    expect(layout.cells[1]).toEqual({ x: 36, y: 0, width: 32, height: 16 })
    expect(layout.cells[2]).toEqual({ x: 0, y: 20, width: 32, height: 16 })
  })
})
