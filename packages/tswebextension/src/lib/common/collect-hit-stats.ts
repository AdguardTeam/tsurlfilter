import browser, { type Tabs } from 'webextension-polyfill';

import { MESSAGE_HANDLER_NAME, MessageType } from './message-constants';
import { logger } from './utils/logger';

/**
 * Notifies content scripts about changes of the `collectStats` setting.
 */
export class CollectHitStatsNotifier {
    /**
     * Queue that keeps notifications in call order.
     *
     * Without the queue two rapid changes could query tabs independently and
     * send their messages in the opposite order.
     */
    private static pending: Promise<void> = Promise.resolve();

    /**
     * Queues a notification with the current hit stats collection state.
     *
     * Tabs without content scripts reject the message. Such rejections are
     * expected and are ignored.
     *
     * @param isCollectStats Whether CSS hits must be collected.
     *
     * @returns Promise resolved when the notification is sent.
     */
    public static notify(isCollectStats: boolean): Promise<void> {
        CollectHitStatsNotifier.pending = CollectHitStatsNotifier.pending
            .then(() => CollectHitStatsNotifier.send(isCollectStats))
            .catch((e) => {
                logger.debug('[tsweb.CollectHitStatsNotifier.notify]: cannot notify content scripts: ', e);
            });

        return CollectHitStatsNotifier.pending;
    }

    /**
     * Sends the current hit stats collection state to every frame of every tab.
     *
     * @param isCollectStats Whether CSS hits must be collected.
     */
    private static async send(isCollectStats: boolean): Promise<void> {
        const tabs: Tabs.Tab[] = await browser.tabs.query({});

        const message = {
            handlerName: MESSAGE_HANDLER_NAME,
            type: MessageType.SetCollectHitStats,
            payload: { isCollectStats },
        };

        await Promise.all(tabs.map(async (tab) => {
            if (typeof tab.id !== 'number') {
                return;
            }

            try {
                await browser.tabs.sendMessage(tab.id, message);
            } catch {
                // Tabs without content scripts reject the message.
            }
        }));
    }
}
