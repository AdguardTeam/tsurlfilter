/* eslint-disable no-bitwise */

/**
 * @file CSS injection cosmetic rule AST builder.
 *
 * Reads parsed data from ctx.data and builds CssInjectionRule AST nodes
 * for ADG CSS injection rules (#$#, #@$#, #$?#, #@$?#).
 */

import type {
    CssInjectionRule,
    CssInjectionRuleBody,
    DomainList,
    ModifierList,
    Raw,
    SelectorList,
    Value,
} from '../../nodes-new';
import {
    CosmeticRuleType,
    ListNodeType,
    NodeType,
    RuleCategory,
    ValueKind,
} from '../../nodes-new';
import { MAX_MODIFIER_RECORD_STRIDE } from '../../parser/context';
import type { ParserContext } from '../../parser/context';
import {
    CR_BODY_END,
    CR_BODY_START,
    CR_DOMAIN_COUNT,
    CR_FLAG_EXCEPTION,
    CR_FLAG_HAS_ADG_MODS,
    CR_FLAGS_OFFSET,
    CR_MODIFIER_COUNT_OFFSET,
    CR_MODIFIER_RECORDS_OFFSET,
    CR_SEP_LEN_MASK,
    CR_SEP_LEN_SHIFT,
    CR_SEP_SOURCE_START,
    CSS_INJ_DL_END_TI,
    CSS_INJ_DL_SOURCE_END,
    CSS_INJ_DL_SOURCE_START,
    CSS_INJ_DL_START_TI,
    CSS_INJ_FLAG_HAS_MEDIA,
    CSS_INJ_FLAG_REMOVE,
    CSS_INJ_FLAGS,
    CSS_INJ_MEDIA_QUERY_END,
    CSS_INJ_MEDIA_QUERY_START,
    CSS_INJ_SL_END_TI,
    CSS_INJ_SL_SOURCE_END,
    CSS_INJ_SL_SOURCE_START,
    CSS_INJ_SL_START_TI,
    DOMAIN_RECORD_STRIDE,
} from '../../parser/cosmetic/constants';
import { DeclarationListParser } from '../../parser/css/declaration-list';
import { DEFAULT_MAX_DECLARATIONS } from '../../parser/css/declaration-list/constants';
import { SelectorListParser } from '../../parser/css/selector-list';
import { DEFAULT_MAX_COMPLEX } from '../../parser/css/selector-list/constants';
import { COMMA } from '../../utils/constants';
import { SYNTAX_ABP, SYNTAX_ADG, type SyntaxFlags } from '../../utils/syntax-flags';
import { DomainListAstBuilder } from '../misc/domain-list';
import { ModifierListAstBuilder } from '../misc/modifier-list';
import { type ParseOptions } from '../options';

import { DeclarationListAstBuilder } from './declaration-list/declaration-list';
import { SelectorListAstBuilder } from './selector-list/selector-list';

/**
 * CSS injection cosmetic rule AST builder.
 *
 * Handles ADG CSS injection rules where the separator is `#$#`, `#@$#`,
 * `#$?#`, or `#@$?#` and the body contains a CSS block `selector { decl }`,
 * optionally wrapped in `@media`.
 */
