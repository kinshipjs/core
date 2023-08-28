import { defineConfig } from 'tsup';
export default defineConfig({
    entry: {
        index: "src/index.js",
        errors: "src/exceptions.js",
    },
    outDir: 'dist',
    target: 'node22',
    format: ['esm'],
    treeshake: true,
    clean: true,
    minify: true,
    sourcemap: "inline"
});