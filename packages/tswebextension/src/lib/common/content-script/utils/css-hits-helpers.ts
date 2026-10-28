import { type IAffectedElement } from '@adguard/extended-css';

import { type RuleInfoBasic } from '../../rule-info';

/**
 * A CSS hit collected from an ExtendedCSS affected element.
 */
export type ExtendedCssHit = RuleInfoBasic & {
    /**
     * Serialized element, or the element itself when serialization is off.
     */
    element: string | Element;
};

/**
 * Shared CSS-hits parser, element serializer and hit collector.
 *
 * Used by:
 * - MV2 content-script `ElementUtils` and `CssHitsCounter` (runtime import —
 *   regular ESM).
 * - MV3 background-injected `extCssInjectedApply` (build-time inlined via the
 *   `inlineCssHitsHelpers` Rollup plugin; see
 *   `tasks/inline-css-hits-helpers.ts`).
 *
 * This module MUST NOT have any runtime-side-effect imports. The only imports
 * (`RuleInfoBasic`, `IAffectedElement`) are type-only imports that are erased
 * by the compiler. The transpiled output is a set of standalone function
 * declarations plus a `cssHitsHelpers` object — fully self-contained with no
 * free identifiers.
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

    let filterIdAndRuleText: string;
    try {
        filterIdAndRuleText = decodeURIComponent(content);
    } catch {
        // A malformed percent-escape must not break cosmetic application:
        // treat such content as non-matching. This guard covers both paths that
        // use the helper — MV2's `ElementUtils` (runtime import) and MV3's
        // background-injected `extCssInjectedApply` (build-time inlined) — so
        // MV2 no longer propagates `URIError` from `decodeURIComponent` here.
        return null;
    }
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
 * Registers a hit for a node and reports whether it was registered before.
 *
 * Each node/rule pair is reported once, like the native CSS hits counter does.
 *
 * @param node Affected node, if any.
 * @param hitKey Rule key in the `filterId;ruleIndex` form.
 * @param countedHits Per-node reported hits.
 *
 * @returns True when the node and rule pair was already reported.
 */
function registerHit(
    node: Element | undefined,
    hitKey: string,
    countedHits: WeakMap<Element, Set<string>>,
): boolean {
    if (!node) {
        return false;
    }

    const counted = countedHits.get(node);

    if (!counted) {
        countedHits.set(node, new Set([hitKey]));
        return false;
    }

    if (counted.has(hitKey)) {
        return true;
    }

    counted.add(hitKey);

    return false;
}

/**
 * Collects the CSS hits of an ExtendedCSS affected element: reads the hits
 * marker from every matched rule's `content`, strips the marker from the copy
 * of the rule that is applied to this node, and returns the collected hits.
 *
 * Shared by the MV2 `CssHitsCounter.countAffectedByExtendedCss` callback and
 * the MV3 injected `beforeStyleApplied` callback, so both report hits the same
 * way. The marker is stripped per element, not on the shared parsed rule, so
 * every element matched by a rule is reported instead of only the first one.
 *
 * @param affectedEl Affected element from ExtendedCss.
 * @param attributeMarker Marker prefix (e.g. `'adguard'`).
 * @param serializeElement Whether to serialize the affected node with
 * {@link elementToString}. When false, the node itself is reported.
 * @param countedHits Per-node reported hits, kept by the caller: the MV2
 * `CssHitsCounter` or the MV3 injected instance. A re-apply reports only the
 * hits that are new, and two counters in one document never share the state.
 *
 * @returns Collected hits.
 */
function collectExtendedCssHits(
    affectedEl: IAffectedElement,
    attributeMarker: string,
    serializeElement: boolean,
    countedHits: WeakMap<Element, Set<string>>,
): ExtendedCssHit[] {
    const hits: ExtendedCssHit[] = [];

    if (!affectedEl || !affectedEl.rules) {
        return hits;
    }

    const { rules, node } = affectedEl;

    for (let i = 0; i < rules.length; i += 1) {
        const rule = rules[i];

        if (!rule || !rule.style) {
            continue;
        }

        const { style } = rule;
        const { content } = style;
        if (!content || content.indexOf(attributeMarker) < 0) {
            continue;
        }

        const ruleInfo = parseExtendedStyleInfo(content, attributeMarker);
        if (!ruleInfo) {
            // The content only mentions the marker without being one — e.g.
            // `content: attr(data-adguard)` — so it must reach the node as is.
            continue;
        }

        // Replace the rule in the element's own rules array with a copy that
        // has the marker stripped: the marker must never be painted on the
        // node, while the shared parsed rule keeps it for the other elements.
        rules[i] = { ...rule, style: { ...style, content: '' } };

        const { filterId, ruleIndex } = ruleInfo;

        if (registerHit(node, `${filterId};${ruleIndex}`, countedHits)) {
            continue;
        }

        let element: string | Element = node;

        if (serializeElement) {
            // Fall back to a static tag when the node is missing, so a hit is
            // still reported instead of failing the whole cosmetic pass.
            element = node ? elementToString(node) : '<div>';
        }

        hits.push({ filterId, ruleIndex, element });
    }

    return hits;
}

/**
 * Shared CSS-hits helpers object.
 *
 * Exported for MV2 runtime import. For MV3, the entire module body (all
 * function declarations plus this object literal) is transpiled to plain
 * JavaScript and inlined inside `extCssInjectedApply` by the
 * `inlineCssHitsHelpers` Rollup plugin.
 */
const cssHitsHelpers = {
    parseInfo,
    parseExtendedStyleInfo,
    elementToString,
    collectExtendedCssHits,
};

export { cssHitsHelpers };