export class CssInjectionAstBuilder {
    /**
     * Parse a CSS injection rule from parsed data.
     *
     * @param source Source string.
     * @param data Int32Array with parsed data.
     * @param dataOffset Offset within `data` where the cosmetic rule header starts.
     * @param maxMods Maximum number of modifiers (for computing domain offset).
     * @param maxDomains Maximum number of domains (for computing CSS injection data offset).
     * @param options Parse options.
     * @param ctx Optional parser context. When provided together with
     *   `parseCssSelectorList` or `parseCssDeclarationList` options, the
     *   corresponding CSS sub-parsers are invoked directly on the existing
     *   token arrays — no re-tokenization.
     *
     * @returns CssInjectionRule AST node.
     */
    public static parse(
        source: string,
        data: Int32Array,
        dataOffset: number,
        maxMods: number,
        maxDomains: number,
        options: ParseOptions = {},
        ctx?: ParserContext,
    ): CssInjectionRule {
        const {
            isLocIncluded = false,
            parseCssSelectorList = false,
            parseCssDeclarationList = false,
        } = options;

        // Read flags
        const flags = data[dataOffset + CR_FLAGS_OFFSET];
        const exception = (flags & CR_FLAG_EXCEPTION) !== 0;
        const hasAdgMods = (flags & CR_FLAG_HAS_ADG_MODS) !== 0;

        // Read domain count and parse domains
        const domainCount = data[dataOffset + CR_DOMAIN_COUNT];
        const domainRecordsOffset = dataOffset + 5 + maxMods * MAX_MODIFIER_RECORD_STRIDE;
        const domains: DomainList = DomainListAstBuilder.parse(
            source,
            data,
            domainCount,
            domainRecordsOffset,
            COMMA,
            isLocIncluded,
        ) || {
            type: ListNodeType.DomainList,
            separator: COMMA,
            children: [],
        };

        // Read modifier list if present
        let modifiers: ModifierList | undefined;
        if (hasAdgMods) {
            modifiers = ModifierListAstBuilder.parse(
                source,
                data,
                isLocIncluded,
                dataOffset + CR_MODIFIER_COUNT_OFFSET,
                dataOffset + CR_MODIFIER_RECORDS_OFFSET,
            );
        }

        // Read separator position and build separator Value
        const sepSourceStart = data[dataOffset + CR_SEP_SOURCE_START];
        const sepLen = (flags >>> CR_SEP_LEN_SHIFT) & CR_SEP_LEN_MASK;
        const sepSourceEnd = sepSourceStart + sepLen;

        const separator: Value = {
            type: NodeType.Value,
            value: source.slice(sepSourceStart, sepSourceEnd),
        };

        if (isLocIncluded) {
            separator.start = sepSourceStart;
            separator.end = sepSourceEnd;
        }

        // Read body boundaries (precomputed and trimmed by cosmetic header parser)
        const bodyStart = data[dataOffset + CR_BODY_START];
        const bodyEnd = data[dataOffset + CR_BODY_END];

        // Read CSS injection body fields from the post-domain region
        // (same offset as scriptlet body data — mutually exclusive paths).
        const injBase = domainRecordsOffset + maxDomains * DOMAIN_RECORD_STRIDE;
        const injFlags = data[injBase + CSS_INJ_FLAGS];
        const hasMedia = (injFlags & CSS_INJ_FLAG_HAS_MEDIA) !== 0;
        const hasRemove = (injFlags & CSS_INJ_FLAG_REMOVE) !== 0;

        // Read ALL CSS injection header values into locals BEFORE any sub-parser
        // call that may overwrite ctx.data (sub-parsers write from offset 0).
        const slSourceStart = data[injBase + CSS_INJ_SL_SOURCE_START];
        const slSourceEnd = data[injBase + CSS_INJ_SL_SOURCE_END];
        const slStartTi = data[injBase + CSS_INJ_SL_START_TI];
        const slEndTi = data[injBase + CSS_INJ_SL_END_TI];
        const dlSourceStart = data[injBase + CSS_INJ_DL_SOURCE_START];
        const dlSourceEnd = data[injBase + CSS_INJ_DL_SOURCE_END];
        const dlStartTi = data[injBase + CSS_INJ_DL_START_TI];
        const dlEndTi = data[injBase + CSS_INJ_DL_END_TI];

        // Build selectorList — sub-parse when requested and ctx is available.
        let selectorList: SelectorList | Raw;
        if (parseCssSelectorList && ctx) {
            SelectorListParser.parse(ctx, slStartTi, slEndTi, 0, DEFAULT_MAX_COMPLEX);
            selectorList = SelectorListAstBuilder.parse(
                source,
                ctx.data,
                0,
                DEFAULT_MAX_COMPLEX,
                slSourceStart,
                slSourceEnd,
                { isLocIncluded },
            );
        } else {
            selectorList = CssInjectionAstBuilder.buildRaw(
                source,
                slSourceStart,
                slSourceEnd,
                isLocIncluded,
                ValueKind.CssSelector,
            );
        }

        // Build body node
        const body: CssInjectionRuleBody = {
            type: NodeType.CssInjectionRuleBody,
            selectorList,
        };

        // Media query list — kept as Value (not Raw) because there is no
        // dedicated MediaQueryList AST node type to upgrade to, unlike
        // selectorList (SelectorList) and declarationList (CssDeclarationList)
        // which use Raw as a transitional representation.
        if (hasMedia) {
            const mqStart = data[injBase + CSS_INJ_MEDIA_QUERY_START];
            const mqEnd = data[injBase + CSS_INJ_MEDIA_QUERY_END];

            const mediaQueryList: Value = {
                type: NodeType.Value,
                value: source.slice(mqStart, mqEnd),
            };

            if (isLocIncluded) {
                mediaQueryList.start = mqStart;
                mediaQueryList.end = mqEnd;
            }

            body.mediaQueryList = mediaQueryList;
        }

        // Declaration list or remove flag — mutually exclusive.
        // When remove: true, skip declaration parsing entirely.
        if (hasRemove) {
            body.remove = true;
        } else if (parseCssDeclarationList && ctx) {
            // Sub-parse via the CSS pipeline using the existing token arrays.
            // ctx.data was potentially overwritten by SelectorListParser above,
            // but dlStartTi/dlEndTi/dlSourceStart/dlSourceEnd are already in locals.
            DeclarationListParser.parse(ctx, dlStartTi, dlEndTi, 0, DEFAULT_MAX_DECLARATIONS);
            if (ctx.status === 1) {
                throw new Error('Parser data buffer overflow: declaration list too large for current capacity');
            }
            body.declarationList = DeclarationListAstBuilder.parse(
                source,
                ctx.data,
                0,
                DEFAULT_MAX_DECLARATIONS,
                dlSourceStart,
                dlSourceEnd,
                { isLocIncluded },
            );
        } else {
            body.declarationList = CssInjectionAstBuilder.buildRaw(
                source,
                dlSourceStart,
                dlSourceEnd,
                isLocIncluded,
                ValueKind.CssDeclaration,
            );
        }

        if (isLocIncluded) {
            body.start = bodyStart;
            body.end = bodyEnd;
        }

        // Determine syntax from the separator: element-hiding separators
        // (`##` / `#@#`) mark legacy ABP CSS injection, while `$`-based
        // separators (`#$#`, `#$?#`, …) are AdGuard-specific.
        const syntax: SyntaxFlags = separator.value.includes('$') ? SYNTAX_ADG : SYNTAX_ABP;

        // Build rule node
        const rule: CssInjectionRule = {
            category: RuleCategory.Cosmetic,
            type: CosmeticRuleType.CssInjectionRule,
            syntax,
            exception,
            modifiers,
            domains,
            separator,
            body,
        };

        if (isLocIncluded) {
            rule.start = 0;
            rule.end = source.length;
        }

        return rule;
    }

    /**
     * Build a Raw node from source offsets.
     *
     * @param source Source string.
     * @param start Source start offset.
     * @param end Source end offset.
     * @param isLocIncluded Whether to include location info.
     * @param kind Optional semantic kind to attach to the node.
     *
     * @returns Raw AST node.
     */
    private static buildRaw(
        source: string,
        start: number,
        end: number,
        isLocIncluded: boolean,
        kind?: ValueKind,
    ): Raw {
        const node: Raw = {
            type: NodeType.Raw,
            value: source.slice(start, end),
        };

        if (kind !== undefined) {
            node.kind = kind;
        }

        if (isLocIncluded) {
            node.start = start;
            node.end = end;
        }

        return node;
    }
}
