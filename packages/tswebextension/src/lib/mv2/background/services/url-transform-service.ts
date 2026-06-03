import { type NetworkRule, NetworkRuleOption, UrlTransformModifier } from '@adguard/tsurlfilter';

import { FilteringEventType, type FilteringLogInterface } from '../../../common/filtering-log';
import { type ContentType } from '../../../common/request-type';
import { logger } from '../../../common/utils/logger';
import { nanoid } from '../../../common/utils/nanoid';
import { getRuleTexts, type RuleTextProvider } from '../../../common/utils/rule-text-provider';
import { getDomain } from '../../../common/utils/url';
import { requestContextStorage } from '../request/request-context-storage';

/**
 * URL transform filtering service module.
 *
 * Applies $urltransform rules to request URLs by returning a transformed URL
 * that the browser will redirect to. Follows the same pattern as
 * {@link ParamsService} for $removeparam.
 */
export class UrlTransformService {
    /**
     * Filtering log for publishing URL transform events.
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
     * Applies $urltransform rules to the request URL stored in the request context.
     *
     * Multiple rules are sorted alphabetically by modifier value and applied
     * sequentially — each rule's output feeds into the next rule's input.
     *
     * @param requestId Request id.
     *
     * @returns Object with `url` (transformed URL or null if no change)
     *          and `isOriginChanged` (true if any full-URL mode rule changed the origin).
     */
    public getTransformedUrl(requestId: string): {
        url: string | null;
        isOriginChanged: boolean;
    } {
        const context = requestContextStorage.get(requestId);

        if (!context) {
            return { url: null, isOriginChanged: false };
        }

        const {
            matchingResult,
            requestUrl,
            contentType,
            timestamp,
        } = context;

        if (!matchingResult) {
            return { url: null, isOriginChanged: false };
        }

        const urlTransformRules = matchingResult.getUrlTransformRules();

        if (urlTransformRules.length === 0) {
            return { url: null, isOriginChanged: false };
        }

        let isOriginChanged = false;

        // Sort rules alphabetically by modifier value, matching CoreLibs behavior.
        const sortedRules = [...urlTransformRules].sort(
            (a, b): number => {
                const aValue = a.getAdvancedModifierValue() ?? '';
                const bValue = b.getAdvancedModifierValue() ?? '';
                return aValue.localeCompare(bValue);
            },
        );

        let currentUrl = requestUrl;

        for (const rule of sortedRules) {
            if (rule.isAllowlist()) {
                this.publishUrlTransformEvent(rule, currentUrl, contentType, context.tabId, timestamp);
                continue;
            }

            const modifier = rule.getAdvancedModifier();
            if (!(modifier instanceof UrlTransformModifier)) {
                continue;
            }
            const transformedUrl = modifier.applyToUrl(currentUrl);
            const hasUrlChanged = transformedUrl !== currentUrl;

            if (hasUrlChanged) {
                this.publishUrlTransformEvent(rule, currentUrl, contentType, context.tabId, timestamp);

                logger.debug(`[tsweb.UrlTransformService.getTransformedUrl]: URL transformed from "${currentUrl}" to "${transformedUrl}"`);

                // Detect origin change for full-URL mode transforms
                if (modifier.isFullUrlMode()) {
                    try {
                        const originalOrigin = new URL(currentUrl).origin;
                        const transformedOrigin = new URL(transformedUrl).origin;
                        if (originalOrigin !== transformedOrigin) {
                            isOriginChanged = true;
                        }
                    } catch (e) {
                        // If URL parsing fails, not an origin change
                        logger.debug(`[tsweb.UrlTransformService.getTransformedUrl]: Failed to parse URL for origin comparison: "${currentUrl}"`, e);
                    }
                }

                currentUrl = transformedUrl;
            }
        }

        if (currentUrl === requestUrl) {
            return { url: null, isOriginChanged: false };
        }

        return { url: currentUrl, isOriginChanged };
    }

    /**
     * Publishes a URL transform filtering event to the filtering log.
     *
     * @param rule Network rule that triggered the event.
     * @param currentUrl The current (possibly already transformed) URL.
     * @param contentType Request content type.
     * @param tabId Tab id.
     * @param timestamp Event timestamp.
     */
    private publishUrlTransformEvent(
        rule: NetworkRule,
        currentUrl: string,
        contentType: ContentType,
        tabId: number,
        timestamp: number,
    ): void {
        const { appliedRuleText, originalRuleText } = getRuleTexts(rule, this.engineApi);

        this.filteringLog.publishEvent({
            type: FilteringEventType.UrlTransform,
            data: {
                eventId: nanoid(),
                tabId,
                requestUrl: currentUrl,
                frameUrl: currentUrl,
                frameDomain: getDomain(currentUrl) as string,
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
}
