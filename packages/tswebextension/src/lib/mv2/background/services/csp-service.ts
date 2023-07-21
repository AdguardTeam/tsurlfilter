import { getDomain } from 'tldts';
import { nanoid } from 'nanoid';

import { ContentType } from '../../../common/request-type';
import { defaultFilteringLog, FilteringEventType } from '../../../common/filtering-log';
import {
    type RequestContext,
    requestContextStorage,
} from '../request/request-context-storage';
import { RequestBlockingApi } from '../request/request-blocking-api';

const CSP_HEADER_NAME = 'Content-Security-Policy';

/**
 * Content Security Policy Headers filtering service module.
 */
export class CspService {
    /**
     * Applies CSP rules to response headers and returns modified headers.
     * It is applied when webRequest.onHeadersReceived event is fired.
     *
     * @param context Request context.
     * @returns True if headers were modified.
     */
    public static onHeadersReceived(context: RequestContext): boolean {
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
            // Don't forget: getCspRules returns all $csp rules, we must directly check that the rule is blocking.
            if (RequestBlockingApi.isRequestBlockedByRule(rule)) {
                const cspHeaderValue = rule.getAdvancedModifierValue();

                if (cspHeaderValue) {
                    cspHeaders.push({
                        name: CSP_HEADER_NAME,
                        value: cspHeaderValue,
                    });

                    defaultFilteringLog.publishEvent({
                        type: FilteringEventType.ApplyCspRule,
                        data: {
                            tabId,
                            eventId: nanoid(),
                            requestUrl,
                            frameUrl: referrerUrl,
                            frameDomain: getDomain(referrerUrl),
                            requestType: ContentType.Csp,
                            rule,
                            timestamp: Date.now(),
                        },
                    });
                }
            }
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
