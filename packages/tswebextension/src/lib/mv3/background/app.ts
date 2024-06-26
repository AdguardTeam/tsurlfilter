import { type IFilter, type IRuleSet } from '@adguard/tsurlfilter/es/declarative-converter';
import browser from 'webextension-polyfill';

import { type AppInterface, defaultFilteringLog } from '../../common';
import { getErrorMessage } from '../../common';
import { logger } from '../utils/logger';
import { type FailedEnableRuleSetsError } from '../errors/failed-enable-rule-sets-error';

import FiltersApi, { type UpdateStaticFiltersResult } from './filters-api';
import UserRulesApi, { type ConversionResult } from './user-rules-api';
import { MessagesApi, type MessagesHandlerMV3 } from './messages-api';
import { engineApi } from './engine-api';
import { declarativeFilteringLog, type RecordFiltered } from './declarative-filtering-log';
import RuleSetsLoaderApi from './rule-sets-loader-api';
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
import { StealthService } from './services/stealth-service';
import { allowlistApi } from './allowlist-api';
import { CosmeticJsApi } from './cosmetic-js-api';

type ConfigurationResult = {
    staticFiltersStatus: UpdateStaticFiltersResult,
    staticFilters: IRuleSet[],
    dynamicRules?: ConversionResult
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
        logger.debug('[START]: start');

        try {
            const res = await this.configure(config);

            // Start listening for request events.
            RequestEvents.init();

            // Start handle request events.
            WebRequestApi.start();

            // Add tabs listeners
            await tabsApi.start();

            // Compute and save matching result for tabs, opened before app initialization.
            await TabsCosmeticInjector.processOpenTabs();

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
     * Starts filtering along with launching the tab listener, which will record
     * tab urls to work correctly with domain blocking/allowing rules, for
     * example: cosmetic rules in iframes.
     *
     * @param config {@link ConfigurationMV3} Configuration object to start with.
     *
     * @returns Promise resolved with result of configuration {@link ConfigurationResult}.
     */
    public async start(config: ConfigurationMV3): Promise<ConfigurationResult> {
        logger.debug('[START]: is started ', this.isStarted);

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
     * Removes all static and dynamic DNR rules and stops tsurlfilter engine.
     */
    private static async removeAllFilteringRules(): Promise<void> {
        await UserRulesApi.removeAllRules();

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
        await TsWebExtension.removeAllFilteringRules();

        await declarativeFilteringLog.stop();

        // Stop handle request events.
        WebRequestApi.stop();

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
     * @param config A {@link ConfigurationMV3} to apply.
     *
     * @returns ConfigurationResult {@link ConfigurationResult} which contains:
     * - list of errors for static filters, if any of them has been thrown
     * - converted dynamic rule set with rule set, errors and limitations.
     * @see {@link ConversionResult}
     */
    public async configure(config: ConfigurationMV3): Promise<ConfigurationResult> {
        logger.debug('[CONFIGURE]: start with ', config);

        const configuration = configurationMV3Validator.parse(config);

        const res: ConfigurationResult = {
            staticFiltersStatus: {
                errors: [],
            },
            staticFilters: [],
        };

        if (configuration.settings.filteringEnabled) {
            await StealthService.applySettings(configuration.settings);

            // Extract filters info from configuration and wrap them into IFilters.
            const {
                staticFilters,
                customFilters,
                filtersIdsToEnable,
                filtersIdsToDisable,
            } = await TsWebExtension.getFiltersUpdateInfo(configuration);

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

            // Update allowlist settings.
            allowlistApi.configure(configuration);
            // Combine all allowlist rules into one network rule.
            const combinedAllowlistRules = allowlistApi.combineAllowListRulesForDNR();

            // Convert custom filters and user rules into one rule set and apply it
            res.dynamicRules = await UserRulesApi.updateDynamicFiltering(
                configuration.userrules,
                combinedAllowlistRules,
                customFilters,
                staticRuleSets,
                this.webAccessibleResourcesPath,
            );

            // Reload engine for cosmetic rules
            engineApi.waitingForEngine = engineApi.startEngine({
                filters: [
                    ...staticFilters,
                    ...customFilters,
                ],
                userrules: configuration.userrules,
            });
            await engineApi.waitingForEngine;

            // TODO: Recreate only dynamic rule set, because static cannot be changed
            const ruleSets = [
                ...staticRuleSets,
                res.dynamicRules.ruleSet,
            ];

            // Update rulesets in declarative filtering log.
            TsWebExtension.updateRuleSetsForFilteringLog(
                ruleSets,
                configuration.filteringLogEnabled,
            );

            res.staticFilters = staticRuleSets;
        } else {
            await TsWebExtension.removeAllFilteringRules();
        }

        // Update previously opened tabs with new rules - find for each tab
        // new main frame rule.
        await tabsApi.updateCurrentTabsMainFrameRules();

        // Reload request events listeners.
        await WebRequestApi.flushMemoryCache();

        // TODO: verbose is deprecated, consider removing or replacing
        CosmeticJsApi.verbose = this.configuration?.verbose || false;

        this.configuration = TsWebExtension.createConfigurationContext(configuration);

        logger.debug('[CONFIGURE]: end');

        return res;
    }

    /**
     * Updates `hideReferrer` stealth config value without re-initialization of engine.
     *
     * @throws Error if {@link configuration} not set.
     * @param isHideReferrer `isHideReferrer` stealth config value.
     */
    public async setHideReferrer(isHideReferrer: boolean): Promise<void> {
        if (!this.configuration) {
            throw new Error('Configuration not set');
        }

        await StealthService.setHideReferrer(isHideReferrer);
        this.configuration.settings.stealth.hideReferrer = isHideReferrer;
    }

    /**
     * Updates `blockWebRTC` stealth config value without re-initialization of engine.
     * Also updates webRTC privacy.network settings on demand.
     *
     * @throws Error if {@link configuration} not set.
     * @param isBlockWebRTC `blockWebRTC` stealth config value.
     */
    public async setBlockWebRTC(isBlockWebRTC: boolean): Promise<void> {
        if (!this.configuration) {
            throw new Error('Configuration not set');
        }

        await StealthService.setDisableWebRTC(isBlockWebRTC);
        this.configuration.settings.stealth.blockWebRTC = isBlockWebRTC;
    }

    /**
     * Updates `blockChromeClientData` stealth config value without re-initialization of engine.
     *
     * @throws Error if {@link configuration} not set.
     * @param isBlockChromeClientData `blockChromeClientData` stealth config value.
     */
    public async setBlockChromeClientData(isBlockChromeClientData: boolean): Promise<void> {
        if (!this.configuration) {
            throw new Error('Configuration not set');
        }

        await StealthService.setBlockChromeClientData(isBlockChromeClientData);

        this.configuration.settings.stealth.blockChromeClientData = isBlockChromeClientData;
    }

    /**
     * Updates `sendDoNotTrack` stealth config value without re-initialization of engine.
     *
     * @throws Error if {@link configuration} not set.
     * @param isSendDoNotTrack `sendDoNotTrack` stealth config value.
     */
    public async setSendDoNotTrack(isSendDoNotTrack: boolean): Promise<void> {
        if (!this.configuration) {
            throw new Error('Configuration not set');
        }

        await StealthService.setSendDoNotTrack(
            isSendDoNotTrack,
            this.configuration.settings.gpcScriptUrl,
        );

        this.configuration.settings.stealth.sendDoNotTrack = isSendDoNotTrack;
    }

    /**
     * Updates `hideSearchQueries` stealth config value without re-initialization of engine.
     *
     * @throws Error if {@link configuration} not set.
     * @param isHideSearchQueries `hideSearchQueries` stealth config value.
     */
    public async setHideSearchQueries(isHideSearchQueries: boolean): Promise<void> {
        if (!this.configuration) {
            throw new Error('Configuration not set');
        }

        await StealthService.setHideSearchQueries(
            isHideSearchQueries,
            this.configuration.settings.hideDocumentReferrerScriptUrl,
        );

        this.configuration.settings.stealth.hideSearchQueries = isHideSearchQueries;
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

    /**
     * Extract configuration update info from already parsed configuration.
     *
     * @param parsedConfiguration Already parsed {@link ConfigurationMV3}.
     *
     * @returns Item of {@link FiltersUpdateInfo}.
     */
    private static async getFiltersUpdateInfo(
        parsedConfiguration: ConfigurationMV3,
    ): Promise<FiltersUpdateInfo> {
        // Wrap filters to tsurlfilter.IFilter
        const staticFilters = FiltersApi.createStaticFilters(
            parsedConfiguration.staticFiltersIds,
            parsedConfiguration.filtersPath,
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

        const manifestRuleSets = manifest.declarative_net_request.rule_resources;
        const staticRuleSetsTasks = manifestRuleSets.map(({ id }) => {
            return ruleSetsLoaderApi.createRuleSet(id, staticFilters);
        });

        try {
            const staticRuleSets = await Promise.all(staticRuleSetsTasks);

            return staticRuleSets;
        } catch (e) {
            const filterListIds = staticFilters.map((f) => f.getId());

            logger.error(`Cannot scan rules of filter list with ids ${filterListIds} due to: ${getErrorMessage(e)}`);

            return [];
        }
    }

    /**
     * Set provided list of rule sets to a filtering log and toggle it's status
     * with the passed value.
     *
     * @param allRuleSets List of {@link IRuleSet}.
     * @param filteringLogEnabled Preferred status for filtering log.
     */
    private static updateRuleSetsForFilteringLog(
        allRuleSets: IRuleSet[],
        filteringLogEnabled: boolean,
    ): void {
        declarativeFilteringLog.ruleSets = allRuleSets;

        // Starts or stop declarative filtering log.
        if (filteringLogEnabled) {
            declarativeFilteringLog.start();
        } else {
            declarativeFilteringLog.stop();
        }
    }

    /**
     * TODO: Check if this method is needed.
     * Initialize app persistent data.
     * This method called as soon as possible and allows access
     * to the actual context before the app is started.
     */
    // eslint-disable-next-line class-methods-use-this
    public async initStorage(): Promise<void> {
        logger.debug('initStorage NOT IMPLEMENTED');
    }

    /**
     * TODO implement this method later
     * Sets the debug filtering state.
     * @param debug Debug filtering state.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars,class-methods-use-this
    public setDebugScriptlets(debug: boolean): void {
        logger.debug('mv3 does not support setDebugScriptlets yet');
    }

    /**
     * TODO implement this method later
     * Sets the collect hit stats state.
     * @param collect Collect hit stats state.
     */
    // eslint-disable-next-line class-methods-use-this,@typescript-eslint/no-unused-vars
    public setCollectHitStats(collect: boolean): void {
        logger.debug('mv3 does not support setCollectHitStats yet');
    }

    /**
     * TODO implement this method later if needed
     * Sets prebuild local script rules.
     *
     * @param localScriptRules JSON object with pre-build JS rules.
     * @param localScriptRules.comment Comment for the rules.
     * @param localScriptRules.rules List of rules.
     * @see {@link LocalScriptRulesService}
     *
     */
    // eslint-disable-next-line class-methods-use-this,@typescript-eslint/no-unused-vars
    public setLocalScriptRules(localScriptRules:{
        comment: string, // TODO extract type to common
        rules: {
            domains: string,
            script: string,
        }[],
    }): void {
        logger.debug('mv3 does not support setLocalScriptRules yet');
    }
}
