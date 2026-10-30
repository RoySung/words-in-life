import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import type { Plugin } from 'vite';

/** Emit a worker from the final output so lazy chunks are available offline too. */
export function pwa(): Plugin {
  let outDir: string;
  return {
    name: 'words-in-life-pwa',
    apply: 'build',
    configResolved(config) { outDir = resolve(config.root, config.build.outDir); },
    closeBundle() {
      const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const path = join(dir, entry.name);
        return entry.isDirectory() ? walk(path) : [path];
      });
      const files = walk(outDir).filter(path => {
        const name = relative(outDir, path);
        return name === 'index.html' || name === 'site.webmanifest' || name === 'favicon.ico'
          || /^(assets|icons|sample-images|design-system)\//.test(name);
      }).sort();
      const template = readFileSync(new URL('./service-worker.js', import.meta.url), 'utf8');
      const hash = createHash('sha256').update(template);
      for (const file of files) { hash.update(relative(outDir, file)); hash.update(readFileSync(file)); }
      const version = hash.digest('hex').slice(0, 16);
      const urls = files.map(file => '/' + relative(outDir, file));
      const source = template
        .replace('__CACHE_NAME__', JSON.stringify(`words-in-life-shell-${version}`))
        .replace('__PRECACHE_URLS__', JSON.stringify(urls));
      writeFileSync(join(outDir, 'sw.js'), source);
    },
  };
}
