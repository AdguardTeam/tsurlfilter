/**
 * @file Metadata rules: service rules that carry ruleset metadata.
 *
 * Metadata rules are declarative rules that never match a request. Each one
 * carries a fragment of the serialized metadata in `metadata.chunk`. The
 * leading run of metadata rules in a ruleset file, joined in order, is the
 * metadata JSON. The extension and build tools use it to process other
 * rules, conversion maps and source maps.
 */

import { type DeclarativeRule, ResourceType, RuleActionType } from '../declarative-rule';
import { InvalidMetadataChunksError } from '../errors/metadata-errors';
import { getErrorMessage } from '../utils/error';
import { serializeJson } from '../utils/string';

import { CHUNK_KEY, MetadataChunks } from './metadata-chunks';

/**
 * Dummy rule URL that should not match any request. It is also the marker
 * that identifies metadata rules when a ruleset is read.
 */
const DUMMY_RULE_URL = 'dummy.rule.adguard.com';

/**
 * A metadata rule: a declarative rule carrying one fragment of the
 * serialized metadata.
 */
export interface MetadataChunkRule extends DeclarativeRule {
    /**
     * Fragment container.
     */
    metadata: {
        /**
         * Fragment of the serialized metadata JSON.
         */
        [CHUNK_KEY]: string;
    };
}

/**
 * Minimal shape of a metadata rule recognized while reading a ruleset: the
 * marker `urlFilter` and an own `metadata` property carrying a fragment.
 */
type MetadataRuleLike = {
    condition?: {
        urlFilter?: unknown;
    };
    metadata: {
        [CHUNK_KEY]?: unknown;
    } | null;
};

/**
 * Result of reading the metadata rules of a ruleset.
 */
export type ReadMetadataRulesResult = {
    /**
     * Parsed metadata payload.
     */
    payload: unknown;

    /**
     * Rules that follow the metadata rules, in file order.
     */
    declarativeRules: DeclarativeRule[];

    /**
     * Number of metadata rules found at the beginning of the ruleset.
     */
    metadataRulesCount: number;
};

/**
 * Writes and reads metadata rules.
 */
export class MetadataRules {
    /**
     * Checks whether a parsed rule is a metadata rule: an object whose
     * `condition.urlFilter` is the dummy URL marker and that has an own
     * `metadata` property. Ordinary converted rules never carry `metadata`, so a
     * converted rule for the marker host without that property is an ordinary
     * rule.
     *
     * @param rule Parsed rule.
     *
     * @returns `true` if the rule is a metadata rule.
     */
    public static isMetadataRule(rule: unknown): rule is MetadataRuleLike {
        return typeof rule === 'object'
            && rule !== null
            && (rule as MetadataRuleLike).condition?.urlFilter === DUMMY_RULE_URL
            && Object.hasOwn(rule, 'metadata');
    }

    /**
     * Serializes a metadata payload and wraps its fragments into metadata rules.
     * Every rule's `metadata` value fits the per-value size bound in the given
     * formatting mode.
     *
     * @param payload Metadata object; must be JSON serializable.
     * @param usedIds Ids taken by ordinary rules and by unsafe rules stored in
     * the metadata; metadata rules get the smallest ids outside this set.
     * @param pretty Whether the ruleset file will be pretty printed.
     *
     * @returns Metadata rules in fragment order.
     */
    public static create(
        payload: unknown,
        usedIds: ReadonlySet<number>,
        pretty: boolean,
    ): MetadataChunkRule[] {
        const fragments = MetadataChunks.split(serializeJson(payload), pretty);
        const ids = MetadataChunks.allocateIds(fragments.length, usedIds);

        return fragments.map((chunk, i) => ({
            id: ids[i],
            action: {
                type: RuleActionType.Block,
            },
            condition: {
                urlFilter: DUMMY_RULE_URL,
                resourceTypes: [ResourceType.XmlHttpRequest],
            },
            metadata: {
                [CHUNK_KEY]: chunk,
            },
        }));
    }

    /**
     * Reads the metadata rules of a parsed ruleset: takes the leading run of
     * metadata rules (see {@link MetadataRules.isMetadataRule}), joins their fragments in order
     * and parses the result once. Metadata rule ids are ignored. A rule with the
     * marker `urlFilter` but without a `metadata` property is an ordinary rule.
     *
     * @param rulesetId Rule set id, used in error messages.
     * @param rules Parsed content of a ruleset file.
     *
     * @returns Parsed payload, the remaining rules and the number of metadata
     * rules.
     *
     * @throws {InvalidMetadataChunksError} If `rules` is not an array, has no
     * leading metadata rule, has a metadata rule without a string `chunk`, or if
     * the joined fragments are not valid JSON.
     */
    public static read(rulesetId: string, rules: unknown): ReadMetadataRulesResult {
        if (!Array.isArray(rules)) {
            throw new InvalidMetadataChunksError(rulesetId, 'expected an array of declarative rules');
        }

        const fragments: string[] = [];
        let index = 0;

        for (const rule of rules) {
            if (!MetadataRules.isMetadataRule(rule)) {
                break;
            }

            const chunk = rule.metadata?.[CHUNK_KEY];

            if (typeof chunk !== 'string') {
                throw new InvalidMetadataChunksError(
                    rulesetId,
                    `"metadata.${CHUNK_KEY}" of metadata rule #${index} is not a string`,
                );
            }

            fragments.push(chunk);
            index += 1;
        }

        if (fragments.length === 0) {
            throw new InvalidMetadataChunksError(
                rulesetId,
                'no metadata rules found at the beginning of the rule set',
            );
        }

        let payload: unknown;

        try {
            payload = JSON.parse(fragments.join(''));
        } catch (e) {
            throw new InvalidMetadataChunksError(
                rulesetId,
                `metadata chunks do not form valid JSON: ${getErrorMessage(e)}`,
                e as Error,
            );
        }

        return {
            payload,
            declarativeRules: rules.slice(index),
            metadataRulesCount: index,
        };
    }
}
