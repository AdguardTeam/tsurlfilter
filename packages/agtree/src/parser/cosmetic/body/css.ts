/**
 * @file CSS injection rule body parser
 */

import {
    type CssNode,
    type DeclarationList,
    type DeclarationListPlain,
    type DeclarationPlain,
    List,
    type MediaQueryList,
    type MediaQueryListPlain,
    type Rule,
    type Selector,
    type SelectorList,
    type SelectorListPlain,
    fromPlainObject,
    toPlainObject,
    walk,
} from '@adguard/ecss-tree';

import { AdblockSyntax } from '../../../utils/adblockers';
import { CssTree } from '../../../utils/csstree';
import { CssTreeNodeType, CssTreeParserContext } from '../../../utils/csstree-constants';
import { type CssInjectionRuleBody, defaultLocation } from '../../common';
import { AdblockSyntaxError } from '../../../errors/adblock-syntax-error';
import { locRange, shiftLoc } from '../../../utils/location';
import {
    AT_SIGN,
    CLOSE_CURLY_BRACKET,
    CLOSE_PARENTHESIS,
    COLON,
    EMPTY,
    OPEN_CURLY_BRACKET,
    OPEN_PARENTHESIS,
    SEMICOLON,
    SPACE,
} from '../../../utils/constants';

const NONE = 'None';

const MEDIA = 'media';
const TRUE = 'true';
const REMOVE = 'remove';
const STYLE = 'style';
const MATCHES_MEDIA = 'matches-media';

const MEDIA_MARKER = AT_SIGN + MEDIA; // @media
const REMOVE_DECLARATION = REMOVE + COLON + SPACE + TRUE + SEMICOLON; // remove: true;

const SPECIAL_PSEUDO_CLASSES = [
    MATCHES_MEDIA,
    STYLE,
    REMOVE,
];

/**
 * `selectorList:style(declarations)` or `selectorList:remove()`
 */
// eslint-disable-next-line max-len
const UBO_CSS_INJECTION_PATTERN = /^(?<selectors>.+)(?:(?<style>:style\()(?<declarations>.+)\)|(?<remove>:remove\(\)))$/;

/**
 * `selectorList { declarations }`
 */
const ADG_CSS_INJECTION_PATTERN = /^(?:.+){(?:.+)}$/;

/**
 * `CssInjectionBodyParser` is responsible for parsing a CSS injection body.
 *
 * Please note that not all adblockers support CSS injection in the same way, e.g. uBO does not support media queries.
 *
 * Example rules (AdGuard):
 *  - ```adblock
 *    example.com#$#body { padding-top: 0 !important; }
 *    ```
 *  - ```adblock
 *    example.com#$#@media (min-width: 1024px) { body { padding-top: 0 !important; } }
 *    ```
 *  - ```adblock
 *    example.com#$?#@media (min-width: 1024px) { .something:has(.ads) { padding-top: 0 !important; } }
 *    ```
 *  - ```adblock
 *    example.com#$#.ads { remove: true; }
 *    ```
 *
 * Example rules (uBlock Origin):
 *  - ```adblock
 *    example.com##body:style(padding-top: 0 !important;)
 *    ```
 *  - ```adblock
 *    example.com##.ads:remove()
 *    ```
 *
 * @see {@link https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#cosmetic-css-rules}
 * @see {@link https://github.com/gorhill/uBlock/wiki/Static-filter-syntax#subjectstylearg}
 * @see {@link https://github.com/gorhill/uBlock/wiki/Static-filter-syntax#subjectremove}
 */
export class CssInjectionBodyParser {
    /**
     * Checks if a selector is a uBlock CSS injection.
     *
     * @param raw Raw selector body
     * @returns `true` if the selector is a uBlock CSS injection, `false` otherwise
     */
    public static isUboCssInjection(raw: string): boolean {
        const trimmed = raw.trim();

        // Since it runs on every element hiding rule, we want to avoid unnecessary regex checks,
        // so we first check if the selector contains either `:style(` or `:remove(`.
        if (
            trimmed.indexOf(COLON + STYLE + OPEN_PARENTHESIS) !== -1
            || trimmed.indexOf(COLON + REMOVE + OPEN_PARENTHESIS) !== -1
        ) {
            return UBO_CSS_INJECTION_PATTERN.test(trimmed);
        }

        return false;
    }

