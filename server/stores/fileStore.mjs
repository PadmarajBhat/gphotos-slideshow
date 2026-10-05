import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Local store for the home helper: one JSON file per TV session and one per
 * media cache, in a folder only this user can read. Token fields arrive here
 * already encrypted.
 */
export function createFileStore(directory) {
  const ready = mkdir(directory, { recursive: true, mode: 0o700 });

  const path = (kind, id) => join(directory, `${kind}-${id}.json`);

  async function read(kind, id) {
    await ready;
    try {
      return JSON.parse(await readFile(path(kind, id), 'utf8'));
    } catch {
      return null;
    }
  }

  async function write(kind, id, value) {
    await ready;
    await writeFile(path(kind, id), JSON.stringify(value), { mode: 0o600 });
  }

  async function remove(kind, id) {
    await ready;
    await rm(path(kind, id), { force: true });
  }

  return {
    name: 'file',
    getSession: (id) => read('session', id),
    putSession: (id, value) => write('session', id, value),
    deleteSession: (id) => remove('session', id),
    getMedia: (id) => read('media', id),
    putMedia: (id, value) => write('media', id, value),
    deleteMedia: (id) => remove('media', id),
    getDoc: (kind, id) => read(kind, id),
    putDoc: (kind, id, value) => write(kind, id, value),
    deleteDoc: (kind, id) => remove(kind, id),
  };
}
