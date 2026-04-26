import { ipcMain } from 'electron';

const MAX_STRING_LENGTH = 2048;

function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    (Object.getPrototypeOf(value) === Object.prototype ||
      Object.getPrototypeOf(value) === null)
  );
}

function assertSerializable(value, label = 'payload') {
  try {
    JSON.stringify(value);
  } catch {
    throw new Error(`${label} must be JSON serializable`);
  }
}

export function assertPlainObject(value, label = 'payload') {
  if (!isPlainObject(value)) {
    throw new Error(`${label} must be an object`);
  }
  assertSerializable(value, label);
  return value;
}

export function assertString(value, label = 'value', max = MAX_STRING_LENGTH) {
  if (typeof value !== 'string') {
    throw new Error(`${label} must be a string`);
  }
  if (value.length > max) {
    throw new Error(`${label} is too long`);
  }
  return value;
}

export function assertBoolean(value, label = 'value') {
  if (typeof value !== 'boolean') {
    throw new Error(`${label} must be a boolean`);
  }
  return value;
}

export function assertFiniteNumber(value, label = 'value') {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`);
  }
  return value;
}

export function assertNoArgs(args) {
  if (args.length !== 0) {
    throw new Error('This IPC channel does not accept arguments');
  }
}

export function validatePayloadTuple(args, validators) {
  if (args.length !== validators.length) {
    throw new Error(`Expected ${validators.length} IPC argument(s)`);
  }
  return validators.map((validator, index) => validator(args[index], index));
}

export function createTrustedIpc(win, log = console.warn) {
  const isTrustedSender = event => event.sender === win.webContents;

  function rejectUntrusted(event, channel) {
    const message = `Rejected IPC channel "${channel}" from an untrusted sender`;
    log(message);
    if (event.sender && !event.sender.isDestroyed()) {
      event.sender.send('ipc-error', { channel, message });
    }
  }

  return {
    handle(channel, validator, listener) {
      ipcMain.handle(channel, async (event, ...args) => {
        if (!isTrustedSender(event)) {
          throw new Error(
            `Rejected IPC channel "${channel}" from an untrusted sender`
          );
        }
        const validatedArgs = validator ? validator(args) : args;
        return listener(event, ...validatedArgs);
      });
    },
    on(channel, validator, listener) {
      ipcMain.on(channel, (event, ...args) => {
        if (!isTrustedSender(event)) {
          rejectUntrusted(event, channel);
          return;
        }
        try {
          const validatedArgs = validator ? validator(args) : args;
          listener(event, ...validatedArgs);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : `Invalid IPC payload`;
          log(`Rejected IPC channel "${channel}": ${message}`);
          if (event.sender && !event.sender.isDestroyed()) {
            event.sender.send('ipc-error', { channel, message });
          }
        }
      });
    },
  };
}
