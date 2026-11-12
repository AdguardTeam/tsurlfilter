import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { RemoveParamModifier } from '@adguard/tsurlfilter';

import { patchHistoryForRemoveParam } from '../../../../src/lib/common/content-script/remove-param-main-world';
import { type RemoveParamDescriptor } from '../../../../src/lib/common/utils/remove-param-rules';

describe('patchHistoryForRemoveParam', () => {
    let TEST_NONCE = 'test-nonce-xyz789';
    const TEST_SECRET = 'test-secret-abc123';
    const savePushState = History.prototype.pushState;
    const saveReplaceState = History.prototype.replaceState;
    let mockReplaceState: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        TEST_NONCE = `test-nonce-${Math.random()}`;
        History.prototype.pushState = savePushState;
        History.prototype.replaceState = saveReplaceState;

        // Mock replaceState so we can verify it is called with the cleaned URL.
        // Keep real pushState so jsdom updates window.location.href.
        mockReplaceState = vi.fn();
        History.prototype.replaceState = mockReplaceState as unknown as typeof History.prototype.replaceState;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    /**
     * Creates a `$removeparam` descriptor for tests.
     *
     * @param value Modifier value.
     * @param isAllowlist Whether the rule is an allowlist rule.
     * @param filterId Filter ID.
     * @param ruleIndex Rule index inside the filter.
     *
     * @returns A descriptor for `patchHistoryForRemoveParam`.
     */
    const descriptor = (
        value: string,
        isAllowlist = false,
        filterId = 1,
        ruleIndex = 0,
    ): RemoveParamDescriptor => ({
        value,
        isAllowlist,
        isImportant: false,
        filterId,
        ruleIndex,
        ruleText: `${isAllowlist ? '@@' : ''}||example.com^$removeparam${value ? `=${value}` : ''}`,
    });

    it('is self-contained (no external references in serialized body)', () => {
        const body = patchHistoryForRemoveParam.toString();
        // Wrap in a Function constructor and invoke the result: if the body
        // references any outer-scope variables (e.g. imported types leaking as
        // values), this throws a SyntaxError or ReferenceError, confirming the
        // function is NOT self-contained and cannot be safely used for MV2
        // <script> injection.
        // eslint-disable-next-line @typescript-eslint/no-implied-eval
        const createFunction = new Function(`return (${body})`) as () => typeof patchHistoryForRemoveParam;
        const serializedFunction = createFunction();

        // A regexp descriptor makes the serialized body run `parseValue` and
        // the per-descriptor `catch`. A module-level identifier inside the
        // parser throws a `ReferenceError` that the catch swallows, so pass a
        // regexp descriptor and check that the parameter is removed, not only
        // that the call does not throw: otherwise a broken MV2 build becomes
        // a silent no-op.
        expect(() => serializedFunction([descriptor('/^utm_/')], TEST_NONCE, TEST_SECRET)).not.toThrow();
        mockReplaceState.mockClear();
        window.history.pushState({}, '', '/page?utm_source=g&safe=1');

        expect(mockReplaceState).toHaveBeenCalled();
        const calledUrl = mockReplaceState.mock.calls[0][2] as string;
        expect(calledUrl).toContain('safe=1');
        expect(calledUrl).not.toContain('utm_source');
    });

    it('patches History API even when descriptors are empty', () => {
        const prePatch = History.prototype.pushState;
        patchHistoryForRemoveParam([], TEST_NONCE, TEST_SECRET);

        // History API should be patched even with no descriptors,
        // so that the updater property is available for later SPA navigations.
        expect(History.prototype.pushState).not.toBe(prePatch);
    });

    it('patches History API when descriptors are provided', () => {
        const prePatch = History.prototype.pushState;
        const descriptors: RemoveParamDescriptor[] = [
            descriptor('utm_source'),
        ];

        patchHistoryForRemoveParam(descriptors, TEST_NONCE, TEST_SECRET);

        expect(History.prototype.pushState).not.toBe(prePatch);
    });

    it('removes named parameter', () => {
        const descriptors: RemoveParamDescriptor[] = [
            descriptor('utm_source'),
        ];

        patchHistoryForRemoveParam(descriptors, TEST_NONCE, TEST_SECRET);

        window.history.pushState({}, '', '/page?utm_source=google&safe=1');

        expect(mockReplaceState).toHaveBeenCalledWith({}, '', expect.stringContaining('/page?safe=1'));
    });

    it('removes all parameters with bare removeparam', () => {
        const descriptors: RemoveParamDescriptor[] = [
            descriptor(''),
        ];

        patchHistoryForRemoveParam(descriptors, TEST_NONCE, TEST_SECRET);

        window.history.pushState({}, '', '/page?a=1&b=2');

        expect(mockReplaceState).toHaveBeenCalledWith({}, '', expect.stringContaining('/page'));
        // Should not contain query params
        const calledUrl = mockReplaceState.mock.calls[0][2] as string;
        expect(calledUrl).not.toContain('?');
    });

    it('skips allowlisted parameters', () => {
        const descriptors: RemoveParamDescriptor[] = [
            descriptor('utm_source', true, 2, 1),
        ];

        patchHistoryForRemoveParam(descriptors, TEST_NONCE, TEST_SECRET);

        window.history.pushState({}, '', '/page?utm_source=google');

        // No removal — the only descriptor is an allowlist rule (skipped)
        expect(mockReplaceState).not.toHaveBeenCalled();
    });

    it('skips URLs without query parameters', () => {
        const descriptors: RemoveParamDescriptor[] = [
            descriptor('utm_source'),
        ];

        window.history.pushState({}, '', '/page');

        patchHistoryForRemoveParam(descriptors, TEST_NONCE, TEST_SECRET);

        expect(mockReplaceState).not.toHaveBeenCalled();
    });

    it('handles negated removeparam (~param)', () => {
        const descriptors: RemoveParamDescriptor[] = [
            descriptor('~safe'),
        ];

        patchHistoryForRemoveParam(descriptors, TEST_NONCE, TEST_SECRET);

        window.history.pushState({}, '', '/page?utm=1&safe=keep&fbclid=abc');

        expect(mockReplaceState).toHaveBeenCalled();
        const calledUrl = mockReplaceState.mock.calls[0][2] as string;
        // Only 'safe' should remain
        expect(calledUrl).toContain('safe=keep');
        expect(calledUrl).not.toContain('utm=1');
        expect(calledUrl).not.toContain('fbclid=abc');
    });

    it('handles regex removeparam', () => {
        const descriptors: RemoveParamDescriptor[] = [
            descriptor('/^utm_/'),
        ];

        patchHistoryForRemoveParam(descriptors, TEST_NONCE, TEST_SECRET);

        window.history.pushState({}, '', '/page?utm_source=g&utm_medium=c&safe=1');

        expect(mockReplaceState).toHaveBeenCalled();
        const calledUrl = mockReplaceState.mock.calls[0][2] as string;
        expect(calledUrl).toContain('safe=1');
        expect(calledUrl).not.toContain('utm_source');
        expect(calledUrl).not.toContain('utm_medium');
    });

    it('parses a regexp literal with an escaped slash and names other params', () => {
        const descriptors: RemoveParamDescriptor[] = [
            descriptor('/utm_\\/(a|b)'),
            descriptor('utm_source', false, 1, 1),
        ];

        patchHistoryForRemoveParam(descriptors, TEST_NONCE, TEST_SECRET);
        mockReplaceState.mockClear();

        window.history.pushState({}, '', '/page?utm_/(a)=x&utm_/a=y&utm_source=z&safe=1');

        expect(mockReplaceState).toHaveBeenCalled();
        const calledUrl = mockReplaceState.mock.calls[0][2] as string;
        expect(calledUrl).toContain('safe=1');
        expect(calledUrl).not.toContain('utm_source');
        // The escaped-slash pattern matches `utm_/a` but not the literal
        // `utm_/(a)` parameter, so the latter must survive.
        expect(calledUrl).toContain('utm_/(a)=x');
        // The regexp matches `utm_/a`, so this parameter is removed.
        expect(calledUrl).not.toContain('utm_/a');
    });

    it.each([
        ['utm_source', '/page?utm_source=g&safe=1'],
        ['/^utm_/', '/page?utm_source=g&utm_medium=c&safe=1'],
        ['/utm_/y', '/page?utm_medium=foo&safe=1'],
        ['/utm_\\/(a|b)', '/page?utm_/a=y&utm_/(a)=x&safe=1'],
        ['/a\\//', '/page?a/b=1&safe=1'],
        // The engine keeps only the flags between the first and second
        // unescaped slashes: `/x/i/` -> `/x/gi`, `/a/g/i` -> `/a/g`.
        ['/x/i/', '/page?X=1&y=2'],
        ['/a/g/i', '/page?abc=1&a=2&safe=3'],
        // A lone `/` is an empty regexp for the engine, so it matches every
        // parameter. This case must not fall back to a literal pattern.
        ['/', '/page?a=1&b=2'],
    ])('matches the engine for the %s removeparam value', (value, url) => {
        const absoluteUrl = new URL(url, document.baseURI).href;
        const expected = new RemoveParamModifier(value).removeParameters(absoluteUrl);

        patchHistoryForRemoveParam([descriptor(value)], TEST_NONCE, TEST_SECRET);
        mockReplaceState.mockClear();

        window.history.pushState({}, '', url);

        const actual = mockReplaceState.mock.calls.length > 0
            ? mockReplaceState.mock.calls[0][2] as string
            : window.location.href;

        expect(actual).toBe(expected);
    });

    it('skips invalid removeparam regexp literals during initial injection', () => {
        const descriptors: RemoveParamDescriptor[] = [
            // Invalid pattern: an unterminated group.
            descriptor('/utm_('),
            // Invalid flags.
            descriptor('/utm_/zz'),
            descriptor('utm_source', false, 1, 2),
        ];

        expect(() => patchHistoryForRemoveParam(descriptors, TEST_NONCE, TEST_SECRET)).not.toThrow();
        mockReplaceState.mockClear();

        window.history.pushState({}, '', '/page?utm_source=g&safe=1');

        expect(mockReplaceState).toHaveBeenCalled();
        const calledUrl = mockReplaceState.mock.calls[0][2] as string;
        expect(calledUrl).toContain('safe=1');
        expect(calledUrl).not.toContain('utm_source');
    });

    it.each(['g', 'y'])(
        'removes all matching regexp params with the %s flag on repeated pushState navigations',
        (flag) => {
            const descriptors: RemoveParamDescriptor[] = [
                descriptor(`/^utm_.*%2F/${flag}`),
            ];

            patchHistoryForRemoveParam(descriptors, TEST_NONCE, TEST_SECRET);
            // Ignore any cleanup of the previous URL performed during patching.
            mockReplaceState.mockClear();

            window.history.pushState(
                {},
                '',
                '/page?utm_source=foo%2Fbar&utm_medium=baz%2Fqux&safe=1',
            );
            window.history.pushState(
                {},
                '',
                '/other?utm_source=foo%2Fbar&utm_medium=baz%2Fqux&safe=2',
            );

            expect(mockReplaceState).toHaveBeenCalledTimes(2);
            const firstUrl = mockReplaceState.mock.calls[0][2] as string;
            const secondUrl = mockReplaceState.mock.calls[1][2] as string;

            expect(firstUrl).toContain('safe=1');
            expect(firstUrl).not.toContain('utm_source');
            expect(firstUrl).not.toContain('utm_medium');

            expect(secondUrl).toContain('safe=2');
            expect(secondUrl).not.toContain('utm_source');
            expect(secondUrl).not.toContain('utm_medium');
        },
    );

    it('preserves the sticky y flag semantics', () => {
        const descriptors: RemoveParamDescriptor[] = [
            descriptor('/utm_/y'),
        ];

        patchHistoryForRemoveParam(descriptors, TEST_NONCE, TEST_SECRET);
        // Ignore any cleanup of the previous URL performed during patching.
        mockReplaceState.mockClear();

        window.history.pushState({}, '', '/page?x=utm_source&utm_medium=foo&safe=1');

        expect(mockReplaceState).toHaveBeenCalled();
        const calledUrl = mockReplaceState.mock.calls[0][2] as string;
        // A sticky regexp only matches at index 0, so the value containing
        // `utm_` in the middle must be kept, exactly as the engine keeps it.
        expect(calledUrl).toContain('x=utm_source');
        expect(calledUrl).toContain('safe=1');
        expect(calledUrl).not.toContain('utm_medium');
    });

    it.each(['g', 'y'])('inverts a negated regexp removeparam with the %s flag', (flag) => {
        const descriptors: RemoveParamDescriptor[] = [
            descriptor(`~/^keep_.*%2F/${flag}`),
        ];

        patchHistoryForRemoveParam(descriptors, TEST_NONCE, TEST_SECRET);
        // Ignore any cleanup of the previous URL performed during patching.
        mockReplaceState.mockClear();

        window.history.pushState({}, '', '/page?keep_a=1%2Fx&keep_b=2%2Fy&drop=3');

        expect(mockReplaceState).toHaveBeenCalled();
        const calledUrl = mockReplaceState.mock.calls[0][2] as string;
        expect(calledUrl).toContain('keep_a=1%2Fx');
        expect(calledUrl).toContain('keep_b=2%2Fy');
        expect(calledUrl).not.toContain('drop=3');
    });

    it('preserves hash fragment with bare removeparam', () => {
        const descriptors: RemoveParamDescriptor[] = [
            descriptor(''),
        ];

        window.history.pushState({}, '', '/page?a=1&b=2#section');

        patchHistoryForRemoveParam(descriptors, TEST_NONCE, TEST_SECRET);

        expect(mockReplaceState).toHaveBeenCalled();
        const calledUrl = mockReplaceState.mock.calls[0][2] as string;
        expect(calledUrl).toContain('#section');
        expect(calledUrl).not.toContain('?');
    });

    it('removes value-less parameter not matching negated descriptor', () => {
        const descriptors: RemoveParamDescriptor[] = [
            descriptor('~safe'),
        ];

        window.history.pushState({}, '', '/page?noval&safe=1');

        patchHistoryForRemoveParam(descriptors, TEST_NONCE, TEST_SECRET);

        expect(mockReplaceState).toHaveBeenCalled();
        const calledUrl = mockReplaceState.mock.calls[0][2] as string;
        expect(calledUrl).toContain('safe=1');
        expect(calledUrl).not.toContain('noval');
    });

    it('preserves hash fragment with named removeparam', () => {
        const descriptors: RemoveParamDescriptor[] = [
            descriptor('utm_source'),
        ];

        patchHistoryForRemoveParam(descriptors, TEST_NONCE, TEST_SECRET);

        window.history.pushState({}, '', '/page?utm_source=g&safe=1#anchor');

        expect(mockReplaceState).toHaveBeenCalled();
        const calledUrl = mockReplaceState.mock.calls[0][2] as string;
        expect(calledUrl).toContain('safe=1');
        expect(calledUrl).toContain('#anchor');
        expect(calledUrl).not.toContain('utm_source');
    });

    it('applies multiple descriptors cumulatively', () => {
        const descriptors: RemoveParamDescriptor[] = [
            descriptor('utm_source'),
            descriptor('utm_medium', false, 1, 1),
        ];

        patchHistoryForRemoveParam(descriptors, TEST_NONCE, TEST_SECRET);

        window.history.pushState({}, '', '/page?utm_source=g&utm_medium=c&safe=1');

        expect(mockReplaceState).toHaveBeenCalled();
        const calledUrl = mockReplaceState.mock.calls[0][2] as string;
        expect(calledUrl).toContain('safe=1');
        expect(calledUrl).not.toContain('utm_source');
        expect(calledUrl).not.toContain('utm_medium');
    });

    it('cleans URL immediately when descriptors are first provided via updater', () => {
        patchHistoryForRemoveParam([], TEST_NONCE, TEST_SECRET);

        // Set up a URL with a tracking param
        window.history.pushState({}, '', '/page?track=1&keep=ok');

        // Simulate background sending descriptors via updater (as in onHistoryStateUpdated)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updater = (window as any)[TEST_NONCE];
        expect(typeof updater).toBe('function');

        updater(TEST_SECRET, [
            descriptor('track'),
        ]);

        // The updater should have immediately cleaned the current URL
        expect(mockReplaceState).toHaveBeenCalled();
        const calledUrl = mockReplaceState.mock.calls[0][2] as string;
        expect(calledUrl).toContain('keep=ok');
        expect(calledUrl).not.toContain('track=1');
    });

    describe('descriptor update via updater property', () => {
        let NONCE = 'update-test-nonce';
        const SECRET = 'updater-secret';

        beforeEach(() => {
            NONCE = `update-test-nonce-${Math.random()}`;

            // Patch with initial descriptor
            const descriptors: RemoveParamDescriptor[] = [
                descriptor('initial_param'),
            ];
            patchHistoryForRemoveParam(descriptors, NONCE, SECRET);
        });

        it('updates descriptors when updater is called', () => {
            // Call the updater directly with new descriptors
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const updater = (window as any)[NONCE];
            expect(typeof updater).toBe('function');

            updater(SECRET, [
                descriptor('new_param', false, 2),
            ]);

            // Clear any replaceState calls from the updater applying to current URL
            mockReplaceState.mockClear();

            // Now pushState — should remove new_param, not initial_param
            window.history.pushState({}, '', '/page?new_param=val&keep=1');

            expect(mockReplaceState).toHaveBeenCalled();
            const calledUrl = mockReplaceState.mock.calls[0][2] as string;
            expect(calledUrl).toContain('keep=1');
            expect(calledUrl).not.toContain('new_param');
        });

        it('applies new descriptors to the current URL when updater is called', () => {
            // Set up: patch with empty descriptors (simulating initial
            // injection with no matching rules).
            const NONCE2 = 'update-current-url-nonce';
            patchHistoryForRemoveParam([], NONCE2, SECRET);

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const updater = (window as any)[NONCE2];
            expect(typeof updater).toBe('function');

            // Navigate to a URL with a tracking param (use pushState to
            // update location.href in jsdom).
            window.history.pushState({}, '', '/page?utm_source=ad&q=test');

            // Clear any replaceState calls from the pushState above.
            mockReplaceState.mockClear();

            // Now the background sends updated descriptors.
            updater(SECRET, [
                descriptor('utm_source'),
            ]);

            // The updater should have applied the new descriptors to the
            // current URL and called replaceState with the cleaned URL.
            expect(mockReplaceState).toHaveBeenCalled();
            const calledUrl = mockReplaceState.mock.calls[0][2] as string;
            expect(calledUrl).toContain('q=test');
            expect(calledUrl).not.toContain('utm_source');
        });

        it('skips invalid descriptors in the updater and applies valid ones', () => {
            // Navigate to a URL that the updater must clean immediately.
            window.history.pushState({}, '', '/page?utm_source=g&safe=1');
            mockReplaceState.mockClear();

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const updater = (window as any)[NONCE];
            expect(typeof updater).toBe('function');

            const invalidDescriptors: RemoveParamDescriptor[] = [
                descriptor('/utm_('),
                descriptor('/utm_/zz'),
            ];

            // Broken descriptors must not abort the update.
            expect(() => updater(SECRET, [
                ...invalidDescriptors,
                descriptor('utm_source', false, 2, 2),
            ])).not.toThrow();

            // The valid descriptor is applied to the current URL.
            expect(mockReplaceState).toHaveBeenCalled();
            const calledUrl = mockReplaceState.mock.calls[0][2] as string;
            expect(calledUrl).toContain('safe=1');
            expect(calledUrl).not.toContain('utm_source');

            // The updater works for later navigations as well.
            mockReplaceState.mockClear();
            window.history.pushState({}, '', '/other?utm_source=ad&safe=2');

            expect(mockReplaceState).toHaveBeenCalled();
            const secondUrl = mockReplaceState.mock.calls[0][2] as string;
            expect(secondUrl).toContain('safe=2');
            expect(secondUrl).not.toContain('utm_source');
        });

        it('clears descriptors when empty array is received', () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (window as any)[NONCE](SECRET, []);

            // pushState with initial_param — should NOT be removed (descriptors cleared)
            window.history.pushState({}, '', '/page?initial_param=val');

            // No replaceState call (no params removed)
            expect(mockReplaceState).not.toHaveBeenCalled();
        });

        it('rejects updater call with wrong secret', () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const updater = (window as any)[NONCE];
            expect(typeof updater).toBe('function');

            // Call with wrong token — should be silently ignored
            updater('wrong-secret', [
                descriptor('injected_param', false, 99),
            ]);

            mockReplaceState.mockClear();

            // pushState — should still use original descriptors (initial_param), not injected
            window.history.pushState({}, '', '/page?initial_param=val&injected_param=val');

            expect(mockReplaceState).toHaveBeenCalled();
            const calledUrl = mockReplaceState.mock.calls[0][2] as string;
            // initial_param should be removed (original descriptor still active)
            expect(calledUrl).not.toContain('initial_param');
            // injected_param should be kept (attacker's descriptor was rejected)
            expect(calledUrl).toContain('injected_param');
        });
    });
});
