import { type WebRequest } from 'webextension-polyfill';

import {
    type GetDocumentBlockingResponseParams,
    DocumentBlockingServiceCommon,
} from '../../../common/document-blocking-service';
import { logger } from '../../../common/utils/logger';
import { type TabsApi, tabsApi } from '../../tabs/tabs-api';
import { browserDetectorMV3 } from '../../utils/browser-detector';
import { type ConfigurationMV3 } from '../configuration';
import { type EngineApi, engineApi } from '../engine-api';

/**
 * This service encapsulate processing of $document modifier rules.
 *
 * Service is initialized in {@link configure} method, called from {@link EngineApi#startEngine}.
 *
 * Request rule is processed in {@link handleDocumentBlocking} method, called
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
     * List of rules which are temporarily considered trusted.
     */
    private trustedDomains: string[] = [];

    /**
     * Creates instance of {@link DocumentBlockingService}.
     *
     * @param tabsApiInstance Wrapper around browser.tabs API.
     * @param engineApiInstance Engine API.
     */
    constructor(
        tabsApiInstance: TabsApi,
        engineApiInstance: EngineApi,
    ) {
        super(
            tabsApiInstance,
            engineApiInstance,
            browserDetectorMV3,
        );
    }

    /**
     * Configures service instance {@link documentBlockingPageUrl}.
     *
     * @param configuration App {@link Configuration}.
     */
    public configure(configuration: ConfigurationMV3): void {
        const { settings, trustedDomains } = configuration;

        this.documentBlockingPageUrl = settings?.documentBlockingPageUrl;
        this.trustedDomains = trustedDomains;
    }

    /**
     * Checks if rule is trusted which means that blocking page should not be shown.
     *
     * @param ruleText Rule to check.
     *
     * @returns True if rule is trusted, false otherwise.
     */
    protected isTrusted(ruleText: string): boolean {
        return this.trustedDomains.includes(ruleText);
    }

    /**
     * Processes $document modifier rule matched request in {@link RequestBlockingApi.getBlockingResponse}.
     *
     * @param data Data for document request processing.
     */
    public handleDocumentBlocking(data: GetDocumentBlockingResponseParams): WebRequest.BlockingResponse | void {
        const {
            tabId,
            rule,
            requestUrl,
        } = data;

        // if documentBlockingPage is undefined, block request
        if (!this.documentBlockingPageUrl) {
            // eslint-disable-next-line max-len
            logger.warn(`[handleDocumentBlocking] documentBlockingPageUrl is not set while handling request ${requestUrl}`);
            return;
        }

        const ruleText = this.getRuleText(rule);

        // if rule is trusted, no blocking
        if (this.isTrusted(ruleText)) {
            return;
        }

        DocumentBlockingService.logEvent(data);

        this.redirectToBlockingUrl({
            tabId,
            documentBlockingPageUrl: this.documentBlockingPageUrl,
            requestUrl,
            rule,
        });
    }
}

export const documentBlockingService = new DocumentBlockingService(tabsApi, engineApi);