    /**
     * Checks if a selector is an AdGuard CSS injection.
     *
     * @param raw Raw selector body
     * @returns `true` if the selector is an AdGuard CSS injection, `false` otherwise
     */
    public static isAdgCssInjection(raw: string) {
        return ADG_CSS_INJECTION_PATTERN.test(raw.trim());
    }

    /**
     * Parses a uBlock Origin CSS injection body.
     *
     * @param raw Raw CSS injection body
     * @param loc Location of the body
     * @returns Parsed CSS injection body
     * @throws {AdblockSyntaxError} If the body is invalid or unsupported
     */
    private static parseUboStyleInjection(raw: string, loc = defaultLocation): CssInjectionRuleBody {
        const selectorList = CssTree.parse(raw, CssTreeParserContext.selectorList, false, loc);

        const plainSelectorList: SelectorListPlain = {
            type: CssTreeNodeType.SelectorList,
            children: [],
        };

        let mediaQueryList: MediaQueryListPlain | undefined;
        let declarationList: DeclarationListPlain | undefined;
        let remove: boolean | undefined;

        // Check selector list
        if (selectorList.type !== CssTreeNodeType.SelectorList) {
            throw new AdblockSyntaxError(
                // eslint-disable-next-line max-len
                `Invalid selector list, expected '${CssTreeNodeType.SelectorList}' but got '${selectorList.type || NONE}' instead`,
                locRange(loc, 0, raw.length),
            );
        }

        // Convert selector list to regular array
        const selectors = selectorList.children.toArray();

        // Iterate over selectors
        for (let i = 0; i < selectors.length; i += 1) {
            // Store current selector (just for convenience)
            const selector = selectors[i];

            // Type guard for the actual selector
            if (selector.type !== CssTreeNodeType.Selector) {
                throw new AdblockSyntaxError(
                    // eslint-disable-next-line max-len
                    `Invalid selector, expected '${CssTreeNodeType.Selector}' but got '${selector.type || NONE}' instead`,
                    {
                        start: selector.loc?.start ?? loc,
                        end: selector.loc?.end ?? shiftLoc(loc, raw.length),
                    },
                );
            }

            // Not the last selector
            if (i !== selectors.length - 1) {
                // Special pseudo-classes (:style, :remove, :matches-media) can only be used in the last selector
                walk(selector, (node) => {
                    // eslint-disable-next-line max-len
                    if (node.type === CssTreeNodeType.PseudoClassSelector && SPECIAL_PSEUDO_CLASSES.includes(node.name)) {
                        throw new AdblockSyntaxError(
                            `Invalid selector, pseudo-class '${node.name}' can only be used in the last selector`,
                            {
                                start: node.loc?.start ?? loc,
                                end: node.loc?.end ?? shiftLoc(loc, raw.length),
                            },
                        );
                    }
                });

                // Add selector to plain selector list
                plainSelectorList.children.push(toPlainObject(selector));
            } else if (i === selectors.length - 1) {
                // Last selector can (should) contain special pseudo-classes
                const regularSelector: Selector = {
                    type: CssTreeNodeType.Selector,
                    children: new List<CssNode>(),
                };

                let depth = 0;

                walk(selector, {
                    // eslint-disable-next-line @typescript-eslint/no-loop-func
                    enter: (node: CssNode) => {
                        // Increment depth
                        depth += 1;

                        if (node.type === CssTreeNodeType.PseudoClassSelector) {
                            if (SPECIAL_PSEUDO_CLASSES.includes(node.name)) {
                                // Only allow special pseudo-classes at the top level
                                // Depth look like this:
                                //   1: Selector (root)
                                //   2: Direct child of the root selector (e.g. TypeSelector, PseudoClassSelector, etc.)
                                //      ...
                                if (depth !== 2) {
                                    throw new AdblockSyntaxError(
                                        // eslint-disable-next-line max-len
                                        `Invalid selector, pseudo-class '${node.name}' can only be used at the top level of the selector`,
                                        {
                                            start: node.loc?.start ?? loc,
                                            end: node.loc?.end ?? shiftLoc(loc, raw.length),
                                        },
                                    );
                                }

                                // :matches-media(...)
                                if (node.name === MATCHES_MEDIA) {
                                    if (mediaQueryList) {
                                        throw new AdblockSyntaxError(
                                            `Duplicated pseudo-class '${node.name}'`,
                                            {
                                                start: node.loc?.start ?? loc,
                                                end: node.loc?.end ?? shiftLoc(loc, raw.length),
                                            },
                                        );
                                    }

                                    // eslint-disable-next-line max-len
                                    if (!node.children || !node.children.first || node.children.first.type !== CssTreeNodeType.MediaQueryList) {
                                        throw new AdblockSyntaxError(
                                            // eslint-disable-next-line max-len
                                            `Invalid selector, pseudo-class '${node.name}' must be parametrized with a media query list`,
                                            {
                                                start: node.loc?.start ?? loc,
                                                end: node.loc?.end ?? shiftLoc(loc, raw.length),
                                            },
                                        );
                                    }

                                    // Store media query list, but convert it to a plain object first
                                    mediaQueryList = <MediaQueryListPlain>toPlainObject(node.children.first);
                                    return;
                                }

                                // :style(...)
                                if (node.name === STYLE) {
                                    if (declarationList) {
                                        throw new AdblockSyntaxError(
                                            `Duplicated pseudo-class '${node.name}'`,
                                            {
                                                start: node.loc?.start ?? loc,
                                                end: node.loc?.end ?? shiftLoc(loc, raw.length),
                                            },
                                        );
                                    }

                                    // Remove selected elements or style them, but not both
                                    if (remove) {
                                        throw new AdblockSyntaxError(
                                            `'${STYLE}' and '${REMOVE}' cannot be used together`,
                                            {
                                                start: node.loc?.start ?? loc,
                                                end: node.loc?.end ?? shiftLoc(loc, raw.length),
                                            },
                                        );
                                    }

                                    // eslint-disable-next-line max-len
                                    if (!node.children || !node.children.first || node.children.first.type !== CssTreeNodeType.DeclarationList) {
                                        throw new AdblockSyntaxError(
                                            // eslint-disable-next-line max-len
                                            `Invalid selector, pseudo-class '${node.name}' must be parametrized with a declaration list`,
                                            {
                                                start: node.loc?.start ?? loc,
                                                end: node.loc?.end ?? shiftLoc(loc, raw.length),
                                            },
                                        );
                                    }

                                    // Store declaration list, but convert it to plain object first
                                    declarationList = <DeclarationListPlain>toPlainObject(node.children.first);
                                    return;
                                }

                                // :remove()
                                if (node.name === REMOVE) {
                                    if (remove) {
                                        throw new AdblockSyntaxError(
                                            `Duplicated pseudo-class '${node.name}'`,
                                            {
                                                start: node.loc?.start ?? loc,
                                                end: node.loc?.end ?? shiftLoc(loc, raw.length),
                                            },
                                        );
                                    }

                                    // Remove selected elements or style them, but not both
                                    if (declarationList) {
                                        throw new AdblockSyntaxError(
                                            `'${STYLE}' and '${REMOVE}' cannot be used together`,
                                            {
                                                start: node.loc?.start ?? loc,
                                                end: node.loc?.end ?? shiftLoc(loc, raw.length),
                                            },
                                        );
                                    }

                                    // Set remove flag to true (and don't store anything)
                                    remove = true;
                                    return;
                                }
                            }
                        }

                        // If the node is a direct child of the selector (depth === 2) and it's not a special
                        // pseudo-class, then it's a regular selector element, so add it to the regular selector
                        // (We split the selector into two parts: regular selector and special pseudo-classes)
                        if (depth === 2) {
                            // Regular selector elements can't be used after special pseudo-classes
                            if (mediaQueryList || declarationList || remove) {
                                throw new AdblockSyntaxError(
                                    // eslint-disable-next-line max-len
                                    'Invalid selector, regular selector elements can\'t be used after special pseudo-classes',
                                    {
                                        start: node.loc?.start ?? loc,
                                        end: shiftLoc(loc, raw.length),
                                    },
                                );
                            }

                            regularSelector.children.push(node);
                        }
                    },
                    leave: () => {
                        // Decrement depth
                        depth -= 1;
                    },
                });

                // Store the last selector with special pseudo-classes
                plainSelectorList.children.push(toPlainObject(regularSelector));
            }
        }

        // At least one of the following must be present: declaration list, :remove() pseudo-class
        if (!declarationList && !remove) {
            throw new AdblockSyntaxError(
                'No CSS declaration list or :remove() pseudo-class found',
                locRange(loc, 0, raw.length),
            );
        }

        return {
            type: 'CssInjectionRuleBody',
            loc: locRange(loc, 0, raw.length),
            selectorList: plainSelectorList,
            mediaQueryList,
            declarationList,
            remove,
        };
    }

