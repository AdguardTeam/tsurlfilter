/* eslint-disable import/order, import/first */
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

// Mock sendAppMessage before importing initRemoveParam
const { mockSendAppMessage } = vi.hoisted(() => ({
    mockSendAppMessage: vi.fn(),
}));
vi.mock('../../../../src/lib/common/content-script/send-app-message', () => ({
    sendAppMessage: mockSendAppMessage,
}));

// These imports must come after vi.mock() to ensure the mock is applied.
import { MessageType } from '../../../../src/lib/common/message-constants';
import { initRemoveParam } from '../../../../src/lib/common/content-script/remove-param-handler';
import {
    REMOVEPARAM_CONFIG_TYPE,
    REMOVEPARAM_LOG_TYPE,
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

describe('initRemoveParam', () => {
    let postMessageSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        mockSendAppMessage.mockReset();
        postMessageSpy = vi.spyOn(window, 'postMessage');
    });

    afterEach(() => {
        postMessageSpy.mockRestore();
    });

    it('fetches rules from background on init and posts config to main world', async () => {
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
        mockSendAppMessage.mockResolvedValue(descriptors);
        initRemoveParam();

        // Wait for the async init to complete
        await new Promise((resolve) => { setTimeout(resolve, 50); });

        expect(mockSendAppMessage).toHaveBeenCalledWith({
            type: MessageType.GetRemoveParamRules,
            payload: { documentUrl: document.location.href },
        });

        expect(postMessageSpy).toHaveBeenCalledWith(
            {
                type: REMOVEPARAM_CONFIG_TYPE,
                descriptors,
            },
            '*',
        );
    });

    it('posts empty config when background returns null', async () => {
        mockSendAppMessage.mockResolvedValue(null);
        initRemoveParam();

        await new Promise((resolve) => { setTimeout(resolve, 50); });

        expect(postMessageSpy).toHaveBeenCalledWith(
            {
                type: REMOVEPARAM_CONFIG_TYPE,
                descriptors: [],
            },
            '*',
        );
    });

    it('posts empty config when background rejects', async () => {
        mockSendAppMessage.mockRejectedValue(new Error('channel broken'));
        initRemoveParam();

        await new Promise((resolve) => { setTimeout(resolve, 50); });

        expect(postMessageSpy).toHaveBeenCalledWith(
            {
                type: REMOVEPARAM_CONFIG_TYPE,
                descriptors: [],
            },
            '*',
        );
    });

    it('forwards log events from main world to background', async () => {
        mockSendAppMessage.mockResolvedValue([]);
        initRemoveParam();

        await new Promise((resolve) => { setTimeout(resolve, 50); });

        // Reset to track only log messages
        mockSendAppMessage.mockReset();
        mockSendAppMessage.mockResolvedValue(undefined);

        const appliedDescriptors = [
            {
                filterId: 1,
                ruleIndex: 0,
                ruleText: '||example.com^$removeparam=utm_source',
                isAllowlist: false,
                isImportant: false,
                advancedModifier: 'utm_source',
            },
        ];

        await postAndWait({
            type: REMOVEPARAM_LOG_TYPE,
            originalUrl: 'https://example.com/page?utm_source=test',
            appliedDescriptors,
        });

        expect(mockSendAppMessage).toHaveBeenCalledWith({
            type: MessageType.LogRemoveParamEvent,
            payload: {
                url: 'https://example.com/page?utm_source=test',
                appliedDescriptors,
            },
        });
    });

    it('ignores log events with invalid data', async () => {
        mockSendAppMessage.mockResolvedValue([]);
        initRemoveParam();

        await new Promise((resolve) => { setTimeout(resolve, 50); });

        mockSendAppMessage.mockReset();

        // Missing appliedDescriptors
        await postAndWait({
            type: REMOVEPARAM_LOG_TYPE,
            originalUrl: 'https://example.com/page',
        });

        expect(mockSendAppMessage).not.toHaveBeenCalled();
    });

    it('ignores messages with unrelated type', async () => {
        mockSendAppMessage.mockResolvedValue([]);
        initRemoveParam();

        await new Promise((resolve) => { setTimeout(resolve, 50); });

        mockSendAppMessage.mockReset();

        await postAndWait({ type: 'some-other-type' });

        expect(mockSendAppMessage).not.toHaveBeenCalled();
    });
});
