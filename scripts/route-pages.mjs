// GitHub Pages serves folders, so every game address gets its own copy of
// index.html (/double/index.html …); the app reads the path to pick the game.
import { copyFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ROUTE_PATHS } from '../lib/routes.mjs';

export function routePages() {
  let outDir;
  return {
    name: 'kotoba-route-pages',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    writeBundle: {
      sequential: true,
      order: 'post',
      handler() {
        for (const path of ROUTE_PATHS) {
          mkdirSync(join(outDir, path), { recursive: true });
          copyFileSync(
            join(outDir, 'index.html'),
            join(outDir, path, 'index.html'),
          );
        }
      },
    },
  };
}
