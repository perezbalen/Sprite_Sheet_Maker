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
  rows: number,
  padding: number
): SpriteSheetLayout => {
  const safeColumns = Math.max(1, Math.floor(columns))
  const safeRows = Math.max(1, Math.floor(rows))
  const safePadding = Math.max(0, Math.floor(padding))
  const fitRows = Math.max(safeRows, Math.ceil(frameCount / safeColumns))
  const sheetWidth = safeColumns * frameWidth + Math.max(0, safeColumns - 1) * safePadding
  const sheetHeight = fitRows * frameHeight + Math.max(0, fitRows - 1) * safePadding
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
