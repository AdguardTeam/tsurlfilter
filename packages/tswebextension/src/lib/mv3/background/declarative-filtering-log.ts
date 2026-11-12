import { type DeclarativeRule, type IRulesetWithSourceMap } from '@adguard/dnr-converter';

import { type DeclarativeRuleInfo, defaultFilteringLog, FilteringEventType } from '../../common/filtering-log';
import { logger } from '../../common/utils/logger';
import { nanoid } from '../../common/utils/nanoid';
import { getDomain } from '../../common/utils/url';
import { Mutex } from '../utils/mutex';

import DynamicRulesApi from './dynamic-rules-api';
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
    private sourceRulesets: IRulesetWithSourceMap[] = [];

    /**
     * Is there an active listener for declarativeNetRequest.onRuleMatchedDebug or not.
     */
    #isListening = false;

    /**
     * Whether declarative logging was enabled by the last {@link finishUpdate}.
     *
     * Kept so that {@link restore} can bring the listener back to the previous
     * state, whichever rule sets ended up live after a failed update.
     */
    #isEnabled = false;

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
     * Sets the new rule sets and enables or disables declarative logging.
     *
     * The update lock is not released here: it stays held until the operation
     * passed to {@link withUpdateLock} finishes.
     *
     * @param rulesets List of {@link IRulesetWithSourceMap}.
     * @param enableLog Should we enable declarative logging after update.
     */
    public finishUpdate(rulesets: IRulesetWithSourceMap[], enableLog: boolean): void {
        this.sourceRulesets = rulesets;
        this.#isEnabled = enableLog;

        if (enableLog) {
            this.start();
        } else {
            this.stop();
        }
    }

    /**
     * Restores the listener state of the previous {@link finishUpdate}.
     *
     * An update stops the listener before the browser rules are replaced, so
     * a failure at any later step must bring it back: otherwise the log stays
     * silent until the next successful update, whichever rules ended up live.
     */
    #restore(): void {
        if (this.#isEnabled) {
            this.start();
        } else {
            this.stop();
        }
    }

    /**
     * Runs an operation with the listener stopped, restarting it when the
     * operation throws.
     *
     * `configure()` stops the listener before the browser rules are replaced,
     * so a failure at any later step must restart it instead of leaving the
     * log silent until the next successful update.
     *
     * @param operation Operation to run.
     *
     * @throws Whatever the operation throws.
     */
    public async withStoppedListener(operation: () => Promise<void>): Promise<void> {
        this.stop();

        try {
            await operation();
        } catch (error: unknown) {
            this.#restore();

            throw error;
        }
    }

    /**
     * Runs an operation while holding the update lock.
     *
     * The lock is released when the operation finishes, whether it succeeds or
     * throws, so it is released exactly once per acquisition and never while
     * another update is running. On success the operation calls
     * {@link finishUpdate}; a throw before that keeps the previous rule sets,
     * so a failed update cannot block the filtering log.
     *
     * @param operation Operation to run under the lock.
     *
     * @throws Whatever the operation throws.
     */
    public async withUpdateLock(operation: () => Promise<void>): Promise<void> {
        // Acquire the lock before touching the rule sets, so rule info is not
        // read while they are being replaced.
        await this.mutex.lock(this.MAX_WAIT_TIME_MS);

        try {
            await operation();
        } finally {
            this.mutex.unlock();
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

        const [sourceRulesetId, sourceDnrRuleId] = source;

        const ruleset = this.sourceRulesets.find((r) => r.getId() === sourceRulesetId);
        if (!ruleset) {
            throw new Error(`Cannot find ruleset with id ${sourceRulesetId}`);
        }

        const sourceRules = await ruleset.getRulesById(sourceDnrRuleId);
        // The rebuilt CSP ruleset keeps its rules in the full declarative list,
        // so the unsafe lookup is simply empty for it and the fallback below
        // finds the rule.
        const unsafeDeclarativeRules = await ruleset.getUnsafeRules();
        let declarativeRule: DeclarativeRule | undefined = unsafeDeclarativeRules
            .find((r) => r.id === sourceDnrRuleId);

        if (!declarativeRule) {
            const declarativeRules = await ruleset.getDeclarativeRules();
            declarativeRule = declarativeRules.find((r) => r.id === sourceDnrRuleId);
        }

        if (!declarativeRule) {
            throw new Error(`Cannot find rule with id ${sourceDnrRuleId} in ruleset ${sourceRulesetId}`);
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

        // A matched dynamic rule can be a rebuilt CSP rule applied under a new
        // runtime ID, so resolve it through the dynamic CSP source map first.
        const cspSource = rulesetId === chrome.declarativeNetRequest.DYNAMIC_RULESET_ID
            ? DynamicRulesApi.sourceMapForCspRules.get(ruleId)
            : undefined;
        const sourceRulesetId = cspSource?.[0] ?? rulesetId;
        const sourceRuleId = cspSource?.[1] ?? ruleId;
        const ruleset = this.sourceRulesets.find((r) => r.getId() === sourceRulesetId);
        if (!ruleset) {
            throw new Error(`Cannot find ruleset with id ${sourceRulesetId}`);
        }

        const sourceRules = await ruleset.getRulesById(sourceRuleId);
        const declarativeRules = await ruleset.getDeclarativeRules();
        const declarativeRule = declarativeRules.find((r) => r.id === sourceRuleId);

        if (!declarativeRule) {
            throw new Error(`Cannot find rule with id ${sourceRuleId} in ruleset ${sourceRulesetId}`);
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
            request: { requestId, url: requestUrl },
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

        // Determine the eventId to associate with this rule match.
        // If the matched URL differs from the stored context URL, Chrome
        // applied a DNR redirect without firing onBeforeRequest for this hop
        // (observed with $removeparam redirect chains). In that case we emit
        // a synthetic SendRequest so the filtering log gets a dedicated entry.
        let { eventId } = context;

        if (requestUrl !== context.requestUrl) {
            eventId = nanoid();

            defaultFilteringLog.publishEvent({
                type: FilteringEventType.SendRequest,
                data: {
                    tabId: context.tabId,
                    eventId,
                    requestUrl,
                    requestDomain: getDomain(requestUrl),
                    frameUrl: context.referrerUrl,
                    frameDomain: getDomain(context.referrerUrl),
                    requestType: context.contentType,
                    timestamp: context.timestamp,
                    requestThirdParty: context.thirdParty,
                    method: context.method,
                },
            });

            // Update the stored context so the next onRuleMatchedDebug for
            // the same requestId sees the current hop URL and eventId.
            requestContextStorage.update(requestId, {
                eventId,
                requestUrl,
            });
        }

        defaultFilteringLog.publishEvent({
            type: FilteringEventType.MatchedDeclarativeRule,
            data: {
                eventId,
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
