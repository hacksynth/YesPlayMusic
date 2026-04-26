// Last.fm API documents: https://www.last.fm/api

import axios from 'axios';

const apiKey = process.env.VUE_APP_LASTFM_API_KEY;
const baseUrl = window.location.origin;
const url = 'https://ws.audioscrobbler.com/2.0/';

function requireElectronLastfm() {
  if (process.env.IS_ELECTRON !== true) {
    throw new Error('Last.fm signing must be performed by the backend proxy');
  }
}

export async function auth() {
  if (process.env.IS_ELECTRON === true) {
    const callbackUrl = `${baseUrl}/#/lastfm/callback`;
    const authUrl = await window.electron.ipcRenderer.invoke(
      'lastfm-auth-url',
      callbackUrl
    );
    window.location.assign(authUrl);
    return;
  }

  window.location.assign(
    `https://www.last.fm/api/auth/?api_key=${apiKey}&cb=${baseUrl}/lastfm/callback`
  );
}

export async function authGetSession(token) {
  if (process.env.IS_ELECTRON === true) {
    const session = await window.electron.ipcRenderer.invoke(
      'lastfm-get-session',
      token
    );
    return { data: { session } };
  }

  return axios({
    url: '/api/lastfm/session',
    method: 'POST',
    data: { token },
  });
}

export function trackUpdateNowPlaying(params) {
  requireElectronLastfm();
  return window.electron.ipcRenderer.invoke('lastfm-request', {
    method: 'track.updateNowPlaying',
    params,
  });
}

export function trackScrobble(params) {
  requireElectronLastfm();
  return window.electron.ipcRenderer.invoke('lastfm-request', {
    method: 'track.scrobble',
    params,
  });
}
