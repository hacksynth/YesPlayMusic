import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import relativeTime from 'dayjs/plugin/relativeTime';
import locale from '@/locale';

dayjs.extend(duration);
dayjs.extend(relativeTime);

const humanTimeUnits = {
  'zh-CN': {
    hours: '\u5c0f\u65f6',
    minutes: '\u5206\u949f',
  },
  'zh-TW': {
    hours: '\u5c0f\u6642',
    minutes: '\u5206\u9418',
  },
};

const getLocale = () => {
  const current = locale.locale;
  return typeof current === 'string' ? current : current?.value;
};

export function formatTime(milliseconds, format = 'HH:MM:SS') {
  if (!milliseconds) return '';

  const time = dayjs.duration(milliseconds);
  const hours = time.hours().toString();
  const mins = time.minutes().toString();
  const seconds = time.seconds().toString().padStart(2, '0');

  if (format === 'HH:MM:SS') {
    return hours !== '0'
      ? `${hours}:${mins.padStart(2, '0')}:${seconds}`
      : `${mins}:${seconds}`;
  }

  if (format === 'Human') {
    const units = humanTimeUnits[getLocale()] || {
      hours: 'hr',
      minutes: 'min',
    };
    return hours !== '0'
      ? `${hours} ${units.hours} ${mins} ${units.minutes}`
      : `${mins} ${units.minutes}`;
  }

  return '';
}

export function formatDate(timestamp, format = 'MMM D, YYYY') {
  if (!timestamp) return '';
  if (['zh-CN', 'zh-TW'].includes(getLocale())) {
    format = 'YYYY\u5e74M\u6708D\u65e5';
  }
  return dayjs(timestamp).format(format);
}

export function formatAlbumType(type, album) {
  if (!type) return '';
  if (type === 'EP/Single') {
    return album.size === 1 ? 'Single' : 'EP';
  }
  if (type === 'Single') {
    return 'Single';
  }
  if (type === '\u4e13\u8f91') {
    return 'Album';
  }
  return type;
}

export function resizeImage(imgUrl, size = 512) {
  if (!imgUrl) return '';
  return `${imgUrl.replace(/^http:/, 'https:')}?param=${size}y${size}`;
}

export function formatPlayCount(count) {
  if (!count) return '';

  if (getLocale() === 'zh-CN') {
    if (count > 100000000) {
      return `${Math.floor((count / 100000000) * 100) / 100}\u4ebf`;
    }
    if (count > 100000) {
      return `${Math.floor((count / 10000) * 10) / 10}\u4e07`;
    }
    if (count > 10000) {
      return `${Math.floor((count / 10000) * 100) / 100}\u4e07`;
    }
    return count;
  }

  if (getLocale() === 'zh-TW') {
    if (count > 100000000) {
      return `${Math.floor((count / 100000000) * 100) / 100}\u5104`;
    }
    if (count > 100000) {
      return `${Math.floor((count / 10000) * 10) / 10}\u842c`;
    }
    if (count > 10000) {
      return `${Math.floor((count / 10000) * 100) / 100}\u842c`;
    }
    return count;
  }

  if (count > 10000000) {
    return `${Math.floor((count / 1000000) * 10) / 10}M`;
  }
  if (count > 1000000) {
    return `${Math.floor((count / 1000000) * 100) / 100}M`;
  }
  if (count > 1000) {
    return `${Math.floor((count / 1000) * 100) / 100}K`;
  }
  return count;
}

export function toHttps(url) {
  if (!url) return '';
  return url.replace(/^http:/, 'https:');
}
