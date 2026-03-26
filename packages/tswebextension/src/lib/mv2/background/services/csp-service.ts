import { getDomain } from 'tldts';
import { NetworkRuleOption, CSP_HEADER_NAME } from '@adguard/tsurlfilter';

import { FilteringEventType, type FilteringLogInterface } from '../../../common/filtering-log';
import { ContentType } from '../../../common/request-type';
import { nanoid } from '../../../common/utils/nanoid';
import { getRuleTexts, type RuleTextProvider } from '../../../common/utils/rule-text-provider';
import { RuleUtils } from '../utils/rule-utils';
import { type RequestContext, requestContextStorage } from '../request/request-context-storage';

/**
 * Content Security Policy Headers filtering service module.
 */
export class CspService {
    /**
     * Filtering log.
     */
    private filteringLog: FilteringLogInterface;

    /**
     * Engine API for retrieving rule texts.
     */
    private readonly engineApi: RuleTextProvider;

    /**
     * Constructor.
     *
     * @param filteringLog Filtering log.
     * @param ruleTextProvider Engine API for retrieving rule texts.
     */
    constructor(filteringLog: FilteringLogInterface, ruleTextProvider: RuleTextProvider) {
        this.filteringLog = filteringLog;
        this.engineApi = ruleTextProvider;
    }

    /**
     * Applies CSP rules to response headers and returns modified headers.
     * It is applied when webRequest.onHeadersReceived event is fired.
     *
     * @param context Request context.
     *
     * @returns True if headers were modified.
     */
    public onHeadersReceived(context: RequestContext): boolean {
        const {
            matchingResult,
            responseHeaders,
            requestId,
            tabId,
            requestUrl,
            referrerUrl,
        } = context;

        if (!matchingResult) {
            return false;
        }

        const cspHeaders = [];

        const cspRules = matchingResult.getCspRules();

        for (let i = 0; i < cspRules.length; i += 1) {
            const rule = cspRules[i];
            if (rule.isOptionEnabled(NetworkRuleOption.Header)) {
                const responseHeaderMatch = rule.matchResponseHeaders(responseHeaders);
                if (!responseHeaderMatch || rule.isAllowlist()) {
                    continue;
                }
            }

            // Don't forget: getCspRules returns all $csp rules, we must directly check that the rule is blocking.
            if (RuleUtils.isRequestBlockedByRule(rule)) {
                const cspHeaderValue = rule.getAdvancedModifierValue();

                if (cspHeaderValue) {
                    cspHeaders.push({
                        name: CSP_HEADER_NAME,
                        value: cspHeaderValue,
                    });
                }
            }

            const { appliedRuleText, originalRuleText } = getRuleTexts(rule, this.engineApi);

            this.filteringLog.publishEvent({
                type: FilteringEventType.ApplyCspRule,
                data: {
                    tabId,
                    eventId: nanoid(),
                    requestUrl,
                    frameUrl: referrerUrl,
                    frameDomain: getDomain(referrerUrl) as string,
                    requestType: ContentType.Csp,
                    filterId: rule.getFilterListId(),
                    ruleIndex: rule.getIndex(),
                    appliedRuleText,
                    originalRuleText,
                    timestamp: Date.now(),
                    isAllowlist: rule.isAllowlist(),
                    isImportant: rule.isOptionEnabled(NetworkRuleOption.Important),
                    isDocumentLevel: rule.isDocumentLevelAllowlistRule(),
                    isCsp: rule.isOptionEnabled(NetworkRuleOption.Csp),
                    isCookie: rule.isOptionEnabled(NetworkRuleOption.Cookie),
                    advancedModifier: rule.getAdvancedModifierValue(),
                },
            });
        }

        if (cspHeaders.length > 0) {
            requestContextStorage.update(requestId, {
                responseHeaders: responseHeaders ? [...responseHeaders, ...cspHeaders] : cspHeaders,
            });

            return true;
        }

        return false;
    }
}
