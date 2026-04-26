import axios from 'axios';
import md5 from 'md5';

const TOUBIEC_API_URLS = [
  process.env.VUE_APP_TOUBIEC_API_URL,
  '/toubiec-wyapi',
  '/toubiec-nextmusic',
  'https://wyapi.toubiec.cn/api',
  'https://nextmusic.toubiec.cn/api',
]
  .filter(Boolean)
  .map(url => url.replace(/\/$/, ''))
  .filter((url, index, urls) => urls.indexOf(url) === index);

const MUSIC_QUALITY_TO_LEVEL = {
  128000: 'standard',
  192000: 'higher',
  320000: 'exhigh',
  flac: 'lossless',
  999000: 'hires',
};

const LEVEL_FALLBACKS = {
  hires: ['hires', 'lossless', 'exhigh', 'higher', 'standard'],
  lossless: ['lossless', 'exhigh', 'higher', 'standard'],
  exhigh: ['exhigh', 'higher', 'standard'],
  higher: ['higher', 'standard'],
  standard: ['standard'],
};

export function getToubiecLevelsByQuality(quality) {
  const level = MUSIC_QUALITY_TO_LEVEL[quality] || 'exhigh';
  return LEVEL_FALLBACKS[level] || LEVEL_FALLBACKS.exhigh;
}

export function getToubiecSongUrl(id, level) {
  if (process.env.IS_ELECTRON === true) {
    return window.electron.ipcRenderer.invoke('toubiec-get-song-url', {
      id,
      level,
    });
  }

  return requestToubiec('getSongUrl', {
    id: String(id),
    level,
  });
}

async function getToubiecToken(baseURL) {
  const response = await axios.get(`${baseURL}/getip`, {
    timeout: 10000,
  });
  const ip = response.data?.data?.ip;
  if (response.data?.code !== 200 || !ip) {
    throw new Error('failed to get toubiec auth ip');
  }

  return md5(`suxiaoqings:${ip}`);
}

async function requestToubiec(path, payload) {
  let lastError = null;

  for (const baseURL of TOUBIEC_API_URLS) {
    try {
      const token = await getToubiecToken(baseURL);
      const response = await axios.post(
        `${baseURL}/${path}`,
        {
          ...payload,
          token,
        },
        {
          timeout: 15000,
        }
      );
      return response.data;
    } catch (error) {
      lastError = error;
      console.debug(`[debug][toubiec.js] ${baseURL}/${path} failed`, error);
    }
  }

  throw lastError;
}
