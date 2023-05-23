import { IRuleSet } from '@adguard/tsurlfilter/es/declarative-converter';

import { AppInterface, defaultFilteringLog } from '../../common';
import { logger } from '../utils/logger';
import { FailedEnableRuleSetsError } from '../errors/failed-enable-rule-sets-error';

import FiltersApi, { UpdateStaticFiltersResult } from './filters-api';
import UserRulesApi, { ConversionResult } from './user-rules-api';
import { MessagesApi, type MessagesHandlerMV3 } from './messages-api';
import { TabsApi, tabsApi } from './tabs-api';
import { getAndExecuteScripts } from './scriptlets';
import { engineApi } from './engine-api';
import { declarativeFilteringLog, RecordFiltered } from './declarative-filtering-log';
import RuleSetsLoaderApi from './rule-sets-loader-api';
import { Assistant } from './assistant';
import {
    ConfigurationMV3,
    ConfigurationMV3Context,
    configurationMV3Validator,
} from './configuration';

type ConfigurationResult = {
    staticFiltersStatus: UpdateStaticFiltersResult,
    staticFilters: IRuleSet[],
    dynamicRules: ConversionResult
};

// Reexport types
export type {
    ConfigurationResult,
    ConversionResult,
    FailedEnableRuleSetsError,
    RecordFiltered,
};

/**
 * The TsWebExtension class is a facade for working with the Chrome
 * declarativeNetRequest module: enabling/disabling static filters,
 * adding/editing/deleting custom filters or custom rules,
 * starting/stopping declarative filtering log.
 */
