/* eslint-disable class-methods-use-this */
import { LogLevel } from '@adguard/logger';

import { type MessageHandler, type AppInterface } from '../../common/app';
import { type FilteringLog, type FilteringLogEvent } from '../../common/filtering-log';
import { type EventChannel } from '../../common/utils/channels';
import { logger } from '../../common/utils/logger';

import { assistant, Assistant } from './assistant';
import { type AppContext } from './app-context';
import { type ConfigurationMV2, type ConfigurationMV2Context, configurationMV2Validator } from './configuration';
import { type EngineApi } from './engine-api';
import { type ExtSessionStorage } from './ext-session-storage';
import { type MessagesApi } from './messages-api';
import { RequestEvents } from './request';
import { type LocalScriptRules, localScriptRulesService } from './services/local-script-rules-service';
import { type StealthApi } from './stealth-api';
import { type TabsApi } from './tabs/tabs-api';
import { type TabsCosmeticInjector } from './tabs/tabs-cosmetic-injector';
import { type RedirectsService } from './services/redirects/redirects-service';
import { type DocumentBlockingService } from './services/document-blocking-service';
import { WebRequestApi } from './web-request-api';

/**
 * App implementation for MV2.
 */
export class TsWebExtension implements AppInterface<
    ConfigurationMV2,
    ConfigurationMV2Context,
    void
