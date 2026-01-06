import React, { useMemo, useRef, useState } from 'react'

const App: React.FC = () => {
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const videoUrl = useMemo(() => {
    if (!videoFile) return ''
    return URL.createObjectURL(videoFile)
  }, [videoFile])

  const handleOpenClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.includes('mp4')) return
    setVideoFile(file)
  }

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    const file = event.dataTransfer.files?.[0]
    if (!file) return
    if (!file.type.includes('mp4')) return
    setVideoFile(file)
  }

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
  }

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
            <video src={videoUrl} controls className="video-player" />
          ) : (
            <div className="video-placeholder">No video loaded</div>
          )}
        </div>
      </section>
    </div>
  )
}

export default App
