import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

/**
 * Firefox-only browser-mode configuration for the MV2 ExtCSS code string.
 *
 * Kept separate from `vitest.config.ts` so that `pnpm test`, `pnpm test:ci`,
 * and `pnpm test:prod` do not run the `*.firefox.spec.ts` specs (the
 * `canvas-native` project, which also runs in Firefox, is unaffected). The
 * spec installs its own `chrome` stub, so no `setupFiles` are needed.
 */
export default defineConfig({
    test: {
        include: ['test/e2e/**/*.firefox.spec.ts'],
        exclude: ['**/node_modules/**'],
        // The JUnit report lands in the same directory as `test:ci`'s, under a
        // distinct name, so the Docker stage can upload it as a test-results
        // artifact instead of losing a Firefox-only failure to the exit code.
        reporters: ['default', 'junit'],
        outputFile: './tests-reports/tswebextension-firefox.xml',
        browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [
                { browser: 'firefox' },
            ],
        },
    },
});
