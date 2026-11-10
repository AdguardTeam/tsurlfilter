/**
 * @file
 * Literal values crossing the ExtendedCSS injection boundary.
 *
 * Kept out of the `common` barrel (`common/index.ts`) on purpose: the values
 * are an implementation detail of the injected payload and its handover to the
 * content script, so the published package does not expose an injection
 * protocol that consumers could start to depend on. Import it directly from the
 * background modules that need it.
 */

import { CSS_HITS_MARKER_PREFIX } from './constants';
import { EXTCSS_REMOVED_ELEMENTS_KEY } from './content-script/extcss-removed-elements';
import { type cssHitsHelpers as cssHitsHelpersImpl } from './content-script/utils/css-hits-helpers';
import type applyExtendedCssImpl from './extcss-inject-src';
import { MESSAGE_HANDLER_NAME, MessageType } from './message-constants';

/**
 * `window` key under which the prebuilt ExtendedCss script asset installs the
 * engine, so the injected apply function can reach it without carrying the
 * engine source itself. Typed as a literal so a typo in
 * {@link EXTCSS_PROTOCOL} or in the asset entry fails the type check.
 */
export const EXTCSS_ENGINE_KEY = '__adguardExtCssEngine' as const;

/**
 * Engine payload installed by the prebuilt `extcss-inject.js` script asset and
 * read by the injected apply function from the document's ISOLATED world.
 */
export type ExtCssEngine = {
    /**
     * Applies rule strings to the current document and returns the retained
     * instance.
     */
    applyExtendedCss: typeof applyExtendedCssImpl;

    /**
     * CSS-hits helpers used by the `beforeStyleApplied` callback.
     */
    cssHitsHelpers: typeof cssHitsHelpersImpl;
};

declare global {
    interface Window {
        /**
         * ExtendedCss engine installed by the prebuilt `extcss-inject.js`
         * script asset. Absent until the background injects that asset into the
         * document.
         */
        [EXTCSS_ENGINE_KEY]?: ExtCssEngine;
    }
}

/**
 * Literal values crossing the ExtendedCSS injection boundaries into the
 * self-contained ExtendedCss function (`extCssInjectedApply`): the MV3
 * `chrome.scripting.executeScript({ func, args })` arguments and the JSON
 * argument embedded in the MV2 `browser.tabs.executeScript({ code })` string.
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
     * `window` key under which the injected function records the elements it
     * removed with a `:remove()` rule, so the content-script CSS-hits counter
     * does not put them back into the page as probes.
     */
    removedElementsKey: typeof EXTCSS_REMOVED_ELEMENTS_KEY;

    /**
     * `window` key under which the prebuilt ExtendedCss script asset installs
     * the engine, so the injected function can apply rules without carrying
     * the engine source.
     */
    engineKey: typeof EXTCSS_ENGINE_KEY;
};

/**
 * Canonical `window` key under which the injected function retains the applied
 * ExtendedCss instance. Typed as a literal so a typo in
 * {@link EXTCSS_PROTOCOL} fails the type check.
 */
const EXTCSS_INSTANCE_KEY = '__adguardExtCss' as const;

/**
 * Canonical {@link ExtCssProtocol} values passed by `ScriptingApi` as
 * `executeScript` arguments and serialized into the MV2 code string.
 */
export const EXTCSS_PROTOCOL: ExtCssProtocol = {
    markerPrefix: CSS_HITS_MARKER_PREFIX,
    handlerName: MESSAGE_HANDLER_NAME,
    messageType: MessageType.SaveCssHitsStats,
    instanceKey: EXTCSS_INSTANCE_KEY,
    removedElementsKey: EXTCSS_REMOVED_ELEMENTS_KEY,
    engineKey: EXTCSS_ENGINE_KEY,
};
