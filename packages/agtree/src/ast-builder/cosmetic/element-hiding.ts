/* eslint-disable no-bitwise */

/**
 * @file Element hiding cosmetic rule AST parser.
 *
 * Reads parsed data from ctx.data and builds ElementHidingRule AST nodes.
 */

import { UboPseudoName } from '../../common/ubo-selector-common';
import {
    CosmeticRuleType,
    ListNodeType,
    NodeType,
    RuleCategory,
    ValueKind,
} from '../../nodes';
import type {
    ElementHidingRule,
    ElementHidingRuleBody,
    Modifier,
    ModifierList,
    Raw,
    Value,
} from '../../nodes';
import { MAX_MODIFIER_RECORD_STRIDE } from '../../parser/context';
import {
    CR_BODY_END,
    CR_BODY_START,
    CR_DOMAIN_COUNT,
    CR_FLAG_BODY_ABP_CSS_INJECTION,
    CR_FLAG_EXCEPTION,
    CR_FLAG_HAS_ADG_MODS,
    CR_FLAG_HAS_UBO_MODS,
    CR_FLAGS_OFFSET,
    CR_MODIFIER_COUNT_OFFSET,
    CR_MODIFIER_RECORDS_OFFSET,
    CR_SEP_LEN_MASK,
    CR_SEP_LEN_SHIFT,
    CR_SEP_SOURCE_START,
    CR_UBO_MODS_OFFSET,
    UBO_MOD_FIELD_FLAGS,
    UBO_MOD_FIELD_NAME_END,
    UBO_MOD_FIELD_NAME_START,
    UBO_MOD_FIELD_SRC_END,
    UBO_MOD_FIELD_SRC_START,
    UBO_MOD_FIELD_VALUE_END,
    UBO_MOD_FIELD_VALUE_START,
    UBO_MODIFIER_RECORD_STRIDE,
} from '../../parser/cosmetic/constants';
import { MODIFIER_FLAG_NEGATED, NO_VALUE } from '../../parser/network/constants';
import {
    SYNTAX_ABP,
    SYNTAX_ADG,
    SYNTAX_ALL,
    SYNTAX_UBO,
    type SyntaxFlags,
} from '../../utils/syntax-flags';
import { DomainListAstBuilder } from '../misc/domain-list';
import { ModifierListAstBuilder } from '../misc/modifier-list';

/**
 * Parse options for element hiding rules.
 */
export interface ElementHidingParseOptions {
    /**
     * Whether to include location info (start/end) in AST nodes.
     */
    isLocIncluded?: boolean;
}

/**
 * Element hiding cosmetic rule AST parser.
 */
