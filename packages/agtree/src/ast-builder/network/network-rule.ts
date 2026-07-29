/* eslint-disable no-bitwise */

/**
 * @file Network rule AST parser — creates NetworkRule nodes from parsed data.
 *
 * Top of the parser chain. Delegates to
 * {@link ModifierListAstBuilder} → modifier parser → {@link ValueAstBuilder}.
 */

import type { NetworkRule } from '../../nodes';
import { NetworkRuleType, RuleCategory, ValueKind } from '../../nodes';
import {
    NR_FLAG_EXCEPTION,
    NR_FLAG_PATTERN_REGEX,
    NR_FLAGS_OFFSET,
    NR_MODIFIER_COUNT_OFFSET,
    NR_MODIFIER_RECORDS_OFFSET,
    NR_PATTERN_END_OFFSET,
    NR_PATTERN_START_OFFSET,
} from '../../parser/network/constants';
import { SYNTAX_ALL } from '../../utils/syntax-flags';
import { ModifierListAstBuilder } from '../misc/modifier-list';
import { ValueAstBuilder } from '../misc/value';
import type { ParseOptions } from '../options';

/**
 * Internal parser that builds NetworkRule AST nodes from parsed data.
 *
 * This is the "Layer 3" parser that materializes JS objects from the
 * structural indices produced by the parser. Only call this when
 * you actually need an AST — for query-only use cases, use the
 * utility functions instead.
 *
 * Delegates to {@link ModifierListAstBuilder} → modifier parser → {@link ValueAstBuilder}.
 */
export class NetworkRuleAstBuilder {
    /**
     * Builds a full NetworkRule AST node from parsed data.
     *
     * @param source Original source string.
     * @param data Preparsed data buffer (from `NetworkRuleParser.parse`).
     * @param dataOffset Offset within data where the parser output starts. Defaults to 0.
     * @param options Parse options (location, raws).
     *
     * @returns NetworkRule AST node.
     */
    public static parse(
        source: string,
        data: Int32Array,
        dataOffset = 0,
        options: ParseOptions = {},
    ): NetworkRule {
        const flags = data[dataOffset + NR_FLAGS_OFFSET];
        const patternStart = data[dataOffset + NR_PATTERN_START_OFFSET];
        const patternEnd = data[dataOffset + NR_PATTERN_END_OFFSET];
        const isLoc = options.isLocIncluded ?? false;

        // Build pattern Value node
        const patternKind = (flags & NR_FLAG_PATTERN_REGEX) !== 0
            ? ValueKind.Regex
            : ValueKind.Pattern;
        const pattern = ValueAstBuilder.parse(source, patternStart, patternEnd, isLoc, patternKind);

        // Build modifier list (chains to modifier → value parsers)
        const modifiers = ModifierListAstBuilder.parse(
            source,
            data,
            isLoc,
            dataOffset + NR_MODIFIER_COUNT_OFFSET,
            dataOffset + NR_MODIFIER_RECORDS_OFFSET,
        );

        // Build the NetworkRule node
        const result: NetworkRule = {
            type: NetworkRuleType.NetworkRule,
            category: RuleCategory.Network,
            syntax: SYNTAX_ALL,
            exception: (flags & NR_FLAG_EXCEPTION) !== 0,
            pattern,
            modifiers,
        };

        if (options.isLocIncluded) {
            result.start = 0;
            result.end = source.length;
        }

        return result;
    }
}
