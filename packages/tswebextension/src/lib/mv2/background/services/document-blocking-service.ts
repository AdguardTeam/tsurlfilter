import browser, { type WebRequest } from 'webextension-polyfill';
import { getHostname } from 'tldts';
import { NetworkRuleOption, type NetworkRule } from '@adguard/tsurlfilter';

import { defaultFilteringLog, FilteringEventType } from '../../../common/filtering-log';
import { logger } from '../../../common/utils/logger';
import { isChromium } from '../utils/browser-detector';
import { type ConfigurationMV2 } from '../configuration';
import { type TabsApi } from '../tabs/tabs-api';
import { ContentType } from '../../../common/request-type';

/**
 * Params for {@link DocumentBlockingService.getDocumentBlockingResponse}.
 */
type GetDocumentBlockingResponseParams = {
    tabId: number,
    eventId: string,
    rule: NetworkRule,
    referrerUrl: string,
    requestUrl: string,

    /**
     * Request id.
     */
    requestId: string,
};

/**
 * This service encapsulate processing of $document modifier rules.
 *
 * Service is initialized in {@link configure} method, called from {@link EngineApi#startEngine}.
 *
 * Request rule is processed in {@link getDocumentBlockingResponse} method, called
 * from {@link RequestBlockingApi.getBlockingResponse}.
 *
 * Request rule is processed following scenario:
 * - if domain is trusted, ignore request
 * - if rule is document blocking and {@link documentBlockingPageUrl} is undefined, return
 * {@link WebRequestApi.onBeforeRequest} blocking response
 * - if rule is document blocking and {@link documentBlockingPageUrl} is defined, return redirect response with
 * required params.
 * - if browser is Firefox, update page url by {@link browser.tabs} API, because FF doesn't support redirects to
 * extension pages.
 */
export class DocumentBlockingService {
    // base url of document blocking page
    private documentBlockingPageUrl: string | undefined;

    // list of domain names of sites, which should be excluded from document blocking
    private trustedDomains: string[] = [];

    /**
     * Creates instance of {@link DocumentBlockingService}.
     *
     * @param tabsApi Wrapper around browser.tabs API.
     */
    constructor(
        private readonly tabsApi: TabsApi,
    ) {}

    /**
     * Configures service instance {@link documentBlockingPageUrl}.
     *
     * @param configuration App {@link Configuration}.
     */
    public configure(configuration: ConfigurationMV2): void {
        const { settings, trustedDomains } = configuration;

        this.documentBlockingPageUrl = settings?.documentBlockingPageUrl;
        this.trustedDomains = trustedDomains;
    }

    /**
     * Processes $document modifier rule matched request in {@link RequestBlockingApi.getBlockingResponse}.
     *
     * @param data Data for document request processing.
     *
     * @returns Blocking response or null {@link WebRequestApi.onBeforeRequest}.
     */
    public getDocumentBlockingResponse(data: GetDocumentBlockingResponseParams): WebRequest.BlockingResponse | void {
        const {
            tabId,
            eventId,
            rule,
            referrerUrl,
            requestId,
            requestUrl,
        } = data;

        // if request url domain is trusted, ignore document blocking rule
        if (this.isTrustedDomain(requestUrl)) {
            return undefined;
        }

        // public filtering log event
        defaultFilteringLog.publishEvent({
            type: FilteringEventType.ApplyBasicRule,
            data: {
                eventId,
                tabId,
                filterId: rule.getFilterListId(),
                ruleIndex: rule.getIndex(),
                requestUrl,
                requestId,
                frameUrl: referrerUrl,
                requestType: ContentType.Document,
                isAllowlist: rule.isAllowlist(),
                isImportant: rule.isOptionEnabled(NetworkRuleOption.Important),
                isDocumentLevel: rule.isDocumentLevelAllowlistRule(),
                isCsp: rule.isOptionEnabled(NetworkRuleOption.Csp),
                isCookie: rule.isOptionEnabled(NetworkRuleOption.Cookie),
                advancedModifier: rule.getAdvancedModifierValue(),
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

        // Chrome doesn't allow to show extension pages in incognito mode
        if (isChromium && this.tabsApi.isIncognitoTab(tabId)) {
            // Closing tab before opening a new one may lead to browser crash (Chromium)
            browser.tabs.create({ url: blockingUrl })
                .then(() => {
                    browser.tabs.remove(tabId);
                })
                .catch((e) => {
                    logger.warn(`Can't open info page about blocked domain. Err: ${e}`);
                });
        } else {
            // Browser doesn't allow redirects to extension pages which are not listed in web
            // accessible resources. We set blocking page url via browser.tabs
            // api for bypassing this limitation.
            this.reloadTabWithBlockingPage(tabId, blockingUrl);
        }

        return { cancel: true };
    }

    /**
     * Checks if request url domain is trusted.
     *
     * @param url Request url.
     *
     * @returns True, if request url domain is trusted, else false.
     */
    private isTrustedDomain(url: string): boolean {
        const domain = getHostname(url);

        if (domain) {
            return this.trustedDomains.includes(domain);
        }

        return false;
    }

    /**
     * Updates tab with document blocking page url.
     *
     * @param tabId Tab id.
     * @param url Blocking page url.
     */
    private reloadTabWithBlockingPage(tabId: number, url: string): void {
        const tabContext = this.tabsApi.getTabContext(tabId);

        if (!tabContext) {
            return;
        }

        browser.tabs.update(tabId, { url });
    }

    /**
     * Sets required url and rule query params to document-blocking page url.
     *
     * @param  documentBlockingPageUrl Url of document-blocking page.
     * @param  requestUrl Processed request url.
     * @param  ruleText Matched rule text.
     *
     * @returns Document blocking page url with required params.
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
