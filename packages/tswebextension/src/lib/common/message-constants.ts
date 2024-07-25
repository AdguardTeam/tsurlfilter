/**
 * @file
 * This file contains constants for communication between background and content scripts.
 * This constants are separated from message.ts to reduce bundle size,
 * because rollup cannot tree-shake tswebextension library code.
 */

/**
 * Name of the message handler.
 * It is needed for determining specific tswebextension message from other messages.
 */
export const MESSAGE_HANDLER_NAME = 'tsWebExtension' as const;

/**
 * Message types for communication between background and content scripts.
 */
export enum MessageType {
    ProcessShouldCollapse = 'processShouldCollapse',
    GetCosmeticData = 'getCosmeticData',
    GetCss = 'getCss',
    GetCookieRules = 'getCookieRules',
    SaveCookieLogEvent = 'saveCookieLogEvent',
    InitAssistant = 'initAssistant',
    CloseAssistant = 'closeAssistant',
    AssistantCreateRule = 'assistantCreateRule',
    SaveCssHitsStats = 'saveCssHitsStats',
}
