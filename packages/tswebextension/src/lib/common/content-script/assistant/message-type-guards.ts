/**
 * @file Contains simple type guards to prevent bundle zod library, because
 * content-script should be as tiny as possible to fastest injection.
 */

import { type Message } from '../../message';

/**
 * Base assistant message for open and close.
 */
type AssistantMessage = {
    type: Message['type'];
};

/**
 * Checks if the given message has a 'type' field.
 *
 * @param message The message to check.
 *
 * @returns `true` if the message is an object with a 'type' field, otherwise `false`.
 */
export const hasTypeField = (message: unknown): message is AssistantMessage => {
    return typeof message === 'object' && message !== null && 'type' in message;
};
