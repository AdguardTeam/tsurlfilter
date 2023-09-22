/**
 * @file Additional / helper functions for ECSSTree / CSSTree.
 *
 * @note There are no tests for some functions, but during the AGTree optimization we remove them anyway.
 */

import {
    find,
    generate,
    parse,
    toPlainObject,
    type AttributeSelector,
    type CssNode,
    type CssNodePlain,
    type DeclarationList,
    type DeclarationListPlain,
    type FunctionNode,
    type MediaQuery,
    type MediaQueryList,
    type PseudoClassSelector,
    type PseudoClassSelectorPlain,
    type Selector,
    type SelectorList,
    type SelectorListPlain,
    type SyntaxParseError,
    walk,
    type SelectorPlain,
    type FunctionNodePlain,
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
import { AdblockSyntaxError } from '../errors/adblock-syntax-error';
import { type LocationRange, defaultLocation } from '../parser/common';
import { locRange } from './location';
import { StringUtils } from './string';
import { EXT_CSS_LEGACY_ATTRIBUTES, EXT_CSS_PSEUDO_CLASSES, FORBIDDEN_CSS_FUNCTIONS } from '../converter/data/css';
import { clone } from './clone';

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

const URL_FUNCTION = 'url';

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
     * Checks if the CSSTree node is an ExtendedCSS node.
     *
     * @param node Node to check
     * @param pseudoClasses List of the names of the pseudo classes to check
     * @param attributeSelectors List of the names of the attribute selectors to check
     * @returns `true` if the node is an ExtendedCSS node, otherwise `false`
     */
    public static isExtendedCssNode(
        node: CssNode | CssNodePlain,
        pseudoClasses: Set<string>,
        attributeSelectors: Set<string>,
    ): boolean {
        return (
            (node.type === CssTreeNodeType.PseudoClassSelector && pseudoClasses.has(node.name))
            || (node.type === CssTreeNodeType.AttributeSelector && attributeSelectors.has(node.name.name))
        );
    }

    /**
     * Walks through the CSSTree node and returns all ExtendedCSS nodes.
     *
     * @param selectorList Selector list (can be a string or a CSSTree node)
     * @param pseudoClasses List of the names of the pseudo classes to check
     * @param attributeSelectors List of the names of the attribute selectors to check
     * @returns Extended CSS nodes (pseudos and attributes)
     * @see {@link https://github.com/csstree/csstree/blob/master/docs/ast.md#selectorlist}
     */
    public static getSelectorExtendedCssNodes(
        selectorList: string | SelectorList | SelectorListPlain,
        pseudoClasses: Set<string> = EXT_CSS_PSEUDO_CLASSES,
        attributeSelectors: Set<string> = EXT_CSS_LEGACY_ATTRIBUTES,
    ): CssNode[] {
        // Parse the block if string is passed
        let ast;

        if (StringUtils.isString(selectorList)) {
            ast = CssTree.parse(selectorList, CssTreeParserContext.selectorList);
        } else {
            ast = clone(selectorList);
        }

        const nodes: CssNode[] = [];

        // TODO: Need to improve CSSTree types, until then we need to use any type here
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        walk(ast as any, (node) => {
            if (CssTree.isExtendedCssNode(node, pseudoClasses, attributeSelectors)) {
                nodes.push(node);
            }
        });

        return nodes;
    }

    /**
     * Checks if the selector contains any ExtendedCSS nodes. It is a faster alternative to
     * `getSelectorExtendedCssNodes` if you only need to know if the selector contains any ExtendedCSS nodes,
     * because it stops the search on the first ExtendedCSS node instead of going through the whole selector
     * and collecting all ExtendedCSS nodes.
     *
     * @param selectorList Selector list (can be a string or a CSSTree node)
     * @param pseudoClasses List of the names of the pseudo classes to check
     * @param attributeSelectors List of the names of the attribute selectors to check
     * @returns `true` if the selector contains any ExtendedCSS nodes
     * @see {@link https://github.com/csstree/csstree/blob/master/docs/ast.md#selectorlist}
     * @see {@link https://github.com/csstree/csstree/blob/master/docs/traversal.md#findast-fn}
     */
    public static hasAnySelectorExtendedCssNode(
        selectorList: string | SelectorList | SelectorListPlain,
        pseudoClasses: Set<string> = EXT_CSS_PSEUDO_CLASSES,
        attributeSelectors: Set<string> = EXT_CSS_LEGACY_ATTRIBUTES,
    ): boolean {
        // Parse the block if string is passed
        let ast;

        if (StringUtils.isString(selectorList)) {
            ast = CssTree.parse(selectorList, CssTreeParserContext.selectorList);
        } else {
            ast = selectorList;
        }

        // TODO: Need to improve CSSTree types, until then we need to use any type here
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return find(ast as any, (node) => CssTree.isExtendedCssNode(node, pseudoClasses, attributeSelectors)) !== null;
    }

    /**
     * Checks if the node is a forbidden function (unsafe resource loading). Typically it is used to check
     * if the node is a `url()` function, which is a security risk when using filter lists from untrusted
     * sources.
     *
     * @param node Node to check
     * @param forbiddenFunctions Set of the names of the functions to check
     * @returns `true` if the node is a forbidden function
     */
    public static isForbiddenFunction(
        node: CssNode | CssNodePlain,
        forbiddenFunctions = FORBIDDEN_CSS_FUNCTIONS,
    ): boolean {
        return (
            // General case: check if it's a forbidden function
            (node.type === CssTreeNodeType.Function && forbiddenFunctions.has(node.name))
            // Special case: CSSTree handles `url()` function in a separate node type,
            // and we also should check if the `url()` are marked as a forbidden function
            || (node.type === CssTreeNodeType.Url && forbiddenFunctions.has(URL_FUNCTION))
        );
    }

    /**
     * Gets the list of the forbidden function nodes in the declaration block. Typically it is used to get
     * the list of the functions that can be used to load external resources, which is a security risk
     * when using filter lists from untrusted sources.
     *
     * @param declarationList Declaration list to check (can be a string or a CSSTree node)
     * @param forbiddenFunctions Set of the names of the functions to check
     * @returns List of the forbidden function nodes in the declaration block (can be empty)
     */
    public static getForbiddenFunctionNodes(
        declarationList: string | DeclarationList | DeclarationListPlain,
        forbiddenFunctions = FORBIDDEN_CSS_FUNCTIONS,
    ): CssNode[] {
        // Parse the block if string is passed
        let ast;

        if (StringUtils.isString(declarationList)) {
            ast = CssTree.parse(declarationList, CssTreeParserContext.declarationList);
        } else {
            ast = clone(declarationList);
        }

        const nodes: CssNode[] = [];
        // While walking the AST we should skip the nested functions,
        // for example skip url()s in cross-fade(url(), url()), since
        // cross-fade() itself is already a forbidden function
        let inForbiddenFunction = false;

        // TODO: Need to improve CSSTree types, until then we need to use any type here
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        walk(ast as any, {
            enter: (node: CssNode) => {
                if (!inForbiddenFunction && CssTree.isForbiddenFunction(node, forbiddenFunctions)) {
                    nodes.push(node);
                    inForbiddenFunction = true;
                }
            },
            leave: (node: CssNode) => {
                if (inForbiddenFunction && CssTree.isForbiddenFunction(node, forbiddenFunctions)) {
                    inForbiddenFunction = false;
                }
            },
        });

        return nodes;
    }

    /**
     * Checks if the declaration block contains any forbidden functions. Typically it is used to check
     * if the declaration block contains any functions that can be used to load external resources,
     * which is a security risk when using filter lists from untrusted sources.
     *
     * @param declarationList Declaration list to check (can be a string or a CSSTree node)
     * @param forbiddenFunctions Set of the names of the functions to check
     * @returns `true` if the declaration block contains any forbidden functions
     * @throws If you pass a string, but it is not a valid CSS
     * @throws If you pass an invalid CSSTree node / AST
     * @see {@link https://github.com/csstree/csstree/blob/master/docs/ast.md#declarationlist}
     * @see {@link https://github.com/AdguardTeam/AdguardBrowserExtension/issues/1196}
     * @see {@link https://github.com/AdguardTeam/AdguardBrowserExtension/issues/1920}
     */
    public static hasAnyForbiddenFunction(
        declarationList: string | DeclarationList | DeclarationListPlain,
        forbiddenFunctions = FORBIDDEN_CSS_FUNCTIONS,
    ): boolean {
        // Parse the block if string is passed
        let ast;

        if (StringUtils.isString(declarationList)) {
            ast = CssTree.parse(declarationList, CssTreeParserContext.declarationList);
        } else {
            ast = clone(declarationList);
        }

        // TODO: Need to improve CSSTree types, until then we need to use any type here
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return find(ast as any, (node) => CssTree.isForbiddenFunction(node, forbiddenFunctions)) !== null;
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
     * Generates string representation of the selector list.
     *
     * @param ast SelectorList AST
     * @returns String representation of the selector list
     */
    public static generateSelectorListPlain(ast: SelectorListPlain): string {
        const result: string[] = [];

        if (!ast.children || ast.children.length === 0) {
            throw new Error('Selector list cannot be empty');
        }

        ast.children.forEach((selector, index, nodeList) => {
            if (selector.type !== CssTreeNodeType.Selector) {
                throw new Error(`Unexpected node type: ${selector.type}`);
            }

            result.push(this.generateSelectorPlain(selector));

            // If there is a next node, add a comma and a space after the selector
            if (nodeList[index + 1]) {
                result.push(COMMA, SPACE);
            }
        });

        return result.join(EMPTY);
    }

    /**
     * Selector generation based on CSSTree's AST. This is necessary because CSSTree
     * only adds spaces in some edge cases.
     *
     * @param ast CSS Tree AST
     * @returns CSS selector as string
     */
    public static generateSelectorPlain(ast: SelectorPlain): string {
        let result = EMPTY;

        let inAttributeSelector = false;
        let depth = 0;
        let selectorListDepth = -1;
        let prevNode: CssNodePlain = ast;

        // TODO: Need to improve CSSTree types, until then we need to use any type here
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        walk(ast as any, {
            // TODO: Need to improve CSSTree types, until then we need to use any type here
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            enter: (node: any) => {
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

                        node.children.forEach((selector: CssNodePlain) => {
                            if (selector.type === CssTreeNodeType.Selector) {
                                selectors.push(CssTree.generateSelectorPlain(selector));
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
                        if (node.children) {
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

    /**
     * Helper function to rename a CSSTree pseudo-class node
     *
     * @param node Node to rename
     * @param name New name
     */
    public static renamePseudoClass(node: PseudoClassSelector, name: string): void {
        Object.assign(node, {
            ...node,
            name,
        });
    }

    /**
     * Helper function to generate a raw string from a pseudo-class
     * selector's children
     *
     * @param node Pseudo-class selector node
     * @returns Generated pseudo-class value
     * @example
     * - `:nth-child(2n+1)` -> `2n+1`
     * - `:matches-path(/foo/bar)` -> `/foo/bar`
     */
    public static generatePseudoClassValue(node: PseudoClassSelector): string {
        let result = EMPTY;

        node.children?.forEach((child) => {
            switch (child.type) {
                case CssTreeNodeType.Selector:
                    result += CssTree.generateSelector(child);
                    break;

                case CssTreeNodeType.SelectorList:
                    result += CssTree.generateSelectorList(child);
                    break;

                case CssTreeNodeType.Raw:
                    result += child.value;
                    break;

                default:
                    // Fallback to CSSTree's default generate function
                    result += generate(child);
            }
        });

        return result;
    }

    /**
     * Helper function to generate a raw string from a function selector's children
     *
     * @param node Function node
     * @returns Generated function value
     * @example `responseheader(name)` -> `name`
     */
    public static generateFunctionValue(node: FunctionNode): string {
        let result = EMPTY;

        node.children?.forEach((child) => {
            switch (child.type) {
                case CssTreeNodeType.Raw:
                    result += child.value;
                    break;

                default:
                    // Fallback to CSSTree's default generate function
                    result += generate(child);
            }
        });

        return result;
    }

    /**
     * Helper function to generate a raw string from a function selector's children
     *
     * @param node Function node
     * @returns Generated function value
     * @example `responseheader(name)` -> `name`
     */
    public static generateFunctionPlainValue(node: FunctionNodePlain): string {
        const result: string[] = [];

        node.children?.forEach((child) => {
            switch (child.type) {
                case CssTreeNodeType.Raw:
                    result.push(child.value);
                    break;

                default:
                    // Fallback to CSSTree's default generate function
                    // TODO: Need to improve CSSTree types, until then we need to use any type here
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    result.push(generate(child as any));
            }
        });

        return result.join(EMPTY);
    }
}
