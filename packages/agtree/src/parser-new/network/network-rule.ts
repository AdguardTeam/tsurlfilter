/* eslint-disable no-bitwise */

/**
 * @file Network rule AST parser — creates NetworkRule nodes from preparsed data.
 *
 * Top of the parser chain. Delegates to
 * {@link ModifierListParser} → modifier parser → {@link ValueParser}.
 */

import type { NetworkRule } from '../../nodes';
import { NetworkRuleType, RuleCategory } from '../../nodes';
import {
    NR_FLAG_EXCEPTION,
    NR_FLAGS_OFFSET,
    NR_PATTERN_END_OFFSET,
    NR_PATTERN_START_OFFSET,
} from '../../preparser/network/network-rule';
import { AdblockSyntax } from '../../utils/adblockers';
import { ModifierListParser } from '../misc/modifier-list';
import { ValueParser } from '../misc/value';

/**
 * Options for the AST parser.
 */
export interface PreparserParseOptions {
    /**
     * Whether to include source location info (start/end) on AST nodes.
     */
    isLocIncluded?: boolean;

    /**
     * Whether to include raw text on the root node.
     */
    includeRaws?: boolean;

    /**
     * Whether to parse uBlock Origin-specific rules (uBO modifiers in cosmetic rules).
     * Defaults to `true`.
     */
    parseUboSpecificRules?: boolean;
}

/**
 * Internal parser that builds NetworkRule AST nodes from preparsed data.
 *
 * This is the "Layer 3" parser that materializes JS objects from the
 * structural indices produced by the preparser. Only call this when
 * you actually need an AST — for query-only use cases, use the
 * utility functions instead.
 *
 * Delegates to {@link ModifierListParser} → modifier parser → {@link ValueParser}.
 */
export class NetworkRuleAstParser {
    /**
     * Builds a full NetworkRule AST node from preparsed data.
     *
     * @param source Original source string.
     * @param data Preparsed data buffer (from `NetworkRulePreparser.preparse`).
     * @param options Parse options (location, raws).
     *
     * @returns NetworkRule AST node.
     */
    public static parse(
        source: string,
        data: Int32Array,
        options: PreparserParseOptions = {},
    ): NetworkRule {
        const flags = data[NR_FLAGS_OFFSET];
        const patternStart = data[NR_PATTERN_START_OFFSET];
        const patternEnd = data[NR_PATTERN_END_OFFSET];
        const isLoc = options.isLocIncluded ?? false;

        // Build pattern Value node
        const pattern = ValueParser.parse(source, patternStart, patternEnd, isLoc);

        // Build modifier list (chains to modifier → value parsers)
        const modifiers = ModifierListParser.parse(source, data, isLoc);

        // Build the NetworkRule node
        const result: NetworkRule = {
            type: NetworkRuleType.NetworkRule,
            category: RuleCategory.Network,
            syntax: AdblockSyntax.Common,
            exception: (flags & NR_FLAG_EXCEPTION) !== 0,
            pattern,
            modifiers,
        };

        if (options.includeRaws) {
            result.raws = {
                text: source,
            };
        }

        if (options.isLocIncluded) {
            result.start = 0;
            result.end = source.length;
        }

        return result;
    }
}
