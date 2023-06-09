/**
 * @file Additional / helper functions for ECSSTree / CSSTree.
 */

import {
    parse,
    walk,
    AttributeSelector,
    SyntaxParseError,
    CssNode,
    PseudoClassSelector,
    Selector,
    generate,
    CssNodePlain,
    toPlainObject,
    SelectorList,
    DeclarationList,
    MediaQueryList,
    MediaQuery,
    PseudoClassSelectorPlain,
    find,
} from '@adguard/ecss-tree';
import {
    CLOSE_PARENTHESIS,
    CLOSE_SQUARE_BRACKET,
    COLON,
    COMMA,
    CSS_IMPORTANT,
    DOT,
    EMPTY,
    EQUALS,
    HASHMARK,
    OPEN_PARENTHESIS,
    OPEN_SQUARE_BRACKET,
    SEMICOLON,
    SPACE,
} from './constants';
import { CssTreeNodeType, CssTreeParserContext } from './csstree-constants';
import { AdblockSyntaxError } from '../parser/errors/adblock-syntax-error';
import { LocationRange, defaultLocation } from '../parser/common';
import { locRange } from './location';
import { StringUtils } from './string';

/**
 * Common CSSTree parsing options.
 */
const commonCssTreeOptions = {
    parseAtrulePrelude: true,
    parseRulePrelude: true,
    parseValue: true,
    parseCustomProperty: true,
    positions: true,
};

/**
 * Result interface for ExtendedCSS finder.
 */
export interface ExtendedCssNodes {
    /**
     * ExtendedCSS pseudo classes.
     */
    pseudos: PseudoClassSelector[];

    /**
     * ExtendedCSS attributes.
     */
    attributes: AttributeSelector[];
}

/**
 * Additional / helper functions for CSSTree.
 */
export class CssTree {
    /**
     * Shifts location of the CSSTree node. Temporary workaround for CSSTree issue:
     * https://github.com/csstree/csstree/issues/251
     *
     * @param root Root CSSTree node
     * @param loc Location to shift
     * @returns Root CSSTree node with shifted location
     */
    public static shiftNodePosition(root: CssNode, loc = defaultLocation): CssNode {
        walk(root, (node: CssNode) => {
            if (node.loc) {
                /* eslint-disable no-param-reassign */
                node.loc.start.offset += loc.offset;
                node.loc.start.line += loc.line - 1;
                node.loc.start.column += loc.column - 1;

                node.loc.end.offset += loc.offset;
                node.loc.end.line += loc.line - 1;
                node.loc.end.column += loc.column - 1;
                /* eslint-enable no-param-reassign */
            }
        });

        return root;
    }

    /**
     * Helper function for parsing CSS parts.
     *
     * @param raw Raw CSS input
     * @param context CSSTree context for parsing
     * @param tolerant If `true`, then the parser will not throw an error on parsing fallbacks. Default is `false`
     * @param loc Base location for the parsed node
     * @returns CSSTree node (AST)
     */
    public static parse(raw: string, context: CssTreeParserContext, tolerant = false, loc = defaultLocation): CssNode {
        try {
            // TODO: Workaround for wrong error management: https://github.com/csstree/csstree/issues/251
            return CssTree.shiftNodePosition(
                parse(raw, {
                    context,
                    ...commonCssTreeOptions,
                    // https://github.com/csstree/csstree/blob/master/docs/parsing.md#onparseerror
                    onParseError: (error: SyntaxParseError) => {
                        // Strict mode
                        if (!tolerant) {
                            throw new AdblockSyntaxError(
                                // eslint-disable-next-line max-len
                                `ECSSTree parsing error: '${error.rawMessage || error.message}'`,
                                locRange(loc, error.offset, raw.length),
                            );
                        }
                    },

                    // TODO: Resolve false positive alert for :xpath('//*[contains(text(),"a")]')
                    // Temporarily disabled to avoid false positive alerts

                    // We don't need CSS comments
                    // onComment: (value: string, commentLoc: CssLocation) => {
                    //     throw new AdblockSyntaxError(
                    //         'ECSSTree parsing error: \'Unexpected comment\'',
                    //         locRange(loc, commentLoc.start.offset, commentLoc.end.offset),
                    //     );
                    // },
                }),
                loc,
            );
        } catch (error: unknown) {
            if (error instanceof Error) {
                let errorLoc: LocationRange;

                // Get start offset of the error (if available), otherwise use the whole inputs length
                if ('offset' in error && typeof error.offset === 'number') {
                    errorLoc = locRange(loc, error.offset, raw.length);
                } else {
                    // istanbul ignore next
                    errorLoc = locRange(loc, 0, raw.length);
                }

                throw new AdblockSyntaxError(
                    `ECSSTree parsing error: '${error.message}'`,
                    errorLoc,
                );
            }

            // Pass through any other error just in case, but theoretically it should never happen,
            // so it is ok to ignore it from the coverage
            // istanbul ignore next
            throw error;
        }
    }