    /**
     * Parse a CSS injection rule body from a raw string. It determines the syntax
     * automatically.
     *
     * @param raw Raw CSS injection rule body
     * @param loc Location of the body
     * @returns CSS injection rule body AST
     * @throws {AdblockSyntaxError} If the raw string is not a valid CSS injection rule body
     */
    public static parse(raw: string, loc = defaultLocation): CssInjectionRuleBody {
        // Parse stylesheet in tolerant mode.
        // "stylesheet" context handles "at-rules" and "rules", but if we only have a single
        // selector, then the strict parser will throw an error, but the tolerant parser will
        // parses it as a raw fragment.
        const stylesheet = CssTree.parse(raw, CssTreeParserContext.stylesheet, true, loc);

        // Check stylesheet
        if (stylesheet.type !== CssTreeNodeType.StyleSheet) {
            throw new AdblockSyntaxError(
                `Invalid stylesheet, expected '${CssTreeNodeType.StyleSheet}' but got '${stylesheet.type}' instead`,
                {
                    start: stylesheet.loc?.start ?? loc,
                    end: stylesheet.loc?.end ?? shiftLoc(loc, raw.length),
                },
            );
        }

        // Stylesheet should contain a single rule
        if (stylesheet.children.size !== 1) {
            throw new AdblockSyntaxError(
                `Invalid stylesheet, expected a single rule but got ${stylesheet.children.size} instead`,
                {
                    start: stylesheet.loc?.start ?? loc,
                    end: stylesheet.loc?.end ?? shiftLoc(loc, raw.length),
                },
            );
        }

        // At this point there are 3 possible cases:
        //
        // 1. At-rule (ADG):
        //      @media (media query list) { selector list { declaration list } }
        //      @media (media query list) { selector list { remove: true; } }
        //
        // 2. Rule (ADG):
        //      selector list { declaration list }
        //      selector list { remove: true; }
        //
        // 3. Raw:
        //      selector list:style(declaration list)
        //      selector list:remove()
        //      selector list:matches-media(media query list):style(declaration list)
        //      selector list:matches-media(media query list):remove()
        //      invalid input
        //
        const injection = stylesheet.children.first;

        if (!injection) {
            throw new AdblockSyntaxError(
                'Invalid style injection, expected a CSS rule or at-rule, but got nothing',
                {
                    start: stylesheet.loc?.start ?? loc,
                    end: stylesheet.loc?.end ?? shiftLoc(loc, raw.length),
                },
            );
        }

        let mediaQueryList: MediaQueryList | undefined;
        let rule: Rule;

        // Try to parse Raw fragment as uBO style injection
        if (injection.type === CssTreeNodeType.Raw) {
            return CssInjectionBodyParser.parseUboStyleInjection(raw, loc);
        }

        // Parse AdGuard style injection
        if (injection.type !== CssTreeNodeType.Rule && injection.type !== CssTreeNodeType.Atrule) {
            throw new AdblockSyntaxError(
                // eslint-disable-next-line max-len
                `Invalid injection, expected '${CssTreeNodeType.Rule}' or '${CssTreeNodeType.Atrule}' but got '${injection.type ?? NONE}' instead`,
                {
                    start: injection.loc?.start ?? loc,
                    end: injection.loc?.end ?? shiftLoc(loc, raw.length),
                },
            );
        }

        // At-rule injection (typically used for media queries, but later can be extended easily)
        // TODO: Extend to support other at-rules if needed
        if (injection.type === CssTreeNodeType.Atrule) {
            const atrule = injection;

            // Check at-rule name
            if (atrule.name !== MEDIA) {
                throw new AdblockSyntaxError(
                    `Invalid at-rule name, expected '${MEDIA_MARKER}' but got '${AT_SIGN}${atrule.name}' instead`,
                    {
                        start: atrule.loc?.start ?? loc,
                        end: atrule.loc?.end ?? shiftLoc(loc, raw.length),
                    },
                );
            }

            // Check at-rule prelude
            if (!atrule.prelude || atrule.prelude.type !== CssTreeNodeType.AtrulePrelude) {
                throw new AdblockSyntaxError(
                    // eslint-disable-next-line max-len
                    `Invalid at-rule prelude, expected '${CssTreeNodeType.AtrulePrelude}' but got '${atrule.prelude?.type ?? NONE}' instead`,
                    {
                        start: atrule.loc?.start ?? loc,
                        end: atrule.loc?.end ?? shiftLoc(loc, raw.length),
                    },
                );
            }

            // At-rule prelude should contain a single media query list
            // eslint-disable-next-line max-len
            if (!atrule.prelude.children.first || atrule.prelude.children.first.type !== CssTreeNodeType.MediaQueryList) {
                throw new AdblockSyntaxError(
                    // eslint-disable-next-line max-len
                    `Invalid at-rule prelude, expected a media query list but got '${atrule.prelude.children.first?.type ?? NONE}' instead`,
                    {
                        start: atrule.loc?.start ?? loc,
                        end: atrule.loc?.end ?? shiftLoc(loc, raw.length),
                    },
                );
            }

            // Check at-rule block
            if (!atrule.block || atrule.block.type !== CssTreeNodeType.Block) {
                throw new AdblockSyntaxError(
                    // eslint-disable-next-line max-len
                    `Invalid at-rule block, expected '${CssTreeNodeType.Block}' but got '${atrule.block?.type ?? NONE}' instead`,
                    {
                        start: atrule.loc?.start ?? loc,
                        end: atrule.loc?.end ?? shiftLoc(loc, raw.length),
                    },
                );
            }

            // At-rule block should contain a single rule
            if (!atrule.block.children.first || atrule.block.children.first.type !== CssTreeNodeType.Rule) {
                throw new AdblockSyntaxError(
                    // eslint-disable-next-line max-len
                    `Invalid at-rule block, expected a rule but got '${atrule.block.children.first?.type ?? NONE}' instead`,
                    {
                        start: atrule.loc?.start ?? loc,
                        end: atrule.loc?.end ?? shiftLoc(loc, raw.length),
                    },
                );
            }

            mediaQueryList = atrule.prelude.children.first;
            rule = atrule.block.children.first;
        } else {
            // Otherwise the whole injection is a simple CSS rule (without at-rule)
            rule = injection;
        }

        // Check rule prelude
        if (!rule.prelude || rule.prelude.type !== CssTreeNodeType.SelectorList) {
            throw new AdblockSyntaxError(
                `Invalid rule prelude, expected a selector list but got '${rule.prelude?.type ?? NONE}' instead`,
                {
                    start: rule.loc?.start ?? loc,
                    end: rule.loc?.end ?? shiftLoc(loc, raw.length),
                },
            );
        }

        // Don't allow :remove() in the selector list at this point, because
        // it doesn't make sense to have it here:
        //  - we parsed 'selector list:remove()' case as uBO-way before, and
        //  - we parse 'selector list { remove: true; }' case as ADG-way
        //    at the end of this function
        walk(rule.prelude, (node) => {
            if (node.type === CssTreeNodeType.PseudoClassSelector) {
                if (node.name === REMOVE) {
                    throw new AdblockSyntaxError(
                        `Invalid selector list, '${REMOVE}' pseudo-class should be used in the declaration list`,
                        {
                            start: node.loc?.start ?? loc,
                            end: node.loc?.end ?? shiftLoc(loc, raw.length),
                        },
                    );
                }
            }
        });

        // Check rule block
        if (!rule.block || rule.block.type !== CssTreeNodeType.Block) {
            throw new AdblockSyntaxError(
                `Invalid rule block, expected a block but got '${rule.block?.type ?? NONE}' instead`,
                locRange(loc, rule.loc?.start.offset ?? 0, raw.length),
            );
        }

        // Rule block should contain a Declaration nodes
        rule.block.children.forEach((node) => {
            if (node.type !== CssTreeNodeType.Declaration) {
                throw new AdblockSyntaxError(
                    `Invalid rule block, expected a declaration but got '${node.type}' instead`,
                    {
                        start: node.loc?.start ?? loc,
                        end: node.loc?.end ?? shiftLoc(loc, raw.length),
                    },
                );
            }
        });

        const declarationList: DeclarationListPlain = {
            type: 'DeclarationList',
            loc: rule.block.loc,
            children: [],
        };

        const declarationKeys: string[] = [];
        let remove = false;

        // Walk through the rule block and collect declarations
        walk(rule.block, {
            enter(node: CssNode) {
                if (node.type === CssTreeNodeType.Declaration) {
                    declarationList.children.push(<DeclarationPlain>toPlainObject(node));
                    declarationKeys.push(node.property);
                }
            },
        });

        // Check for "remove" declaration
        if (declarationKeys.includes(REMOVE)) {
            if (declarationKeys.length > 1) {
                throw new AdblockSyntaxError(
                    `Invalid declaration list, '${REMOVE}' declaration should be used alone`,
                    {
                        start: rule.block.loc?.start ?? loc,
                        end: rule.block.loc?.end ?? shiftLoc(loc, raw.length),
                    },
                );
            }

            remove = true;
        }

        // It is safe to cast plain objects here
        return {
            type: 'CssInjectionRuleBody',
            loc: locRange(loc, 0, raw.length),
            mediaQueryList: mediaQueryList ? <MediaQueryListPlain>toPlainObject(mediaQueryList) : undefined,
            selectorList: <SelectorListPlain>toPlainObject(rule.prelude),
            declarationList: remove ? undefined : declarationList,
            remove,
        };
    }

