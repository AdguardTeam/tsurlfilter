/* eslint-disable class-methods-use-this */
/* eslint-disable @typescript-eslint/no-unused-vars */
import browser from 'webextension-polyfill';
import { StringRuleList, RuleStorage, Engine, setConfiguration } from '@adguard/tsurlfilter';
import { configurationValidator, Configuration } from './configuration';
import { WebRequestApi } from './web-request-api';

export type UnknownFunction = (...args: unknown[]) => unknown;
// TODO complement with other methods
type RequestMethod = 'POST' | 'GET';

// TODO complement with other types
type RequestType = 'DOCUMENT' | 'PING' | 'IMAGE' | 'STYLESHEET' | 'SCRIPT';

/**
 * Represents information about rule which blocked ad
 * can be used in the stats of filtering log
 */
interface RequestRule {
    filterId: number,
    ruleText: string,
    allowlistRule: boolean,
    cspRule: boolean,
    modifierValue: string | null,
    cookieRule: boolean
    cssRule: boolean,
}

/*
 * Returns information about state for site
 */
enum SiteStatus {
    /**
    * AdBlocker can't apply rules on this site
    */
    SiteInException = 'SITE_IN_EXCEPTION',
    /**
    * Site is in the allowlist
    */
    SiteAllowlisted = 'SITE_ALLOWLISTED',

    /**
    * Filtering on the site is working as expected
    */
    FilteringEnabled = 'FILTERING_ENABLED',
}

/**
 * Represents data of filtering log event, can be used to display events
 * in the filtering log, or collect stats to display on popup
 */
interface FilteringLogEvent {
    // TODO complement with required fields
    tabId: number,
    eventId: number,
    // string representation of blocked dom node
    element?: string,
    requestUrl?: string,
    frameUrl: string,
    requestType: RequestType,
    timestamp: number,
    statusCode: number,
    method: RequestMethod,
    requestRule: RequestRule,
}



export interface TsWebExtensionInterface {
    /**
     * Starts api
     * @param configuration
     */
    start: (configuration: Configuration) => Promise<void>;

    /**
     * Stops api
     */
    stop: () => Promise<void>;

    /**
     * Updates configuration
     * @param configuration
     */
    configure: (configuration: Configuration) => Promise<void>;

    /**
     * Launches assistant in the current tab
     */
    openAssistant: (tabId: number) => void;

    /**
     * Closes assistant
     */
    closeAssistant: (tabId: number) => void;

    /**
     * Fires on filtering log event
     */
    onFilteringLogEvent(cb: (filteringLogEvent: FilteringLogEvent) => void): void,

    /**
     * Returns current status for site
     */
    getSiteStatus(url: string): SiteStatus,
}

export class TsWebExtension implements TsWebExtensionInterface {
    private engine: Engine | undefined;

    public async start(configuration: Configuration): Promise<void> {
        configurationValidator.parse(configuration);

        const { filters, userrules, verbose } = configuration;

        const lists: StringRuleList[] = [];

        for (let i = 0; i < filters.length; i += 1) {
            const { filterId, content } = filters[i];
            lists.push(new StringRuleList(filterId, content));
        }

        if (userrules.length > 0) {
            lists.push(new StringRuleList(0, userrules.join('\n')));
        }

        const ruleStorage = new RuleStorage(lists);

        setConfiguration({
            engine: 'extension',
            version: '1.0.0',
            verbose,
        });

        this.engine = new Engine(ruleStorage, true);

        await this.engine.loadRulesAsync(5000);

        const webRequestApi = new WebRequestApi();

        webRequestApi.init();
    }

    public async stop(): Promise<void> {
        // TODO: implement
    }

    public async configure(configuration: Configuration): Promise<void> {
        // TODO: implement
    }

    public openAssistant(tabId: number): void {
        // TODO: implement
    }

    public closeAssistant(tabId: number): void {
        // TODO: implement
    }

    public getSiteStatus(url: string): SiteStatus {
        return SiteStatus.FilteringEnabled;
    }

    public onFilteringLogEvent(cb: (filteringLogEvent: FilteringLogEvent) => void) {
        // TODO implement
        cb({
            tabId: 10,
            eventId: 10,
            requestUrl: 'https://example.org',
            frameUrl: 'https://example.org',
            requestType: 'DOCUMENT' as RequestType,
            timestamp: 1633960896641,
            statusCode: 200,
            method: 'POST' as RequestMethod,
            requestRule: {
                filterId: 1,
                ruleText: '||ad.mail.ru^$domain=~e.mail.ru|~octavius.mail.ru',
                allowlistRule: false,
                cspRule: false,
                modifierValue: null,
                cookieRule: false,
                cssRule: false,
            },
        });
    }
}
