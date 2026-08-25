const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  sendNotification: (data) => ipcRenderer.invoke('notification:send', data),
});
