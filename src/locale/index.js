import { createI18n } from 'vue-i18n';
import store from '@/store';

import en from './lang/en.js';
import zhCN from './lang/zh-CN.js';
import zhTW from './lang/zh-TW.js';
import tr from './lang/tr.js';

const i18n = createI18n({
  legacy: true,
  locale: store.state.settings.lang,
  messages: {
    en,
    'zh-CN': zhCN,
    'zh-TW': zhTW,
    tr,
  },
  missingWarn: false,
  fallbackWarn: false,
});

Object.defineProperty(i18n, 'locale', {
  get() {
    return i18n.global.locale;
  },
});

export default i18n;
