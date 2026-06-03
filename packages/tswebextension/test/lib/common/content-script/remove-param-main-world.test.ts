import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { patchHistoryForRemoveParam } from '../../../../src/lib/common/content-script/remove-param-main-world';
import { type RemoveParamDescriptor } from '../../../../src/lib/common/utils/remove-param-rules';

describe('patchHistoryForRemoveParam', () => {
    it('is self-contained (no external references in serialized body)', () => {
        const body = patchHistoryForRemoveParam.toString();
        // Wrap in a Function constructor — if the body references any outer
        // scope variables (e.g. imported types leaking as values), this throws
        // a SyntaxError or ReferenceError, confirming the function is NOT
        // self-contained and cannot be safely used for MV2 <script> injection.
        // eslint-disable-next-line @typescript-eslint/no-implied-eval
        expect(() => new Function(`return (${body})`)).not.toThrow();
    });

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
            {
                value: 'utm_source',
                isAllowlist: false,
                isImportant: false,
                filterId: 1,
                ruleIndex: 0,
                ruleText: '||example.com^$removeparam=utm_source',
            },
        ];

        patchHistoryForRemoveParam(descriptors, TEST_NONCE, TEST_SECRET);

        expect(History.prototype.pushState).not.toBe(prePatch);
    });

    it('removes named parameter', () => {
        const descriptors: RemoveParamDescriptor[] = [
            {
                value: 'utm_source',
                isAllowlist: false,
                isImportant: false,
                filterId: 1,
                ruleIndex: 0,
                ruleText: '||example.com^$removeparam=utm_source',
            },
        ];

        patchHistoryForRemoveParam(descriptors, TEST_NONCE, TEST_SECRET);

        window.history.pushState({}, '', '/page?utm_source=google&safe=1');

        expect(mockReplaceState).toHaveBeenCalledWith({}, '', expect.stringContaining('/page?safe=1'));
    });

    it('removes all parameters with bare removeparam', () => {
        const descriptors: RemoveParamDescriptor[] = [
            {
                value: '',
                isAllowlist: false,
                isImportant: false,
                filterId: 1,
                ruleIndex: 0,
                ruleText: '||example.com^$removeparam',
            },
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
            {
                value: 'utm_source',
                isAllowlist: true,
                isImportant: false,
                filterId: 2,
                ruleIndex: 1,
                ruleText: '@@||example.com^$removeparam=utm_source',
            },
        ];

        patchHistoryForRemoveParam(descriptors, TEST_NONCE, TEST_SECRET);

        window.history.pushState({}, '', '/page?utm_source=google');

        // No removal — the only descriptor is an allowlist rule (skipped)
        expect(mockReplaceState).not.toHaveBeenCalled();
    });

    it('skips URLs without query parameters', () => {
        const descriptors: RemoveParamDescriptor[] = [
            {
                value: 'utm_source',
                isAllowlist: false,
                isImportant: false,
                filterId: 1,
                ruleIndex: 0,
                ruleText: '||example.com^$removeparam=utm_source',
            },
        ];

        window.history.pushState({}, '', '/page');

        patchHistoryForRemoveParam(descriptors, TEST_NONCE, TEST_SECRET);

        expect(mockReplaceState).not.toHaveBeenCalled();
    });

    it('handles negated removeparam (~param)', () => {
        const descriptors: RemoveParamDescriptor[] = [
            {
                value: '~safe',
                isAllowlist: false,
                isImportant: false,
                filterId: 1,
                ruleIndex: 0,
                ruleText: '||example.com^$removeparam=~safe',
            },
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
            {
                value: '/^utm_/',
                isAllowlist: false,
                isImportant: false,
                filterId: 1,
                ruleIndex: 0,
                ruleText: '||example.com^$removeparam=/^utm_/',
            },
        ];

        patchHistoryForRemoveParam(descriptors, TEST_NONCE, TEST_SECRET);

        window.history.pushState({}, '', '/page?utm_source=g&utm_medium=c&safe=1');

        expect(mockReplaceState).toHaveBeenCalled();
        const calledUrl = mockReplaceState.mock.calls[0][2] as string;
        expect(calledUrl).toContain('safe=1');
        expect(calledUrl).not.toContain('utm_source');
        expect(calledUrl).not.toContain('utm_medium');
    });

    it('preserves hash fragment with bare removeparam', () => {
        const descriptors: RemoveParamDescriptor[] = [
            {
                value: '',
                isAllowlist: false,
                isImportant: false,
                filterId: 1,
                ruleIndex: 0,
                ruleText: '||example.com^$removeparam',
            },
        ];

        window.history.pushState({}, '', '/page?a=1&b=2#section');

        patchHistoryForRemoveParam(descriptors, TEST_NONCE, TEST_SECRET);

        expect(mockReplaceState).toHaveBeenCalled();
        const calledUrl = mockReplaceState.mock.calls[0][2] as string;
        expect(calledUrl).toContain('#section');
        expect(calledUrl).not.toContain('?');
    });

    it('keeps value-less parameter matching negated descriptor', () => {
        const descriptors: RemoveParamDescriptor[] = [
            {
                value: '~safe',
                isAllowlist: false,
                isImportant: false,
                filterId: 1,
                ruleIndex: 0,
                ruleText: '||example.com^$removeparam=~safe',
            },
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
            {
                value: 'utm_source',
                isAllowlist: false,
                isImportant: false,
                filterId: 1,
                ruleIndex: 0,
                ruleText: '||example.com^$removeparam=utm_source',
            },
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
            {
                value: 'utm_source',
                isAllowlist: false,
                isImportant: false,
                filterId: 1,
                ruleIndex: 0,
                ruleText: '||example.com^$removeparam=utm_source',
            },
            {
                value: 'utm_medium',
                isAllowlist: false,
                isImportant: false,
                filterId: 1,
                ruleIndex: 1,
                ruleText: '||example.com^$removeparam=utm_medium',
            },
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
            {
                value: 'track',
                isAllowlist: false,
                isImportant: false,
                filterId: 1,
                ruleIndex: 0,
                ruleText: '||example.com^$removeparam=track',
            },
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
                {
                    value: 'initial_param',
                    isAllowlist: false,
                    isImportant: false,
                    filterId: 1,
                    ruleIndex: 0,
                    ruleText: '||example.com^$removeparam=initial_param',
                },
            ];
            patchHistoryForRemoveParam(descriptors, NONCE, SECRET);
        });

        it('updates descriptors when updater is called', () => {
            // Call the updater directly with new descriptors
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const updater = (window as any)[NONCE];
            expect(typeof updater).toBe('function');

            updater(SECRET, [
                {
                    value: 'new_param',
                    isAllowlist: false,
                    isImportant: false,
                    filterId: 2,
                    ruleIndex: 0,
                    ruleText: '||example.com^$removeparam=new_param',
                },
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
                {
                    value: 'utm_source',
                    isAllowlist: false,
                    isImportant: false,
                    filterId: 1,
                    ruleIndex: 0,
                    ruleText: '||example.com^$removeparam=utm_source',
                },
            ]);

            // The updater should have applied the new descriptors to the
            // current URL and called replaceState with the cleaned URL.
            expect(mockReplaceState).toHaveBeenCalled();
            const calledUrl = mockReplaceState.mock.calls[0][2] as string;
            expect(calledUrl).toContain('q=test');
            expect(calledUrl).not.toContain('utm_source');
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
                {
                    value: 'injected_param',
                    isAllowlist: false,
                    isImportant: false,
                    filterId: 99,
                    ruleIndex: 0,
                    ruleText: '||example.com^$removeparam=injected_param',
                },
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
