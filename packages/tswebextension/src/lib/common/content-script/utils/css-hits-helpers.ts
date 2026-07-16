import { type RuleInfoBasic } from '../../rule-info';

/**
 * Shared CSS-hits parser and element serializer.
 *
 * Used by:
 * - MV2 content-script `ElementUtils` (runtime import — regular ESM).
 * - MV3 background-injected `applyExtCss` (build-time inlined via the
 *   `inlineCssHitsHelpers` Rollup plugin; see
 *   `tasks/inline-css-hits-helpers.ts`).
 *
 * This module MUST NOT have any runtime-side-effect imports. The only import
 * (`RuleInfoBasic`) is a type-only import that is erased by the compiler. The
 * transpiled output is a set of standalone function declarations plus a
 * `cssHitsHelpers` object — fully self-contained with no free identifiers.
 *
 * The round-trip contract is pinned by
 * `test/lib/mv3/background/css-hits-protocol.test.ts`, which asserts identical
 * output between the MV2 `ElementUtils` path and the MV3 inlined path.
 */

/**
 * Removes surrounding single or double quotes from a value.
 *
 * @param value Value to unquote.
 *
 * @returns Unquoted value.
 */
function removeQuotes(value: string): string {
    if (value.length > 1
        && ((value[0] === '"' && value[value.length - 1] === '"')
            || (value[0] === '\'' && value[value.length - 1] === '\''))) {
        return value.substring(1, value.length - 1);
    }

    return value;
}

/**
 * Parses hits info from style content.
 *
 * Expects content in the form `adguard{filterId};{ruleIndex}` possibly wrapped
 * in quotes and URI-encoded (`;` → `%3B`).
 *
 * @param content Style content.
 * @param attributeMarker Attribute marker (e.g. `'adguard'`).
 *
 * @returns Rule info or `null` if the content does not match.
 */
function parseInfo(content: string, attributeMarker: string): RuleInfoBasic | null {
    if (!content || content.indexOf(attributeMarker) < 0) {
        return null;
    }

    let filterIdAndRuleText = decodeURIComponent(content);
    // 'content' value may include open and close quotes.
    filterIdAndRuleText = removeQuotes(filterIdAndRuleText);
    // Remove prefix.
    filterIdAndRuleText = filterIdAndRuleText.substring(attributeMarker.length);
    // Attribute 'content' in css looks like: {content: 'adguard{filterId};{ruleIndex}'}
    const index = filterIdAndRuleText.indexOf(';');
    if (index < 0) {
        return null;
    }

    const filterId = Number.parseInt(filterIdAndRuleText.slice(0, index), 10);
    if (Number.isNaN(filterId)) {
        return null;
    }

    const ruleIndex = Number.parseInt(filterIdAndRuleText.slice(index + 1), 10);
    if (Number.isNaN(ruleIndex)) {
        return null;
    }

    return { filterId, ruleIndex };
}

/**
 * Parses hits info from extended-style content, stripping a trailing
 * `!important` suffix first before delegating to {@link parseInfo}.
 *
 * @param content Style content.
 * @param attributeMarker Attribute marker (e.g. `'adguard'`).
 *
 * @returns Rule info or `null` if the content does not match.
 */
function parseExtendedStyleInfo(
    content: string,
    attributeMarker: string,
): RuleInfoBasic | null {
    const important = '!important';
    const indexOfImportant = content.lastIndexOf(important);
    if (indexOfImportant === -1) {
        return parseInfo(content, attributeMarker);
    }

    const contentWithoutImportant = content.substring(0, indexOfImportant).trim();
    return parseInfo(contentWithoutImportant, attributeMarker);
}

/**
 * Serializes an HTML element to a compact string.
 *
 * Produces `<tagname attr="value" ...>` with a single trailing `>` (no
 * closing tag, no self-closing slash).
 *
 * @param element Element to serialize.
 *
 * @returns String representation of the element.
 */
function elementToString(element: Element): string {
    const s: string[] = [];

    s.push('<');
    s.push(element.localName);
    const { attributes } = element;
    for (let i = 0; i < attributes.length; i += 1) {
        const attr = attributes[i];
        s.push(' ');
        s.push(attr.name);
        s.push('="');
        const value = attr.value === null ? '' : attr.value.replace(/"/g, '\\"');
        s.push(value);
        s.push('"');
    }
    s.push('>');

    return s.join('');
}

/**
 * Shared CSS-hits helpers object.
 *
 * Exported for MV2 runtime import. For MV3, the entire module body (all
 * function declarations plus this object literal) is transpiled to plain
 * JavaScript and inlined inside `applyExtCss` by the
 * `inlineCssHitsHelpers` Rollup plugin.
 */
const cssHitsHelpers = {
    parseInfo,
    parseExtendedStyleInfo,
    elementToString,
};

export { cssHitsHelpers };
