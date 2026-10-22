import { beforeEach, describe, expect, it } from 'vitest';
import { remember, rememberOpen, wasOpen } from './remember';

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  } as Storage;
});

describe('remembered sections', () => {
  it('uses the default until the user decides', () => {
    expect(wasOpen('a', false)).toBe(false);
    expect(wasOpen('a', true)).toBe(true);
    rememberOpen('a', true);
    expect(wasOpen('a', false)).toBe(true);
    rememberOpen('a', false);
    expect(wasOpen('a', true)).toBe(false);
    expect(wasOpen('b', true)).toBe(true);
  });

  it('survives broken storage', () => {
    store.set('tonartenverlauf.panels', '{nope');
    expect(wasOpen('a', true)).toBe(true);
    rememberOpen('a', false);
    expect(wasOpen('a', true)).toBe(false);
  });

  it('applies to a details element and follows its toggles', () => {
    const listeners: Record<string, () => void> = {};
    const node = { open: false, addEventListener: (n: string, f: () => void) => (listeners[n] = f), removeEventListener: () => {} } as unknown as HTMLDetailsElement;
    rememberOpen('x', true);
    const action = remember(node, 'x');
    expect(node.open).toBe(true);
    node.open = false;
    listeners.toggle();
    expect(wasOpen('x', true)).toBe(false);
    action.destroy();
  });
});
