import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { RemoveParamModifier } from '@adguard/tsurlfilter';

import { MAIN_FRAME_ID } from '../../../../../src/lib/common/constants';
import { patchHistoryForRemoveParam } from '../../../../../src/lib/common/content-script/remove-param-main-world';
import { defaultFilteringLog } from '../../../../../src/lib/common/filtering-log';
import { getRemoveParamDescriptors } from '../../../../../src/lib/common/utils/remove-param-rules';
import { ScriptingApi } from '../../../../../src/lib/mv3/background/scripting-api';
import {
    removeParamInjectionService,
} from '../../../../../src/lib/mv3/background/services/remove-param-injection-service';
import { tabsApi } from '../../../../../src/lib/mv3/tabs/tabs-api';

vi.mock('../../../../../src/lib/mv3/tabs/tabs-api', () => ({
    tabsApi: {
        getTabContext: vi.fn(),
    },
}));

vi.mock('../../../../../src/lib/mv3/background/engine-api', () => ({
    engineApi: {},
}));

vi.mock('../../../../../src/lib/mv3/background/scripting-api', () => ({
    ScriptingApi: {
        executeScriptFunc: vi.fn().mockResolvedValue(undefined),
    },
}));

vi.mock('../../../../../src/lib/common/utils/remove-param-rules', async (importOriginal) => {
    const actual = await importOriginal() as Record<string, unknown>;
    return {
        ...actual,
        getRemoveParamDescriptors: vi.fn(() => null),
    };
});

vi.mock('../../../../../src/lib/common/content-script/remove-param-main-world', () => ({
    patchHistoryForRemoveParam: vi.fn(),
}));

vi.mock('../../../../../src/lib/common/filtering-log', () => ({
    defaultFilteringLog: { publishEvent: vi.fn() },
    FilteringEventType: { RemoveParam: 'removeParam' },
}));

vi.mock('../../../../../src/lib/common/utils/rule-text-provider', () => ({
    getRuleTexts: vi.fn(() => ({ appliedRuleText: 'rule-text', originalRuleText: null })),
}));

vi.mock('../../../../../src/lib/common/utils/nanoid', () => ({
    nanoid: vi.fn(() => 'mock-event-id'),
}));

vi.mock('../../../../../src/lib/common/utils/url', () => ({
    getDomain: vi.fn(() => 'example.com'),
}));

