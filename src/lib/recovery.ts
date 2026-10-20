/** Helpers for the "something went wrong" screens: save what is stored, and reset the parts that may be broken. */

const PREFIX = 'tonartenverlauf.';

/** Everything this app stored in the browser, as one JSON file the user can keep. */
export function rescueFile(): Blob {
  const data: Record<string, unknown> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(PREFIX)) data[key] = localStorage.getItem(key);
    }
  } catch {
    /* storage unavailable */
  }
  return new Blob([JSON.stringify({ rescued: new Date().toISOString(), data }, null, 2)], { type: 'application/json' });
}

export function downloadRescue(): void {
  const url = URL.createObjectURL(rescueFile());
  const a = document.createElement('a');
  a.href = url;
  a.download = 'tonartenverlauf-rettung.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Removes the saved settings only; pieces stay. This is the usual fix after an update. */
export function resetSettings(): void {
  try {
    localStorage.removeItem(PREFIX + 'prefs');
  } catch {
    /* ignore */
  }
}

/** Forgets cached app files and the service worker, so the next load fetches the current version. */
export async function resetCaches(): Promise<void> {
  try {
    const regs = (await navigator.serviceWorker?.getRegistrations?.()) ?? [];
    await Promise.all(regs.map((r) => r.unregister()));
    if (typeof caches !== 'undefined') await Promise.all((await caches.keys()).map((k) => caches.delete(k)));
  } catch {
    /* ignore */
  }
}

export function removeAllData(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(PREFIX)) keys.push(key);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}
