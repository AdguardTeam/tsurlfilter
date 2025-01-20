import { RuleParser } from '@adguard/agtree';
import { fetchExtensionResourceText } from '@adguard/tsurlfilter';
import {
    type IFilter,
    type IRuleSet,
    RuleSet,
    IndexedNetworkRuleWithHash,
    RulesHashMap,
    RuleSetByteRangeCategory,
    MetadataRuleSet,
    METADATA_RULESET_ID,
} from '@adguard/tsurlfilter/es/declarative-converter';
import { getRuleSetId, getRuleSetPath } from '@adguard/tsurlfilter/es/declarative-converter-utils';
import browser from 'webextension-polyfill';

import { logger } from '../../common/utils/logger';
import { getErrorMessage } from '../../common/error';

const JSON_ARRAY_OPENING_BRACKET = '[';
const JSON_ARRAY_CLOSING_BRACKET = ']';

/**
 * RuleSetsLoaderApi is responsible for creating {@link IRuleSet} instances from provided rule set IDs and paths.
 * It supports lazy loading, meaning the rule set contents are loaded only upon request.
 *
 * This class also manages a cache of metadata rule sets to optimize performance and reduce redundant fetches.
 *
 * The main functionalities include:
 * - Initializing the rule sets loader to prepare it for fetching rule sets.
 * - Fetching checksums of rule sets.
 * - Fetching specific byte ranges of rule sets to minimize memory usage.
 * - Creating new {@link IRuleSet} instances with lazy loading capabilities.
 *
 * @example
 * ```typescript
 * const loader = new RuleSetsLoaderApi('/path/to/rulesets');
 * await loader.initialize();
 * const ruleSet = await loader.createRuleSet('123', filters);
 * ```
 */
export class RuleSetsLoaderApi {
    /**
     * Cache of metadata rule sets.
     */
    private static metadataRulesetsCache: Record<string, MetadataRuleSet> = {};

    /**
     * Cache for already created rulesets. Needed to avoid multiple loading
     * of the same ruleset.
     */
    private static ruleSetsCache: Map<string, IRuleSet>;

    /**
     * Path to rule sets cache directory to invalidate it when path changes.
     */
    private static ruleSetsCachePath: string;

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
     * Creates new {@link RuleSetsLoaderApi}.
     *
     * @param ruleSetsPath Path to rule sets directory.
     */
    constructor(ruleSetsPath: string) {
        this.ruleSetsPath = ruleSetsPath;
        this.isInitialized = false;

        if (RuleSetsLoaderApi.ruleSetsCachePath !== ruleSetsPath) {
            RuleSetsLoaderApi.ruleSetsCachePath = ruleSetsPath;
            RuleSetsLoaderApi.ruleSetsCache = new Map();
        }
    }

    /**
     * Gets the checksums of the rule sets.
     *
     * @param ruleSetId Rule set id.
     *
     * @returns Checksums of the rule sets.
     *
     * @throws If the rule sets loader is not initialized or the checksum for the specified rule set is not found.
     */
    public async getChecksum(ruleSetId: string | number): Promise<string | undefined> {
        if (!this.isInitialized) {
            await this.initialize();
        }

        const ruleSetIdWithPrefix = getRuleSetId(ruleSetId);

        return RuleSetsLoaderApi.metadataRulesetsCache[this.ruleSetsPath]?.getChecksum(ruleSetIdWithPrefix);
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
            try {
                if (!RuleSetsLoaderApi.metadataRulesetsCache[this.ruleSetsPath]) {
                    const metadataRulesetPath = getRuleSetPath(METADATA_RULESET_ID, this.ruleSetsPath);
                    const rawMetadataRuleset = await fetchExtensionResourceText(
                        browser.runtime.getURL(metadataRulesetPath),
                    );
                    // eslint-disable-next-line max-len
                    RuleSetsLoaderApi.metadataRulesetsCache[this.ruleSetsPath] = MetadataRuleSet.deserialize(rawMetadataRuleset);
                }

                this.isInitialized = true;
                this.initializerPromise = undefined;
            } catch (error) {
                logger.error('Failed to initialize RuleSetsLoaderApi. Got error:', getErrorMessage(error));
                throw error;
            }
        };

        this.initializerPromise = initialize();

        await this.initializerPromise;
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

        const ruleSetPath = getRuleSetPath(ruleSetId, this.ruleSetsPath);

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

        const metadataRuleset = RuleSetsLoaderApi.metadataRulesetsCache[this.ruleSetsPath];
        const metadataRange = metadataRuleset.getByteRange(ruleSetId, RuleSetByteRangeCategory.MetadataRule);
        const fullRange = metadataRuleset.getByteRange(ruleSetId, RuleSetByteRangeCategory.Full);

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

        const ruleSetPath = getRuleSetPath(rulesetId, this.ruleSetsPath);
        const metadataRuleset = RuleSetsLoaderApi.metadataRulesetsCache[this.ruleSetsPath];
        const range = metadataRuleset.getByteRange(rulesetId, category);

        return fetchExtensionResourceText(browser.runtime.getURL(ruleSetPath), range);
    }

    /**
     * If the rule set with the provided ID is already loaded, it will
     * be returned from the cache. Otherwise, it will create a new {@link IRuleSet}
     * from the provided ID and list of {@link IFilter|filters} with lazy
     * loading of this rule set contents.
     *
     * @param ruleSetId Rule set id.
     * @param filterList List of all available {@link IFilter|filters}.
     *
     * @returns New {@link IRuleSet}.
     *
     * @throws If initialization fails or the rule set with the provided ID is not found.
     */
    public async createRuleSet(
        ruleSetId: string,
        filterList: IFilter[],
    ): Promise<IRuleSet> {
        const ruleSetCache = RuleSetsLoaderApi.ruleSetsCache.get(ruleSetId);
        if (ruleSetCache) {
            return ruleSetCache;
        }

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
                unsafeRulesCount,
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

        const ruleset = new RuleSet(
            ruleSetId,
            rulesCount,
            // it is ok to set 0 since this method is used for static rulesets where unsafe rules are not used
            unsafeRulesCount || 0,
            regexpRulesCount,
            ruleSetContentProvider,
            badFilterRules,
            ruleSetHashMap,
        );

        RuleSetsLoaderApi.ruleSetsCache.set(ruleSetId, ruleset);

        return ruleset;
    }
}
