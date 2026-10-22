/** Remembers which collapsible sections the user opened, so lists that are rarely needed stay out of the way. */
const KEY = 'tonartenverlauf.panels';

function load(): Record<string, boolean> {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
}

/** Whether a section was left open or closed; `fallback` if the user never touched it. */
export function wasOpen(id: string, fallback: boolean): boolean {
  const v = load()[id];
  return typeof v === 'boolean' ? v : fallback;
}

export function rememberOpen(id: string, open: boolean): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...load(), [id]: open }));
  } catch {
    /* not remembered */
  }
}

/** For a plain <details>: closed unless the user opened it before (or `open` is the default and they never closed it). */
export function remember(node: HTMLDetailsElement, id: string) {
  node.open = wasOpen(id, node.open);
  const onToggle = () => rememberOpen(id, node.open);
  node.addEventListener('toggle', onToggle);
  return { destroy: () => node.removeEventListener('toggle', onToggle) };
}
