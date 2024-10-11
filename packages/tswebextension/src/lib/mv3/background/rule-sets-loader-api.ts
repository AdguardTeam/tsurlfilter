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

const JSON_ARRAY_OPENING_BRACKET = '[';
const JSON_ARRAY_CLOSING_BRACKET = ']';

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
     * Indicates whether the rule sets loader is initialized.
     */
    private isInitialized: boolean;

    /**
     * Promise that resolves when the initialization is complete.
     * This helps prevent multiple fetches by ensuring {@link RuleSetsLoaderApi.initialize}
     * is only called once, even if invoked multiple times in quick succession.
     */
    private initializerPromise: Promise<void> | undefined;

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
     * @param ruleSetId Rule set id. Can be a number or a string.
     *
     * @returns Path to the rule set file.
     *
     * @note This is just a path, not a URL. To get a URL, use {@link browser.runtime.getURL}.
     * @note Rule set ID automatically gets a {@link RULESET_NAME_PREFIX} prefix if it doesn't have it,
     * e.g. `123` -> `ruleset_123` or `foo` -> `ruleset_foo`.
     */
    private getRuleSetPath(ruleSetId: string | number): string {
        let ruleSetIdStr = String(ruleSetId);

        if (!ruleSetIdStr.startsWith(RULESET_NAME_PREFIX)) {
            ruleSetIdStr = `${RULESET_NAME_PREFIX}${ruleSetIdStr}`;
        }

        return `${this.ruleSetsPath}/${ruleSetIdStr}/${ruleSetIdStr}.json`;
    }

    /**
     * Initializes the rule sets loader.
     * It is needed to be called before any other method, because it loads byte range maps collection,
     * which is used to fetch certain parts of the rule set files instead of the whole files
     * and makes possible to use less memory.
     *
     * @throws Error if the byte range maps collection file is not found or its content is invalid.
     */
    private async initialize(): Promise<void> {
        if (this.isInitialized) {
            return;
        }

        if (this.initializerPromise) {
            await this.initializerPromise;
            return;
        }

        const initialize = async (): Promise<void> => {
            const byteRangeMapsRulesetBaseName = `${RULESET_NAME_PREFIX}${BYTE_RANGE_MAP_RULE_SET_ID}`;

            this.byteRangeMapsCollection = await fetchAndDeserializeByteRangeMaps(
                browser.runtime.getURL(
                    this.getRuleSetPath(byteRangeMapsRulesetBaseName),
                ),
            );

            this.isInitialized = true;
        };

        this.initializerPromise = initialize().then(() => {
            this.initializerPromise = undefined;
        });

        await this.initializerPromise;
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
     *
     * @throws Error if the metadata rule is not found in the rule set file.
     */
    private async getDeclarativeRulesWithoutMetadataRule(ruleSetId: string): Promise<string> {
        if (!this.isInitialized) {
            await this.initialize();
        }

        const ruleSetPath = this.getRuleSetPath(ruleSetId);

        // The ruleset file contains rules stored in a JSON array with the following structure:
        // `[{ metadata_rule }, { rule1 }, { rule2 }, ..., { ruleN }]`
        // The first element is always the metadata rule, which provides information about the ruleset.
        // Our goal is to exclude this metadata rule and fetch only the actual rules,
        // because metadata can be very large (even several MBs) and it is not a real rule, so we don't need it here.

        // First, we get the byte range of the metadata rule:
        // `[{ metadata_rule }, { rule1 }, { rule2 }, ..., { ruleN }]`
        //   ^^^^^^^^^^^^^^^^^
        // This helps us locate the metadata rule's start and end positions in the file.

        // Next, we fetch the byte range of the entire JSON array:
        // `[{ metadata_rule }, { rule1 }, { rule2 }, ..., { ruleN }]`
        //  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
        // This provides the start and end positions of the entire ruleset.

        // Using these two ranges, we calculate the byte positions for the rules excluding the metadata:
        // `[{ metadata_rule }, { rule1 }, { rule2 }, ..., { ruleN }]`
        //                    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

        const metadataRange = this.getByteRange(ruleSetId, RuleSetByteRangeCategory.DeclarativeMetadata);
        const fullRange = this.getByteRange(ruleSetId, RuleSetByteRangeCategory.Full);

        // After the metadata rule, there may be a comma or a closing bracket.
        // During fetching, `metadataRange.end` points to the last character of the metadata rule:
        // `[{ metadata_rule }, { rule1 }, { rule2 }, ..., { ruleN }]`
        //                   ^
        //                   `metadataRange.end`

        // By adding just +1, we still include the comma:
        // `[{ metadata_rule }, { rule1 }, { rule2 }, ..., { ruleN }]`
        //                    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
        // Therefore, we add +2 to skip the comma too.
        // This may include some whitespace characters (as you can see on the example),
        // but they are ignored when parsing the JSON, so we don't need to worry about them.

        // Now, we fetch the rules excluding the metadata rule:
        const textAfterMetadata = await fetchExtensionResourceText(
            browser.runtime.getURL(ruleSetPath),
            {
                start: metadataRange.end + 2,
                end: fullRange.end,
            },
        );

        // Note: we do not need to trim the text because we do not include additional whitespace characters
        // after our rulesets.

        // Since we skipped the metadata rule, we also lost the opening bracket of the JSON array:
        // `[{ metadata_rule }, { rule1 }, { rule2 }, ..., { ruleN }]`
        //                     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

        // To make the JSON valid again, we need to prepend the opening bracket before the fetched rules:
        // `[ { rule1 }, { rule2 }, ..., { ruleN }]`
        //   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
        //         (we fetched this content)
        let rawJson = `${JSON_ARRAY_OPENING_BRACKET}${textAfterMetadata}`;

        // Edge case: If the ruleset contains only the metadata rule _and_ is minified, adding +2
        // skips the closing bracket, not the comma:
        // `[{ metadata_rule }]`
        //                    ^
        // This may never happens in practice, but we handle it just in case.
        if (!rawJson.endsWith(JSON_ARRAY_CLOSING_BRACKET)) {
            rawJson += JSON_ARRAY_CLOSING_BRACKET;
        }

        return rawJson;
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
