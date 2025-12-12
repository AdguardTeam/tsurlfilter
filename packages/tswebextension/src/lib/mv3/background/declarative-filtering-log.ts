import { type IRuleSet } from '@adguard/tsurlfilter/es/declarative-converter';

import { type DeclarativeRuleInfo, defaultFilteringLog, FilteringEventType } from '../../common/filtering-log';
import { logger } from '../../common/utils/logger';
import { Mutex } from '../utils/mutex';

import { requestContextStorage } from './request';
import { SessionRulesApi } from './session-rules-api';

/**
 * Declarative filtering log that can record information about the
 * applied declarative network rules with information about the original rule
 * text and the filter identifier.
 */
class DeclarativeFilteringLog {
    /**
     * Maximum wait time for rulesets to be loaded.
     */
    private MAX_WAIT_TIME_MS = 30 * 1000;

    /**
     * Stores list of rulesets to extract rule info when needed.
     */
    private sourceRulesets: IRuleSet[] = [];

    /**
     * Is there an active listener for declarativeNetRequest.onRuleMatchedDebug or not.
     */
    #isListening = false;

    /**
     * Mutex for managing concurrent access to rule set updates.
     */
    private readonly mutex: Mutex = new Mutex();

    /**
     * Returns is there an active listener for declarativeNetRequest.onRuleMatchedDebug or not.
     *
     * @returns Boolean value.
     */
    public get isListening(): boolean {
        return this.#isListening;
    }

    /**
     * Initializes the declarative filtering log.
     * Binds needed methods to the instance.
     */
    constructor() {
        this.logMatchedRule = this.logMatchedRule.bind(this);
    }

    /**
     * Acquires the mutex lock within the specified timeout.
     * Used to prevent getting rule info during rule set updates.
     *
     * @param timeoutMs The maximum time to wait (in milliseconds) to acquire the lock.
     * Defaults to {@link DeclarativeFilteringLog.MAX_WAIT_TIME_MS}.
     *
     * @throws {TimeoutError} If the lock is not acquired within the specified time.
     */
    public async startUpdate(timeoutMs = this.MAX_WAIT_TIME_MS): Promise<void> {
        await this.mutex.lock(timeoutMs);
    }

    /**
     * Releases the mutex and sets the new rule sets.
     * Used to prevent getting rule info during rule set updates.
     * Also, you can specify whether to enable declarative logging after update.
     *
     * @param ruleSets List of {@link IRuleSet}.
     * @param enableLog Should we enable declarative logging after update.
     *
     * @throws Error if no update is in progress.
     */
    public finishUpdate(ruleSets: IRuleSet[], enableLog: boolean): void {
        this.sourceRulesets = ruleSets;
        this.mutex.unlock();

        if (enableLog) {
            this.start();
        } else {
            this.stop();
        }
    }

    /**
     * Returns converted declarative json rule, original text rule,
     * filter name and id specifically for session rules, since they are
     * collected from static rulesets.
     *
     * @param rulesetId Ruleset id.
     * @param ruleId Rule id in this filter.
     *
     * @returns Converted declarative json rule, original txt rule
     * and filter id.
     *
     * @throws Error when couldn't find ruleset or rule in ruleset.
     */
    private getRuleInfoForSessionRule = async (
        rulesetId: string,
        ruleId: number,
    ): Promise<DeclarativeRuleInfo> => {
        if (this.mutex.isLocked()) {
            await this.mutex.waitUntilUnlocked();
        }

        if (rulesetId !== chrome.declarativeNetRequest.SESSION_RULESET_ID) {
            throw new Error('getRuleInfoForSessionRule can be used only for session rules');
        }

        if (this.sourceRulesets.length === 0) {
            throw new Error('No rulesets loaded yet');
        }

        const source = SessionRulesApi.sourceMapForUnsafeRules.get(ruleId);
        if (!source) {
            throw new Error(`Cannot find source mapping for session rule id ${ruleId}`);
        }

        const [sourceRuleSetId, sourceDnrRuleId] = source;

        const ruleSet = this.sourceRulesets.find((r) => r.getId() === sourceRuleSetId);
        if (!ruleSet) {
            throw new Error(`Cannot find ruleset with id ${sourceRuleSetId}`);
        }

        const sourceRules = await ruleSet.getRulesById(sourceDnrRuleId);
        const unsafeDeclarativeRules = await ruleSet.getUnsafeRules();
        const declarativeRule = unsafeDeclarativeRules.find((r) => r.id === sourceDnrRuleId);

        if (!declarativeRule) {
            throw new Error(`Cannot find rule with id ${sourceDnrRuleId} in ruleset ${sourceRuleSetId}`);
        }

        return {
            sourceRules,
            declarativeRuleJson: JSON.stringify(declarativeRule),
        };
    };

