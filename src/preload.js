import { contextBridge, ipcRenderer } from 'electron';
import os from 'node:os';

const SEND_CHANNELS = new Set([
  'close',
  'maximizeOrUnmaximize',
  'metadata',
  'minimize',
  'pauseDiscordPresence',
  'playDiscordPresence',
  'player',
  'playerCurrentTrackTime',
  'removeProxy',
  'restoreDefaultShortcuts',
  'seeked',
  'sendLyrics',
  'setAlwaysOnTop',
  'setProxy',
  'settings',
  'switchGlobalShortcutStatusTemporary',
  'switchRepeatMode',
  'switchShuffle',
  'updateShortcut',
  'updateTrayLikeState',
  'updateTrayPlayState',
  'updateTrayTooltip',
]);

const INVOKE_CHANNELS = new Set([
  'clear-login-cookies',
  'lastfm-auth-url',
  'lastfm-clear-session',
  'lastfm-get-session',
  'lastfm-request',
  'set-login-cookies',
  'toubiec-get-song-url',
  'unblock-music',
]);

const RECEIVE_CHANNELS = new Set([
  'changeRouteTo',
  'decreaseVolume',
  'increaseVolume',
  'isMaximized',
  'like',
  'next',
  'nextUp',
  'play',
  'previous',
  'rememberCloseAppOption',
  'repeat',
  'routerGo',
  'saveLyricFinished',
  'search',
  'setPosition',
  'shuffle',
]);

function assertAllowed(channel, allowedChannels, direction) {
  if (!allowedChannels.has(channel)) {
    throw new Error(`Blocked ${direction} IPC channel: ${channel}`);
  }
}

const safeIpcRenderer = {
  send(channel, ...args) {
    assertAllowed(channel, SEND_CHANNELS, 'send');
    ipcRenderer.send(channel, ...args);
  },
  invoke(channel, ...args) {
    assertAllowed(channel, INVOKE_CHANNELS, 'invoke');
    return ipcRenderer.invoke(channel, ...args);
  },
  on(channel, listener) {
    assertAllowed(channel, RECEIVE_CHANNELS, 'receive');
    if (typeof listener !== 'function') {
      throw new TypeError('IPC listener must be a function');
    }
    const wrapped = (_event, ...args) => listener({ sender: 'main' }, ...args);
    ipcRenderer.on(channel, wrapped);
    return () => ipcRenderer.removeListener(channel, wrapped);
  },
  once(channel, listener) {
    assertAllowed(channel, RECEIVE_CHANNELS, 'receive');
    if (typeof listener !== 'function') {
      throw new TypeError('IPC listener must be a function');
    }
    ipcRenderer.once(channel, (_event, ...args) =>
      listener({ sender: 'main' }, ...args)
    );
  },
  removeAllListeners(channel) {
    assertAllowed(channel, RECEIVE_CHANNELS, 'receive');
    ipcRenderer.removeAllListeners(channel);
  },
};

contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: safeIpcRenderer,
});

contextBridge.exposeInMainWorld('yesPlayMusicNative', {
  ipcRenderer: safeIpcRenderer,
  platform: os.platform(),
});
