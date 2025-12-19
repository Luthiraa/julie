import { ipcRenderer } from 'electron'

    // Expose ipcRenderer to the renderer process
    ; (window as any).ipcRenderer = ipcRenderer
