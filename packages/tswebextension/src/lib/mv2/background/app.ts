/* eslint-disable class-methods-use-this */
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
import { LocalScriptRules, localScriptRulesService } from './services/local-script-rules-service';
import { RequestEvents } from './request';

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
     * @param webAccessibleResourcesPath - path to web accessible resources for {@link resourcesService}
     */
    constructor(webAccessibleResourcesPath: string) {
        resourcesService.init(webAccessibleResourcesPath);
    }

    /**
     * Initialize {@link Engine} with passed {@link configuration} and {@link redirectsService}.
     * Starts request processing via {@link WebRequestApi} and tab tracking via {@link tabsApi}
     *
     * @param configuration - app configuration
     */
    public async start(configuration: ConfigurationMV2): Promise<void> {
        configurationMV2Validator.parse(configuration);

        RequestEvents.init();
        await redirectsService.start();
        await engineApi.startEngine(configuration);
        tabsApi.setVerbose(configuration.verbose);
        await tabsApi.start();
        WebRequestApi.start();

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
     * Reinitialize {@link Engine} with passed {@link configuration}
     * and update tabs main frame rules based on new engine state.
     *
     * Requires app is started
     *
     * @param configuration - app configuration
     *
     * @throws error, if app is not started
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

    public async openAssistant(tabId: number): Promise<void> {
        await Assistant.openAssistant(tabId);
    }

    public async closeAssistant(tabId: number): Promise<void> {
        await Assistant.closeAssistant(tabId);
    }

    public getRulesCount(): number {
        return engineApi.getRulesCount();
    }

    // TODO: types
    public getMessageHandler(): typeof messagesApi.handleMessage {
        return messagesApi.handleMessage;
    }

    /**
     * Set prebuild local script rules
     *
     * @see {@link LocalScriptRulesService}
     *
     * @param localScriptRules - JSON object with pre-build JS rules. @see {@link LocalScriptRulesService}
     */
    public setLocalScriptRules(localScriptRules: LocalScriptRules): void {
        localScriptRulesService.setLocalScriptRules(localScriptRules);
    }

    /**
     * Recursively merge changes to passed {@link ConfigurationMV2}
     *
     * @param configuration - current app configuration
     * @param changes - partial configuration data, which will be merged
     * @returns new merged configuration
     *
     * using for immutably update the config object
     * and pass it to {@link configure} or {@link start} method
     * which will validate the configuration
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

    private static createConfigurationMV2Context(configuration: ConfigurationMV2): ConfigurationMV2Context {
        const { filters, verbose, settings } = configuration;

        return {
            filters: filters.map(({ filterId }) => filterId),
            verbose,
            settings,
        };
    }
}
