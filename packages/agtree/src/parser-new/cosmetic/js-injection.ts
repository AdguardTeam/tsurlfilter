/* eslint-disable no-bitwise */

/**
 * @file JS injection cosmetic rule AST parser.
 *
 * Reads preparsed data from ctx.data and builds JsInjectionRule AST nodes
 * for ADG raw JS injection rules (`#%#<code>` without `//scriptlet` prefix).
 */

import { CosmeticRuleType, RuleCategory } from '../../nodes-new';
import type {
    DomainList,
    JsInjectionRule,
    ModifierList,
    Value,
} from '../../nodes-new';
import { MAX_MODIFIER_RECORD_STRIDE } from '../../preparser/context';
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
} from '../../preparser/cosmetic/constants';
import { AdblockSyntax } from '../../utils/adblockers';
import { DomainListParser } from '../misc/domain-list';
import { ModifierListParser } from '../misc/modifier-list';
import { type PreparserParseOptions } from '../options';

/**
 * JS injection cosmetic rule AST parser.
 *
 * Handles ADG raw JS injection rules where the separator is `#%#` or `#@%#`
 * and the body does NOT start with `//scriptlet`. The body is stored as a
 * plain Value string with no sub-parsing.
 */
export class JsInjectionAstParser {
    /**
     * Parse a JS injection rule from preparsed data.
     *
     * @param source Source string.
     * @param data Int32Array with preparsed data.
     * @param maxMods Maximum number of modifiers (for computing domain offset).
     * @param options Parse options.
     *
     * @returns JsInjectionRule AST node.
     */
    public static parse(
        source: string,
        data: Int32Array,
        maxMods: number,
        options: PreparserParseOptions = {},
    ): JsInjectionRule {
        const { isLocIncluded = false, includeRaws = false } = options;

        // Read flags
        const flags = data[CR_FLAGS_OFFSET];
        const exception = (flags & CR_FLAG_EXCEPTION) !== 0;
        const hasAdgMods = (flags & CR_FLAG_HAS_ADG_MODS) !== 0;

        // Read domain count and parse domains
        const domainCount = data[CR_DOMAIN_COUNT];
        const domainRecordsOffset = 5 + maxMods * MAX_MODIFIER_RECORD_STRIDE;
        const domains: DomainList = DomainListParser.parse(
            source,
            data,
            domainCount,
            domainRecordsOffset,
            ',',
            isLocIncluded,
        ) || {
            type: 'DomainList',
            separator: ',',
            children: [],
        };

        // Read modifier list if present
        let modifiers: ModifierList | undefined;
        if (hasAdgMods) {
            modifiers = ModifierListParser.parse(
                source,
                data,
                isLocIncluded,
                CR_MODIFIER_COUNT_OFFSET,
                CR_MODIFIER_RECORDS_OFFSET,
            );
        }

        // Read separator position and build separator Value
        const sepSourceStart = data[CR_SEP_SOURCE_START];
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

        // Read body boundaries — body is raw JS, no sub-parsing
        const bodyStart = data[CR_BODY_START];
        const bodyEnd = data[CR_BODY_END];
        const bodyValue = source.slice(bodyStart, bodyEnd);

        const body: Value = {
            type: 'Value',
            value: bodyValue,
        };

        if (isLocIncluded) {
            body.start = bodyStart;
            body.end = bodyEnd;
        }

        // Build rule node
        const rule: JsInjectionRule = {
            category: RuleCategory.Cosmetic,
            type: CosmeticRuleType.JsInjectionRule,
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
}
