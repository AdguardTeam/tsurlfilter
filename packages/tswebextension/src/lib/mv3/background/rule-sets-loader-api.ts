import { RuleParser } from '@adguard/agtree';
import { fetchExtensionResourceText } from '@adguard/tsurlfilter';
import {
    type IFilter,
    type IRuleSet,
    RuleSet,
    IndexedNetworkRuleWithHash,
    RulesHashMap,
    type ByteRangeMapCollection,
    BYTE_RANGE_MAP_RULE_SET_ID,
    fetchAndDeserializeByteRangeMaps,
    type ByteRange,
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

    private isInitialized: boolean;

    private byteRangeMapsCollection: ByteRangeMapCollection;

    /**
     * Creates new {@link RuleSetsLoaderApi}.
     *
     * @param ruleSetsPath Path to rule sets directory.
     */
    constructor(ruleSetsPath: string) {
        this.ruleSetsPath = ruleSetsPath;
        this.isInitialized = false;
        this.byteRangeMapsCollection = {};
    }

    /**
     * Helper method to get the path to the rule set file.
     *
     * @param ruleSetId Rule set id.
     *
     * @returns Path to the rule set file.
     *
     * @note This is just a path, not a URL. To get a URL, use {@link browser.runtime.getURL}.
     */
    private getRuleSetPath(ruleSetId: string): string {
        return `${this.ruleSetsPath}/${ruleSetId}/${ruleSetId}.json`;
    }

    /**
     * Initializes the rule sets loader.
     * It is needed to be called before any other method, because it loads byte range maps collection,
     * which is used to fetch certain parts of the rule set files instead of the whole files
     * and makes possible to use less memory.
     *
     * @throws Error if the byte range maps collection file is not found or its content is invalid.
     */
    public async initialize(): Promise<void> {
        const byteRangeMapsRulesetBaseName = `ruleset_${BYTE_RANGE_MAP_RULE_SET_ID}`;

        this.byteRangeMapsCollection = await fetchAndDeserializeByteRangeMaps(
            browser.runtime.getURL(
                this.getRuleSetPath(byteRangeMapsRulesetBaseName),
            ),
        );

        this.isInitialized = true;
    }

    /**
     * Gets the byte range for the specified rule set and category.
     *
     * @param rulesetId Rule set id.
     * @param category Category name, can be:
     * - `full` to get the full byte range of the rule set file,
     * - `declarative_metadata`
     * - `declarative_lazy_metadata`
     * - `declarative_source_map`
     * - `preprocessed_filter_list_source_map`
     * - `preprocessed_filter_list_conversion_map`
     * - `preprocessed_filter_list_binary`
     * - `preprocessed_filter_list_raw`.
     *
     * @returns Byte range for the specified rule set and category.
     *
     * @throws Error if the byte range map for the specified rule set is not found
     * or the byte range for the specified category is not found.
     */
    private getByteRange(rulesetId: string, category: string): ByteRange {
        const byteRangeMap = this.byteRangeMapsCollection[rulesetId];

        if (!byteRangeMap) {
            throw new Error(`Byte range map for rule set ${rulesetId} not found`);
        }

        const range = byteRangeMap[category];

        if (!range) {
            throw new Error(`Byte range for category ${category} not found in rule set ${rulesetId}`);
        }

        return range;
    }

    /**
     * Fetches the declarative rules without metadata rule from the rule set file.
     *
     * @param ruleSetId Rule set id.
     *
     * @returns Raw JSON string with declarative rules.
     */
    private async getDeclarativeRulesWithoutMetadataRule(ruleSetId: string): Promise<string> {
        const ruleSetPath = this.getRuleSetPath(ruleSetId);

        const fullRange = this.getByteRange(ruleSetId, 'full');
        const metadataRange = this.getByteRange(ruleSetId, 'metadata');

        const textAfterMetadata = await fetchExtensionResourceText(
            browser.runtime.getURL(ruleSetPath),
            {
                start: metadataRange.end + 1,
                end: fullRange.end,
            },
        );

        // We actually use a JSON source map, so metadata rule followed by a comma
        if (textAfterMetadata.startsWith(',')) {
            // Fix JSON syntax by adding the missing opening bracket and removing the comma
            return `[${textAfterMetadata.slice(1)}`;
        }

        return textAfterMetadata;
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
        if (!this.isInitialized) {
            await this.initialize();
        }

        const ruleSetPath = this.getRuleSetPath(ruleSetId);

        const rawData = await fetchExtensionResourceText(
            browser.runtime.getURL(ruleSetPath),
            this.getByteRange(ruleSetId, 'declarative_metadata'),
        );

        const loadLazyData = (): Promise<string> => {
            const range = this.getByteRange(ruleSetId, 'declarative_lazy_metadata');
            return fetchExtensionResourceText(browser.runtime.getURL(ruleSetPath), range);
        };

        const loadDeclarativeRules = (): Promise<string> => this.getDeclarativeRulesWithoutMetadataRule(
            browser.runtime.getURL(ruleSetPath),
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

        // const metadataContent = await extractMetadataContent(ruleSetPath);

        // const {
        //     regexpRulesCount,
        //     rulesCount,
        //     ruleSetHashMapRaw,
        //     badFilterRulesRaw,
        // } = metadataContent.metadata;

        // const ruleSetContentProvider = {
        //     // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
        //     loadSourceMap: async () => {
        //         const { sourceMapRaw } = metadataContent.lazyMetadata;
        //         const sources = SourceMap.deserializeSources(sourceMapRaw);

        //         return new SourceMap(sources);
        //     },
        //     // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
        //     loadFilterList: async () => {
        //         const { filterIds } = metadataContent.lazyMetadata;

        //         return filterList.filter((filter) => filterIds.includes(filter.getId()));
        //     },
        //     // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
        //     loadDeclarativeRules: async () => {
        //         const rawFileContent = await loadDeclarativeRules();

        //         const objectFromString = JSON.parse(rawFileContent);

        //         const declarativeRules = DeclarativeRuleValidator
        //             .array()
        //             .parse(objectFromString);

        //         return declarativeRules;
        //     },
        // };

        // const sources = RulesHashMap.deserializeSources(ruleSetHashMapRaw);
        // const ruleSetHashMap = new RulesHashMap(sources);
        // // We don't need filter id and line index because this
        // // indexedRulesWithHash will be used only for matching $badfilter rules.
        // const badFilterRules = badFilterRulesRaw
        //     .map((rawString) => IndexedNetworkRuleWithHash.createFromNode(0, 0, RuleParser.parse(rawString)))
        //     .flat();

        // return new RuleSet(
        //     ruleSetId,
        //     rulesCount,
        //     regexpRulesCount,
        //     ruleSetContentProvider,
        //     badFilterRules,
        //     ruleSetHashMap,
        // );
    }
}
