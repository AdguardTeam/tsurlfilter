import browser from 'webextension-polyfill';
import { RuleGenerator } from '@adguard/agtree/generator';
import { NetworkRuleOption, type NetworkRule } from '@adguard/tsurlfilter';

import { type ConfigurationMV2 } from '../mv2/background/configuration';
import { type ConfigurationMV3 } from '../mv3/background/configuration';
import { type EngineApi as EngineApiMV2 } from '../mv2/background/engine-api';
import { type EngineApi as EngineApiMV3 } from '../mv3/background/engine-api';
import { type TabsApi as TabsApiMV2 } from '../mv2/background/tabs/tabs-api';
import { type TabsApi as TabsApiMV3 } from '../mv3/tabs/tabs-api';

import { defaultFilteringLog, FilteringEventType } from './filtering-log';
import { ContentType } from './request-type';
import { type BrowserDetector } from './utils/browser-detector';
import { logger } from './utils/logger';

/**
 * Params for {@link DocumentBlockingService.getDocumentBlockingResponse}.
 */
export type GetDocumentBlockingResponseParams = {
    /**
     * Tab id.
     */
    tabId: number;

    /**
     * Event id.
     */
    eventId: string;

    /**
     * Request id.
     */
    requestId: string;

    /**
     * Request url.
     */
    requestUrl: string;

    /**
     * Referrer url.
     */
    referrerUrl: string;

    /**
     * Rule which is applied to request.
     */
    rule: NetworkRule;
};

/**
 * Data for redirecting to document blocking page.
 */
type BlockingPageRedirectData = {
    /**
     * Tab id.
     */
    tabId: number;

    /**
     * Document blocking page url.
     */
    documentBlockingPageUrl: string;

    /**
     * Request url.
     */
    requestUrl: string;

    /**
     * Network rule.
     */
    rule: NetworkRule;
};

/**
 * Common service for document blocking.
 */
export abstract class DocumentBlockingServiceCommon {
    /**
     * Text for unknown rule.
     */
    private static readonly UNKNOWN_RULE_TEXT = '<Could not retrieve rule text>';

    /**
     * Query parameter for document blocking page URL which contains a blocked request URL.
     */
    private static readonly BLOCKING_PAGE_URL_PARAM = 'url';

    /**
     * Query parameter for document blocking page URL which contains an applied rule.
     */
    private static readonly BLOCKING_PAGE_RULE_PARAM = 'rule';

    /**
     * Query parameter for document blocking page URL which contains a filter list id of the applied rule.
     */
    private static readonly BLOCKING_PAGE_FILTER_ID_PARAM = 'filterId';

    /**
     * Base url of document blocking page.
     */
    protected documentBlockingPageUrl: string | undefined;

    /**
     * Creates instance of {@link DocumentBlockingService}.
     *
     * @param tabsApi Wrapper around browser.tabs API.
     * @param engineApi Engine API.
     * @param browserDetector Browser detector.
     */
    constructor(
        protected readonly tabsApi: TabsApiMV2 | TabsApiMV3,
        protected readonly engineApi: EngineApiMV2 | EngineApiMV3,
        protected readonly browserDetector: BrowserDetector,
    ) {}

    /**
     * Configures service instance {@link documentBlockingPageUrl}.
     *
     * @param configuration App {@link Configuration}.
     */
    protected abstract configure(configuration: ConfigurationMV2 | ConfigurationMV3): void;

    /**
     * Checks if the request (for MV2) or the rule (for MV3) is trusted.
     *
     * @param input Input to check.
     *
     * @returns True if trusted, false otherwise.
     */
    protected abstract isTrusted(input: string): boolean;