    /**
     * Returns converted declarative json rule, original text rule,
     * filter name and id.
     *
     * @param rulesetId Ruleset id.
     * @param ruleId Rule id in this filter.
     *
     * @returns Converted declarative json rule, original txt rule
     * and filter id.
     *
     * @throws Error when couldn't find ruleset or rule in ruleset.
     */
    private getRuleInfo = async (
        rulesetId: string,
        ruleId: number,
    ): Promise<DeclarativeRuleInfo> => {
        if (this.mutex.isLocked()) {
            await this.mutex.waitUntilUnlocked();
        }

        if (this.sourceRulesets.length === 0) {
            throw new Error('No rulesets loaded yet');
        }

        const ruleset = this.sourceRulesets.find((r) => r.getId() === rulesetId);
        if (!ruleset) {
            throw new Error(`Cannot find ruleset with id ${rulesetId}`);
        }

        const sourceRules = await ruleset.getRulesById(ruleId);
        const declarativeRules = await ruleset.getDeclarativeRules();
        const declarativeRule = declarativeRules.find((r) => r.id === ruleId);

        if (!declarativeRule) {
            throw new Error(`Cannot find rule with id ${ruleId} in ruleset ${rulesetId}`);
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
    private async logMatchedRule(record: chrome.declarativeNetRequest.MatchedRuleInfoDebug): Promise<void> {
        const {
            request: { requestId },
            rule: { rulesetId, ruleId },
        } = record;

        const context = requestContextStorage.get(requestId);

        if (!context) {
            logger.error('[tsweb.DeclarativeFilteringLog.logMatchedRule]: cannot find request context for request id ', requestId);
            return;
        }

        /**
         * We do not log exact matched DNR rule from Tracking protection
         * (formerly stealth mode), since they are generic and too wide, so
         * they should not be logged to prevent collect garbage in the log as
         * it is done in MV2.
         * But we still need to log all other session rules, since we use them
         * for all not safe rules from static rulesets.
         */
        if (rulesetId === chrome.declarativeNetRequest.SESSION_RULESET_ID
            && ruleId <= SessionRulesApi.MIN_DECLARATIVE_RULE_ID) {
            return;
        }

        let declarativeRuleInfo: DeclarativeRuleInfo;

        const getRuleInfoFn = rulesetId === chrome.declarativeNetRequest.SESSION_RULESET_ID
            ? this.getRuleInfoForSessionRule
            : this.getRuleInfo;

        try {
            declarativeRuleInfo = await getRuleInfoFn(rulesetId, ruleId);
        } catch (e) {
            logger.error('[tsweb.DeclarativeFilteringLog.logMatchedRule]: cannot get rule info due to: ', e);
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
    }

    /**
     * Toggles the listener for declarativeNetRequest.onRuleMatchedDebug.
     *
     * @param needToAddListener If true, the listener will be added, otherwise removed.
     */
    private toggleListener(needToAddListener: boolean): void {
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

            logger.error(`[tsweb.DeclarativeFilteringLog.toggleListener]: ${message}: `, e);
        }
    }

    /**
     * Starts recording.
     */
    public start(): void {
        this.toggleListener(true);
    }

    /**
     * Stops recording.
     */
    public stop(): void {
        this.toggleListener(false);
    }
}

export const declarativeFilteringLog = new DeclarativeFilteringLog();
