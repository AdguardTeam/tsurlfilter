/* eslint-disable no-bitwise */

/**
 * @file Scriptlet injection cosmetic rule AST parser.
 *
 * Reads preparsed data from ctx.data and builds ScriptletInjectionRule AST
 * nodes for ADG, UBO, and ABP scriptlet syntaxes. All structural scanning
 * (mask detection, parenthesis finding, parameter boundary computation)
 * is done in the preparser stage. This parser only reads pre-computed
 * integer offsets and uses source.slice() for final Value node strings.
 */

import { ProductCode, type SpecificProductCode } from '../../compatibility-tables/platform';
import { CosmeticRuleType, RuleCategory } from '../../nodes-new';
import type {
    DomainList,
    ModifierList,
    Parameter,
    ParameterList,
    ScriptletInjectionRule,
    ScriptletInjectionRuleBody,
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
    DOMAIN_RECORD_STRIDE,
} from '../../preparser/cosmetic/constants';
import { NO_VALUE } from '../../preparser/network/constants';
import { QuoteType, QuoteUtils } from '../../utils';
import { AdblockSyntax } from '../../utils/adblockers';
import { DomainListParser } from '../misc/domain-list';
import { ModifierListParser } from '../misc/modifier-list';
import type { PreparserParseOptions } from '../options';

/**
 * Scriptlet injection cosmetic rule AST parser.
 *
 * Handles ADG (`#%#//scriptlet(…)`), UBO (`##+js(…)`), and
 * ABP (`#$#snippet …`) scriptlet syntaxes.
 *
 * All body structure scanning is done in the preparser (ScriptletBodyPreparser).
 * This parser only reads pre-computed parameter boundaries from ctx.data.
 */
export class ScriptletInjectionAstParser {
    /**
     * Parse a scriptlet injection rule from preparsed data.
     *
     * @param source Source string.
     * @param data Int32Array with preparsed data.
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
        maxMods: number,
        maxDomains: number,
        syntaxHint: SpecificProductCode,
        options: PreparserParseOptions = {},
    ): ScriptletInjectionRule {
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

        // Read body boundaries
        const bodyStart = data[CR_BODY_START];
        const bodyEnd = data[CR_BODY_END];

        // Compute scriptlet body data offset (after domain records)
        const scriptletDataOffset = domainRecordsOffset + maxDomains * DOMAIN_RECORD_STRIDE;

        // Determine syntax and build body from pre-computed parameter boundaries
        let syntax: AdblockSyntax;
        let body: ScriptletInjectionRuleBody;

        switch (syntaxHint) {
            case ProductCode.Adg:
                syntax = AdblockSyntax.Adg;
                // eslint-disable-next-line max-len
                body = ScriptletInjectionAstParser.buildSingleCallBody(source, data, scriptletDataOffset, bodyStart, bodyEnd, isLocIncluded);
                break;
            case ProductCode.Ubo:
                syntax = AdblockSyntax.Ubo;
                // eslint-disable-next-line max-len
                body = ScriptletInjectionAstParser.buildSingleCallBody(source, data, scriptletDataOffset, bodyStart, bodyEnd, isLocIncluded);
                break;
            case ProductCode.Abp:
                syntax = AdblockSyntax.Abp;
                // eslint-disable-next-line max-len
                body = ScriptletInjectionAstParser.buildMultiCallBody(source, data, scriptletDataOffset, bodyStart, bodyEnd, isLocIncluded);
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
            type: 'ScriptletInjectionRuleBody',
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
            type: 'ParameterList',
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
                    type: 'Parameter',
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
            type: 'ScriptletInjectionRuleBody',
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
                type: 'ParameterList',
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
                        type: 'Parameter',
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
