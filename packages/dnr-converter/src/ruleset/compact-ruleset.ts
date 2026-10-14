/**
 * @file Reader for compact ruleset files produced by
 * {@link RulesetWithSourceMap.serializeCompact}.
 *
 * The files are build artifacts of this converter, so the joined metadata
 * payload is trusted to be a {@link CompactRulesetEnvelope}. Only the chunk
 * layer is checked here; the nested `metadata` and `lazyMetadata` objects are
 * validated by {@link RulesetWithSourceMap.fromCompact} or
 * {@link RulesetWithSourceMap.deserialize}.
 */

import { type DeclarativeRule } from '../declarative-rule';

import { MetadataRules } from './metadata-rule';
import { type CompactRulesetEnvelope } from './ruleset-with-source-map';

/**
 * Content of a compact ruleset file: the envelope written by
 * {@link RulesetWithSourceMap.serializeCompact}, the ordinary declarative
 * rules and the number of metadata rules that precede them.
 */
export type CompactRulesetContent = CompactRulesetEnvelope & {
    /**
     * Ordinary declarative rules in file order, without the metadata rules.
     */
    declarativeRules: DeclarativeRule[];

    /**
     * Number of metadata rules at the beginning of the file. They are static
     * DNR rules and count towards the static rule quota.
     */
    metadataRulesCount: number;
};

/**
 * Reads a parsed filter ruleset file: joins the leading metadata rules,
 * parses the metadata once and returns it with the ordinary rules and the
 * number of metadata rules. The payload is taken as the envelope written by
 * {@link RulesetWithSourceMap.serializeCompact} without further checks, and
 * ordinary rules are returned as parsed; both are validated later by
 * {@link RulesetWithSourceMap.fromCompact} or
 * {@link RulesetWithSourceMap.deserialize} and the ruleset content provider.
 *
 * @param rulesetId Rule set id, used in error messages.
 * @param parsedRuleset Parsed JSON content of a `ruleset_N.json` file.
 *
 * @returns Envelope fields, ordinary rules and metadata rule count.
 *
 * @throws {InvalidMetadataChunksError} If `parsedRuleset` is not an array,
 * has no leading metadata rule, has a metadata rule without a string `chunk`,
 * or if the joined fragments are not valid JSON.
 */
export function parseCompactRuleset(rulesetId: string, parsedRuleset: unknown): CompactRulesetContent {
    const { payload, declarativeRules, metadataRulesCount } = MetadataRules.read(rulesetId, parsedRuleset);

    const { metadata, lazyMetadata, filterContent } = payload as CompactRulesetEnvelope;

    return {
        metadata,
        lazyMetadata,
        filterContent,
        declarativeRules,
        metadataRulesCount,
    };
}
