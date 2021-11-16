/* eslint-disable class-methods-use-this */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { configurationValidator, Configuration } from './configuration';
import { webRequestApi } from './web-request-api';
import { engineApi } from './engine-api';
import { tabsApi } from './tabs';
import { resourcesApi } from './resources-api';
import { redirectsApi } from './redirects-api';

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
     * Is app started
     */
    isStarted: boolean;

    /**
     * Current Configuration object
     */
    configuration?: Configuration;

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

    public isStarted = false;

    public configuration: Configuration | undefined;

    public async start(configuration: Configuration): Promise<void> {
        configurationValidator.parse(configuration);

        resourcesApi.start();
        await redirectsApi.start();
        await tabsApi.start();
        await engineApi.startEngine(configuration);
        webRequestApi.start();

        this.isStarted = true;
        this.configuration = configuration;
    }

    public async stop(): Promise<void> {
        webRequestApi.stop();
        tabsApi.stop();
        resourcesApi.stop();
        this.isStarted = false;
    }

    public async configure(configuration: Configuration): Promise<void> {
        configurationValidator.parse(configuration);

        if (!this.isStarted) {
            throw new Error('App is not strated!');
        }

        await engineApi.startEngine(configuration);
        this.configuration = configuration;
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
