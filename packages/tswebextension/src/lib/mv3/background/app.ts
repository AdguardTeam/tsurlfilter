/* eslint-disable class-methods-use-this */
// TODO: Remove call to console
/* eslint-disable no-console */
import FiltersApi, { FiltersErrors, UpdateStaticFiltersResult } from './filters-api';
import UserRulesApi, { UserRulesErrors, UpdateDynamicRulesResult } from './user-rules-api';
import MessagesApi from './messages-api';
import { TabsApi, tabsApi } from './tabs-api';
import { getAndExecuteScripts } from './scriptlets';

import {
    AppInterface,
    SiteStatus,
    defaultFilteringLog,
    configurationValidator,
    ConfigurationContext,
    Configuration,
} from '../../common';
import { engineApi } from './engine-api';

type ConfigurationResult = {
    staticFilters: UpdateStaticFiltersResult,
    dynamicRules: UpdateDynamicRulesResult
};

export { ConfigurationResult, FiltersErrors, UserRulesErrors };
export class TsWebExtension implements AppInterface<ConfigurationResult> {
    onFilteringLogEvent = defaultFilteringLog.onLogEvent;

    // Here we store configuration excluding "heavy" fields:
    // filters content, userrules and allowlist
    configuration: ConfigurationContext | undefined;

    isStarted = false;

    private startPromise: Promise<ConfigurationResult> | undefined;

    /**
     * Web accessible resources path in the result bundle
     * relative to the root dir. Should start with leading slash '/'
     */
    private readonly webAccessibleResourcesPath: string | undefined;

    /**
     * Constructor
     *
     * @param webAccessibleResourcesPath string path to web accessible resources,
     * relative to the extension root dir. Should start with leading slash '/'
     */
    constructor(webAccessibleResourcesPath?: string) {
        this.webAccessibleResourcesPath = webAccessibleResourcesPath;

        /**
         * Keep app context when use method as callback of WebNavigation API listeners
         */
        this.onCommitted = this.onCommitted.bind(this);
    }

    /**
     * Runs configuration process via saving promise to inner startPromise
     */
    private async innerStart(config: Configuration): Promise<ConfigurationResult> {
        console.debug('[START]: start');

        let res = {
            staticFilters: { errors: [] },
            dynamicRules: {
                regexpRulesCounter: 0,
                declarativeRulesCounter: 0,
                errors: [],
            },
        } as ConfigurationResult;

        try {
            res = await this.configure(config);
            await this.executeScriptlets();
        } catch (e) {
            this.startPromise = undefined;
            console.debug('[START]: failed', e);

            return res;
        }

        this.isStarted = true;
        this.startPromise = undefined;
        console.debug('[START]: started');
        return res;
    }

    /**
     * Fires on WebNavigation.onCommitted event
     */
    private async onCommitted({ tabId, url }: chrome.webNavigation.WebNavigationTransitionCallbackDetails) {
        if (this.isStarted && this.configuration) {
            // If service worker just woke up
            if (this.startPromise) {
                await this.startPromise;
            }

            const { verbose } = this.configuration;
            await getAndExecuteScripts(tabId, url, verbose);
        }
    }

    /**
     * Starts filtering
     */
    public async start(config: Configuration): Promise<ConfigurationResult> {
        console.debug('[START]: is started ', this.isStarted);

        /**
         * Add tabs listeners
         */
        await tabsApi.start();

        let res = {
            staticFilters: { errors: [] },
            dynamicRules: {
                regexpRulesCounter: 0,
                declarativeRulesCounter: 0,
                errors: [],
            },
        } as ConfigurationResult;

        if (this.isStarted) {
            return res;
        }

        if (this.startPromise) {
            console.debug('[START]: already called start, waiting');
            res = await this.startPromise;
            console.debug('[START]: awaited start');
            return res;
        }

        // Call and wait for promise for allow multiple calling start
        this.startPromise = this.innerStart(config);
        res = await this.startPromise;
        return res;
    }

    /**
     * Stops service, disables all user rules and filters
     */
    public async stop(): Promise<void> {
        await UserRulesApi.removeAllRules();

        const disableFiltersIds = await FiltersApi.getEnabledRulesets();
        await FiltersApi.updateFiltering(disableFiltersIds);

        await engineApi.stopEngine();

        /**
         * Remove tabs listeners and clear context storage
         */
        tabsApi.stop();

        this.isStarted = false;
    }

    /**
     * Uses configuration to pass params to filters, user rules and filter engine
     */
    public async configure(config: Configuration): Promise<ConfigurationResult> {
        console.debug('[CONFIGURE]: start with ', config);

        const res = {
            staticFilters: { errors: [] },
            dynamicRules: {
                regexpRulesCounter: 0,
                declarativeRulesCounter: 0,
                errors: [],
            },
        } as ConfigurationResult;

        const configuration = configurationValidator.parse(config);

        const { declarativeFilters, customFilters } = FiltersApi.separateRulesets(configuration.filters);
        const enableFiltersIds = declarativeFilters
            .map(({ filterId }) => filterId);
        const currentFiltersIds = await FiltersApi.getEnabledRulesets();
        const disableFiltersIds = currentFiltersIds
            .filter((f) => !enableFiltersIds.includes(f)) || [];

        res.staticFilters = await FiltersApi.updateFiltering(
            disableFiltersIds,
            enableFiltersIds,
        );

        res.dynamicRules = await UserRulesApi.updateDynamicFiltering(
            configuration.userrules,
            customFilters,
            this.webAccessibleResourcesPath,
        );

        engineApi.waitingForEngine = engineApi.startEngine({
            filters: configuration.filters,
            userrules: configuration.userrules,
            verbose: configuration.verbose,
        });
        await engineApi.waitingForEngine;

        this.configuration = TsWebExtension.createConfigurationContext(configuration);

        console.debug('[CONFIGURE]: end');

        return res;
    }

    public openAssistant(): void {}

    public closeAssistant(): void {}

    public getSiteStatus(): SiteStatus {
        return SiteStatus.FilteringEnabled;
    }

    public getRulesCount(): number {
        return 0;
    }

    /**
     * @returns messages handler
     */
    public getMessageHandler() {
        const messagesApi = new MessagesApi(this);
        return messagesApi.handleMessage;
    }

    public async executeScriptlets() {
        const activeTab = await TabsApi.getActiveTab();

        if (this.isStarted && this.configuration && activeTab?.url && activeTab?.id) {
            const { url, id } = activeTab;
            const { verbose } = this.configuration;

            await getAndExecuteScripts(id, url, verbose);
        }

        chrome.webNavigation.onCommitted.addListener(this.onCommitted);
    }

    /**
     * Extract Partial Configuration from whole Configration,
     * excluding heavyweight fields which contains rules
     * @param configuration Configuration
     * @returns ConfigurationContext
     */
    private static createConfigurationContext(configuration: Configuration): ConfigurationContext {
        const { filters, verbose, settings } = configuration;

        return {
            filters: filters.map(({ filterId }) => filterId),
            verbose,
            settings,
        };
    }

    /**
     * Returns the map of converted declarative rule
     * identifiers with a hash to the original rule
     */
    public get convertedSourceMap() {
        return UserRulesApi.convertedSourceMap;
    }
}
