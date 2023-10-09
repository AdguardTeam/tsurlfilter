import {
    walk,
    find,
    type SelectorListPlain,
    type CssNodePlain,
    type PseudoClassSelectorPlain,
} from '@adguard/ecss-tree';

import { CssTreeNodeType, CssTreeParserContext } from '../../utils/csstree-constants';
import { CssTree } from '../../utils/csstree';
import { EMPTY, EQUALS } from '../../utils/constants';
import { LEGACY_EXT_CSS_ATTRIBUTE_PREFIX } from '../data/css';
import { ConverterBase } from '../base-interfaces/converter-base';
import { clone } from '../../utils/clone';
import { type ConversionResult, createConversionResult } from '../base-interfaces/conversion-result';

const enum PseudoClasses {
    AbpContains = '-abp-contains',
    AbpHas = '-abp-has',
    Contains = 'contains',
    Has = 'has',
    HasText = 'has-text',
    MatchesCss = 'matches-css',
    MatchesCssAfter = 'matches-css-after',
    MatchesCssBefore = 'matches-css-before',
    Not = 'not',
}

const enum PseudoElements {
    After = 'after',
    Before = 'before',
}

const PSEUDO_ELEMENT_NAMES = new Set<string>([
    PseudoElements.After,
    PseudoElements.Before,
]);

const LEGACY_MATCHES_CSS_NAMES = new Set<string>([
    PseudoClasses.MatchesCssAfter,
    PseudoClasses.MatchesCssBefore,
]);

const LEGACY_EXT_CSS_INDICATOR_PSEUDO_NAMES = new Set<string>([
    PseudoClasses.Not,
    PseudoClasses.MatchesCssBefore,
    PseudoClasses.MatchesCssAfter,
]);

const CSS_CONVERSION_INDICATOR_PSEUDO_NAMES = new Set<string>([
    PseudoClasses.AbpContains,
    PseudoClasses.AbpHas,
    PseudoClasses.HasText,
]);

/**
 * Converts some pseudo-classes to pseudo-elements. For example:
 * - `:before` → `::before`
 *
 * @param selectorList Selector list to convert
 * @returns An object which follows the {@link ConversionResult} interface. Its `result` property contains
 * the converted node, and its `isConverted` flag indicates whether the original node was converted.
 * If the node was not converted, the result will contain the original node with the same object reference
 */
export function convertToPseudoElements(selectorList: SelectorListPlain): ConversionResult<SelectorListPlain> {
    // Check conversion indications before doing any heavy work
    const hasIndicator = find(
        // TODO: Need to improve CSSTree types, until then we need to use any type here
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        selectorList as any,
        (node) => node.type === CssTreeNodeType.PseudoClassSelector && PSEUDO_ELEMENT_NAMES.has(node.name),
    );

    if (!hasIndicator) {
        return createConversionResult(selectorList, false);
    }

    // Make a clone of the selector list to avoid modifying the original one,
    // then convert & return the cloned version
    const selectorListClone = clone(selectorList);

    // TODO: Need to improve CSSTree types, until then we need to use any type here
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    walk(selectorListClone as any, {
        // TODO: Need to improve CSSTree types, until then we need to use any type here
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        leave: (node: any) => {
            if (node.type === CssTreeNodeType.PseudoClassSelector) {
                // If the pseudo-class is `:before` or `:after`, then we should
                // convert the node type to pseudo-element:
                //  :after  → ::after
                //  :before → ::before
                if (PSEUDO_ELEMENT_NAMES.has(node.name)) {
                    Object.assign(node, {
                        ...node,
                        type: CssTreeNodeType.PseudoElementSelector,
                    });
                }
            }
        },
    });

    return createConversionResult(selectorListClone, true);
}

/**
 * Converts legacy Extended CSS `matches-css-before` and `matches-css-after`
 * pseudo-classes to the new 'matches-css' pseudo-class:
 * - `:matches-css-before(...)` → `:matches-css(before, ...)`
 * - `:matches-css-after(...)`  → `:matches-css(after, ...)`
 *
 * @param node Node to convert
 * @returns An object which follows the {@link ConversionResult} interface. Its `result` property contains
 * the converted node, and its `isConverted` flag indicates whether the original node was converted.
 * If the node was not converted, the result will contain the original node with the same object reference
 * @throws If the node is invalid
 */
