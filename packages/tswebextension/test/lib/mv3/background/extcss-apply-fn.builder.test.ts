/**
 * @vitest-environment jsdom
 */

import { type rollup as realRollup } from 'rollup';
import {
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { type IAffectedElement } from '@adguard/extended-css';

import applyExtendedCss from '../../../../src/lib/mv3/background/extcss-inject-src';
import { getExtCssBundle, inlineExtCssBundle } from '../../../../tasks/inline-extcss-bundle';

// `vi.mock` factories are hoisted above top-level `const` declarations, so the
// spies must be created via `vi.hoisted` to be referenceable inside the
// factories and the test body alike.
const {
    constructorSpy,
    initSpy,
    applySpy,
    closeSpyHolder,
} = vi.hoisted(() => ({
    constructorSpy: vi.fn(),
    initSpy: vi.fn(),
    applySpy: vi.fn(),
    // Holds the spy attached to the Rollup bundle's `close()` method; assigned
    // inside the wrapped `rollup()` mock below on every build.
    closeSpyHolder: { closeSpy: undefined as ReturnType<typeof vi.spyOn> | undefined },
}));

// Mock the ExtendedCss class so the entry-point lifecycle (constructor →
// init() → apply()) can be asserted without the real engine. This only
// affects imports through THIS test file's module graph — the nested Rollup
// build below runs in Node and always bundles the real library.
vi.mock('@adguard/extended-css', () => ({
    ExtendedCss: class {
        /**
         * Configuration captured by the constructor spy.
         */
        public config: unknown;

        /**
         * Mocked constructor.
         *
         * @param config ExtendedCss configuration.
         */
        constructor(config: unknown) {
            constructorSpy(config);
            this.config = config;
        }

        /**
         * Mocked init.
         */
        public init = initSpy;

        /**
         * Mocked apply.
         */
        public apply = applySpy;
    },
}));

// Wrap the real `rollup()` so the test can assert the bundle handle is closed
// while still performing the REAL nested build (the generated IIFE is
// verified below, not mocked).
vi.mock('rollup', async (importOriginal) => {
    const actual = await importOriginal() as Record<string, unknown> & { rollup: typeof realRollup };
    return {
        ...actual,
        rollup: vi.fn(async (...args: Parameters<typeof realRollup>) => {
            const bundle = await actual.rollup(...args);
            closeSpyHolder.closeSpy = vi.spyOn(bundle, 'close');
            return bundle;
        }),
    };
});

const SLOW_BUILD_TIMEOUT_MS = 60_000;

describe('extcss-inject-src entry point', () => {
    beforeEach(() => {
        constructorSpy.mockClear();
        initSpy.mockClear();
        applySpy.mockClear();
    });

    it('calls init() before apply()', () => {
        applyExtendedCss(['.ad:has(.child) { display: none !important; }']);

        expect(initSpy).toHaveBeenCalledTimes(1);
        expect(applySpy).toHaveBeenCalledTimes(1);
        // init() snapshots the native textContent getter (required for
        // :contains()) and MUST run before apply().
        expect(initSpy.mock.invocationCallOrder[0]).toBeLessThan(applySpy.mock.invocationCallOrder[0]);
    });

    it('passes cssRules and beforeStyleApplied through to the ExtendedCss configuration', () => {
        const rules = ['.ad:has(.child) { display: none !important; }'];
        const beforeStyleApplied = (el: IAffectedElement): IAffectedElement => el;

        applyExtendedCss(rules, beforeStyleApplied);

        expect(constructorSpy).toHaveBeenCalledTimes(1);
        expect(constructorSpy).toHaveBeenCalledWith({
            cssRules: rules,
            beforeStyleApplied,
        });
    });

    it('returns the created ExtendedCss instance (retained for disposal)', () => {
        const instance = applyExtendedCss(['.ad { display: none !important; }']);

        // The returned value must BE the constructed instance — applyExtCss
        // retains it on `window` and later calls dispose() on it. (Cast: at
        // runtime this is the mocked class above, not the real ExtendedCss
        // type that TypeScript sees.)
        const mocked = instance as unknown as { config: unknown; init: unknown; apply: unknown };
        expect(mocked.config).toEqual({
            cssRules: ['.ad { display: none !important; }'],
            beforeStyleApplied: undefined,
        });
        expect(mocked.init).toBe(initSpy);
        expect(mocked.apply).toBe(applySpy);
    });
});

describe('inline-extcss-bundle builder', () => {
    it('generates the IIFE as an in-memory string (no file on disk)', async () => {
        const src = await getExtCssBundle();

        expect(typeof src).toBe('string');
        expect(src.length).toBeGreaterThan(0);
    }, SLOW_BUILD_TIMEOUT_MS);

    it('defines applyExtendedCss as a global when evaluated', async () => {
        const src = await getExtCssBundle();

        // Deliberate eval: runs the generated IIFE the way chrome.scripting
        // would execute it, verifying it defines the global entry point in an
        // isolated function scope (the surrounding `applyExtCss` body calls it
        // the same way after inlining).
        // eslint-disable-next-line no-new-func, @typescript-eslint/no-implied-eval
        const getGlobalType = new Function(`${src}; return typeof applyExtendedCss;`);
        expect(getGlobalType()).toBe('function');
    }, SLOW_BUILD_TIMEOUT_MS);

    it('is minified (single line, no block comments)', async () => {
        const src = await getExtCssBundle();

        expect(src.trim()).not.toContain('\n');
        expect(src).not.toMatch(/\/\*/);
    }, SLOW_BUILD_TIMEOUT_MS);

    it('caches its result (second call returns the same string)', async () => {
        const [first, second] = await Promise.all([getExtCssBundle(), getExtCssBundle()]);

        // Same string instance → the nested Rollup build ran at most once.
        expect(second).toBe(first);

        const { rollup } = await import('rollup');
        expect(vi.mocked(rollup)).toHaveBeenCalledTimes(1);
    }, SLOW_BUILD_TIMEOUT_MS);

    it('closes the Rollup bundle in finally (no handle leak)', async () => {
        await getExtCssBundle();

        expect(closeSpyHolder.closeSpy).toBeDefined();
        expect(closeSpyHolder.closeSpy).toHaveBeenCalledTimes(1);
    }, SLOW_BUILD_TIMEOUT_MS);

    it('fails the production build if the marker survives into an emitted chunk', () => {
        const plugin = inlineExtCssBundle();
        const generateBundle = plugin.generateBundle as unknown as (
            options: unknown,
            bundle: Record<string, { type: string; code?: string }>,
        ) => void;

        expect(() => generateBundle({}, {
            'background.js': { type: 'chunk', code: 'var a = 1; __INLINE_EXTCSS_BUNDLE__();' },
        })).toThrow(/Un-inlined __INLINE_EXTCSS_BUNDLE__ marker/);

        expect(() => generateBundle({}, {
            'background.js': { type: 'chunk', code: 'var a = 1;' },
        })).not.toThrow();
    });
});
