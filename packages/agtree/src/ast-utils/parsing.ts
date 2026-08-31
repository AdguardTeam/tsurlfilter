/**
 * @file Convenience parsing utilities that wrap parsing pipelines
 * for common use cases (domain lists, HTML filtering bodies, etc.).
 *
 * These functions are used by the converter modules to parse
 * strings into AST nodes without manually invoking the full pipeline.
 */

import { DomainListAstBuilder } from '../ast-builder/misc/domain-list';
import { ListAstBuilder } from '../ast-builder/misc/list';
import { ModifierAstBuilder } from '../ast-builder/misc/modifier';
import { RuleParserPipeline } from '../ast-builder/rule-parser';
import { CapacityOverflowError, REGION_DOMAINS, REGION_TOKENS } from '../errors/capacity-overflow-error';
import { MAX_DOMAIN_CAPACITY, MAX_TOKEN_CAPACITY } from '../limits';
import {
    type AppList,
    type DomainList,
    type DomainListSeparator,
    type HtmlFilteringRule,
    type HtmlFilteringRuleBody,
    ListItemNodeType,
    ListNodeType,
    type MethodList,
    type Modifier,
    NodeType,
    type Raw,
    type StealthOptionList,
    ValueKind,
} from '../nodes';
import {
    createParserContext,
    CTX_STATUS_HARD_CAP,
    CTX_STATUS_OVERFLOW,
    domainRecordsOffset,
    initParserContext,
} from '../parser/context';
import { CR_DOMAIN_COUNT } from '../parser/cosmetic/constants';
import { DomainListParser } from '../parser/misc/domain-list';
import { ModifierParser } from '../parser/misc/modifier';
import { NR_MODIFIER_RECORDS_OFFSET } from '../parser/network/constants';
import { TokenType } from '../tokenizer/token-types';
import { Tokenizer } from '../tokenizer/tokenizer';
import { PIPE_MODIFIER_SEPARATOR } from '../utils/constants';
import { isValidNoopModifier } from '../utils/noop-modifier';

const TOKEN_CAPACITY = 1024;

const NEGATION_MARKER = '~';
const ESCAPE_CHARACTER = '\\';

/**
 * Reused tokenizer + parser context for list parsing (domain/app/method/
 * stealth). These helpers run synchronously and consume their structural
 * output immediately, so sharing a single tokenizer/context across calls is
 * safe and avoids ~12KB of per-call allocation (mirrors RuleParserPipeline).
 */
const listTokenizer = new Tokenizer(TOKEN_CAPACITY);
const listCtx = createParserContext(TOKEN_CAPACITY, 0, 128);

/**
 * Reused tokenizer + parser context for single-modifier parsing.
 */
const modifierTokenizer = new Tokenizer(TOKEN_CAPACITY);
const modifierCtx = createParserContext(TOKEN_CAPACITY, 1, 0);

/**
 * Tokenizes `value` fully into `tokenizer`, growing the token buffer on
 * overflow until the entire source is consumed. Shared by the list and
 * modifier parsers, which both drive a reused tokenizer to completion.
 *
 * @param tokenizer Tokenizer to run (reused across calls).
 * @param value Source string to tokenize.
 *
 * @throws {CapacityOverflowError} If the token buffer cannot grow further.
 */
const tokenizeFully = (tokenizer: Tokenizer, value: string): void => {
    tokenizer.setSource(value, 0);

    while (!tokenizer.eof()) {
        const requested = Math.min(tokenizer.types.length * 2, MAX_TOKEN_CAPACITY);
        if (requested <= tokenizer.types.length) {
            throw new CapacityOverflowError(REGION_TOKENS, requested, MAX_TOKEN_CAPACITY);
        }
        tokenizer.growCapacity(requested);
        // Re-tokenize from the start with the grown buffer.
        tokenizer.setSource(value, 0);
    }
};

/**
 * Builds a best-effort {@link Modifier} node whose name is the raw string.
 * Used for inputs the structural parser cannot classify (joined modifiers,
 * noop modifiers, unknown patterns) so validators can decide validity —
 * matching the legacy parser's non-throwing behavior.
 *
 * @param value Raw modifier string used as the modifier name.
 * @param isLocIncluded Whether to attach source locations (`0..value.length`).
 *
 * @returns Fallback Modifier node.
 */
