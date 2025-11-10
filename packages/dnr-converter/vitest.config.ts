import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        setupFiles: [
            './test/setup/index.ts',
        ],
        watch: false,
        coverage: {
            include: [
                'src/**/*.ts',
            ],
            exclude: [
                // Index file contains only exports
                'src/index.ts',
                // Constants should not affect coverage
                'src/constants.ts',
                // Folder contains only valibot schemas
                'src/declarative-rule/**/*.ts',
            ],
        },
    },
});
