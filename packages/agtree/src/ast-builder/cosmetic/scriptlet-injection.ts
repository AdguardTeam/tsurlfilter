/* eslint-disable no-bitwise */

/**
 * @file Scriptlet injection cosmetic rule AST parser.
 *
 * Reads parsed data from ctx.data and builds ScriptletInjectionRule AST
 * nodes for ADG, UBO, and ABP scriptlet syntaxes. All structural scanning
 * (mask detection, parenthesis finding, parameter boundary computation)
 * is done in the parser stage. This parser only reads pre-computed
 * integer offsets and uses source.slice() for final Value node strings.
 */

import { ProductCode, type SpecificProductCode } from '../../compatibility-tables/platform';
import {
    CosmeticRuleType,
    ListNodeType,
    NodeType,
    RuleCategory,
} from '../../nodes';
import type {
    DomainList,
    ModifierList,
    Parameter,
    ParameterList,
    ScriptletInjectionRule,
    ScriptletInjectionRuleBody,
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
    DOMAIN_RECORD_STRIDE,
} from '../../parser/cosmetic/constants';
import { NO_VALUE } from '../../parser/network/constants';
import { QuoteType, QuoteUtils } from '../../utils';
import {
    SYNTAX_ABP,
    SYNTAX_ADG,
    SYNTAX_UBO,
    type SyntaxFlags,
} from '../../utils/syntax-flags';
import { DomainListAstBuilder } from '../misc/domain-list';
import { ModifierListAstBuilder } from '../misc/modifier-list';
import type { ParseOptions } from '../options';

/**
 * Scriptlet injection cosmetic rule AST parser.
 *
 * Handles ADG (`#%#//scriptlet(…)`), UBO (`##+js(…)`), and
 * ABP (`#$#snippet …`) scriptlet syntaxes.
 *
 * All body structure scanning is done in the parser (ScriptletBodyParser).
 * This parser only reads pre-computed parameter boundaries from ctx.data.
 */
