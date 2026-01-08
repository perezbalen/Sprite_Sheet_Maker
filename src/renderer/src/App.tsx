import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  const [gifFps, setGifFps] = useState(12)
  const [fpsEstimate, setFpsEstimate] = useState<number | null>(null)
  const [fpsOverride, setFpsOverride] = useState<number | null>(null)
  const [imageVersion, setImageVersion] = useState(0)
  const [keyColors, setKeyColors] = useState<RGBColor[]>([])
  const [tolerance, setTolerance] = useState(40)
  const [feather, setFeather] = useState(4)
  const [choke, setChoke] = useState(0)
  const [smoothing, setSmoothing] = useState(0)
  const [isPicking, setIsPicking] = useState(false)
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null)
  const [backgroundVersion, setBackgroundVersion] = useState(0)
  const [sheetColumns, setSheetColumns] = useState(0)
  const [sheetRows, setSheetRows] = useState(0)
  const [sheetPadding, setSheetPadding] = useState(0)
  const [previewPlaying, setPreviewPlaying] = useState(true)
  const [previewZoom, setPreviewZoom] = useState(1)
  const [markEveryN, setMarkEveryN] = useState(10)
  const [draggedFrameKey, setDraggedFrameKey] = useState<number | null>(null)
  const [cropTop, setCropTop] = useState(0)
  const [cropRight, setCropRight] = useState(0)
  const [cropBottom, setCropBottom] = useState(0)
  const [cropLeft, setCropLeft] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(true)
  const [featherDirection, setFeatherDirection] = useState<'background' | 'subject'>(
    'background'
  )
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const backgroundInputRef = useRef<HTMLInputElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const previewWrapRef = useRef<HTMLDivElement | null>(null)
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map())
  const processedCacheRef = useRef<Map<string, HTMLCanvasElement>>(new Map())
  const dragStartRef = useRef<{ x: number; y: number; scrollLeft: number; scrollTop: number } | null>(
    null
  )
  const currentPreviewFrameRef = useRef<MarkedFrame | null>(null)
  const backgroundImageRef = useRef<HTMLImageElement | null>(null)
  const sampleCanvasRef = useRef<HTMLCanvasElement | null>(null)

  const videoUrl = useMemo(() => {
    if (!videoFile) return ''
    return URL.createObjectURL(videoFile)
  }, [videoFile])

  const chromaSettings = useMemo<ChromaKeySettings>(
    () => ({ colors: keyColors, tolerance, feather, featherDirection, choke, smoothing }),
    [keyColors, tolerance, feather, featherDirection, choke, smoothing]
  )

  const settingsKey = useMemo(
    () => JSON.stringify({ colors: keyColors, tolerance, feather, featherDirection, choke, smoothing }),
    [keyColors, tolerance, feather, featherDirection, choke, smoothing]
  )

  const effectiveFps = fpsOverride || fpsEstimate || 30
  const effectiveColumns = Math.max(1, sheetColumns || markedFrames.length || 1)
  const effectiveRows = Math.max(
    1,
    sheetRows || Math.ceil((markedFrames.length || 1) / effectiveColumns)
  )

  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl)
    }
  }, [videoUrl])

  useEffect(() => {
    if (!videoFile) return
    setMarkedFrames([])
    setJobId(null)
    setFpsOverride(null)
    setGifFps(12)
    setPreviewZoom(1)
    const filePath = (videoFile as File & { path?: string }).path
    if (filePath) {
      setSourcePath(filePath)
      window.spriteLoop
        .createJob(filePath)
        .then((job) => {
          setJobId(job.jobId)
        })
        .catch(() => {
          setJobId(null)
        })
      window.spriteLoop.probeVideoFps(filePath).then((fps) => {
        if (fps && !Number.isNaN(fps)) {
          setFpsEstimate(fps)
        }
      })
      return
    }

    videoFile
      .arrayBuffer()
      .then((buffer) =>
        window.spriteLoop.createJobWithVideo({
          fileName: videoFile.name,
          data: new Uint8Array(buffer)
        })
      )
      .then((job) => {
        setSourcePath(job.sourcePath)
        setJobId(job.jobId)
        return window.spriteLoop.probeVideoFps(job.sourcePath)
      })
      .then((fps) => {
        if (fps && !Number.isNaN(fps)) {
          setFpsEstimate(fps)
        }
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
    if (!videoRef.current) return
    const baseFps = fpsEstimate || 30
    const targetFps = fpsOverride || baseFps
    const rate = Math.max(0.1, targetFps / baseFps)
    videoRef.current.playbackRate = rate
  }, [fpsEstimate, fpsOverride, videoUrl])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !loopEnabled) return
    if (inPoint === null || outPoint === null || outPoint <= inPoint) return
    let rafId = 0
    const tick = () => {
      if (video.paused) {
        rafId = requestAnimationFrame(tick)
        return
      }
      if (video.currentTime >= outPoint - 0.0001) {
        video.currentTime = inPoint
      }
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => {
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [inPoint, loopEnabled, outPoint])

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
        const cropRect = getCropRect(processed.width, processed.height)
        const targetWidth = Math.max(1, Math.floor(cropRect.width * previewZoom))
        const targetHeight = Math.max(1, Math.floor(cropRect.height * previewZoom))
        if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
          canvas.width = targetWidth
          canvas.height = targetHeight
        }
        context.setTransform(1, 0, 0, 1, 0, 0)
        context.clearRect(0, 0, canvas.width, canvas.height)
        const backgroundImage = backgroundImageRef.current
        if (backgroundImage) {
          context.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height)
        }
        context.drawImage(
          processed,
          cropRect.x,
          cropRect.y,
          cropRect.width,
          cropRect.height,
          0,
          0,
          canvas.width,
          canvas.height
        )
        if (previewPlaying) {
          framePosition = (framePosition + 1) % markedFrames.length
        }
      }
    }
    if (previewPlaying) {
      const interval = window.setInterval(drawFrame, Math.max(1, 1000 / previewFps))
      drawFrame()
      return () => {
        window.clearInterval(interval)
      }
    }
    drawFrame()
    return undefined
  }, [
    markedFrames,
    previewFps,
    imageVersion,
    settingsKey,
    backgroundVersion,
    chromaSettings,
    previewPlaying,
    previewZoom,
    cropTop,
    cropRight,
    cropBottom,
    cropLeft
  ])

  const getProcessedFrame = (
    frame: MarkedFrame,
    settings: ChromaKeySettings,
    key: string
  ) => {
    const cacheKey = `${frame.fileUrl}|${key}`
    const cached = processedCacheRef.current.get(cacheKey)
    if (cached) return cached
    const img = imageCacheRef.current.get(frame.fileUrl)
    if (!img || !img.complete || img.width === 0 || img.height === 0) return null
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

  const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

  const getCropRect = (width: number, height: number) => {
    const left = clamp(cropLeft, 0, Math.max(0, width - 1))
    const right = clamp(cropRight, 0, Math.max(0, width - 1 - left))
    const top = clamp(cropTop, 0, Math.max(0, height - 1))
    const bottom = clamp(cropBottom, 0, Math.max(0, height - 1 - top))
    const cropWidth = Math.max(1, Math.floor(width - left - right))
    const cropHeight = Math.max(1, Math.floor(height - top - bottom))
    return { x: Math.floor(left), y: Math.floor(top), width: cropWidth, height: cropHeight }
  }

  const getCroppedCanvas = (source: HTMLCanvasElement) => {
    const rect = getCropRect(source.width, source.height)
    const canvas = document.createElement('canvas')
    canvas.width = rect.width
    canvas.height = rect.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return source
    ctx.drawImage(source, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height)
    return canvas
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

  const formatFrame = (seconds: number) => Math.round(seconds * effectiveFps)

  const handleSetIn = () => {
    if (!videoRef.current) return
    setInPoint(videoRef.current.currentTime)
  }

  const handleSetOut = () => {
    if (!videoRef.current) return
    setOutPoint(videoRef.current.currentTime)
  }

  const handleResetInOut = () => {
    setInPoint(null)
    setOutPoint(null)
  }

  const handleTimeUpdate = () => {
    if (!videoRef.current) return
    const time = videoRef.current.currentTime
    setCurrentTime(time)
    if (
      loopEnabled &&
      !videoRef.current.paused &&
      inPoint !== null &&
      outPoint !== null &&
      outPoint > inPoint &&
      time >= outPoint - 0.0001
    ) {
      videoRef.current.currentTime = inPoint
      videoRef.current.play().catch(() => undefined)
    }
  }

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return
    const totalDuration = videoRef.current.duration || 0
    setDuration(totalDuration)
    if (!fpsEstimate) {
      const quality = videoRef.current.getVideoPlaybackQuality?.()
      if (quality?.totalVideoFrames && totalDuration > 0) {
        setFpsEstimate(quality.totalVideoFrames / totalDuration)
      }
    }
  }

  useEffect(() => {
    if (fpsEstimate !== null) return
    const video = videoRef.current
    if (!video) return
    const requestCallback = (video as HTMLVideoElement & { requestVideoFrameCallback?: Function })
      .requestVideoFrameCallback
    if (!requestCallback) return
    let active = true
    const handleFrame = (_now: number, metadata: { presentedFrames?: number; mediaTime?: number }) => {
      if (!active || fpsEstimate !== null) return
      const frames = metadata.presentedFrames ?? 0
      const mediaTime = metadata.mediaTime ?? 0
      if (frames > 0 && mediaTime > 0) {
        const estimate = frames / mediaTime
        if (Number.isFinite(estimate) && estimate > 0) {
          setFpsEstimate(estimate)
          return
        }
      }
      ;(video as HTMLVideoElement & { requestVideoFrameCallback?: Function }).requestVideoFrameCallback?.(
        handleFrame
      )
    }
    ;(video as HTMLVideoElement & { requestVideoFrameCallback?: Function }).requestVideoFrameCallback?.(
      handleFrame
    )
    return () => {
      active = false
    }
  }, [fpsEstimate, videoUrl])

  const toFileUrl = (filePath: string) => {
    const normalized = filePath.replace(/\\/g, '/')
    const prefix = normalized.startsWith('/') ? 'spriteloop://' : 'spriteloop:///'
    return `${prefix}${encodeURI(normalized)}`
  }

  const getMaxAllowedFrame = useCallback(() => {
    const durationValue = videoRef.current?.duration ?? duration
    if (!durationValue || Number.isNaN(durationValue)) return null
    const maxTime = durationValue - 1 / effectiveFps
    if (maxTime <= 0) return 0
    return Math.max(0, Math.floor(maxTime * effectiveFps))
  }, [duration, effectiveFps])

  const handleMarkFrame = useCallback(async () => {
    if (!videoRef.current || !sourcePath || !jobId) return
    const maxFrame = getMaxAllowedFrame()
    if (maxFrame === null) return
    const frameIndex = Math.round(videoRef.current.currentTime * effectiveFps)
    if (frameIndex > maxFrame) return
    const timestamp = frameIndex / effectiveFps
    const key = Math.round(timestamp * 1000)
    if (markedFrames.some((frame) => frame.key === key)) return
    const outputFile = `frame_${key}.png`
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
  }, [effectiveFps, getMaxAllowedFrame, jobId, markedFrames, sourcePath])

  const handleRemoveFrame = (key: number) => {
    setMarkedFrames((prev) => prev.filter((frame) => frame.key !== key))
  }

  const handleClearFrames = () => {
    setMarkedFrames([])
  }

  const reorderFrames = (fromKey: number, toKey: number) => {
    if (fromKey === toKey) return
    setMarkedFrames((prev) => {
      const fromIndex = prev.findIndex((frame) => frame.key === fromKey)
      const toIndex = prev.findIndex((frame) => frame.key === toKey)
      if (fromIndex < 0 || toIndex < 0) return prev
      const next = [...prev]
      const [moved] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, moved)
      return next
    })
  }

  const handleMarkEveryN = useCallback(async () => {
    if (!videoRef.current || !sourcePath || !jobId) return
    if (inPoint === null || outPoint === null) return
    if (outPoint < inPoint) return
    const maxFrame = getMaxAllowedFrame()
    if (maxFrame === null) return
    const step = Math.max(1, Math.floor(markEveryN))
    const startFrame = Math.max(0, Math.round(inPoint * effectiveFps))
    const endFrame = Math.min(Math.round(outPoint * effectiveFps), maxFrame)
    if (startFrame > maxFrame) return
    const framesToMark = []
    for (let frame = startFrame; frame <= endFrame; frame += step) {
      framesToMark.push(frame)
    }
    if (framesToMark[framesToMark.length - 1] !== endFrame) {
      framesToMark.push(endFrame)
    }
    const existingKeys = new Set(markedFrames.map((frame) => frame.key))
    const newFrames: MarkedFrame[] = []
    for (const frameIndex of framesToMark) {
      if (frameIndex > maxFrame) continue
      const timestamp = frameIndex / effectiveFps
      const key = Math.round(timestamp * 1000)
      if (existingKeys.has(key)) continue
      const outputFile = `frame_${key}.png`
      const result = await window.spriteLoop.extractFrame({
        jobId,
        sourcePath,
        timestamp,
        outputFile
      })
      const fileUrl = toFileUrl(result.outputPath)
      newFrames.push({ key, time: timestamp, frameIndex, filePath: result.outputPath, fileUrl })
      existingKeys.add(key)
    }
    if (newFrames.length) {
      setMarkedFrames((prev) => [...prev, ...newFrames])
    }
  }, [effectiveFps, getMaxAllowedFrame, inPoint, jobId, markEveryN, markedFrames, outPoint, sourcePath])

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
    const canvasX = (event.clientX - rect.left) * scaleX
    const canvasY = (event.clientY - rect.top) * scaleY
    const cropRect = getCropRect(img.width, img.height)
    const x = Math.floor(canvasX / previewZoom) + cropRect.x
    const y = Math.floor(canvasY / previewZoom) + cropRect.y
    if (
      x < cropRect.x ||
      y < cropRect.y ||
      x >= cropRect.x + cropRect.width ||
      y >= cropRect.y + cropRect.height
    )
      return
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
      const cropped = getCroppedCanvas(processed)
      const data = await canvasToPngBytes(cropped)
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
    const firstCropped = getCroppedCanvas(firstProcessed)
    const layout = calculateSpriteSheetLayout(
      firstCropped.width,
      firstCropped.height,
      markedFrames.length,
      effectiveColumns,
      effectiveRows,
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
      const cropped = getCroppedCanvas(processed)
      const cell = layout.cells[index]
      ctx.drawImage(cropped, cell.x, cell.y)
    }
    const data = await canvasToPngBytes(sheetCanvas)
    await window.spriteLoop.writeFile({ path: outputPath, data })
  }

  const handleExportGif = async () => {
    if (markedFrames.length === 0) return
    const outputPath = await window.spriteLoop.selectGifPath('animation.gif')
    if (!outputPath) return
    const framesToExport = [] as { fileName: string; data: Uint8Array }[]
    for (let index = 0; index < markedFrames.length; index++) {
      const frame = markedFrames[index]
      await ensureImageLoaded(frame.fileUrl)
      const processed = getProcessedFrame(frame, chromaSettings, settingsKey)
      if (!processed) continue
      const cropped = getCroppedCanvas(processed)
      const data = await canvasToPngBytes(cropped)
      const fileName = `frame_${String(index + 1).padStart(4, '0')}.png`
      framesToExport.push({ fileName, data })
    }
    await window.spriteLoop.exportGif({ outputPath, fps: gifFps, frames: framesToExport })
  }

  const currentFrameNumber = Math.round(currentTime * effectiveFps)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable) {
        return
      }
      if (!videoRef.current || !videoUrl) return
      const frameDuration = 1 / effectiveFps
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        const nextFrame = Math.max(0, currentFrameNumber - 1)
        videoRef.current.currentTime = nextFrame * frameDuration
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        const nextFrame = Math.max(0, currentFrameNumber + 1)
        videoRef.current.currentTime = nextFrame * frameDuration
      }
      if (event.key === 'ArrowDown' || event.key === 'Enter') {
        event.preventDefault()
        handleMarkFrame()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentFrameNumber, effectiveFps, handleMarkFrame, videoUrl])

  return (
    <div className="app">
      <header className="header">
        <h1>🎞️Sprite Loop</h1>
      </header>

      <main className="layout-grid">
        <section className="row row-full">
          <div
            className={`drop-zone${videoUrl ? ' compact' : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
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
        </section>

        <section className="row">
          <div className="video-panel">
          {videoUrl ? (
            <div className="video-stack">
              <video
                ref={videoRef}
                src={videoUrl}
                muted
                className="video-player"
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  videoRef.current?.pause()
                }}
              />
              <div className="video-player-controls">
                <button
                  type="button"
                  onClick={() => {
                    if (!videoRef.current) return
                    if (videoRef.current.paused) {
                      videoRef.current.play().catch(() => undefined)
                    } else {
                      videoRef.current.pause()
                    }
                  }}
                >
                  {isPlaying ? 'Pause' : 'Play'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!videoRef.current) return
                    const nextMuted = !videoRef.current.muted
                    videoRef.current.muted = nextMuted
                    setIsMuted(nextMuted)
                  }}
                >
                  {isMuted ? 'Unmute' : 'Mute'}
                </button>
                <input
                  className="video-scrub"
                  type="range"
                  min={0}
                  max={duration || 0}
                  step={0.001}
                  value={currentTime}
                  onChange={(event) => {
                    if (!videoRef.current) return
                    const value = Number(event.target.value)
                    if (Number.isNaN(value)) return
                    videoRef.current.currentTime = value
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const element = videoRef.current
                    if (!element) return
                    element.requestFullscreen?.().catch(() => undefined)
                  }}
                >
                  Fullscreen
                </button>
              </div>
              <div className="video-controls">
                <div className="time-readout">
                  <span>Current: {formatFrame(currentTime)}</span>
                  <label className="frame-input">
                    Frame
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={currentFrameNumber}
                      onChange={(event) => {
                        const value = Number(event.target.value)
                        if (!videoRef.current || Number.isNaN(value)) return
                        videoRef.current.currentTime = value / effectiveFps
                      }}
                    />
                  </label>
                  <span>Total: {formatFrame(duration)}</span>
                </div>
                <div className="in-out-controls">
                  <button type="button" onClick={handleSetIn}>
                    Set IN
                  </button>
                  <span>IN: {inPoint !== null ? formatFrame(inPoint) : '--'}</span>
                  <button type="button" onClick={handleSetOut}>
                    Set OUT
                  </button>
                  <span>OUT: {outPoint !== null ? formatFrame(outPoint) : '--'}</span>
                  <button type="button" onClick={handleResetInOut}>
                    Reset IN/OUT
                  </button>
                </div>
                <label className="loop-toggle">
                  <input
                    type="checkbox"
                    checked={loopEnabled}
                    onChange={(event) => setLoopEnabled(event.target.checked)}
                  />
                  Loop IN→OUT Preview
                </label>
                <label className="fps-control">
                  Playback FPS
                  <input
                    type="number"
                    min={1}
                    max={120}
                    step={1}
                    value={fpsOverride ?? Math.round(fpsEstimate || 30)}
                    onChange={(event) => {
                      const value = Number(event.target.value)
                      if (Number.isNaN(value) || value <= 0) return
                      setFpsOverride(value)
                    }}
                  />
                </label>
              </div>
            </div>
          ) : (
            <div className="video-placeholder">No video loaded</div>
          )}
          </div>

          <div className="frame-marking">
          <div className="frame-marking-header">
            <h2>Marked Frames</h2>
            <button type="button" onClick={handleMarkFrame} disabled={!videoUrl}>
              Mark Current Frame
            </button>
          </div>
          <p className="helper-text">Shortcuts: ←/→ frame, ↓/Enter mark.</p>
          <div className="frame-bulk">
            <label>
              Mark every
              <input
                type="number"
                min={1}
                value={markEveryN}
                onChange={(event) => setMarkEveryN(Math.max(1, Number(event.target.value) || 1))}
              />
              frames
            </label>
            <button
              type="button"
              onClick={handleMarkEveryN}
              disabled={!videoUrl || inPoint === null || outPoint === null}
            >
              Mark Range
            </button>
            <button type="button" onClick={handleClearFrames} disabled={markedFrames.length === 0}>
              Clear All
            </button>
          </div>
          <div className="frame-list-wrap">
            <div className="frame-list">
              {markedFrames.length === 0 && <p>No frames marked yet.</p>}
              {markedFrames.map((frame) => (
                <div
                  key={frame.key}
                  className={`frame-item${draggedFrameKey === frame.key ? ' dragging' : ''}`}
                  draggable
                  onDragStart={() => setDraggedFrameKey(frame.key)}
                  onDragEnd={() => setDraggedFrameKey(null)}
                  onDragOver={(event) => {
                    event.preventDefault()
                  }}
                  onDrop={() => {
                    if (draggedFrameKey === null) return
                    reorderFrames(draggedFrameKey, frame.key)
                    setDraggedFrameKey(null)
                  }}
                >
                  <img src={frame.fileUrl} alt={`Frame ${frame.frameIndex}`} />
                  <div className="frame-meta">
                    <span>Frame {frame.frameIndex}</span>
                  </div>
                  <button type="button" onClick={() => handleRemoveFrame(frame.key)}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
          </div>
        </section>

        <section className="row">
          <div className="frame-preview">
          <h2>Selected Frames Preview</h2>
          <div className="preview-toolbar">
            <button type="button" onClick={() => setPreviewPlaying((prev) => !prev)}>
              {previewPlaying ? 'Stop' : 'Play'}
            </button>
            <div className="preview-zoom">
              <button type="button" onClick={() => setPreviewZoom((zoom) => Math.max(1, zoom - 1))}>
                Zoom -
              </button>
              <span>{previewZoom}x</span>
              <button type="button" onClick={() => setPreviewZoom((zoom) => Math.min(8, zoom + 1))}>
                Zoom +
              </button>
            </div>
          </div>
          <div className="preview-canvas-wrap" ref={previewWrapRef}>
            <canvas
              ref={previewCanvasRef}
              className={`preview-canvas${previewZoom > 1 ? ' zoomed' : ''}${
                isPicking ? ' picking' : ''
              }`}
              onClick={handleCanvasClick}
              onMouseDown={(event) => {
                if (previewZoom <= 1) return
                const wrap = previewWrapRef.current
                if (!wrap) return
                dragStartRef.current = {
                  x: event.clientX,
                  y: event.clientY,
                  scrollLeft: wrap.scrollLeft,
                  scrollTop: wrap.scrollTop
                }
              }}
              onMouseMove={(event) => {
                const start = dragStartRef.current
                const wrap = previewWrapRef.current
                if (!start || !wrap) return
                wrap.scrollLeft = start.scrollLeft - (event.clientX - start.x)
                wrap.scrollTop = start.scrollTop - (event.clientY - start.y)
              }}
              onMouseUp={() => {
                dragStartRef.current = null
              }}
              onMouseLeave={() => {
                dragStartRef.current = null
              }}
            />
          </div>
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
          <label className="chroma-slider">
            Choke / Edge Thickness
            <input
              type="number"
              min={0}
              max={10}
              value={choke}
              onChange={(event) => setChoke(Math.max(0, Number(event.target.value) || 0))}
            />
          </label>
          <label className="chroma-slider">
            Smoothing / Edge Blend
            <input
              type="number"
              min={0}
              max={10}
              value={smoothing}
              onChange={(event) => setSmoothing(Math.max(0, Number(event.target.value) || 0))}
            />
          </label>
          <label className="chroma-slider">
            Feather Direction
            <select
              value={featherDirection}
              onChange={(event) =>
                setFeatherDirection(event.target.value as 'background' | 'subject')
              }
            >
              <option value="background">Toward Background</option>
              <option value="subject">Toward Subject</option>
            </select>
          </label>
          <div className="crop-controls">
            <h3>Crop (px)</h3>
            <div className="crop-grid crop-grid-3x3">
              <div className="crop-cell" />
              <label className="crop-cell">
                Top
                <input
                  type="number"
                  min={0}
                  value={cropTop}
                  onChange={(event) => setCropTop(Math.max(0, Number(event.target.value) || 0))}
                />
              </label>
              <div className="crop-cell" />
              <label className="crop-cell">
                Left
                <input
                  type="number"
                  min={0}
                  value={cropLeft}
                  onChange={(event) => setCropLeft(Math.max(0, Number(event.target.value) || 0))}
                />
              </label>
              <div className="crop-cell crop-center">Crop</div>
              <label className="crop-cell">
                Right
                <input
                  type="number"
                  min={0}
                  value={cropRight}
                  onChange={(event) => setCropRight(Math.max(0, Number(event.target.value) || 0))}
                />
              </label>
              <div className="crop-cell" />
              <label className="crop-cell">
                Bottom
                <input
                  type="number"
                  min={0}
                  value={cropBottom}
                  onChange={(event) => setCropBottom(Math.max(0, Number(event.target.value) || 0))}
                />
              </label>
              <div className="crop-cell" />
            </div>
          </div>
        </div>
        </section>

        <section className="row">
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

          <div className="export-area">
            <h2>Export</h2>
            <div className="export-controls">
              <button type="button" onClick={handleExportFrames} disabled={markedFrames.length === 0}>
                Export PNG Frames...
              </button>
              <button type="button" onClick={handleExportGif} disabled={markedFrames.length === 0}>
                Export Animated GIF...
              </button>
              <button
                type="button"
                onClick={handleExportSpriteSheet}
                disabled={markedFrames.length === 0}
              >
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
                  onChange={(event) => {
                    const columns = Math.max(1, Number(event.target.value) || 1)
                    const frameCount = Math.max(1, markedFrames.length)
                    const rows = Math.max(1, Math.ceil(frameCount / columns))
                    setSheetColumns(columns)
                    setSheetRows(rows)
                  }}
                />
              </label>
              <label>
                Rows
                <input
                  type="number"
                  min={1}
                  value={sheetRows || effectiveRows}
                  onChange={(event) => {
                    const rows = Math.max(1, Number(event.target.value) || 1)
                    const frameCount = Math.max(1, markedFrames.length)
                    const columns = Math.max(1, Math.ceil(frameCount / rows))
                    setSheetRows(rows)
                    setSheetColumns(columns)
                  }}
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
              <label>
                GIF FPS
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={gifFps}
                  onChange={(event) => setGifFps(Math.max(1, Number(event.target.value) || 1))}
                />
              </label>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
