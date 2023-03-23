// Separate file for enum and const to reduce bundle size,
// because rollup cannot do tree-shaking with TypeScript

export const MESSAGE_HANDLER_NAME = 'tsWebExtension' as const;

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
