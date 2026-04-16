/**
 * @file Contains simple type guards to prevent bundle zod library, because
 * content-script should be as tiny as possible to fastest injection.
 */

import { type Message } from '../../message';
import { MESSAGE_HANDLER_NAME } from '../../message-constants';

/**
 * Base assistant message for open and close.
 */
type AssistantMessage = {
    handlerName: Message['handlerName'];
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

/**
 * Checks if the given message has a 'handlerName' field matching {@link MESSAGE_HANDLER_NAME}.
 *
 * @param message The message to check.
 *
 * @returns `true` if the message has the expected handlerName, otherwise `false`.
 */
export const isAssistantMessage = (message: unknown): message is AssistantMessage => {
    return typeof message === 'object'
        && message !== null
        && 'handlerName' in message
        && message.handlerName === MESSAGE_HANDLER_NAME;
};