export class ScriptletInjectionAstBuilder {
    /**
     * Parse a scriptlet injection rule from parsed data.
     *
     * @param source Source string.
     * @param data Int32Array with parsed data.
     * @param dataOffset Offset within `data` where the cosmetic rule header starts.
     * @param maxMods Maximum number of modifiers (for computing domain offset).
     * @param maxDomains Maximum number of domains (for computing scriptlet data offset).
     * @param syntaxHint Which scriptlet syntax to use for body building.
     * @param options Parse options.
     *
     * @returns ScriptletInjectionRule AST node.
     */
    public static parse(
        source: string,
        data: Int32Array,
        dataOffset: number,
        maxMods: number,
        maxDomains: number,
        syntaxHint: SpecificProductCode,
        options: ParseOptions = {},
    ): ScriptletInjectionRule {
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

        // Read body boundaries
        const bodyStart = data[dataOffset + CR_BODY_START];
        const bodyEnd = data[dataOffset + CR_BODY_END];

        // Compute scriptlet body data offset (after domain records)
        const scriptletDataOffset = domainRecordsOffset + maxDomains * DOMAIN_RECORD_STRIDE;

        // Determine syntax and build body from pre-computed parameter boundaries
        let syntax: SyntaxFlags;
        let body: ScriptletInjectionRuleBody;

        switch (syntaxHint) {
            case ProductCode.Adg:
                syntax = SYNTAX_ADG;
                // eslint-disable-next-line max-len
                body = ScriptletInjectionAstBuilder.buildSingleCallBody(source, data, scriptletDataOffset, bodyStart, bodyEnd, isLocIncluded);
                break;
            case ProductCode.Ubo:
                syntax = SYNTAX_UBO;
                // eslint-disable-next-line max-len
                body = ScriptletInjectionAstBuilder.buildSingleCallBody(source, data, scriptletDataOffset, bodyStart, bodyEnd, isLocIncluded);
                break;
            case ProductCode.Abp:
                syntax = SYNTAX_ABP;
                // eslint-disable-next-line max-len
                body = ScriptletInjectionAstBuilder.buildMultiCallBody(source, data, scriptletDataOffset, bodyStart, bodyEnd, isLocIncluded);
                break;
            default:
                throw new Error(`Unknown scriptlet syntax hint: ${syntaxHint}`);
        }

        // Build rule node
        const rule: ScriptletInjectionRule = {
            category: RuleCategory.Cosmetic,
            type: CosmeticRuleType.ScriptletInjectionRule,
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
     * Build a ScriptletInjectionRuleBody with a single ParameterList
     * (used for ADG and UBO scriptlets). Reads pre-computed parameter
     * boundaries from data at the given offset.
     *
     * @param source Source string.
     * @param data Pre-computed data buffer.
     * @param dataOffset Offset where scriptlet body data starts.
     * @param bodyStart Body start source offset.
     * @param bodyEnd Body end source offset.
     * @param isLocIncluded Whether to include location info.
     *
     * @returns ScriptletInjectionRuleBody AST node.
     */
    private static buildSingleCallBody(
        source: string,
        data: Int32Array,
        dataOffset: number,
        bodyStart: number,
        bodyEnd: number,
        isLocIncluded: boolean,
    ): ScriptletInjectionRuleBody {
        const result: ScriptletInjectionRuleBody = {
            type: NodeType.ScriptletInjectionRuleBody,
            children: [],
        };

        if (isLocIncluded) {
            result.start = bodyStart;
            result.end = bodyEnd;
        }

        // data[dataOffset + 0] = snippetCallCount (always 1 for ADG/UBO)
        // data[dataOffset + 1] = paramCount
        const paramCount = data[dataOffset + 1];

        if (paramCount === 0) {
            // Empty scriptlet call — no ParameterList child
            return result;
        }

        const parameterList: ParameterList = {
            type: NodeType.ParameterList,
            children: [],
        };

        // Read each parameter boundary pair
        let di = dataOffset + 2; // first param record
        for (let i = 0; i < paramCount; i += 1) {
            const pStart = data[di];
            const pEnd = data[di + 1];
            di += 2;

            if (pStart === NO_VALUE) {
                parameterList.children.push(null);
            } else {
                const raw = source.slice(pStart, pEnd);
                const quoteType = QuoteUtils.getStringQuoteType(raw);
                const param: Parameter = {
                    type: NodeType.Parameter,
                    value: quoteType !== QuoteType.None ? QuoteUtils.removeQuotesAndUnescape(raw) : raw,
                    quoteType,
                };

                if (isLocIncluded) {
                    param.start = pStart;
                    param.end = pEnd;
                }

                parameterList.children.push(param);
            }
        }

        if (isLocIncluded && parameterList.children.length > 0) {
            // ParameterList location: from first param start to last param end
            const firstStart = data[dataOffset + 2];
            const lastEnd = data[dataOffset + 2 + (paramCount - 1) * 2 + 1];
            if (firstStart !== NO_VALUE) {
                parameterList.start = firstStart;
            }
            if (lastEnd !== NO_VALUE) {
                parameterList.end = lastEnd;
            }
        }

        result.children.push(parameterList);

        return result;
    }

    /**
     * Build a ScriptletInjectionRuleBody with multiple ParameterLists
     * (used for ABP snippet syntax with semicolons). Reads pre-computed
     * parameter boundaries from data at the given offset.
     *
     * @param source Source string.
     * @param data Pre-computed data buffer.
     * @param dataOffset Offset where scriptlet body data starts.
     * @param bodyStart Body start source offset.
     * @param bodyEnd Body end source offset.
     * @param isLocIncluded Whether to include location info.
     *
     * @returns ScriptletInjectionRuleBody AST node.
     */
    private static buildMultiCallBody(
        source: string,
        data: Int32Array,
        dataOffset: number,
        bodyStart: number,
        bodyEnd: number,
        isLocIncluded: boolean,
    ): ScriptletInjectionRuleBody {
        const result: ScriptletInjectionRuleBody = {
            type: NodeType.ScriptletInjectionRuleBody,
            children: [],
        };

        if (isLocIncluded) {
            result.start = bodyStart;
            result.end = bodyEnd;
        }

        // data[dataOffset + 0] = snippetCallCount
        const callCount = data[dataOffset];
        let di = dataOffset + 1;

        for (let c = 0; c < callCount; c += 1) {
            const paramCount = data[di];
            di += 1;

            const parameterList: ParameterList = {
                type: NodeType.ParameterList,
                children: [],
            };

            const firstParamDi = di;

            for (let i = 0; i < paramCount; i += 1) {
                const pStart = data[di];
                const pEnd = data[di + 1];
                di += 2;

                if (pStart === NO_VALUE) {
                    parameterList.children.push(null);
                } else {
                    const raw = source.slice(pStart, pEnd);
                    const quoteType = QuoteUtils.getStringQuoteType(raw);
                    const param: Parameter = {
                        type: NodeType.Parameter,
                        value: quoteType !== QuoteType.None ? QuoteUtils.removeQuotesAndUnescape(raw) : raw,
                        quoteType,
                    };

                    if (isLocIncluded) {
                        param.start = pStart;
                        param.end = pEnd;
                    }

                    parameterList.children.push(param);
                }
            }

            if (isLocIncluded && paramCount > 0) {
                const firstStart = data[firstParamDi];
                const lastEnd = data[firstParamDi + (paramCount - 1) * 2 + 1];
                if (firstStart !== NO_VALUE) {
                    parameterList.start = firstStart;
                }
                if (lastEnd !== NO_VALUE) {
                    parameterList.end = lastEnd;
                }
            }

            result.children.push(parameterList);
        }

        return result;
    }
}
