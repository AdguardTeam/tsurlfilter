import { extCssInjectedApply, extCssInjectedDispose } from '../../common/extcss-apply-fn';
import { type ExtCssProtocol } from '../../common/message-constants';

/**
 * Replaces raw U+2028 and U+2029 line separators in JSON text with their
 * escape sequences.
 *
 * `JSON.stringify` does not escape these characters, but JavaScript parsers
 * treat them as line terminators. Escaping them keeps the serialized code
 * string valid on every supported engine.
 *
 * @param json JSON text to escape.
 *
 * @returns JSON text with U+2028 and U+2029 escaped.
 */
const escapeLineSeparators = (json: string): string => json
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');

/**
 * Serialized source of the shared apply payload.
 *
 * `String(extCssInjectedApply)` re-serializes the inlined engine, and MV2
 * builds a code string for every cosmetic injection event and for each
 * injection retry. The function source never changes, so it is serialized
 * once here.
 */
const EXTCSS_APPLY_SOURCE = String(extCssInjectedApply);

/**
 * Serialized source of the shared dispose payload.
 *
 * @see {@link EXTCSS_APPLY_SOURCE}
 */
const EXTCSS_DISPOSE_SOURCE = String(extCssInjectedDispose);

/**
 * Serializes the shared ExtendedCSS apply payload into a JavaScript code
 * string for `browser.tabs.executeScript({ code })` in MV2.
 *
 * The code is `(<function source>)(<rules JSON>, <boolean>, <protocol JSON>);`.
 * The browser's own `executeScript` parser evaluates the string in the
 * frame's isolated world; product code does not evaluate it.
 *
 * @param cssRules ExtendedCSS rule strings to apply.
 * @param collectStats Whether to collect CSS hits statistics.
 * @param protocol Serialized protocol values (see `EXTCSS_PROTOCOL`).
 *
 * @returns The apply code string.
 */
export const serializeExtCssForCode = (
    cssRules: string[],
    collectStats: boolean,
    protocol: ExtCssProtocol,
): string => {
    const rulesJson = escapeLineSeparators(JSON.stringify(cssRules));
    const protocolJson = escapeLineSeparators(JSON.stringify(protocol));

    return `(${EXTCSS_APPLY_SOURCE})(${rulesJson}, ${collectStats}, ${protocolJson});`;
};

/**
 * Serializes the shared ExtendedCSS dispose payload into a JavaScript code
 * string for `browser.tabs.executeScript({ code })` in MV2.
 *
 * The code is `(<function source>)(<protocol JSON>);`.
 *
 * @param protocol Serialized protocol values (see `EXTCSS_PROTOCOL`).
 *
 * @returns The dispose code string.
 */
export const serializeExtCssDisposeForCode = (protocol: ExtCssProtocol): string => {
    const protocolJson = escapeLineSeparators(JSON.stringify(protocol));

    return `(${EXTCSS_DISPOSE_SOURCE})(${protocolJson});`;
};
