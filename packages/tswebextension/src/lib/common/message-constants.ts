/**
 * @file
 * This file contains constants for communication between background and content scripts.
 * This constants are separated from message.ts to reduce bundle size,
 * because rollup cannot tree-shake tswebextension library code.
 */

import { CSS_HITS_MARKER_PREFIX } from './constants';

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
    GetCookieRules = 'getCookieRules',
    SaveCookieLogEvent = 'saveCookieLogEvent',
    InitAssistant = 'initAssistant',
    CloseAssistant = 'closeAssistant',
    AssistantCreateRule = 'assistantCreateRule',
    SaveCssHitsStats = 'saveCssHitsStats',
}

/**
 * Literal values crossing the `chrome.scripting.executeScript({ func, args })`
 * injection boundary into the self-contained ExtendedCss functions
 * (`applyExtCss` / `disposeExtCss`).
 *
 * The injected functions are serialized via `toString()` and re-evaluated in
 * the page's ISOLATED world, so they MUST NOT reference module-scope
 * identifiers: every literal they need arrives inside this plain,
 * JSON-serializable argument object. This keeps the shared constants below
 * the single source of truth — no duplicated protocol literals in the
 * injected function sources.
 */
export type ExtCssProtocol = {
    /**
     * CSS hits marker value prefix read from rule `content` declarations.
     */
    markerPrefix: string;

    /**
     * Message handler name used when reporting CSS hits to the background.
     */
    handlerName: string;

    /**
     * Message type used when reporting CSS hits to the background.
     */
    messageType: string;

    /**
     * `window` key under which the applied ExtendedCss instance is retained
     * between injections so it can be disposed on re-injection or on
     * transition to an empty rule set.
     */
    instanceKey: string;
};

/**
 * Canonical {@link ExtCssProtocol} values passed by `ScriptingApi` as
 * serialized `executeScript` arguments.
 */
export const EXTCSS_PROTOCOL: ExtCssProtocol = {
    markerPrefix: CSS_HITS_MARKER_PREFIX,
    handlerName: MESSAGE_HANDLER_NAME,
    messageType: MessageType.SaveCssHitsStats,
    // eslint-disable-next-line no-underscore-dangle -- deliberate marker key
    instanceKey: '__adguardExtCss',
};
