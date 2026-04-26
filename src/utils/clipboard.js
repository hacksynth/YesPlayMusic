function fallbackCopyText(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
  return Promise.resolve(text);
}

export default {
  install(app) {
    app.config.globalProperties.$copyText = text => {
      if (navigator.clipboard?.writeText) {
        return navigator.clipboard.writeText(text).then(() => text);
      }
      return fallbackCopyText(text);
    };
  },
};
