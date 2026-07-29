/* eslint-disable no-bitwise */

/**
 * @file JS injection cosmetic rule AST parser.
 *
 * Reads parsed data from ctx.data and builds JsInjectionRule AST nodes
 * for ADG raw JS injection rules (`#%#<code>` without `//scriptlet` prefix).
 */

import {
    CosmeticRuleType,
    ListNodeType,
    NodeType,
    RuleCategory,
    ValueKind,
} from '../../nodes';
import type {
    DomainList,
    JsInjectionRule,
    ModifierList,
    Raw,
    Value,
} from '../../nodes';
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
} from '../../parser/cosmetic/constants';
import { SYNTAX_ADG } from '../../utils/syntax-flags';
import { DomainListAstBuilder } from '../misc/domain-list';
import { ModifierListAstBuilder } from '../misc/modifier-list';
import { type ParseOptions } from '../options';

/**
 * JS injection cosmetic rule AST parser.
 *
 * Handles ADG raw JS injection rules where the separator is `#%#` or `#@%#`
 * and the body does NOT start with `//scriptlet`. The body is stored as a
 * plain Value string with no sub-parsing.
 */
export class JsInjectionAstBuilder {
    /**
     * Parse a JS injection rule from parsed data.
     *
     * @param source Source string.
     * @param data Int32Array with parsed data.
     * @param dataOffset Offset within `data` where the cosmetic rule header starts.
     * @param maxMods Maximum number of modifiers (for computing domain offset).
     * @param options Parse options.
     *
     * @returns JsInjectionRule AST node.
     */
    public static parse(
        source: string,
        data: Int32Array,
        dataOffset: number,
        maxMods: number,
        options: ParseOptions = {},
    ): JsInjectionRule {
        const { isLocIncluded = false } = options;

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
            ',',
            isLocIncluded,
        ) || {
            type: ListNodeType.DomainList,
            separator: ',',
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

        // Read body boundaries — body is raw JS, no sub-parsing
        const bodyStart = data[dataOffset + CR_BODY_START];
        const bodyEnd = data[dataOffset + CR_BODY_END];
        const bodyValue = source.slice(bodyStart, bodyEnd);

        const body: Raw = {
            type: NodeType.Raw,
            value: bodyValue,
            kind: ValueKind.JavaScript,
        };

        if (isLocIncluded) {
            body.start = bodyStart;
            body.end = bodyEnd;
        }

        // Build rule node
        const rule: JsInjectionRule = {
            category: RuleCategory.Cosmetic,
            type: CosmeticRuleType.JsInjectionRule,
            syntax: SYNTAX_ADG,
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
