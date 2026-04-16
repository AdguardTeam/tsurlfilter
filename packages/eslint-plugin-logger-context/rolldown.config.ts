import { defineConfig } from 'rolldown';

// TODO: commonjs format is needed since we use eslint in common js format and
// it require to load plugins in cjs format, when we will migrate to eslint9 or
// another linter we can remove this format.
export default defineConfig({
    input: 'src/index.ts',
    output: [{
        dir: 'dist',
        format: 'cjs',
    },
    {
        dir: 'dist/es',
        format: 'es',
        entryFileNames: '[name].mjs',
    }],
    // Only externalize Node builtins — bundle everything else (matches baseline behavior).
    // The baseline uses rollup-plugin-node-externals which externalizes `dependencies`,
    // but this package has zero `dependencies` (only devDependencies), so nothing
    // gets externalized except Node builtins.
    external: [/^node:/],
    platform: 'node',
    resolve: {
        conditionNames: ['node', 'import'],
    },
});
