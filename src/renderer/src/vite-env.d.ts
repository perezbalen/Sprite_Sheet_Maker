/// <reference types="vite/client" />

interface Window {
  spriteLoop: {
    createJob: (sourcePath: string) => Promise<{ jobId: string; jobDir: string }>
    createJobWithVideo: (payload: {
      fileName: string
      data: Uint8Array
    }) => Promise<{ jobId: string; jobDir: string; sourcePath: string }>
    extractFrame: (payload: {
      jobId: string
      sourcePath: string
      timestamp: number
      outputFile: string
    }) => Promise<{ outputPath: string }>
    selectExportDirectory: () => Promise<string | null>
    selectSpriteSheetPath: (defaultName: string) => Promise<string | null>
    exportFrames: (payload: {
      outputDir: string
      frames: { fileName: string; data: Uint8Array }[]
    }) => Promise<boolean>
    writeFile: (payload: { path: string; data: Uint8Array }) => Promise<boolean>
  }
}
