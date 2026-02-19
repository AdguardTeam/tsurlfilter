import { NetworkRuleOption, type NetworkRule, type RemoveParamModifier } from '@adguard/tsurlfilter';

import { requestContextStorage } from '../request/request-context-storage';
import { FilteringEventType, type FilteringLogInterface } from '../../../common/filtering-log';
import { nanoid } from '../../../common/utils/nanoid';
import { getDomain } from '../../../common/utils/url';
import { getRuleTexts, type RuleTextProvider } from '../../../common/utils/rule-text-provider';

/**
 * Params filtering service module.
 */
export class ParamsService {
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

    private static SupportedMethods = ['GET', 'POST', 'OPTIONS', 'HEAD'];

    /**
     * Removes request params from url, stored in request context.
     *
     * @param requestId Request id.
     *
     * @returns Modified url or null.
     */
    public getPurgedUrl(requestId: string): string | null {
        const context = requestContextStorage.get(requestId);

        if (!context) {
            return null;
        }

        const {
            matchingResult,
            method,
            requestUrl,
            contentType,
            timestamp,
        } = context;

        if (!matchingResult || !ParamsService.isMethodSupported(method)) {
            return null;
        }

        const removeParamRules = matchingResult.getRemoveParamRules();

        if (removeParamRules.length === 0) {
            return null;
        }

        const purgedUrl = removeParamRules.reduce((url: string, rule: NetworkRule): string => {
            if (rule.isAllowlist()) {
                const { appliedRuleText, originalRuleText } = getRuleTexts(rule, this.engineApi);

                this.filteringLog.publishEvent({
                    type: FilteringEventType.RemoveParam,
                    data: {
                        removeParam: true,
                        eventId: nanoid(),
                        tabId: context.tabId,
                        requestUrl: url,
                        frameUrl: url,
                        frameDomain: getDomain(url) as string,
                        requestType: contentType,
                        filterId: rule.getFilterListId(),
                        ruleIndex: rule.getIndex(),
                        appliedRuleText,
                        originalRuleText,
                        timestamp,
                        isAllowlist: rule.isAllowlist(),
                        isImportant: rule.isOptionEnabled(NetworkRuleOption.Important),
                        isDocumentLevel: rule.isDocumentLevelAllowlistRule(),
                        isCsp: rule.isOptionEnabled(NetworkRuleOption.Csp),
                        isCookie: rule.isOptionEnabled(NetworkRuleOption.Cookie),
                        advancedModifier: rule.getAdvancedModifierValue(),
                    },
                });
                return url;
            }

            const modifier = rule.getAdvancedModifier() as RemoveParamModifier;

            const modifiedUrl = modifier.removeParameters(url);
            const hasUrlChanged = modifiedUrl !== url;

            if (hasUrlChanged) {
                context.isRemoveparamRedirect = true;
                const { appliedRuleText, originalRuleText } = getRuleTexts(rule, this.engineApi);

                this.filteringLog.publishEvent({
                    type: FilteringEventType.RemoveParam,
                    data: {
                        removeParam: true,
                        eventId: nanoid(),
                        tabId: context.tabId,
                        requestUrl: modifiedUrl,
                        frameUrl: modifiedUrl,
                        frameDomain: getDomain(modifiedUrl) as string,
                        requestType: contentType,
                        filterId: rule.getFilterListId(),
                        ruleIndex: rule.getIndex(),
                        appliedRuleText,
                        originalRuleText,
                        timestamp,
                        isAllowlist: rule.isAllowlist(),
                        isImportant: rule.isOptionEnabled(NetworkRuleOption.Important),
                        isDocumentLevel: rule.isDocumentLevelAllowlistRule(),
                        isCsp: rule.isOptionEnabled(NetworkRuleOption.Csp),
                        isCookie: rule.isOptionEnabled(NetworkRuleOption.Cookie),
                        advancedModifier: rule.getAdvancedModifierValue(),
                    },
                });
            }

            return modifier.removeParameters(url);
        }, requestUrl);

        if (purgedUrl === requestUrl) {
            return null;
        }

        return purgedUrl;
    }

    /**
     * Checks if we support requests for specified method.
     *
     * @param method Request method.
     *
     * @returns True if method supported.
     */
    private static isMethodSupported(method: string): boolean {
        return ParamsService.SupportedMethods.includes(method.toUpperCase());
    }
}
