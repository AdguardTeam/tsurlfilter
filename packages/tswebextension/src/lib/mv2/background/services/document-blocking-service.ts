import browser, { WebRequest } from 'webextension-polyfill';
import { NetworkRule } from '@adguard/tsurlfilter';
import { getDomain } from 'tldts';

import { defaultFilteringLog, FilteringEventType } from '../../../common/filtering-log';
import { isFirefox } from '../utils/browser-detector';
import { tabsApi } from '../tabs';
import { ConfigurationMV2 } from '../configuration';

/**
 * This service encapsulate processing of $document modifier rules
 *
 * Service is initialized in {@link configure} method, called from {@link EngineApi#startEngine}
 *
 * Request rule is processed in {@link getDocumentBlockingResponse} method,
 * called from {@link RequestBlockingApi.getBlockingResponse}
 *
 * Request rule is processed following scenario:
 *
 * - If domain is trusted, ignore request
 *
 * - if rule is document blocking and {@link documentBlockingPageUrl} is undefined,
 * return {@link WebRequestApi.onBeforeRequest} blocking response
 *
 * - if rule is document blocking and {@link documentBlockingPageUrl} is defined,
 * return redirect response with required params.
 *
 * - if browser is Firefox, update page url by {@link browser.tabs} API,
 * because FF does't support redirects to extension pages.
 */
export class DocumentBlockingService {
    // base url of document blocking page
    private documentBlockingPageUrl: string | undefined;

    // list of domain names of sites, which should be excluded from document blocking
    private trustedDomains: string[] = [];

    /**
     * Configure service instance {@link documentBlockingPageUrl}
     *
     * @param configuration - app {@link Configuration}
     */
    public configure(configuration: ConfigurationMV2) {
        const { settings, trustedDomains } = configuration;

        this.documentBlockingPageUrl = settings?.documentBlockingPageUrl;
        this.trustedDomains = trustedDomains;
    }

    /**
     * Processes $document modifier rule matched request in {@link RequestBlockingApi.getBlockingResponse}
     *
     * @param requestId - request id
     * @param requestUrl - url of processed request
     * @param rule - {@link NetworkRule} instance of matched rule
     * @param tabId - tabId of processed request
     * @returns - {@link WebRequestApi.onBeforeRequest} callback response or null
     */
    public getDocumentBlockingResponse(
        requestId: string,
        requestUrl: string,
        rule: NetworkRule,
        tabId: number,
    ): WebRequest.BlockingResponse | void {
        // if request url domain is trusted, ignore document blocking rule
        if (this.isTrustedDomain(requestUrl)) {
            return;
        }

        // public filtering log event
        defaultFilteringLog.publishEvent({
            type: FilteringEventType.APPLY_BASIC_RULE,
            data: {
                eventId: requestId,
                tabId,
                rule,
            },
        });

        // if documentBlockingPage is undefined, block request
        if (!this.documentBlockingPageUrl) {
            return { cancel: true };
        }

        // get document blocking url with required params
        const blockingUrl = DocumentBlockingService.createBlockingUrl(
            this.documentBlockingPageUrl,
            requestUrl,
            rule.getText(),
        );

        // Firefox doesn't allow redirects to extension pages
        // We set blocking page url via browser.tabs api for bypassing this limitation
        if (isFirefox) {
            DocumentBlockingService.reloadTabWithBlockingPage(tabId, blockingUrl);
        }

        return { redirectUrl: blockingUrl };
    }

    /**
     * Checks if request url domain is trusted
     *
     * @param url - request url
     * @returns true, if request url domain is trusted, else false
     */
    private isTrustedDomain(url: string) {
        const domain = getDomain(url);

        return domain && this.trustedDomains.includes(domain);
    }

    /**
     * Update tab with document blocking page url
     *
     * @param tabId - tab id
     * @param url - blocking page url
     */
    private static reloadTabWithBlockingPage(tabId: number, url: string): void {
        const tabContext = tabsApi.getTabContext(tabId);

        if (!tabContext) {
            return;
        }

        browser.tabs.update(tabId, { url });
    }

    /**
     * Set required url and rule query params to document-blocking page url
     *
     * @param  documentBlockingPageUrl - url of document-blocking page
     * @param  requestUrl - processed request url
     * @param  ruleText - matched rule text
     * @returns blocking page url with required url and rule query params
     */
    private static createBlockingUrl(
        documentBlockingPageUrl: string,
        requestUrl: string,
        ruleText: string,
    ): string {
        const url = new URL(documentBlockingPageUrl);

        url.searchParams.set('url', requestUrl);
        url.searchParams.set('rule', ruleText);

        return url.toString();
    }
}

export const documentBlockingService = new DocumentBlockingService();
