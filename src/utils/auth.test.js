import { beforeEach, describe, expect, it, vi } from 'vitest';

const loadAuth = async () => {
  vi.resetModules();
  const store = {
    state: {
      data: { loginMode: 'account' },
    },
    commit: vi.fn(),
  };
  const logout = vi.fn();

  vi.doMock('@/api/auth', () => ({ logout }));
  vi.doMock('@/store', () => ({ default: store }));

  const auth = await import('@/utils/auth');
  return { auth, store, logout };
};

describe('auth', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    localStorage.clear();
    window.electron = {
      ipcRenderer: {
        invoke: vi.fn().mockResolvedValue({ ok: true }),
      },
    };
  });

  it('passes login cookies to the main process in Electron', async () => {
    vi.stubEnv('IS_ELECTRON', 'true');
    const { auth } = await loadAuth();

    await auth.setCookies('MUSIC_U=secret; Path=/');

    expect(window.electron.ipcRenderer.invoke).toHaveBeenCalledWith(
      'set-login-cookies',
      'MUSIC_U=secret; Path=/'
    );
  });

  it('clears local login state on logout', async () => {
    vi.stubEnv('IS_ELECTRON', 'false');
    const { auth, logout } = await loadAuth();
    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem('lastfm', '{}');

    auth.doLogout();

    expect(logout).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('isLoggedIn')).toBeNull();
    expect(localStorage.getItem('lastfm')).toBeNull();
  });

  it('does not write sensitive cookie values to localStorage', async () => {
    vi.stubEnv('IS_ELECTRON', 'false');
    const { auth } = await loadAuth();

    await auth.setCookies('MUSIC_U=secret-token; __csrf=csrf-token');

    expect(localStorage.getItem('cookie-MUSIC_U')).toBeNull();
    expect(localStorage.getItem('cookie-__csrf')).toBeNull();
    expect(localStorage.getItem('isLoggedIn')).toBe('true');
  });
});
