import { type IRuleSet } from '@adguard/tsurlfilter/es/declarative-converter';

import { type DeclarativeRuleInfo, defaultFilteringLog, FilteringEventType } from '../../common/filtering-log';
import { logger } from '../../common/utils/logger';

import { requestContextStorage } from './request';

/**
 * Declarative filtering log that can record information about the
 * applied declarative network rules with information about the original rule
 * text and the filter identifier.
 */
class DeclarativeFilteringLog {
    /**
     * Stores list of rule sets.
     */
    ruleSets: IRuleSet[] = [];

    /**
     * Is there an active listener for declarativeNetRequest.onRuleMatchedDebug or not.
     */
    #isListening = false;

    /**
     * Returns is there an active listener for declarativeNetRequest.onRuleMatchedDebug or not.
     *
     * @returns Boolean value.
     */
    public get isListening(): boolean {
        return this.#isListening;
    }

    /**
     * Returns converted declarative json rule, original text rule,
     * filter name and id.
     *
     * @param ruleSetId Rule set id.
     * @param ruleId Rule id in this filter.
     *
     * @returns Converted declarative json rule, original txt rule
     * and filter id.
     *
     * @throws Error when couldn't find ruleset or rule in ruleset.
     */
    private getRuleInfo = async (ruleSetId: string, ruleId: number): Promise<DeclarativeRuleInfo> => {
        const ruleSet = this.ruleSets.find((r) => r.getId() === ruleSetId);
        if (!ruleSet) {
            throw new Error(`Cannot find ruleset with id ${ruleSet}`);
        }

        const sourceRules = await ruleSet.getRulesById(ruleId);
        const declarativeRules = await ruleSet.getDeclarativeRules();
        const declarativeRule = declarativeRules.find((r) => r.id === ruleId);

        if (!declarativeRule) {
            throw new Error(`Cannot find rule with id ${ruleId} in ruleset ${ruleSet}`);
        }

        return {
            sourceRules,
            declarativeRuleJson: JSON.stringify(declarativeRule),
        };
    };

    /**
     * Fires an {@link FilteringEventType.MatchedDeclarativeRule} event with
     * matched declarative rule and source text rule.
     *
     * In current approach we will always load all rules from all rule sets in
     * unpacked extension to extract the rule info. This can be optimized and
     * log rule only if filtering log is opened.
     *
     * @param record Request details {@link browser.declarativeNetRequest.MatchedRuleInfoDebug}.
     */
    private logMatchedRule = async (record: chrome.declarativeNetRequest.MatchedRuleInfoDebug): Promise<void> => {
        const {
            request: { requestId },
            rule: { rulesetId, ruleId },
        } = record;

        const context = requestContextStorage.get(requestId);

        if (!context) {
            logger.debug('[logMatchedRule]: cannot find request context for request id', requestId);
            return;
        }

        let declarativeRuleInfo: DeclarativeRuleInfo;

        try {
            declarativeRuleInfo = await this.getRuleInfo(rulesetId, ruleId);
        } catch (e) {
            logger.debug(e);
            return;
        }

        defaultFilteringLog.publishEvent({
            type: FilteringEventType.MatchedDeclarativeRule,
            data: {
                eventId: context.eventId,
                tabId: context.tabId,
                declarativeRuleInfo,
            },
        });
    };

    /**
     * Toggles the listener for declarativeNetRequest.onRuleMatchedDebug.
     *
     * @param needToAddListener If true, the listener will be added, otherwise removed.
     */
    private toggleListener = (needToAddListener: boolean): void => {
        // Wrapped in try-catch to prevent the extension from crashing if browser
        // will change the API in the future.
        try {
            // onRuleMatchedDebug can be null if the extension is running
            // as a packed version
            if (!chrome.declarativeNetRequest.onRuleMatchedDebug) {
                return;
            }

            if (needToAddListener) {
                // Already listening
                if (this.#isListening) {
                    return;
                }

                chrome.declarativeNetRequest.onRuleMatchedDebug.addListener(this.logMatchedRule);
                this.#isListening = true;
            } else {
                chrome.declarativeNetRequest.onRuleMatchedDebug.removeListener(this.logMatchedRule);
                this.#isListening = false;
            }
        } catch (e) {
            const message = needToAddListener
                ? 'Cannot start recording declarative network rules due to: '
                : 'Cannot stop recording declarative network rules due to: ';

            logger.debug(message, e);
        }
    };

    /**
     * Starts recording.
     */
    public start = (): void => {
        this.toggleListener(true);
    };

    /**
     * Stops recording.
     */
    public stop = (): void => {
        this.toggleListener(false);
    };
}

export const declarativeFilteringLog = new DeclarativeFilteringLog();
