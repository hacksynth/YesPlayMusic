 

import { registerSW } from 'virtual:pwa-register';

if (!process.env.IS_ELECTRON) {
  registerSW({
    immediate: true,
    onRegisterError(error) {
      console.error('Error during service worker registration:', error);
    },
  });
}
