import { mount } from 'svelte';
import './app.css';
import App from './App.svelte';
import { registerFonts } from './lib/render/fonts';

registerFonts();
// Ask the browser not to clear our saved pieces when it runs low on space (it may still decline).
void navigator.storage?.persist?.().catch(() => undefined);

export default mount(App, { target: document.getElementById('app')! });

// When a new version of the app takes over, load it once instead of leaving the old page on screen.
if ('serviceWorker' in navigator) {
  let had = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (had) location.reload();
    had = true;
  });
}

// Offline support: the build emits sw.js with the list of files to cache.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* offline support is optional */
    });
  });
}