const createFallbackModifier = (value: string, isLocIncluded = false): Modifier => {
    const modifier: Modifier = {
        type: NodeType.Modifier,
        name: { type: NodeType.Value, kind: ValueKind.Identifier, value },
        exception: false,
    };

    if (isLocIncluded) {
        modifier.start = 0;
        modifier.end = value.length;
    }

    return modifier;
};

/**
 * Prefixes for error messages which are used for parsing of value lists.
 * Migrated from the legacy {@link ListItemsParser}.
 */
export const LIST_PARSE_ERROR_PREFIX = {
    EMPTY_ITEM: 'Empty value specified in the list',
    NO_MULTIPLE_NEGATION: 'Exception marker cannot be followed by another exception marker',
    NO_SEPARATOR_AFTER_NEGATION: 'Exception marker cannot be followed by a separator',
    NO_SEPARATOR_AT_THE_BEGINNING: 'Value list cannot start with a separator',
    NO_SEPARATOR_AT_THE_END: 'Value list cannot end with a separator',
    NO_WHITESPACE_AFTER_NEGATION: 'Exception marker cannot be followed by whitespace',
};

/**
 * Validates list syntax before structural parsing to match legacy
 * {@link ListItemsParser} error behavior for edge cases.
 *
 * @param value Raw list string.
 * @param separator Separator character.
 */
const validateListSyntax = (value: string, separator: string): void => {
    // Check for leading separator
    if (value.length > 0 && value[0] === separator) {
        throw new Error(LIST_PARSE_ERROR_PREFIX.NO_SEPARATOR_AT_THE_BEGINNING);
    }

    // Check for trailing separator (after trimming trailing whitespace)
    let end = value.length - 1;
    while (end >= 0 && (value[end] === ' ' || value[end] === '\t')) {
        end -= 1;
    }
    if (end >= 0 && value[end] === separator) {
        throw new Error(LIST_PARSE_ERROR_PREFIX.NO_SEPARATOR_AT_THE_END);
    }

    let escaped = false;
    for (let i = 0; i < value.length; i += 1) {
        const ch = value[i];

        if (escaped) {
            escaped = false;
            continue;
        }

        if (ch === ESCAPE_CHARACTER) {
            escaped = true;
            continue;
        }

        // Check for double separator
        if (ch === separator && i + 1 < value.length) {
            // Skip whitespace between separators
            let next = i + 1;
            while (next < value.length && (value[next] === ' ' || value[next] === '\t')) {
                next += 1;
            }
            if (next < value.length && value[next] === separator) {
                // Was `||` or `| |`
                throw new Error(LIST_PARSE_ERROR_PREFIX.EMPTY_ITEM);
            }
            // Check for whitespace followed by nothing or separator (empty item)
            if (next > i + 1 && (next >= value.length || value[next] === separator)) {
                throw new Error(LIST_PARSE_ERROR_PREFIX.EMPTY_ITEM);
            }
        }

        // Check for negation followed by negation
        if (ch === NEGATION_MARKER && i + 1 < value.length) {
            const next = value[i + 1];
            if (next === NEGATION_MARKER) {
                throw new Error(LIST_PARSE_ERROR_PREFIX.NO_MULTIPLE_NEGATION);
            }
            if (next === separator) {
                throw new Error(LIST_PARSE_ERROR_PREFIX.NO_SEPARATOR_AFTER_NEGATION);
            }
            if (next === ' ' || next === '\t') {
                throw new Error(LIST_PARSE_ERROR_PREFIX.NO_WHITESPACE_AFTER_NEGATION);
            }
        }
    }
};

/**
 * Tokenizes `value` and runs the structural list parser, returning the parsed
 * record buffer. Shared by parseDomainList / parseAppList / parseMethodList /
 * parseStealthOptionList.
 *
 * @param value Raw list string.
 * @param separator Separator character (`'|'` or `','`).
 *
 * @returns Parsed context data plus item count and record offset.
 */
