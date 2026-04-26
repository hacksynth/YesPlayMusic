import { beforeEach, describe, expect, it, vi } from 'vitest';

const loadUpdateApp = async defaultShortcuts => {
  vi.resetModules();
  vi.doMock('@/utils/staticData', () => ({ playlistCategories: [] }));
  vi.doMock('@/utils/shortcuts', () => ({ default: defaultShortcuts }));

  return import('@/utils/updateApp');
};

describe('updateApp', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('merges missing shortcuts without replacing existing custom shortcuts', async () => {
    const defaultShortcuts = [
      { id: 'play', shortcut: 'CommandOrControl+P' },
      { id: 'next', shortcut: 'CommandOrControl+Right' },
    ];
    const { updateSetting } = await loadUpdateApp(defaultShortcuts);
    localStorage.setItem(
      'settings',
      JSON.stringify({
        shortcuts: [{ id: 'play', shortcut: 'Alt+P' }],
      })
    );

    updateSetting();

    const settings = JSON.parse(localStorage.getItem('settings'));
    expect(settings.shortcuts).toEqual([
      { id: 'play', shortcut: 'Alt+P' },
      { id: 'next', shortcut: 'CommandOrControl+Right' },
    ]);
  });

  it('does not push undefined while migrating shortcuts', async () => {
    const defaultShortcuts = [
      { id: 'play', shortcut: 'CommandOrControl+P' },
      { id: 'next', shortcut: 'CommandOrControl+Right' },
    ];
    const { updateSetting } = await loadUpdateApp(defaultShortcuts);
    localStorage.setItem(
      'settings',
      JSON.stringify({
        shortcuts: [{ id: 'play', shortcut: 'Alt+P' }],
      })
    );

    updateSetting();

    const settings = JSON.parse(localStorage.getItem('settings'));
    expect(settings.shortcuts).not.toContain(undefined);
  });

  it('keeps complete shortcut lists unchanged', async () => {
    const defaultShortcuts = [
      { id: 'play', shortcut: 'CommandOrControl+P' },
      { id: 'next', shortcut: 'CommandOrControl+Right' },
    ];
    const { updateSetting } = await loadUpdateApp(defaultShortcuts);
    const shortcuts = [
      { id: 'play', shortcut: 'Alt+P' },
      { id: 'next', shortcut: 'Alt+Right' },
    ];
    localStorage.setItem('settings', JSON.stringify({ shortcuts }));

    updateSetting();

    const settings = JSON.parse(localStorage.getItem('settings'));
    expect(settings.shortcuts).toEqual(shortcuts);
  });
});
