import axios from 'axios';

const TOUBIEC_API_URL = (
  process.env.VUE_APP_TOUBIEC_API_URL || 'https://nextmusic.toubiec.cn/api'
).replace(/\/$/, '');

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

  return axios
    .post(
      `${TOUBIEC_API_URL}/getSongUrl`,
      {
        id: String(id),
        level,
      },
      {
        timeout: 15000,
      }
    )
    .then(response => response.data);
}
