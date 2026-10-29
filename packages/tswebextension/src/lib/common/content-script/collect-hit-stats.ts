/**
 * @file Contains the content script listener for hit stats collection
 * changes. It uses a simple type guard instead of zod to keep the content
 * script bundle small.
 */

import browser from 'webextension-polyfill';

import { MESSAGE_HANDLER_NAME, MessageType } from '../message-constants';

import { sendAppMessage } from './send-app-message';

/**
 * Message that changes the hit stats collection state.
 */
type SetCollectHitStatsMessage = {
    handlerName: typeof MESSAGE_HANDLER_NAME;
    type: MessageType.SetCollectHitStats;
    payload: {
        isCollectStats: boolean;
    };
};

/**
 * Checks whether a value is an object with the given property.
 *
 * @param value Value to check.
 * @param property Property name.
 *
 * @returns True if the value is an object and has the property.
 */
const hasProperty = (value: unknown, property: string): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null && property in value;
};

/**
 * Checks whether a message changes the hit stats collection state.
 *
 * @param message Message to check.
 *
 * @returns True if the message is a {@link MessageType.SetCollectHitStats}
 * message.
 */
const isSetCollectHitStatsMessage = (message: unknown): message is SetCollectHitStatsMessage => {
    if (!hasProperty(message, 'handlerName')
        || message.handlerName !== MESSAGE_HANDLER_NAME
        || !hasProperty(message, 'type')
        || message.type !== MessageType.SetCollectHitStats
        || !hasProperty(message, 'payload')
        || !hasProperty(message.payload, 'isCollectStats')) {
        return false;
    }

    return typeof message.payload.isCollectStats === 'boolean';
};

/**
 * Receives hit stats collection changes from the background and re-syncs the
 * state after a bfcache restore.
 */
export class CollectHitStatsListener {
    /**
     * Version of the applied state. Incremented on every received message.
     *
     * A sync response started before a message must not overwrite the newer
     * state from that message.
     */
    private static stateVersion = 0;

    /**
     * Subscribes to hit stats collection changes.
     *
     * @param onChange Callback receiving the current collection state.
     */
    public static listen(onChange: (isCollectStats: boolean) => void): void {
        browser.runtime.onMessage.addListener((message: unknown) => {
            if (isSetCollectHitStatsMessage(message)) {
                CollectHitStatsListener.stateVersion += 1;
                onChange(message.payload.isCollectStats);
            }
        });

        // A message sent while the page was in bfcache may be lost, so ask
        // the background for the current state after a restore.
        window.addEventListener('pageshow', (event) => {
            if (!event.persisted) {
                return;
            }

            CollectHitStatsListener.sync(onChange, CollectHitStatsListener.stateVersion);
        });
    }

    /**
     * Requests the current hit stats collection state from the background.
     *
     * @param onChange Callback receiving the current collection state.
     * @param version State version at the moment of the request.
     */
    private static async sync(
        onChange: (isCollectStats: boolean) => void,
        version: number,
    ): Promise<void> {
        try {
            const response = await sendAppMessage({
                type: MessageType.GetCollectHitStats,
                payload: null,
            });

            if (typeof response === 'boolean'
                && version === CollectHitStatsListener.stateVersion) {
                onChange(response);
            }
        } catch {
            // The background may be unavailable. Keep the current state.
        }
    }
}
