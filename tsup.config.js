import { defineConfig } from 'tsup';
export default defineConfig({
    entryPoints: [
        'src/index.js',
        'src/exceptions.js',
        'src/utils.js',
    ],
    entry: {
        index: "src/index.js",
        errors: "src/exceptions.js",
        util: "src/util.js",
    },
    outDir: 'dist',
    target: 'node22',
    format: ['esm'],
    treeshake: true,
    clean: true,
    minify: false,
    sourcemap: "inline"
});