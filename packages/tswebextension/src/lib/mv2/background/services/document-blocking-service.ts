import { type WebRequest } from 'webextension-polyfill';
import { getHostname } from 'tldts';

import {
    type GetDocumentBlockingResponseParams,
    DocumentBlockingServiceCommon,
} from '../../../common/document-blocking-service';
import { type ConfigurationMV2 } from '../configuration';
import { type TabsApi } from '../tabs/tabs-api';
import { type EngineApi } from '../engine-api';
import { browserDetectorMV2 } from '../utils/browser-detector';

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
export class DocumentBlockingService extends DocumentBlockingServiceCommon {
    /**
     * List of domain names of sites, which should be excluded from document blocking.
     */
    private trustedDomains: string[] = [];

    /**
     * Creates instance of {@link DocumentBlockingService}.
     *
     * @param tabsApi Wrapper around browser.tabs API.
     * @param engineApi Engine API.
     */
    constructor(
        tabsApi: TabsApi,
        engineApi: EngineApi,
    ) {
        super(
            tabsApi,
            engineApi,
            browserDetectorMV2,
        );
    }

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
     * Checks if request url domain is trusted.
     *
     * @param url Request url.
     *
     * @returns True, if request url domain is trusted, else false.
     */
    protected isTrusted(url: string): boolean {
        const domain = getHostname(url);

        if (domain) {
            return this.trustedDomains.includes(domain);
        }

        return false;
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
            rule,
            requestUrl,
        } = data;

        // if request url is trusted, no redirect to blocking page
        if (this.isTrusted(requestUrl)) {
            return undefined;
        }

        DocumentBlockingService.logEvent(data);

        // if documentBlockingPage is undefined, block request
        if (!this.documentBlockingPageUrl) {
            return { cancel: true };
        }

        this.redirectToBlockingUrl({
            tabId,
            documentBlockingPageUrl: this.documentBlockingPageUrl,
            requestUrl,
            rule,
        });

        return { cancel: true };
    }
}
