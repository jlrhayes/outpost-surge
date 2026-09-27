// Vite build plugin: stamps the hand-written public/sw.js in the build output with
//  - a content hash of the build (-> versioned cache name, so each deploy gets a fresh cache), and
//  - the list of files to precache (built assets + public files), so the game works offline after one visit.
// Used from vite.config.ts. Only runs for `vite build`.
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const SW_FILE = 'sw.js';

/** @returns {import('vite').Plugin} */
export function serviceWorkerStamp() {
  /** @type {import('vite').ResolvedConfig} */
  let config;
  return {
    name: 'outpost-surge:sw-stamp',
    apply: 'build',
    enforce: 'post',
    configResolved(resolved) {
      config = resolved;
    },
    writeBundle(options, bundle) {
      const outDir = resolve(config.root, options.dir ?? config.build.outDir);
      const swPath = join(outDir, SW_FILE);
      if (!existsSync(swPath)) return;

      const toPosix = (p) => p.split('\\').join('/');
      const built = Object.keys(bundle).filter((f) => f !== 'index.html' && !f.endsWith('.map'));
      const publicDir = config.publicDir;
      const publicFiles = publicDir && existsSync(publicDir) ? listFiles(publicDir).filter((f) => f !== SW_FILE) : [];
      const precache = ['./', ...new Set([...publicFiles, ...built].map(toPosix))].sort((a, b) =>
        a === './' ? -1 : b === './' ? 1 : a.localeCompare(b),
      );

      // Hash everything that ends up in the cache (built file names are already content-hashed).
      const hash = createHash('sha256');
      hash.update(readFileSync(join(outDir, 'index.html')));
      for (const f of precache) {
        const file = join(outDir, f);
        if (f !== './' && existsSync(file)) hash.update(f).update(readFileSync(file));
      }
      const template = readFileSync(swPath, 'utf8');
      hash.update(template);
      const buildId = hash.digest('hex').slice(0, 12);

      for (const placeholder of ["'__BUILD_ID__'", '/* __PRECACHE__ */']) {
        if (!template.includes(placeholder)) throw new Error(`[sw-stamp] ${placeholder} not found in ${swPath}`);
      }
      const stamped = template
        .replace("'__BUILD_ID__'", JSON.stringify(buildId))
        .replace('/* __PRECACHE__ */', precache.map((p) => JSON.stringify(p)).join(', '));
      writeFileSync(swPath, stamped);
      config.logger.info(`[sw-stamp] ${SW_FILE}: cache ${buildId}, ${precache.length} files precached`);
    },
  };
}

function listFiles(dir, base = dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...listFiles(full, base));
    else out.push(relative(base, full).split('\\').join('/'));
  }
  return out;
}