export class TsWebExtension implements AppInterface<
ConfigurationMV3,
ConfigurationMV3Context,
ConfigurationResult,
MessagesHandlerMV3
> {
    /**
     * Fires on filtering log event.
     */
    onFilteringLogEvent = defaultFilteringLog.onLogEvent;

    /**
     * Fires when a rule has been created from the helper.
     */
    onAssistantCreateRule = Assistant.onCreateRule;

    /**
     * This is where the configuration is stored, excluding "heavy" fields:
     * the contents of filters, custom rules and the allowlist.
     */
    configuration: ConfigurationMV3Context | undefined;

    /**
     * Whether filtering is enabled or not.
     */
    isStarted = false;

    /**
     * Stores the initialize promise to prevent multiple initialize calls when
     * a large number of messages are received when the service worker
     * starts or wakes up.
     */
    private startPromise: Promise<ConfigurationResult> | undefined;

    /**
     * Web accessible resources path in the result bundle
     * relative to the root dir. Should start with leading slash '/'.
     */
    private readonly webAccessibleResourcesPath: string | undefined;

    /**
     * Creates new {@link TsWebExtension} class.
     *
     * @param webAccessibleResourcesPath Path to resources.
     *
     * @see {@link TsWebExtension.webAccessibleResourcesPath} for details.
     */
    constructor(webAccessibleResourcesPath?: string) {
        this.webAccessibleResourcesPath = webAccessibleResourcesPath;

        // Keep app context when use method as callback
        // of WebNavigation API listeners.
        this.onCommitted = this.onCommitted.bind(this);
    }

    /**
     * Starts the configuration process, keeping the promise to prevent multiple
     * initialize calls, and executes scripts after configuration.
     *
     * @param config {@link Configuration} Configuration file which contains all
     * needed information to start.
     */
    private async innerStart(config: ConfigurationMV3): Promise<ConfigurationResult> {
        logger.debug('[START]: start');

        try {
            const res = await this.configure(config);
            await this.executeScriptlets();

            this.isStarted = true;
            this.startPromise = undefined;
            logger.debug('[START]: started');

            return res;
        } catch (e) {
            this.startPromise = undefined;
            logger.debug('[START]: failed', e);

            throw new Error('Cannot be started: ', { cause: e as Error });
        }
    }

    /**
     * Fires on WebNavigation.onCommitted event.
     *
     * @param item {@link chrome.webNavigation.WebNavigationTransitionCallbackDetails}.
     * @param item.tabId The ID of the tab in which the navigation occurred.
     * @param item.url The url of the tab in which the navigation occurred.
     */
    private async onCommitted(
        { tabId, url }: chrome.webNavigation.WebNavigationTransitionCallbackDetails,
    ): Promise<void> {
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
     * Starts filtering along with launching the tab listener, which will record
     * tab urls to work correctly with domain blocking/allowing rules, for
     * example: cosmetic rules in iframes.
     *
     * @param config {@link Configuration}.
     */
    public async start(config: ConfigurationMV3): Promise<ConfigurationResult> {
        logger.debug('[START]: is started ', this.isStarted);

        // Add tabs listeners
        await tabsApi.start();

        if (this.isStarted) {
            throw new Error('Already started');
        }

        if (this.startPromise) {
            logger.debug('[START]: already called start, waiting');
            const res = await this.startPromise;
            logger.debug('[START]: awaited start');
            return res;
        }

        // Call and wait for promise for allow multiple calling start
        this.startPromise = this.innerStart(config);
        return this.startPromise;
    }

    /**
     * Stops service, disables all user rules and filters.
     */
    public async stop(): Promise<void> {
        await UserRulesApi.removeAllRules();

        const disableFiltersIds = await FiltersApi.getEnabledRuleSets();
        await FiltersApi.updateFiltering(disableFiltersIds);

        await engineApi.stopEngine();

        await declarativeFilteringLog.stop();

        // Remove tabs listeners and clear context storage
        tabsApi.stop();

        this.isStarted = false;
    }

    /**
     * Applies new configuration: enables/disables static filters, creates rule
     * sets from provided filters, updates dynamic filters (converts custom
     * filters and user rules on the fly to a single merged rule set), starts
     * declarative filtering log and restarts the engine to reload cosmetic
     * rules.
     *
     * @param config {@link Configuration}.
     *
     * @returns ConfigurationResult {@link ConfigurationResult} which contains:
     * - list of errors for static filters, if any of them has been thrown
     * - converted dynamic rule set with rule set, errors and limitations.
     * @see {@link ConversionResult}
     */
    public async configure(config: ConfigurationMV3): Promise<ConfigurationResult> {
        logger.debug('[CONFIGURE]: start with ', config);

        const configuration = configurationMV3Validator.parse(config);

        // Wrap filters to tsurlfilter.IFilter
        const staticFilters = FiltersApi.createStaticFilters(
            configuration.staticFiltersIds,
            configuration.filtersPath,
        );
        const customFilters = FiltersApi.createCustomFilters(configuration.customFilters);
        const filtersIdsToEnable = staticFilters
            .map((filter) => filter.getId());
        const currentFiltersIds = await FiltersApi.getEnabledRuleSets();
        const filtersIdsToDisable = currentFiltersIds
            .filter((f) => !filtersIdsToEnable.includes(f)) || [];

        // Update list of enabled static filters
        const staticFiltersStatus = await FiltersApi.updateFiltering(
            filtersIdsToDisable,
            filtersIdsToEnable,
        );

        // Convert custom filters and user rules into one rule set and apply it
        const dynamicRules = await UserRulesApi.updateDynamicFiltering(
            configuration.userrules,
            customFilters,
            this.webAccessibleResourcesPath,
        );

        // Reload engine for cosmetic rules
        engineApi.waitingForEngine = engineApi.startEngine({
            filters: [
                ...staticFilters,
                ...customFilters,
            ],
            userrules: configuration.userrules,
            verbose: configuration.verbose,
        });
        await engineApi.waitingForEngine;

        // Wrap filters into rule sets
        const ruleSetsLoaderApi = new RuleSetsLoaderApi(config.ruleSetsPath);
        const manifest = chrome.runtime.getManifest();
        // eslint-disable-next-line max-len
        const manifestRuleSets = manifest.declarative_net_request.rule_resources as chrome.declarativeNetRequest.Ruleset[];
        const staticRuleSetsTasks = manifestRuleSets.map(({ id }) => {
            return ruleSetsLoaderApi.createRuleSet(id, staticFilters);
        });
        const staticRuleSets = await Promise.all(staticRuleSetsTasks);

        // TODO: Recreate only dynamic rule set, because static cannot be changed
        const ruleSets = [
            ...staticRuleSets,
            ...dynamicRules.ruleSets,
        ];
        declarativeFilteringLog.ruleSets = ruleSets;

        // Starts declarative filtering log
        if (config.filteringLogEnabled) {
            await declarativeFilteringLog.start();
        } else {
            await declarativeFilteringLog.stop();
        }

        this.configuration = TsWebExtension.createConfigurationContext(configuration);

        logger.debug('[CONFIGURE]: end');

        return {
            staticFiltersStatus,
            staticFilters: staticRuleSets,
            dynamicRules,
        };
    }

    /**
     * Opens the AdGuard assistant in the specified tab.
     *
     * @param tabId The ID of the tab where is needed to open
     * the AdGuard assistant.
     */
    // eslint-disable-next-line class-methods-use-this
    public async openAssistant(tabId: number): Promise<void> {
        await Assistant.openAssistant(tabId);
    }

    /**
     * Closes the AdGuard assistant in the specified tab.
     *
     * @param tabId The ID of the tab where is needed to close
     * the AdGuard assistant.
     */
    // TODO: deprecated?
    // eslint-disable-next-line class-methods-use-this
    public async closeAssistant(tabId: number): Promise<void> {
        await Assistant.closeAssistant(tabId);
    }

    /**
     * Gets current loaded rules in the filtering engine
     * (except declarative rules).
     *
     * @returns Number of loaded rules in the filtering engine.
     */
    // eslint-disable-next-line class-methods-use-this
    public getRulesCount(): number {
        return engineApi.getRulesCount();
    }

    /**
     * Returns a message handler that will listen to internal messages,
     * for example: get css for content-script, or start/stop declarative
     * filtering log.
     *
     * @returns Messages handler.
     */
    public getMessageHandler(): MessagesHandlerMV3 {
        // Keep app context when handle message.
        const messagesApi = new MessagesApi(this);
        return messagesApi.handleMessage;
    }

    /**
     * Executes scriptlets for the currently active tab and adds a listener to
     * the {@link chrome.webNavigation.onCommitted} hook to execute scriptlets.
     */
    public async executeScriptlets(): Promise<void> {
        const activeTab = await TabsApi.getActiveTab();

        if (this.isStarted && this.configuration && activeTab?.url && activeTab?.id) {
            const { url, id } = activeTab;
            const { verbose } = this.configuration;

            await getAndExecuteScripts(id, url, verbose);
        }

        chrome.webNavigation.onCommitted.addListener(this.onCommitted);
    }

    /**
     * Extract partial configuration {@link ConfigurationMV3Context} from whole
     * {@link ConfigurationMV3}, excluding heavyweight fields which
     * contains rules.
     *
     * @param configuration Configuration.
     *
     * @returns ConfigurationContext.
     */
    private static createConfigurationContext(
        configuration: ConfigurationMV3,
    ): ConfigurationMV3Context {
        const {
            staticFiltersIds,
            customFilters,
            verbose,
            settings,
            filtersPath,
            ruleSetsPath,
            filteringLogEnabled,
        } = configuration;

        return {
            staticFiltersIds,
            customFilters: customFilters.map(({ filterId }) => filterId),
            filtersPath,
            ruleSetsPath,
            filteringLogEnabled,
            verbose,
            settings,
        };
    }
}
