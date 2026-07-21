/**
 * @file Convenience parsing utilities that wrap parsing pipelines
 * for common use cases (domain lists, HTML filtering bodies, etc.).
 *
 * These functions are used by the converter modules to parse
 * strings into AST nodes without manually invoking the full pipeline.
 */

import { DomainListAstBuilder } from '../ast-builder/misc/domain-list';
import { RuleParserPipeline } from '../ast-builder/rule-parser';
import { CapacityOverflowError, REGION_DOMAINS, REGION_TOKENS } from '../errors/capacity-overflow-error';
import { MAX_DOMAIN_CAPACITY, MAX_TOKEN_CAPACITY } from '../limits';
import {
    type DomainList,
    type DomainListSeparator,
    type HtmlFilteringRule,
    type HtmlFilteringRuleBody,
    type Raw,
} from '../nodes-new';
import {
    createParserContext,
    CTX_STATUS_HARD_CAP,
    CTX_STATUS_OVERFLOW,
    domainRecordsOffset,
    initParserContext,
} from '../parser/context';
import { CR_DOMAIN_COUNT } from '../parser/cosmetic/constants';
import { DomainListParser } from '../parser/misc/domain-list';
import { TokenType } from '../tokenizer/token-types';
import { Tokenizer } from '../tokenizer/tokenizer';
import { PIPE_MODIFIER_SEPARATOR } from '../utils/constants';

const TOKEN_CAPACITY = 1024;

/**
 * Parses a domain list string into a DomainList AST node using the
 * full tokenize → structural-parse → AST-build pipeline.
 *
 * Properly handles regex domains with embedded separator characters
 * (e.g. `/example.(com\|org)/` when `|` is the domain separator).
 *
 * @param value Domain list string (e.g. `example.com|~example.org`).
 * @param _options Options (unused, kept for API compatibility).
 * @param start Starting offset for location tracking.
 * @param separator Separator character (`'|'` or `','`).
 *
 * @returns Parsed DomainList AST node.
 */
export const parseDomainList = (
    value: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _options: Record<string, unknown> = {},
    start = 0,
    separator: DomainListSeparator = PIPE_MODIFIER_SEPARATOR,
): DomainList => {
    const tokenizer = new Tokenizer(TOKEN_CAPACITY);
    // Tokenize the extracted value at offset 0; positions are relative to this string.
    tokenizer.setSource(value, 0);

    // `setSource` stops once the fixed token buffer fills up. If it did not
    // reach the end of the source, grow the buffer and retokenize from scratch
    // until the whole input is consumed (or the hard cap is hit). Without this,
    // long domain lists would be silently truncated to a token-limited prefix,
    // dropping trailing domains (e.g. tail exclusions) and broadening the
    // converted rule's scope.
    while (!tokenizer.eof()) {
        const requested = Math.min(tokenizer.types.length * 2, MAX_TOKEN_CAPACITY);
        if (requested <= tokenizer.types.length) {
            throw new CapacityOverflowError(REGION_TOKENS, requested, MAX_TOKEN_CAPACITY);
        }
        tokenizer.growCapacity(requested);
        tokenizer.offset = 0;
        tokenizer.tokenize();
    }

    const ctx = createParserContext(TOKEN_CAPACITY, 0, 128);
    initParserContext(ctx, value, tokenizer);

    const separatorType = separator === ','
        ? TokenType.Comma
        : TokenType.Pipe;

    DomainListParser.parse(ctx, 0, ctx.tokenCount, separatorType);

    // Surface structural overflow instead of returning a truncated domain list.
    if (ctx.status === CTX_STATUS_HARD_CAP) {
        throw new CapacityOverflowError(REGION_DOMAINS, MAX_DOMAIN_CAPACITY + 1, MAX_DOMAIN_CAPACITY);
    }
    if (ctx.status === CTX_STATUS_OVERFLOW) {
        throw new Error('Parser data buffer overflow: domain list too large for current capacity');
    }

    const domainCount = ctx.data[CR_DOMAIN_COUNT];
    const recordsOffset = domainRecordsOffset(ctx);

    const result = DomainListAstBuilder.parse(
        value,
        ctx.data,
        domainCount,
        recordsOffset,
        separator,
        true,
    );

    if (!result) {
        return {
            type: 'DomainList' as const,
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