describe('RemoveParamInjectionService (MV3)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset instance state
        (removeParamInjectionService as any).removeParamInjections = new Map();
    });

    afterEach(() => {
        removeParamInjectionService.stop();
    });

    describe('start/stop', () => {
        it('registers event listeners on start', () => {
            const addListenerSpy = vi.spyOn(
                chrome.webNavigation.onHistoryStateUpdated,
                'addListener',
            );
            const tabsAddListenerSpy = vi.spyOn(
                chrome.tabs.onRemoved,
                'addListener',
            );

            removeParamInjectionService.start();

            expect(addListenerSpy).toHaveBeenCalledOnce();
            expect(tabsAddListenerSpy).toHaveBeenCalledOnce();
        });

        it('removes event listeners and clears state on stop', () => {
            const removeListenerSpy = vi.spyOn(
                chrome.webNavigation.onHistoryStateUpdated,
                'removeListener',
            );
            const tabsRemoveListenerSpy = vi.spyOn(
                chrome.tabs.onRemoved,
                'removeListener',
            );

            removeParamInjectionService.start();

            (removeParamInjectionService as any)
                .removeParamInjections.set(1, 'nonce');
            removeParamInjectionService.stop();

            expect(removeListenerSpy).toHaveBeenCalledOnce();
            expect(tabsRemoveListenerSpy).toHaveBeenCalledOnce();
            expect(
                (removeParamInjectionService as any).removeParamInjections.size,
            ).toBe(0);
        });
    });

    describe('invalidateTab', () => {
        it('removes tab from injection tracking', () => {
            (removeParamInjectionService as any)
                .removeParamInjections.set(1, { nonce: 'nonce-1', secret: 'secret-1' });
            removeParamInjectionService.invalidateTab(1);
            expect(
                (removeParamInjectionService as any).removeParamInjections.has(1),
            ).toBe(false);
        });

        it('does nothing for untracked tab', () => {
            expect(
                () => removeParamInjectionService.invalidateTab(999),
            ).not.toThrow();
        });
    });

    describe('injectRemoveParam', () => {
        it('skips non-http URLs', () => {
            removeParamInjectionService.injectRemoveParam(
                1,
                MAIN_FRAME_ID,
                'chrome-extension://abc/page.html',
            );
            expect(tabsApi.getTabContext).not.toHaveBeenCalled();
        });

        it('skips non-main-frame requests', () => {
            removeParamInjectionService.injectRemoveParam(
                1,
                1, // not main frame
                'https://example.com',
            );
            expect(tabsApi.getTabContext).not.toHaveBeenCalled();
        });

        it('skips when no tab context', () => {
            vi.mocked(tabsApi.getTabContext).mockReturnValue(null as any);
            removeParamInjectionService.injectRemoveParam(
                1,
                MAIN_FRAME_ID,
                'https://example.com',
            );
            expect(tabsApi.getTabContext).toHaveBeenCalledWith(1);
        });

        it('injects scripts when descriptors are found', () => {
            const descriptors = [
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

            const mockRules = [
                {
                    isAllowlist: (): boolean => false,
                    isOptionEnabled: (): boolean => false,
                    getFilterListId: (): number => 1,
                    getIndex: (): number => 0,
                    getAdvancedModifier: (): any => new RemoveParamModifier('utm_source'),
                    getAdvancedModifierValue: (): string => 'utm_source',
                },
            ];

            vi.mocked(tabsApi.getTabContext).mockReturnValue({
                info: { url: 'https://example.com/' },
                mainFrameRule: null,
            } as any);
            vi.mocked(getRemoveParamDescriptors).mockReturnValue({
                descriptors,
                rules: mockRules as any,
            });

            removeParamInjectionService.injectRemoveParam(
                1,
                MAIN_FRAME_ID,
                'https://example.com/?utm_source=test',
            );

            // Should inject the main-world patch script
            expect(ScriptingApi.executeScriptFunc).toHaveBeenCalledWith(
                expect.objectContaining({
                    tabId: 1,
                    frameId: MAIN_FRAME_ID,
                    scriptFunction: patchHistoryForRemoveParam,
                    args: [descriptors, expect.any(String), expect.any(String)],
                }),
            );

            // Should track the injection
            expect(
                (removeParamInjectionService as any).removeParamInjections.has(1),
            ).toBe(true);
        });

        it('does not inject scripts when descriptors are null', () => {
            vi.mocked(tabsApi.getTabContext).mockReturnValue({
                info: { url: 'https://example.com/' },
                mainFrameRule: null,
            } as any);
            vi.mocked(getRemoveParamDescriptors).mockReturnValue(null);

            removeParamInjectionService.injectRemoveParam(
                1,
                MAIN_FRAME_ID,
                'https://example.com/',
            );

            expect(ScriptingApi.executeScriptFunc).not.toHaveBeenCalled();
        });
    });

    describe('onTabRemoved', () => {
        it('cleans up injection tracking when a tab is closed', () => {
            (removeParamInjectionService as any)
                .removeParamInjections.set(42, { nonce: 'nonce-42', secret: 'secret-42' });

            // Call the protected method
            (removeParamInjectionService as any).onTabRemoved(42);

            expect(
                (removeParamInjectionService as any).removeParamInjections.has(42),
            ).toBe(false);
        });
    });

    describe('onHistoryStateUpdated', () => {
        it('calls injectRemoveParam for tabs without existing injection', () => {
            vi.mocked(tabsApi.getTabContext).mockReturnValue(null as any);

            (removeParamInjectionService as any).onHistoryStateUpdated(
                1,
                MAIN_FRAME_ID,
                'https://example.com/new-page',
            );

            // Should attempt injection (will fail at getTabContext, but proves the path)
            expect(tabsApi.getTabContext).toHaveBeenCalledWith(1);
        });

        it('sends descriptor update for tabs with existing injection', () => {
            (removeParamInjectionService as any)
                .removeParamInjections.set(1, { nonce: 'existing-nonce', secret: 'existing-secret' });

            vi.mocked(tabsApi.getTabContext).mockReturnValue({
                info: { url: 'https://example.com/' },
                mainFrameRule: null,
            } as any);

            vi.mocked(getRemoveParamDescriptors).mockReturnValue({
                descriptors: [],
                rules: [],
            });

            (removeParamInjectionService as any).onHistoryStateUpdated(
                1,
                MAIN_FRAME_ID,
                'https://example.com/spa-page',
            );

            // Should call ScriptingApi.executeScriptFunc for the descriptor update,
            // but NOT with patchHistoryForRemoveParam (that would be a full re-injection).
            expect(ScriptingApi.executeScriptFunc).toHaveBeenCalledWith(
                expect.objectContaining({
                    tabId: 1,
                    frameId: MAIN_FRAME_ID,
                    args: ['existing-secret', [], 'existing-nonce'],
                }),
            );
            expect(ScriptingApi.executeScriptFunc).not.toHaveBeenCalledWith(
                expect.objectContaining({
                    scriptFunction: patchHistoryForRemoveParam,
                }),
            );
        });

        it('skips non-main-frame history updates', () => {
            (removeParamInjectionService as any).onHistoryStateUpdated(
                1,
                1, // not main frame
                'https://example.com/iframe',
            );

            expect(tabsApi.getTabContext).not.toHaveBeenCalled();
            expect(ScriptingApi.executeScriptFunc).not.toHaveBeenCalled();
        });
    });

    describe('no-duplicate logging', () => {
        it('does not log rules whose param is not present in the URL', () => {
            const modifier = new RemoveParamModifier('utm_source');
            const mockRules = [
                {
                    isAllowlist: (): boolean => false,
                    isOptionEnabled: (): boolean => false,
                    getFilterListId: (): number => 1,
                    getIndex: (): number => 0,
                    getAdvancedModifier: (): any => modifier,
                    getAdvancedModifierValue: (): string => 'utm_source',
                },
            ];

            vi.mocked(tabsApi.getTabContext).mockReturnValue({
                info: { url: 'https://example.com/' },
                mainFrameRule: null,
            } as any);
            vi.mocked(getRemoveParamDescriptors).mockReturnValue({
                descriptors: [{
                    value: 'utm_source',
                    isAllowlist: false,
                    isImportant: false,
                    filterId: 1,
                    ruleIndex: 0,
                    ruleText: '||example.com^$removeparam=utm_source',
                }],
                rules: mockRules as any,
            });

            // URL does NOT have utm_source param — rule is ineffective
            removeParamInjectionService.injectRemoveParam(
                1,
                MAIN_FRAME_ID,
                'https://example.com/page?legit=1',
            );

            expect(defaultFilteringLog.publishEvent).not.toHaveBeenCalled();
        });

        it('logs rules only when their param IS present in the URL', () => {
            const modifier = new RemoveParamModifier('utm_source');
            const mockRules = [
                {
                    isAllowlist: (): boolean => false,
                    isOptionEnabled: (): boolean => false,
                    getFilterListId: (): number => 1,
                    getIndex: (): number => 0,
                    getAdvancedModifier: (): any => modifier,
                    getAdvancedModifierValue: (): string => 'utm_source',
                },
            ];

            vi.mocked(tabsApi.getTabContext).mockReturnValue({
                info: { url: 'https://example.com/' },
                mainFrameRule: null,
            } as any);
            vi.mocked(getRemoveParamDescriptors).mockReturnValue({
                descriptors: [{
                    value: 'utm_source',
                    isAllowlist: false,
                    isImportant: false,
                    filterId: 1,
                    ruleIndex: 0,
                    ruleText: '||example.com^$removeparam=utm_source',
                }],
                rules: mockRules as any,
            });

            // URL HAS utm_source param — rule is effective
            removeParamInjectionService.injectRemoveParam(
                1,
                MAIN_FRAME_ID,
                'https://example.com/page?utm_source=test',
            );

            expect(defaultFilteringLog.publishEvent).toHaveBeenCalledOnce();
        });
    });
});
