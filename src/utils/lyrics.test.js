import { describe, expect, it } from 'vitest';
import { lyricParser } from '@/utils/lyrics';

describe('lyrics', () => {
  it('parses standard LRC lines', () => {
    const result = lyricParser({
      lrc: { lyric: '[00:01.50]hello\n[00:03.00]world' },
    });

    expect(result.lyric).toEqual([
      { rawTime: '[00:01.50]', time: 1.5, content: 'hello' },
      { rawTime: '[00:03.00]', time: 3, content: 'world' },
    ]);
  });

  it('parses translated LRC lines', () => {
    const result = lyricParser({
      lrc: { lyric: '[00:01.00]hello' },
      tlyric: { lyric: '[00:01.00]你好' },
    });

    expect(result.tlyric).toEqual([
      { rawTime: '[00:01.00]', time: 1, content: '你好' },
    ]);
  });

  it('survives empty input, untimed lines, and very long lines', () => {
    const longLine = `${'[01:02.03]'}${'a'.repeat(5000)}`;

    expect(lyricParser({ lrc: { lyric: '' } }).lyric).toEqual([]);
    expect(lyricParser({ lrc: { lyric: 'no timestamp' } }).lyric).toEqual([]);
    expect(lyricParser({ lrc: { lyric: longLine } }).lyric[0].content).toHaveLength(
      5000
    );
  });
});