export function convertLegacyMatchesCss(node: CssNodePlain): ConversionResult<CssNodePlain> {
    // Check conversion indications before doing any heavy work
    if (node.type !== CssTreeNodeType.PseudoClassSelector || !LEGACY_MATCHES_CSS_NAMES.has(node.name)) {
        return createConversionResult(node, false);
    }

    const nodeClone = clone(node) as PseudoClassSelectorPlain;

    if (!nodeClone.children || nodeClone.children.length < 1) {
        throw new Error(`Invalid ${node.name} pseudo-class: missing argument`);
    }

    // Rename the pseudo-class
    nodeClone.name = PseudoClasses.MatchesCss;

    // Remove the 'matches-css-' prefix to get the direction
    const direction = node.name.substring(PseudoClasses.MatchesCss.length + 1);

    // Add the direction to the first raw argument
    const arg = nodeClone.children[0];

    // Check argument
    if (!arg) {
        throw new Error(`Invalid ${node.name} pseudo-class: argument shouldn't be null`);
    }

    if (arg.type !== CssTreeNodeType.Raw) {
        throw new Error(`Invalid ${node.name} pseudo-class: unexpected argument type`);
    }

    // Add the direction as the first argument
    arg.value = `${direction},${arg.value}`;

    return createConversionResult(nodeClone, true);
}

/**
 * Converts legacy Extended CSS selectors to the modern Extended CSS syntax.
 * For example:
 * - `[-ext-has=...]` → `:has(...)`
 * - `[-ext-contains=...]` → `:contains(...)`
 * - `[-ext-matches-css-before=...]` → `:matches-css(before, ...)`
 *
 * @param selectorList Selector list AST to convert
 * @returns An object which follows the {@link ConversionResult} interface. Its `result` property contains
 * the converted node, and its `isConverted` flag indicates whether the original node was converted.
 * If the node was not converted, the result will contain the original node with the same object reference
 */
export function convertFromLegacyExtendedCss(selectorList: SelectorListPlain): ConversionResult<SelectorListPlain> {
    // Check conversion indications before doing any heavy work
    const hasIndicator = find(
        // TODO: Need to improve CSSTree types, until then we need to use any type here
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        selectorList as any,
        (node) => {
            if (node.type === CssTreeNodeType.PseudoClassSelector) {
                return LEGACY_EXT_CSS_INDICATOR_PSEUDO_NAMES.has(node.name);
            }

            if (node.type === CssTreeNodeType.AttributeSelector) {
                return node.name.name.startsWith(LEGACY_EXT_CSS_ATTRIBUTE_PREFIX);
            }

            return false;
        },
    );

    if (!hasIndicator) {
        return createConversionResult(selectorList, false);
    }

    const selectorListClone = clone(selectorList);

    // TODO: Need to improve CSSTree types, until then we need to use any type here
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    walk(selectorListClone as any, {
        // TODO: Need to improve CSSTree types, until then we need to use any type here
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        leave: (node: any) => {
            // :matches-css-before(arg) → :matches-css(before,arg)
            // :matches-css-after(arg)  → :matches-css(after,arg)
            const convertedLegacyExtCss = convertLegacyMatchesCss(node);

            if (convertedLegacyExtCss.isConverted) {
                Object.assign(node, convertedLegacyExtCss.result);
            }

            // [-ext-name=...]   → :name(...)
            // [-ext-name='...'] → :name(...)
            // [-ext-name="..."] → :name(...)
            if (
                node.type === CssTreeNodeType.AttributeSelector
                && node.name.name.startsWith(LEGACY_EXT_CSS_ATTRIBUTE_PREFIX)
                && node.matcher === EQUALS
            ) {
                // Node value should be exist
                if (!node.value) {
                    throw new Error(`Invalid ${node.name} attribute selector: missing value`);
                }

                // Remove the '-ext-' prefix to get the pseudo-class name
                const name = node.name.name.substring(LEGACY_EXT_CSS_ATTRIBUTE_PREFIX.length);

                // Prepare the children list for the pseudo-class node
                const children: CssNodePlain[] = [];

                // TODO: Change String node to Raw node to drop the quotes.
                // The structure of the node is the same, just the type
                // is different and generate() will generate the quotes
                // for String node. See:
                //  - https://github.com/csstree/csstree/blob/master/docs/ast.md#string
                //  - https://github.com/csstree/csstree/blob/master/docs/ast.md#raw
                // if (node.value.type === "String") {
                //     node.value.type = "Raw";
                // }

                // For example, if the input is [-ext-has="> .selector"], then
                // we need to parse "> .selector" as a selector instead of string
                // it as a raw value
                if ([PseudoClasses.Has, PseudoClasses.Not].includes(name)) {
                    // Get the value of the attribute selector
                    const { value } = node;

                    // If the value is an identifier, then simply push it to the
                    // children list, otherwise parse it as a selector list before
                    if (value.type === CssTreeNodeType.Identifier) {
                        children.push(value);
                    } else if (value.type === CssTreeNodeType.String) {
                        // Parse the value as a selector
                        const parsedChildren = CssTree.parsePlain(
                            value.value,
                            CssTreeParserContext.selectorList,
                        ) as SelectorListPlain;

                        // Don't forget convert the parsed AST again, because
                        // it was a raw string before
                        const convertedChildren = convertFromLegacyExtendedCss(parsedChildren);

                        // Push the converted children to the list
                        children.push(convertedChildren.result);
                    }
                } else {
                    let value = EMPTY;

                    if (node.value.type === CssTreeNodeType.String) {
                        // If the value is a string, then use its value
                        value = node.value.value;
                    } else if (node.value.type === CssTreeNodeType.Identifier) {
                        // If the value is an identifier, then use its name
                        value = node.value.name;
                    }

                    // In other cases, convert value to raw
                    children.push({
                        type: CssTreeNodeType.Raw,
                        value,
                    });
                }

                // Create a pseudo-class node with the data from the attribute
                // selector
                const pseudoNode: PseudoClassSelectorPlain = {
                    type: CssTreeNodeType.PseudoClassSelector,
                    name,
                    children,
                };

                // Handle this case: [-ext-matches-css-before=...] → :matches-css(before,...)
                const convertedPseudoNode = convertLegacyMatchesCss(pseudoNode);

                Object.assign(node, convertedPseudoNode.isConverted ? convertedPseudoNode.result : pseudoNode);
            }
        },
    });

    return createConversionResult(selectorListClone, true);
}

