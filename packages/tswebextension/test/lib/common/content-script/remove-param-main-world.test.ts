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
    REMOVEPARAM_CONFIG_TYPE,
    REMOVEPARAM_LOG_TYPE,
    type RemoveParamDescriptorData,
} from '../../../../src/lib/common/content-script/remove-param-main-world';

describe('patchHistoryForRemoveParam (inline mode)', () => {
    let savePushState: typeof window.history.pushState;
    let saveReplaceState: typeof window.history.replaceState;
    let postedMessages: { type: string; [key: string]: unknown }[];

    beforeEach(() => {
        savePushState = window.history.pushState;
        saveReplaceState = window.history.replaceState;
        postedMessages = [];

        // Replace real pushState/replaceState with no-ops so jsdom doesn't
        // throw SecurityError on cross-origin URLs.
        window.history.pushState = vi.fn();
        window.history.replaceState = vi.fn();

        // Capture postMessage calls
        vi.spyOn(window, 'postMessage').mockImplementation((msg: unknown) => {
            if (msg && typeof msg === 'object' && 'type' in msg) {
                postedMessages.push(msg as { type: string });
            }
        });
    });

    afterEach(() => {
        window.history.pushState = savePushState;
        window.history.replaceState = saveReplaceState;
        vi.restoreAllMocks();
    });

    it('patches History API on init', () => {
        const prePatch = window.history.pushState;
        patchHistoryForRemoveParam();

        expect(window.history.pushState).not.toBe(prePatch);
    });

    it('unpatches History API when empty config is received', () => {
        patchHistoryForRemoveParam();
        const patchedPush = window.history.pushState;

        // Send empty config
        const event = new MessageEvent('message', {
            data: { type: REMOVEPARAM_CONFIG_TYPE, descriptors: [] },
        });
        window.dispatchEvent(event);

        // Should no longer be the patched function
        expect(window.history.pushState).not.toBe(patchedPush);
    });

    it('removes named parameter after config is received', () => {
        patchHistoryForRemoveParam();

        const descriptors: RemoveParamDescriptorData[] = [
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

        // Send config
        window.dispatchEvent(new MessageEvent('message', {
            data: { type: REMOVEPARAM_CONFIG_TYPE, descriptors },
        }));

        const url = 'https://example.com/page?utm_source=google&safe=1';
        window.history.pushState({}, '', url);

        // The patched method should have called replaceState with cleaned URL
        // We verify via the log message posted
        const logMsg = postedMessages.find((m) => m.type === REMOVEPARAM_LOG_TYPE);
        expect(logMsg).toBeDefined();
        expect(logMsg?.cleanedUrl).toBe('https://example.com/page?safe=1');
    });

    it('removes all parameters with bare removeparam', () => {
        patchHistoryForRemoveParam();

        const descriptors: RemoveParamDescriptorData[] = [
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

        window.dispatchEvent(new MessageEvent('message', {
            data: { type: REMOVEPARAM_CONFIG_TYPE, descriptors },
        }));

        window.history.pushState({}, '', 'https://example.com/page?a=1&b=2');

        const logMsg = postedMessages.find((m) => m.type === REMOVEPARAM_LOG_TYPE);
        expect(logMsg).toBeDefined();
        expect(logMsg?.cleanedUrl).toBe('https://example.com/page');
    });

    it('skips allowlisted parameters', () => {
        patchHistoryForRemoveParam();

        // When both blocking and allowlist rules exist for the same param,
        // MatchingResult.getRemoveParamRules() in the background filters out
        // the blocking rule. Only the allowlist descriptor is sent.
        const descriptors: RemoveParamDescriptorData[] = [
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

        window.dispatchEvent(new MessageEvent('message', {
            data: { type: REMOVEPARAM_CONFIG_TYPE, descriptors },
        }));

        window.history.pushState({}, '', 'https://example.com/page?utm_source=google');

        const logMsg = postedMessages.find((m) => m.type === REMOVEPARAM_LOG_TYPE);
        // No removal — the only descriptor is an allowlist rule (skipped)
        expect(logMsg).toBeUndefined();
    });

    it('skips URLs without query parameters', () => {
        patchHistoryForRemoveParam();

        const descriptors: RemoveParamDescriptorData[] = [
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

        window.dispatchEvent(new MessageEvent('message', {
            data: { type: REMOVEPARAM_CONFIG_TYPE, descriptors },
        }));

        window.history.pushState({}, '', 'https://example.com/page');

        const logMsg = postedMessages.find((m) => m.type === REMOVEPARAM_LOG_TYPE);
        expect(logMsg).toBeUndefined();
    });

    it('processes buffered URLs when config arrives', () => {
        patchHistoryForRemoveParam();

        // Push BEFORE config arrives
        window.history.pushState({}, '', 'https://example.com/page?utm_source=google&safe=1');

        // Now send config
        const descriptors: RemoveParamDescriptorData[] = [
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

        window.dispatchEvent(new MessageEvent('message', {
            data: { type: REMOVEPARAM_CONFIG_TYPE, descriptors },
        }));

        // Buffered URL should have been processed
        const logMsg = postedMessages.find((m) => m.type === REMOVEPARAM_LOG_TYPE);
        expect(logMsg).toBeDefined();
        expect(logMsg?.cleanedUrl).toBe('https://example.com/page?safe=1');
    });

    it('handles negated removeparam (~param)', () => {
        patchHistoryForRemoveParam();

        const descriptors: RemoveParamDescriptorData[] = [
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

        window.dispatchEvent(new MessageEvent('message', {
            data: { type: REMOVEPARAM_CONFIG_TYPE, descriptors },
        }));

        window.history.pushState({}, '', 'https://example.com/page?utm=1&safe=keep&fbclid=abc');

        const logMsg = postedMessages.find((m) => m.type === REMOVEPARAM_LOG_TYPE);
        expect(logMsg).toBeDefined();
        // Only 'safe' should remain
        expect(logMsg?.cleanedUrl).toBe('https://example.com/page?safe=keep');
    });

    it('handles regex removeparam', () => {
        patchHistoryForRemoveParam();

        const descriptors: RemoveParamDescriptorData[] = [
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

        window.dispatchEvent(new MessageEvent('message', {
            data: { type: REMOVEPARAM_CONFIG_TYPE, descriptors },
        }));

        window.history.pushState({}, '', 'https://example.com/page?utm_source=g&utm_medium=c&safe=1');

        const logMsg = postedMessages.find((m) => m.type === REMOVEPARAM_LOG_TYPE);
        expect(logMsg).toBeDefined();
        expect(logMsg?.cleanedUrl).toBe('https://example.com/page?safe=1');
    });

    it('preserves hash fragment with bare removeparam', () => {
        patchHistoryForRemoveParam();

        const descriptors: RemoveParamDescriptorData[] = [
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

        window.dispatchEvent(new MessageEvent('message', {
            data: { type: REMOVEPARAM_CONFIG_TYPE, descriptors },
        }));

        window.history.pushState({}, '', 'https://example.com/page?a=1&b=2#section');

        const logMsg = postedMessages.find((m) => m.type === REMOVEPARAM_LOG_TYPE);
        expect(logMsg).toBeDefined();
        expect(logMsg?.cleanedUrl).toBe('https://example.com/page#section');
    });

    it('keeps value-less parameter matching negated descriptor', () => {
        patchHistoryForRemoveParam();

        const descriptors: RemoveParamDescriptorData[] = [
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

        window.dispatchEvent(new MessageEvent('message', {
            data: { type: REMOVEPARAM_CONFIG_TYPE, descriptors },
        }));

        window.history.pushState({}, '', 'https://example.com/page?noval&safe=1');

        const logMsg = postedMessages.find((m) => m.type === REMOVEPARAM_LOG_TYPE);
        expect(logMsg).toBeDefined();
        expect(logMsg?.cleanedUrl).toBe('https://example.com/page?safe=1');
    });

    it('preserves hash fragment with named removeparam', () => {
        patchHistoryForRemoveParam();

        const descriptors: RemoveParamDescriptorData[] = [
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

        window.dispatchEvent(new MessageEvent('message', {
            data: { type: REMOVEPARAM_CONFIG_TYPE, descriptors },
        }));

        window.history.pushState({}, '', 'https://example.com/page?utm_source=g&safe=1#anchor');

        const logMsg = postedMessages.find((m) => m.type === REMOVEPARAM_LOG_TYPE);
        expect(logMsg).toBeDefined();
        expect(logMsg?.cleanedUrl).toBe('https://example.com/page?safe=1#anchor');
    });
});
