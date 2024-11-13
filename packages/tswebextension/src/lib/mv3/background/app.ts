import browser from 'webextension-polyfill';
import zod from 'zod';
import {
    Filter,
    METADATA_RULESET_ID,
    RULESET_NAME_PREFIX,
    RuleSetByteRangeCategory,
    type IFilter,
    type IRuleSet,
} from '@adguard/tsurlfilter/es/declarative-converter';
import {
    FilterListPreprocessor,
    preprocessedFilterListValidator,
    type PreprocessedFilterList,
} from '@adguard/tsurlfilter';

import { LogLevel } from '@adguard/logger';
import { type AnyRule } from '@adguard/agtree';
import { extSessionStorage } from './ext-session-storage';
import { appContext } from './app-context';
import { logger, stringifyObjectWithoutKeys } from '../../common/utils/logger';
import { type FailedEnableRuleSetsError } from '../errors/failed-enable-rule-sets-error';

import FiltersApi, { type UpdateStaticFiltersResult } from './filters-api';
import DynamicRulesApi, { type ConversionResult } from './dynamic-rules-api';
import { MessagesApi, type MessagesHandlerMV3 } from './messages-api';
import { engineApi } from './engine-api';
import { declarativeFilteringLog } from './declarative-filtering-log';
import { RuleSetsLoaderApi } from './rule-sets-loader-api';
import { Assistant } from './assistant';
import {
    type ConfigurationMV3,
    type ConfigurationMV3Context,
    configurationMV3Validator,
} from './configuration';
import { RequestEvents } from './request/events/request-events';
import { tabsApi } from '../tabs/tabs-api';
import { TabsCosmeticInjector } from '../tabs/tabs-cosmetic-injector';
import { WebRequestApi } from './web-request-api';
import { type StealthConfigurationResult, StealthService } from './services/stealth-service';
import { allowlistApi } from './allowlist-api';
import { type AppInterface } from '../../common/app';
import { defaultFilteringLog } from '../../common/filtering-log';
import { getErrorMessage } from '../../common/error';
import { ALLOWLIST_FILTER_ID, QUICK_FIXES_FILTER_ID, USER_FILTER_ID } from '../../common/constants';
import { FiltersStorage } from '../../common/storage/filters';

type ConfigurationResult = {
    staticFiltersStatus: UpdateStaticFiltersResult,
    staticFilters: IRuleSet[],
    dynamicRules?: ConversionResult
    stealthResult?: StealthConfigurationResult,
};

type FiltersUpdateInfo = {
    staticFilters: IFilter[],
    customFilters: IFilter[],
    filtersIdsToEnable: number[]
    filtersIdsToDisable: number[],
};

// Reexport types
export type {
    ConfigurationResult,
    ConversionResult,
    FailedEnableRuleSetsError,
};

const loadFilterContentValidator = zod.function()
    .args(zod.number())
    .returns(
        zod.promise(
            preprocessedFilterListValidator,
        ),
    );

/**
 * Lazy load filter content.
 *
 * @param filterId Filter identifier to load content for.
 *
 * @returns Promise that resolves to the filter content (see {@link PreprocessedFilterList})
 * or null if the filter is not found.
 *
 * @throws Error if the filter content cannot be loaded.
 */
