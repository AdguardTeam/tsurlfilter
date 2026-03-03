/* eslint-disable no-bitwise */

/**
 * @file Network rule AST parser — creates NetworkRule nodes from preparsed data.
 *
 * Top of the parser chain. Delegates to
 * {@link ModifierListParser} → {@link ModifierParser} → {@link ValueParser}.
 */

import { AdblockSyntax } from '../utils/adblockers';
import type { NetworkRule } from '../nodes';
import { NetworkRuleType, RuleCategory } from '../nodes';
import {
    NR_FLAGS,
    NR_PATTERN_START,
    NR_PATTERN_END,
    FLAG_EXCEPTION,
} from '../preparser/types';
import { ValueParser } from './value';
import { ModifierListParser } from './modifier-list';

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
}

/**
 * Internal parser that builds NetworkRule AST nodes from preparsed data.
 *
 * This is the "Layer 3" parser that materializes JS objects from the
 * structural indices produced by the preparser. Only call this when
 * you actually need an AST — for query-only use cases, use the
 * utility functions instead.
 *
 * Delegates to {@link ModifierListParser} → {@link ModifierParser} → {@link ValueParser}.
 */
export class NetworkRuleAstParser {
    /**
     * Builds a full NetworkRule AST node from preparsed data.
     *
     * @param source Original source string.
     * @param data Preparsed data buffer (from `NetworkRulePreparser.preparse`).
     * @param options Parse options (location, raws).
     * @returns NetworkRule AST node.
     */
    static parse(
        source: string,
        data: Int32Array,
        options: PreparserParseOptions = {},
    ): NetworkRule {
        const { isLocIncluded = false, includeRaws = false } = options;
        const flags = data[NR_FLAGS];
        const patternStart = data[NR_PATTERN_START];
        const patternEnd = data[NR_PATTERN_END];

        // Build pattern Value node
        const pattern = ValueParser.parse(source, patternStart, patternEnd, isLocIncluded);

        // Build modifier list (chains to modifier → value parsers)
        const modifiers = ModifierListParser.parse(source, data, isLocIncluded);

        // Build the NetworkRule node
        const result: NetworkRule = {
            type: NetworkRuleType.NetworkRule,
            category: RuleCategory.Network,
            syntax: AdblockSyntax.Common,
            exception: (flags & FLAG_EXCEPTION) !== 0,
            pattern,
            modifiers,
        };

        if (includeRaws) {
            result.raws = {
                text: source,
            };
        }

        if (isLocIncluded) {
            result.start = 0;
            result.end = source.length;
        }

        return result;
    }
}
