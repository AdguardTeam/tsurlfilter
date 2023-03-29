/**
 * The SourceRuleIdxAndFilterId contains the index number of the source rule and
 * the filter id of the rule.
 */
type SourceRuleIdxAndFilterId = {
    sourceRuleIndex: number,
    filterId: number,
};

/**
 * The Source contains the relationship between the original rules and
 * the converted rules.
 */
export type Source = { declarativeRuleId: number } & SourceRuleIdxAndFilterId;

export interface ISourceMap {
    getByDeclarativeRuleId(ruleId: number): SourceRuleIdxAndFilterId[] | [];

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
     * Creates new SourceMap from provided list of sources.
     *
     * @param sources List of sources.
     */
    constructor(sources: Source[]) {
        this.sources = sources;

        // For fast search
        this.sources.forEach((item) => {
            const key = item.declarativeRuleId;
            const { sourceRuleIndex, filterId } = item;
            const value: SourceRuleIdxAndFilterId = {
                sourceRuleIndex,
                filterId,
            };

            const existingPairs = this.ruleIdMap.get(key);
            const newValue = existingPairs
                ? existingPairs.concat(value)
                : [value];

            this.ruleIdMap.set(key, newValue);
        });
    }

    /**
     * Returns source filter id and source text rule id
     * for provided declarative rule id.
     *
     * @param ruleId Converted rule id.
     *
     * @returns List of pairs: source filter id and source rule id.
     */
    getByDeclarativeRuleId(ruleId: number): SourceRuleIdxAndFilterId[] | [] {
        return this.ruleIdMap.get(ruleId) || [];
    }

    /**
     * Deserializes array of sources from string.
     *
     * @param sourceString The original map that was serialized into a string.
     *
     * @returns List of sources.
     */
    static deserializeSources(sourceString: string): Source[] {
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
