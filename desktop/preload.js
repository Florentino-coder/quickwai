const { contextBridge, ipcRenderer } = require('electron');

const on = (channel) => (handler) => ipcRenderer.on(channel, (_event, payload) => handler(payload));

contextBridge.exposeInMainWorld('qr', {
  init: () => ipcRenderer.invoke('init'),
  saveReply: (reply) => ipcRenderer.invoke('reply:save', reply),
  deleteReply: (id) => ipcRenderer.invoke('reply:delete', id),
  addImages: () => ipcRenderer.invoke('image:add'),
  useReply: (payload) => ipcRenderer.invoke('panel:use', payload),
  hidePanel: () => ipcRenderer.invoke('panel:hide'),
  openDataFolder: () => ipcRenderer.invoke('data:openFolder'),
  exportData: () => ipcRenderer.invoke('data:export'),
  importData: () => ipcRenderer.invoke('data:import'),
  licenseInfo: () => ipcRenderer.invoke('license:info'),
  activate: (code) => ipcRenderer.invoke('license:activate', code),
  checkUpdate: () => ipcRenderer.invoke('update:check'),
  openLicense: () => ipcRenderer.invoke('license:open'),
  closeLicense: () => ipcRenderer.invoke('license:close'),
  setSettings: (settings) => ipcRenderer.invoke('settings:set', settings),
  restart: () => ipcRenderer.invoke('app:restart'),
  quit: () => ipcRenderer.invoke('app:quit'),
  copy: (text) => ipcRenderer.invoke('clip:copy', text),
  onData: on('data'),
  onStatus: on('status'),
  onPanelOpen: on('panel:open'),
});
