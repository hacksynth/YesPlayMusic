import { beforeEach, describe, expect, it, vi } from 'vitest';

const createRequestModule = async () => {
  vi.resetModules();

  const handlers = {
    request: null,
    responseSuccess: null,
    responseError: null,
  };

  const service = {
    interceptors: {
      request: {
        use: vi.fn(handler => {
          handlers.request = handler;
        }),
      },
      response: {
        use: vi.fn((success, error) => {
          handlers.responseSuccess = success;
          handlers.responseError = error;
        }),
      },
    },
  };

  const doLogout = vi.fn();
  const routerPush = vi.fn();

  vi.doMock('axios', () => ({
    default: {
      create: vi.fn(() => service),
      isAxiosError: error => Boolean(error?.isAxiosError),
    },
  }));
  vi.doMock('@/utils/auth', () => ({ doLogout }));
  vi.doMock('@/router', () => ({ default: { push: routerPush } }));

  const mod = await import('@/utils/request');
  return { ...mod, handlers, doLogout, routerPush };
};

describe('request', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    localStorage.clear();
  });

  it('passes through data from a normal 200 response', async () => {
    const { handlers } = await createRequestModule();

    expect(handlers.responseSuccess({ data: { code: 200, data: { ok: true } } }))
      .toEqual({ code: 200, data: { ok: true } });
  });

  it('logs out and rejects on 401 responses', async () => {
    const { handlers, doLogout } = await createRequestModule();
    const error = {
      isAxiosError: true,
      message: 'Request failed with status code 401',
      response: { status: 401, data: { message: 'Unauthorized' } },
    };

    await expect(handlers.responseError(error)).rejects.toMatchObject({
      status: 401,
      message: 'Unauthorized',
    });
    expect(doLogout).toHaveBeenCalledTimes(1);
  });

  it('rejects network errors as normalized error objects', async () => {
    const { handlers } = await createRequestModule();
    const error = {
      isAxiosError: true,
      code: 'ECONNABORTED',
      message: 'timeout of 15000ms exceeded',
    };

    await expect(handlers.responseError(error)).rejects.toMatchObject({
      status: null,
      message: 'timeout of 15000ms exceeded',
    });
  });

  it('does not swallow response interceptor errors', async () => {
    const { handlers } = await createRequestModule();
    const error = {
      isAxiosError: true,
      message: 'Request failed with status code 500',
      response: { status: 500, data: { message: 'Server error' } },
    };

    await expect(handlers.responseError(error)).rejects.toMatchObject({
      status: 500,
      message: 'Server error',
    });
  });
});
