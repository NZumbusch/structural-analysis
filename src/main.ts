import { mount } from 'svelte';
import './app.css';
import App from './App.svelte';
import { registerFonts } from './lib/render/fonts';

registerFonts();

export default mount(App, { target: document.getElementById('app')! });

// Offline support: the build emits sw.js with the list of files to cache.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* offline support is optional */
    });
  });
}
