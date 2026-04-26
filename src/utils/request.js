import router from '@/router';
import { doLogout } from '@/utils/auth';
import axios from 'axios';

let baseURL = '';
// Web 和 Electron 跑在不同端口避免同时启动时冲突
if (process.env.IS_ELECTRON) {
  baseURL = process.env.VUE_APP_ELECTRON_API_URL || '/api';
} else {
  baseURL = process.env.VUE_APP_NETEASE_API_URL;
}

const service = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 15000,
});

export function normalizeError(error) {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    return {
      status: error.response?.status ?? data?.code ?? null,
      message: data?.msg ?? data?.message ?? error.message,
      data,
    };
  }

  if (error && typeof error === 'object') {
    return {
      status: error.status ?? error.code ?? null,
      message: error.message ?? String(error),
      data: error.data ?? error,
    };
  }

  return {
    status: null,
    message: String(error),
    data: error,
  };
}

service.interceptors.request.use(function (config) {
  if (!config.params) config.params = {};
  if (!baseURL.length) {
    console.error("You must set up the baseURL in the service's config");
  }

  if (!process.env.IS_ELECTRON && !config.url.includes('/login')) {
    config.params.realIP = '211.161.244.70';
  }

  // Force real_ip
  const settings = JSON.parse(localStorage.getItem('settings') || '{}');
  const enableRealIP = settings.enableRealIP;
  const realIP = settings.realIP;
  if (process.env.VUE_APP_REAL_IP) {
    config.params.realIP = process.env.VUE_APP_REAL_IP;
  } else if (enableRealIP) {
    config.params.realIP = realIP;
  }

  const proxy = settings.proxyConfig || {};
  const proxyType =
    proxy.type ||
    {
      HTTP: 'http',
      HTTPS: 'http',
    }[proxy.protocol];
  const proxyHost = proxy.host || proxy.server;
  if (['http', 'socks5'].includes(proxyType)) {
    config.params.proxy = `${proxyType}://${proxyHost}:${proxy.port}`;
  }

  return config;
});

service.interceptors.response.use(
  response => {
    const res = response.data;
    return res;
  },
  async error => {
    const normalizedError = normalizeError(error);
    /** @type {import('axios').AxiosResponse | null} */
    let response;
    let data;
    if (error === 'TypeError: baseURL is undefined') {
      response = error;
      data = error;
      console.error("You must set up the baseURL in the service's config");
    } else if (axios.isAxiosError(error) && error.response) {
      response = error.response;
      data = response.data;
    }

    const isUnauthorized =
      response?.status === 401 ||
      (response && typeof data === 'object' && data.code === 301);

    if (isUnauthorized) {
      console.warn('Token has expired. Logout now!');

      // 登出帳戶
      doLogout();

      // 導向登入頁面
      if (process.env.IS_ELECTRON === true) {
        router.push({ name: 'loginAccount' });
      } else {
        router.push({ name: 'login' });
      }
      return Promise.reject(normalizedError);
    }

    return Promise.reject(normalizedError);
  }
);

export default service;
