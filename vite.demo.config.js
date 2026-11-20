import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
// One-file local demo (no Firebase): dist-demo/index.html
export default defineConfig({
  plugins: [
    { name: 'stub-firebase', enforce: 'pre', resolveId(id) { if (id.endsWith('backend/firebase.js')) return '\0fb-stub'; },
      load(id) { if (id === '\0fb-stub') return 'export function createFirebaseBackend(){ throw new Error("demo"); }'; } },
    viteSingleFile(),
  ],
  build: { outDir: 'dist-demo' },
});
