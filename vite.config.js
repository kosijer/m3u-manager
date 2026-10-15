import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

/** Pravi dist/sw.js sa spiskom fajlova ovog builda; verzija se menja kad se promeni bilo koji fajl. */
function serviceWorker() {
  return {
    name: 'm3u-service-worker',
    apply: 'build',
    enforce: 'post',
    generateBundle(_, bundle) {
      const items = Object.values(bundle).filter(f => !f.fileName.endsWith('.map'));
      const hash = createHash('sha256');
      for (const f of items) hash.update(f.fileName).update(f.type === 'chunk' ? f.code : f.source);
      const files = [
        './',
        ...items.filter(f => f.fileName !== 'index.html').map(f => './' + f.fileName),
        ...readdirSync(new URL('./public', import.meta.url)).filter(n => !n.startsWith('.')).map(n => './' + n),
      ];
      const source = readFileSync(new URL('./src/sw.js', import.meta.url), 'utf8')
        .replace('__VERSION__', hash.digest('hex').slice(0, 12))
        .replace('__PRECACHE__', JSON.stringify(files));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

export default defineConfig({
  // Relativne putanje rade i na https://<user>.github.io/<repo>/ i lokalno.
  base: './',
  build: {
    outDir: 'dist',
  },
  plugins: [serviceWorker()],
});
