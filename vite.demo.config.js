import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
// One-file preview build (runs in local mode when /api isn't reachable): dist-demo/index.html
export default defineConfig({ plugins: [viteSingleFile()], build: { outDir: 'dist-demo' } });
