// Builds sw.js for the Pages site: precache every built file so the game opens
// offline, and fetch pages from the network first so new deploys show up at once.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const worker = (version, files) => `const CACHE = 'kotoba-${version}';
const FILES = ${JSON.stringify(files)};
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(FILES)).then(() => self.skipWaiting()),
  );
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return;
  if (request.mode === 'navigate') {
    // Network first with a short timeout, so a slow connection still opens the cached game.
    event.respondWith(
      Promise.race([
        fetch(request).then((response) => {
          if (response.ok) {
            // Clone before the page starts reading the body.
            const copy = response.clone();
            event.waitUntil(caches.open(CACHE).then((cache) => cache.put('./', copy)));
          }
          return response;
        }),
        new Promise((_, reject) => setTimeout(reject, 3000)),
      ]).catch(() => caches.match('./').then((cached) => cached || fetch(request))),
    );
    return;
  }
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
});
`;

export function serviceWorker() {
  let outDir;
  return {
    name: 'kotoba-service-worker',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    // Runs once Vite has written index.html, the hashed assets and public/.
    writeBundle: {
      sequential: true,
      order: 'post',
      handler() {
        const files = readdirSync(outDir, {
          recursive: true,
          withFileTypes: true,
        })
          .filter(
            (f) => f.isFile() && !['sw.js', 'index.html'].includes(f.name),
          )
          .map((f) =>
            relative(outDir, join(f.parentPath, f.name)).replaceAll('\\', '/'),
          )
          .sort();
        // Asset names carry content hashes, so index.html plus the file list
        // changes whenever anything that is cached changes.
        const version = createHash('sha256')
          .update(readFileSync(join(outDir, 'index.html')))
          .update(files.join())
          .digest('hex')
          .slice(0, 12);
        writeFileSync(join(outDir, 'sw.js'), worker(version, ['./', ...files]));
      },
    },
  };
}
