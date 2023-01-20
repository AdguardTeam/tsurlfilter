/* eslint-disable class-methods-use-this */
import merge from 'deepmerge';

import { WebRequestApi } from './web-request-api';
import { engineApi } from './engine-api';
import { tabsApi } from './tabs';
import { resourcesService } from './services/resources-service';
import { redirectsService } from './services/redirects/redirects-service';

import { messagesApi } from './messages-api';
import { AppInterface, defaultFilteringLog } from '../../common';
import {
    ConfigurationMV2,
    ConfigurationMV2Context,
    configurationMV2Validator,
} from './configuration';
import { Assistant } from './assistant';
import { LocalScriptRules, localScriptRulesService } from './services/local-script-rules-service';
import { RequestEvents } from './request';

export interface ManifestV2AppInterface extends AppInterface<ConfigurationMV2, ConfigurationMV2Context, void> {
    getMessageHandler: () => typeof messagesApi.handleMessage
}

/**
 * App implementation for MV2.
 */
export class TsWebExtension implements ManifestV2AppInterface {
    public isStarted = false;

    /**
     * MV2 ConfigurationMV2 context excludes heavyweight fields with rules.
     */
    public configuration: ConfigurationMV2Context | undefined;

    public onFilteringLogEvent = defaultFilteringLog.onLogEvent;

    // TODO add comment when this is used.
    public onAssistantCreateRule = Assistant.onCreateRule;

    /**
     * Constructor.
     *
     * @param webAccessibleResourcesPath Path to web accessible resources for {@link resourcesService}.
     */
    constructor(webAccessibleResourcesPath: string) {
        resourcesService.init(webAccessibleResourcesPath);
    }

    /**
     * Initializes {@link EngineApi} with passed {@link configuration}.
     * Starts request processing via {@link WebRequestApi} and tab tracking via {@link tabsApi}.
     *
     * @param configuration App configuration.
     */
    public async start(configuration: ConfigurationMV2): Promise<void> {
        configurationMV2Validator.parse(configuration);

        RequestEvents.init();
        await redirectsService.start();
        await engineApi.startEngine(configuration);
        tabsApi.setVerbose(configuration.verbose);
        await tabsApi.start();
        WebRequestApi.start();
        Assistant.assistantUrl = configuration.settings.assistantUrl;

        this.isStarted = true;
        this.configuration = TsWebExtension.createConfigurationMV2Context(configuration);
    }

    /**
     * Fully stop request and tab processing.
     */
    public async stop(): Promise<void> {
        WebRequestApi.stop();
        tabsApi.stop();
        this.isStarted = false;
    }

    /**
     * Reinitializes {@link EngineApi} with passed {@link configuration}
     * and update tabs main frame rules based on new engine state.
     *
     * Requires app is started.
     *
     * @param configuration App configuration.
     *
     * @throws Error, if app is not started.
     */
    public async configure(configuration: ConfigurationMV2): Promise<void> {
        if (!this.isStarted) {
            throw new Error('App is not started!');
        }

        configurationMV2Validator.parse(configuration);

        tabsApi.setVerbose(configuration.verbose);

        await engineApi.startEngine(configuration);
        await tabsApi.updateCurrentTabsMainFrameRules();

        this.configuration = TsWebExtension.createConfigurationMV2Context(configuration);
    }

    /**
     * Opens assistant in the tab.
     *
     * @param tabId Tab id where assistant will be opened.
     */
    public async openAssistant(tabId: number): Promise<void> {
        await Assistant.openAssistant(tabId);
    }

    /**
     * Close assistant in the required tab.
     *
     * @param tabId Tab id.
     */
    public async closeAssistant(tabId: number): Promise<void> {
        await Assistant.closeAssistant(tabId);
    }

    /**
     * Return rules count for current configuration.
     *
     * @returns Rules count.
     */
    public getRulesCount(): number {
        return engineApi.getRulesCount();
    }

    // TODO: types
    /**
     * Returns message handler for MV2.
     *
     * @returns Message handler.
     */
    public getMessageHandler(): typeof messagesApi.handleMessage {
        return messagesApi.handleMessage;
    }

    // TODO check why this is not used or described in the interface?
    /**
     * Sets prebuild local script rules.
     *
     * @see {@link LocalScriptRulesService}
     *
     * @param localScriptRules JSON object with pre-build JS rules. @see {@link LocalScriptRulesService}.
     */
    public setLocalScriptRules(localScriptRules: LocalScriptRules): void {
        localScriptRulesService.setLocalScriptRules(localScriptRules);
    }

    // TODO check why this is not used or described in the interface?
    /**
     * Recursively merges changes to passed {@link ConfigurationMV2}.
     *
     * @param configuration Current app configuration.
     * @param changes Partial configuration data, which will be merged.
     * @returns New merged configuration.
     *
     * Using for immutably update the config object and pass it to {@link configure} or {@link start} method which will
     * validate the configuration.
     */
    static mergeConfigurationMV2(
        configuration: ConfigurationMV2,
        changes: Partial<ConfigurationMV2>,
    ): ConfigurationMV2 {
        return merge<ConfigurationMV2>(configuration, changes, {
            // Arrays will be replaced
            arrayMerge: (_, source) => source,
        });
    }

    /**
     * Creates configuration context.
     *
     * @param configuration Configuration.
     * @returns Configuration context.
     */
    private static createConfigurationMV2Context(configuration: ConfigurationMV2): ConfigurationMV2Context {
        const { filters, verbose, settings } = configuration;

        return {
            filters: filters.map(({ filterId }) => filterId),
            verbose,
            settings,
        };
    }
}
