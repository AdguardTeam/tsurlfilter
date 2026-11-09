import browser, { type Tabs } from 'webextension-polyfill';

import { type NetworkRule } from '@adguard/tsurlfilter';

import { MESSAGE_HANDLER_NAME, MessageType } from './message-constants';
import { logger } from './utils/logger';

/**
 * Message that changes the hit stats collection state.
 */
export type SetCollectHitStatsMessage = {
    handlerName: typeof MESSAGE_HANDLER_NAME;
    type: MessageType.SetCollectHitStats;
    payload: {
        isCollectStats: boolean;
    };
};

/**
 * Returns whether CSS hits must be collected for a document.
 *
 * The setting can be enabled globally, but allowlisted documents opt out.
 *
 * @param collectStats Global `collectStats` setting value.
 * @param mainFrameRule Document-level rule for the tab, if known.
 *
 * @returns True if hits must be collected.
 */
export function isCollectStatsEnabledForDocument(
    collectStats: boolean | undefined,
    mainFrameRule: NetworkRule | null | undefined,
): boolean {
    return !!collectStats && !mainFrameRule?.isFilteringDisabled();
}

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
     * @param resolveForTab Optional resolver of the effective state for a tab,
     * e.g. to disable collection on allowlisted pages.
     *
     * @returns Promise resolved when the notifications have been queued.
     */
    public static notify(
        isCollectStats: boolean,
        resolveForTab?: (tabId: number) => boolean,
    ): Promise<void> {
        CollectHitStatsNotifier.pending = CollectHitStatsNotifier.pending
            .then(() => CollectHitStatsNotifier.send(isCollectStats, resolveForTab))
            .catch((e) => {
                logger.debug('[tsweb.CollectHitStatsNotifier.notify]: cannot notify content scripts: ', e);
            });

        return CollectHitStatsNotifier.pending;
    }

    /**
     * Sends the current hit stats collection state to every frame of every tab.
     *
     * Delivery is not awaited: the content-script listener returns nothing, and
     * a frozen renderer must not block later notifications.
     *
     * @param isCollectStats Whether CSS hits must be collected.
     * @param resolveForTab Optional resolver of the effective state for a tab.
     */
    private static async send(
        isCollectStats: boolean,
        resolveForTab?: (tabId: number) => boolean,
    ): Promise<void> {
        const tabs: Tabs.Tab[] = await browser.tabs.query({});

        tabs.forEach((tab) => {
            if (typeof tab.id !== 'number') {
                return;
            }

            const effectiveCollectStats = resolveForTab
                ? resolveForTab(tab.id)
                : isCollectStats;

            const message: SetCollectHitStatsMessage = {
                handlerName: MESSAGE_HANDLER_NAME,
                type: MessageType.SetCollectHitStats,
                payload: { isCollectStats: effectiveCollectStats },
            };

            browser.tabs.sendMessage(tab.id, message).catch(() => {
                // Tabs without content scripts reject the message.
            });
        });
    }
}
