import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import path from 'path';
export default defineConfig({
    plugins: [viteSingleFile()],
    root: path.resolve(__dirname, 'src/ui'),
    build: {
        outDir: path.resolve(__dirname, 'dist'),
        emptyOutDir: false,
        cssCodeSplit: false,
        rollupOptions: {
            input: path.resolve(__dirname, 'src/ui/index.html'),
            output: {
                entryFileNames: 'ui.js',
            },
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src'),
        },
    },
});
