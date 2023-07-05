import { getDomain } from 'tldts';
import {
    defaultFilteringLog,
    FilteringEventType,
    FilteringLogInterface,
    ContentType,
} from '../../../common';
import { requestContextStorage, RequestContextStorage, RequestContext } from '../request';

/**
 * Permissions Policy service.
 */
export class PermissionsPolicyService {
    private static readonly PERMISSIONS_POLICY_HEADER_NAME = 'Permissions-Policy';

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
     * Applies permissions policy directives to the response headers.
     * @param context Request context.
     * @returns True if policies were set successfully.
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

        const permissionsPolicyRules = matchingResult.getPermissionsPolicyRules();
        const permissionsPolicyHeaders = [];

        /**
         * Allowlist with $permissions modifier disables
         * all the $permissions rules on all the pages matching the rule pattern.
         */
        if (permissionsPolicyRules.length === 0 || permissionsPolicyRules[0].isAllowlist()) {
            return false;
        }

        for (let i = 0; i < permissionsPolicyRules.length; i += 1) {
            const rule = permissionsPolicyRules[i];
            const directive = rule.getAdvancedModifierValue();

            if (directive) {
                permissionsPolicyHeaders.push({
                    name: PermissionsPolicyService.PERMISSIONS_POLICY_HEADER_NAME,
                    value: directive,
                });

                this.filteringLog.publishEvent({
                    type: FilteringEventType.ApplyPermissionsRule,
                    data: {
                        tabId,
                        eventId: requestId,
                        requestUrl,
                        frameUrl: referrerUrl,
                        frameDomain: getDomain(referrerUrl),
                        requestType: ContentType.PermissionsPolicy,
                        rule,
                        timestamp: Date.now(),
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