    /**
     * Helper function for parsing CSS parts.
     *
     * @param raw Raw CSS input
     * @param context CSSTree context
     * @param tolerant If `true`, then the parser will not throw an error on parsing fallbacks. Default is `false`
     * @param loc Base location for the parsed node
     * @returns CSSTree node (AST)
     */
    // istanbul ignore next
    // eslint-disable-next-line max-len
    public static parsePlain(raw: string, context: CssTreeParserContext, tolerant = false, loc = defaultLocation): CssNodePlain {
        return toPlainObject(
            CssTree.parse(raw, context, tolerant, loc),
        );
    }

    /**
     * Walks through the CSSTree node and returns all ExtendedCSS nodes.
     *
     * @param selectorAst Selector AST
     * @param pseudoClasses List of the names of the pseudo classes to check
     * @param attributeSelectors List of the names of the attribute selectors to check
     * @returns Extended CSS nodes (pseudos and attributes)
     */
    public static getSelectorExtendedCssNodes(
        selectorAst: Selector,
        pseudoClasses: Set<string>,
        attributeSelectors: Set<string>,
    ): ExtendedCssNodes {
        const pseudos: PseudoClassSelector[] = [];
        const attributes: AttributeSelector[] = [];

        walk(selectorAst, (node) => {
            // Pseudo classes
            if (node.type === CssTreeNodeType.PseudoClassSelector) {
                // Check if it's a known ExtendedCSS pseudo class
                if (pseudoClasses.has(node.name)) {
                    pseudos.push(node);
                }
            } else if (node.type === CssTreeNodeType.AttributeSelector) {
                // Check if it's a known ExtendedCSS attribute
                if (attributeSelectors.has(node.name.name)) {
                    attributes.push(node);
                }
            }
        });

        return {
            pseudos,
            attributes,
        };
    }

    /**
     * Checks if the selector contains any ExtendedCSS nodes. It is a faster alternative to
     * `getSelectorExtendedCssNodes` if you only need to know if the selector contains any ExtendedCSS nodes,
     * because it stops the search on the first ExtendedCSS node instead of going through the whole selector
     * and collecting all ExtendedCSS nodes.
     *
     * @param selectorAst Selector AST
     * @param pseudoClasses List of the names of the pseudo classes to check
     * @param attributeSelectors List of the names of the attribute selectors to check
     * @returns `true` if the selector contains any ExtendedCSS nodes
     * @see {@link https://github.com/csstree/csstree/blob/master/docs/traversal.md#findast-fn}
     */
    public static hasAnySelectorExtendedCssNode(
        selectorAst: Selector,
        pseudoClasses: Set<string>,
        attributeSelectors: Set<string>,
    ): boolean {
        return find(selectorAst, (node) => {
            // Pseudo classes
            if (node.type === CssTreeNodeType.PseudoClassSelector) {
                // Check if it's a known ExtendedCSS pseudo class
                if (pseudoClasses.has(node.name)) {
                    return true;
                }
            } else if (node.type === CssTreeNodeType.AttributeSelector) {
                // Check if it's a known ExtendedCSS attribute
                if (attributeSelectors.has(node.name.name)) {
                    return true;
                }
            }

            return false;
        }) !== null;
    }