/**
 * CSS selector converter
 *
 * @todo Implement `convertToUbo` and `convertToAbp`
 */
export class CssSelectorConverter extends ConverterBase {
    /**
     * Converts Extended CSS elements to AdGuard-compatible ones
     *
     * @param selectorList Selector list to convert
     * @returns An object which follows the {@link ConversionResult} interface. Its `result` property contains
     * the converted node, and its `isConverted` flag indicates whether the original node was converted.
     * If the node was not converted, the result will contain the original node with the same object reference
     * @throws If the rule is invalid or incompatible
     */
    public static convertToAdg(selectorList: SelectorListPlain): ConversionResult<SelectorListPlain> {
        // First, convert
        //  - legacy Extended CSS selectors to the modern Extended CSS syntax and
        //  - some pseudo-classes to pseudo-elements
        const legacyExtCssConverted = convertFromLegacyExtendedCss(selectorList);
        const pseudoElementsConverted = convertToPseudoElements(legacyExtCssConverted.result);

        const hasIndicator = legacyExtCssConverted.isConverted || pseudoElementsConverted.isConverted || find(
            // TODO: Need to improve CSSTree types, until then we need to use any type here
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            selectorList as any,
            // eslint-disable-next-line max-len
            (node) => node.type === CssTreeNodeType.PseudoClassSelector && CSS_CONVERSION_INDICATOR_PSEUDO_NAMES.has(node.name),
        );

        if (!hasIndicator) {
            return createConversionResult(selectorList, false);
        }

        const selectorListClone = legacyExtCssConverted.isConverted || pseudoElementsConverted.isConverted
            ? pseudoElementsConverted.result
            : clone(selectorList);

        // Then, convert some Extended CSS pseudo-classes to AdGuard-compatible ones
        // TODO: Need to improve CSSTree types, until then we need to use any type here
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        walk(selectorListClone as any, {
            // TODO: Need to improve CSSTree types, until then we need to use any type here
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            leave: (node: any) => {
                if (node.type === CssTreeNodeType.PseudoClassSelector) {
                    // :-abp-contains(...) → :contains(...)
                    // :has-text(...)      → :contains(...)
                    if (node.name === PseudoClasses.AbpContains || node.name === PseudoClasses.HasText) {
                        CssTree.renamePseudoClass(node, PseudoClasses.Contains);
                    }

                    // :-abp-has(...) → :has(...)
                    if (node.name === PseudoClasses.AbpHas) {
                        CssTree.renamePseudoClass(node, PseudoClasses.Has);
                    }

                    // TODO: check uBO's `:others()` and `:watch-attr()` pseudo-classes
                }
            },
        });

        return createConversionResult(selectorListClone, true);
    }
}
