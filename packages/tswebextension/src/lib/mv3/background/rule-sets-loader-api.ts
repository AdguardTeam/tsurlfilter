import { RuleParser } from '@adguard/agtree';
import {
    type IFilter,
    type IRuleSet,
    RuleSet,
    IndexedNetworkRuleWithHash,
    RulesHashMap,
    extractMetadataContent,
    DeclarativeRuleValidator,
    SourceMap,
} from '@adguard/tsurlfilter/es/declarative-converter';
import browser from 'webextension-polyfill';

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

        const ruleSetPath = `${this.ruleSetsPath}/${ruleSetId}/${ruleSetId}.json`;

        const loadDeclarativeRules = (): Promise<string> => loadFileText(
            browser.runtime.getURL(ruleSetPath),
        );

        const metadataContent = await extractMetadataContent(ruleSetPath);

        const {
            regexpRulesCount,
            rulesCount,
            ruleSetHashMapRaw,
            badFilterRulesRaw,
        } = metadataContent.metadata;

        const ruleSetContentProvider = {
            // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
            loadSourceMap: async () => {
                const { sourceMapRaw } = metadataContent.lazyMetadata;
                const sources = SourceMap.deserializeSources(sourceMapRaw);

                return new SourceMap(sources);
            },
            // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
            loadFilterList: async () => {
                const { filterIds } = metadataContent.lazyMetadata;

                return filterList.filter((filter) => filterIds.includes(filter.getId()));
            },
            // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
            loadDeclarativeRules: async () => {
                const rawFileContent = await loadDeclarativeRules();

                const objectFromString = JSON.parse(rawFileContent);

                const declarativeRules = DeclarativeRuleValidator
                    .array()
                    .parse(objectFromString);

                return declarativeRules;
            },
        };

        const sources = RulesHashMap.deserializeSources(ruleSetHashMapRaw);
        const ruleSetHashMap = new RulesHashMap(sources);
        // We don't need filter id and line index because this
        // indexedRulesWithHash will be used only for matching $badfilter rules.
        const badFilterRules = badFilterRulesRaw
            .map((rawString) => IndexedNetworkRuleWithHash.createFromNode(0, 0, RuleParser.parse(rawString)))
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
