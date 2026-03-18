/* eslint-disable no-bitwise */

/**
 * @file Element hiding cosmetic rule AST parser.
 *
 * Reads preparsed data from ctx.data and builds ElementHidingRule AST nodes.
 */

import { RuleCategory, CosmeticRuleType } from '../../nodes';
import type { ElementHidingRule, ElementHidingRuleBody, Value } from '../../nodes';
import { AdblockSyntax } from '../../utils/adblockers';
import { DomainListParser } from '../misc/domain-list';
import { ModifierListParser } from '../misc/modifier-list';
import {
    CR_FLAGS_OFFSET,
    CR_SEP_SOURCE_START,
    CR_DOMAIN_COUNT,
    CR_BODY_START,
    CR_FLAG_EXCEPTION,
    CR_FLAG_HAS_ADG_MODS,
    CR_SEP_KIND_SHIFT,
    CR_SEP_KIND_MASK,
    cosmeticSepLength,
    cosmeticSepToString,
} from '../../preparser/cosmetic/constants';
import { CosmeticSepKind } from '../../preparser/cosmetic-separator';

/**
 * Parse options for element hiding rules.
 */
export interface ElementHidingParseOptions {
    /**
     * Whether to include location info (start/end) in AST nodes.
     */
    isLocIncluded?: boolean;

    /**
     * Whether to include raw text in AST nodes.
     */
    includeRaws?: boolean;
}

/**
 * Element hiding cosmetic rule AST parser.
 */
export class ElementHidingAstParser {
    /**
     * Parse an element hiding rule from preparsed data.
     *
     * @param source Source string.
     * @param data Int32Array with preparsed data.
     * @param maxMods Maximum number of modifiers (for computing domain offset).
     * @param options Parse options.
     *
     * @returns ElementHidingRule AST node.
     */
    public static parse(
        source: string,
        data: Int32Array,
        maxMods: number,
        options: ElementHidingParseOptions = {},
    ): ElementHidingRule {
        const { isLocIncluded = false, includeRaws = false } = options;

        // Read flags
        const flags = data[CR_FLAGS_OFFSET];
        const exception = (flags & CR_FLAG_EXCEPTION) !== 0;
        const sepKind = ((flags >>> CR_SEP_KIND_SHIFT) & CR_SEP_KIND_MASK) as CosmeticSepKind;
        const hasAdgMods = (flags & CR_FLAG_HAS_ADG_MODS) !== 0;

        // Read domain count and parse domains
        const domainCount = data[CR_DOMAIN_COUNT];
        const domainRecordsOffset = 5 + maxMods * 5;
        const domains = DomainListParser.parse(
            source,
            data,
            domainCount,
            domainRecordsOffset,
            ',',
            isLocIncluded,
        );

        // Read separator position and build separator Value
        const sepSourceStart = data[CR_SEP_SOURCE_START];
        const sepLen = cosmeticSepLength(sepKind);
        const sepSourceEnd = sepSourceStart + sepLen;
        const separatorValue = cosmeticSepToString(sepKind);

        const separator: Value = {
            type: 'Value',
            value: separatorValue,
        };

        if (isLocIncluded) {
            separator.start = sepSourceStart;
            separator.end = sepSourceEnd;
        }

        if (includeRaws) {
            separator.raw = source.slice(sepSourceStart, sepSourceEnd);
        }

        // Read body start and compute body end (trimmed)
        const bodyStart = data[CR_BODY_START];
        let bodyEnd = source.length;
        while (bodyEnd > bodyStart && /\s/.test(source[bodyEnd - 1])) {
            bodyEnd -= 1;
        }

        const selectorListValue = bodyEnd > bodyStart ? source.slice(bodyStart, bodyEnd) : '';

        const selectorList: Value = {
            type: 'Value',
            value: selectorListValue,
        };

        if (isLocIncluded) {
            selectorList.start = bodyStart;
            selectorList.end = bodyEnd;
        }

        if (includeRaws) {
            selectorList.raw = selectorListValue;
        }

        const body: ElementHidingRuleBody = {
            type: 'ElementHidingRuleBody',
            selectorList,
        };

        if (isLocIncluded) {
            body.start = bodyStart;
            body.end = bodyEnd;
        }

        // Build modifiers if AdGuard [$...] prefix was present
        const modifiers = hasAdgMods
            ? ModifierListParser.parse(source, data, isLocIncluded)
            : undefined;

        // Build rule node
        const rule: ElementHidingRule = {
            category: RuleCategory.Cosmetic,
            type: CosmeticRuleType.ElementHidingRule,
            syntax: hasAdgMods ? AdblockSyntax.Adg : AdblockSyntax.Common,
            exception,
            modifiers,
            domains: domains || {
                type: 'DomainList',
                separator: ',',
                children: [],
            },
            separator,
            body,
        };

        if (isLocIncluded) {
            rule.start = 0;
            rule.end = source.length;
        }

        return rule;
    }
}