const preparseListRecords = (
    value: string,
    separator: DomainListSeparator,
): { data: Int32Array; count: number; recordsOffset: number } => {
    validateListSyntax(value, separator);
    tokenizeFully(listTokenizer, value);

    const ctx = listCtx;
    initParserContext(ctx, value, listTokenizer);

    const separatorType = separator === ',' ? TokenType.Comma : TokenType.Pipe;
    DomainListParser.parse(ctx, 0, ctx.tokenCount, separatorType);

    if (ctx.status === CTX_STATUS_HARD_CAP) {
        throw new CapacityOverflowError(REGION_DOMAINS, MAX_DOMAIN_CAPACITY + 1, MAX_DOMAIN_CAPACITY);
    }
    if (ctx.status === CTX_STATUS_OVERFLOW) {
        throw new Error('Parser data buffer overflow: list too large for current capacity');
    }

    return {
        data: ctx.data,
        count: ctx.data[CR_DOMAIN_COUNT],
        recordsOffset: domainRecordsOffset(ctx),
    };
};

/**
 * Parses a domain list string into a DomainList AST node using the
 * full tokenize → structural-parse → AST-build pipeline.
 *
 * Properly handles regex domains with embedded separator characters
 * (e.g. `/example.(com\|org)/` when `|` is the domain separator).
 *
 * @param value Domain list string (e.g. `example.com|~example.org`).
 * @param start Starting offset for location tracking.
 * @param separator Separator character (`'|'` or `','`).
 *
 * @returns Parsed DomainList AST node.
 */
export const parseDomainList = (
    value: string,
    start = 0,
    separator: DomainListSeparator = PIPE_MODIFIER_SEPARATOR,
): DomainList => {
    const { data, count, recordsOffset } = preparseListRecords(value, separator);

    const result = DomainListAstBuilder.parse(
        value,
        data,
        count,
        recordsOffset,
        separator,
        true,
    );

    if (!result) {
        return {
            type: ListNodeType.DomainList,
            separator,
            children: [],
            start,
            end: start,
        };
    }

    // Offset the location info by `start` so positions reflect the original source.
    if (result.start !== undefined) {
        result.start += start;
    }
    if (result.end !== undefined) {
        result.end += start;
    }
    for (const child of result.children) {
        if (child.start !== undefined) {
            child.start += start;
        }
        if (child.end !== undefined) {
            child.end += start;
        }
    }

    return result;
};

/**
 * Parses a pipe-separated app list (`$app`) into an AppList AST node.
 *
 * @param value Raw app list (e.g. `Example.exe|~Bad.exe`).
 * @param isLocIncluded Whether to attach source locations.
 *
 * @returns Parsed AppList node.
 */
export const parseAppList = (value: string, isLocIncluded = false): AppList => {
    const { data, count, recordsOffset } = preparseListRecords(value, PIPE_MODIFIER_SEPARATOR);
    return ListAstBuilder.parse(
        value,
        data,
        count,
        recordsOffset,
        ListNodeType.AppList,
        ListItemNodeType.App,
        PIPE_MODIFIER_SEPARATOR,
        isLocIncluded,
    ) as AppList;
};

/**
 * Parses a pipe-separated method list (`$method`) into a MethodList AST node.
 *
 * @param value Raw method list (e.g. `get|post|~put`).
 * @param isLocIncluded Whether to attach source locations.
 *
 * @returns Parsed MethodList node.
 */
export const parseMethodList = (value: string, isLocIncluded = false): MethodList => {
    const { data, count, recordsOffset } = preparseListRecords(value, PIPE_MODIFIER_SEPARATOR);
    return ListAstBuilder.parse(
        value,
        data,
        count,
        recordsOffset,
        ListNodeType.MethodList,
        ListItemNodeType.Method,
        PIPE_MODIFIER_SEPARATOR,
        isLocIncluded,
    ) as MethodList;
};

/**
 * Parses a pipe-separated stealth option list into a StealthOptionList node.
 *
 * @param value Raw stealth option list (e.g. `referrer|~dpi`).
 * @param isLocIncluded Whether to attach source locations.
 *
 * @returns Parsed StealthOptionList node.
 */
