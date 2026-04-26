import { app, dialog, globalShortcut, session } from 'electron';
import UNM from '@unblockneteasemusic/rust-napi';
import { registerGlobalShortcut } from '@/electron/globalShortcut';
import cloneDeep from 'lodash-es/cloneDeep';
import shortcuts from '@/utils/shortcuts';
import { createMenu } from './menu';
import { isCreateTray, isMac } from '@/utils/platform';
import axios from 'axios';
import crypto from 'node:crypto';
import {
  assertBoolean,
  assertFiniteNumber,
  assertNoArgs,
  assertPlainObject,
  assertString,
  createTrustedIpc,
  validatePayloadTuple,
} from './ipcSecurity';

const clc = require('cli-color');
const log = text => {
  console.log(`${clc.blueBright('[ipcMain.js]')} ${text}`);
};

const LASTFM_API_URL = 'https://ws.audioscrobbler.com/2.0/';
const TOUBIEC_API_URL = (
  process.env.VUE_APP_TOUBIEC_API_URL || 'https://wyapi.toubiec.cn/api'
).replace(/\/$/, '');

const ALLOWED_LASTFM_METHODS = new Set([
  'auth.getSession',
  'track.scrobble',
  'track.updateNowPlaying',
]);

const ALLOWED_TOUBIEC_LEVELS = new Set([
  'standard',
  'higher',
  'exhigh',
  'lossless',
  'hires',
]);

const VALID_SHORTCUT_TYPES = new Set(['shortcut', 'globalShortcut']);
const VALID_SHORTCUT_IDS = new Set(shortcuts.map(shortcut => shortcut.id));
const VALID_SHORTCUT_MODIFIERS = new Set([
  'Alt',
  'AltGr',
  'Cmd',
  'CmdOrCtrl',
  'Command',
  'CommandOrControl',
  'Control',
  'Ctrl',
  'Meta',
  'Option',
  'Shift',
  'Super',
]);
const VALID_SHORTCUT_KEYS = new Set([
  'Backspace',
  'Delete',
  'Down',
  'End',
  'Enter',
  'Esc',
  'Escape',
  'Home',
  'Insert',
  'Left',
  'PageDown',
  'PageUp',
  'Right',
  'Space',
  'Tab',
  'Up',
  '=',
  '-',
  '~',
  '[',
  ']',
  ';',
  "'",
  ',',
  '.',
  '/',
]);

for (let code = 65; code <= 90; code += 1) {
  VALID_SHORTCUT_KEYS.add(String.fromCharCode(code));
}
for (let code = 0; code <= 9; code += 1) {
  VALID_SHORTCUT_KEYS.add(String(code));
}
for (let code = 1; code <= 24; code += 1) {
  VALID_SHORTCUT_KEYS.add(`F${code}`);
}

function validateHost(host) {
  assertString(host, 'proxy host', 253);
  const domainPattern =
    /^(?=.{1,253}$)(?!-)([a-zA-Z0-9-]{1,63}\.)*[a-zA-Z0-9-]{1,63}$/;
  const ipv4Pattern =
    /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
  const ipv6Pattern = /^\[[0-9a-fA-F:]+\]$|^[0-9a-fA-F:]+$/;
  if (
    host !== 'localhost' &&
    !domainPattern.test(host) &&
    !ipv4Pattern.test(host) &&
    !ipv6Pattern.test(host)
  ) {
    throw new Error('proxy host must be a valid domain or IP address');
  }
  return host;
}

function validatePort(port) {
  const parsedPort = Number(port);
  if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
    throw new Error('proxy port must be an integer from 1 to 65535');
  }
  return parsedPort;
}

function validateSetProxyArgs(args) {
  return validatePayloadTuple(args, [
    value => {
      const config = assertPlainObject(value, 'proxy config');
      if (!['http', 'socks5', 'direct', 'system'].includes(config.type)) {
        throw new Error('proxy type must be http, socks5, direct, or system');
      }
      if (['direct', 'system'].includes(config.type)) {
        return { type: config.type };
      }
      return {
        type: config.type,
        host: validateHost(config.host),
        port: validatePort(config.port),
      };
    },
  ]);
}