    /**
     * Generates a string representation of the CSS injection rule body (serialized).
     *
     * @param ast Raw CSS injection rule body
     * @param syntax Syntax to use (default: AdGuard)
     * @returns String representation of the CSS injection rule body
     * @throws If the body is invalid
     */
    public static generate(ast: CssInjectionRuleBody, syntax: AdblockSyntax = AdblockSyntax.Adg): string {
        let result = EMPTY;

        if (ast.remove && ast.declarationList) {
            throw new Error('Invalid body, both "remove" and "declarationList" are present');
        }

        if (syntax === AdblockSyntax.Adg) {
            if (ast.mediaQueryList) {
                result += MEDIA_MARKER;
                result += SPACE;
                result += CssTree.generateMediaQueryList(<MediaQueryList>fromPlainObject(ast.mediaQueryList));
                result += SPACE;
                result += OPEN_CURLY_BRACKET;
                result += SPACE;
            }

            result += CssTree.generateSelectorList(<SelectorList>fromPlainObject(ast.selectorList));

            result += SPACE;
            result += OPEN_CURLY_BRACKET;
            result += SPACE;

            if (ast.remove) {
                result += REMOVE_DECLARATION;
            } else if (ast.declarationList) {
                result += CssTree.generateDeclarationList(<DeclarationList>fromPlainObject(ast.declarationList));
            } else {
                throw new Error('Invalid body');
            }

            result += SPACE;
            result += CLOSE_CURLY_BRACKET;

            if (ast.mediaQueryList) {
                result += SPACE;
                result += CLOSE_CURLY_BRACKET;
            }
        } else if (syntax === AdblockSyntax.Ubo) {
            // Generate regular selector list
            result += CssTree.generateSelectorList(<SelectorList>fromPlainObject(ast.selectorList));

            // Generate media query list, if present (:matches-media(...))
            if (ast.mediaQueryList) {
                result += COLON;
                result += MATCHES_MEDIA;
                result += OPEN_PARENTHESIS;
                result += CssTree.generateMediaQueryList(<MediaQueryList>fromPlainObject(ast.mediaQueryList));
                result += CLOSE_PARENTHESIS;
            }

            // Generate remove or style pseudo-class (:remove() or :style(...))
            if (ast.remove) {
                result += COLON;
                result += REMOVE;
                result += OPEN_PARENTHESIS;
                result += CLOSE_PARENTHESIS;
            } else if (ast.declarationList) {
                result += COLON;
                result += STYLE;
                result += OPEN_PARENTHESIS;
                result += CssTree.generateDeclarationList(<DeclarationList>fromPlainObject(ast.declarationList));
                result += CLOSE_PARENTHESIS;
            } else {
                throw new Error('Invalid body');
            }
        } else {
            throw new Error(`Unsupported syntax: ${syntax}`);
        }

        return result;
    }
}