    /**
     * Generates string representation of the media query list.
     *
     * @param ast Media query list AST
     * @returns String representation of the media query list
     */
    public static generateMediaQueryList(ast: MediaQueryList): string {
        let result = EMPTY;

        if (!ast.children || ast.children.size === 0) {
            throw new Error('Media query list cannot be empty');
        }

        ast.children.forEach((mediaQuery: CssNode, listItem) => {
            if (mediaQuery.type !== CssTreeNodeType.MediaQuery) {
                throw new Error(`Unexpected node type: ${mediaQuery.type}`);
            }

            result += this.generateMediaQuery(mediaQuery);

            if (listItem.next !== null) {
                result += COMMA;
                result += SPACE;
            }
        });

        return result;
    }

    /**
     * Generates string representation of the media query.
     *
     * @param ast Media query AST
     * @returns String representation of the media query
     */
    public static generateMediaQuery(ast: MediaQuery): string {
        let result = EMPTY;

        if (!ast.children || ast.children.size === 0) {
            throw new Error('Media query cannot be empty');
        }

        ast.children.forEach((node: CssNode, listItem) => {
            if (node.type === CssTreeNodeType.MediaFeature) {
                result += OPEN_PARENTHESIS;
                result += node.name;

                if (node.value !== null) {
                    result += COLON;
                    result += SPACE;
                    // Use default generator for media feature value
                    result += generate(node.value);
                }

                result += CLOSE_PARENTHESIS;
            } else if (node.type === CssTreeNodeType.Identifier) {
                result += node.name;
            } else {
                throw new Error(`Unexpected node type: ${node.type}`);
            }

            if (listItem.next !== null) {
                result += SPACE;
            }
        });

        return result;
    }

    /**
     * Generates string representation of the selector list.
     *
     * @param ast SelectorList AST
     * @returns String representation of the selector list
     */
    public static generateSelectorList(ast: SelectorList): string {
        let result = EMPTY;

        if (!ast.children || ast.children.size === 0) {
            throw new Error('Selector list cannot be empty');
        }

        ast.children.forEach((selector: CssNode, listItem) => {
            if (selector.type !== CssTreeNodeType.Selector) {
                throw new Error(`Unexpected node type: ${selector.type}`);
            }

            result += this.generateSelector(selector);

            if (listItem.next !== null) {
                result += COMMA;
                result += SPACE;
            }
        });

        return result;
    }

