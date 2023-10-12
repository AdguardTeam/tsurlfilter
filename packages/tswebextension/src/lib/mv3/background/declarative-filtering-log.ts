import { IRuleSet, SourceRuleAndFilterId } from '@adguard/tsurlfilter/es/declarative-converter';

/**
 * Information about applied declarative network rule.
 */
export type RecordFiltered = {
    ruleId: number,
    rulesetId: string,
    frameId: number,
    initiator: string | undefined,
    method: string,
    requestId: string,
    tabId: number,
    type: string,
    url: string,
} & RuleInfo;

/**
 * Advanced information about declarative network rule with source rule list and
 * JSON version of declarative network rule.
 */
type RuleInfo = {
    sourceRules: SourceRuleAndFilterId[]
    declarativeRuleJson?: string
};

/**
 * Describes a declarative filtering log that can record information about the
 * applied declarative network rules with information about the original rule
 * text and the filter identifier.
 */
interface IDeclarativeFilteringLog {
    /**
     * Returns collected records about affected network requests
     * with information about applied declarative rules.
     */
    getCollected(): RecordFiltered[];

    /**
     * Starts record matched requests.
     */
    start(): void;

    /**
     * Stops record matched requests.
     */
    stop(): void;
}

/**
 * Described in @see {@link IDeclarativeFilteringLog}.
 */
class DeclarativeFilteringLog implements IDeclarativeFilteringLog {
    /**
     * Stores records with applied rules.
     */
    private collected: RecordFiltered[] = [];

    /**
     * Stores list of rule sets.
     */
    ruleSets: IRuleSet[] = [];

    /**
     * Is there an active listener for declarativeNetRequest.onRuleMatchedDebug or not.
     */
    private isListening = false;

    /**
     * Returns converted declarative json rule, original text rule,
     * filter name and id.
     *
     * @param ruleSetId Rule set id.
     * @param ruleId Rule id in this filter.
     *
     * @throws Error when couldn't find ruleset with provided id.
     *
     * @returns Converted declarative json rule, original txt rule
     * and filter id.
     */
    private getRuleInfo = async (ruleSetId: string, ruleId: number): Promise<RuleInfo> => {
        const ruleSet = this.ruleSets.find((r) => r.getId() === ruleSetId);
        if (!ruleSet) {
            throw new Error(`Cannot find ruleset with id ${ruleSet}`);
        }

        const sourceRules = await ruleSet.getRulesById(ruleId);
        const declarativeRules = await ruleSet.getDeclarativeRules();
        const declarativeRule = declarativeRules.find((r) => r.id === ruleId);
        const declarativeRuleJson = declarativeRule && JSON.stringify(declarativeRule);

        return {
            sourceRules,
            declarativeRuleJson,
        };
    };

    /**
     * Adds a new record extending it with information about the original rule.
     *
     * @param record Request details {@link chrome.declarativeNetRequest.MatchedRuleInfoDebug}.
     */
    private addNewRecord = async (record: chrome.declarativeNetRequest.MatchedRuleInfoDebug): Promise<void> => {
        const { request, rule } = record;
        const { rulesetId, ruleId } = rule;
        const {
            frameId,
            initiator,
            method,
            requestId,
            tabId,
            type,
            url,
        } = request;

        const {
            sourceRules,
            declarativeRuleJson,
        } = await this.getRuleInfo(rulesetId, ruleId);

        this.collected.push({
            ruleId,
            rulesetId,
            frameId,
            initiator,
            method,
            requestId,
            tabId,
            type,
            url,
            sourceRules,
            declarativeRuleJson,
        });
    };

    /**
     * Starts recording.
     */
    public start = (): void => {
        // onRuleMatchedDebug can be null if the extension is running
        // as a packed version
        if (chrome.declarativeNetRequest.onRuleMatchedDebug && !this.isListening) {
            const { onRuleMatchedDebug } = chrome.declarativeNetRequest;
            onRuleMatchedDebug.addListener(this.addNewRecord);

            this.isListening = true;
        }
    };

    /**
     * Stops recording.
     */
    public stop = (): void => {
        this.collected = [];

        // onRuleMatchedDebug can be null if the extension is running
        // as a packed version
        if (chrome.declarativeNetRequest.onRuleMatchedDebug) {
            const { onRuleMatchedDebug } = chrome.declarativeNetRequest;
            onRuleMatchedDebug.removeListener(this.addNewRecord);

            this.isListening = false;
        }
    };

    /**
     * TODO: If open more than one devtools - only first will receive updates
     * Returns current collected log and cleans it.
     *
     * @returns List of {@link RecordFiltered}.
     */
    public getCollected = (): RecordFiltered[] => {
        // Deep copy
        const collected = JSON.parse(JSON.stringify(this.collected)) as RecordFiltered[];

        // Clean current log
        this.collected = [];

        // To display newer requests on the top
        return collected.reverse();
    };
}

export const declarativeFilteringLog = new DeclarativeFilteringLog();
