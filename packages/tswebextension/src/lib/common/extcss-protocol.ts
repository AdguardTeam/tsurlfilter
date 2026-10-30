/**
 * @file
 * Literal values crossing the ExtendedCSS injection boundary.
 *
 * Kept out of the `common` barrel (`common/index.ts`) on purpose: the values
 * are an implementation detail of the injected payload and its handover to the
 * content script, not part of the package API.
 */

import { CSS_HITS_MARKER_PREFIX } from './constants';
import { MESSAGE_HANDLER_NAME, MessageType } from './message-constants';

/**
 * Literal values crossing the `chrome.scripting.executeScript({ func, args })`
 * injection boundary into the self-contained ExtendedCss function
 * (`extCssInjectedApply`).
 *
 * The injected function is serialized via `toString()` and re-evaluated in
 * the page's ISOLATED world, so it MUST NOT reference module-scope
 * identifiers: every literal it needs arrives inside this plain,
 * JSON-serializable argument object. This keeps the shared constants below
 * the single source of truth — no duplicated protocol literals in the
 * injected function sources. The fields are typed with the shared literal
 * types, so a typo in {@link EXTCSS_PROTOCOL} fails the type check instead of
 * the runtime message validation.
 */
export type ExtCssProtocol = {
    /**
     * CSS hits marker value prefix read from rule `content` declarations.
     */
    markerPrefix: typeof CSS_HITS_MARKER_PREFIX;

    /**
     * Message handler name used when reporting CSS hits to the background.
     */
    handlerName: typeof MESSAGE_HANDLER_NAME;

    /**
     * Message type used when reporting CSS hits to the background.
     */
    messageType: typeof MessageType.SaveCssHitsStats;

    /**
     * `window` key under which the applied ExtendedCss instance is retained
     * between injections so it can be disposed before a re-apply.
     */
    instanceKey: typeof EXTCSS_INSTANCE_KEY;

    /**
     * `window` key under which the injected function keeps the set of nodes it
     * removed from the page for `:remove()` rules. The content script reads the
     * same set, so its forced-probe pass never puts such a node back.
     */
    removedElementsKey: typeof EXTCSS_REMOVED_ELEMENTS_KEY;
};

/**
 * Canonical `window` key under which the injected function retains the applied
 * ExtendedCss instance. Typed as a literal so a typo in
 * {@link EXTCSS_PROTOCOL} fails the type check.
 */
const EXTCSS_INSTANCE_KEY = '__adguardExtCss' as const;

/**
 * Canonical `window` key under which the injected function keeps the set of
 * nodes it removed for `:remove()` rules. Typed as a literal so a typo in
 * {@link EXTCSS_PROTOCOL} fails the type check.
 */
const EXTCSS_REMOVED_ELEMENTS_KEY = '__adguardExtCssRemovedElements' as const;

/**
 * Canonical {@link ExtCssProtocol} values passed by `ScriptingApi` as
 * serialized `executeScript` arguments.
 */
export const EXTCSS_PROTOCOL: ExtCssProtocol = {
    markerPrefix: CSS_HITS_MARKER_PREFIX,
    handlerName: MESSAGE_HANDLER_NAME,
    messageType: MessageType.SaveCssHitsStats,
    instanceKey: EXTCSS_INSTANCE_KEY,
    removedElementsKey: EXTCSS_REMOVED_ELEMENTS_KEY,
};
