import { contextBridge } from 'electron'

contextBridge.exposeInMainWorld('spriteLoop', {})
