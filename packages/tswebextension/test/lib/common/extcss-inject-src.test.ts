/**
 * @vitest-environment jsdom
 */

import {
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { type IAffectedElement } from '@adguard/extended-css';

import applyExtendedCss from '../../../src/lib/common/extcss-inject-src';

// `vi.mock` factories are hoisted above top-level `const` declarations, so the
// spies must be created via `vi.hoisted` to be referenceable inside the
// factories and the test body alike.
const {
    constructorSpy,
    initSpy,
    applySpy,
    disposeSpy,
} = vi.hoisted(() => ({
    constructorSpy: vi.fn(),
    initSpy: vi.fn(),
    applySpy: vi.fn(),
    disposeSpy: vi.fn(),
}));

// Mock the ExtendedCss class so the entry-point lifecycle (constructor →
// init() → apply()) can be asserted without the real engine.
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

        /**
         * Mocked dispose.
         */
        public dispose = disposeSpy;
    },
}));

describe('extcss-inject-src entry point', () => {
    beforeEach(() => {
        constructorSpy.mockClear();
        initSpy.mockClear();
        applySpy.mockClear();
        disposeSpy.mockClear();
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

        // The returned value must BE the constructed instance —
        // `extCssInjectedApply` retains it on `window` and later calls
        // dispose() on it. (Cast: at runtime this is the mocked class above,
        // not the real ExtendedCss type that TypeScript sees.)
        const mocked = instance as unknown as { config: unknown; init: unknown; apply: unknown };
        expect(mocked.config).toEqual({
            cssRules: ['.ad { display: none !important; }'],
            beforeStyleApplied: undefined,
        });
        expect(mocked.init).toBe(initSpy);
        expect(mocked.apply).toBe(applySpy);
    });

    it('preserves errors from the ExtendedCss apply operation', () => {
        const error = new Error('apply failed');
        applySpy.mockImplementationOnce(() => {
            throw error;
        });

        // The partial apply is cleaned up, and the original error is reported
        // unchanged while the cleanup succeeds.
        expect(() => applyExtendedCss(['.ad { display: none !important; }'])).toThrow(error);
        expect(disposeSpy).toHaveBeenCalledTimes(1);
    });

    it('reports a failed cleanup together with the original apply error', () => {
        const applyError = new Error('apply failed');
        const cleanupError = new Error('cleanup failed');
        applySpy.mockImplementationOnce(() => {
            throw applyError;
        });
        disposeSpy.mockImplementationOnce(() => {
            throw cleanupError;
        });

        let thrown: unknown;
        try {
            applyExtendedCss(['.ad { display: none !important; }']);
        } catch (e) {
            thrown = e;
        }

        // A partial instance may stay on the page, so the cleanup failure is
        // reported too instead of being swallowed, and the original apply
        // error keeps the message and stays the cause.
        expect(thrown).toBeInstanceOf(AggregateError);
        const aggregate = thrown as AggregateError;
        expect(aggregate.message).toBe('apply failed');
        expect(aggregate.cause).toBe(applyError);
        expect(aggregate.errors).toEqual([applyError, cleanupError]);
    });
});
