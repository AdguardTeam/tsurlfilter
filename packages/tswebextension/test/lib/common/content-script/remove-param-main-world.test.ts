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
} from '../../../../src/lib/common/content-script/remove-param-main-world';
import { type RemoveParamDescriptor } from '../../../../src/lib/common/message';

describe('patchHistoryForRemoveParam', () => {
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

    it('does not patch History API when descriptors are empty', () => {
        const prePatch = window.history.pushState;
        patchHistoryForRemoveParam([]);

        expect(window.history.pushState).toBe(prePatch);
    });

    it('patches History API when descriptors are provided', () => {
        const prePatch = window.history.pushState;
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

        patchHistoryForRemoveParam(descriptors);

        expect(window.history.pushState).not.toBe(prePatch);
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

        patchHistoryForRemoveParam(descriptors);

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

        patchHistoryForRemoveParam(descriptors);

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

        patchHistoryForRemoveParam(descriptors);

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

        patchHistoryForRemoveParam(descriptors);

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

        patchHistoryForRemoveParam(descriptors);

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

        patchHistoryForRemoveParam(descriptors);

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

        patchHistoryForRemoveParam(descriptors);

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

        patchHistoryForRemoveParam(descriptors);

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

        patchHistoryForRemoveParam(descriptors);

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

        patchHistoryForRemoveParam(descriptors);

        window.history.pushState({}, '', 'https://example.com/page?utm_source=g&utm_medium=c&safe=1');

        const logMsg = postedMessages.find((m) => m.type === REMOVEPARAM_LOG_TYPE);
        expect(logMsg).toBeDefined();
        expect(logMsg?.cleanedUrl).toBe('https://example.com/page?safe=1');
        // Both descriptors should be in the applied list
        expect(logMsg?.appliedDescriptors).toHaveLength(2);
    });
});
