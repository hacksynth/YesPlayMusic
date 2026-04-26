export function getSendSettingsPlugin() {
  const ipcRenderer = window.electron.ipcRenderer;
  return store => {
    store.subscribe((mutation, state) => {
      // console.log(mutation);
      if (mutation.type !== 'updateSettings') return;
      ipcRenderer.send('settings', state.settings);
    });
  };
}
