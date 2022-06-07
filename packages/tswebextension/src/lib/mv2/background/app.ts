/* eslint-disable class-methods-use-this */
/* eslint-disable @typescript-eslint/no-unused-vars */
import merge from 'deepmerge';
import { WebRequestApi } from './web-request-api';
import { engineApi } from './engine-api';
import { tabsApi } from './tabs';
import { resourcesService } from './services/resources-service';
import { redirectsService } from './services/redirects-service';
import { FrameRequestService } from './services/frame-request-service';
import { messagesApi } from './messages-api';
import { stealthApi } from './stealth-api';
import {
    AppInterface,
    SiteStatus,
    defaultFilteringLog,
    configurationValidator,
    Configuration,
    ConfigurationContext,
} from '../../common';

import { Assistant } from './assistant';

export interface ManifestV2AppInterface extends AppInterface<Configuration, ConfigurationContext> {
    getMessageHandler: () => typeof messagesApi.handleMessage
}

export class TsWebExtension implements ManifestV2AppInterface {
    public isStarted = false;

    /**
     * MV2 Configuration context excludes heavyweight fields with rules
     */
    public configuration: ConfigurationContext | undefined;

    public onFilteringLogEvent = defaultFilteringLog.onLogEvent;

    public onAssistantCreateRule = Assistant.onCreateRule;

    /**
     * Constructor
     *
     * @param webAccessibleResourcesPath
     */
    constructor(webAccessibleResourcesPath: string) {
        resourcesService.init(webAccessibleResourcesPath);
    }

    public async start(configuration: Configuration): Promise<void> {
        configurationValidator.parse(configuration);

        await redirectsService.start();
        await engineApi.startEngine(configuration);
        await tabsApi.start();
        FrameRequestService.start();
        await stealthApi.start(configuration);
        WebRequestApi.start();

        this.isStarted = true;
        this.configuration = TsWebExtension.createConfigurationContext(configuration);
    }

    public async stop(): Promise<void> {
        WebRequestApi.stop();
        FrameRequestService.stop();
        tabsApi.stop();
        stealthApi.stop();
        this.isStarted = false;
    }

    public async configure(configuration: Configuration): Promise<void> {
        if (!this.isStarted) {
            throw new Error('App is not started!');
        }

        configurationValidator.parse(configuration);

        await engineApi.startEngine(configuration);
        await tabsApi.updateCurrentTabsMainFrameRules();
        this.configuration = TsWebExtension.createConfigurationContext(configuration);

        /* TODO: this.stop */
        stealthApi.stop();
        await stealthApi.start(configuration);
    }

    public openAssistant(tabId: number): void {
        Assistant.openAssistant(tabId);
    }

    public closeAssistant(tabId: number): void {
        Assistant.closeAssistant(tabId);
    }

    public getSiteStatus(url: string): SiteStatus {
        return SiteStatus.FilteringEnabled;
    }

    public getRulesCount(): number {
        return engineApi.getRulesCount();
    }

    public getMessageHandler() {
        return messagesApi.handleMessage;
    }

    /**
     * recursively merge changes to passed confuguration
     * @returns new confuguration
     *
     * using for immutably update the config object
     * and pass it to {@link configure} or {@link start} method
     * which will validate the configuration
     */
    static mergeConfiguration(
        configuration: Configuration,
        changes: Partial<Configuration>,
    ) {
        return merge<Configuration>(configuration, changes, {
            // Arrays will be replaced
            arrayMerge: (_, source) => source,
        });
    }

    private static createConfigurationContext(configuration: Configuration): ConfigurationContext {
        const { filters, verbose, settings } = configuration;

        return {
            filters: filters.map(({ filterId }) => filterId),
            verbose,
            settings,
        };
    }
}
