// eslint-disable-next-line import/no-extraneous-dependencies
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        setupFiles: [
            './test/setup/custom-matchers/index.ts',
        ],
        watch: false,
        coverage: {
            include: [
                'src/**/*.ts',
            ],
        },
    },
});
