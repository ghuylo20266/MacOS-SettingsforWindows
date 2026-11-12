const { contextBridge, ipcRenderer } = require('electron');
const OK = ['sys:info','theme:set','reg:get','reg:set','ps','launch','open','pick','wifi','bt','vol','bright','wall','power:get','power:set','battery'];
contextBridge.exposeInMainWorld('api', {
  win: (a) => ipcRenderer.send('win', a),
  i: (ch, ...a) => OK.includes(ch) ? ipcRenderer.invoke(ch, ...a) : Promise.reject('blocked')
});
