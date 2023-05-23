/**
 * @file HTML filtering rule body parser
 */

import {
    fromPlainObject,
    FunctionNodePlain,
    generate,
    SelectorList,
    SelectorListPlain,
} from '@adguard/ecss-tree';
import { AdblockSyntax } from '../../../utils/adblockers';
import { EMPTY, ESCAPE_CHARACTER } from '../../../utils/constants';
import { CssTree } from '../../../utils/csstree';
import { CssTreeParserContext } from '../../../utils/csstree-constants';
import { DOUBLE_QUOTE_MARKER } from '../../../utils/string';
import { defaultLocation, HtmlFilteringRuleBody } from '../../common';
import { locRange } from '../../../utils/location';
import { AdblockSyntaxError } from '../../errors/adblock-syntax-error';

/**
 * `HtmlBodyParser` is responsible for parsing the body of HTML filtering rules.
 *
 * Please note that this parser will read ANY selector if it is syntactically correct.
 * Checking whether this selector is actually compatible with a given adblocker is not
 * done at this level.
 *
 * @see {@link https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#html-filtering-rules}
 * @see {@link https://github.com/gorhill/uBlock/wiki/Static-filter-syntax#html-filters}
 */
export class HtmlFilteringBodyParser {
    /**
     * Convert "" to \" within strings, because CSSTree does not recognize "".
     *
     * @param selector CSS selector string
     * @returns Escaped CSS selector
     * @see {@link https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#tag-content}
     */
    public static escapeDoubleQuotes(selector: string): string {
        let withinString = false;
        let result = EMPTY;

        for (let i = 0; i < selector.length; i += 1) {
            if (!withinString && selector[i] === DOUBLE_QUOTE_MARKER) {
                withinString = true;
                result += selector[i];
            } else if (withinString && selector[i] === DOUBLE_QUOTE_MARKER && selector[i + 1] === DOUBLE_QUOTE_MARKER) {
                result += ESCAPE_CHARACTER + DOUBLE_QUOTE_MARKER;
                i += 1;
            } else if (withinString && selector[i] === DOUBLE_QUOTE_MARKER && selector[i + 1] !== DOUBLE_QUOTE_MARKER) {
                result += DOUBLE_QUOTE_MARKER;
                withinString = false;
            } else {
                result += selector[i];
            }
        }

        return result;
    }

    /**
     * Convert \" to "" within strings.
     *
     * @param selector CSS selector string
     * @returns Unescaped CSS selector
     * @see {@link https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#tag-content}
     */
    public static unescapeDoubleQuotes(selector: string): string {
        let withinString = false;
        let result = EMPTY;

        for (let i = 0; i < selector.length; i += 1) {
            if (selector[i] === DOUBLE_QUOTE_MARKER && selector[i - 1] !== ESCAPE_CHARACTER) {
                withinString = !withinString;
                result += selector[i];
            } else if (withinString && selector[i] === ESCAPE_CHARACTER && selector[i + 1] === DOUBLE_QUOTE_MARKER) {
                result += DOUBLE_QUOTE_MARKER;
            } else {
                result += selector[i];
            }
        }

        return result;
    }

    /**
     * Parses a raw cosmetic rule body as an HTML filtering rule body.
     * Please note that compatibility is not yet checked at this point.
     *
     * @param raw Raw body
     * @param loc Location of the body
     * @throws If the body is not syntactically correct (CSSTree throws)
     * @returns HTML filtering rule body AST
     */
    public static parse(raw: string, loc = defaultLocation): HtmlFilteringRuleBody {
        // Convert "" to \" (this theoretically does not affect the uBlock rules)
        const escapedRawBody = HtmlFilteringBodyParser.escapeDoubleQuotes(raw);

        // eslint-disable-next-line max-len
        let body: SelectorListPlain | FunctionNodePlain | undefined;

        try {
            // Try to parse the body as a CSS selector list (default)
            body = <SelectorListPlain>CssTree.parsePlain(escapedRawBody, CssTreeParserContext.selectorList, false, loc);
        } catch (error: unknown) {
            // If the body is not a selector list, it might be a function node: `example.org##^responseheader(name)`
            // We should check this error "strictly", because we don't want to loose other previously detected selector
            // errors (if any).
            if (error instanceof Error && error.message.indexOf('Selector is expected') !== -1) {
                const ast = CssTree.parsePlain(escapedRawBody, CssTreeParserContext.value, false, loc);

                if (ast.type !== 'Value') {
                    throw new AdblockSyntaxError(
                        `Expected a 'Value' node first child, got '${ast.type}'`,
                        locRange(loc, 0, raw.length),
                    );
                }

                // First child must be a function node
                const func = ast.children[0];

                if (func.type !== 'Function') {
                    throw new AdblockSyntaxError(
                        `Expected a 'Function' node, got '${func.type}'`,
                        locRange(loc, 0, raw.length),
                    );
                }

                body = func;
            } else {
                throw error;
            }
        }

        return {
            type: 'HtmlFilteringRuleBody',
            loc: locRange(loc, 0, raw.length),
            body,
        };
    }

    /**
     * Converts an HTML filtering rule body AST to a string.
     *
     * @param ast HTML filtering rule body AST
     * @param syntax Desired syntax of the generated result
     * @returns Raw string
     */
    public static generate(ast: HtmlFilteringRuleBody, syntax: AdblockSyntax = AdblockSyntax.Adg): string {
        if (syntax === AdblockSyntax.Adg && ast.body.type === 'Function') {
            throw new Error('AdGuard syntax does not support function nodes');
        }

        let result = EMPTY;

        if (ast.body.type === 'SelectorList') {
            result = CssTree.generateSelectorList(<SelectorList>fromPlainObject(ast.body));
        } else if (ast.body.type === 'Function') {
            result = generate(fromPlainObject(ast.body));
        } else {
            throw new Error('Unexpected body type');
        }

        // In the case of AdGuard syntax, the "" case must be handled
        if (syntax === AdblockSyntax.Adg) {
            result = HtmlFilteringBodyParser.unescapeDoubleQuotes(result);
        }

        return result;
    }
}
