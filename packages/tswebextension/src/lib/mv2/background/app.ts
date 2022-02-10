/* eslint-disable @typescript-eslint/no-unused-vars */
import { webRequestApi } from './web-request-api';
import { engineApi } from './engine-api';
import { tabsApi } from './tabs';
import { resourcesService } from './services/resources-service';
import { redirectsService } from './services/redirects-service';
import { frameRequestService } from './services/frame-request-service';
import { messagesApi } from './messages-api';
import { stealthApi } from './stealth-api';
import {
    AppInterface,
    SiteStatus,
    defaultFilteringLog,
    MessageType,
    configurationValidator,
    Configuration,
} from '../../common';

export class TsWebExtension implements AppInterface {

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
