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
} from '@adguard/ecss-tree';
import { EXTCSS_PSEUDO_CLASSES, EXTCSS_ATTRIBUTES } from '../converter/pseudo';
import {
    CLOSE_PARENTHESIS,
    CLOSE_SQUARE_BRACKET,
    COLON,
    COMMA,
    CSS_IMPORTANT,
    DOT,
    EMPTY,
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
                    errorLoc = locRange(loc, 0, raw.length);
                }

                throw new AdblockSyntaxError(
                    `ECSSTree parsing error: '${error.message}'`,
                    errorLoc,
                );
            }

            // Pass through
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
    // eslint-disable-next-line max-len
    public static parsePlain(raw: string, context: CssTreeParserContext, tolerant = false, loc = defaultLocation): CssNodePlain {
        return toPlainObject(
            CssTree.parse(raw, context, tolerant, loc),
        );
    }

    /**
     * Walks through the CSSTree node and returns all ExtendedCSS nodes.
     *
     * @param selectorAst CSSTree selector AST
     * @returns Extended CSS nodes (pseudos and attributes)
     */
    public static getSelectorExtendedCssNodes(selectorAst: Selector): ExtendedCssNodes {
        const pseudos: PseudoClassSelector[] = [];
        const attributes: AttributeSelector[] = [];

        walk(selectorAst, (node: CssNode) => {
            // Pseudo classes
            if (node.type === CssTreeNodeType.PseudoClassSelector) {
                // Check if it's a known ExtendedCSS pseudo class
                if (EXTCSS_PSEUDO_CLASSES.includes(node.name)) {
                    pseudos.push(node);
                }
            } else if (node.type === CssTreeNodeType.AttributeSelector) {
                // Check if it's a known ExtendedCSS attribute
                if (EXTCSS_ATTRIBUTES.includes(node.name.name)) {
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
}
