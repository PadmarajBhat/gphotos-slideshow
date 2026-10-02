import '@testing-library/jest-dom';
import { beforeEach } from 'vitest';

/**
 * The jsdom build used here does not expose localStorage. The app guards every
 * access, but the preference tests need a real implementation to assert
 * against, so provide a minimal in-memory one.
 */
function installMemoryStorage(): void {
  if (typeof globalThis.localStorage !== 'undefined') return;

  let store = new Map<string, string>();

  const memoryStorage: Storage = {
    get length() {
      return store.size;
    },
    clear: () => {
      store = new Map();
    },
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    removeItem: (key: string) => {
      store.delete(key);
    },
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
  };

  Object.defineProperty(globalThis, 'localStorage', {
    value: memoryStorage,
    configurable: true,
    writable: true,
  });

  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'localStorage', {
      value: memoryStorage,
      configurable: true,
      writable: true,
    });
  }
}

installMemoryStorage();

// Keep preference state from leaking between test files.
beforeEach(() => {
  localStorage.clear();
});
