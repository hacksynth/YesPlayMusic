export function lyricParser(lrc) {
  return {
    lyric: parseLyric(lrc?.lrc?.lyric || ''),
    tlyric: parseLyric(lrc?.tlyric?.lyric || ''),
    romalyric: parseLyric(lrc?.romalrc?.lyric || ''),
    lyricuser: lrc.lyricUser,
    transuser: lrc.transUser,
  };
}

const extractLineRegex =
  /^(?<lyricTimestamps>(?:\[\d{1,3}:\d{1,2}(?:[.:]\d{1,3})?\])+)(?<content>.*)$/;
const extractTimestampRegex =
  /\[(?<min>\d{1,3}):(?<sec>\d{1,2})(?:[.:](?<ms>\d{1,3}))?\]/g;

/**
 * @typedef {{time: number, rawTime: string, content: string}} ParsedLyric
 */

/**
 * Parse the lyric string.
 *
 * @param {string} lrc The `lrc` input.
 * @returns {ParsedLyric[]} The parsed lyric.
 * @example parseLyric("[00:00.00] Hello, World!\n[00:00.10] Test\n");
 */
function parseLyric(lrc) {
  /**
   * A sorted list of parsed lyric and its timestamp.
   *
   * @type {ParsedLyric[]}
   * @see binarySearch
   */
  const parsedLyrics = [];

  /**
   * Find the appropriate index to push our parsed lyric.
   * @param {ParsedLyric} lyric
   */
  const binarySearch = lyric => {
    let time = lyric.time;

    let low = 0;
    let high = parsedLyrics.length - 1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const midTime = parsedLyrics[mid].time;
      if (midTime === time) {
        return mid;
      } else if (midTime < time) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    return low;
  };

  for (const rawLine of lrc.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;

    const lineMatch = line.match(extractLineRegex);
    if (!lineMatch) continue;

    const { lyricTimestamps, content } = lineMatch.groups;

    for (const timestamp of lyricTimestamps.matchAll(extractTimestampRegex)) {
      const { min, sec, ms } = timestamp.groups;
      const rawTime = timestamp[0];
      const normalizedMs = (ms ?? '0').padEnd(3, '0').slice(0, 3);
      const time =
        Number(min) * 60 + Number(sec) + Number(normalizedMs) * 0.001;

      /** @type {ParsedLyric} */
      const parsedLyric = { rawTime, time, content: trimContent(content) };
      parsedLyrics.splice(binarySearch(parsedLyric), 0, parsedLyric);
    }
  }

  return parsedLyrics;
}

/**
 * @param {string} content
 * @returns {string}
 */
function trimContent(content) {
  let t = content.trim();
  return t.length < 1 ? content : t;
}

/**
 * @param {string} lyric
 */
export async function copyLyric(lyric) {
  const textToCopy = lyric;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(textToCopy);
    } catch (err) {
      alert('复制失败，请手动复制！');
    }
  } else {
    const tempInput = document.createElement('textarea');
    tempInput.value = textToCopy;
    tempInput.style.position = 'absolute';
    tempInput.style.left = '-9999px';
    document.body.appendChild(tempInput);
    tempInput.select();
    try {
      document.execCommand('copy');
    } catch (err) {
      alert('复制失败，请手动复制！');
    }
    document.body.removeChild(tempInput);
  }
}
