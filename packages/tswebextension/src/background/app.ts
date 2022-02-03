/* eslint-disable class-methods-use-this */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { configurationValidator, Configuration } from './configuration';
import { webRequestApi } from './web-request-api';
import { engineApi } from './engine-api';
import { tabsApi } from './tabs';
import { resourcesService } from './services/resources-service';
import { redirectsService } from './services/redirects-service';
import { frameRequestService } from './services/frame-request-service';
import { messagesApi } from './messages-api';
import { stealthApi } from './stealth-api';
import { MessageType } from '../common';
import { defaultFilteringLog, FilteringLogEvent } from './filtering-log';
import { EventChannelInterface } from './utils';

export type UnknownFunction = (...args: unknown[]) => unknown;

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
     * Fires on filtering log event
     */
    onFilteringLogEvent: EventChannelInterface<FilteringLogEvent>,

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
     * Returns current status for site
     */
    getSiteStatus(url: string): SiteStatus,
}

export class TsWebExtension implements TsWebExtensionInterface {

    public isStarted = false;

    public configuration: Configuration | undefined;


    public onFilteringLogEvent = defaultFilteringLog.onLogEvent;

    /**
     * Web accessible resources path in the result bundle
     */
    private readonly webAccessibleResourcesPath: string | undefined;

    /**
     * Constructor
     *
     * @param webAccessibleResourcesPath optional
     */
    constructor(webAccessibleResourcesPath?: string) {
        this.webAccessibleResourcesPath = webAccessibleResourcesPath;
    }

    public async start(configuration: Configuration): Promise<void> {
        configurationValidator.parse(configuration);

        resourcesService.start(this.webAccessibleResourcesPath);
        await redirectsService.start();
        await tabsApi.start();
        frameRequestService.start();
        await engineApi.startEngine(configuration);
        await stealthApi.start(configuration);
        webRequestApi.start();
        messagesApi.start();

        this.isStarted = true;
        this.configuration = configuration;
    }

    public async stop(): Promise<void> {
        messagesApi.stop();
        webRequestApi.stop();
        frameRequestService.stop();
        tabsApi.stop();
        resourcesService.stop();
        stealthApi.stop();
        this.isStarted = false;
    }

    /* TODO: merge update */
    public async configure(configuration: Configuration): Promise<void> {
        configurationValidator.parse(configuration);

        if (!this.isStarted) {
            throw new Error('App is not started!');
        }

        await engineApi.startEngine(configuration);
        this.configuration = configuration;

        /* TODO: this.stop */
        stealthApi.stop();
        await stealthApi.start(configuration);
    }

    public openAssistant(tabId: number): void {
        messagesApi.addAssistantCreateRuleListener(this.addUserRule.bind(this));

        messagesApi.sendMessage(tabId, {
            type: MessageType.INIT_ASSISTANT,
        });
    }

    public closeAssistant(tabId: number): void {
        messagesApi.sendMessage(tabId, {
            type: MessageType.CLOSE_ASSISTANT,
        });
    }

    public getSiteStatus(url: string): SiteStatus {
        return SiteStatus.FilteringEnabled;
    }

    /**
     * Adds ruleText to user rules
     *
     * @param ruleText
     */
    private addUserRule(ruleText: string): void {
        if (!this.configuration || !this.isStarted) {
            return;
        }

        this.configuration.userrules.push(ruleText);
        this.configure(this.configuration);
    }
}
