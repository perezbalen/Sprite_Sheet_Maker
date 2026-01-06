import { app, BrowserWindow, dialog, ipcMain, protocol } from 'electron'
import { existsSync, promises as fs } from 'fs'
import { join } from 'path'
import { spawn } from 'child_process'
import ffmpegPath from 'ffmpeg-static'

let mainWindow: BrowserWindow | null = null
const jobs = new Map<string, { dir: string; sourcePath: string; createdAt: number }>()
const baseTempDir = join(app.getPath('temp'), 'spriteloop')

const ensureBaseTempDir = async () => {
  await fs.mkdir(baseTempDir, { recursive: true })
}

const cleanupOldJobs = async () => {
  try {
    await ensureBaseTempDir()
    const entries = await fs.readdir(baseTempDir)
    const jobStats = await Promise.all(
      entries.map(async (entry) => {
        const fullPath = join(baseTempDir, entry)
        const stat = await fs.stat(fullPath)
        return { path: fullPath, mtimeMs: stat.mtimeMs, isDir: stat.isDirectory() }
      })
    )
    const dirs = jobStats.filter((entry) => entry.isDir).sort((a, b) => b.mtimeMs - a.mtimeMs)
    const toRemove = dirs.slice(5)
    await Promise.all(toRemove.map((entry) => fs.rm(entry.path, { recursive: true, force: true })))
  } catch (error) {
    console.warn('Failed to cleanup temp jobs', error)
  }
}

const runFfmpeg = (args: string[]) => {
  return new Promise<void>((resolve, reject) => {
    const executable = ffmpegPath || 'ffmpeg'
    const child = spawn(executable, args, { windowsHide: true })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`ffmpeg exited with code ${code}`))
    })
  })
}

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 900,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js')
    }
  })

  const devServerUrl = process.env.ELECTRON_RENDERER_URL || process.env.VITE_DEV_SERVER_URL
  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  protocol.registerFileProtocol('spriteloop', (request, callback) => {
    const rawPath = request.url.replace('spriteloop://', '')
    const decodedPath = decodeURIComponent(rawPath)
    const normalizedPath =
      process.platform === 'win32' && decodedPath.startsWith('/')
        ? decodedPath.slice(1)
        : decodedPath
    callback({ path: normalizedPath })
  })
  cleanupOldJobs()
    .then(() => {
      createWindow()
    })
    .catch(() => {
      createWindow()
    })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

ipcMain.handle('job:create', async (_event, payload: { sourcePath: string }) => {
  const jobId = `job_${Date.now()}_${Math.floor(Math.random() * 10000)}`
  const jobDir = join(baseTempDir, jobId)
  await ensureBaseTempDir()
  await fs.mkdir(jobDir, { recursive: true })
  jobs.set(jobId, { dir: jobDir, sourcePath: payload.sourcePath, createdAt: Date.now() })
  return { jobId, jobDir }
})

ipcMain.handle(
  'job:createWithVideo',
  async (_event, payload: { fileName: string; data: Uint8Array }) => {
    const jobId = `job_${Date.now()}_${Math.floor(Math.random() * 10000)}`
    const jobDir = join(baseTempDir, jobId)
    await ensureBaseTempDir()
    await fs.mkdir(jobDir, { recursive: true })
    const safeName = payload.fileName.replace(/[^\w.-]+/g, '_')
    const sourcePath = join(jobDir, `source_${Date.now()}_${safeName}`)
    await fs.writeFile(sourcePath, Buffer.from(payload.data))
    jobs.set(jobId, { dir: jobDir, sourcePath, createdAt: Date.now() })
    return { jobId, jobDir, sourcePath }
  }
)

ipcMain.handle(
  'frame:extract',
  async (
    _event,
    payload: { jobId: string; sourcePath: string; timestamp: number; outputFile: string }
  ) => {
    const job = jobs.get(payload.jobId)
    if (!job) {
      throw new Error('Unknown job')
    }
    const outputPath = join(job.dir, payload.outputFile)
    if (existsSync(outputPath)) {
      return { outputPath }
    }
    const timestamp = Math.max(payload.timestamp, 0)
    const args = [
      '-hide_banner',
      '-loglevel',
      'error',
      '-i',
      payload.sourcePath,
      '-ss',
      timestamp.toFixed(3),
      '-frames:v',
      '1',
      '-y',
      outputPath
    ]
    await runFfmpeg(args)
    return { outputPath }
  }
)

ipcMain.handle('dialog:selectDirectory', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory']
  })
  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0]
})

ipcMain.handle('dialog:saveFile', async (_event, payload: { defaultName: string }) => {
  const result = await dialog.showSaveDialog({
    defaultPath: payload.defaultName,
    filters: [{ name: 'PNG', extensions: ['png'] }]
  })
  if (result.canceled || !result.filePath) return null
  return result.filePath
})

ipcMain.handle(
  'export:frames',
  async (_event, payload: { outputDir: string; frames: { fileName: string; data: Uint8Array }[] }) => {
    await Promise.all(
      payload.frames.map((frame) => {
        const outputPath = join(payload.outputDir, frame.fileName)
        return fs.writeFile(outputPath, Buffer.from(frame.data))
      })
    )
    return true
  }
)

ipcMain.handle('fs:writeFile', async (_event, payload: { path: string; data: Uint8Array }) => {
  await fs.writeFile(payload.path, Buffer.from(payload.data))
  return true
})
