import React, { useEffect, useMemo, useRef, useState } from 'react'
import { applyChromaKey, ChromaKeySettings, RGBColor } from './utils/chromaKey'
import { calculateSpriteSheetLayout } from './utils/spriteSheet'

type MarkedFrame = {
  key: number
  time: number
  frameIndex: number
  filePath: string
  fileUrl: string
}

const App: React.FC = () => {
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [sourcePath, setSourcePath] = useState<string | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [inPoint, setInPoint] = useState<number | null>(null)
  const [outPoint, setOutPoint] = useState<number | null>(null)
  const [loopEnabled, setLoopEnabled] = useState(false)
  const [markedFrames, setMarkedFrames] = useState<MarkedFrame[]>([])
  const [previewFps, setPreviewFps] = useState(12)
  const [fpsEstimate, setFpsEstimate] = useState<number | null>(null)
  const [imageVersion, setImageVersion] = useState(0)
  const [keyColors, setKeyColors] = useState<RGBColor[]>([])
  const [tolerance, setTolerance] = useState(40)
  const [feather, setFeather] = useState(4)
  const [isPicking, setIsPicking] = useState(false)
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null)
  const [backgroundVersion, setBackgroundVersion] = useState(0)
  const [sheetColumns, setSheetColumns] = useState(0)
  const [sheetPadding, setSheetPadding] = useState(0)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const backgroundInputRef = useRef<HTMLInputElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map())
  const processedCacheRef = useRef<Map<string, HTMLCanvasElement>>(new Map())
  const currentPreviewFrameRef = useRef<MarkedFrame | null>(null)
  const backgroundImageRef = useRef<HTMLImageElement | null>(null)
  const sampleCanvasRef = useRef<HTMLCanvasElement | null>(null)

  const videoUrl = useMemo(() => {
    if (!videoFile) return ''
    return URL.createObjectURL(videoFile)
  }, [videoFile])

  const chromaSettings = useMemo<ChromaKeySettings>(
    () => ({ colors: keyColors, tolerance, feather }),
    [keyColors, tolerance, feather]
  )

  const settingsKey = useMemo(
    () => JSON.stringify({ colors: keyColors, tolerance, feather }),
    [keyColors, tolerance, feather]
  )

  const effectiveColumns = Math.max(1, sheetColumns || markedFrames.length || 1)

  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl)
    }
  }, [videoUrl])

  useEffect(() => {
    if (!videoFile) return
    const filePath = (videoFile as File & { path?: string }).path
    if (!filePath) return
    setSourcePath(filePath)
    setMarkedFrames([])
    setJobId(null)
    window.spriteLoop
      .createJob(filePath)
      .then((job) => {
        setJobId(job.jobId)
      })
      .catch(() => {
        setJobId(null)
      })
  }, [videoFile])

  useEffect(() => {
    processedCacheRef.current.clear()
  }, [settingsKey])

  useEffect(() => {
    const cache = imageCacheRef.current
    const urls = new Set(markedFrames.map((frame) => frame.fileUrl))
    for (const url of urls) {
      if (cache.has(url)) continue
      const img = new Image()
      img.onload = () => {
        setImageVersion((version) => version + 1)
      }
      img.src = url
      cache.set(url, img)
    }
    for (const [url] of cache) {
      if (!urls.has(url)) {
        cache.delete(url)
      }
    }
  }, [markedFrames])

  useEffect(() => {
    if (!backgroundUrl) {
      backgroundImageRef.current = null
      return
    }
    const img = new Image()
    img.onload = () => {
      backgroundImageRef.current = img
      setBackgroundVersion((version) => version + 1)
    }
    img.src = backgroundUrl
  }, [backgroundUrl])

  useEffect(() => {
    const canvas = previewCanvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return
    if (markedFrames.length === 0) {
      context.clearRect(0, 0, canvas.width, canvas.height)
      return
    }
    let framePosition = 0
    const drawFrame = () => {
      const frame = markedFrames[framePosition % markedFrames.length]
      currentPreviewFrameRef.current = frame
      const processed = getProcessedFrame(frame, chromaSettings, settingsKey)
      if (processed) {
        if (canvas.width !== processed.width || canvas.height !== processed.height) {
          canvas.width = processed.width
          canvas.height = processed.height
        }
        context.clearRect(0, 0, canvas.width, canvas.height)
        const backgroundImage = backgroundImageRef.current
        if (backgroundImage) {
          context.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height)
        }
        context.drawImage(processed, 0, 0)
        framePosition = (framePosition + 1) % markedFrames.length
      }
    }
    const interval = window.setInterval(drawFrame, Math.max(1, 1000 / previewFps))
    drawFrame()
    return () => {
      window.clearInterval(interval)
    }
  }, [markedFrames, previewFps, imageVersion, settingsKey, backgroundVersion])

  const getProcessedFrame = (
    frame: MarkedFrame,
    settings: ChromaKeySettings,
    key: string
  ) => {
    const cacheKey = `${frame.fileUrl}|${key}`
    const cached = processedCacheRef.current.get(cacheKey)
    if (cached) return cached
    const img = imageCacheRef.current.get(frame.fileUrl)
    if (!img || !img.complete) return null
    const offscreen = document.createElement('canvas')
    offscreen.width = img.width
    offscreen.height = img.height
    const ctx = offscreen.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(img, 0, 0)
    const imageData = ctx.getImageData(0, 0, offscreen.width, offscreen.height)
    const keyed = applyChromaKey(imageData, settings)
    ctx.putImageData(keyed, 0, 0)
    processedCacheRef.current.set(cacheKey, offscreen)
    return offscreen
  }

  const ensureImageLoaded = (url: string) => {
    const cached = imageCacheRef.current.get(url)
    if (cached?.complete) return Promise.resolve(cached)
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const img = cached ?? new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = url
      imageCacheRef.current.set(url, img)
    })
  }

  const canvasToPngBytes = (canvas: HTMLCanvasElement) => {
    return new Promise<Uint8Array>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Failed to encode PNG'))
          return
        }
        blob
          .arrayBuffer()
          .then((buffer) => resolve(new Uint8Array(buffer)))
          .catch(reject)
      }, 'image/png')
    })
  }

  const handleOpenClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.includes('mp4')) return
    setInPoint(null)
    setOutPoint(null)
    setVideoFile(file)
  }

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    const file = event.dataTransfer.files?.[0]
    if (!file) return
    if (!file.type.includes('mp4')) return
    setInPoint(null)
    setOutPoint(null)
    setVideoFile(file)
  }

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    const millis = Math.floor((seconds % 1) * 1000)
    const paddedMins = mins.toString().padStart(2, '0')
    const paddedSecs = secs.toString().padStart(2, '0')
    const paddedMillis = millis.toString().padStart(3, '0')
    return `${paddedMins}:${paddedSecs}.${paddedMillis}`
  }

  const handleSetIn = () => {
    if (!videoRef.current) return
    setInPoint(videoRef.current.currentTime)
  }

  const handleSetOut = () => {
    if (!videoRef.current) return
    setOutPoint(videoRef.current.currentTime)
  }

  const handleTimeUpdate = () => {
    if (!videoRef.current) return
    const time = videoRef.current.currentTime
    setCurrentTime(time)
    if (
      loopEnabled &&
      inPoint !== null &&
      outPoint !== null &&
      outPoint > inPoint &&
      time >= outPoint
    ) {
      videoRef.current.currentTime = inPoint
    }
  }

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return
    const totalDuration = videoRef.current.duration || 0
    setDuration(totalDuration)
    const quality = videoRef.current.getVideoPlaybackQuality?.()
    if (quality?.totalVideoFrames && totalDuration > 0) {
      setFpsEstimate(quality.totalVideoFrames / totalDuration)
    }
  }

  const toFileUrl = (filePath: string) => {
    const normalized = filePath.replace(/\\/g, '/')
    const prefix = normalized.startsWith('/') ? 'file://' : 'file:///'
    return `${prefix}${encodeURI(normalized)}`
  }

  const handleMarkFrame = async () => {
    if (!videoRef.current || !sourcePath || !jobId) return
    const timestamp = videoRef.current.currentTime
    const key = Math.round(timestamp * 1000)
    if (markedFrames.some((frame) => frame.key === key)) return
    const outputFile = `frame_${key}.png`
    const frameIndex = Math.round(timestamp * (fpsEstimate || 30))
    const result = await window.spriteLoop.extractFrame({
      jobId,
      sourcePath,
      timestamp,
      outputFile
    })
    const fileUrl = toFileUrl(result.outputPath)
    setMarkedFrames((prev) => [
      ...prev,
      { key, time: timestamp, frameIndex, filePath: result.outputPath, fileUrl }
    ])
  }

  const handleRemoveFrame = (key: number) => {
    setMarkedFrames((prev) => prev.filter((frame) => frame.key !== key))
  }

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isPicking) return
    const canvas = previewCanvasRef.current
    const frame = currentPreviewFrameRef.current
    if (!canvas || !frame) return
    const img = imageCacheRef.current.get(frame.fileUrl)
    if (!img || !img.complete) return
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const x = Math.floor((event.clientX - rect.left) * scaleX)
    const y = Math.floor((event.clientY - rect.top) * scaleY)
    if (!sampleCanvasRef.current) {
      sampleCanvasRef.current = document.createElement('canvas')
    }
    const sampleCanvas = sampleCanvasRef.current
    sampleCanvas.width = img.width
    sampleCanvas.height = img.height
    const ctx = sampleCanvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(img, 0, 0)
    const pixel = ctx.getImageData(x, y, 1, 1).data
    const color = { r: pixel[0], g: pixel[1], b: pixel[2] }
    setKeyColors((prev) => [...prev, color])
    setIsPicking(false)
  }

  const handleRemoveKeyColor = (index: number) => {
    setKeyColors((prev) => prev.filter((_, idx) => idx !== index))
  }

  const handleBackgroundFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (backgroundUrl) URL.revokeObjectURL(backgroundUrl)
    setBackgroundUrl(URL.createObjectURL(file))
  }

  const handleClearBackground = () => {
    if (backgroundUrl) URL.revokeObjectURL(backgroundUrl)
    setBackgroundUrl(null)
    if (backgroundInputRef.current) {
      backgroundInputRef.current.value = ''
    }
  }

  const handleExportFrames = async () => {
    if (markedFrames.length === 0) return
    const outputDir = await window.spriteLoop.selectExportDirectory()
    if (!outputDir) return
    const framesToExport = [] as { fileName: string; data: Uint8Array }[]
    for (let index = 0; index < markedFrames.length; index++) {
      const frame = markedFrames[index]
      await ensureImageLoaded(frame.fileUrl)
      const processed = getProcessedFrame(frame, chromaSettings, settingsKey)
      if (!processed) continue
      const data = await canvasToPngBytes(processed)
      const fileName = `frame_${String(index + 1).padStart(4, '0')}.png`
      framesToExport.push({ fileName, data })
    }
    await window.spriteLoop.exportFrames({ outputDir, frames: framesToExport })
  }

  const handleExportSpriteSheet = async () => {
    if (markedFrames.length === 0) return
    const outputPath = await window.spriteLoop.selectSpriteSheetPath('sprite_sheet.png')
    if (!outputPath) return
    await ensureImageLoaded(markedFrames[0].fileUrl)
    const firstProcessed = getProcessedFrame(markedFrames[0], chromaSettings, settingsKey)
    if (!firstProcessed) return
    const layout = calculateSpriteSheetLayout(
      firstProcessed.width,
      firstProcessed.height,
      markedFrames.length,
      effectiveColumns,
      sheetPadding
    )
    const sheetCanvas = document.createElement('canvas')
    sheetCanvas.width = layout.sheetWidth
    sheetCanvas.height = layout.sheetHeight
    const ctx = sheetCanvas.getContext('2d')
    if (!ctx) return
    for (let index = 0; index < markedFrames.length; index++) {
      const frame = markedFrames[index]
      await ensureImageLoaded(frame.fileUrl)
      const processed = getProcessedFrame(frame, chromaSettings, settingsKey)
      if (!processed) continue
      const cell = layout.cells[index]
      ctx.drawImage(processed, cell.x, cell.y)
    }
    const data = await canvasToPngBytes(sheetCanvas)
    await window.spriteLoop.writeFile({ path: outputPath, data })
  }

  const currentFrameNumber = Math.round(currentTime * (fpsEstimate || 30))

  return (
    <div className="app">
      <header className="header">
        <h1>SpriteLoop</h1>
      </header>

      <section className="top-area">
        <div className="drop-zone" onDrop={handleDrop} onDragOver={handleDragOver}>
          <div className="drop-zone-content">
            <p>Drag & drop an MP4 here</p>
            <button type="button" onClick={handleOpenClick}>
              Open Video...
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4"
              onChange={handleFileChange}
              hidden
            />
          </div>
        </div>

        <div className="video-panel">
          {videoUrl ? (
            <div className="video-stack">
              <video
                ref={videoRef}
                src={videoUrl}
                controls
                className="video-player"
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
              />
              <div className="video-controls">
                <div className="time-readout">
                  <span>Current: {formatTime(currentTime)}</span>
                  <span>Frame: {currentFrameNumber}</span>
                  <span>Total: {formatTime(duration)}</span>
                </div>
                <div className="in-out-controls">
                  <button type="button" onClick={handleSetIn}>
                    Set IN
                  </button>
                  <span>IN: {inPoint !== null ? formatTime(inPoint) : '--:--.---'}</span>
                  <button type="button" onClick={handleSetOut}>
                    Set OUT
                  </button>
                  <span>OUT: {outPoint !== null ? formatTime(outPoint) : '--:--.---'}</span>
                </div>
                <label className="loop-toggle">
                  <input
                    type="checkbox"
                    checked={loopEnabled}
                    onChange={(event) => setLoopEnabled(event.target.checked)}
                  />
                  Loop IN→OUT Preview
                </label>
              </div>
            </div>
          ) : (
            <div className="video-placeholder">No video loaded</div>
          )}
        </div>
      </section>

      <section className="middle-area">
        <div className="frame-marking">
          <div className="frame-marking-header">
            <h2>Marked Frames</h2>
            <button type="button" onClick={handleMarkFrame} disabled={!videoUrl}>
              Mark Current Frame
            </button>
          </div>
          <div className="frame-list">
            {markedFrames.length === 0 && <p>No frames marked yet.</p>}
            {markedFrames.map((frame) => (
              <div key={frame.key} className="frame-item">
                <img src={frame.fileUrl} alt={`Frame ${frame.frameIndex}`} />
                <div className="frame-meta">
                  <span>{formatTime(frame.time)}</span>
                  <span>Frame {frame.frameIndex}</span>
                </div>
                <button type="button" onClick={() => handleRemoveFrame(frame.key)}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="frame-preview">
          <h2>Selected Frames Preview</h2>
          <canvas
            ref={previewCanvasRef}
            className="preview-canvas"
            onClick={handleCanvasClick}
          />
          <label className="preview-fps">
            Preview FPS
            <input
              type="number"
              min={1}
              max={60}
              value={previewFps}
              onChange={(event) => setPreviewFps(Math.max(1, Number(event.target.value) || 1))}
            />
          </label>
        </div>
      </section>

      <section className="chroma-area">
        <div className="chroma-controls">
          <div className="chroma-header">
            <h2>Chroma Key</h2>
            <button type="button" onClick={() => setIsPicking((prev) => !prev)}>
              {isPicking ? 'Click Preview to Pick' : 'Pick Key Color'}
            </button>
          </div>
          <div className="key-colors">
            {keyColors.length === 0 && <p>No key colors picked.</p>}
            {keyColors.map((color, index) => (
              <div key={`${color.r}-${color.g}-${color.b}-${index}`} className="key-color-item">
                <span
                  className="color-swatch"
                  style={{ backgroundColor: `rgb(${color.r}, ${color.g}, ${color.b})` }}
                />
                <span>rgb({color.r}, {color.g}, {color.b})</span>
                <button type="button" onClick={() => handleRemoveKeyColor(index)}>
                  Remove
                </button>
              </div>
            ))}
          </div>
          <label className="chroma-slider">
            Tolerance
            <input
              type="number"
              min={0}
              max={255}
              value={tolerance}
              onChange={(event) => setTolerance(Number(event.target.value) || 0)}
            />
          </label>
          <label className="chroma-slider">
            Feather (px)
            <input
              type="number"
              min={0}
              max={20}
              value={feather}
              onChange={(event) => setFeather(Math.max(0, Number(event.target.value) || 0))}
            />
          </label>
        </div>

        <div className="chroma-background">
          <h3>Preview Background</h3>
          <p>Defaults to checkerboard. Choose an image to compare transparency.</p>
          <div className="background-controls">
            <input
              ref={backgroundInputRef}
              type="file"
              accept="image/*"
              onChange={handleBackgroundFileChange}
            />
            <button type="button" onClick={handleClearBackground}>
              Clear Background
            </button>
          </div>
        </div>
      </section>

      <section className="export-area">
        <h2>Export</h2>
        <div className="export-controls">
          <button type="button" onClick={handleExportFrames} disabled={markedFrames.length === 0}>
            Export PNG Frames...
          </button>
          <button type="button" onClick={handleExportSpriteSheet} disabled={markedFrames.length === 0}>
            Export Sprite Sheet...
          </button>
        </div>
        <div className="sprite-options">
          <label>
            Columns
            <input
              type="number"
              min={1}
              value={effectiveColumns}
              onChange={(event) => setSheetColumns(Math.max(1, Number(event.target.value) || 1))}
            />
          </label>
          <label>
            Padding
            <input
              type="number"
              min={0}
              value={sheetPadding}
              onChange={(event) => setSheetPadding(Math.max(0, Number(event.target.value) || 0))}
            />
          </label>
        </div>
      </section>
    </div>
  )
}

export default App
