import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import vue from 'eslint-plugin-vue';
import globals from 'globals';

export default [
  {
    ignores: [
      'dist/**',
      'dist-electron/**',
      'dist_electron/**',
      'node_modules/**',
    ],
  },
  {
    linterOptions: {
      reportUnusedDisableDirectives: true,
    },
  },
  js.configs.recommended,
  ...vue.configs['flat/essential'],
  prettier,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        ipcRenderer: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': 'warn',
      'no-undef': 'error',
      eqeqeq: ['error', 'always'],
      'vue/multi-word-component-names': 'off',
      'vue/no-deprecated-filter': 'off',
      'vue/no-deprecated-slot-attribute': 'off',
      'vue/no-deprecated-v-on-native-modifier': 'off',
      'vue/no-deprecated-destroyed-lifecycle': 'off',
      'vue/no-mutating-props': 'off',
      'vue/no-reserved-component-names': 'off',
      'vue/require-toggle-inside-transition': 'off',
      'vue/valid-v-slot': 'off',
    },
  },
];
