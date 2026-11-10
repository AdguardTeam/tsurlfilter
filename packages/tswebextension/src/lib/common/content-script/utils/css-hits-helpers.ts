import { type IAffectedElement } from '@adguard/extended-css';

import { type RuleInfoBasic } from '../../rule-info';

/**
 * A CSS hit collected from an ExtendedCss affected element.
 */
export type ExtendedCssHit = RuleInfoBasic & {
    /**
     * Serialized element, or the element itself when serialization is off.
     */
    element: string | Element;
};

/**
 * Shared CSS-hits parser, serializer and collector, used by MV2's
 * `ElementUtils`/`CssHitsCounter` and by the injected `extCssInjectedApply`.
 *
 * The injected function cannot import anything (it is serialized via
 * `toString()`), so the module is bundled into the prebuilt ExtendedCss script
 * asset and reached through the engine object the asset installs. Only
 * type-only imports are allowed here: a runtime import would be bundled into
 * the asset and could pull the whole library into the injected payload.
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
        // A malformed percent-escape must not break cosmetic application.
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
 * Serializes an element as `<tag attr="value" ...>` (no closing tag).
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
 * Registers a node/rule hit and reports whether it was already registered.
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
 * Collects the CSS hits of an affected element: reads the marker from every
 * matched rule's `content`, strips it from the element's own rule copy, and
 * returns the (deduped) hits.
 *
 * @param affectedEl Affected element from ExtendedCss.
 * @param attributeMarker Marker prefix (e.g. `'adguard'`).
 * @param serializeElement Whether to serialize the affected node with
 * {@link elementToString}. When false, the node itself is reported.
 * @param countedHits Per-node reported hits, kept by the caller. A re-apply
 * reports only the hits that are new.
 * @param cleanedRules Cleaned rule copies, kept by the caller. ExtendedCss
 * keys its `appliedRules` fast path on rule identity, so the copy must be
 * stable across passes.
 *
 * @returns Collected hits.
 */
function collectExtendedCssHits(
    affectedEl: IAffectedElement,
    attributeMarker: string,
    serializeElement: boolean,
    countedHits: WeakMap<Element, Set<string>>,
    cleanedRules: WeakMap<
        IAffectedElement['rules'][number],
        IAffectedElement['rules'][number]
    >,
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
        // The copy is cached per original rule so its identity stays stable:
        // ExtendedCss marks applied rules in a WeakSet keyed by the rule
        // object, and a fresh copy on every pass would defeat that fast path.
        let cleanedRule = cleanedRules.get(rule);
        if (cleanedRule === undefined) {
            cleanedRule = { ...rule, style: { ...style, content: '' } };
            cleanedRules.set(rule, cleanedRule);
        }

        rules[i] = cleanedRule;

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
 * Shared CSS-hits helpers object. Exported for the MV2 runtime import; the
 * prebuilt ExtendedCss script asset bundles it so the injected apply function
 * can collect hits.
 */
const cssHitsHelpers = {
    parseInfo,
    parseExtendedStyleInfo,
    elementToString,
    collectExtendedCssHits,
};

export { cssHitsHelpers };