export type LoadFilterContent = zod.infer<typeof loadFilterContentValidator>;

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
     * @param webAccessibleResourcesPath Path to resources.
     *
     * @see {@link TsWebExtension.webAccessibleResourcesPath} for details.
     */
    constructor(webAccessibleResourcesPath?: string) {
        this.webAccessibleResourcesPath = webAccessibleResourcesPath;
    }

    /**
     * Syncs specified filters with the extension storage.
     *
     * This method is needed to update the extension storage with the latest filters content.
     *
     * @param filterIds Filter identifiers to sync.
     * @param ruleSetsPath Path to the rulesets.
     * @param removeFilters Remove filters from the storage that are not in the filterIds list.
     * It is used to avoid storing outdated filters.
     *
     * @returns Promise that resolves when the sync is finished.
     */
    private static async syncFiltersWithStorage(
        filterIds: number[],
        ruleSetsPath: string,
        removeFilters = true,
    ): Promise<void> {
        logger.info('Syncing enabled filters with the extension storage');

        const filters: Record<number, PreprocessedFilterList> = {};
        const checksums: Record<number, string> = {};

        // Ruleset JSON files might be updated, so we need to update preprocessed filter list in the extension storage
        for (const rulesetId of filterIds) {
            // Get up-to-date preprocessed filter list
            try {
                // eslint-disable-next-line no-await-in-loop
                const [ruleSetChecksum, ruleSetChecksumStorage] = await Promise.all([
                    TsWebExtension.getChecksum(rulesetId, ruleSetsPath),
                    FiltersStorage.getChecksum(rulesetId),
                ]);

                if (ruleSetChecksum === ruleSetChecksumStorage) {
                    logger.info(`Filter with id ${rulesetId} is up-to-date, skipping the update`);
                    continue;
                }

                // eslint-disable-next-line no-await-in-loop
                const preprocessed = await TsWebExtension.getPreprocessedFilterList(rulesetId, ruleSetsPath);

                filters[rulesetId] = preprocessed;

                if (ruleSetChecksum) {
                    checksums[rulesetId] = ruleSetChecksum;
                }
            } catch (e) {
                logger.error(`Failed to update filter with id ${rulesetId}. Got error: ${getErrorMessage(e)}`);
            }
        }

        if (Object.keys(filters).length > 0) {
            await FiltersStorage.setMultipleFilters(filters);
            await FiltersStorage.setMultipleChecksums(checksums);
        }

        if (removeFilters) {
            const allFilters = await FiltersStorage.getFilterIds();
            const filtersToRemove = allFilters.filter((filterId) => !filterIds.includes(filterId));

            if (filtersToRemove.length > 0) {
                await FiltersStorage.removeMultipleFilters(filtersToRemove);

                logger.info(`Removed the following filters: ${filtersToRemove.join(', ')}`);
            }
        }

        logger.info(`Synced the following filters: ${filterIds.join(', ')}`);
    }

    /**
     * Loads filter content by filter id.
     *
     * @param filterId Filter identifier to load content for.
     *
     * @returns Promise that resolves to the filter content (see {@link PreprocessedFilterList})
     * or null if the filter is not found.
     *
     * @throws Error if the filter content cannot be loaded.
     */
    private static loadFilterContent = async (filterId: number): Promise<PreprocessedFilterList> => {
        try {
            const result = await FiltersStorage.getFilter(filterId);

            if (!result) {
                throw new Error(`Filter with id ${filterId} not found`);
            }

            return result;
        } catch (e) {
            throw new Error(`Failed to load filter content: ${e}`);
        }
    };

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
        logger.debug('[tswebextension.innerStart]: start');

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

            appContext.isAppStarted = true;
            this.isStarted = true;
            this.startPromise = undefined;

            logger.debug('[tswebextension.innerStart]: started');

            return res;
        } catch (e) {
            this.startPromise = undefined;

            logger.debug('[tswebextension.innerStart]: failed due to ', getErrorMessage(e));

            throw new Error('Cannot be started: ', { cause: e as Error });
        }
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

        logger.debug('[tswebextension.start]: is started ', this.isStarted);

        if (this.isStarted) {
            throw new Error('Already started');
        }

        if (this.startPromise) {
            logger.debug('[tswebextension.start]: already called start, waiting');
            const res = await this.startPromise;
            logger.debug('[tswebextension.start]: awaited start');
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

        TsWebExtension.updateRuleSetsForFilteringLog([], false);

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
     * @see {@link ConversionResult}
     *
     * @throws Error if the filter content is not provided and not already set in the class instance.
     */
    public async configure(config: ConfigurationMV3): Promise<ConfigurationResult> {
        await TsWebExtension.syncFiltersWithStorage(config.staticFiltersIds, config.ruleSetsPath);

        // Update log level before first log message.
        TsWebExtension.updateLogLevel(config.logLevel);

        // Exclude binary fields from logged config.
        const binaryFields = ['userrules', 'sourceMap', 'rawFilterList', 'filterList', 'conversionMap'];
        logger.debug('[tswebextension.configure]: start with ', stringifyObjectWithoutKeys(config, binaryFields));

        const configuration = configurationMV3Validator.parse(config);

        const res: ConfigurationResult = {
            staticFiltersStatus: {
                errors: [],
            },
            staticFilters: [],
        };

        if (configuration.settings.filteringEnabled) {
            res.stealthResult = await StealthService.applySettings(configuration.settings);

            // Extract filters info from configuration and wrap them into IFilters.
            const {
                staticFilters,
                customFilters,
                filtersIdsToEnable,
                filtersIdsToDisable,
            } = await TsWebExtension.getFiltersUpdateInfo(configuration, TsWebExtension.loadFilterContent);

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
            const combinedAllowlistRules = allowlistApi.combineAllowListRulesForDNR();

            const userRulesFilter = new Filter(
                USER_FILTER_ID,
                { getContent: () => Promise.resolve(configuration.userrules) },
                true,
            );

            const allowlistFilter = new Filter(
                ALLOWLIST_FILTER_ID,
                // TODO: Generate AST directly for allowlist rules.
                { getContent: () => Promise.resolve(FilterListPreprocessor.preprocess(combinedAllowlistRules)) },
                true,
            );

            const quickFixesFilter = new Filter(
                QUICK_FIXES_FILTER_ID,
                { getContent: () => Promise.resolve(configuration.quickFixesRules) },
                true,
            );

            // Convert quick fixes rules, allowlist, custom filters and user
            // rules into one rule set and apply it.
            res.dynamicRules = await DynamicRulesApi.updateDynamicFiltering(
                quickFixesFilter,
                allowlistFilter,
                userRulesFilter,
                customFilters,
                enabledStaticRuleSets,
                this.webAccessibleResourcesPath,
            );

            // Reload engine for cosmetic rules
            engineApi.waitingForEngine = engineApi.startEngine({
                filters: [
                    ...staticFilters,
                    ...customFilters,
                ],
                userrules: configuration.userrules,
                quickFixesRules: configuration.quickFixesRules,
            });
            await engineApi.waitingForEngine;

            // TODO: Recreate only dynamic rule set, because static cannot be changed
            const ruleSets = [
                ...staticRuleSets,
                res.dynamicRules.ruleSet,
            ];

            // Update rulesets in declarative filtering log.
            TsWebExtension.updateRuleSetsForFilteringLog(ruleSets, configuration.declarativeLogEnabled);

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

        logger.debug('[tswebextension.configure]: end');

        return res;
    }

    /**
     * Updates `hideReferrer` stealth config value without re-initialization of engine.
     *
     * @throws Error if {@link configuration} not set.
     * @param isHideReferrer `isHideReferrer` stealth config value.
     *
     * @returns True if the value was successfully updated, false otherwise.
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
     * @throws Error if {@link configuration} not set.
     * @param isBlockWebRTC `blockWebRTC` stealth config value.
     *
     * @returns True if the value was successfully updated, false otherwise.
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
     * @throws Error if {@link configuration} not set.
     * @param isBlockChromeClientData `blockChromeClientData` stealth config value.
     *
     * @returns True if the value was successfully updated, false otherwise.
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
     * @throws Error if {@link configuration} not set.
     * @param isSendDoNotTrack `sendDoNotTrack` stealth config value.
     *
     * @returns True if the value was successfully updated, false otherwise.
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
     * @throws Error if {@link configuration} not set.
     * @param isHideSearchQueries `hideSearchQueries` stealth config value.
     *
     * @returns True if the value was successfully updated, false otherwise.
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
            .filter(({ id }) => id !== `${RULESET_NAME_PREFIX}${METADATA_RULESET_ID}`);

        const staticRuleSetsTasks = manifestRuleSets.map(({ id }) => {
            return ruleSetsLoaderApi.createRuleSet(id, staticFilters);
        });

        try {
            const staticRuleSets = await Promise.all(staticRuleSetsTasks);

            return staticRuleSets;
        } catch (e) {
            const filterListIds = staticFilters.map((f) => f.getId());

            // eslint-disable-next-line max-len
            logger.error(`[tswebextension.loadStaticRuleSets]: Cannot scan rules of filter list with ids ${filterListIds} due to: ${getErrorMessage(e)}`);

            return [];
        }
    }

    /**
     * Set provided list of rule sets to a filtering log.
     *
     * @param allRuleSets List of {@link IRuleSet}.
     * @param declarativeLogEnabled Should we log matched declarative rules.
     */
    private static updateRuleSetsForFilteringLog(
        allRuleSets: IRuleSet[],
        declarativeLogEnabled: boolean,
    ): void {
        declarativeFilteringLog.ruleSets = allRuleSets;

        if (declarativeLogEnabled) {
            declarativeFilteringLog.start();
        } else {
            declarativeFilteringLog.stop();
        }
    }

    /**
     * Initialize app persistent data.
     * This method called as soon as possible and allows access
     * to the actual context before the app is started.
     */
    // eslint-disable-next-line class-methods-use-this
    public async initStorage(): Promise<void> {
        await extSessionStorage.init();
        appContext.isStorageInitialized = true;
    }

    /**
     * Sets the debug scriptlets state.
     *
     * @throws Error if {@link configuration} not set.
     * @param debug Debug filtering state.
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
     * @throws Error if {@link configuration} not set.
     * @param isCollectStats `collectStats` config value.
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
     * Retrieves rule node from a dynamic filter.
     * Dynamic filters are filters that are not loaded from the storage but
     * created on the fly: now only for allowlist.
     *
     * @param filterId Filter id.
     * @param ruleIndex Rule index.
     * @returns Rule node or null.
     */
    // eslint-disable-next-line class-methods-use-this
    public retrieveDynamicRuleNode(filterId: number, ruleIndex: number): AnyRule | null {
        return engineApi.retrieveDynamicRuleNode(filterId, ruleIndex);
    }

    /**
     * Gets the checksums of the rule sets.
     *
     * @param ruleSetId Rule set id.
     * @param ruleSetsPath Path to the rule sets.
     *
     * @returns Checksums of the rule sets.
     *
     * @throws If the rule sets loader is not initialized or the checksum for the specified rule set is not found.
     */
    public static getChecksum(ruleSetId: string | number, ruleSetsPath: string): Promise<string | undefined> {
        const ruleSetsLoaderApi = new RuleSetsLoaderApi(ruleSetsPath);

        return ruleSetsLoaderApi.getChecksum(ruleSetId);
    }

    /**
     * Retrieves the raw filter list.
     *
     * @param filterId Filter id.
     * @param ruleSetsPath Path to the rule sets.
     *
     * @returns Raw filter list.
     *
     * @throws Error if rule sets path is not set.
     */
    public static getRawFilterList = async (
        filterId: number,
        ruleSetsPath: string,
    ): Promise<string> => {
        const ruleSetsLoaderApi = new RuleSetsLoaderApi(ruleSetsPath);
        const ruleSetId = RuleSetsLoaderApi.getRuleSetId(filterId);

        return ruleSetsLoaderApi.getRawCategoryContent(
            ruleSetId,
            RuleSetByteRangeCategory.PreprocessedFilterListRaw,
        ).then(JSON.parse);
    };

    /**
     * Retrieves the preprocessed filter list.
     *
     * @param filterId Filter id.
     * @param ruleSetsPath Path to the rule sets.
     *
     * @returns Preprocessed filter list.
     *
     * @throws Error if rule sets path is not set.
     *
     * @note You can learn more about the preprocessed filter list in
     * {@link https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/tsurlfilter#preprocessedfilterlist-interface|tsurlfilter documentation}.
     */
    public static getPreprocessedFilterList = async (
        filterId: number,
        ruleSetsPath: string,
    ): Promise<PreprocessedFilterList> => {
        const ruleSetsLoaderApi = new RuleSetsLoaderApi(ruleSetsPath);
        const ruleSetId = RuleSetsLoaderApi.getRuleSetId(filterId);

        const [rawFilterList, conversionMap] = await Promise.all([
            ruleSetsLoaderApi.getRawCategoryContent(
                ruleSetId,
                RuleSetByteRangeCategory.PreprocessedFilterListRaw,
            ).then(JSON.parse),

            ruleSetsLoaderApi.getRawCategoryContent(
                ruleSetId,
                RuleSetByteRangeCategory.PreprocessedFilterListConversionMap,
            ).then(JSON.parse),
        ]);

        return FilterListPreprocessor.preprocessLightweight({
            rawFilterList,
            conversionMap,
        });
    };
}
