// Separate file for enum and const to reduce bundle size,
// because rollup cannot do tree-shaking with TypeScript

export const MESSAGE_HANDLER_NAME = 'tsWebExtension' as const;

export enum MessageType {
    PROCESS_SHOULD_COLLAPSE = 'PROCESS_SHOULD_COLLAPSE',
    GET_EXTENDED_CSS = 'GET_EXTENDED_CSS',
    GET_CSS = 'GET_CSS',
    GET_COOKIE_RULES = 'GET_COOKIE_RULES',
    SAVE_COOKIE_LOG_EVENT = 'SAVE_COOKIE_LOG_EVENT',
    INIT_ASSISTANT = 'INIT_ASSISTANT',
    CLOSE_ASSISTANT = 'CLOSE_ASSISTANT',
    ASSISTANT_CREATE_RULE = 'ASSISTANT_CREATE_RULE',
}
