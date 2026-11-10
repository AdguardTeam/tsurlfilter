import {
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { FilteringEventType } from '../../../../src/lib/common/filtering-log';
import { MESSAGE_HANDLER_NAME, MessageType } from '../../../../src/lib/common/message-constants';
import { CosmeticApi } from '../../../../src/lib/mv3/background/cosmetic-api';
import { MessagesApi } from '../../../../src/lib/mv3/background/messages-api';

vi.mock('../../../../src/lib/mv3/background/engine-api', () => ({
    engineApi: {
        retrieveRuleText: vi.fn().mockReturnValue(null),
        retrieveOriginalRuleText: vi.fn().mockReturnValue(null),
    },
}));

vi.mock('../../../../src/lib/mv3/background/app-context', () => ({
    appContext: {
        isStorageInitialized: true,
        configuration: {
            settings: {
                collectStats: true,
            },
        },
    },
}));

vi.mock('../../../../src/lib/mv3/background/assistant', () => ({
    Assistant: {
        onCreateRule: { dispatch: vi.fn() },
    },
}));

vi.mock('../../../../src/lib/mv3/background/cosmetic-api', () => ({
    CosmeticApi: {
        getContentScriptData: vi.fn(),
        reapplyMarkedCosmeticData: vi.fn(),
        waitForPendingCssInjection: vi.fn().mockResolvedValue(undefined),
    },
}));

vi.mock('../../../../src/lib/mv3/background/services/cookie-filtering/cookie-filtering', () => ({
    CookieFiltering: {},
}));

const TAB_ID = 1;
const TAB_URL = 'https://example.com/page';
const FRAME_ID = 100;
const FRAME_URL = 'https://ads.example.org/widget';
const SENDER_URL = 'https://cdn.example.net/frame.html';

const PAYLOAD = [
    {
        filterId: 1,
        ruleIndex: 100,
        element: 'div[id^="div-gpt-ad"]',
    },
];

/**
 * Creates a minimal sender object for the css hits stats message.
 *
 * @param frameId Frame id of the sender.
 * @param url Url of the sender document.
 *
 * @returns Message sender mock.
 */
const createSender = (frameId?: number, url?: string): any => ({
    tab: { id: TAB_ID },
    frameId,
    url,
});

describe('MessagesApi', () => {
    describe('handleGetCollectHitStats', () => {
        it('returns the configured collectStats value', async () => {
            const tabsApi = {
                createTabContextIfNotExists: vi.fn(),
                updateTabMainFrameRule: vi.fn(),
                getTabContext: vi.fn().mockReturnValue({
                    info: { url: TAB_URL },
                    mainFrameRule: { isFilteringDisabled: () => false },
                }),
            };
            const messagesApi = new MessagesApi({} as any, tabsApi as any, {} as any);

            const result = await messagesApi.handleMessage({
                handlerName: MESSAGE_HANDLER_NAME,
                type: MessageType.GetCollectHitStats,
                payload: null,
            }, {
                tab: { id: TAB_ID, url: TAB_URL },
            } as any);

            expect(tabsApi.createTabContextIfNotExists).toHaveBeenCalledWith(TAB_ID, TAB_URL);
            // The navigation handler owns mainFrameRule. Rematching it from
            // the tab URL can restore a stale allowlist rule.
            expect(tabsApi.updateTabMainFrameRule).not.toHaveBeenCalled();
            expect(result).toBe(true);
        });

        it('returns null when the tab context is unknown', async () => {
            const tabsApi = {
                createTabContextIfNotExists: vi.fn(),
                updateTabMainFrameRule: vi.fn(),
                getTabContext: vi.fn().mockReturnValue(undefined),
            };
            const messagesApi = new MessagesApi({} as any, tabsApi as any, {} as any);

            const result = await messagesApi.handleMessage({
                handlerName: MESSAGE_HANDLER_NAME,
                type: MessageType.GetCollectHitStats,
                payload: null,
            }, {
                tab: { id: TAB_ID, url: TAB_URL },
            } as any);

            expect(result).toBeNull();
        });

        it('returns false for an allowlisted tab', async () => {
            const tabsApi = {
                createTabContextIfNotExists: vi.fn(),
                updateTabMainFrameRule: vi.fn(),
                getTabContext: vi.fn().mockReturnValue({
                    info: { url: TAB_URL },
                    mainFrameRule: { isFilteringDisabled: () => true },
                }),
            };
            const messagesApi = new MessagesApi({} as any, tabsApi as any, {} as any);

            const result = await messagesApi.handleMessage({
                handlerName: MESSAGE_HANDLER_NAME,
                type: MessageType.GetCollectHitStats,
                payload: null,
            }, createSender(0));

            expect(result).toBe(false);
        });
    });

    describe('handleGetCosmeticData', () => {
        beforeEach(() => {
            vi.mocked(CosmeticApi.getContentScriptData).mockReset();
            vi.mocked(CosmeticApi.waitForPendingCssInjection).mockReset();
            vi.mocked(CosmeticApi.waitForPendingCssInjection).mockResolvedValue(undefined);
        });

        it('does not rematch the main frame rule from the stale tab url', async () => {
            const tabsApi = {
                createTabContextIfNotExists: vi.fn(),
                updateTabMainFrameRule: vi.fn(),
            };
            const data = {
                isAppStarted: true,
                areHitsStatsCollected: true,
                areNativeHitsStatsCollected: true,
                extCssRules: null,
                nativeCssSelectors: null,
            };
            vi.mocked(CosmeticApi.getContentScriptData).mockReturnValue(data);
            const messagesApi = new MessagesApi(
                { isStarted: true } as any,
                tabsApi as any,
                {} as any,
            );

            const result = await messagesApi.handleMessage({
                handlerName: MESSAGE_HANDLER_NAME,
                type: MessageType.GetCosmeticData,
                payload: { documentUrl: TAB_URL },
            }, {
                tab: { id: TAB_ID, url: TAB_URL },
                frameId: 0,
            } as any);

            expect(result).toBe(data);
            expect(tabsApi.createTabContextIfNotExists).toHaveBeenCalledWith(TAB_ID, TAB_URL);
            expect(tabsApi.updateTabMainFrameRule).not.toHaveBeenCalled();
            expect(CosmeticApi.waitForPendingCssInjection).toHaveBeenCalledWith(TAB_ID, 0);
            expect(CosmeticApi.getContentScriptData).toHaveBeenCalledWith(TAB_URL, TAB_ID, 0);
        });
    });

    describe('handleSaveCssHitsStats', () => {
        let publishEvent: ReturnType<typeof vi.fn>;
        let getTabFrame: ReturnType<typeof vi.fn>;
        let messagesApi: MessagesApi;

        const createMessage = (): {
            handlerName: string;
            type: MessageType;
            payload: typeof PAYLOAD;
        } => ({
            handlerName: MESSAGE_HANDLER_NAME,
            type: MessageType.SaveCssHitsStats,
            payload: PAYLOAD,
        });

        beforeEach(() => {
            publishEvent = vi.fn();
            getTabFrame = vi.fn();

            const tabsApi = {
                getTabContext: vi.fn().mockReturnValue({
                    info: { url: TAB_URL },
                }),
                getTabFrame,
            };

            const filteringLog = { publishEvent };

            messagesApi = new MessagesApi(
                { isStarted: true } as any,
                tabsApi as any,
                filteringLog as any,
            );
        });

        it('uses tab url for hits from the main frame', async () => {
            const result = await messagesApi.handleMessage(
                createMessage() as any,
                createSender(0),
            );

            expect(result).toBe(true);
            expect(getTabFrame).not.toHaveBeenCalled();
            expect(publishEvent).toHaveBeenCalledWith(expect.objectContaining({
                type: FilteringEventType.ApplyCosmeticRule,
                data: expect.objectContaining({
                    frameUrl: TAB_URL,
                    frameDomain: 'example.com',
                }),
            }));
        });

        it('uses frame url for hits from a subframe', async () => {
            getTabFrame.mockReturnValue({ url: FRAME_URL });

            const result = await messagesApi.handleMessage(
                createMessage() as any,
                createSender(FRAME_ID),
            );

            expect(result).toBe(true);
            expect(getTabFrame).toHaveBeenCalledWith(TAB_ID, FRAME_ID);
            expect(publishEvent).toHaveBeenCalledWith(expect.objectContaining({
                type: FilteringEventType.ApplyCosmeticRule,
                data: expect.objectContaining({
                    frameUrl: FRAME_URL,
                    // tldts getDomain returns the registrable domain
                    frameDomain: 'example.org',
                }),
            }));
        });

        it('falls back to sender url when frame data is missing', async () => {
            getTabFrame.mockReturnValue(null);

            const result = await messagesApi.handleMessage(
                createMessage() as any,
                createSender(FRAME_ID, SENDER_URL),
            );

            expect(result).toBe(true);
            expect(publishEvent).toHaveBeenCalledWith(expect.objectContaining({
                type: FilteringEventType.ApplyCosmeticRule,
                data: expect.objectContaining({
                    frameUrl: SENDER_URL,
                    frameDomain: 'example.net',
                }),
            }));
        });

        it('falls back to tab url when frame data and sender url are missing', async () => {
            getTabFrame.mockReturnValue(null);

            const result = await messagesApi.handleMessage(
                createMessage() as any,
                createSender(FRAME_ID),
            );

            expect(result).toBe(true);
            expect(publishEvent).toHaveBeenCalledWith(expect.objectContaining({
                type: FilteringEventType.ApplyCosmeticRule,
                data: expect.objectContaining({
                    frameUrl: TAB_URL,
                    frameDomain: 'example.com',
                }),
            }));
        });
    });
});
