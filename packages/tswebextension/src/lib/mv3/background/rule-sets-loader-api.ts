import {
    IFilter,
    IRuleSet,
    RuleSet,
    METADATA_FILENAME,
    LAZY_METADATA_FILENAME,
    IndexedNetworkRuleWithHash,
    RulesHashMap,
} from '@adguard/tsurlfilter/es/declarative-converter';

/**
 * RuleSetsLoaderApi can create {@link IRuleSet} from the provided rule set ID
 * with lazy loading (rule set contents will be loaded only after a request).
 */
export default class RuleSetsLoaderApi {
    /**
     * Path to rule sets directory.
     */
    private ruleSetsPath: string;

    /**
     * Creates new {@link RuleSetsLoaderApi}.
     *
     * @param ruleSetsPath Path to rule sets directory.
     */
    constructor(ruleSetsPath: string) {
        this.ruleSetsPath = ruleSetsPath;
    }

    /**
     * Creates a new {@link IRuleSet} from the provided ID and list of
     * {@link IFilter|filters} with lazy loading of this rule set contents.
     *
     * @param ruleSetId Rule set id.
     * @param filterList List of all available {@link IFilter|filters}.
     *
     * @returns New {@link IRuleSet}.
     */
    public async createRuleSet(
        ruleSetId: string,
        filterList: IFilter[],
    ): Promise<IRuleSet> {
        const loadFileText = async (url: string): Promise<string> => {
            const file = await fetch(url);

            return file.text();
        };

        const rawData = await loadFileText(
            chrome.runtime.getURL(`${this.ruleSetsPath}/${ruleSetId}/${METADATA_FILENAME}`),
        );
        const loadLazyData = (): Promise<string> => loadFileText(
            chrome.runtime.getURL(`${this.ruleSetsPath}/${ruleSetId}/${LAZY_METADATA_FILENAME}`),
        );
        const loadDeclarativeRules = (): Promise<string> => loadFileText(
            chrome.runtime.getURL(`${this.ruleSetsPath}/${ruleSetId}/${ruleSetId}.json`),
        );

        const {
            data: {
                regexpRulesCount,
                rulesCount,
                ruleSetHashMapRaw,
                badFilterRulesRaw,
            },
            ruleSetContentProvider,
        } = await RuleSet.deserialize(
            ruleSetId,
            rawData,
            loadLazyData,
            loadDeclarativeRules,
            filterList,
        );

        const sources = RulesHashMap.deserializeSources(ruleSetHashMapRaw);
        const ruleSetHashMap = new RulesHashMap(sources);
        // We don't need filter id and line index because this
        // indexedRulesWithHash will be used only for matching $badfilter rules.
        const badFilterRules = badFilterRulesRaw
            .map((rawString) => IndexedNetworkRuleWithHash.createFromRawString(0, 0, rawString))
            .flat();

        return new RuleSet(
            ruleSetId,
            rulesCount,
            regexpRulesCount,
            ruleSetContentProvider,
            badFilterRules,
            ruleSetHashMap,
        );
    }
}
