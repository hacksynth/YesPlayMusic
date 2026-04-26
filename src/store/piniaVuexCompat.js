import { useMainStore } from './index';

function normalizeMap(map) {
  if (Array.isArray(map)) {
    return map.map(key => [key, key]);
  }
  return Object.entries(map);
}

export function mapState(map) {
  return normalizeMap(map).reduce((result, [key, value]) => {
    result[key] = function () {
      const store = useMainStore();
      if (typeof value === 'function') {
        return value(store.$state);
      }
      return store[value];
    };
    return result;
  }, {});
}

export function mapActions(map) {
  return normalizeMap(map).reduce((result, [key, value]) => {
    result[key] = function (...args) {
      const store = useMainStore();
      return store[value](...args);
    };
    return result;
  }, {});
}

export const mapMutations = mapActions;

export function mapGetters() {
  return {};
}
