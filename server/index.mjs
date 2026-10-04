import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { config, projectRoot, assertConfigured, refreshConfig } from './env.mjs';
import { parseEncryptionKey, generateEncryptionKey } from './crypto.mjs';
import { createFileStore } from './stores/fileStore.mjs';
import { createFirestoreStore } from './stores/firestoreStore.mjs';
import { createSessionService } from './sessions.mjs';
import { createHandler } from './app.mjs';

/**
 * Locally, generate an encryption key on first run and keep it beside the
 * data it protects. On Cloud Run the key must come from Secret Manager:
 * generating one there would lose every pairing on each new instance.
 */
async function resolveEncryptionKey() {
  if (config.encryptionKey) return parseEncryptionKey(config.encryptionKey);
  if (config.store === 'firestore') {
    throw new Error('TOKEN_ENCRYPTION_KEY is required when STORE=firestore.');
  }
  await mkdir(config.dataDir, { recursive: true, mode: 0o700 });
  const keyFile = join(config.dataDir, 'encryption.key');
  try {
    return parseEncryptionKey((await readFile(keyFile, 'utf8')).trim());
  } catch {
    const key = generateEncryptionKey();
    await writeFile(keyFile, key, { mode: 0o600 });
    return parseEncryptionKey(key);
  }
}

const store =
  config.store === 'firestore'
    ? createFirestoreStore({ projectId: config.firestoreProject || undefined })
    : createFileStore(config.dataDir);

const sessions = createSessionService({
  store,
  encryptionKey: await resolveEncryptionKey(),
  // Re-read .env while unconfigured, so adding credentials needs no restart.
  configError: () => (assertConfigured() ? (refreshConfig(), assertConfigured()) : null),
});

// Cloud Run serves only the API; the app itself is on GitHub Pages.
const distDir = config.store === 'firestore' ? null : resolve(projectRoot, 'dist');

const server = createServer(createHandler({ sessions, allowedOrigins: config.allowedOrigins, distDir }));

server.listen(config.port, () => {
  console.log(`\n  Photo Frame helper on http://localhost:${config.port}  (store: ${store.name})`);
  if (distDir) console.log(`  Serving the built app from ${distDir}`);
  const problem = assertConfigured();
  console.log(problem ? `\n  ⚠  ${problem}\n` : '  Google Photos Ambient API ready.\n');
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
