import { getDomain } from 'tldts';
import {
    type NetworkRule,
    NetworkRuleOption,
    PERMISSIONS_POLICY_HEADER_NAME,
    RequestType,
} from '@adguard/tsurlfilter';

import { defaultFilteringLog, FilteringEventType } from '../../../common/filtering-log';
import { ContentType } from '../../../common/request-type';
import { nanoid } from '../../../common/utils/nanoid';
import { getRuleTexts } from '../../../common/utils/rule-text-provider';
import { engineApi } from '../engine-api';
import { requestContextStorage, type RequestContext } from '../request';

/**
 * Permissions Policy service.
 */
export class PermissionsPolicyService {
    /**
     * Checks if a network rule is sub document rule.
     *
     * @param rule Rule to check.
     *
     * @returns `true` if the rule is sub document rule.
     */
    private static isSubDocumentRule(rule: NetworkRule): boolean {
        return (rule.getPermittedRequestTypes() & RequestType.SubDocument) === RequestType.SubDocument;
    }

    /**
     * Applies permissions policy directives to the response headers.
     *
     * @param context Request context.
     */
    public static onHeadersReceived(context: RequestContext): void {
        const {
            matchingResult,
            responseHeaders,
            requestId,
            requestType,
            tabId,
            requestUrl,
            referrerUrl,
        } = context;

        if (!matchingResult) {
            return;
        }

        const permissionsPolicyRules = matchingResult.getPermissionsPolicyRules();
        const permissionsPolicyHeaders = [];

        if (permissionsPolicyRules.length === 0) {
            return;
        }

        // Check if a global allowlist rule is present.
        if (
            permissionsPolicyRules.some(
                (rule) => rule.isAllowlist()
                    && !rule.getAdvancedModifierValue()
                    && !PermissionsPolicyService.isSubDocumentRule(rule),
            )
        ) {
            return;
        }

        for (let i = 0; i < permissionsPolicyRules.length; i += 1) {
            const rule = permissionsPolicyRules[i];

            // Sub frames can only be affected by a rule where the $subdocument modifier has been set.
            if (PermissionsPolicyService.isSubDocumentRule(rule) !== (requestType === RequestType.SubDocument)) {
                continue;
            }

            const directives = rule.getAdvancedModifierValue();

            if (directives) {
                if (!rule.isAllowlist()) {
                    permissionsPolicyHeaders.push({
                        name: PERMISSIONS_POLICY_HEADER_NAME,
                        value: directives,
                    });
                }

                const { appliedRuleText, originalRuleText } = getRuleTexts(rule, engineApi);

                defaultFilteringLog.publishEvent({
                    type: FilteringEventType.ApplyPermissionsRule,
                    data: {
                        tabId,
                        // for proper filtering log request info rule displaying
                        // event id should be unique for each event, not copied from request
                        // https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2341
                        eventId: nanoid(),
                        requestUrl,
                        frameUrl: referrerUrl,
                        frameDomain: getDomain(referrerUrl),
                        requestType: ContentType.PermissionsPolicy,
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
        }

        requestContextStorage.update(requestId, {
            responseHeaders: responseHeaders ? [
                ...responseHeaders,
                ...permissionsPolicyHeaders,
            ] : permissionsPolicyHeaders,
        });
    }
}
