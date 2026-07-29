/* eslint-disable no-bitwise */

/**
 * @file HTML filtering cosmetic rule AST builder.
 *
 * Reads parsed data from ctx.data and builds HtmlFilteringRule AST nodes
 * for ADG ($$, $@$) and uBO (## / #@# with ^ body prefix) HTML filtering rules.
 */

import {
    CosmeticRuleType,
    ListNodeType,
    NodeType,
    RuleCategory,
    ValueKind,
} from '../../nodes';
import type {
    ComplexSelector,
    DomainList,
    HtmlFilteringRule,
    HtmlFilteringRuleBody,
    ModifierList,
    PseudoClassSelector,
    Raw,
    SelectorList,
    Value,
} from '../../nodes';
import { MAX_MODIFIER_RECORD_STRIDE } from '../../parser/context';
import {
    CR_BODY_END,
    CR_BODY_START,
    CR_DOMAIN_COUNT,
    CR_FLAG_BODY_UBO_RESPONSEHEADER,
    CR_FLAG_EXCEPTION,
    CR_FLAG_HAS_ADG_MODS,
    CR_FLAGS_OFFSET,
    CR_MODIFIER_COUNT_OFFSET,
    CR_MODIFIER_RECORDS_OFFSET,
    CR_SEP_KIND_ADG_HTML_FILTERING,
    CR_SEP_KIND_MASK,
    CR_SEP_KIND_SHIFT,
    CR_SEP_LEN_MASK,
    CR_SEP_LEN_SHIFT,
    CR_SEP_SOURCE_START,
    HF_ARG_END,
    HF_ARG_START,
    HF_FN_NAME_END,
    HF_FN_NAME_START,
    slDataOffset,
} from '../../parser/cosmetic/constants';
import { DEFAULT_MAX_COMPLEX } from '../../parser/css/selector-list/constants';
import { SYNTAX_ADG, SYNTAX_UBO } from '../../utils/syntax-flags';
import { DomainListAstBuilder } from '../misc/domain-list';
import { ModifierListAstBuilder } from '../misc/modifier-list';
import type { ParseOptions } from '../options';

import { SelectorListAstBuilder } from './selector-list/selector-list';

/**
 * HTML filtering cosmetic rule AST builder.
 *
 * Handles ADG HTML filtering rules (`$$`, `$@$`) and uBO HTML filtering
 * rules (`##`/`#@#` with `^` body prefix, including `responseheader(...)`).
 */