    /**
     * Selector generation based on CSSTree's AST. This is necessary because CSSTree
     * only adds spaces in some edge cases.
     *
     * @param ast CSS Tree AST
     * @returns CSS selector as string
     */
    public static generateSelector(ast: Selector): string {
        let result = EMPTY;

        let inAttributeSelector = false;
        let depth = 0;
        let selectorListDepth = -1;
        let prevNode: CssNode = ast;

        walk(ast, {
            enter: (node: CssNode) => {
                depth += 1;

                // Skip attribute selector / selector list children
                if (inAttributeSelector || selectorListDepth > -1) {
                    return;
                }

                switch (node.type) {
                    // "Trivial" nodes
                    case CssTreeNodeType.TypeSelector:
                        result += node.name;
                        break;

                    case CssTreeNodeType.ClassSelector:
                        result += DOT;
                        result += node.name;
                        break;

                    case CssTreeNodeType.IdSelector:
                        result += HASHMARK;
                        result += node.name;
                        break;

                    case CssTreeNodeType.Identifier:
                        result += node.name;
                        break;

                    case CssTreeNodeType.Raw:
                        result += node.value;
                        break;

                    // "Advanced" nodes
                    case CssTreeNodeType.Nth:
                        // Default generation enough
                        result += generate(node);
                        break;

                    // For example :not([id], [name])
                    case CssTreeNodeType.SelectorList:
                        // eslint-disable-next-line no-case-declarations
                        const selectors: string[] = [];

                        node.children.forEach((selector) => {
                            if (selector.type === CssTreeNodeType.Selector) {
                                selectors.push(CssTree.generateSelector(selector));
                            } else if (selector.type === CssTreeNodeType.Raw) {
                                selectors.push(selector.value);
                            }
                        });

                        // Join selector lists
                        result += selectors.join(COMMA + SPACE);

                        // Skip nodes here
                        selectorListDepth = depth;
                        break;

                    case CssTreeNodeType.Combinator:
                        if (node.name === SPACE) {
                            result += node.name;
                            break;
                        }

                        // Prevent this case (unnecessary space): has( > .something)
                        if (prevNode.type !== CssTreeNodeType.Selector) {
                            result += SPACE;
                        }

                        result += node.name;
                        result += SPACE;
                        break;

                    case CssTreeNodeType.AttributeSelector:
                        result += OPEN_SQUARE_BRACKET;

                        // Identifier name
                        if (node.name) {
                            result += node.name.name;
                        }

                        // Matcher operator, eg =
                        if (node.matcher) {
                            result += node.matcher;

                            // Value can be String, Identifier or null
                            if (node.value !== null) {
                                // String node
                                if (node.value.type === CssTreeNodeType.String) {
                                    result += generate(node.value);
                                } else if (node.value.type === CssTreeNodeType.Identifier) {
                                    // Identifier node
                                    result += node.value.name;
                                }
                            }
                        }

                        // Flags
                        if (node.flags) {
                            // Space before flags
                            result += SPACE;
                            result += node.flags;
                        }

                        result += CLOSE_SQUARE_BRACKET;

                        inAttributeSelector = true;
                        break;

                    case CssTreeNodeType.PseudoElementSelector:
                        result += COLON;
                        result += COLON;
                        result += node.name;

                        if (node.children !== null) {
                            result += OPEN_PARENTHESIS;
                        }

                        break;

                    case CssTreeNodeType.PseudoClassSelector:
                        result += COLON;
                        result += node.name;

                        if (node.children !== null) {
                            result += OPEN_PARENTHESIS;
                        }
                        break;

                    default:
                        break;
                }

                prevNode = node;
            },
            leave: (node: CssNode) => {
                depth -= 1;

                if (node.type === CssTreeNodeType.SelectorList && depth + 1 === selectorListDepth) {
                    selectorListDepth = -1;
                }

                if (selectorListDepth > -1) {
                    return;
                }

                if (node.type === CssTreeNodeType.AttributeSelector) {
                    inAttributeSelector = false;
                }

                if (inAttributeSelector) {
                    return;
                }

                switch (node.type) {
                    case CssTreeNodeType.PseudoElementSelector:
                    case CssTreeNodeType.PseudoClassSelector:
                        if (node.children !== null) {
                            result += CLOSE_PARENTHESIS;
                        }
                        break;

                    default:
                        break;
                }
            },
        });

        return result.trim();
    }

    /**
     * Block generation based on CSSTree's AST. This is necessary because CSSTree only adds spaces in some edge cases.
     *
     * @param ast CSS Tree AST
     * @returns CSS selector as string
     */
    public static generateDeclarationList(ast: DeclarationList): string {
        let result = EMPTY;

        walk(ast, {
            enter: (node: CssNode) => {
                switch (node.type) {
                    case CssTreeNodeType.Declaration: {
                        result += node.property;

                        if (node.value) {
                            result += COLON;
                            result += SPACE;

                            // Fallback to CSSTree's default generate function for the value (enough at this point)
                            result += generate(node.value);
                        }

                        if (node.important) {
                            result += SPACE;
                            result += CSS_IMPORTANT;
                        }

                        break;
                    }

                    default:
                        break;
                }
            },
            leave: (node: CssNode) => {
                switch (node.type) {
                    case CssTreeNodeType.Declaration: {
                        result += SEMICOLON;
                        result += SPACE;
                        break;
                    }

                    default:
                        break;
                }
            },
        });

        return result.trim();
    }

