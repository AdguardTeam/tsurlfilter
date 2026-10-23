import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

import { inlineCssHitsHelpers } from './tasks/inline-css-hits-helpers';
import { inlineExtCssBundle } from './tasks/inline-extcss-bundle';

/**
 * Firefox-only browser-mode configuration for the MV2 ExtCSS code string.
 *
 * Kept separate from `vitest.config.ts` so that `pnpm test`, `pnpm test:ci`,
 * and `pnpm test:prod` stay Chromium-only. The spec installs its own `chrome`
 * stub, so no `setupFiles` are needed.
 */
export default defineConfig({
    plugins: [inlineExtCssBundle(), inlineCssHitsHelpers()],
    test: {
        include: ['test/e2e/**/*.firefox.spec.ts'],
        exclude: ['**/node_modules/**'],
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