function validateAccelerator(shortcut) {
  assertString(shortcut, 'shortcut', 80);
  if (/[\r\n;&|`$<>]/.test(shortcut)) {
    throw new Error('shortcut contains forbidden characters');
  }
  const parts = shortcut.split('+').map(part => part.trim());
  if (parts.length === 0 || parts.some(part => part.length === 0)) {
    throw new Error('shortcut must be a valid Electron accelerator');
  }
  const key = parts[parts.length - 1];
  const modifiers = parts.slice(0, -1);
  if (!VALID_SHORTCUT_KEYS.has(key)) {
    throw new Error('shortcut key is not allowed');
  }
  if (
    modifiers.some(modifier => !VALID_SHORTCUT_MODIFIERS.has(modifier)) ||
    new Set(modifiers).size !== modifiers.length
  ) {
    throw new Error('shortcut modifiers are not allowed');
  }
  return shortcut;
}

function validateShortcutArgs(args) {
  return validatePayloadTuple(args, [
    value => {
      const payload = assertPlainObject(value, 'shortcut payload');
      if (!VALID_SHORTCUT_IDS.has(payload.id)) {
        throw new Error('shortcut id is not allowed');
      }
      if (!VALID_SHORTCUT_TYPES.has(payload.type)) {
        throw new Error('shortcut type is not allowed');
      }
      return {
        id: payload.id,
        type: payload.type,
        shortcut: validateAccelerator(payload.shortcut),
      };
    },
  ]);
}

function validateUnblockMusicArgs(executor, args) {
  if (args.length !== 3) {
    throw new Error('unblock-music expects source, track, and context');
  }
  const [sourceListString, ncmTrack, context] = args;
  const availableSources = executor.list();

  if (sourceListString !== null && sourceListString !== undefined) {
    assertString(sourceListString, 'unblock-music source', 256);
    const invalidSource = sourceListString
      .split(',')
      .map(source => source.trim().toLowerCase())
      .filter(Boolean)
      .find(source => !availableSources.includes(source));
    if (invalidSource) {
      throw new Error(`unblock-music source is not allowed: ${invalidSource}`);
    }
  }

  return [
    sourceListString,
    assertPlainObject(ncmTrack, 'unblock-music track'),
    assertPlainObject(context, 'unblock-music context'),
  ];
}

function getLastfmApiKey() {
  const apiKey = process.env.LASTFM_API_KEY || process.env.VUE_APP_LASTFM_API_KEY;
  if (!apiKey) throw new Error('LASTFM_API_KEY is not configured');
  return apiKey;
}

function getLastfmSharedSecret() {
  const secret =
    process.env.LASTFM_SHARED_SECRET ||
    process.env.LASTFM_API_SHARED_SECRET;
  if (!secret) throw new Error('LASTFM_SHARED_SECRET is not configured');
  return secret;
}

function signLastfmParams(params) {
  const signature = Object.keys(params)
    .sort()
    .reduce((acc, key) => `${acc}${key}${params[key]}`, '');
  return crypto
    .createHash('md5')
    .update(signature + getLastfmSharedSecret())
    .digest('hex');
}

function validateLastfmRequestArgs(args) {
  return validatePayloadTuple(args, [
    value => {
      const payload = assertPlainObject(value, 'lastfm payload');
      assertString(payload.method, 'lastfm method', 80);
      if (!ALLOWED_LASTFM_METHODS.has(payload.method)) {
        throw new Error('lastfm method is not allowed');
      }
      const params = assertPlainObject(payload.params || {}, 'lastfm params');
      for (const [key, paramValue] of Object.entries(params)) {
        if (!/^[a-zA-Z0-9_.]+$/.test(key)) {
          throw new Error('lastfm param key is invalid');
        }
        if (
          !['string', 'number', 'boolean'].includes(typeof paramValue) ||
          String(paramValue).length > 2048
        ) {
          throw new Error('lastfm param value is invalid');
        }
      }
      return { method: payload.method, params };
    },
  ]);
}

function validateTokenArgs(args) {
  return validatePayloadTuple(args, [
    value => {
      assertString(value, 'lastfm token', 256);
      if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
        throw new Error('lastfm token is invalid');
      }
      return value;
    },
  ]);
}

function validateToubiecArgs(args) {
  return validatePayloadTuple(args, [
    value => {
      const payload = assertPlainObject(value, 'toubiec payload');
      const id = String(payload.id);
      if (!/^\d+$/.test(id)) {
        throw new Error('toubiec id must be numeric');
      }
      assertString(payload.level, 'toubiec level', 32);
      if (!ALLOWED_TOUBIEC_LEVELS.has(payload.level)) {
        throw new Error('toubiec level is not allowed');
      }
      return { id, level: payload.level };
    },
  ]);
}

function parseLoginCookieString(cookieString) {
  assertString(cookieString, 'login cookie', 20000);
  return cookieString
    .split(';;')
    .map(cookie => cookie.trim())
    .filter(Boolean)
    .map(cookie => {
      const [nameValue, ...attributes] = cookie.split(';').map(part => part.trim());
      const separatorIndex = nameValue.indexOf('=');
      if (separatorIndex <= 0) {
        throw new Error('login cookie contains an invalid name/value pair');
      }
      const name = nameValue.slice(0, separatorIndex);
      const value = nameValue.slice(separatorIndex + 1);
      if (!/^[A-Za-z0-9_.-]+$/.test(name)) {
        throw new Error('login cookie name is invalid');
      }
      const parsed = { name, value, path: '/' };
      for (const attribute of attributes) {
        const [attributeName, attributeValue] = attribute.split('=');
        if (!attributeName) continue;
        const normalizedName = attributeName.toLowerCase();
        if (normalizedName === 'path' && attributeValue?.startsWith('/')) {
          parsed.path = attributeValue;
        } else if (normalizedName === 'expires') {
          const expires = Date.parse(attributeValue);
          if (!Number.isNaN(expires)) parsed.expirationDate = expires / 1000;
        } else if (normalizedName === 'max-age') {
          const maxAge = Number(attributeValue);
          if (Number.isFinite(maxAge)) {
            parsed.expirationDate = Math.floor(Date.now() / 1000) + maxAge;
          }
        }
      }
      return parsed;
    });
}

const exitAsk = (e, win) => {
  e.preventDefault(); //阻止默认行为
  dialog
    .showMessageBox({
      type: 'info',
      title: 'Information',
      cancelId: 2,
      defaultId: 0,
      message: '确定要关闭吗？',
      buttons: ['最小化', '直接退出'],
    })
    .then(result => {
      if (result.response === 0) {
        e.preventDefault(); //阻止默认行为
        win.minimize(); //调用 最小化实例方法
      } else if (result.response === 1) {
        win = null;
        //app.quit();
        app.exit(); //exit()直接关闭客户端，不会执行quit();
      }
    })
    .catch(err => {
      log(err);
    });
};

const exitAskWithoutMac = (e, win) => {
  e.preventDefault(); //阻止默认行为
  dialog
    .showMessageBox({
      type: 'info',
      title: 'Information',
      cancelId: 2,
      defaultId: 0,
      message: '确定要关闭吗？',
      buttons: ['最小化到托盘', '直接退出'],
      checkboxLabel: '记住我的选择',
    })
    .then(result => {
      if (result.checkboxChecked && result.response !== 2) {
        win.webContents.send(
          'rememberCloseAppOption',
          result.response === 0 ? 'minimizeToTray' : 'exit'
        );
      }

      if (result.response === 0) {
        e.preventDefault(); //阻止默认行为
        win.hide(); //调用 最小化实例方法
      } else if (result.response === 1) {
        win = null;
        //app.quit();
        app.exit(); //exit()直接关闭客户端，不会执行quit();
      }
    })
    .catch(err => {
      log(err);
    });
};

const client = require('discord-rich-presence')('818936529484906596');

/**
 * Make data a Buffer.
 *
 * @param {?} data The data to convert.
 * @returns {import("buffer").Buffer} The converted data.
 */
function toBuffer(data) {
  if (data instanceof Buffer) {
    return data;
  } else {
    return Buffer.from(data);
  }
}

/**
 * Get the file base64 data from bilivideo.
 *
 * @param {string} url The URL to fetch.
 * @returns {Promise<string>} The file base64 data.
 */
async function getBiliVideoFile(url) {
  const axios = await import('axios').then(m => m.default);
  const response = await axios.get(url, {
    headers: {
      Referer: 'https://www.bilibili.com/',
      'User-Agent': 'okhttp/3.4.1',
    },
    responseType: 'arraybuffer',
  });

  const buffer = toBuffer(response.data);
  const encodedData = buffer.toString('base64');

  return encodedData;
}

/**
 * Parse the source string (`a, b`) to source list `['a', 'b']`.
 *
 * @param {import("@unblockneteasemusic/rust-napi").Executor} executor
 * @param {string} sourceString The source string.
 * @returns {string[]} The source list.
 */
function parseSourceStringToList(executor, sourceString) {
  const availableSource = executor.list();

  return sourceString
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(s => {
      const isAvailable = availableSource.includes(s);

      if (!isAvailable) {
        log(`This source is not one of the supported source: ${s}`);
      }

      return isAvailable;
    });
}

export function initIpcMain(win, store, trayEventEmitter) {
  // WIP: Do not enable logging as it has some issues in non-blocking I/O environment.
  // UNM.enableLogging(UNM.LoggingType.ConsoleEnv);
  const unmExecutor = new UNM.Executor();
  const trustedIpc = createTrustedIpc(win, log);

  trustedIpc.handle(
    'unblock-music',
    args => validateUnblockMusicArgs(unmExecutor, args),
    /**
     *
     * @param {string | null} sourceListString
     * @param {Record<string, any>} ncmTrack
     * @param {UNM.Context} context
     */
    async (_event, sourceListString, ncmTrack, context) => {
      // Formt the track input
      // FIXME: Figure out the structure of Track
      const song = {
        id: ncmTrack.id && ncmTrack.id.toString(),
        name: ncmTrack.name,
        duration: ncmTrack.dt,
        album: ncmTrack.al && {
          id: ncmTrack.al.id && ncmTrack.al.id.toString(),
          name: ncmTrack.al.name,
        },
        artists: ncmTrack.ar
          ? ncmTrack.ar.map(({ id, name }) => ({
              id: id && id.toString(),
              name,
            }))
          : [],
      };

      const sourceList =
        typeof sourceListString === 'string'
          ? parseSourceStringToList(unmExecutor, sourceListString)
          : ['ytdl', 'bilibili', 'pyncm', 'kugou'];
      log(`[UNM] using source: ${sourceList.join(', ')}`);
      log(`[UNM] using configuration: ${JSON.stringify(context)}`);

      try {
        // TODO: tell users to install yt-dlp.
        const matchedAudio = await unmExecutor.search(
          sourceList,
          song,
          context
        );
        const retrievedSong = await unmExecutor.retrieve(matchedAudio, context);

        // bilibili's audio file needs some special treatment
        if (retrievedSong.url.includes('bilivideo.com')) {
          retrievedSong.url = await getBiliVideoFile(retrievedSong.url);
        }

        log(`respond with retrieve song…`);
        log(JSON.stringify(matchedAudio));
        return retrievedSong;
      } catch (err) {
        const errorMessage = err instanceof Error ? `${err.message}` : `${err}`;
        log(`UnblockNeteaseMusic failed: ${errorMessage}`);
        return null;
      }
    }
  );

  trustedIpc.handle(
    'set-login-cookies',
    args => validatePayloadTuple(args, [value => value]),
    async (_event, cookieString) => {
      const cookies = parseLoginCookieString(cookieString);
      await Promise.all(
        cookies.map(cookie => {
          const cookieDetails = {
            url: 'https://music.163.com',
            domain: '.music.163.com',
            path: cookie.path,
            name: cookie.name,
            value: cookie.value,
            httpOnly: true,
            secure: true,
            sameSite: 'lax',
          };
          if (cookie.expirationDate) {
            cookieDetails.expirationDate = cookie.expirationDate;
          }
          return session.defaultSession.cookies.set(cookieDetails);
        })
      );
      store.set('auth.isLoggedIn', true);
      return { ok: true, names: cookies.map(cookie => cookie.name) };
    }
  );

  trustedIpc.handle('clear-login-cookies', assertNoArgs, async () => {
    await Promise.all(
      ['MUSIC_U', '__csrf'].map(name =>
        session.defaultSession.cookies
          .remove('https://music.163.com', name)
          .catch(() => null)
      )
    );
    store.set('auth.isLoggedIn', false);
    return { ok: true };
  });

  trustedIpc.handle(
    'lastfm-auth-url',
    args =>
      validatePayloadTuple(args, [
        value => {
          assertString(value, 'lastfm callback URL', 2048);
          const parsedUrl = new URL(value);
          if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
            throw new Error('lastfm callback URL protocol is not allowed');
          }
          return parsedUrl.toString();
        },
      ]),
    async (_event, callbackUrl) => {
      const authUrl = new URL('https://www.last.fm/api/auth/');
      authUrl.searchParams.set('api_key', getLastfmApiKey());
      authUrl.searchParams.set('cb', callbackUrl);
      return authUrl.toString();
    }
  );

  trustedIpc.handle(
    'lastfm-get-session',
    validateTokenArgs,
    async (_event, token) => {
      const params = {
        api_key: getLastfmApiKey(),
        method: 'auth.getSession',
        token,
      };
      const response = await axios.get(LASTFM_API_URL, {
        params: {
          ...params,
          api_sig: signLastfmParams(params),
          format: 'json',
        },
      });
      const sessionInfo = response.data?.session;
      if (!sessionInfo?.key) {
        throw new Error('Last.fm did not return a session key');
      }
      store.set('lastfm.session', sessionInfo);
      return {
        connected: true,
        name: sessionInfo.name,
      };
    }
  );

  trustedIpc.handle(
    'lastfm-request',
    validateLastfmRequestArgs,
    async (_event, { method, params }) => {
      const lastfmSession = store.get('lastfm.session');
      if (!lastfmSession?.key) {
        throw new Error('Last.fm is not connected');
      }
      const signedParams = {
        ...params,
        api_key: getLastfmApiKey(),
        method,
        sk: lastfmSession.key,
      };
      const response = await axios.post(LASTFM_API_URL, null, {
        params: {
          ...signedParams,
          api_sig: signLastfmParams(signedParams),
          format: 'json',
        },
      });
      return response.data;
    }
  );

  trustedIpc.handle('lastfm-clear-session', assertNoArgs, async () => {
    store.delete('lastfm.session');
    return { ok: true };
  });

  trustedIpc.handle(
    'toubiec-get-song-url',
    validateToubiecArgs,
    async (_event, { id, level }) => {
      const token = process.env.TOUBIEC_TOKEN;
      if (!token) throw new Error('TOUBIEC_TOKEN is not configured');
      const response = await axios.post(
        `${TOUBIEC_API_URL}/getSongUrl`,
        { id, level, token },
        { timeout: 15000 }
      );
      return response.data;
    }
  );

  trustedIpc.on('close', assertNoArgs, () => {
    const closeEvent = { preventDefault() {} };
    if (isMac) {
      win.hide();
      exitAsk(closeEvent, win);
    } else {
      let closeOpt = store.get('settings.closeAppOption');
      if (closeOpt === 'exit') {
        win = null;
        //app.quit();
        app.exit(); //exit()直接关闭客户端，不会执行quit();
      } else if (closeOpt === 'minimizeToTray') {
        closeEvent.preventDefault();
        win.hide();
      } else {
        exitAskWithoutMac(closeEvent, win);
      }
    }
  });

  trustedIpc.on('minimize', assertNoArgs, () => {
    win.minimize();
  });

  trustedIpc.on('maximizeOrUnmaximize', assertNoArgs, () => {
    win.isMaximized() ? win.unmaximize() : win.maximize();
  });

  trustedIpc.on(
    'setAlwaysOnTop',
    args => validatePayloadTuple(args, [value => assertBoolean(value)]),
    (_event, enabled) => {
      win.setAlwaysOnTop(enabled);
    }
  );

  trustedIpc.on(
    'settings',
    args => validatePayloadTuple(args, [value => assertPlainObject(value)]),
    (_event, options) => {
    store.set('settings', options);
    if (options.enableGlobalShortcut) {
      registerGlobalShortcut(win, store);
    } else {
      log('unregister global shortcut');
      globalShortcut.unregisterAll();
    }
    }
  );

  trustedIpc.on(
    'playDiscordPresence',
    args => validatePayloadTuple(args, [value => assertPlainObject(value)]),
    (_event, track) => {
    client.updatePresence({
      details: track.name + ' - ' + track.ar.map(ar => ar.name).join(','),
      state: track.al.name,
      endTimestamp: Date.now() + track.dt,
      largeImageKey: track.al.picUrl,
      largeImageText: 'Listening ' + track.name,
      smallImageKey: 'play',
      smallImageText: 'Playing',
      instance: true,
    });
    }
  );

  trustedIpc.on(
    'pauseDiscordPresence',
    args => validatePayloadTuple(args, [value => assertPlainObject(value)]),
    (_event, track) => {
    client.updatePresence({
      details: track.name + ' - ' + track.ar.map(ar => ar.name).join(','),
      state: track.al.name,
      largeImageKey: track.al.picUrl,
      largeImageText: 'YesPlayMusic',
      smallImageKey: 'pause',
      smallImageText: 'Pause',
      instance: true,
    });
    }
  );

  trustedIpc.on('setProxy', validateSetProxyArgs, (_event, config) => {
    const proxyRules =
      config.type === 'direct'
        ? ''
        : config.type === 'system'
          ? undefined
          : `${config.type}://${config.host}:${config.port}`;
    store.set('proxy', proxyRules);
    win.webContents.session.setProxy(
      proxyRules === undefined ? {} : { proxyRules },
      () => {
        log('finished setProxy');
      }
    );
  });

  trustedIpc.on('removeProxy', assertNoArgs, () => {
    log('removeProxy');
    win.webContents.session.setProxy({});
    store.set('proxy', '');
  });

  trustedIpc.on(
    'switchGlobalShortcutStatusTemporary',
    args =>
      validatePayloadTuple(args, [
        value => {
          assertString(value, 'shortcut status', 16);
          if (!['disable', 'enable'].includes(value)) {
            throw new Error('shortcut status must be disable or enable');
          }
          return value;
        },
      ]),
    (_event, status) => {
    log('switchGlobalShortcutStatusTemporary');
    if (status === 'disable') {
      globalShortcut.unregisterAll();
    } else {
      registerGlobalShortcut(win, store);
    }
    }
  );

  trustedIpc.on('updateShortcut', validateShortcutArgs, (_event, { id, type, shortcut }) => {
    log('updateShortcut');
    let shortcuts = store.get('settings.shortcuts');
    let newShortcut = shortcuts.find(s => s.id === id);
    newShortcut[type] = shortcut;
    store.set('settings.shortcuts', shortcuts);

    createMenu(win, store);
    globalShortcut.unregisterAll();
    registerGlobalShortcut(win, store);
  });

  trustedIpc.on('restoreDefaultShortcuts', assertNoArgs, () => {
    log('restoreDefaultShortcuts');
    store.set('settings.shortcuts', cloneDeep(shortcuts));

    createMenu(win, store);
    globalShortcut.unregisterAll();
    registerGlobalShortcut(win, store);
  });

  if (isCreateTray) {
    trustedIpc.on(
      'updateTrayTooltip',
      args => validatePayloadTuple(args, [value => assertString(value, 'title')]),
      (_event, title) => {
      trayEventEmitter.emit('updateTooltip', title);
      }
    );
    trustedIpc.on(
      'updateTrayPlayState',
      args => validatePayloadTuple(args, [value => assertBoolean(value)]),
      (_event, isPlaying) => {
      trayEventEmitter.emit('updatePlayState', isPlaying);
      }
    );
    trustedIpc.on(
      'updateTrayLikeState',
      args => validatePayloadTuple(args, [value => assertBoolean(value)]),
      (_event, isLiked) => {
      trayEventEmitter.emit('updateLikeState', isLiked);
      }
    );
  }
}
