/* eslint-disable class-methods-use-this */

import { appContext } from './context';
import { WebRequestApi } from './web-request-api';
import { engineApi } from './engine-api';
import { tabsApi } from './tabs';
import { resourcesService } from './services/resources-service';
import { redirectsService } from './services/redirects/redirects-service';

import { messagesApi } from './messages-api';
import {
    type AppInterface,
    defaultFilteringLog,
    logger,
} from '../../common';

import {
    ConfigurationMV2,
    ConfigurationMV2Context,
    configurationMV2Validator,
} from './configuration';
import { Assistant } from './assistant';
import { LocalScriptRules, localScriptRulesService } from './services/local-script-rules-service';
import { RequestEvents } from './request';
import { TabsCosmeticInjector } from './tabs/tabs-cosmetic-injector';

export interface ManifestV2AppInterface extends AppInterface<ConfigurationMV2, ConfigurationMV2Context, void> {
    /**
     * Returns message handler.
     */
    getMessageHandler: () => typeof messagesApi.handleMessage;

    /**
     * Sets prebuild local script rules.
     *
     * @see {@link LocalScriptRulesService}
     * @param localScriptRules JSON object with pre-build JS rules.
     */
    setLocalScriptRules: (rules: LocalScriptRules) => void;
}

/**
 * App implementation for MV2.
 */
export class TsWebExtension implements ManifestV2AppInterface {
    /**
     * Fires on filtering log event.
     */
    public onFilteringLogEvent = defaultFilteringLog.onLogEvent;

    /**
     * Fires when a rule has been created from the helper.
     */
    public onAssistantCreateRule = Assistant.onCreateRule;

    /**
     * Gets app running status.
     *
     * @returns True if app started, else false.
     */
    public get isStarted(): boolean {
        return appContext.isAppStarted;
    }

    /**
     * Sets app running status.
     *
     * @param value Status value.
     */
    public set isStarted(value: boolean) {
        appContext.isAppStarted = value;
    }

    /**
     * Gets app configuration context.
     *
     * @returns True if app started, else false.
     */
    public get configuration(): ConfigurationMV2Context | undefined {
        return appContext.configuration;
    }

    /**
     * Sets app configuration context.
     *
     * @param value Status value.
     */
    public set configuration(value: ConfigurationMV2Context | undefined) {
        appContext.configuration = value;
    }

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
     *
     * @throws Error if configuration is not valid.
     */
    public async start(configuration: ConfigurationMV2): Promise<void> {
        configurationMV2Validator.parse(configuration);

        logger.setVerbose(configuration.verbose);

        RequestEvents.init();
        await redirectsService.start();
        await engineApi.startEngine(configuration);
        await TabsCosmeticInjector.processOpenTabs();
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
     * Re-initializes {@link EngineApi} with passed {@link configuration}
     * and update tabs main frame rules based on new engine state.
     *
     * Requires app is started.
     *
     * @param configuration App configuration.
     *
     * @throws Error if app is not started or configuration is not valid.
     */
    public async configure(configuration: ConfigurationMV2): Promise<void> {
        if (!this.isStarted) {
            throw new Error('App is not started!');
        }

        configurationMV2Validator.parse(configuration);

        logger.setVerbose(configuration.verbose);

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
