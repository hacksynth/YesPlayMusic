import { beforeEach, describe, expect, it, vi } from 'vitest';

const loadPlayer = async () => {
  vi.resetModules();
  vi.stubEnv('IS_ELECTRON', 'false');

  vi.doMock('@/api/album', () => ({ getAlbum: vi.fn() }));
  vi.doMock('@/api/artist', () => ({ getArtist: vi.fn() }));
  vi.doMock('@/api/lastfm', () => ({
    trackScrobble: vi.fn(),
    trackUpdateNowPlaying: vi.fn(),
  }));
  vi.doMock('@/api/others', () => ({
    fmTrash: vi.fn(),
    personalFM: vi.fn().mockResolvedValue({ data: [{ id: 1 }, { id: 2 }] }),
  }));
  vi.doMock('@/api/playlist', () => ({
    getPlaylistDetail: vi.fn(),
    intelligencePlaylist: vi.fn(),
  }));
  vi.doMock('@/api/track', () => ({
    getLyric: vi.fn(),
    getMP3: vi.fn(),
    getTrackDetail: vi.fn(),
    scrobble: vi.fn(),
  }));
  vi.doMock('@/api/toubiec', () => ({
    getToubiecLevelsByQuality: vi.fn(),
    getToubiecSongUrl: vi.fn(),
  }));
  vi.doMock('md5', () => ({ default: vi.fn(value => `md5:${value}`) }));
  vi.doMock('@/store', () => ({
    default: {
      state: {
        liked: { songs: [] },
        lastfm: { connected: false },
        settings: {
          enableDiscordRichPresence: false,
          enableOsdlyricsSupport: false,
        },
      },
      commit: vi.fn(),
      dispatch: vi.fn(),
    },
  }));
  vi.doMock('@/utils/auth', () => ({ isAccountLoggedIn: vi.fn(() => true) }));
  vi.doMock('@/utils/db', () => ({
    cacheTrackSource: vi.fn(),
    getTrackSource: vi.fn(),
  }));
  vi.doMock('@/utils/platform', () => ({
    isCreateMpris: false,
    isCreateTray: false,
  }));
  vi.doMock('howler', () => ({ Howl: vi.fn(), Howler: {} }));
  vi.doMock('lodash-es/shuffle', () => ({ default: value => value }));
  vi.doMock('@/utils/base64', () => ({ decode: vi.fn() }));

  const { default: Player } = await import('@/utils/Player');
  Player.prototype._init = vi.fn();
  return Player;
};

const createHowler = () => {
  let currentTime = 0;
  let playing = false;
  return {
    play: vi.fn(() => {
      playing = true;
    }),
    pause: vi.fn(() => {
      playing = false;
    }),
    stop: vi.fn(() => {
      playing = false;
    }),
    playing: vi.fn(() => playing),
    fade: vi.fn(),
    once: vi.fn((event, callback) => callback()),
    seek: vi.fn(value => {
      if (value !== undefined) currentTime = value;
      return currentTime;
    }),
  };
};

describe('Player', () => {
  beforeEach(() => {
    localStorage.clear();
    document.title = 'YesPlayMusic';
  });

  it('transitions through initial, playing, paused, and idle states', async () => {
    const Player = await loadPlayer();
    const player = new Player();
    player._howler = createHowler();
    player._currentTrack = {
      id: 1,
      name: 'Song',
      ar: [{ name: 'Artist' }],
      al: { name: 'Album', picUrl: '' },
      dt: 1000,
    };

    expect(player.playing).toBe(false);
    player.play();
    expect(player.playing).toBe(true);
    player.pause();
    expect(player.playing).toBe(false);
    player.playNextTrack();
    expect(player.playing).toBe(false);
  });

  it('seeks to 0 instead of treating it as empty input', async () => {
    const Player = await loadPlayer();
    const player = new Player();
    player._howler = createHowler();

    expect(player.seek(0)).toBe(0);
    expect(player._howler.seek).toHaveBeenCalledWith(0);
  });

  it('does not throw when next is called with an empty queue', async () => {
    const Player = await loadPlayer();
    const player = new Player();
    player._howler = createHowler();
    player.list = [];

    expect(() => player.playNextTrack()).not.toThrow();
    expect(player.playNextTrack()).toBe(false);
  });

  it('uses the API song URL source even when the user is not logged in', async () => {
    const Player = await loadPlayer();
    const { getMP3 } = await import('@/api/track');
    const { isAccountLoggedIn } = await import('@/utils/auth');
    getMP3.mockResolvedValue({
      data: [
        {
          url: 'http://er.sycdn.kuwo.cn/song.mp3',
          br: 128000,
          freeTrialInfo: null,
        },
      ],
    });
    isAccountLoggedIn.mockReturnValue(false);

    const player = new Player();
    const source = await player._getAudioSourceFromNetease({ id: 2600493765 });

    expect(getMP3).toHaveBeenCalledWith(2600493765);
    expect(source).toBe('http://er.sycdn.kuwo.cn/song.mp3');
  });

  it('upgrades native Netease media URLs to HTTPS', async () => {
    const Player = await loadPlayer();
    const { getMP3 } = await import('@/api/track');
    getMP3.mockResolvedValue({
      data: [
        {
          url: 'http://m701.music.126.net/song.mp3',
          br: 320000,
          freeTrialInfo: null,
        },
      ],
    });

    const player = new Player();
    const source = await player._getAudioSourceFromNetease({ id: 1 });

    expect(source).toBe('https://m701.music.126.net/song.mp3');
  });
});
