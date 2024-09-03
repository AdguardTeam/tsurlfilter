import { SourceRuleIdxAndFilterId } from './source-map';

// This type is using only to better description of code.
type RuleHash = number;

/**
 * Hash of source rule to fast check applicable of $badfilter rule.
 * Because hash can be not unique, we store list of values for each key
 * to prevent collisions.
 */
type RuleHashToRuleIdx = Map<RuleHash, SourceRuleIdxAndFilterId[]>;

/**
 * Contains a hash of the rule and the 'coordinates' of this rule: the source
 * filter ID and the rule index within this filter.
 */
type HashWithSource = {
    hash: RuleHash,
    source: SourceRuleIdxAndFilterId,
};

/**
 * Contains the 'coordinates' of a rule: the source filter ID
 * and the rule index within this filter.
 */
type SerializedSource = [
    SourceRuleIdxAndFilterId['filterId'],
    SourceRuleIdxAndFilterId['sourceRuleIndex'],
];

/**
 * Describes {@link RulesHashMap} which is serialized to primitive values for
 * possible saving and loading.
 */
type SerializedHashWithSource = [
    RuleHash,
    SerializedSource[],
];

export interface IRulesHashMap {
    /**
     * Tries to find rules with same hash and if found - returns theirs sources:
     * filter id and rule id.
     *
     * @param hash Number hash to search rules with same hash.
     *
     * @returns List of sources (filter id and rule id) of rules with same hash as
     * provided in parameter or empty array.
     */
    findRules(hash: number): SourceRuleIdxAndFilterId[];

    /**
     * Serializes map of rules hashes to JSON string.
     *
     * @todo (TODO:) Can use protocol VLQ.
     *
     * @returns JSON string.
     */
    serialize(): string;
}

/**
 * Contains a dictionary where the key is the hash of the rule and the value is
 * a list of sources for the rule. Storing this dictionary is necessary for fast
 * rule matching, which can be negated by $badfilter.
 */
export class RulesHashMap implements IRulesHashMap {
    private map: RuleHashToRuleIdx = new Map();

    /**
     * Creates new {@link RulesHashMap}.
     *
     * @param listOfRulesWithHash List of rules hashes and rules sources:
     * filter id with rule index.
     */
    constructor(listOfRulesWithHash: HashWithSource[]) {
        listOfRulesWithHash.forEach(({ hash, source }) => {
            const existingValue = this.map.get(hash);
            if (existingValue) {
                existingValue.push(source);
            } else {
                this.map.set(hash, [source]);
            }
        });
    }

    /** @inheritdoc */
    findRules(hash: number): SourceRuleIdxAndFilterId[] {
        return this.map.get(hash) || [];
    }

    /**
     * Deserializes dictionary from raw string.
     *
     * @param rawString The original dictionary that was serialized into a string.
     *
     * @returns Deserialized dictionary.
     */
    static deserializeSources(rawString: string): HashWithSource[] {
        const plainArray: SerializedHashWithSource[] = JSON.parse(rawString);

        const allPairs = plainArray
            .map(([hash, sources]) => {
                return sources.map(([filterId, sourceRuleIndex]) => {
                    return {
                        hash,
                        source: {
                            filterId,
                            sourceRuleIndex,
                        },
                    };
                });
            })
            .flat();

        return allPairs;
    }

    /** @inheritdoc */
    serialize(): string {
        const arr = Array.from(this.map);

        const serializedValues: SerializedHashWithSource[] = arr
            .map(([hash, source]) => {
                const sources: SerializedSource[] = source.map((s) => {
                    return [s.filterId, s.sourceRuleIndex];
                });

                return [hash, sources];
            });

        return JSON.stringify(serializedValues);
    }
}