export class HtmlFilteringAstBuilder {
    /**
     * Parse an HTML filtering rule from parsed data.
     *
     * @param source Source string.
     * @param data Int32Array with parsed data.
     * @param dataOffset Offset within `data` where the cosmetic rule header starts.
     * @param maxMods Maximum number of modifiers (for computing domain offset).
     * @param options Parse options.
     *
     * @returns HtmlFilteringRule AST node.
     */
    public static parse(
        source: string,
        data: Int32Array,
        dataOffset: number,
        maxMods: number,
        options: ParseOptions = {},
    ): HtmlFilteringRule {
        const { isLocIncluded = false } = options;

        // Read flags
        const flags = data[dataOffset + CR_FLAGS_OFFSET];
        const exception = (flags & CR_FLAG_EXCEPTION) !== 0;
        const hasAdgMods = (flags & CR_FLAG_HAS_ADG_MODS) !== 0;
        const isResponseHeader = (flags & CR_FLAG_BODY_UBO_RESPONSEHEADER) !== 0;
        const sepKind = (flags >>> CR_SEP_KIND_SHIFT) & CR_SEP_KIND_MASK;

        // Determine syntax from sep-kind
        const syntax = sepKind === CR_SEP_KIND_ADG_HTML_FILTERING
            ? SYNTAX_ADG
            : SYNTAX_UBO;

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

        // Read modifier list if present (ADG modifiers only)
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

        // Build body
        const parseBody = options.parseHtmlFilteringRuleBodies === true;
        let body: Raw | HtmlFilteringRuleBody;

        if (parseBody) {
            if (isResponseHeader) {
                body = HtmlFilteringAstBuilder.buildResponseHeaderBody(
                    source,
                    data,
                    dataOffset,
                    bodyStart,
                    bodyEnd,
                    isLocIncluded,
                );
            } else {
                body = HtmlFilteringAstBuilder.buildSelectorListBody(
                    source,
                    data,
                    dataOffset,
                    bodyStart,
                    bodyEnd,
                    isLocIncluded,
                );
            }
        } else {
            // Raw mode: body is a Raw node with CSS selector kind
            const bodyValue: Raw = {
                type: NodeType.Raw,
                value: source.slice(bodyStart, bodyEnd),
                kind: ValueKind.CssSelector,
            };

            if (isLocIncluded) {
                bodyValue.start = bodyStart;
                bodyValue.end = bodyEnd;
            }

            body = bodyValue;
        }

        // Build rule node
        const rule: HtmlFilteringRule = {
            category: RuleCategory.Cosmetic,
            type: CosmeticRuleType.HtmlFilteringRule,
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
     * Build body as HtmlFilteringRuleBody with a SelectorList from pre-parsed
     * selector list data in ctx.data.
     *
     * @param source Source string.
     * @param data Parsed data buffer.
     * @param dataOffset Cosmetic rule header offset.
     * @param bodyStart Body start source offset.
     * @param bodyEnd Body end source offset.
     * @param isLocIncluded Whether to include location info.
     *
     * @returns HtmlFilteringRuleBody AST node.
     */
    private static buildSelectorListBody(
        source: string,
        data: Int32Array,
        dataOffset: number,
        bodyStart: number,
        bodyEnd: number,
        isLocIncluded: boolean,
    ): HtmlFilteringRuleBody {
        // Resolve the selector-list data offset from the buffer flags via the
        // shared slDataOffset helper.
        const selectorList = SelectorListAstBuilder.parse(
            source,
            data,
            dataOffset + slDataOffset(data, dataOffset),
            DEFAULT_MAX_COMPLEX,
            bodyStart,
            bodyEnd,
            { isLocIncluded },
        );

        const body: HtmlFilteringRuleBody = {
            type: NodeType.HtmlFilteringRuleBody,
            selectorList,
        };

        if (isLocIncluded) {
            body.start = bodyStart;
            body.end = bodyEnd;
        }

        return body;
    }

    /**
     * Build body for uBO responseheader rules. Manually constructs
     * SelectorList → ComplexSelector → PseudoClassSelector from the
     * function name and argument offsets stored by the structural parser.
     *
     * Mirrors the legacy `UboHtmlFilteringBodyParser.parseResponseHeaderRule()`.
     *
     * @param source Source string.
     * @param data Parsed data buffer.
     * @param dataOffset Cosmetic rule header offset.
     * @param bodyStart Body start source offset.
     * @param bodyEnd Body end source offset.
     * @param isLocIncluded Whether to include location info.
     *
     * @returns HtmlFilteringRuleBody AST node.
     */
    private static buildResponseHeaderBody(
        source: string,
        data: Int32Array,
        dataOffset: number,
        bodyStart: number,
        bodyEnd: number,
        isLocIncluded: boolean,
    ): HtmlFilteringRuleBody {
        const fnNameStart = data[dataOffset + HF_FN_NAME_START];
        const fnNameEnd = data[dataOffset + HF_FN_NAME_END];
        const argStart = data[dataOffset + HF_ARG_START];
        const argEnd = data[dataOffset + HF_ARG_END];

        const nameNode: Value = {
            type: NodeType.Value,
            value: source.slice(fnNameStart, fnNameEnd),
        };

        if (isLocIncluded) {
            nameNode.start = fnNameStart;
            nameNode.end = fnNameEnd;
        }

        const argNode: Value = {
            type: NodeType.Value,
            value: source.slice(argStart, argEnd),
        };

        if (isLocIncluded) {
            argNode.start = argStart;
            argNode.end = argEnd;
        }

        const pseudoClassSelector: PseudoClassSelector = {
            type: NodeType.PseudoClassSelector,
            name: nameNode,
            argument: argNode,
        };

        if (isLocIncluded) {
            pseudoClassSelector.start = fnNameStart;
            pseudoClassSelector.end = bodyEnd;
        }

        const complexSelector: ComplexSelector = {
            type: NodeType.ComplexSelector,
            children: [pseudoClassSelector],
        };

        if (isLocIncluded) {
            complexSelector.start = fnNameStart;
            complexSelector.end = bodyEnd;
        }

        const selectorList: SelectorList = {
            type: NodeType.SelectorList,
            children: [complexSelector],
        };

        if (isLocIncluded) {
            selectorList.start = fnNameStart;
            selectorList.end = bodyEnd;
        }

        const body: HtmlFilteringRuleBody = {
            type: NodeType.HtmlFilteringRuleBody,
            selectorList,
        };

        if (isLocIncluded) {
            body.start = bodyStart;
            body.end = bodyEnd;
        }

        return body;
    }
}
