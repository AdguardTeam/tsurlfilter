/* eslint-disable no-bitwise */

/**
 * @file Element hiding cosmetic rule AST parser.
 *
 * Reads preparsed data from ctx.data and builds ElementHidingRule AST nodes.
 */

import { UboPseudoName } from '../../common/ubo-selector-common';
import { CosmeticRuleType, RuleCategory } from '../../nodes';
import type {
    ElementHidingRule,
    ElementHidingRuleBody,
    Modifier,
    ModifierList,
    Value,
} from '../../nodes';
import { MAX_MODIFIER_RECORD_STRIDE } from '../../preparser/context';
import {
    cosmeticSepLength,
    cosmeticSepToString,
    CR_BODY_START,
    CR_DOMAIN_COUNT,
    CR_FLAG_EXCEPTION,
    CR_FLAG_HAS_ADG_MODS,
    CR_FLAG_HAS_UBO_MODS,
    CR_FLAGS_OFFSET,
    CR_SEP_KIND_MASK,
    CR_SEP_KIND_SHIFT,
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
} from '../../preparser/cosmetic/constants';
import type { CosmeticSepKind } from '../../preparser/cosmetic-separator';
import { MODIFIER_FLAG_NEGATED, NO_VALUE, NR_MODIFIER_COUNT_OFFSET } from '../../preparser/network/constants';
import { AdblockSyntax } from '../../utils/adblockers';
import { DomainListParser } from '../misc/domain-list';
import { ModifierListParser } from '../misc/modifier-list';

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
        const hasUboMods = (flags & CR_FLAG_HAS_UBO_MODS) !== 0;

        // Read domain count and parse domains
        const domainCount = data[CR_DOMAIN_COUNT];
        const domainRecordsOffset = 5 + maxMods * MAX_MODIFIER_RECORD_STRIDE;
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

        // Build uBO modifiers and reconstruct cleaned selector if needed
        let modifiers: ModifierList | undefined;
        let syntax: AdblockSyntax = AdblockSyntax.Common;
        let selectorListValue: string;

        if (hasUboMods) {
            const uboModCount = data[NR_MODIFIER_COUNT_OFFSET];

            // Defensive bounds check: ensure uBO records fit within the modifier region
            const uboEnd = CR_UBO_MODS_OFFSET + uboModCount * UBO_MODIFIER_RECORD_STRIDE;
            if (uboEnd > domainRecordsOffset) {
                // eslint-disable-next-line max-len
                throw new Error(`uBO modifier records overflow into domain region (${uboEnd} > ${domainRecordsOffset})`);
            }
            // eslint-disable-next-line max-len
            const uboResult = ElementHidingAstParser.buildUboModifiers(source, data, uboModCount, bodyStart, bodyEnd, isLocIncluded);
            modifiers = uboResult.modifierList;
            selectorListValue = uboResult.cleanedSelector;
            syntax = AdblockSyntax.Ubo;
        } else if (hasAdgMods) {
            modifiers = ModifierListParser.parse(source, data, isLocIncluded);
            selectorListValue = bodyEnd > bodyStart ? source.slice(bodyStart, bodyEnd) : '';
            syntax = AdblockSyntax.Adg;
        } else {
            selectorListValue = bodyEnd > bodyStart ? source.slice(bodyStart, bodyEnd) : '';
        }

        const selectorList: Value = {
            type: 'Value',
            value: selectorListValue,
        };

        if (isLocIncluded) {
            selectorList.start = bodyStart;
            selectorList.end = bodyEnd;
        }

        if (includeRaws) {
            selectorList.raw = source.slice(bodyStart, bodyEnd);
        }

        const body: ElementHidingRuleBody = {
            type: 'ElementHidingRuleBody',
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

    /**
     * Build Modifier AST nodes from uBO modifier records in ctx.data.
     * Reconstructs the cleaned selector by excluding modifier source ranges.
     *
     * @param source Source string.
     * @param data Int32Array with preparsed data.
     * @param uboModCount Number of uBO modifier records.
     * @param bodyStart Source index where body starts.
     * @param bodyEnd Source index where body ends (trimmed).
     * @param isLocIncluded Whether to include location info.
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
    ): { modifierList: ModifierList; cleanedSelector: string } {
        const children: Modifier[] = [];

        // Collect source ranges for selector reconstruction (sorted by srcStart)
        const srcRanges: Array<[number, number]> = [];

        for (let i = 0; i < uboModCount; i += 1) {
            const base = CR_UBO_MODS_OFFSET + i * UBO_MODIFIER_RECORD_STRIDE;

            const nameStart = data[base + UBO_MOD_FIELD_NAME_START];
            const nameEnd = data[base + UBO_MOD_FIELD_NAME_END];
            const modFlags = data[base + UBO_MOD_FIELD_FLAGS];
            const valueStart = data[base + UBO_MOD_FIELD_VALUE_START];
            const valueEnd = data[base + UBO_MOD_FIELD_VALUE_END];
            const srcStart = data[base + UBO_MOD_FIELD_SRC_START];
            const srcEnd = data[base + UBO_MOD_FIELD_SRC_END];

            const modName = source.slice(nameStart, nameEnd);

            // TODO: implement CssInjectionRule for :style()/:remove()
            if (modName === UboPseudoName.Style || modName === UboPseudoName.Remove) {
                throw new Error(
                    `:${modName}() is not yet implemented in the new parser pipeline`,
                );
            }

            const isException = (modFlags & MODIFIER_FLAG_NEGATED) !== 0;

            const nameNode: Value = {
                type: 'Value',
                value: modName,
            };

            if (isLocIncluded) {
                nameNode.start = nameStart;
                nameNode.end = nameEnd;
            }

            const modifier: Modifier = {
                type: 'Modifier',
                name: nameNode,
                exception: isException || undefined,
            };

            if (valueStart !== NO_VALUE && valueEnd !== NO_VALUE) {
                const valueNode: Value = {
                    type: 'Value',
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
        // Ranges are already sorted left-to-right (preparser scans sequentially)
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
            type: 'ModifierList',
            children,
        };

        if (isLocIncluded && children.length > 0) {
            modifierList.start = children[0].start;
            modifierList.end = children[children.length - 1].end;
        }

        return { modifierList, cleanedSelector };
    }
}
