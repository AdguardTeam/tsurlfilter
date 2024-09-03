/**
 * The SourceRuleIdxAndFilterId contains the index number of the source rule and
 * the filter id of the rule.
 */
export type SourceRuleIdxAndFilterId = {
    sourceRuleIndex: number,
    filterId: number,
};

/**
 * The Source contains the relationship between the original rules (filter id
 * with rule index) and the converted rules (declarative rule id).
 */
export type Source = { declarativeRuleId: number } & SourceRuleIdxAndFilterId;

export interface ISourceMap {
    getByDeclarativeRuleId(ruleId: number): SourceRuleIdxAndFilterId[];

    getBySourceRuleIndex(source: SourceRuleIdxAndFilterId): number[];

    serialize(): string;
}

/**
 * Contains a list of records with source rule ID, converted rule ID
 * and filter ID.
 * Can return the source filter and rule for the provided conversion rule ID.
 */
export class SourceMap implements ISourceMap {
    private sources: Source[] = [];

    /**
     * Needs for fast search for source rule.
     */
    private ruleIdMap: Map<number, SourceRuleIdxAndFilterId[]> = new Map();

    /**
     * Needs for fast search for source rule.
     */
    private declarativeIdMap: Map<string, number[]> = new Map();

    /**
     * Creates new SourceMap from provided list of sources.
     *
     * @param sources List of sources.
     */
    constructor(sources: Source[]) {
        this.sources = sources;

        // For fast search
        this.sources.forEach((item) => {
            const { sourceRuleIndex, filterId, declarativeRuleId } = item;

            // Fill source rules map.
            const existingSourcePairs = this.ruleIdMap.get(declarativeRuleId);
            const value: SourceRuleIdxAndFilterId = {
                sourceRuleIndex,
                filterId,
            };
            const newSourceValue = existingSourcePairs
                ? existingSourcePairs.concat(value)
                : [value];

            this.ruleIdMap.set(declarativeRuleId, newSourceValue);

            // Fill
            const key = SourceMap.getKeyFromSource(value);
            const existingDeclarativeIdsPairs = this.declarativeIdMap.get(key);
            const newDeclarativeIdsValue = existingDeclarativeIdsPairs
                ? existingDeclarativeIdsPairs.concat(declarativeRuleId)
                : [declarativeRuleId];
            this.declarativeIdMap.set(key, newDeclarativeIdsValue);
        });
    }

    /**
     * Creates unique key for provided pair of source rule and filter id.
     *
     * @param source Pair of source rule and filter id.
     *
     * @returns Unique key for dictionary.
     */
    static getKeyFromSource(source: SourceRuleIdxAndFilterId): string {
        return `${source.filterId}_${source.sourceRuleIndex}`;
    }

    /**
     * Returns source filter id and source text rule id
     * for provided declarative rule id.
     *
     * @param ruleId Converted rule id.
     *
     * @returns List of pairs: source filter id and source rule id.
     */
    getByDeclarativeRuleId(ruleId: number): SourceRuleIdxAndFilterId[] {
        return this.ruleIdMap.get(ruleId) || [];
    }

    /**
     * Returns ids of converted declarative rules for provided pairs of source
     * filter id and source text rule.
     *
     * @param source Pair of source rule and filter id.
     *
     * @returns List of ids of converted declarative rules.
     */
    getBySourceRuleIndex(source: SourceRuleIdxAndFilterId): number[] {
        const key = SourceMap.getKeyFromSource(source);

        return this.declarativeIdMap.get(key) || [];
    }

    /**
     * Deserializes array of sources from string.
     *
     * @param sourceString The original map that was serialized into a string.
     *
     * @returns List of sources.
     */
    static deserializeSources(sourceString: string): Source[] {
        // TODO: Add validation
        const arr: number[][] = JSON.parse(sourceString);

        return arr.map((item) => ({
            declarativeRuleId: item[0],
            sourceRuleIndex: item[1],
            filterId: item[2],
        }));
    }

    /**
     * Serializes source map to JSON string.
     *
     * @todo (TODO:) Can use protocol VLQ.
     *
     * @returns JSON string.
     */
    serialize(): string {
        // Remove fields names to reduce size of serialized string
        const plainArray = this.sources.map(({
            declarativeRuleId,
            sourceRuleIndex,
            filterId,
        }) => ([declarativeRuleId, sourceRuleIndex, filterId]));
        return JSON.stringify(plainArray);
    }
}