    /**
     * Helper method to assert that the attribute selector has a value
     *
     * @param node Attribute selector node
     */
    public static assertAttributeSelectorHasStringValue(
        node: AttributeSelector,
    ): asserts node is AttributeSelector & { value: { type: 'String' } } {
        if (!node.value || node.value.type !== CssTreeNodeType.String) {
            throw new Error(
                `Invalid argument '${node.value}' for '${node.name.name}', expected a string, but got '${
                    node.value
                        ? node.value.type
                        : 'undefined'
                }'`,
            );
        }
    }

    /**
     * Helper method to assert that the pseudo-class selector has at least one argument
     *
     * @param node Pseudo-class selector node
     */
    public static assertPseudoClassHasAnyArgument(
        node: PseudoClassSelectorPlain,
    ): asserts node is PseudoClassSelectorPlain & { children: CssNodePlain[] } {
        if (!node.children || node.children.length === 0) {
            throw new Error(`Pseudo class '${node.name}' has no argument`);
        }
    }

    /**
     * Helper method to parse an attribute selector value as a number
     *
     * @param node Attribute selector node
     * @returns Parsed attribute selector value as a number
     * @throws If the attribute selector hasn't a string value or the string value is can't be parsed as a number
     */
    public static parseAttributeSelectorValueAsNumber(node: AttributeSelector): number {
        CssTree.assertAttributeSelectorHasStringValue(node);
        return StringUtils.parseNumber(node.value.value);
    }

    /**
     * Helper method to parse a pseudo-class argument as a number
     *
     * @param node Pseudo-class selector node to parse
     * @returns Parsed pseudo-class argument as a number
     */
    public static parsePseudoClassArgumentAsNumber(node: PseudoClassSelectorPlain): number {
        // Check if the pseudo-class has at least one child
        CssTree.assertPseudoClassHasAnyArgument(node);

        // Check if the pseudo-class has only one child
        if (node.children.length > 1) {
            throw new Error(`Invalid argument '${node.name}', expected a number, but got multiple arguments`);
        }

        // Check if the pseudo-class argument is a string / number / raw
        const argument = node.children[0];

        if (
            argument.type !== CssTreeNodeType.String
            && argument.type !== CssTreeNodeType.Number
            && argument.type !== CssTreeNodeType.Raw
        ) {
            throw new Error(
                `Invalid argument '${
                    node.name
                }', expected a ${
                    CssTreeNodeType.String
                } or ${
                    CssTreeNodeType.Number
                } or ${
                    CssTreeNodeType.Raw
                }, but got '${argument.type}'`,
            );
        }

        // Parse the argument as a number
        return StringUtils.parseNumber(argument.value);
    }

    /**
     * Helper method to create an attribute selector node
     *
     * @param name Name of the attribute
     * @param value Value of the attribute
     * @param matcher Matcher of the attribute
     * @param flags Flags of the attribute
     * @returns Attribute selector node
     * @see {@link https://github.com/csstree/csstree/blob/master/docs/ast.md#attributeselector}
     */
    public static createAttributeSelectorNode(
        name: string,
        value: string,
        matcher = EQUALS,
        flags: string | null = null,
    ): AttributeSelector {
        return {
            type: CssTreeNodeType.AttributeSelector,
            name: {
                type: CssTreeNodeType.Identifier,
                name,
            },
            value: {
                type: CssTreeNodeType.String,
                value,
            },
            matcher,
            flags,
        };
    }
}
