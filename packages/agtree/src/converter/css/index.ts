import {
    type CssNode,
    List,
    type PseudoClassSelector,
    type SelectorList,
    walk,
} from '@adguard/ecss-tree';
import cloneDeep from 'clone-deep';

import { CssTreeNodeType, CssTreeParserContext } from '../../utils/csstree-constants';
import { CssTree } from '../../utils/csstree';
import { EMPTY, EQUALS } from '../../utils/constants';
import { LEGACY_EXT_CSS_ATTRIBUTE_PREFIX } from '../data/css';
import { ConverterBase } from '../base-interfaces/converter-base';

// Constants for pseudo-classes (please keep them sorted alphabetically)
const ABP_CONTAINS = '-abp-contains';
const ABP_HAS = '-abp-has';
const CONTAINS = 'contains';
const HAS = 'has';
const HAS_TEXT = 'has-text';
const MATCHES_CSS = 'matches-css';
const MATCHES_CSS_AFTER = 'matches-css-after';
const MATCHES_CSS_BEFORE = 'matches-css-before';
const NOT = 'not';

// Constants for pseudo-elements (please keep them sorted alphabetically)
const AFTER = 'after';
const BEFORE = 'before';

/**
 * Converts some pseudo-classes to pseudo-elements. For example:
 * - `:before` → `::before`
 *
 * @param selectorList Selector list to convert
 * @returns Converted selector list
 */
export function convertToPseudoElements(selectorList: SelectorList): SelectorList {
    // Prepare conversion result
    const selectorListClone = cloneDeep(selectorList);

    walk(selectorListClone, {
        leave: (node: CssNode) => {
            if (node.type === CssTreeNodeType.PseudoClassSelector) {
                // :after  → ::after
                // :before → ::before
                if (node.name === AFTER || node.name === BEFORE) {
                    Object.assign(node, {
                        ...node,
                        type: CssTreeNodeType.PseudoElementSelector,
                    });
                }
            }
        },
    });

    return selectorListClone;
}

/**
 * Converts legacy Extended CSS `matches-css-before` and `matches-css-after`
 * pseudo-classes to the new 'matches-css' pseudo-class:
 * - `:matches-css-before(...)` → `:matches-css(before, ...)`
 * - `:matches-css-after(...)`  → `:matches-css(after, ...)`
 *
 * @param node Node to convert
 * @throws If the node is invalid
 */
export function convertLegacyMatchesCss(node: CssNode): void {
    const nodeClone = cloneDeep(node);

    if (
        nodeClone.type === CssTreeNodeType.PseudoClassSelector
        && [MATCHES_CSS_BEFORE, MATCHES_CSS_AFTER].includes(nodeClone.name)
    ) {
        if (!nodeClone.children || nodeClone.children.size < 1) {
            throw new Error(
                `Invalid ${nodeClone.name} pseudo-class: missing argument`,
            );
        }

        // Remove the 'matches-css-' prefix to get the direction
        const direction = nodeClone.name.substring(MATCHES_CSS.length + 1);

        // Rename the pseudo-class
        nodeClone.name = MATCHES_CSS;

        // Add the direction to the first raw argument
        const arg = nodeClone.children.first;

        // Check argument
        if (!arg) {
            throw new Error(
                `Invalid ${nodeClone.name} pseudo-class: argument shouldn't be null`,
            );
        }

        if (arg.type !== CssTreeNodeType.Raw) {
            throw new Error(
                `Invalid ${nodeClone.name} pseudo-class: unexpected argument type`,
            );
        }

        // Add the direction as the first argument
        arg.value = `${direction},${arg.value}`;

        // Replace the original node with the converted one
        Object.assign(node, nodeClone);
    }
}

/**
 * Converts legacy Extended CSS selectors to the modern Extended CSS syntax.
 * For example:
 * - `[-ext-has=...]` → `:has(...)`
 * - `[-ext-contains=...]` → `:contains(...)`
 * - `[-ext-matches-css-before=...]` → `:matches-css(before, ...)`
 *
 * @param selectorList Selector list AST to convert
 * @returns Converted selector list
 */
export function convertFromLegacyExtendedCss(selectorList: SelectorList): SelectorList {
    // Prepare conversion result
    const selectorListClone = cloneDeep(selectorList);

    walk(selectorListClone, {
        leave: (node: CssNode) => {
            // :matches-css-before(arg) → :matches-css(before,arg)
            // :matches-css-after(arg)  → :matches-css(after,arg)
            convertLegacyMatchesCss(node);

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
                    throw new Error(
                        `Invalid ${node.name} attribute selector: missing value`,
                    );
                }

                // Remove the '-ext-' prefix to get the pseudo-class name
                const name = node.name.name.substring(
                    LEGACY_EXT_CSS_ATTRIBUTE_PREFIX.length,
                );

                // Prepare the children list for the pseudo-class node
                const children = new List<CssNode>();

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
                if ([HAS, NOT].includes(name)) {
                    // Get the value of the attribute selector
                    const { value } = node;

                    // If the value is an identifier, then simply push it to the
                    // children list, otherwise parse it as a selector list before
                    if (value.type === CssTreeNodeType.Identifier) {
                        children.push(value);
                    } else if (value.type === CssTreeNodeType.String) {
                        // Parse the value as a selector
                        const parsedChildren = CssTree.parse(
                            value.value,
                            CssTreeParserContext.selectorList,
                        ) as SelectorList;

                        // Don't forget convert the parsed AST again, because
                        // it was a raw string before
                        children.push(convertFromLegacyExtendedCss(parsedChildren));
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
                const pseudoNode: PseudoClassSelector = {
                    type: CssTreeNodeType.PseudoClassSelector,
                    name,
                    children,
                };

                // Handle this case: [-ext-matches-css-before=...] → :matches-css(before,...)
                convertLegacyMatchesCss(pseudoNode);

                // Convert attribute selector to pseudo-class selector, but
                // keep the reference to the original node
                Object.assign(node, pseudoNode);
            }
        },
    });

    return selectorListClone;
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
     * @returns Converted selector list
     * @throws If the rule is invalid or incompatible
     */
    public static convertToAdg(selectorList: SelectorList): SelectorList {
        // First, convert
        //  - legacy Extended CSS selectors to the modern Extended CSS syntax and
        //  - some pseudo-classes to pseudo-elements
        const selectorListClone = convertToPseudoElements(
            convertFromLegacyExtendedCss(
                cloneDeep(selectorList),
            ),
        );

        // Then, convert some Extended CSS pseudo-classes to AdGuard-compatible ones
        walk(selectorListClone, {
            leave: (node: CssNode) => {
                if (node.type === CssTreeNodeType.PseudoClassSelector) {
                    // :-abp-contains(...) → :contains(...)
                    // :has-text(...)      → :contains(...)
                    if (node.name === ABP_CONTAINS || node.name === HAS_TEXT) {
                        CssTree.renamePseudoClass(node, CONTAINS);
                    }

                    // :-abp-has(...) → :has(...)
                    if (node.name === ABP_HAS) {
                        CssTree.renamePseudoClass(node, HAS);
                    }

                    // TODO: check uBO's `:others()` and `:watch-attr()` pseudo-classes
                }
            },
        });

        return selectorListClone;
    }
}
