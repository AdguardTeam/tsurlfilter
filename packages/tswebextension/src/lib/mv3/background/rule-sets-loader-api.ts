import { RuleParser } from '@adguard/agtree';
import {
    type IFilter,
    type IRuleSet,
    RuleSet,
    METADATA_FILENAME,
    LAZY_METADATA_FILENAME,
    IndexedNetworkRuleWithHash,
    RulesHashMap,
} from '@adguard/tsurlfilter/es/declarative-converter';
import browser from 'webextension-polyfill';

/**
 * RuleSetsLoaderApi can create {@link IRuleSet} from the provided rule set ID
 * with lazy loading (rule set contents will be loaded only after a request).
 */
export default class RuleSetsLoaderApi {
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
     * Creates new {@link RuleSetsLoaderApi}.
     *
     * @param ruleSetsPath Path to rule sets directory.
     */
    constructor(ruleSetsPath: string) {
        this.ruleSetsPath = ruleSetsPath;

        if (RuleSetsLoaderApi.ruleSetsCachePath !== ruleSetsPath) {
            RuleSetsLoaderApi.ruleSetsCachePath = ruleSetsPath;
            RuleSetsLoaderApi.ruleSetsCache = new Map();
        }
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
     */
    public async createRuleSet(
        ruleSetId: string,
        filterList: IFilter[],
    ): Promise<IRuleSet> {
        const ruleSetCache = RuleSetsLoaderApi.ruleSetsCache.get(ruleSetId);
        if (ruleSetCache) {
            return ruleSetCache;
        }

        const loadFileText = async (url: string): Promise<string> => {
            const file = await fetch(url);

            return file.text();
        };

        const rawData = await loadFileText(
            browser.runtime.getURL(`${this.ruleSetsPath}/${ruleSetId}/${METADATA_FILENAME}`),
        );
        const loadLazyData = (): Promise<string> => loadFileText(
            browser.runtime.getURL(`${this.ruleSetsPath}/${ruleSetId}/${LAZY_METADATA_FILENAME}`),
        );
        const loadDeclarativeRules = (): Promise<string> => loadFileText(
            browser.runtime.getURL(`${this.ruleSetsPath}/${ruleSetId}/${ruleSetId}.json`),
        );

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
