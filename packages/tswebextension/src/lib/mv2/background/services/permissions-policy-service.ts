import { getDomain } from 'tldts';
import {
    type NetworkRule,
    NetworkRuleOption,
    PERMISSIONS_POLICY_HEADER_NAME,
    RequestType,
} from '@adguard/tsurlfilter';
import { requestContextStorage, type RequestContextStorage, type RequestContext } from '../request';
import { defaultFilteringLog, FilteringEventType, type FilteringLogInterface } from '../../../common/filtering-log';
import { ContentType } from '../../../common/request-type';

/**
 * Permissions Policy service.
 */
export class PermissionsPolicyService {
    /**
     * Filtering log.
     */
    private filteringLog: FilteringLogInterface;

    /**
     * Request context storage.
     */
    private contextStorage: RequestContextStorage;

    /**
     * Constructor.
     *
     * @param contextStorage Request context storage.
     * @param filteringLog Filtering log.
     */
    constructor(contextStorage: RequestContextStorage, filteringLog: FilteringLogInterface) {
        this.filteringLog = filteringLog;
        this.contextStorage = contextStorage;
    }

    /**
     * Checks if a network rule is sub document rule.
     *
     * @param rule Rule to check.
     * @returns `true` if the rule is sub document rule.
     */
    private static isSubDocumentRule(rule: NetworkRule): boolean {
        return (rule.getPermittedRequestTypes() & RequestType.SubDocument) === RequestType.SubDocument;
    }

    /**
     * Applies permissions policy directives to the response headers.
     * @param context Request context.
     * @returns True if policies were set successfully.
     */
    public onHeadersReceived(context: RequestContext): boolean {
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
            return false;
        }

        const permissionsPolicyRules = matchingResult.getPermissionsPolicyRules();
        const permissionsPolicyHeaders = [];

        if (permissionsPolicyRules.length === 0) {
            return false;
        }

        // Check if a global allowlist rule is present.
        if (
            permissionsPolicyRules.some(
                (rule) => rule.isAllowlist()
                    && !rule.getAdvancedModifierValue()
                    && !PermissionsPolicyService.isSubDocumentRule(rule),
            )
        ) {
            return false;
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

                this.filteringLog.publishEvent({
                    type: FilteringEventType.ApplyPermissionsRule,
                    data: {
                        tabId,
                        eventId: requestId,
                        requestUrl,
                        frameUrl: referrerUrl,
                        frameDomain: getDomain(referrerUrl),
                        requestType: ContentType.PermissionsPolicy,
                        filterId: rule.getFilterListId(),
                        ruleIndex: rule.getIndex(),
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

        this.contextStorage.update(requestId, {
            responseHeaders: responseHeaders ? [
                ...responseHeaders,
                ...permissionsPolicyHeaders,
            ] : permissionsPolicyHeaders,
        });

        return true;
    }
}

export const permissionsPolicyService = new PermissionsPolicyService(requestContextStorage, defaultFilteringLog);