    /**
     * Logs document blocking event.
     *
     * @param data Data for document request processing.
     */
    protected static logEvent(data: GetDocumentBlockingResponseParams): void {
        const {
            tabId,
            eventId,
            requestId,
            requestUrl,
            referrerUrl,
            rule,
        } = data;

        // public filtering log event
        defaultFilteringLog.publishEvent({
            type: FilteringEventType.ApplyBasicRule,
            data: {
                tabId,
                eventId,
                requestId,
                requestUrl,
                requestType: ContentType.Document,
                frameUrl: referrerUrl,
                filterId: rule.getFilterListId(),
                ruleIndex: rule.getIndex(),
                isAllowlist: rule.isAllowlist(),
                isImportant: rule.isOptionEnabled(NetworkRuleOption.Important),
                isDocumentLevel: rule.isDocumentLevelAllowlistRule(),
                isCsp: rule.isOptionEnabled(NetworkRuleOption.Csp),
                isCookie: rule.isOptionEnabled(NetworkRuleOption.Cookie),
                advancedModifier: rule.getAdvancedModifierValue(),
            },
        });
    }

    /**
     * Updates tab with document blocking page url.
     *
     * @param tabId Tab id.
     * @param url Blocking page url.
     */
    protected reloadTabWithBlockingPage(tabId: number, url: string): void {
        const tabContext = this.tabsApi.getTabContext(tabId);

        if (!tabContext) {
            return;
        }

        browser.tabs.update(tabId, { url });
    }

    /**
     * Returns rule text from the network rule.
     *
     * Note: The generated rule text is returned
     * and it may differ slightly from the actually applied rule text.
     *
     * @param rule Network rule.
     *
     * @returns Rule text or "no-rule" placeholder if rule is not found.
     */
    protected getRuleText(rule: NetworkRule): string {
        const ruleNode = this.engineApi.retrieveRuleNode(rule.getFilterListId(), rule.getIndex());

        // Generate rule text or use default text.
        // Practically, we should always have a rule text, but just in case we have a fallback.
        const ruleText = ruleNode
            ? RuleGenerator.generate(ruleNode)
            : DocumentBlockingServiceCommon.UNKNOWN_RULE_TEXT;

        return ruleText;
    }

    /**
     * Sets required url and rule query params to document-blocking page url.
     *
     * @param documentBlockingPageUrl Url of document-blocking page.
     * @param requestUrl Processed request url.
     * @param rule Network rule.
     * @param filterListId Filter list id.
     *
     * @returns Document blocking page url with required params.
     */
    protected createBlockingUrl(
        documentBlockingPageUrl: string,
        requestUrl: string,
        rule: NetworkRule,
        filterListId: number,
    ): string {
        const url = new URL(documentBlockingPageUrl);

        const ruleText = this.getRuleText(rule);

        url.searchParams.set(DocumentBlockingServiceCommon.BLOCKING_PAGE_URL_PARAM, requestUrl);
        url.searchParams.set(DocumentBlockingServiceCommon.BLOCKING_PAGE_RULE_PARAM, ruleText);
        url.searchParams.set(DocumentBlockingServiceCommon.BLOCKING_PAGE_FILTER_ID_PARAM, filterListId.toString());

        return url.toString();
    }

    /**
     * Redirects to document blocking page.
     *
     * @param redirectData Data for redirecting to document blocking page.
     */
    protected redirectToBlockingUrl(redirectData: BlockingPageRedirectData): void {
        const {
            tabId,
            documentBlockingPageUrl,
            requestUrl,
            rule,
        } = redirectData;

        // get document blocking url with required params
        const blockingUrl = this.createBlockingUrl(
            documentBlockingPageUrl,
            requestUrl,
            rule,
            rule.getFilterListId(),
        );

        const isChrome = this.browserDetector.isChrome();
        const isChromium = this.browserDetector.isChromium();

        // Chrome does not allow to show extension pages in incognito mode
        if ((isChrome || isChromium)
            && this.tabsApi.canShowExtensionPageInTab(tabId)) {
            // Closing tab before opening a new one may lead to browser crash (Chromium)
            browser.tabs.create({ url: blockingUrl })
                .then(() => {
                    browser.tabs.remove(tabId);
                })
                .catch((e: unknown) => {
                    logger.warn(`Cannot open info page about blocked domain due to ${e}`);
                });
        } else {
            // Browser doesn't allow redirects to extension pages which are not listed in web
            // accessible resources. We set blocking page url via browser.tabs
            // api for bypassing this limitation.
            this.reloadTabWithBlockingPage(tabId, blockingUrl);
        }
    }
}
