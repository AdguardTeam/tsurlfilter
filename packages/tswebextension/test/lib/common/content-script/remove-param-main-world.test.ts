import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import {
    patchHistoryForRemoveParam,
    REMOVEPARAM_LOG_TYPE,
    REMOVEPARAM_UPDATE_TYPE,
} from '../../../../src/lib/common/content-script/remove-param-main-world';
import { type RemoveParamDescriptor } from '../../../../src/lib/common/message';

describe('patchHistoryForRemoveParam', () => {
    const TEST_NONCE = 'test-nonce-xyz789';
    let savePushState: typeof History.prototype.pushState;
    let saveReplaceState: typeof History.prototype.replaceState;
    let postedMessages: { type: string; [key: string]: unknown }[];

    beforeEach(() => {
        savePushState = History.prototype.pushState;
        saveReplaceState = History.prototype.replaceState;
        postedMessages = [];

        // Replace real pushState/replaceState with no-ops so jsdom doesn't
        // throw SecurityError on cross-origin URLs.
        History.prototype.pushState = vi.fn();
        History.prototype.replaceState = vi.fn();

        // Capture postMessage calls
        vi.spyOn(window, 'postMessage').mockImplementation((msg: unknown) => {
            if (msg && typeof msg === 'object' && 'type' in msg) {
                postedMessages.push(msg as { type: string });
            }
        });
    });

    afterEach(() => {
        History.prototype.pushState = savePushState;
        History.prototype.replaceState = saveReplaceState;
        vi.restoreAllMocks();
    });

    it('does not patch History API when descriptors are empty', () => {
        const prePatch = History.prototype.pushState;
        patchHistoryForRemoveParam([], TEST_NONCE);

        expect(History.prototype.pushState).toBe(prePatch);
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
                advancedModifier: 'utm_source',
            },
        ];

        patchHistoryForRemoveParam(descriptors, TEST_NONCE);

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
                advancedModifier: 'utm_source',
            },
        ];

        patchHistoryForRemoveParam(descriptors, TEST_NONCE);

        const url = 'https://example.com/page?utm_source=google&safe=1';
        window.history.pushState({}, '', url);

        const logMsg = postedMessages.find((m) => m.type === REMOVEPARAM_LOG_TYPE);
        expect(logMsg).toBeDefined();
        expect(logMsg?.cleanedUrl).toBe('https://example.com/page?safe=1');
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
                advancedModifier: '',
            },
        ];

        patchHistoryForRemoveParam(descriptors, TEST_NONCE);

        window.history.pushState({}, '', 'https://example.com/page?a=1&b=2');

        const logMsg = postedMessages.find((m) => m.type === REMOVEPARAM_LOG_TYPE);
        expect(logMsg).toBeDefined();
        expect(logMsg?.cleanedUrl).toBe('https://example.com/page');
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
                advancedModifier: 'utm_source',
            },
        ];

        patchHistoryForRemoveParam(descriptors, TEST_NONCE);

        window.history.pushState({}, '', 'https://example.com/page?utm_source=google');

        const logMsg = postedMessages.find((m) => m.type === REMOVEPARAM_LOG_TYPE);
        // No removal — the only descriptor is an allowlist rule (skipped)
        expect(logMsg).toBeUndefined();
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
                advancedModifier: 'utm_source',
            },
        ];

        patchHistoryForRemoveParam(descriptors, TEST_NONCE);

        window.history.pushState({}, '', 'https://example.com/page');

        const logMsg = postedMessages.find((m) => m.type === REMOVEPARAM_LOG_TYPE);
        expect(logMsg).toBeUndefined();
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
                advancedModifier: '~safe',
            },
        ];

        patchHistoryForRemoveParam(descriptors, TEST_NONCE);

        window.history.pushState({}, '', 'https://example.com/page?utm=1&safe=keep&fbclid=abc');

        const logMsg = postedMessages.find((m) => m.type === REMOVEPARAM_LOG_TYPE);
        expect(logMsg).toBeDefined();
        // Only 'safe' should remain
        expect(logMsg?.cleanedUrl).toBe('https://example.com/page?safe=keep');
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
                advancedModifier: '/^utm_/',
            },
        ];

        patchHistoryForRemoveParam(descriptors, TEST_NONCE);

        window.history.pushState({}, '', 'https://example.com/page?utm_source=g&utm_medium=c&safe=1');

        const logMsg = postedMessages.find((m) => m.type === REMOVEPARAM_LOG_TYPE);
        expect(logMsg).toBeDefined();
        expect(logMsg?.cleanedUrl).toBe('https://example.com/page?safe=1');
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
                advancedModifier: '',
            },
        ];

        patchHistoryForRemoveParam(descriptors, TEST_NONCE);

        window.history.pushState({}, '', 'https://example.com/page?a=1&b=2#section');

        const logMsg = postedMessages.find((m) => m.type === REMOVEPARAM_LOG_TYPE);
        expect(logMsg).toBeDefined();
        expect(logMsg?.cleanedUrl).toBe('https://example.com/page#section');
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
                advancedModifier: '~safe',
            },
        ];

        patchHistoryForRemoveParam(descriptors, TEST_NONCE);

        window.history.pushState({}, '', 'https://example.com/page?noval&safe=1');

        const logMsg = postedMessages.find((m) => m.type === REMOVEPARAM_LOG_TYPE);
        expect(logMsg).toBeDefined();
        expect(logMsg?.cleanedUrl).toBe('https://example.com/page?safe=1');
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
                advancedModifier: 'utm_source',
            },
        ];

        patchHistoryForRemoveParam(descriptors, TEST_NONCE);

        window.history.pushState({}, '', 'https://example.com/page?utm_source=g&safe=1#anchor');

        const logMsg = postedMessages.find((m) => m.type === REMOVEPARAM_LOG_TYPE);
        expect(logMsg).toBeDefined();
        expect(logMsg?.cleanedUrl).toBe('https://example.com/page?safe=1#anchor');
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
                advancedModifier: 'utm_source',
            },
            {
                value: 'utm_medium',
                isAllowlist: false,
                isImportant: false,
                filterId: 1,
                ruleIndex: 1,
                ruleText: '||example.com^$removeparam=utm_medium',
                advancedModifier: 'utm_medium',
            },
        ];

        patchHistoryForRemoveParam(descriptors, TEST_NONCE);

        window.history.pushState({}, '', 'https://example.com/page?utm_source=g&utm_medium=c&safe=1');

        const logMsg = postedMessages.find((m) => m.type === REMOVEPARAM_LOG_TYPE);
        expect(logMsg).toBeDefined();
        expect(logMsg?.cleanedUrl).toBe('https://example.com/page?safe=1');
        // Both descriptors should be in the applied list
        expect(logMsg?.appliedDescriptors).toHaveLength(2);
    });

    it('exports REMOVEPARAM_UPDATE_TYPE constant', () => {
        expect(REMOVEPARAM_UPDATE_TYPE).toBe('__adg_removeparam_update');
    });

    describe('descriptor update via message', () => {
        const NONCE = 'update-test-nonce';

        beforeEach(() => {
            // Patch with initial descriptor
            const descriptors: RemoveParamDescriptor[] = [
                {
                    value: 'initial_param',
                    isAllowlist: false,
                    isImportant: false,
                    filterId: 1,
                    ruleIndex: 0,
                    ruleText: '||example.com^$removeparam=initial_param',
                    advancedModifier: 'initial_param',
                },
            ];
            patchHistoryForRemoveParam(descriptors, NONCE);
        });

        it('updates descriptors when valid update message is received', () => {
            // Send update message with new descriptor
            const updateEvent = new MessageEvent('message', {
                data: {
                    type: '__adg_removeparam_update',
                    nonce: NONCE,
                    descriptors: [
                        {
                            value: 'new_param',
                            isAllowlist: false,
                            isImportant: false,
                            filterId: 2,
                            ruleIndex: 0,
                            ruleText: '||example.com^$removeparam=new_param',
                            advancedModifier: 'new_param',
                        },
                    ],
                },
                source: window,
            });
            window.dispatchEvent(updateEvent);

            // Now pushState — should remove new_param, not initial_param
            window.history.pushState({}, '', 'https://example.com/page?new_param=val&keep=1');

            // The patched pushState posts a log event with the cleaned URL
            const logMsg = postedMessages.find((m) => m.type === REMOVEPARAM_LOG_TYPE);
            expect(logMsg).toBeDefined();
            expect(logMsg?.cleanedUrl).toBe('https://example.com/page?keep=1');
        });

        it('ignores update message with wrong nonce', () => {
            const updateEvent = new MessageEvent('message', {
                data: {
                    type: '__adg_removeparam_update',
                    nonce: 'wrong-nonce',
                    descriptors: [
                        {
                            value: 'new_param',
                            isAllowlist: false,
                            isImportant: false,
                            filterId: 2,
                            ruleIndex: 0,
                            ruleText: '||example.com^$removeparam=new_param',
                            advancedModifier: 'new_param',
                        },
                    ],
                },
                source: window,
            });
            window.dispatchEvent(updateEvent);

            // pushState with both params — initial_param should be removed (old descriptor still active)
            window.history.pushState({}, '', 'https://example.com/page?initial_param=val&new_param=val');

            // Log event shows initial_param was removed (old descriptor), new_param remains
            const logMsg = postedMessages.find((m) => m.type === REMOVEPARAM_LOG_TYPE);
            expect(logMsg).toBeDefined();
            expect(logMsg?.cleanedUrl).toBe('https://example.com/page?new_param=val');
        });

        it('clears descriptors when empty array is received', () => {
            const updateEvent = new MessageEvent('message', {
                data: {
                    type: '__adg_removeparam_update',
                    nonce: NONCE,
                    descriptors: [],
                },
                source: window,
            });
            window.dispatchEvent(updateEvent);

            // pushState with initial_param — should NOT be removed (descriptors cleared)
            window.history.pushState({}, '', 'https://example.com/page?initial_param=val');

            // No log event posted (no params removed)
            const logMsg = postedMessages.find((m) => m.type === REMOVEPARAM_LOG_TYPE);
            expect(logMsg).toBeUndefined();
        });
    });
});
