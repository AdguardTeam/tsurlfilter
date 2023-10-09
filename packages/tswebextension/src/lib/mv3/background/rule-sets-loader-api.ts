import {
    DeclarativeRule,
    IFilter,
    IRuleSet,
    RuleSet,
    IRuleSetContentProvider,
    ISourceMap,
    SourceMap,
    FILTER_LIST_IDS_FILENAME_JSON,
    REGEXP_RULES_COUNT_FILENAME,
    RULES_COUNT_FILENAME,
    SOURCE_MAP_FILENAME_JSON,
    DeclarativeRuleValidator,
} from '@adguard/tsurlfilter/es/declarative-converter';
import { z as zod } from 'zod';

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
     * Loads source map for provided rule set id.
     *
     * @param ruleSetId Rule set id.
     *
     * @returns An {@link ISourceMap} that contains the relationships between
     * the converted rules and the source rules (with filter identifiers).
     */
    private async loadSourceMap(ruleSetId: string): Promise<ISourceMap> {
        const url = chrome.runtime.getURL(`${this.ruleSetsPath}/${ruleSetId}/${SOURCE_MAP_FILENAME_JSON}`);
        const file = await fetch(url);
        const fileText = await file.text();
        const sources = SourceMap.deserializeSources(fileText);

        return new SourceMap(sources);
    }

    /**
     * Filters the provided list of source filters and leaves only those filters
     * that match the provided rule set identifier.
     *
     * @param ruleSetId Rule set id.
     * @param filterList List of source {@link IFilter|filters}.
     *
     * @throws Error when the IDs of the loaded filters associated with
     * the rule set are not numbers.
     *
     * @returns Filtered list of source {@link IFilter|filters} associated with
     * this set of rules.
     */
    private async adjustFilterList(ruleSetId: string, filterList: IFilter[]): Promise<IFilter[]> {
        const url = chrome.runtime.getURL(`${this.ruleSetsPath}/${ruleSetId}/${FILTER_LIST_IDS_FILENAME_JSON}`);
        const file = await fetch(url);
        const json = await file.json();
        const filterIds = zod.number().array().parse(json);

        return filterList.filter((filter) => filterIds.includes(filter.getId()));
    }

    /**
     * Loads declarative rules for provided rule set id.
     *
     * @param ruleSetId Rule set id.
     *
     * @throws Error if the loaded rules are not {@link DeclarativeRule}.
     *
     * @returns List with {@link DeclarativeRule} belonging to a specified
     * rule set.
     */
    private async loadDeclarativeRules(ruleSetId: string): Promise<DeclarativeRule[]> {
        const url = chrome.runtime.getURL(`${this.ruleSetsPath}/${ruleSetId}/${ruleSetId}.json`);
        const file = await fetch(url);
        const json = await file.json();
        const rules = DeclarativeRuleValidator.array().parse(json);

        return rules;
    }

    /**
     * Loads the number of declarative rules for provided rule set id.
     *
     * @param ruleSetId Rule set id.
     *
     * @returns Promise resolved with number of declarative rules.
     */
    private async loadRulesCounter(ruleSetId: string): Promise<number> {
        const url = chrome.runtime.getURL(`${this.ruleSetsPath}/${ruleSetId}/${RULES_COUNT_FILENAME}`);
        const file = await fetch(url);
        const fileText = await file.text();

        return Number.parseInt(fileText, 10);
    }

    /**
     * Loads the number of regexp declarative rules for provided rule set id.
     *
     * @param ruleSetId Rule set id.
     *
     * @returns Promise resolved with number of regexp declarative rules.
     */
    private async loadRegexpRulesCounter(ruleSetId: string): Promise<number> {
        const url = chrome.runtime.getURL(`${this.ruleSetsPath}/${ruleSetId}/${REGEXP_RULES_COUNT_FILENAME}`);
        const file = await fetch(url);
        const fileText = await file.text();

        return Number.parseInt(fileText, 10);
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
        const ruleSetContent: IRuleSetContentProvider = {
            getSourceMap: () => this.loadSourceMap(ruleSetId),
            getFilterList: () => this.adjustFilterList(ruleSetId, filterList),
            getDeclarativeRules: () => this.loadDeclarativeRules(ruleSetId),
        };

        const rulesCount = await this.loadRulesCounter(ruleSetId);
        const regexpRulesCount = await this.loadRegexpRulesCounter(ruleSetId);

        return new RuleSet(ruleSetId, rulesCount, regexpRulesCount, ruleSetContent);
    }
}
