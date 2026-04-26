import { createPinia, defineStore, setActivePinia } from 'pinia';
import state from './state';
import mutations from './mutations';
import actions from './actions';
import { changeAppearance } from '@/utils/common';
import Player from '@/utils/Player';
import saveToLocalStorage from './plugins/localStorage';
import { getSendSettingsPlugin } from './plugins/sendSettings';

export const pinia = createPinia();
setActivePinia(pinia);

const subscribers = new Set();

function notifySubscribers(mutation, nextState) {
  subscribers.forEach(subscriber => subscriber(mutation, nextState));
}

function createMutationActions() {
  return Object.entries(mutations).reduce((result, [type, mutation]) => {
    result[type] = function (payload) {
      mutation(this.$state, payload);
      notifySubscribers({ type, payload }, this.$state);
    };
    return result;
  }, {});
}

function createActionMethods() {
  return Object.entries(actions).reduce((result, [type, action]) => {
    result[type] = function (payload) {
      const context = {
        state: this.$state,
        commit: (mutationType, mutationPayload) =>
          this[mutationType](mutationPayload),
        dispatch: (actionType, actionPayload) => this[actionType](actionPayload),
      };
      return action(context, payload);
    };
    return result;
  }, {});
}

export const useMainStore = defineStore('main', {
  state: () => state,
  actions: {
    ...createMutationActions(),
    ...createActionMethods(),
  },
});

const mainStore = useMainStore(pinia);

const store = {
  get state() {
    return mainStore.$state;
  },
  commit(type, payload) {
    return mainStore[type](payload);
  },
  dispatch(type, payload) {
    return mainStore[type](payload);
  },
  subscribe(subscriber) {
    subscribers.add(subscriber);
    return () => subscribers.delete(subscriber);
  },
  get _store() {
    return mainStore;
  },
};

let plugins = [saveToLocalStorage];
if (process.env.IS_ELECTRON === true) {
  let sendSettings = getSendSettingsPlugin();
  plugins.push(sendSettings);
}
plugins.forEach(plugin => plugin(store));

if ([undefined, null].includes(store.state.settings.lang)) {
  const defaultLang = 'en';
  const langMapper = new Map()
    .set('zh', 'zh-CN')
    .set('zh-TW', 'zh-TW')
    .set('en', 'en')
    .set('tr', 'tr');
  store.state.settings.lang =
    langMapper.get(
      langMapper.has(navigator.language)
        ? navigator.language
        : navigator.language.slice(0, 2)
    ) || defaultLang;
  localStorage.setItem('settings', JSON.stringify(store.state.settings));
}

changeAppearance(store.state.settings.appearance);

window
  .matchMedia('(prefers-color-scheme: dark)')
  .addEventListener('change', () => {
    if (store.state.settings.appearance === 'auto') {
      changeAppearance(store.state.settings.appearance);
    }
  });

let player = new Player();
player = new Proxy(player, {
  set(target, prop, val) {
    // console.log({ prop, val });
    target[prop] = val;
    if (prop === '_howler') return true;
    target.saveSelfToLocalStorage();
    target.sendSelfToIpcMain();
    return true;
  },
});
store.state.player = player;

export default store;
