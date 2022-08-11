/* eslint-disable class-methods-use-this */
/* eslint-disable @typescript-eslint/no-unused-vars */
import merge from 'deepmerge';
import { WebRequestApi } from './web-request-api';
import { engineApi } from './engine-api';
import { tabsApi } from './tabs';
import { resourcesService } from './services/resources-service';
import { redirectsService } from './services/redirects-service';
import { messagesApi } from './messages-api';
import {
    AppInterface,
    defaultFilteringLog,
} from '../../common';

import {
    ConfigurationMV2,
    ConfigurationMV2Context,
    configurationMV2Validator,
} from './configuration';

import { Assistant } from './assistant';

export interface ManifestV2AppInterface extends AppInterface<ConfigurationMV2, ConfigurationMV2Context, void> {
    getMessageHandler: () => typeof messagesApi.handleMessage
}

export class TsWebExtension implements ManifestV2AppInterface {
    public isStarted = false;

    /**
     * MV2 ConfigurationMV2 context excludes heavyweight fields with rules
     */
    public configuration: ConfigurationMV2Context | undefined;

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

    public async start(configuration: ConfigurationMV2): Promise<void> {
        configurationMV2Validator.parse(configuration);

        await redirectsService.start();
        await engineApi.startEngine(configuration);
        await tabsApi.start();
        WebRequestApi.start();

        this.isStarted = true;
        this.configuration = TsWebExtension.createConfigurationMV2Context(configuration);
    }

    public async stop(): Promise<void> {
        WebRequestApi.stop();
        tabsApi.stop();
        this.isStarted = false;
    }

    public async configure(configuration: ConfigurationMV2): Promise<void> {
        if (!this.isStarted) {
            throw new Error('App is not started!');
        }

        configurationMV2Validator.parse(configuration);

        await engineApi.startEngine(configuration);
        await tabsApi.updateCurrentTabsMainFrameRules();
        this.configuration = TsWebExtension.createConfigurationMV2Context(configuration);
    }

    public openAssistant(tabId: number): void {
        Assistant.openAssistant(tabId);
    }

    public closeAssistant(tabId: number): void {
        Assistant.closeAssistant(tabId);
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
    static mergeConfigurationMV2(
        configuration: ConfigurationMV2,
        changes: Partial<ConfigurationMV2>,
    ) {
        return merge<ConfigurationMV2>(configuration, changes, {
            // Arrays will be replaced
            arrayMerge: (_, source) => source,
        });
    }

    private static createConfigurationMV2Context(configuration: ConfigurationMV2): ConfigurationMV2Context {
        const { filters, verbose, settings } = configuration;

        return {
            filters: filters.map(({ filterId }) => filterId),
            verbose,
            settings,
        };
    }
}
