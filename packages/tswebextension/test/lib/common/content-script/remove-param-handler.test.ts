/* eslint-disable import/order, import/first */
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

// Mock sendAppMessage before importing initRemoveParamLogRelay
const { mockSendAppMessage } = vi.hoisted(() => ({
    mockSendAppMessage: vi.fn(),
}));
vi.mock('../../../../src/lib/common/content-script/send-app-message', () => ({
    sendAppMessage: mockSendAppMessage,
}));

// These imports must come after vi.mock() to ensure the mock is applied.
import { MessageType } from '../../../../src/lib/common/message-constants';
import { initRemoveParamLogRelay } from '../../../../src/lib/common/content-script/remove-param-handler';
import {
    patchHistoryForRemoveParam,
    REMOVEPARAM_LOG_TYPE,
} from '../../../../src/lib/common/content-script/remove-param-main-world';
/* eslint-enable import/order, import/first */

/**
 * Dispatches a MessageEvent simulating a same-window postMessage and waits
 * for the async handler to settle.
 *
 * Note: jsdom does not set `event.source` on postMessage, so we dispatch
 * a synthetic MessageEvent with `source: window` to match production behavior.
 *
 * @param data Message data to post.
 */
async function postAndWait(data: unknown): Promise<void> {
    const event = new MessageEvent('message', { data, source: window });
    window.dispatchEvent(event);
    // Yield to let the event listener and its async work run.
    await new Promise((resolve) => { setTimeout(resolve, 50); });
}

describe('initRemoveParamLogRelay', () => {
    // Initialize once — the relay has an idempotency guard, so calling it
    // per-test would be a no-op after the first call anyway.
    initRemoveParamLogRelay();

    beforeEach(() => {
        mockSendAppMessage.mockReset();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('forwards log events from main world to background', async () => {
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
        mockSendAppMessage.mockResolvedValue(undefined);

        // Missing appliedDescriptors
        await postAndWait({
            type: REMOVEPARAM_LOG_TYPE,
            originalUrl: 'https://example.com/page',
        });

        expect(mockSendAppMessage).not.toHaveBeenCalled();
    });

    it('ignores messages with unrelated type', async () => {
        mockSendAppMessage.mockResolvedValue(undefined);

        await postAndWait({ type: 'some-other-type' });

        expect(mockSendAppMessage).not.toHaveBeenCalled();
    });
});

describe('REMOVEPARAM_LOG_TYPE consistency', () => {
    it('exported constant matches the local LOG_TYPE inside patchHistoryForRemoveParam', () => {
        // The main-world function uses a local `LOG_TYPE` constant that must
        // match the exported `REMOVEPARAM_LOG_TYPE` used by the isolated-world
        // relay. Extract the value from the serialized function body.
        const fnSource = patchHistoryForRemoveParam.toString();
        const match = fnSource.match(/const LOG_TYPE\s*(?::[^=]*)?\s*=\s*['"]([^'"]+)['"]/);
        expect(match).not.toBeNull();
        expect(match![1]).toBe(REMOVEPARAM_LOG_TYPE);
    });
});
