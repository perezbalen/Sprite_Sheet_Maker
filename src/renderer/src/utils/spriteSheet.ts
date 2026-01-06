export type SpriteSheetCell = { x: number; y: number; width: number; height: number }

export type SpriteSheetLayout = {
  sheetWidth: number
  sheetHeight: number
  cells: SpriteSheetCell[]
}

export const calculateSpriteSheetLayout = (
  frameWidth: number,
  frameHeight: number,
  frameCount: number,
  columns: number,
  padding: number
): SpriteSheetLayout => {
  const safeColumns = Math.max(1, Math.floor(columns))
  const safePadding = Math.max(0, Math.floor(padding))
  const rows = Math.max(1, Math.ceil(frameCount / safeColumns))
  const sheetWidth = safeColumns * frameWidth + Math.max(0, safeColumns - 1) * safePadding
  const sheetHeight = rows * frameHeight + Math.max(0, rows - 1) * safePadding
  const cells: SpriteSheetCell[] = []

  for (let index = 0; index < frameCount; index++) {
    const col = index % safeColumns
    const row = Math.floor(index / safeColumns)
    cells.push({
      x: col * (frameWidth + safePadding),
      y: row * (frameHeight + safePadding),
      width: frameWidth,
      height: frameHeight
    })
  }

  return { sheetWidth, sheetHeight, cells }
}
