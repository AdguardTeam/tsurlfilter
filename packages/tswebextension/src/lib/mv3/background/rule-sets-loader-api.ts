import { RuleParser } from '@adguard/agtree';
import { type ByteRange, fetchExtensionResourceText } from '@adguard/tsurlfilter';
import {
    type IFilter,
    type IRuleSet,
    RuleSet,
    IndexedNetworkRuleWithHash,
    RulesHashMap,
    type ByteRangeMapCollection,
    BYTE_RANGE_MAP_RULE_SET_ID,
    fetchAndDeserializeByteRangeMaps,
    RULESET_NAME_PREFIX,
    RuleSetByteRangeCategory,
} from '@adguard/tsurlfilter/es/declarative-converter';
import browser from 'webextension-polyfill';

const JSON_ELEMENT_SEPARATOR = ',';
const JSON_ARRAY_OPENING_BRACKET = '[';

/**
 * RuleSetsLoaderApi can create {@link IRuleSet} from the provided rule set ID
 * with lazy loading (rule set contents will be loaded only after a request).
 */
export class RuleSetsLoaderApi {
    /**
     * Path to rule sets directory.
     */
    private ruleSetsPath: string;

    /**
     * Flag that indicates whether the rule sets loader is initialized.
     */
    private isInitialized: boolean;

    /**
     * Byte range maps collection.
     * This collection is used to fetch certain parts of the rule set files instead of the whole files
     * and makes possible to use less memory.
     */
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
     * @param ruleSetId Rule set id. Should be prefixed with {@link RULESET_NAME_PREFIX}.
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
        if (this.isInitialized) {
            return;
        }

        const byteRangeMapsRulesetBaseName = `${RULESET_NAME_PREFIX}${BYTE_RANGE_MAP_RULE_SET_ID}`;

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
     * @param category Byte range category, see {@link RuleSetByteRangeCategory}.
     *
     * @returns Byte range for the specified rule set and category.
     *
     * @throws Error if the byte range map for the specified rule set is not found
     * or the byte range for the specified category is not found.
     */
    private getByteRange(rulesetId: string, category: RuleSetByteRangeCategory): ByteRange {
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
        if (!this.isInitialized) {
            await this.initialize();
        }

        const ruleSetPath = this.getRuleSetPath(ruleSetId);

        const fullRange = this.getByteRange(ruleSetId, RuleSetByteRangeCategory.Full);
        const metadataRange = this.getByteRange(ruleSetId, RuleSetByteRangeCategory.MetadataRule);

        const textAfterMetadata = await fetchExtensionResourceText(
            browser.runtime.getURL(ruleSetPath),
            {
                start: metadataRange.end + 1,
                end: fullRange.end,
            },
        );

        // We just skip the first element from an array, e.g.
        // `[metadata_rule, rule1, rule2, ..., ruleN]` -> `, rule1, rule2, ..., ruleN]`
        // but to make it a valid JSON we need to add the missing opening bracket and remove the comma
        if (textAfterMetadata.startsWith(JSON_ELEMENT_SEPARATOR)) {
            return `${JSON_ARRAY_OPENING_BRACKET}${textAfterMetadata.slice(JSON_ELEMENT_SEPARATOR.length)}`;
        }

        if (!textAfterMetadata.startsWith(JSON_ARRAY_OPENING_BRACKET)) {
            return `${JSON_ARRAY_OPENING_BRACKET}${textAfterMetadata}`;
        }

        return textAfterMetadata;
    }

    /**
     * Fetches the content of the specified category from the rule set file.
     * This method helps us to fetch only the necessary parts of the rule set files
     * instead of the whole files and makes possible to use less memory.
     *
     * @param rulesetId Rule set id.
     * @param category Byte range category, see {@link RuleSetByteRangeCategory}.
     *
     * @returns Promise resolved file content as a string.
     *
     * @throws Error if the byte range map for the specified rule set is not found
     * or the byte range for the specified category is not found.
     */
    public async getRawCategoryContent(rulesetId: string, category: RuleSetByteRangeCategory): Promise<string> {
        if (!this.isInitialized) {
            await this.initialize();
        }

        const ruleSetPath = this.getRuleSetPath(rulesetId);
        const range = this.getByteRange(rulesetId, category);

        return fetchExtensionResourceText(browser.runtime.getURL(ruleSetPath), range);
    }

    /**
     * Creates a new {@link IRuleSet} from the provided ID and list of
     * {@link IFilter|filters} with lazy loading of this rule set contents.
     *
     * @param ruleSetId Rule set id.
     * @param filterList List of all available {@link IFilter|filters}.
     *
     * @returns New {@link IRuleSet}.
     *
     * @throws If {@link RuleSetsLoaderApi.initialize} was not called before and it fails.
     */
    public async createRuleSet(
        ruleSetId: string,
        filterList: IFilter[],
    ): Promise<IRuleSet> {
        if (!this.isInitialized) {
            await this.initialize();
        }

        const rawData = await this.getRawCategoryContent(ruleSetId, RuleSetByteRangeCategory.DeclarativeMetadata);

        const loadLazyData = async (): Promise<string> => this.getRawCategoryContent(
            ruleSetId,
            RuleSetByteRangeCategory.DeclarativeLazyMetadata,
        );

        const loadDeclarativeRules = (): Promise<string> => this.getDeclarativeRulesWithoutMetadataRule(ruleSetId);

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
    }
}
