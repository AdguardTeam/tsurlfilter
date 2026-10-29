/**
 * @vitest-environment jsdom
 */

import browser from 'sinon-chrome';
import {
    afterEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { CollectHitStatsListener } from '../../../../src/lib/common/content-script/collect-hit-stats';
import * as SendMessageModule from '../../../../src/lib/common/content-script/send-app-message';
import { MESSAGE_HANDLER_NAME, MessageType } from '../../../../src/lib/common/message-constants';

describe('CollectHitStatsListener', () => {
    afterEach(() => {
        // Remove listeners registered by the test.
        // eslint-disable-next-line no-underscore-dangle
        (browser.runtime.onMessage as unknown as { _listeners: unknown[] })._listeners = [];
        vi.restoreAllMocks();
    });

    it('applies collect hit stats messages', () => {
        const onChange = vi.fn();
        CollectHitStatsListener.listen(onChange);

        browser.runtime.onMessage.trigger({
            handlerName: MESSAGE_HANDLER_NAME,
            type: MessageType.SetCollectHitStats,
            payload: { isCollectStats: false },
        });

        expect(onChange).toHaveBeenCalledWith(false);
    });

    it('re-syncs the state after a bfcache restore', async () => {
        const onChange = vi.fn();
        const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
        const sendAppMessageSpy = vi.spyOn(SendMessageModule, 'sendAppMessage')
            .mockResolvedValue(false);

        CollectHitStatsListener.listen(onChange);

        const pageshowListener = addEventListenerSpy.mock.calls
            .find(([type]) => type === 'pageshow')?.[1] as EventListener;

        const event = new Event('pageshow') as Event & { persisted: boolean };
        event.persisted = true;
        pageshowListener(event);

        await new Promise((resolve) => {
            setTimeout(resolve, 0);
        });

        expect(sendAppMessageSpy).toHaveBeenCalledWith({
            type: MessageType.GetCollectHitStats,
            payload: null,
        });
        expect(onChange).toHaveBeenCalledWith(false);
    });

    it('ignores a sync response older than a received message', async () => {
        const onChange = vi.fn();
        const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

        let resolveSync!: (value: boolean) => void;
        const syncPromise = new Promise<boolean>((resolve) => {
            resolveSync = resolve;
        });

        vi.spyOn(SendMessageModule, 'sendAppMessage').mockReturnValue(syncPromise);

        CollectHitStatsListener.listen(onChange);

        const pageshowListener = addEventListenerSpy.mock.calls
            .find(([type]) => type === 'pageshow')?.[1] as EventListener;

        const event = new Event('pageshow') as Event & { persisted: boolean };
        event.persisted = true;
        pageshowListener(event);

        // A newer state arrives while the sync request is still in flight.
        browser.runtime.onMessage.trigger({
            handlerName: MESSAGE_HANDLER_NAME,
            type: MessageType.SetCollectHitStats,
            payload: { isCollectStats: true },
        });

        resolveSync(false);

        await new Promise((resolve) => {
            setTimeout(resolve, 0);
        });

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith(true);
    });
});
