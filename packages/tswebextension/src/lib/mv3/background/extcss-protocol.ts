import { CSS_HITS_MARKER_PREFIX } from '../../common/constants';
import { EXTCSS_REMOVED_ELEMENTS_KEY } from '../../common/content-script/extcss-removed-elements';
import { MESSAGE_HANDLER_NAME, MessageType } from '../../common/message-constants';

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
     * `window` key under which the injected function records the elements it
     * removed with a `:remove()` rule, so the content-script CSS-hits counter
     * does not put them back into the page as probes.
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
 * Canonical {@link ExtCssProtocol} values passed by `ScriptingApi` as
 * serialized `executeScript` arguments.
 *
 * This module is MV3-internal on purpose: it is not re-exported from the
 * `common` barrel, so the published package does not expose an injection
 * protocol that consumers could start to depend on. Import it directly from
 * the MV3 background modules that need it.
 */
export const EXTCSS_PROTOCOL: ExtCssProtocol = {
    markerPrefix: CSS_HITS_MARKER_PREFIX,
    handlerName: MESSAGE_HANDLER_NAME,
    messageType: MessageType.SaveCssHitsStats,
    instanceKey: EXTCSS_INSTANCE_KEY,
    removedElementsKey: EXTCSS_REMOVED_ELEMENTS_KEY,
};
