import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('spriteLoop', {
  createJob: (sourcePath: string) => ipcRenderer.invoke('job:create', { sourcePath }),
  createJobWithVideo: (payload: { fileName: string; data: Uint8Array }) =>
    ipcRenderer.invoke('job:createWithVideo', payload),
  extractFrame: (payload: {
    jobId: string
    sourcePath: string
    timestamp: number
    outputFile: string
  }) => ipcRenderer.invoke('frame:extract', payload),
  selectExportDirectory: () => ipcRenderer.invoke('dialog:selectDirectory'),
  selectSpriteSheetPath: (defaultName: string) =>
    ipcRenderer.invoke('dialog:saveFile', { defaultName }),
  selectGifPath: (defaultName: string) => ipcRenderer.invoke('dialog:saveGif', { defaultName }),
  exportFrames: (payload: { outputDir: string; frames: { fileName: string; data: Uint8Array }[] }) =>
    ipcRenderer.invoke('export:frames', payload),
  exportGif: (payload: {
    outputPath: string
    fps: number
    frames: { fileName: string; data: Uint8Array }[]
  }) => ipcRenderer.invoke('export:gif', payload),
  writeFile: (payload: { path: string; data: Uint8Array }) =>
    ipcRenderer.invoke('fs:writeFile', payload)
})
