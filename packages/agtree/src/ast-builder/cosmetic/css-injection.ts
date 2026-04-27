/* eslint-disable no-bitwise */

/**
 * @file CSS injection cosmetic rule AST builder.
 *
 * Reads parsed data from ctx.data and builds CssInjectionRule AST nodes
 * for ADG CSS injection rules (#$#, #@$#, #$?#, #@$?#).
 */

import { CosmeticRuleType, RuleCategory } from '../../nodes-new';
import type {
    CssInjectionRule,
    CssInjectionRuleBody,
    DomainList,
    ModifierList,
    Raw,
    Value,
} from '../../nodes-new';
import { MAX_MODIFIER_RECORD_STRIDE } from '../../parser/context';
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
    CSS_INJ_DL_SOURCE_END,
    CSS_INJ_DL_SOURCE_START,
    CSS_INJ_FLAG_HAS_MEDIA,
    CSS_INJ_FLAG_REMOVE,
    CSS_INJ_FLAGS,
    CSS_INJ_MEDIA_QUERY_END,
    CSS_INJ_MEDIA_QUERY_START,
    CSS_INJ_SL_SOURCE_END,
    CSS_INJ_SL_SOURCE_START,
    DOMAIN_RECORD_STRIDE,
} from '../../parser/cosmetic/constants';
import { AdblockSyntax } from '../../utils/adblockers';
import { COMMA } from '../../utils/constants';
import { DomainListAstBuilder } from '../misc/domain-list';
import { ModifierListAstBuilder } from '../misc/modifier-list';
import { type ParseOptions } from '../options';

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
    ): CssInjectionRule {
        const { isLocIncluded = false, includeRaws = false } = options;

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
            type: 'DomainList',
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
            type: 'Value',
            value: source.slice(sepSourceStart, sepSourceEnd),
        };

        if (isLocIncluded) {
            separator.start = sepSourceStart;
            separator.end = sepSourceEnd;
        }

        if (includeRaws) {
            separator.raw = source.slice(sepSourceStart, sepSourceEnd);
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

        // Build body node — selectorList is always present as Raw
        const body: CssInjectionRuleBody = {
            type: 'CssInjectionRuleBody',
            selectorList: CssInjectionAstBuilder.buildRaw(
                source,
                data[injBase + CSS_INJ_SL_SOURCE_START],
                data[injBase + CSS_INJ_SL_SOURCE_END],
                isLocIncluded,
            ),
        };

        // Media query list — kept as Value (not Raw) because there is no
        // dedicated MediaQueryList AST node type to upgrade to, unlike
        // selectorList (SelectorList) and declarationList (CssDeclarationList)
        // which use Raw as a transitional representation.
        if (hasMedia) {
            const mqStart = data[injBase + CSS_INJ_MEDIA_QUERY_START];
            const mqEnd = data[injBase + CSS_INJ_MEDIA_QUERY_END];

            const mediaQueryList: Value = {
                type: 'Value',
                value: source.slice(mqStart, mqEnd),
            };

            if (isLocIncluded) {
                mediaQueryList.start = mqStart;
                mediaQueryList.end = mqEnd;
            }

            if (includeRaws) {
                mediaQueryList.raw = source.slice(mqStart, mqEnd);
            }

            body.mediaQueryList = mediaQueryList;
        }

        // Declaration list (Raw) or remove flag — mutually exclusive
        if (hasRemove) {
            body.remove = true;
        } else {
            body.declarationList = CssInjectionAstBuilder.buildRaw(
                source,
                data[injBase + CSS_INJ_DL_SOURCE_START],
                data[injBase + CSS_INJ_DL_SOURCE_END],
                isLocIncluded,
            );
        }

        if (isLocIncluded) {
            body.start = bodyStart;
            body.end = bodyEnd;
        }

        // Build rule node
        const rule: CssInjectionRule = {
            category: RuleCategory.Cosmetic,
            type: CosmeticRuleType.CssInjectionRule,
            syntax: AdblockSyntax.Adg,
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
     *
     * @returns Raw AST node.
     */
    private static buildRaw(
        source: string,
        start: number,
        end: number,
        isLocIncluded: boolean,
    ): Raw {
        const node: Raw = {
            type: 'Raw',
            value: source.slice(start, end),
        };

        if (isLocIncluded) {
            node.start = start;
            node.end = end;
        }

        return node;
    }
}
