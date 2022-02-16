import { RequestBlockingApi, RequestContext, requestContextStorage } from '../request';

const CSP_HEADER_NAME = 'Content-Security-Policy';

/**
 * Content Security Policy Headers filtering service module
 */
export class CspService {
    /**
     * On headers received handler.
     * Add CSP headers.
     *
     * @param context request context
     * @return if headers modified
     */
    public static onHeadersReceived(context: RequestContext): boolean {
        const {
            matchingResult,
            responseHeaders,
            requestId,
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
