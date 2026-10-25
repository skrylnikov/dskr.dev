import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
	root: resolve(import.meta.dirname, 'ui'),
	plugins: [react()],
	server: {
		host: '127.0.0.1',
		port: 4322,
		strictPort: true,
		fs: {
			allow: [
				resolve(import.meta.dirname, 'ui'),
				resolve(import.meta.dirname, '../../src/data'),
			],
		},
		proxy: {
			'/api': { target: 'http://127.0.0.1:4323', changeOrigin: true },
			'/media': { target: 'http://127.0.0.1:4323', changeOrigin: true },
			'/assets': 'http://127.0.0.1:4324',
		},
	},
	build: {
		outDir: resolve(import.meta.dirname, '../../.state/admin-dist'),
		emptyOutDir: true,
	},
});
