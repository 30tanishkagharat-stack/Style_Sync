const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('stylesyncDesktop', {
  platform: process.platform,
  isElectron: true,
  getDesktopInfo: () => ipcRenderer.invoke('stylesync:get-desktop-info'),
  openDataFolder: () => ipcRenderer.invoke('stylesync:open-data-folder'),
  openExternalUrl: (url) => ipcRenderer.invoke('stylesync:open-external-url', url),
  focusWindow: () => ipcRenderer.invoke('stylesync:focus-window'),
});
