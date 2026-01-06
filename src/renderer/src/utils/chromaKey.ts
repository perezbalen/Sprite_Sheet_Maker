export type RGBColor = { r: number; g: number; b: number }

export type ChromaKeySettings = {
  colors: RGBColor[]
  tolerance: number
  feather: number
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

const colorDistance = (r: number, g: number, b: number, color: RGBColor) => {
  const dr = r - color.r
  const dg = g - color.g
  const db = b - color.b
  return Math.sqrt(dr * dr + dg * dg + db * db)
}

const blurAlpha = (alpha: Uint8ClampedArray, width: number, height: number, radius: number) => {
  const r = Math.max(0, Math.floor(radius))
  if (r === 0) return alpha
  const tmp = new Uint8ClampedArray(alpha.length)
  const result = new Uint8ClampedArray(alpha.length)
  const windowSize = r * 2 + 1

  for (let y = 0; y < height; y++) {
    let sum = 0
    for (let x = -r; x <= r; x++) {
      const clampedX = clamp(x, 0, width - 1)
      sum += alpha[y * width + clampedX]
    }
    for (let x = 0; x < width; x++) {
      tmp[y * width + x] = Math.round(sum / windowSize)
      const removeX = clamp(x - r, 0, width - 1)
      const addX = clamp(x + r + 1, 0, width - 1)
      sum += alpha[y * width + addX] - alpha[y * width + removeX]
    }
  }

  for (let x = 0; x < width; x++) {
    let sum = 0
    for (let y = -r; y <= r; y++) {
      const clampedY = clamp(y, 0, height - 1)
      sum += tmp[clampedY * width + x]
    }
    for (let y = 0; y < height; y++) {
      result[y * width + x] = Math.round(sum / windowSize)
      const removeY = clamp(y - r, 0, height - 1)
      const addY = clamp(y + r + 1, 0, height - 1)
      sum += tmp[addY * width + x] - tmp[removeY * width + x]
    }
  }

  return result
}

export const applyChromaKey = (imageData: ImageData, settings: ChromaKeySettings) => {
  const { data, width, height } = imageData
  if (!settings.colors.length) {
    return imageData
  }
  const alphaMask = new Uint8ClampedArray(width * height)
  const tolerance = clamp(settings.tolerance, 0, 442)

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    let minDistance = Number.POSITIVE_INFINITY
    for (const color of settings.colors) {
      const dist = colorDistance(r, g, b, color)
      if (dist < minDistance) minDistance = dist
    }
    alphaMask[i / 4] = minDistance <= tolerance ? 0 : 255
  }

  const blurredAlpha = blurAlpha(alphaMask, width, height, settings.feather)
  for (let i = 0; i < data.length; i += 4) {
    data[i + 3] = blurredAlpha[i / 4]
  }

  if (typeof ImageData !== 'undefined') {
    return new ImageData(data, width, height)
  }
  return imageData
}
