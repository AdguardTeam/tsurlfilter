import browser from 'webextension-polyfill';
import {
    Filter,
    METADATA_RULESET_ID,
    RULESET_NAME_PREFIX,
    type IFilter,
    type IRuleSet,
} from '@adguard/tsurlfilter/es/declarative-converter';
import { FilterListPreprocessor, type PreprocessedFilterList } from '@adguard/tsurlfilter';
import { LogLevel } from '@adguard/logger';
import { type AnyRule } from '@adguard/agtree';
import { getRuleSetId } from '@adguard/tsurlfilter/es/declarative-converter-utils';

import { type MessageHandler, type AppInterface } from '../../common/app';
import {
    ALLOWLIST_FILTER_ID,
    BLOCKING_TRUSTED_FILTER_ID,
    QUICK_FIXES_FILTER_ID,
    USER_FILTER_ID,
} from '../../common/constants';
import { defaultFilteringLog } from '../../common/filtering-log';
import { logger, stringifyObjectWithoutKeys } from '../../common/utils/logger';
import { type FailedEnableRuleSetsError } from '../errors/failed-enable-rule-sets-error';
import { tabsApi } from '../tabs/tabs-api';
import { TabsCosmeticInjector } from '../tabs/tabs-cosmetic-injector';
import { IdbSingleton } from '../../common/idb-singleton';

import { AllowlistApi, allowlistApi } from './allowlist-api';
import { appContext } from './app-context';
import { type ConfigurationMV3, type ConfigurationMV3Context, configurationMV3Validator } from './configuration';
import { declarativeFilteringLog } from './declarative-filtering-log';
import DynamicRulesApi, { type ConversionResult } from './dynamic-rules-api';
import { engineApi } from './engine-api';
import { extSessionStorage } from './ext-session-storage';
import FiltersApi, { type LoadFilterContent, type UpdateStaticFiltersResult } from './filters-api';
import { MessagesApi } from './messages-api';
import { RequestEvents } from './request/events/request-events';
import { RuleSetsLoaderApi } from './rule-sets-loader-api';
import { documentBlockingService } from './services/document-blocking-service';
import { type LocalScriptFunctionData, localScriptRulesService } from './services/local-script-rules-service';
import { type StealthConfigurationResult, StealthService } from './services/stealth-service';
import { WebRequestApi } from './web-request-api';
import { assistant, Assistant } from './assistant';
import { SessionRulesApi } from './session-rules-api';

type ConfigurationResult = {
    staticFiltersStatus: UpdateStaticFiltersResult;
    staticFilters: IRuleSet[];
    dynamicRules?: ConversionResult;
    stealthResult?: StealthConfigurationResult;
};

type FiltersUpdateInfo = {
    staticFilters: IFilter[];
    customFilters: IFilter[];
    filtersIdsToEnable: number[];
    filtersIdsToDisable: number[];
};