export const parseStealthOptionList = (
    value: string,
    isLocIncluded = false,
): StealthOptionList => {
    const { data, count, recordsOffset } = preparseListRecords(value, PIPE_MODIFIER_SEPARATOR);
    return ListAstBuilder.parse(
        value,
        data,
        count,
        recordsOffset,
        ListNodeType.StealthOptionList,
        ListItemNodeType.StealthOption,
        PIPE_MODIFIER_SEPARATOR,
        isLocIncluded,
    ) as StealthOptionList;
};

/**
 * Parses a single modifier string (e.g. `domain=example.com`, `~third-party`)
 * into a Modifier AST node using the structural parser pipeline.
 *
 * @param value Raw modifier string.
 * @param isLocIncluded Whether to attach source locations.
 *
 * @returns Parsed Modifier node.
 *
 * @throws {Error} If the string is not a valid modifier.
 */
export const parseModifier = (value: string, isLocIncluded = false): Modifier => {
    // If the modifier contains a comma before any '=' sign, it is likely two
    // modifiers joined (e.g. 'third-party,important' or '~third-party,important').
    // Return the raw string as the modifier name so validators can reject it.
    // Commas that appear after an '=' are valid value content (e.g. regex).
    const searchStart = value.startsWith('~') ? 1 : 0;
    const eqIdx = value.indexOf('=', searchStart);
    const commaIdx = value.indexOf(',', searchStart);
    const hasUnescapedCommaBeforeEq = commaIdx >= 0 && (eqIdx < 0 || commaIdx < eqIdx);
    if (hasUnescapedCommaBeforeEq) {
        return createFallbackModifier(value);
    }

    tokenizeFully(modifierTokenizer, value);

    const ctx = modifierCtx;
    initParserContext(ctx, value, modifierTokenizer);

    const next = ModifierParser.parse(ctx, 0, 0, NR_MODIFIER_RECORDS_OFFSET, ctx.tokenCount);
    if (next === -1) {
        // Noop modifiers (any sequence of underscores) are valid but the
        // structural ModifierParser does not recognize them.
        if (isValidNoopModifier(value)) {
            return createFallbackModifier(value, isLocIncluded);
        }
        // Return a best-effort Modifier node with the raw string as the name.
        // This matches the legacy parser behavior of not throwing for unknown
        // patterns, allowing validators to decide what is valid.
        return createFallbackModifier(value);
    }

    return ModifierAstBuilder.parse(value, ctx.data, 0, isLocIncluded, NR_MODIFIER_RECORDS_OFFSET);
};

/**
 * Parses an HTML filtering rule body string into an HtmlFilteringRuleBody AST node.
 * Uses a dummy rule wrapper to leverage the full parsing pipeline.
 *
 * The body is wrapped with the AdGuard `$$` HTML filtering separator, so this
 * helper only accepts AdGuard-style HTML filtering bodies; uBO
 * `responseheader(...)` bodies use the `##^` route and must be parsed elsewhere
 * (see the header-removal converter).
 *
 * @param body Raw body (e.g. `script[tag-content="ad"]`).
 * @param options Pipeline parse options.
 * @param options.isLocIncluded Whether to include source location info on AST nodes.
 * @param options.parseHtmlFilteringRuleBodies Whether to parse the body as HTML filtering rule body.
 *
 * @returns Parsed HtmlFilteringRuleBody AST node.
 *
 * @throws If the body cannot be parsed.
 */
export const parseHtmlFilteringBody = (
    body: Raw,
    options?: { isLocIncluded?: boolean; parseHtmlFilteringRuleBodies?: boolean },
): HtmlFilteringRuleBody => {
    const pipeline = new RuleParserPipeline();
    // Wrap body value in a dummy rule so the pipeline can parse it
    // NOTE: Triple dollar signs are intentional — the first `$$` is the literal
    // AdGuard HTML filtering rule separator (`example.com$$<body>`), and the
    // `${body.value}` template expression injects the body content.
    const dummyRule = `$$${body.value}`;
    const rule = pipeline.parse(dummyRule, {
        isLocIncluded: options?.isLocIncluded ?? false,
        parseHtmlFilteringRuleBodies: options?.parseHtmlFilteringRuleBodies ?? true,
    }) as HtmlFilteringRule;
    return rule.body as HtmlFilteringRuleBody;
};
