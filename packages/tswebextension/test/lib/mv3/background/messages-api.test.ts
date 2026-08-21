import {
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { FilteringEventType } from '../../../../src/lib/common/filtering-log';
import { MESSAGE_HANDLER_NAME, MessageType } from '../../../../src/lib/common/message-constants';
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
    },
}));

vi.mock('../../../../src/lib/mv3/background/assistant', () => ({
    Assistant: {
        onCreateRule: { dispatch: vi.fn() },
    },
}));

vi.mock('../../../../src/lib/mv3/background/cosmetic-api', () => ({
    CosmeticApi: {},
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
