import { logout } from '@/api/auth';
import store from '@/store';

const isElectron = () =>
  process.env.IS_ELECTRON === true || process.env.IS_ELECTRON === 'true';

export function setCookies(string) {
  localStorage.removeItem('cookie-MUSIC_U');
  localStorage.removeItem('cookie-__csrf');
  localStorage.setItem('isLoggedIn', 'true');

  if (isElectron()) {
    return window.electron.ipcRenderer.invoke('set-login-cookies', string);
  }

  return Promise.resolve({ ok: true });
}

export function getCookie(key) {
  if (key !== 'MUSIC_U') return undefined;
  return localStorage.getItem('isLoggedIn') === 'true' ? 'logged-in' : undefined;
}

export function removeCookie(key) {
  localStorage.removeItem(`cookie-${key}`);
  if (key === 'MUSIC_U') {
    localStorage.removeItem('isLoggedIn');
  }
}

// MUSIC_U 只有在账户登录的情况下才有
export function isLoggedIn() {
  return getCookie('MUSIC_U') !== undefined;
}

// 账号登录
export function isAccountLoggedIn() {
  return (
    getCookie('MUSIC_U') !== undefined &&
    store.state.data.loginMode === 'account'
  );
}

// 用户名搜索（用户数据为只读）
export function isUsernameLoggedIn() {
  return store.state.data.loginMode === 'username';
}

// 账户登录或者用户名搜索都判断为登录，宽松检查
export function isLooseLoggedIn() {
  return isAccountLoggedIn() || isUsernameLoggedIn();
}

export function doLogout() {
  logout();
  removeCookie('MUSIC_U');
  removeCookie('__csrf');
  localStorage.removeItem('lastfm');
  localStorage.removeItem('lastfm-status');
  if (isElectron()) {
    window.electron.ipcRenderer.invoke('clear-login-cookies');
    window.electron.ipcRenderer.invoke('lastfm-clear-session');
  }
  // 更新状态仓库中的用户信息
  store.commit('updateData', { key: 'user', value: {} });
  // 更新状态仓库中的登录状态
  store.commit('updateData', { key: 'loginMode', value: null });
  // 更新状态仓库中的喜欢列表
  store.commit('updateData', { key: 'likedSongPlaylistID', value: undefined });
}