// Reexport types
export type {
    ConfigurationResult,
    ConversionResult,
    FailedEnableRuleSetsError,
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
    ConfigurationResult
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
     *
     * @returns Configuration context.
     */
    // eslint-disable-next-line class-methods-use-this
    public get configuration(): ConfigurationMV3Context | undefined {
        return appContext.configuration;
    }

    /**
     * Sets app configuration context.
     *
     * @param value Status value.
     */
    // eslint-disable-next-line class-methods-use-this
    public set configuration(value: ConfigurationMV3Context) {
        appContext.configuration = value;
    }

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
     * @see {@link TsWebExtension.webAccessibleResourcesPath} for details.
     *
     * @param webAccessibleResourcesPath Path to resources.
     */
    constructor(webAccessibleResourcesPath?: string) {
        this.webAccessibleResourcesPath = webAccessibleResourcesPath;
    }

    /**
     * Starts the configuration process, keeping the promise to prevent multiple
     * initialize calls, and executes scripts after configuration.
     *
     * @param config {@link ConfigurationMV3} Configuration object which contains all
     * needed information to start.
     *
     * @returns Promise resolved with result of configuration
     * {@link ConfigurationResult}.
     */
    private async innerStart(config: ConfigurationMV3): Promise<ConfigurationResult> {
        logger.trace('[tsweb.TsWebExtension.innerStart]: start');

        if (!appContext.startTimeMs) {
            appContext.startTimeMs = Date.now();
        }

        try {
            const res = await this.configure(config);

            // Start listening for request events.
            RequestEvents.init();

            // Start handle request events.
            WebRequestApi.start();

            // Start handle onRuleMatchedDebug event.
            declarativeFilteringLog.start();

            // Add tabs listeners
            await tabsApi.start();

            // Compute and save matching result for tabs, opened before app initialization.
            await TabsCosmeticInjector.processOpenTabs();

            documentBlockingService.configure(config);

            // Do it only once on first start, because path to assistantUrl can
            // not be changed during runtime.
            Assistant.setAssistantUrl(config.settings.assistantUrl);

            appContext.isAppStarted = true;
            this.isStarted = true;
            this.startPromise = undefined;

            logger.trace('[tsweb.TsWebExtension.innerStart]: started');

            return res;
        } catch (e) {
            this.startPromise = undefined;

            logger.error('[tsweb.TsWebExtension.innerStart]: failed: ', e);

            throw new Error('Cannot be started: ', { cause: e as Error });
        }
    }

    /**
     * Synchronize rule set with IDB.
     *
     * @param staticFilterId Static filter id.
     * @param ruleSetsPath Path to rule sets.
     *
     * TODO: Find a way to exclude usage of this method, since we trying to keep
     * only one way to configure tswebextension and all its parts, including
     * rulesets: via passing single configuration file. And this method creates
     * a "dirty" flow, when tswebextension is not received log level from
     * extension and forces us to use static locks for IDB in RuleSetsLoaderApi
     * to prevent concurrent access issues between multiple instances.
     */
    public static async syncRuleSetWithIdbByFilterId(
        staticFilterId: number,
        ruleSetsPath: string,
    ): Promise<void> {
        const ruleSetsLoaderApi = new RuleSetsLoaderApi(ruleSetsPath);

        const ruleSetId = `${RULESET_NAME_PREFIX}${staticFilterId}`;

        await ruleSetsLoaderApi.syncRuleSetWithIdb(ruleSetId);
    }

    /**
     * Synchronizes multiple rule sets with IDB.
     * This method is used as an upgrade task to ensure all rule sets are properly cached.
     *
     * @param ruleSetsPath Path to rule sets.
     * @param staticFiltersIds Array of static filter IDs to sync.
     */
    private static async syncRuleSetsWithIdb(
        ruleSetsPath: string,
        staticFiltersIds: number[],
    ): Promise<void> {
        const ruleSetsLoaderApi = new RuleSetsLoaderApi(ruleSetsPath);

        const syncTasks = staticFiltersIds.map((staticFilterId) => {
            const ruleSetId = `${RULESET_NAME_PREFIX}${staticFilterId}`;

            return ruleSetsLoaderApi.syncRuleSetWithIdb(ruleSetId);
        });

        await Promise.all(syncTasks);
    }

    /**
     * Starts filtering along with launching the tab listener, which will record
     * tab urls to work correctly with domain blocking/allowing rules, for
     * example: cosmetic rules in iframes.
     *
     * @param config {@link ConfigurationMV3} Configuration object to start with.
     *
     * @returns Promise resolved with result of configuration {@link ConfigurationResult}.
     */
    public async start(config: ConfigurationMV3): Promise<ConfigurationResult> {
        // Update log level before first log message.
        TsWebExtension.updateLogLevel(config.logLevel);

        logger.trace('[tsweb.TsWebExtension.start]: is started ', this.isStarted);

        if (this.isStarted) {
            throw new Error('Already started');
        }

        if (this.startPromise) {
            logger.trace('[tsweb.TsWebExtension.start]: already called start, waiting');
            const res = await this.startPromise;
            logger.trace('[tsweb.TsWebExtension.start]: awaited start');
            return res;
        }

        // Call and wait for promise for allow multiple calling start
        this.startPromise = this.innerStart(config);
        return this.startPromise;
    }

    /**
     * Removes all static and dynamic DNR rules and stops tsurlfilter engine.
     */
    private static async removeAllFilteringRules(): Promise<void> {
        await DynamicRulesApi.removeAllRules();

        const disableFiltersIds = await FiltersApi.getEnabledRuleSets();
        await FiltersApi.updateFiltering(disableFiltersIds);

        await StealthService.clearAll();

        declarativeFilteringLog.startUpdate();
        declarativeFilteringLog.finishUpdate([], false);

        engineApi.stopEngine();
    }

    /**
     * Stops service, disables all user rules and filters.
     */
    public async stop(): Promise<void> {
        // Stop handle onRuleMatchedDebug event.
        // It should be stopped before removing rules,
        // otherwise, it may try to log applying of removed rules. AG-36068.
        declarativeFilteringLog.stop();

        await TsWebExtension.removeAllFilteringRules();

        // Stop handle request events.
        WebRequestApi.stop();

        // Stop handle request events.
        WebRequestApi.stop();

        // Remove tabs listeners and clear context storage
        tabsApi.stop();

        appContext.isAppStarted = false;
        this.isStarted = false;
    }

    /**
     * Applies new configuration: enables/disables static filters, creates rule
     * sets from provided filters, updates dynamic filters (converts custom
     * filters and user rules on the fly to a single merged rule set), starts
     * declarative filtering log and restarts the engine to reload cosmetic
     * rules.
     *
     * @param config A {@link ConfigurationMV3} to apply.
     *
     * @returns ConfigurationResult {@link ConfigurationResult} which contains:
     * - list of errors for static filters, if any of them has been thrown
     * - converted dynamic rule set with rule set, errors and limitations.
     * Details: {@link ConversionResult}.
     *
     * @throws Error if the filter content is not provided and not already set in the class instance.
     */
    public async configure(config: ConfigurationMV3): Promise<ConfigurationResult> {
        // IMPORTANT: This call should always be made before any other operations for
        // proper logging and error handling.
        TsWebExtension.updateLogLevel(config.logLevel);

        await TsWebExtension.syncRuleSetsWithIdb(config.ruleSetsPath, config.staticFiltersIds);

        // Exclude binary fields from logged config.
        const binaryFields = [
            'userrules',
            'sourceMap',
            'rawFilterList',
            'filterList',
            'conversionMap',
        ];
        logger.trace('[tsweb.TsWebExtension.configure]: start with ', stringifyObjectWithoutKeys(config, binaryFields));

        const configuration = configurationMV3Validator.parse(config); // error happens here

        const res: ConfigurationResult = {
            staticFiltersStatus: {
                errors: [],
            },
            staticFilters: [],
        };

        // Stop handle onRuleMatchedDebug event.
        // It should be stopped before declarative log update or removing filtering rules,
        // otherwise, it may try to log applying of removed rules. AG-44355.
        declarativeFilteringLog.stop();

        if (configuration.settings.filteringEnabled) {
            declarativeFilteringLog.startUpdate();

            res.stealthResult = await StealthService.applySettings(configuration.settings);

            // Extract filters info from configuration and wrap them into IFilters.
            const {
                staticFilters,
                customFilters,
                filtersIdsToEnable,
                filtersIdsToDisable,
            } = await TsWebExtension.getFiltersUpdateInfo(configuration, FiltersApi.loadFilterContent);

            // Update list of enabled static filters
            res.staticFiltersStatus = await FiltersApi.updateFiltering(
                filtersIdsToDisable,
                filtersIdsToEnable,
            );

            // Create static rulesets.
            const staticRuleSets = await TsWebExtension.loadStaticRuleSets(
                configuration.ruleSetsPath,
                staticFilters,
            );

            // Get enabled static rule sets
            const enabledRuleSetsIds = await browser.declarativeNetRequest.getEnabledRulesets();
            const enabledStaticRuleSets = staticRuleSets.filter((ruleSet) => {
                const ruleSetId = ruleSet.getId();
                return enabledRuleSetsIds.includes(ruleSetId);
            });

            // Update allowlist settings.
            allowlistApi.configure(configuration);
            // Combine all allowlist rules into one network rule.
            const combinedAllowlistRule = allowlistApi.combineAllowListRulesForDNR();

            const userRulesFilter = new Filter(
                USER_FILTER_ID,
                {
                    getContent: (): Promise<PreprocessedFilterList> => {
                        return Promise.resolve(configuration.userrules);
                    },
                },
                true,
            );

            const allowlistFilter = new Filter(
                ALLOWLIST_FILTER_ID,
                // TODO: Generate AST directly for allowlist rules.
                {
                    getContent: (): Promise<PreprocessedFilterList> => {
                        return Promise.resolve(
                            FilterListPreprocessor.preprocess(combinedAllowlistRule),
                        );
                    },
                },
                true,
            );

            const quickFixesFilter = new Filter(
                QUICK_FIXES_FILTER_ID,
                {
                    getContent: (): Promise<PreprocessedFilterList> => {
                        return Promise.resolve(configuration.quickFixesRules);
                    },
                },
                true,
            );

            const trustedDomainsExceptionRule = AllowlistApi.getAllowlistRule(configuration.trustedDomains);

            const blockingPageTrustedFilter = new Filter(
                BLOCKING_TRUSTED_FILTER_ID,
                {
                    getContent: (): Promise<PreprocessedFilterList> => {
                        return Promise.resolve(FilterListPreprocessor.preprocess(trustedDomainsExceptionRule));
                    },
                },
                true,
            );

            // Convert quick fixes rules, allowlist, custom filters and user
            // rules into one rule set and apply it.
            res.dynamicRules = await DynamicRulesApi.updateDynamicFiltering(
                quickFixesFilter,
                allowlistFilter,
                blockingPageTrustedFilter,
                userRulesFilter,
                customFilters,
                enabledStaticRuleSets,
                this.webAccessibleResourcesPath,
            );

            await SessionRulesApi.updateSessionRules(
                enabledStaticRuleSets,
                res.dynamicRules.declarativeRulesToCancel,
            );

            // Reload engine for cosmetic rules: CSS, script and scriptlets.
            engineApi.waitingForEngine = engineApi.startEngine({
                // Built-in filters.
                localFilters: staticFilters,
                // Filters from remote sources.
                remoteFilters: customFilters,
                // Only rules from built-in filters are allowed to be executed
                // from user rules.
                userRulesFilter,
                allowlistRulesList: allowlistApi.getAllowlistRules(),
                // Deprecated.
                quickFixesRules: {
                    ...FilterListPreprocessor.createEmptyPreprocessedFilterList(),
                    trusted: false,
                },
            });
            await engineApi.waitingForEngine;

            // TODO: Recreate only dynamic ruleset, because static cannot be changed
            const ruleSets = [
                ...staticRuleSets,
                res.dynamicRules.ruleSet,
            ];

            // Update rulesets in declarative filtering log.
            declarativeFilteringLog.finishUpdate(ruleSets, configuration.declarativeLogEnabled);

            res.staticFilters = staticRuleSets;
        } else {
            await TsWebExtension.removeAllFilteringRules();
        }

        this.configuration = TsWebExtension.createConfigurationContext(configuration);

        // Update previously opened tabs with new rules - find for each tab
        // new main frame rule.
        await tabsApi.updateCurrentTabsMainFrameRules();

        // Reload request events listeners.
        await WebRequestApi.flushMemoryCache();

        documentBlockingService.configure(config);

        logger.trace('[tsweb.TsWebExtension.configure]: end');

        return res;
    }

    /**
     * Sets prebuild local **script** rules.
     *
     * Should not be used if userScripts API is available.
     *
     * @param localScriptRules Object with pre-build JS rules. @see {@link LocalScriptRulesService}.
     */
    public static setLocalScriptRules(localScriptRules: LocalScriptFunctionData): void {
        localScriptRulesService.setLocalScriptRules(localScriptRules);
    }

    /**
     * Updates `hideReferrer` stealth config value without re-initialization of engine.
     *
     * @param isHideReferrer `isHideReferrer` stealth config value.
     *
     * @returns True if the value was successfully updated, false otherwise.
     *
     * @throws Error if {@link configuration} not set.
     */
    public async setHideReferrer(isHideReferrer: boolean): Promise<boolean> {
        if (!this.configuration) {
            throw new Error('Configuration not set');
        }

        const currentValue = await StealthService.setHideReferrer(isHideReferrer);
        this.configuration.settings.stealth.hideReferrer = currentValue;

        return currentValue;
    }

    /**
     * Updates `blockWebRTC` stealth config value without re-initialization of engine.
     * Also updates webRTC privacy.network settings on demand.
     *
     * @param isBlockWebRTC `blockWebRTC` stealth config value.
     *
     * @returns True if the value was successfully updated, false otherwise.
     *
     * @throws Error if {@link configuration} not set.
     */
    public async setBlockWebRTC(isBlockWebRTC: boolean): Promise<boolean> {
        if (!this.configuration) {
            throw new Error('Configuration not set');
        }

        const currentValue = await StealthService.setDisableWebRTC(isBlockWebRTC);
        this.configuration.settings.stealth.blockWebRTC = currentValue;

        return currentValue;
    }

    /**
     * Updates `blockChromeClientData` stealth config value without re-initialization of engine.
     *
     * @param isBlockChromeClientData `blockChromeClientData` stealth config value.
     *
     * @returns True if the value was successfully updated, false otherwise.
     *
     * @throws Error if {@link configuration} not set.
     */
    public async setBlockChromeClientData(isBlockChromeClientData: boolean): Promise<boolean> {
        if (!this.configuration) {
            throw new Error('Configuration not set');
        }

        const currentValue = await StealthService.setBlockChromeClientData(isBlockChromeClientData);
        this.configuration.settings.stealth.blockChromeClientData = currentValue;

        return currentValue;
    }

    /**
     * Updates `sendDoNotTrack` stealth config value without re-initialization of engine.
     *
     * @param isSendDoNotTrack `sendDoNotTrack` stealth config value.
     *
     * @returns True if the value was successfully updated, false otherwise.
     *
     * @throws Error if {@link configuration} not set.
     */
    public async setSendDoNotTrack(isSendDoNotTrack: boolean): Promise<boolean> {
        if (!this.configuration) {
            throw new Error('Configuration not set');
        }

        const currentValue = await StealthService.setSendDoNotTrack(
            isSendDoNotTrack,
            this.configuration.settings.gpcScriptUrl,
        );
        this.configuration.settings.stealth.sendDoNotTrack = currentValue;

        return currentValue;
    }

    /**
     * Updates `hideSearchQueries` stealth config value without re-initialization of engine.
     *
     * @param isHideSearchQueries `hideSearchQueries` stealth config value.
     *
     * @returns True if the value was successfully updated, false otherwise.
     *
     * @throws Error if {@link configuration} not set.
     */
    public async setHideSearchQueries(isHideSearchQueries: boolean): Promise<boolean> {
        if (!this.configuration) {
            throw new Error('Configuration not set');
        }

        const currentValue = await StealthService.setHideSearchQueries(
            isHideSearchQueries,
            this.configuration.settings.hideDocumentReferrerScriptUrl,
        );

        this.configuration.settings.stealth.hideSearchQueries = currentValue;

        return currentValue;
    }

    /**
     * Opens the AdGuard assistant in the specified tab.
     *
     * @param tabId The ID of the tab where is needed to open
     * the AdGuard assistant.
     */
    // eslint-disable-next-line class-methods-use-this
    public async openAssistant(tabId: number): Promise<void> {
        tabsApi.setAssistantInitTimestamp(tabId);
        await assistant.openAssistant(tabId);
    }

    /**
     * Closes the AdGuard assistant in the specified tab.
     *
     * @param tabId The ID of the tab where is needed to close
     * the AdGuard assistant.
     */
    // eslint-disable-next-line class-methods-use-this
    public async closeAssistant(tabId: number): Promise<void> {
        tabsApi.resetAssistantInitTimestamp(tabId);
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
    public getMessageHandler(): MessageHandler {
        // Keep app context when handle message.
        const messagesApi = new MessagesApi(this, tabsApi, defaultFilteringLog);
        return messagesApi.handleMessage;
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
            declarativeLogEnabled,
        } = configuration;

        return {
            staticFiltersIds,
            customFilters: customFilters.map(({ filterId }) => filterId),
            filtersPath,
            ruleSetsPath,
            declarativeLogEnabled,
            verbose,
            settings,
        };
    }

    /**
     * Extract configuration update info from already parsed configuration.
     *
     * @param parsedConfiguration Already parsed {@link ConfigurationMV3}.
     * @param loadFilterContent Lazy load filter content function.
     *
     * @returns Item of {@link FiltersUpdateInfo}.
     */
    private static async getFiltersUpdateInfo(
        parsedConfiguration: ConfigurationMV3,
        loadFilterContent: LoadFilterContent,
    ): Promise<FiltersUpdateInfo> {
        // Wrap filters to tsurlfilter.IFilter
        const staticFilters = FiltersApi.createStaticFilters(
            parsedConfiguration.staticFiltersIds,
            loadFilterContent,
        );
        const customFilters = FiltersApi.createCustomFilters(
            parsedConfiguration.customFilters,
        );
        const filtersIdsToEnable = staticFilters
            .map((filter) => filter.getId());
        const enabledRuleSetsIds = await FiltersApi.getEnabledRuleSets();
        const filtersIdsToDisable = enabledRuleSetsIds
            .filter((id) => !filtersIdsToEnable.includes(id));

        return {
            staticFilters,
            customFilters,
            filtersIdsToEnable,
            filtersIdsToDisable,
        };
    }

    /**
     * Wraps static filters into rule sets.
     *
     * @param ruleSetsPath Path to the rule set metadata.
     * @param staticFilters List of static {@link IFilter}.
     *
     * @returns A list of static {@link IRuleSet}, or an empty list if an error
     * occurred during the rule scanning step.
     */
    private static async loadStaticRuleSets(
        ruleSetsPath: ConfigurationMV3['ruleSetsPath'],
        staticFilters: IFilter[],
    ): Promise<IRuleSet[]> {
        // Wrap filters into rule sets
        const ruleSetsLoaderApi = new RuleSetsLoaderApi(ruleSetsPath);
        const manifest = browser.runtime.getManifest();
        if (!manifest.declarative_net_request) {
            throw new Error('Cannot find declarative_net_request in manifest');
        }

        // Note: we cannot create rulesets only for enabled filters because we
        // need to get all rulesets' counters for checking limits on the client.
        // Note: we skip metadata ruleset, because it is not a real ruleset.
        const manifestRuleSets = manifest.declarative_net_request.rule_resources
            .filter(({ id }) => id !== getRuleSetId(METADATA_RULESET_ID));

        const staticRuleSetsTasks = manifestRuleSets.map(({ id }) => {
            return ruleSetsLoaderApi.createRuleSet(id, staticFilters);
        });

        try {
            const staticRuleSets = await Promise.all(staticRuleSetsTasks);

            return staticRuleSets;
        } catch (e) {
            const filterListIds = staticFilters.map((f) => f.getId());

            logger.error(`[tsweb.TsWebExtension.loadStaticRuleSets]: cannot scan rules of filter list with ids ${filterListIds} due to: `, e);

            return [];
        }
    }

    /**
     * Initialize app persistent data.
     * This method called as soon as possible and allows access
     * to the actual context before the app is started.
     * Also drops all data to bind the caching layer of filters and rulesets
     * to the lifetime of service worker. This is intended solution to keep
     * interface simple and predictable.
     */
    // eslint-disable-next-line class-methods-use-this
    public async initStorage(): Promise<void> {
        // Drop all cached data to ensure clean state for each service worker lifecycle
        await IdbSingleton.dropAllData();

        await extSessionStorage.init();
        appContext.isStorageInitialized = true;
    }

    /**
     * Sets the debug scriptlets state.
     *
     * @param debug Debug filtering state.
     *
     * @throws Error if {@link configuration} not set.
     */
    public setDebugScriptlets(debug: boolean): void {
        if (!this.configuration) {
            throw new Error('Configuration not set');
        }
        this.configuration.settings.debugScriptlets = debug;
    }

    /**
     * Updates `collectStats` configuration value without re-initialization of engine.
     *
     * @param isCollectStats `collectStats` config value.
     *
     * @throws Error if {@link configuration} not set.
     */
    public setCollectHitStats(isCollectStats: boolean): void {
        if (!this.configuration) {
            throw new Error('Configuration not set');
        }

        this.configuration.settings.collectStats = isCollectStats;
    }

    /**
     * Updates the log level.
     *
     * @param logLevel Log level.
     */
    private static updateLogLevel(logLevel: ConfigurationMV3['logLevel']): void {
        try {
            logger.currentLevel = logLevel as LogLevel || LogLevel.Info;
        } catch (e) {
            logger.currentLevel = LogLevel.Info;
        }
    }

    /**
     * Retrieves a rule node by its filter list identifier and rule index.
     *
     * If there's no rule by that index or the rule structure is invalid, it will return null.
     *
     * @param filterId Filter list identifier.
     * @param ruleIndex Rule index.
     *
     * @returns Rule node or `null`.
     */
    // eslint-disable-next-line class-methods-use-this
    public retrieveRuleNode(filterId: number, ruleIndex: number): AnyRule | null {
        return engineApi.retrieveRuleNode(filterId, ruleIndex);
    }
}