export class ElementHidingAstBuilder {
    /**
     * Parse an element hiding rule from parsed data.
     *
     * @param source Source string.
     * @param data Int32Array with parsed data.
     * @param dataOffset Offset within `data` where the cosmetic rule header starts.
     * @param maxMods Maximum number of modifiers (for computing domain offset).
     * @param options Parse options.
     *
     * @returns ElementHidingRule AST node.
     */
    public static parse(
        source: string,
        data: Int32Array,
        dataOffset: number,
        maxMods: number,
        options: ElementHidingParseOptions = {},
    ): ElementHidingRule {
        const { isLocIncluded = false } = options;

        // Read flags
        const flags = data[dataOffset + CR_FLAGS_OFFSET];
        const exception = (flags & CR_FLAG_EXCEPTION) !== 0;
        const hasAdgMods = (flags & CR_FLAG_HAS_ADG_MODS) !== 0;
        const hasUboMods = (flags & CR_FLAG_HAS_UBO_MODS) !== 0;

        // Read domain count and parse domains
        const domainCount = data[dataOffset + CR_DOMAIN_COUNT];
        const domainRecordsOffset = dataOffset + 5 + maxMods * MAX_MODIFIER_RECORD_STRIDE;
        const domains = DomainListAstBuilder.parse(
            source,
            data,
            domainCount,
            domainRecordsOffset,
            ',',
            isLocIncluded,
        );

        // Read separator position and build separator Value
        const sepSourceStart = data[dataOffset + CR_SEP_SOURCE_START];
        const sepLen = (flags >>> CR_SEP_LEN_SHIFT) & CR_SEP_LEN_MASK;
        const sepSourceEnd = sepSourceStart + sepLen;
        const separatorValue = source.slice(sepSourceStart, sepSourceEnd);

        const separator: Value = {
            type: NodeType.Value,
            value: separatorValue,
        };

        if (isLocIncluded) {
            separator.start = sepSourceStart;
            separator.end = sepSourceEnd;
        }

        // Read body start and end (precomputed and trimmed by parser)
        const bodyStart = data[dataOffset + CR_BODY_START];
        const bodyEnd = data[dataOffset + CR_BODY_END];

        // Build uBO modifiers and reconstruct cleaned selector if needed
        let modifiers: ModifierList | undefined;
        let syntax: SyntaxFlags = SYNTAX_ALL;
        let selectorListValue: string;

        if (hasUboMods) {
            const uboModCount = data[dataOffset + CR_MODIFIER_COUNT_OFFSET];

            // Defensive bounds check: ensure uBO records fit within the modifier region
            const uboEnd = CR_UBO_MODS_OFFSET + uboModCount * UBO_MODIFIER_RECORD_STRIDE;
            if (uboEnd > domainRecordsOffset) {
                // eslint-disable-next-line max-len
                throw new Error(`uBO modifier records overflow into domain region (${uboEnd} > ${domainRecordsOffset})`);
            }
            // eslint-disable-next-line max-len
            const uboResult = ElementHidingAstBuilder.buildUboModifiers(source, data, uboModCount, bodyStart, bodyEnd, isLocIncluded, dataOffset);
            modifiers = uboResult.modifierList;
            selectorListValue = uboResult.cleanedSelector;
            syntax = SYNTAX_UBO;
        } else if (hasAdgMods) {
            modifiers = ModifierListAstBuilder.parse(
                source,
                data,
                isLocIncluded,
                dataOffset + CR_MODIFIER_COUNT_OFFSET,
                dataOffset + CR_MODIFIER_RECORDS_OFFSET,
            );
            selectorListValue = bodyEnd > bodyStart ? source.slice(bodyStart, bodyEnd) : '';
            syntax = SYNTAX_ADG;
        } else {
            selectorListValue = bodyEnd > bodyStart ? source.slice(bodyStart, bodyEnd) : '';
            if ((flags & CR_FLAG_BODY_ABP_CSS_INJECTION) !== 0) {
                syntax = SYNTAX_ABP;
            }
        }

        const selectorList: Raw = {
            type: NodeType.Raw,
            value: selectorListValue,
            kind: ValueKind.CssSelector,
        };

        if (isLocIncluded) {
            selectorList.start = bodyStart;
            selectorList.end = bodyEnd;
        }

        if (hasUboMods) {
            selectorList.raw = source.slice(bodyStart, bodyEnd);
        }

        const body: ElementHidingRuleBody = {
            type: NodeType.ElementHidingRuleBody,
            selectorList,
        };

        if (isLocIncluded) {
            body.start = bodyStart;
            body.end = bodyEnd;
        }

        // Build rule node
        const rule: ElementHidingRule = {
            category: RuleCategory.Cosmetic,
            type: CosmeticRuleType.ElementHidingRule,
            syntax,
            exception,
            modifiers,
            domains: domains || {
                type: ListNodeType.DomainList,
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

    /**
     * Build Modifier AST nodes from uBO modifier records in ctx.data.
     * Reconstructs the cleaned selector by excluding modifier source ranges.
     *
     * @param source Source string.
     * @param data Int32Array with parsed data.
     * @param uboModCount Number of uBO modifier records.
     * @param bodyStart Source index where body starts.
     * @param bodyEnd Source index where body ends (trimmed).
     * @param isLocIncluded Whether to include location info.
     * @param dataOffset Offset within `data` where the cosmetic rule header starts.
     *
     * @returns Object with modifierList and cleanedSelector.
     *
     * @throws {Error} If :style() or :remove() modifier is encountered.
     */
    private static buildUboModifiers(
        source: string,
        data: Int32Array,
        uboModCount: number,
        bodyStart: number,
        bodyEnd: number,
        isLocIncluded: boolean,
        dataOffset = 0,
    ): { modifierList: ModifierList; cleanedSelector: string } {
        const children: Modifier[] = [];

        // Collect source ranges for selector reconstruction (sorted by srcStart)
        const srcRanges: Array<[number, number]> = [];

        for (let i = 0; i < uboModCount; i += 1) {
            const base = dataOffset + CR_UBO_MODS_OFFSET + i * UBO_MODIFIER_RECORD_STRIDE;

            const nameStart = data[base + UBO_MOD_FIELD_NAME_START];
            const nameEnd = data[base + UBO_MOD_FIELD_NAME_END];
            const modFlags = data[base + UBO_MOD_FIELD_FLAGS];
            const valueStart = data[base + UBO_MOD_FIELD_VALUE_START];
            const valueEnd = data[base + UBO_MOD_FIELD_VALUE_END];
            const srcStart = data[base + UBO_MOD_FIELD_SRC_START];
            const srcEnd = data[base + UBO_MOD_FIELD_SRC_END];

            const modName = source.slice(nameStart, nameEnd);

            // Defensive guard: rules containing :style()/:remove() are routed
            // to UboCssInjectionAstBuilder by the dispatcher. Reaching this
            // branch means a dispatcher bug (the CR_FLAG_BODY_UBO_CSS_INJECTION
            // flag was not set when it should have been).
            if (modName === UboPseudoName.Style || modName === UboPseudoName.Remove) {
                throw new Error(
                    `Internal error: :${modName}() reached ElementHidingAstBuilder; `
                    + 'expected UboCssInjectionAstBuilder dispatch (CR_FLAG_BODY_UBO_CSS_INJECTION not set).',
                );
            }

            const isException = (modFlags & MODIFIER_FLAG_NEGATED) !== 0;

            const nameNode: Value = {
                type: NodeType.Value,
                value: modName,
            };

            if (isLocIncluded) {
                nameNode.start = nameStart;
                nameNode.end = nameEnd;
            }

            const modifier: Modifier = {
                type: NodeType.Modifier,
                name: nameNode,
                exception: isException || undefined,
            };

            if (valueStart !== NO_VALUE && valueEnd !== NO_VALUE) {
                const valueNode: Value = {
                    type: NodeType.Value,
                    value: source.slice(valueStart, valueEnd),
                };

                if (isLocIncluded) {
                    valueNode.start = valueStart;
                    valueNode.end = valueEnd;
                }

                modifier.value = valueNode;
            }

            if (isLocIncluded) {
                modifier.start = srcStart;
                modifier.end = srcEnd;
            }

            children.push(modifier);
            srcRanges.push([srcStart, srcEnd]);
        }

        // Reconstruct cleaned selector by excluding modifier source ranges
        // Ranges are already sorted left-to-right (parser scans sequentially)
        let cleanedSelector = '';
        let cursor = bodyStart;

        for (let i = 0; i < srcRanges.length; i += 1) {
            const [rangeStart, rangeEnd] = srcRanges[i];
            if (cursor < rangeStart) {
                cleanedSelector += source.slice(cursor, rangeStart);
            }
            cursor = rangeEnd;
        }

        if (cursor < bodyEnd) {
            cleanedSelector += source.slice(cursor, bodyEnd);
        }

        cleanedSelector = cleanedSelector.trim();

        const modifierList: ModifierList = {
            type: NodeType.ModifierList,
            children,
        };

        if (isLocIncluded && children.length > 0) {
            modifierList.start = children[0].start;
            modifierList.end = children[children.length - 1].end;
        }

        return { modifierList, cleanedSelector };
    }
}
