import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';
import browser from 'webextension-polyfill';

import { RemoveParamModifier } from '@adguard/tsurlfilter';

import { MAIN_FRAME_ID } from '../../../../../src/lib/common/constants';
import { getRemoveParamDescriptors } from '../../../../../src/lib/common/utils/remove-param-rules';
import {
    RemoveParamInjectionService,
} from '../../../../../src/lib/mv2/background/services/remove-param-injection-service';
import { TabsApi } from '../../../../../src/lib/mv2/background/tabs';

// Mock dependencies
vi.mock('webextension-polyfill', () => {
    const addListener = vi.fn();
    const removeListener = vi.fn();
    return {
        default: {
            webNavigation: {
                onHistoryStateUpdated: { addListener, removeListener },
            },
            tabs: {
                onRemoved: {
                    addListener: vi.fn(),
                    removeListener: vi.fn(),
                },
                sendMessage: vi.fn().mockResolvedValue(undefined),
                executeScript: vi.fn().mockResolvedValue(undefined),
            },
        },
    };
});

vi.mock('../../../../../src/lib/mv2/background/tabs', () => ({
    TabsApi: {
        injectScript: vi.fn().mockResolvedValue(undefined),
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

vi.mock('../../../../../src/lib/common/utils/rule-text-provider', () => ({
    getRuleTexts: vi.fn(() => ({ appliedRuleText: 'rule-text', originalRuleText: null })),
}));

vi.mock('../../../../../src/lib/common/utils/nanoid', () => ({
    nanoid: vi.fn(() => 'mock-event-id'),
}));

vi.mock('../../../../../src/lib/common/utils/url', () => ({
    getDomain: vi.fn(() => 'example.com'),
}));

describe('RemoveParamInjectionService (MV2)', () => {
    let service: RemoveParamInjectionService;
    let mockTabsApi: any;
    let mockEngineApi: any;
    let mockFilteringLog: any;
    beforeEach(() => {
        mockTabsApi = {
            getTabContext: vi.fn(),
        };
        mockEngineApi = {};
        mockFilteringLog = {
            publishEvent: vi.fn(),
        };
        service = new RemoveParamInjectionService(
            mockTabsApi,
            mockEngineApi,
            mockFilteringLog,
        );
        vi.clearAllMocks();
    });

    afterEach(() => {
        service.stop();
    });

    describe('start/stop', () => {
        it('registers event listeners on start', () => {
            service.start();
            expect(browser.webNavigation.onHistoryStateUpdated.addListener)
                .toHaveBeenCalledOnce();
            expect(browser.tabs.onRemoved.addListener)
                .toHaveBeenCalledOnce();
        });

        it('removes event listeners and clears state on stop', () => {
            service.start();
            service.stop();
            expect(browser.webNavigation.onHistoryStateUpdated.removeListener)
                .toHaveBeenCalledOnce();
            expect(browser.tabs.onRemoved.removeListener)
                .toHaveBeenCalledOnce();
        });
    });

    describe('invalidateTab', () => {
        it('removes tab from injection tracking', () => {
            // Access private map via any cast for testing
            (service as any).removeParamInjections.set(1, { nonce: 'nonce-1', secret: 'secret-1' });
            service.invalidateTab(1);
            expect((service as any).removeParamInjections.has(1)).toBe(false);
        });

        it('does nothing for untracked tab', () => {
            expect(() => service.invalidateTab(999)).not.toThrow();
        });
    });

    describe('injectRemoveParam', () => {
        it('skips non-http URLs', () => {
            service.injectRemoveParam(
                1,
                MAIN_FRAME_ID,
                'chrome-extension://abc/page.html',
            );
            expect(mockTabsApi.getTabContext).not.toHaveBeenCalled();
        });

        it('skips non-main-frame requests', () => {
            service.injectRemoveParam(
                1,
                1,
                'https://example.com',
            );
            expect(mockTabsApi.getTabContext).not.toHaveBeenCalled();
        });

        it('skips when no tab context', () => {
            mockTabsApi.getTabContext.mockReturnValue(null);
            service.injectRemoveParam(
                1,
                MAIN_FRAME_ID,
                'https://example.com',
            );
            expect(mockTabsApi.getTabContext).toHaveBeenCalledWith(1);
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

            mockTabsApi.getTabContext.mockReturnValue({
                info: { url: 'https://example.com/' },
                mainFrameRule: null,
            });
            vi.mocked(getRemoveParamDescriptors).mockReturnValue({
                descriptors,
                rules: mockRules as any,
            });

            service.injectRemoveParam(
                1,
                MAIN_FRAME_ID,
                'https://example.com/?utm_source=test',
            );

            // Should inject the main-world patch script via <script> element bridge
            expect(browser.tabs.executeScript).toHaveBeenCalledWith(
                1,
                expect.objectContaining({
                    frameId: MAIN_FRAME_ID,
                    runAt: 'document_start',
                    matchAboutBlank: true,
                    code: expect.stringContaining('createElement'),
                }),
            );

            // Should track the injection
            expect(
                (service as any).removeParamInjections.has(1),
            ).toBe(true);
        });

        it('does not inject scripts when descriptors are null', () => {
            mockTabsApi.getTabContext.mockReturnValue({
                info: { url: 'https://example.com/' },
                mainFrameRule: null,
            });
            vi.mocked(getRemoveParamDescriptors).mockReturnValue(null);

            service.injectRemoveParam(
                1,
                MAIN_FRAME_ID,
                'https://example.com/',
            );

            expect(browser.tabs.executeScript).not.toHaveBeenCalled();
        });
    });

    describe('onTabRemoved', () => {
        it('cleans up injection tracking when a tab is closed', () => {
            (service as any).removeParamInjections.set(42, { nonce: 'nonce-42', secret: 'secret-42' });

            // Call the private method via the bound handler
            (service as any).onTabRemoved(42);

            expect(
                (service as any).removeParamInjections.has(42),
            ).toBe(false);
        });
    });

    describe('onHistoryStateUpdated', () => {
        it('calls injectRemoveParam for tabs without existing injection', () => {
            mockTabsApi.getTabContext.mockReturnValue(null);

            (service as any).onHistoryStateUpdated(1, MAIN_FRAME_ID, 'https://example.com/new-page');

            // Should attempt injection (will fail at getTabContext, but proves the path)
            expect(mockTabsApi.getTabContext).toHaveBeenCalledWith(1);
        });

        it('sends descriptor update for tabs with existing injection', () => {
            (service as any).removeParamInjections.set(1, { nonce: 'existing-nonce', secret: 'existing-secret' });

            mockTabsApi.getTabContext.mockReturnValue({
                info: { url: 'https://example.com/' },
                mainFrameRule: null,
            });
            vi.mocked(getRemoveParamDescriptors).mockReturnValue({
                descriptors: [],
                rules: [],
            });

            (service as any).onHistoryStateUpdated(1, MAIN_FRAME_ID, 'https://example.com/spa-page');

            // Should use browser.tabs.executeScript for descriptor update
            // instead of TabsApi.injectScript (full re-injection)
            expect(TabsApi.injectScript).not.toHaveBeenCalled();
            expect(browser.tabs.executeScript).toHaveBeenCalledWith(
                1,
                expect.objectContaining({
                    frameId: MAIN_FRAME_ID,
                }),
            );
        });

        it('skips non-main-frame history updates', () => {
            (service as any).onHistoryStateUpdated(1, 1, 'https://example.com/iframe');

            expect(mockTabsApi.getTabContext).not.toHaveBeenCalled();
            expect(TabsApi.injectScript).not.toHaveBeenCalled();
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

            mockTabsApi.getTabContext.mockReturnValue({
                info: { url: 'https://example.com/' },
                mainFrameRule: null,
            });
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
            service.injectRemoveParam(
                1,
                MAIN_FRAME_ID,
                'https://example.com/page?legit=1',
            );

            expect(mockFilteringLog.publishEvent).not.toHaveBeenCalled();
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

            mockTabsApi.getTabContext.mockReturnValue({
                info: { url: 'https://example.com/' },
                mainFrameRule: null,
            });
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
            service.injectRemoveParam(
                1,
                MAIN_FRAME_ID,
                'https://example.com/page?utm_source=test',
            );

            expect(mockFilteringLog.publishEvent).toHaveBeenCalledOnce();
        });
    });
});
