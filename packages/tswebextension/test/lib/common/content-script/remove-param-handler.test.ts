/* eslint-disable import/order, import/first */
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

// Mock sendAppMessage before importing initRemoveParamBridge
const { mockSendAppMessage } = vi.hoisted(() => ({
    mockSendAppMessage: vi.fn(),
}));
vi.mock('../../../../src/lib/common/content-script/send-app-message', () => ({
    sendAppMessage: mockSendAppMessage,
}));

// These imports must come after vi.mock() to ensure the mock is applied.
import { MessageType } from '../../../../src/lib/common/message-constants';
import { initRemoveParamBridge } from '../../../../src/lib/common/content-script/remove-param-handler';
import {
    REMOVEPARAM_REQUEST_TYPE,
    REMOVEPARAM_RESPONSE_TYPE,
} from '../../../../src/lib/common/content-script/remove-param-main-world';
/* eslint-enable import/order, import/first */

/**
 * Dispatches a postMessage event and waits for the async handler to settle.
 *
 * @param data Message data to post.
 */
async function postAndWait(data: unknown): Promise<void> {
    window.postMessage(data, '*');
    // Yield to let the event listener and its async work run.
    await new Promise((resolve) => { setTimeout(resolve, 50); });
}

describe('initRemoveParamBridge', () => {
    let postMessageSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        mockSendAppMessage.mockReset();
        postMessageSpy = vi.spyOn(window, 'postMessage');
    });

    afterEach(() => {
        postMessageSpy.mockRestore();
    });

    it('adds a message event listener on init', () => {
        const addSpy = vi.spyOn(window, 'addEventListener');
        initRemoveParamBridge();
        expect(addSpy).toHaveBeenCalledWith('message', expect.any(Function));
        addSpy.mockRestore();
    });

    it('forwards request to background and posts response back', async () => {
        const cleanedUrl = 'https://example.com/page';
        mockSendAppMessage.mockResolvedValue(cleanedUrl);
        initRemoveParamBridge();

        await postAndWait({
            type: REMOVEPARAM_REQUEST_TYPE,
            url: 'https://example.com/page?utm_source=test',
            requestId: 1,
        });

        expect(mockSendAppMessage).toHaveBeenCalledWith({
            type: MessageType.GetRemoveParamUrl,
            payload: { url: 'https://example.com/page?utm_source=test' },
        });

        // The handler should have posted a response back.
        expect(postMessageSpy).toHaveBeenCalledWith(
            {
                type: REMOVEPARAM_RESPONSE_TYPE,
                cleanedUrl,
                requestId: 1,
            },
            '*',
        );
    });

    it('posts null cleanedUrl when background returns null', async () => {
        mockSendAppMessage.mockResolvedValue(null);
        initRemoveParamBridge();

        await postAndWait({
            type: REMOVEPARAM_REQUEST_TYPE,
            url: 'https://example.com/page?safe=1',
            requestId: 2,
        });

        expect(postMessageSpy).toHaveBeenCalledWith(
            {
                type: REMOVEPARAM_RESPONSE_TYPE,
                cleanedUrl: null,
                requestId: 2,
            },
            '*',
        );
    });

    it('ignores messages with unrelated type', async () => {
        initRemoveParamBridge();

        await postAndWait({ type: 'some-other-type', url: 'https://example.com' });

        expect(mockSendAppMessage).not.toHaveBeenCalled();
    });

    it('ignores messages without type', async () => {
        initRemoveParamBridge();

        await postAndWait({ url: 'https://example.com' });

        expect(mockSendAppMessage).not.toHaveBeenCalled();
    });

    it('ignores messages with non-string url', async () => {
        initRemoveParamBridge();

        await postAndWait({
            type: REMOVEPARAM_REQUEST_TYPE,
            url: 12345,
            requestId: 3,
        });

        expect(mockSendAppMessage).not.toHaveBeenCalled();
    });

    it('ignores messages with non-number requestId', async () => {
        initRemoveParamBridge();

        await postAndWait({
            type: REMOVEPARAM_REQUEST_TYPE,
            url: 'https://example.com/page?a=1',
            requestId: 'bad',
        });

        expect(mockSendAppMessage).not.toHaveBeenCalled();
    });

    it('silently handles sendAppMessage rejection', async () => {
        mockSendAppMessage.mockRejectedValue(new Error('channel broken'));
        initRemoveParamBridge();

        // Should not throw
        await postAndWait({
            type: REMOVEPARAM_REQUEST_TYPE,
            url: 'https://example.com/page?utm=1',
            requestId: 4,
        });

        expect(mockSendAppMessage).toHaveBeenCalled();
        // No response should be posted since the promise rejected.
        const responseCalls = postMessageSpy.mock.calls.filter(
            ([data]: [unknown]) => (data as Record<string, unknown>)?.type === REMOVEPARAM_RESPONSE_TYPE,
        );
        expect(responseCalls).toHaveLength(0);
    });
});