> {
    /**
     * Fires on filtering log event.
     */
    public onFilteringLogEvent: EventChannel<FilteringLogEvent>;

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
        // TODO: Remove this check after moving call of storage initialization in extension code.
        // Check this flag before access storage values, because engine methods
        // can be triggered before initialization by extension `onCheckRequestFilterReady` method.
        if (!this.appContext.isStorageInitialized) {
            return false;
        }

        return this.appContext.isAppStarted;
    }

    /**
     * Sets app running status.
     *
     * @param value Status value.
     */
    public set isStarted(value: boolean) {
        this.appContext.isAppStarted = value;
    }

    /**
     * Gets app configuration context.
     *
     * @returns True if app started, else false.
     *
     * @throws Error if value not set.
     */
    public get configuration(): ConfigurationMV2Context {
        if (!this.appContext.configuration) {
            throw new Error('Configuration not set!');
        }

        return this.appContext.configuration;
    }

    /**
     * Sets app configuration context.
     *
     * @param value Status value.
     */
    public set configuration(value: ConfigurationMV2Context) {
        this.appContext.configuration = value;
    }

    /**
     * Creates new instance of {@link TsWebExtension}.
     *
     * @param appContext Top level app context storage.
     * @param tabsApi Wrapper around browser.tabs API.
     * @param engineApi TSUrlFilter Engine wrapper.
     * @param stealthApi Stealth api implementation.
     * @param messagesApi Wrapper around browser.runtime API.
     * @param tabCosmeticInjector Used to inject cosmetic rules into opened tabs on extension start.
     * @param redirectsService Service for working with redirects.
     * @param documentBlockingService Service encapsulate processing of $document modifier rules.
     * @param filteringLog Filtering log API.
     * @param extSessionStorage API for storing data described by SessionStorageSchema in the browser.storage.session.
     */
    constructor(
        private readonly appContext: AppContext,
        private readonly tabsApi: TabsApi,
        private readonly engineApi: EngineApi,
        private readonly stealthApi: StealthApi,
        private readonly messagesApi: MessagesApi,
        private readonly tabCosmeticInjector: TabsCosmeticInjector,
        private readonly redirectsService: RedirectsService,
        private readonly documentBlockingService: DocumentBlockingService,
        private readonly filteringLog: FilteringLog,
        private readonly extSessionStorage: ExtSessionStorage,
    ) {
        this.onFilteringLogEvent = this.filteringLog.onLogEvent;
        this.getMessageHandler = this.getMessageHandler.bind(this);
    }

    /**
     * Initialize app persistent data.
     * This method called as soon as possible and allows access
     * to the actual context before the app is started.
     */
    public async initStorage(): Promise<void> {
        await this.extSessionStorage.init();
        this.appContext.isStorageInitialized = true;
    }

    /**
     * Initializes {@link EngineApi} with passed {@link configuration}.
     * Starts request processing via {@link WebRequestApi} and tab tracking via {@link tabsApi}.
     *
     * Also updates webRTC privacy.network settings on demand and flushes browser in-memory request cache.
     *
     * @param configuration App configuration.
     *
     * @throws Error if configuration is not valid.
     */
    public async start(configuration: ConfigurationMV2): Promise<void> {
        if (!this.appContext.startTimeMs) {
            this.appContext.startTimeMs = Date.now();
        }

        configurationMV2Validator.parse(configuration);

        this.configuration = TsWebExtension.createConfigurationMV2Context(configuration);

        TsWebExtension.updateLogLevel(configuration.logLevel);

        RequestEvents.init();
        await this.redirectsService.start();
        this.documentBlockingService.configure(configuration);
        await this.engineApi.startEngine(configuration);
        await this.tabCosmeticInjector.processOpenTabs();
        await this.tabsApi.start();
        WebRequestApi.start();
        Assistant.setAssistantUrl(configuration.settings.assistantUrl);

        await WebRequestApi.flushMemoryCache();
        await this.stealthApi.updateWebRtcPrivacyPermissions();

        this.isStarted = true;
    }

    /**
     * Fully stop request and tab processing.
     */
    public async stop(): Promise<void> {
        WebRequestApi.stop();
        this.tabsApi.stop();
        this.isStarted = false;
    }

    /**
     * Re-initializes {@link EngineApi} with passed {@link configuration}
     * and update tabs main frame rules based on new engine state.
     *
     * Also updates webRTC privacy.network settings on demand and flushes browser in-memory request cache.
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

        TsWebExtension.updateLogLevel(configuration.logLevel);

        this.configuration = TsWebExtension.createConfigurationMV2Context(configuration);

        this.documentBlockingService.configure(configuration);
        await this.engineApi.startEngine(configuration);
        await this.tabsApi.updateCurrentTabsMainFrameRules();

        await WebRequestApi.flushMemoryCache();
        await this.stealthApi.updateWebRtcPrivacyPermissions();
    }

    /**
     * Opens assistant in the tab.
     *
     * @param tabId Tab id where assistant will be opened.
     */
    public async openAssistant(tabId: number): Promise<void> {
        this.tabsApi.setAssistantInitTimestamp(tabId);
        await assistant.openAssistant(tabId);
    }

    /**
     * Close assistant in the required tab.
     *
     * @param tabId Tab id.
     */
    public async closeAssistant(tabId: number): Promise<void> {
        this.tabsApi.resetAssistantInitTimestamp(tabId);
        await Assistant.closeAssistant(tabId);
    }

    /**
     * Return rules count for current configuration.
     *
     * @returns Rules count.
     */
    public getRulesCount(): number {
        return this.engineApi.getRulesCount();
    }

    /**
     * Returns a message handler that will listen to internal messages,
     * for example: message for get computed css for content-script.
     *
     * @returns Messages handler.
     */
    public getMessageHandler(): MessageHandler {
        return this.messagesApi.handleMessage;
    }

    /**
     * This is STEP 2: Local script rules are passed to the engine via following API method `setLocalScriptRules()`.
     *
     * The whole process is explained below.
     *
     * To fully comply with Chrome Web Store policies regarding remote code execution,
     * we implement a strict security-focused approach for Scriptlet and JavaScript rules execution.
     *
     * 1. Default - regular users that did not grant User scripts API permission explicitly:
     *    - We collect and pre-build script rules from the filters and statically bundle
     *      them into the extension - STEP 1. See 'updateLocalResourcesForChromiumMv3' in our build tools.
     *      IMPORTANT: all scripts and their arguments are local and bundled within the extension.
     *    - These pre-verified local scripts are passed to the engine - STEP 2.
     *    - At runtime before the execution, we check if each script rule is included
     *      in our local scripts list (STEP 3).
     *    - Only pre-verified local scripts are executed via chrome.scripting API (STEP 4.1 and 4.2).
     *      All other scripts are discarded.
     *    - Custom filters are NOT allowed for regular users to prevent any possibility
     *      of remote code execution, regardless of rule interpretation.
     *
     * 2. For advanced users that explicitly granted User scripts API permission -
     *    via enabling the Developer mode or Allow user scripts in the extension details:
     *    - Custom filters are allowed and may contain Scriptlet and JS rules
     *      that can be executed using the browser's built-in userScripts API (STEP 4.3),
     *      which provides a secure sandbox.
     *    - This execution bypasses the local script verification process but remains
     *      isolated and secure through Chrome's native sandboxing.
     *    - This mode requires explicit user activation and is intended for advanced users only.
     *
     * IMPORTANT:
     * Custom filters are ONLY supported when User scripts API permission is explicitly enabled.
     * This strict policy prevents Chrome Web Store rejection due to potential remote script execution.
     * When custom filters are allowed, they may contain:
     * 1. Network rules – converted to DNR rules and applied via dynamic rules.
     * 2. Cosmetic rules – interpreted directly in the extension code.
     * 3. Scriptlet and JS rules – executed via the browser's userScripts API (userScripts.execute)
     *    with Chrome's native sandboxing providing security isolation.
     *
     * For regular users without User scripts API permission (default case):
     * - Only pre-bundled filters with statically verified scripts are supported.
     * - Downloading custom filters or any rules from remote sources is blocked entirely
     *   to ensure compliance with the store policies.
     *
     * This implementation ensures perfect compliance with Chrome Web Store policies
     * by preventing any possibility of remote code execution for regular users.
     *
     * It is possible to follow all places using this logic by searching JS_RULES_EXECUTION.
     */
    /**
     * Sets prebuild local script rules.
     *
     * @param localScriptRules JSON object with pre-build JS rules. @see {@link LocalScriptRulesService}.
     */
    public setLocalScriptRules(localScriptRules: LocalScriptRules): void {
        localScriptRulesService.setLocalScriptRules(localScriptRules);
    }

    /**
     * Updates `filteringEnabled` configuration value without re-initialization of engine.
     *
     * Also updates webRTC privacy.network settings on demand and flushes browser in-memory request cache.
     *
     * @param isFilteringEnabled `filteringEnabled` config value.
     *
     * @throws Error if {@link configuration} not set.
     */
    public async setFilteringEnabled(isFilteringEnabled: boolean): Promise<void> {
        this.configuration.settings.filteringEnabled = isFilteringEnabled;

        await WebRequestApi.flushMemoryCache();
        await this.stealthApi.updateWebRtcPrivacyPermissions();
    }

    /**
     * Updates `collectStats` configuration value without re-initialization of engine.
     *
     * @param isCollectStats `collectStats` config value.
     *
     * @throws Error if {@link configuration} not set.
     */
    public setCollectHitStats(isCollectStats: boolean): void {
        this.configuration.settings.collectStats = isCollectStats;
    }

    /**
     * Updates `debugScriptlets` configuration value without re-initialization of engine.
     *
     * @param isDebugScriptlets `debugScriptlets` config value.
     *
     * @throws Error if {@link configuration} not set.
     */
    public setDebugScriptlets(isDebugScriptlets: boolean): void {
        this.configuration.settings.debugScriptlets = isDebugScriptlets;
    }

    /**
     * Updates `stealthModeEnabled` configuration value without re-initialization of engine.
     * Also updates webRTC privacy.network settings on demand.
     *
     * @param isStealthModeEnabled `stealthModeEnabled` config value.
     *
     * @throws Error if {@link configuration} not set.
     */
    public async setStealthModeEnabled(isStealthModeEnabled: boolean): Promise<void> {
        this.configuration.settings.stealthModeEnabled = isStealthModeEnabled;

        await this.stealthApi.updateWebRtcPrivacyPermissions();
    }

    /**
     * Updates `selfDestructFirstPartyCookies` stealth config value without re-initialization of engine.
     *
     * @param isSelfDestructFirstPartyCookies `selfDestructFirstPartyCookies` stealth config value.
     *
     * @throws Error if {@link configuration} not set.
     */
    public setSelfDestructFirstPartyCookies(isSelfDestructFirstPartyCookies: boolean): void {
        this.configuration.settings.stealth.selfDestructFirstPartyCookies = isSelfDestructFirstPartyCookies;
    }

    /**
     * Updates `selfDestructThirdPartyCookies` stealth config value without re-initialization of engine.
     *
     * @param isSelfDestructThirdPartyCookies `selfDestructThirdPartyCookies` stealth config value.
     *
     * @throws Error if {@link configuration} not set.
     */
    public setSelfDestructThirdPartyCookies(isSelfDestructThirdPartyCookies: boolean): void {
        this.configuration.settings.stealth.selfDestructThirdPartyCookies = isSelfDestructThirdPartyCookies;
    }

    /**
     * Updates `selfDestructFirstPartyCookiesTime` stealth config value without re-initialization of engine.
     *
     * @param selfDestructFirstPartyCookiesTime `selfDestructFirstPartyCookiesTime` stealth config value.
     *
     * @throws Error if {@link configuration} not set.
     */
    public setSelfDestructFirstPartyCookiesTime(selfDestructFirstPartyCookiesTime: number): void {
        this.configuration.settings.stealth.selfDestructFirstPartyCookiesTime = selfDestructFirstPartyCookiesTime;
    }

    /**
     * Updates `selfDestructThirdPartyCookiesTime` stealth config value without re-initialization of engine.
     *
     * @param selfDestructThirdPartyCookiesTime `selfDestructThirdPartyCookiesTime` stealth config value.
     *
     * @throws Error if {@link configuration} not set.
     */
    public setSelfDestructThirdPartyCookiesTime(selfDestructThirdPartyCookiesTime: number): void {
        this.configuration.settings.stealth.selfDestructThirdPartyCookiesTime = selfDestructThirdPartyCookiesTime;
    }

    /**
     * Updates `hideReferrer` stealth config value without re-initialization of engine.
     *
     * @param isHideReferrer `isHideReferrer` stealth config value.
     *
     * @returns Applied value for compatibility with MV3 interface.
     *
     * @throws Error if {@link configuration} not set.
     */
    public setHideReferrer(isHideReferrer: boolean): boolean {
        this.configuration.settings.stealth.hideReferrer = isHideReferrer;

        return isHideReferrer;
    }

    /**
     * Updates `hideSearchQueries` stealth config value without re-initialization of engine.
     *
     * @param isHideSearchQueries `hideSearchQueries` stealth config value.
     *
     * @returns Applied value for compatibility with MV3 interface.
     *
     * @throws Error if {@link configuration} not set.
     */
    public setHideSearchQueries(isHideSearchQueries: boolean): boolean {
        this.configuration.settings.stealth.hideSearchQueries = isHideSearchQueries;

        return isHideSearchQueries;
    }

    /**
     * Updates `blockChromeClientData` stealth config value without re-initialization of engine.
     *
     * @param isBlockChromeClientData `blockChromeClientData` stealth config value.
     *
     * @returns Applied value for compatibility with MV3 interface.
     *
     * @throws Error if {@link configuration} not set.
     */
    public setBlockChromeClientData(isBlockChromeClientData: boolean): boolean {
        this.configuration.settings.stealth.blockChromeClientData = isBlockChromeClientData;

        return isBlockChromeClientData;
    }

    /**
     * Updates `sendDoNotTrack` stealth config value without re-initialization of engine.
     *
     * @param isSendDoNotTrack `sendDoNotTrack` stealth config value.
     *
     * @returns Applied value for compatibility with MV3 interface.
     *
     * @throws Error if {@link configuration} not set.
     */
    public setSendDoNotTrack(isSendDoNotTrack: boolean): boolean {
        this.configuration.settings.stealth.sendDoNotTrack = isSendDoNotTrack;

        return isSendDoNotTrack;
    }

    /**
     * Updates `blockWebRTC` stealth config value without re-initialization of engine.
     * Also updates webRTC privacy.network settings on demand.
     *
     * @param isBlockWebRTC `blockWebRTC` stealth config value.
     *
     * @returns Applied value for compatibility with MV3 interface.
     *
     * @throws Error if {@link configuration} not set.
     */
    public async setBlockWebRTC(isBlockWebRTC: boolean): Promise<boolean> {
        this.configuration.settings.stealth.blockWebRTC = isBlockWebRTC;

        await this.stealthApi.updateWebRtcPrivacyPermissions();

        return isBlockWebRTC;
    }

    /**
     * Creates configuration context.
     *
     * @param configuration Configuration.
     *
     * @returns Configuration context.
     */
    private static createConfigurationMV2Context(configuration: ConfigurationMV2): ConfigurationMV2Context {
        const {
            filters,
            verbose,
            logLevel,
            settings,
        } = configuration;

        return {
            filters: filters.map(({ filterId }) => filterId),
            verbose,
            logLevel,
            settings,
        };
    }

    /**
     * Updates the log level.
     *
     * @param logLevel Log level.
     */
    private static updateLogLevel(logLevel: ConfigurationMV2['logLevel']): void {
        try {
            logger.currentLevel = logLevel as LogLevel || LogLevel.Info;
        } catch (e) {
            logger.currentLevel = LogLevel.Info;
        }
    }
}
