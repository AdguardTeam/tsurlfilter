/**
 * Interface that contains the index number of
 * the source rule and the filter id of the rule.
 */
export interface SourceRuleIdxAndFilterId {
    /**
     * Index number of the source rule in the original filter list.
     */
    sourceRuleIndex: number;

    /**
     * Filter ID of the source rule.
     */
    filterId: number;
}

/**
 * Interface that contains the relationship between the original rules
 * (filter id with rule index) and the converted rules (declarative rule id).
 */
export interface Source extends SourceRuleIdxAndFilterId {
    /**
     * Declarative rule ID of the converted rule.
     */
    declarativeRuleId: number;
}

/**
 * Interface for source map operations.
 */
export interface ISourceMap {
    /**
     * Returns source filter id and source text rule id
     * for provided declarative rule id.
     *
     * @param ruleId Converted rule id.
     *
     * @returns List of pairs: source filter id and source rule id.
     */
    getByDeclarativeRuleId(ruleId: number): SourceRuleIdxAndFilterId[];

    /**
     * Returns ids of converted declarative rules for provided pairs of source
     * filter id and source text rule.
     *
     * @param source Pair of source rule and filter id.
     *
     * @returns List of ids of converted declarative rules.
     */
    getBySourceRuleIndex(source: SourceRuleIdxAndFilterId): number[];

    /**
     * Serializes source map to JSON string.
     *
     * @returns JSON string.
     */
    serialize(): string;
}

/**
 * Contains a list of records with source rule ID, converted rule ID
 * and filter ID.
 * Can return the source filter and rule for the provided conversion rule ID.
 */
export class SourceMap implements ISourceMap {
    /**
     * List of sources.
     */
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

            // Fill declarative IDs map.
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
    public static getKeyFromSource(source: SourceRuleIdxAndFilterId): string {
        return `${source.filterId}_${source.sourceRuleIndex}`;
    }

    /** @inheritdoc */
    public getByDeclarativeRuleId(ruleId: number): SourceRuleIdxAndFilterId[] {
        return this.ruleIdMap.get(ruleId) || [];
    }

    /** @inheritdoc */
    public getBySourceRuleIndex(source: SourceRuleIdxAndFilterId): number[] {
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
    public static deserializeSources(sourceString: string): Source[] {
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
     * @returns JSON string.
     *
     * @todo Can use protocol VLQ.
     */
    public serialize(): string {
        // Remove fields names to reduce size of serialized string
        const plainArray = this.sources.map(({
            declarativeRuleId,
            sourceRuleIndex,
            filterId,
        }) => ([declarativeRuleId, sourceRuleIndex, filterId]));
        return JSON.stringify(plainArray);
    }
}
