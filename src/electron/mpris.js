import dbus from 'dbus-next';
import { app } from 'electron';
import {
  assertBoolean,
  assertFiniteNumber,
  assertPlainObject,
  assertString,
  createTrustedIpc,
  validatePayloadTuple,
} from './ipcSecurity';

export function createMpris(window) {
  const Player = require('mpris-service');
  const renderer = window.webContents;
  const trustedIpc = createTrustedIpc(window);

  const player = Player({
    name: 'yesplaymusic',
    identity: 'YesPlayMusic',
  });

  player.on('next', () => renderer.send('next'));
  player.on('previous', () => renderer.send('previous'));
  player.on('playpause', () => renderer.send('play'));
  player.on('play', () => renderer.send('play'));
  player.on('pause', () => renderer.send('play'));
  player.on('quit', () => app.exit());
  player.on('position', args =>
    renderer.send('setPosition', args.position / 1000 / 1000)
  );
  player.on('loopStatus', () => renderer.send('repeat'));
  player.on('shuffle', () => renderer.send('shuffle'));

  trustedIpc.on(
    'player',
    args => validatePayloadTuple(args, [value => assertPlainObject(value)]),
    (_event, { playing }) => {
    player.playbackStatus = playing
      ? Player.PLAYBACK_STATUS_PLAYING
      : Player.PLAYBACK_STATUS_PAUSED;
    }
  );

  trustedIpc.on(
    'metadata',
    args => validatePayloadTuple(args, [value => assertPlainObject(value)]),
    (_event, metadata) => {
    // 更新 Mpris 状态前将位置设为0, 否则 OSDLyrics 获取到的进度是上首音乐切换时的进度
    player.getPosition = () => 0;
    player.metadata = {
      'mpris:trackid': player.objectPath('track/' + metadata.trackId),
      'mpris:artUrl': metadata.artwork[0].src,
      'mpris:length': metadata.length * 1000 * 1000,
      'xesam:title': metadata.title,
      'xesam:album': metadata.album,
      'xesam:artist': metadata.artist.split(','),
      'xesam:url': metadata.url,
    };
    }
  );

  trustedIpc.on(
    'playerCurrentTrackTime',
    args => validatePayloadTuple(args, [value => assertFiniteNumber(value)]),
    (_event, position) => {
    player.getPosition = () => position * 1000 * 1000;
    player.seeked(position * 1000 * 1000);
    }
  );

  trustedIpc.on(
    'seeked',
    args => validatePayloadTuple(args, [value => assertFiniteNumber(value)]),
    (_event, position) => {
    player.seeked(position * 1000 * 1000);
    }
  );

  trustedIpc.on(
    'switchRepeatMode',
    args =>
      validatePayloadTuple(args, [
        value => {
          assertString(value, 'repeat mode', 8);
          if (!['off', 'one', 'on'].includes(value)) {
            throw new Error('repeat mode is invalid');
          }
          return value;
        },
      ]),
    (_event, mode) => {
    switch (mode) {
      case 'off':
        player.loopStatus = Player.LOOP_STATUS_NONE;
        break;
      case 'one':
        player.loopStatus = Player.LOOP_STATUS_TRACK;
        break;
      case 'on':
        player.loopStatus = Player.LOOP_STATUS_PLAYLIST;
        break;
    }
    }
  );

  trustedIpc.on(
    'switchShuffle',
    args => validatePayloadTuple(args, [value => assertBoolean(value)]),
    (_event, shuffle) => {
    player.shuffle = shuffle;
    }
  );
}

export async function createDbus(window) {
  const trustedIpc = createTrustedIpc(window);
  const bus = dbus.sessionBus();
  const Variant = dbus.Variant;

  const osdService = await bus.getProxyObject(
    'org.osdlyrics.Daemon',
    '/org/osdlyrics/Lyrics'
  );

  const osdInterface = osdService.getInterface('org.osdlyrics.Lyrics');

  trustedIpc.on(
    'sendLyrics',
    args => validatePayloadTuple(args, [value => assertPlainObject(value)]),
    async (_event, { track, lyrics }) => {
    assertPlainObject(track, 'lyric track');
    assertString(lyrics, 'lyrics', 200000);
    const metadata = {
      title: new Variant('s', track.name),
      artist: new Variant('s', track.ar.map(ar => ar.name).join(', ')),
    };

    await osdInterface.SetLyricContent(metadata, Buffer.from(lyrics));

    window.webContents.send('saveLyricFinished');
    }
  );
}
